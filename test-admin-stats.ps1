$loginBody = @{
  email = 'admin@gawahelper.com'
  password = 'Admin123456'
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri 'http://localhost:4000/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json' -UseBasicParsing
$loginData = $loginResponse.Content | ConvertFrom-Json
$token = $loginData.token

Write-Host "Token: $token"

# Test admin stats endpoint
$headers = @{
  'Authorization' = "Bearer $token"
}

$statsResponse = Invoke-WebRequest -Uri 'http://localhost:4000/api/admin/stats' -Headers $headers -UseBasicParsing
Write-Host "`nAdmin Stats Response:"
$statsResponse.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
