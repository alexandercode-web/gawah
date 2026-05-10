import { query } from './db.js'

async function resetDatabase() {
  console.log('--- DATABASE RESET STARTED ---')
  try {
    // 1. Delete all tasks (this will cascade to payments, assignments, etc. if FKs are set to CASCADE)
    // If not set to cascade, we delete them manually.
    console.log('Cleaning up Task-related data...')
    await query('DELETE FROM Disputes')
    await query('DELETE FROM Reports')
    await query('DELETE FROM Notifications')
    await query('DELETE FROM Reviews')
    await query('DELETE FROM Messages')
    await query('DELETE FROM Payments')
    await query('DELETE FROM TaskAssignments')
    await query('DELETE FROM Tasks')
    
    console.log('Cleaning up User-related data...')
    await query('DELETE FROM PasswordResetCodes')
    await query('DELETE FROM WebAuthnCredentials')
    await query('DELETE FROM AuditLogs')
    
    // 2. Delete all users except the main admin
    console.log('Removing non-admin users...')
    await query("DELETE FROM Users WHERE Email != 'admin@gawahelper.com'")
    
    // 3. Reset Wallet balances for admin
    await query("UPDATE Users SET WalletBalance = 0, Rating = NULL, CancellationCount = 0 WHERE Email = 'admin@gawahelper.com'")

    console.log('--- DATABASE RESET COMPLETED SUCCESSFULLY ---')
    process.exit(0)
  } catch (err) {
    console.error('--- DATABASE RESET FAILED ---')
    console.error(err)
    process.exit(1)
  }
}

resetDatabase()
