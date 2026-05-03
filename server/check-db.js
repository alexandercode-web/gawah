import { query } from './db.js';

async function checkAdmins() {
  try {
    const admins = await query('SELECT * FROM Admins');
    console.log('Admins:', JSON.stringify(admins, null, 2));
    
    const users = await query('SELECT UserID, FullName, Email, IsAdmin FROM Users WHERE IsAdmin = 1 OR FullName LIKE "%admin%"');
    console.log('Users (Admin-like):', JSON.stringify(users, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkAdmins();
