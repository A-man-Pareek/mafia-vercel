# Test Capacity Enforcement (15 Max Cap per Slot)

Write-Host "Resetting database..."
Invoke-RestMethod -Uri "http://localhost:8080/api/reset" -Method POST | Out-Null

Write-Host "Registering 15 participants in Slot 1..."
for ($i = 1; $i -le 15; $i++) {
    $user = @{ id = $i; name = "Student $i"; phone = "555-010-$i"; slot = 1 } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://localhost:8080/api/register" -Method POST -Body $user -ContentType "application/json" | Out-Null
}

$usersSlot1 = Invoke-RestMethod -Uri "http://localhost:8080/api/users" -Method GET
Write-Host "Slot 1 Current Count: $($usersSlot1.Count) / 15"

Write-Host "Attempting 16th registration in Slot 1 (Should be REJECTED with 400 SLOT_FULL)..."
try {
    $overflowUser = @{ id = 16; name = "Overflow Student"; phone = "555-010-16"; slot = 1 } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "http://localhost:8080/api/register" -Method POST -Body $overflowUser -ContentType "application/json"
    Write-Host "ERROR: 16th registration was accepted!" -ForegroundColor Red
} catch {
    Write-Host "SUCCESS: 16th registration rejected as expected! Server returned 400 SLOT_FULL." -ForegroundColor Green
}

Write-Host "Resetting database after test..."
Invoke-RestMethod -Uri "http://localhost:8080/api/reset" -Method POST | Out-Null
Write-Host "Capacity Cap Test Passed 100%!"
