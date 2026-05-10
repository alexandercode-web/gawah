import pg from 'pg'
const { Pool } = pg

async function resetDatabase() {
  const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: '', 
    database: 'gawahelperdb'
  })

  console.log('--- DATABASE RESET STARTED (LOCAL) ---')
  try {
    const client = await pool.connect()
    console.log('Connected to Local Postgres')
    
    await client.query('DELETE FROM Disputes')
    await client.query('DELETE FROM Reports')
    await client.query('DELETE FROM Notifications')
    await client.query('DELETE FROM Reviews')
    await client.query('DELETE FROM Messages')
    await client.query('DELETE FROM Payments')
    await client.query('DELETE FROM TaskAssignments')
    await client.query('DELETE FROM Tasks')
    await client.query('DELETE FROM PasswordResetCodes')
    await client.query('DELETE FROM WebAuthnCredentials')
    await client.query('DELETE FROM AuditLogs')
    await client.query("DELETE FROM Users WHERE Email != 'admin@gawahelper.com'")
    await client.query("UPDATE Users SET WalletBalance = 0, Rating = NULL, CancellationCount = 0 WHERE Email = 'admin@gawahelper.com'")

    console.log('--- DATABASE RESET COMPLETED ---')
    client.release()
    await pool.end()
    process.exit(0)
  } catch (err) {
    console.error('--- DATABASE RESET FAILED ---')
    console.error(err.message)
    await pool.end()
    process.exit(1)
  }
}

resetDatabase()
