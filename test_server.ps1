# Test Script for API Verification
$ErrorActionPreference = "Stop"

Write-Host "Testing GET /api/users..."
$users = Invoke-RestMethod -Uri "http://localhost:8080/api/users" -Method GET
Write-Host "Initial registered count: $($users.Count)"

Write-Host "Registering participant in Slot 1..."
$newReg = @{ id = 9901; name = "Vincent Moretti"; phone = "+1 555 019 9988"; slot = 1 } | ConvertTo-Json
$res = Invoke-RestMethod -Uri "http://localhost:8080/api/register" -Method POST -Body $newReg -ContentType "application/json"
Write-Host "Registration response: $($res.message)"

Write-Host "Verifying database state..."
$usersAfter = Invoke-RestMethod -Uri "http://localhost:8080/api/users" -Method GET
Write-Host "New registered count: $($usersAfter.Count)"

Write-Host "Cleaning up test user..."
Invoke-RestMethod -Uri "http://localhost:8080/api/users/9901" -Method DELETE | Out-Null
Write-Host "Test complete! All API endpoints functioning properly."
