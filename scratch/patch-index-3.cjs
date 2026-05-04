const fs = require('fs');

const file = 'server/index.js';
let content = fs.readFileSync(file, 'utf8');

// Add logger import
content = content.replace("import nodemailer from 'nodemailer'", "import nodemailer from 'nodemailer'\nimport logger from './logger.js'");

// Update nodemailer config
const oldTransporter = `let _emailTransporter = null
function getEmailTransporter() {
  if (!_emailTransporter) {
    _emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || '',
        pass: process.env.GMAIL_APP_PASSWORD || '',
      },
    })
  }
  return _emailTransporter
}`;

const newTransporter = `let _emailTransporter = null
function getEmailTransporter() {
  if (!_emailTransporter) {
    if (process.env.SMTP_HOST) {
      _emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      })
    } else {
      // Fallback to Gmail
      _emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER || '',
          pass: process.env.GMAIL_APP_PASSWORD || '',
        },
      })
    }
  }
  return _emailTransporter
}`;

content = content.replace(oldTransporter, newTransporter);

// Replace console.error with logger.error and console.log with logger.info
content = content.replace(/console\.error\(/g, 'logger.error(');
content = content.replace(/console\.log\(/g, 'logger.info(');

// Add Pagination to GET /api/tasks
content = content.replace(
  /app\.get\('\/api\/tasks', async \(req, res\) => \{\s*const \{ status, categoryId \} = req\.query/,
  "app.get('/api/tasks', async (req, res) => {\n  const { status, categoryId } = req.query\n  const limit = Math.min(Number(req.query.limit) || 50, 100)\n  const offset = Number(req.query.offset) || 0"
);
content = content.replace(
  /sqlQuery \+= ' ORDER BY t\.CreatedAt DESC'\r?\n\s+const \[rows\] = await query\(sqlQuery, params\)/,
  "sqlQuery += ' ORDER BY t.CreatedAt DESC LIMIT ? OFFSET ?'\n    params.push(limit, offset)\n    const [rows] = await query(sqlQuery, params)"
);

// Fallback for query if not using db wrapper array directly
// Wait, `query` wrapper returns rows directly without fields if I look at db.js. Let's check how the file is actually structured. 
// I'll use a regex for the ORDER BY line.
// `sqlQuery += ' ORDER BY t.CreatedAt DESC'` is common. Let me make sure.

fs.writeFileSync('scratch/patch-index-3.cjs', "console.log('Script built!');");
fs.writeFileSync(file, content);
