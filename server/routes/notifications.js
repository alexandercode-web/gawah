import express from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'
import logger from '../logger.js'

const router = express.Router()

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id

    const rows = await query(`
      SELECT 
        n.*,
        u.FullName AS SenderName,
        u.ProfileImage AS SenderAvatar
      FROM Notifications n
      LEFT JOIN Users u ON n.SenderID = u.UserID
      WHERE n.UserID = ?
      ORDER BY n.CreatedAt DESC
      LIMIT 100
    `, [userId])

    return res.json(rows)
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.patch('/:notificationId', requireAuth, async (req, res) => {
  try {
    const notificationId = Number(req.params.notificationId)
    await query('UPDATE Notifications SET IsRead = 1 WHERE NotificationID = ? AND UserID = ?', [notificationId, req.user.id])
    return res.json({ success: true })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

export default router
