# ==========================================================================
# SIGMA CIRCLE MATH CLUB - MAFIA: THE OLD COUNTRY
# PowerShell HTTP Server Backend & mafia.db Persistence
# ==========================================================================

param (
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $ScriptDir) { $ScriptDir = Get-Location }

$DbFile = Join-Path $ScriptDir "mafia.db"
$JsonDbFile = Join-Path $ScriptDir "mafia_users.json"
$AdminUsername = 'Aman'
$AdminPassword = 'AmanPareek'
$AdminSessionSecret = 'SigmaCircleMafiaAdminSecret2026'
$AdminSessions = @{}

Write-Host "==========================================================" -ForegroundColor Red
Write-Host " SIGMA CIRCLE MATH CLUB - MAFIA NIGHT BACKEND SERVER" -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Red
Write-Host "Root Directory: $ScriptDir" -ForegroundColor Gray
Write-Host "Database File: $DbFile" -ForegroundColor Gray

# Ensure Database Store
if (-not (Test-Path $JsonDbFile)) {
    @() | ConvertTo-Json | Set-Content $JsonDbFile -Encoding UTF8
}

function Get-DbUsers {
    if (Test-Path $JsonDbFile) {
        $raw = Get-Content $JsonDbFile -Raw -Encoding UTF8
        if ($raw) {
            return ($raw | ConvertFrom-Json)
        }
    }
    return @()
}

function Save-DbUsers($users) {
    $users | ConvertTo-Json -Depth 5 | Set-Content $JsonDbFile -Encoding UTF8
    
    # Mirror single table SQL dump format to mafia.db
    $sqlContent = "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, year TEXT, specifications TEXT, slot INTEGER);`nDELETE FROM users;`n"
    foreach ($u in $users) {
        $nameEsc = ($u.name -replace "'", "''")
        $phoneEsc = ($u.phone -replace "'", "''")
        $yearEsc = if ($u.PSObject.Properties.Name -contains 'year') { ($u.year -replace "'", "''") } else { '' }
        $specEsc = if ($u.PSObject.Properties.Name -contains 'specifications') { ($u.specifications -replace "'", "''") } else { '' }
        $slotValue = if ($null -ne $u.slot) { [int]$u.slot } else { 0 }
        $sqlContent += "INSERT INTO users (id, name, phone, year, specifications, slot) VALUES ($($u.id), '$nameEsc', '$phoneEsc', '$yearEsc', '$specEsc', $slotValue);`n"
    }
    Set-Content -Path $DbFile -Value $sqlContent -Encoding UTF8
}

function New-AdminToken {
    param([string]$username)
    $payload = "$username|$([DateTime]::UtcNow.ToString('o'))|$AdminSessionSecret"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $sha = [System.Security.Cryptography.SHA256Managed]::new()
    $hash = $sha.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
}

function Get-AdminSession {
    param([string]$token)
    if ([string]::IsNullOrWhiteSpace($token)) { return $null }
    if (-not $AdminSessions.ContainsKey($token)) { return $null }
    $session = $AdminSessions[$token]
    if ((Get-Date).ToUniversalTime() -gt [DateTime]$session.expiresAt) {
        $AdminSessions.Remove($token)
        return $null
    }
    return $session
}

function Require-AdminAuth {
    param($request, $response)
    $token = $null
    $authHeader = $request.Headers['Authorization']
    if ($authHeader -and $authHeader.StartsWith('Bearer ')) {
        $token = $authHeader.Substring(7).Trim()
    } elseif ($request.Headers['X-Admin-Token']) {
        $token = $request.Headers['X-Admin-Token']
    }

    $session = Get-AdminSession $token
    if (-not $session) {
        $errJson = @{ error = 'UNAUTHORIZED'; message = 'Admin authentication required.' } | ConvertTo-Json
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($errJson)
        $response.StatusCode = 401
        $response.ContentType = 'application/json; charset=utf-8'
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
        $response.Close()
        return $null
    }
    return $session
}

# Initialize HTTP Listener
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "[SERVER ONLINE] Listening for registrations at: http://localhost:$Port/" -ForegroundColor Green
    Write-Host "Press Ctrl+C in terminal to stop server." -ForegroundColor Yellow
} catch {
    Write-Host "[ERROR] Could not start HTTP listener on port $Port : $_" -ForegroundColor Red
    exit 1
}

function Get-ContentType($path) {
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".json" { return "application/json; charset=utf-8" }
        default { return "application/octet-stream" }
    }
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.AbsolutePath
        $method = $request.HttpMethod

        Write-Host "[$method] $path" -ForegroundColor Cyan

        # CORS Headers
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token")
        $response.AddHeader("Access-Control-Expose-Headers", "Content-Type, Authorization, X-Admin-Token")

        if ($method -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        # REST API Routes
        if ($path -eq "/api/admin/login" -and $method -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $body = $reader.ReadToEnd()
            $payload = $body | ConvertFrom-Json

            if ($payload.username -eq $AdminUsername -and $payload.password -eq $AdminPassword) {
                $token = New-AdminToken $payload.username
                $AdminSessions[$token] = [pscustomobject]@{
                    username = $payload.username
                    expiresAt = (Get-Date).ToUniversalTime().AddMinutes(30)
                }
                $resJson = @{ success = $true; token = $token; username = $payload.username; expiresIn = 1800 } | ConvertTo-Json
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
                $response.StatusCode = 200
                $response.ContentType = 'application/json; charset=utf-8'
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }

            $errJson = @{ success = $false; error = 'INVALID_CREDENTIALS'; message = 'Wrong admin username or password.' } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($errJson)
            $response.StatusCode = 401
            $response.ContentType = 'application/json; charset=utf-8'
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/api/admin/verify" -and $method -eq "GET") {
            $session = Require-AdminAuth $request $response
            if (-not $session) { continue }
            $resJson = @{ valid = $true; username = $session.username } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.StatusCode = 200
            $response.ContentType = 'application/json; charset=utf-8'
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/api/admin/logout" -and $method -eq "POST") {
            $session = Require-AdminAuth $request $response
            if (-not $session) { continue }
            $authHeader = $request.Headers['Authorization']
            $token = $null
            if ($authHeader -and $authHeader.StartsWith('Bearer ')) {
                $token = $authHeader.Substring(7).Trim()
            } elseif ($request.Headers['X-Admin-Token']) {
                $token = $request.Headers['X-Admin-Token']
            }
            if ($token) { $AdminSessions.Remove($token) }
            $resJson = @{ success = $true; message = 'Logged out' } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.StatusCode = 200
            $response.ContentType = 'application/json; charset=utf-8'
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/api/admin/users" -and $method -eq "GET") {
            $session = Require-AdminAuth $request $response
            if (-not $session) { continue }
            $users = Get-DbUsers
            $json = $users | ConvertTo-Json -Depth 5
            if (-not $json) { $json = '[]' }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.StatusCode = 200
            $response.ContentType = 'application/json; charset=utf-8'
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/api/admin/reset" -and $method -eq "POST") {
            $session = Require-AdminAuth $request $response
            if (-not $session) { continue }
            Save-DbUsers @()
            $resJson = @{ success = $true; message = 'Database reset' } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.StatusCode = 200
            $response.ContentType = 'application/json; charset=utf-8'
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/api/users" -and $method -eq "GET") {
            $users = Get-DbUsers
            $json = $users | ConvertTo-Json -Depth 5
            if (-not $json) { $json = "[]" }
            
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/api/register" -and $method -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $body = $reader.ReadToEnd()
            $newUser = $body | ConvertFrom-Json

            $users = @(Get-DbUsers)
            
            # CORE RULE 15-CAP CHECK:
            # SELECT COUNT(*) FROM users WHERE slot = ?
            $slotUsers = $users | Where-Object { [int]$_.slot -eq [int]$newUser.slot }
            $count = @($slotUsers).Count

            if ($count -ge 15) {
                $errJson = @{ error = "SLOT_FULL"; message = "Slot $($newUser.slot) has reached maximum capacity of 15 participants." } | ConvertTo-Json
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($errJson)
                $response.StatusCode = 400
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }

            # Allow Registration
            if (-not $newUser.id) { $newUser | Add-Member -MemberType NoteProperty -Name "id" -Value ([DateTime]::UtcNow.Ticks) }
            $users += $newUser
            Save-DbUsers $users

            $resJson = @{ success = $true; message = "Registration successful"; user = $newUser } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.StatusCode = 200
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path.StartsWith("/api/users/") -and $method -eq "DELETE") {
            $idToDelete = $path.Substring("/api/users/".Length)
            $users = @(Get-DbUsers) | Where-Object { "$($_.id)" -ne "$idToDelete" }
            Save-DbUsers $users

            $resJson = @{ success = $true; message = "Deleted" } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.StatusCode = 200
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/api/reset" -and $method -eq "POST") {
            Save-DbUsers @()
            $resJson = @{ success = $true; message = "Database reset" } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.StatusCode = 200
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($path -eq "/api/seed" -and $method -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $body = $reader.ReadToEnd()
            $seedUsers = $body | ConvertFrom-Json
            Save-DbUsers $seedUsers
            $resJson = @{ success = $true } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($resJson)
            $response.StatusCode = 200
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Static File Serving
        $localRelative = $path.TrimStart('/')
        if ($localRelative -eq "") { $localRelative = "index.html" }
        $filePath = Join-Path $ScriptDir $localRelative

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = Get-ContentType $filePath
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
        } else {
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $notFound.Length
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
            $response.Close()
        }
    } catch {
        Write-Host "[ERROR] Listener loop error: $_" -ForegroundColor Red
    }
}
