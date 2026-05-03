$body = @{
  email = 'admin@gawahelper.com'
  password = 'Admin123456'
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri 'http://localhost:4000/api/auth/login' -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing
Write-Host "Response Status: $($response.StatusCode)"
Write-Host "Response Body:"
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
