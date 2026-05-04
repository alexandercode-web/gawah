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
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = header.slice(7)

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
    const isDedicatedAdmin = req.user?.role === 'admin'
    
    if (isAdminFlag || isDedicatedAdmin) {
      return next()
    }
    return res.status(403).json({ message: 'Forbidden: Admin access required' })
  })
}
