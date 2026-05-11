import fs from 'fs'

async function debug() {
  const loginRes = await fetch('https://backend-production-073c.up.railway.app/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Debug User', email: `debug${Date.now()}@example.com`, password: 'Password123!' })
  })
  
  const loginData = await loginRes.json()
  const token = loginData.token || loginData.user?.token
  
  if (!token) {
    console.log('Register failed', loginData)
    return
  }

  const summaryRes = await fetch('https://backend-production-073c.up.railway.app/api/home/summary', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  const summaryText = await summaryRes.text()
  console.log('Summary status:', summaryRes.status)
  console.log('Summary text:', summaryText)
}

debug()
