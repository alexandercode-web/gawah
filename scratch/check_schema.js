
import { query } from '../server/db.js';

async function test() {
  try {
    const tables = ['Users', 'Tasks', 'Categories', 'TaskAssignments', 'Payments', 'Messages', 'Reviews', 'Notifications'];
    for (const table of tables) {
      const res = await query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = LOWER(?)`, [table]);
      console.log(`Table ${table}:`, res);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit();
}

test();
