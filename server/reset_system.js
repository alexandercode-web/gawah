import { initDatabase, query } from './db.js'

async function reset() {
  console.log('--- SYSTEM RESET STARTED ---')
  try {
    await initDatabase()
    console.log('Database Initialized')
    
    await query('DELETE FROM Disputes')
    await query('DELETE FROM Reports')
    await query('DELETE FROM Notifications')
    await query('DELETE FROM Reviews')
    await query('DELETE FROM Messages')
    await query('DELETE FROM Payments')
    await query('DELETE FROM TaskAssignments')
    await query('DELETE FROM Tasks')
    await query('DELETE FROM PasswordResetCodes')
    await query('DELETE FROM WebAuthnCredentials')
    await query('DELETE FROM AuditLogs')
    await query("DELETE FROM Users WHERE Email != 'admin@gawahelper.com'")
    await query("UPDATE Users SET WalletBalance = 0, Rating = NULL, CancellationCount = 0 WHERE Email = 'admin@gawahelper.com'")

    console.log('--- SYSTEM RESET COMPLETED ---')
    process.exit(0)
  } catch (err) {
    console.error('--- SYSTEM RESET FAILED ---')
    console.error(err)
    process.exit(1)
  }
}

reset()
