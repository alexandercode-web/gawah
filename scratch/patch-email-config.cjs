const fs = require('fs')

let c = fs.readFileSync('c:/React/gawahelper/server/index.js', 'utf8')

const regex = /_emailTransporter = nodemailer\.createTransport\(\{\r?\n\s*service: 'gmail',\r?\n\s*auth: \{\r?\n\s*user: process\.env\.GMAIL_USER \|\| '',\r?\n\s*pass: process\.env\.GMAIL_APP_PASSWORD \|\| '',\r?\n\s*},\r?\n\s*}\)/

const replacement = `_emailTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4,
      auth: {
        user: process.env.GMAIL_USER || '',
        pass: process.env.GMAIL_APP_PASSWORD || '',
      },
      tls: {
        rejectUnauthorized: false
      }
    })`

c = c.replace(regex, replacement)
fs.writeFileSync('c:/React/gawahelper/server/index.js', c)
