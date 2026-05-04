const fs = require('fs')

let c = fs.readFileSync('c:/React/gawahelper/server/index.js', 'utf8')

const regex = /<div style="background:#fafafa;border-top:1px solid #eee;padding:16px 24px;text-align:center;">\r?\n\s*logger\.error\('API Error:', error\.message\);\r?\n\s*return res\.status\(500\)\.json\({ message: 'An internal server error occurred\.' }\)\r?\n\s*}\r?\n}\)/

const replacement = `<div style="background:#fafafa;border-top:1px solid #eee;padding:16px 24px;text-align:center;">
              <p style="margin:0;color:#aaa;font-size:11px;">© \${new Date().getFullYear()} GawaHelper • Task Marketplace</p>
            </div>
          </div>
        \`,
      })
    } catch (emailError) {
      console.error('Email sending failed FULL TRACE:', emailError)
      return res.status(500).json({ message: 'Failed to send reset code email. Please check your email configuration.' })
    }

    return res.json({ message: 'Reset code sent to your email' })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})`

c = c.replace(regex, replacement)
fs.writeFileSync('c:/React/gawahelper/server/index.js', c)
