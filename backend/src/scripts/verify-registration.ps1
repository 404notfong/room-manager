Write-Host "--- TEST 1: Empty Body ---"
try {
    Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method Post -ContentType "application/json" -Body '{}'
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $body = $reader.ReadToEnd()
    Write-Host "Error Response Body: $body"
}

Write-Host "`n--- TEST 2: Duplicate Email (admin@example.com) ---"
$bodyJSON = '{"email": "admin@example.com", "password": "Password123!", "fullName": "Test User", "phone": "0900000000"}'
try {
    Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method Post -ContentType "application/json" -Body $bodyJSON
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $body = $reader.ReadToEnd()
    Write-Host "Error Response Body: $body"
}
