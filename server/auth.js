import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-secret')) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in production environment.')
  process.exit(1)
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' })
}

export function requireAuth(req, res, next) {
  let token = null;

  if (req.cookies && req.cookies.gh_token) {
    token = req.cookies.gh_token
  } else {
    // Fallback for non-browser clients or transition period
    const header = req.headers.authorization
    if (header && header.startsWith('Bearer ')) {
      token = header.slice(7)
    } else if (req.query.token) {
      token = req.query.token
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const val = req.user?.isAdmin ?? req.user?.IsAdmin
    const isAdminFlag = Number(val) === 1 || val === true || String(val) === '1'
    
    if (isAdminFlag) {
      return next()
    }
    return res.status(403).json({ message: 'Forbidden: Admin access required' })
  })
}
