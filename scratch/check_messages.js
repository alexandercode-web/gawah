import { query } from '../server/db.js';
const rows = await query('SELECT AttachmentData, AttachmentName, AttachmentType FROM Messages WHERE AttachmentData IS NOT NULL LIMIT 5');
console.log(JSON.stringify(rows, null, 2));
process.exit(0);
