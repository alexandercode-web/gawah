import 'dotenv/config';
import { query } from './db.js';

async function test() {
  try {
    const result = await query('UPDATE Tasks SET Status = ? WHERE TaskID = ? AND PosterID = ? AND Status = ?', ['ProofApproved', 7, 1, 'ProofSubmitted']);
    console.log("Success:", result);
  } catch (err) {
    console.error("Test Error:", err);
  }
  process.exit(0);
}

test();
