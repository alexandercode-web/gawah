import express from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { requireAuth, requireAdmin, signToken } from '../auth.js'
import { notifyUser } from '../sse.js'
import { supabase } from '../supabase.js'
import logger from '../logger.js'

import path from 'node:path'
import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Add other necessary imports specific to the module below

const router = express.Router()

router.get('/:otherUserId/:taskId', requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId) || 0
    const otherUserId = Number(req.params.otherUserId) || 0
    const userId = req.user.id

    const rows = await query(`
      SELECT 
        m.*,
        u.FullName AS SenderName,
        u.ProfileImage AS SenderAvatar
      FROM Messages m
      JOIN Users u ON m.SenderID = u.UserID
      WHERE m.TaskID = ? AND (
        (m.SenderID = ? AND m.RecipientID = ?) OR 
        (m.SenderID = ? AND m.RecipientID = ?)
      )
      ORDER BY m.CreatedAt ASC
    `, [taskId, userId, otherUserId, otherUserId, userId])

    return res.json(rows)
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/', requireAuth, async (req, res) => {
  try {
    const { taskId, recipientId, content, attachmentType, attachmentData, attachmentName, attachmentMime } = req.body
    const senderId = req.user.id

    if (!taskId || !recipientId || (!content && !attachmentData)) {
      return res.status(400).json({ message: 'Missing required message fields' })
    }

    let savedAttachmentUrl = null
    if (attachmentData && (attachmentType === 'image' || attachmentType === 'file')) {
      const isBase64 = attachmentData.startsWith('data:')
      if (isBase64) {
        const matches = attachmentData.match(/^data:([^;]+);base64,(.+)$/i)
        if (matches) {
          const mime = matches[1]
          const base64Payload = matches[2]
          let ext = 'bin'
          
          if (mime.includes('image/')) {
            const subType = mime.split('/')[1].toLowerCase()
            ext = subType === 'jpeg' ? 'jpg' : subType
          } else if (mime === 'application/pdf') {
            ext = 'pdf'
          } else if (attachmentName && attachmentName.includes('.')) {
            ext = attachmentName.split('.').pop().toLowerCase()
          }

          const sizeInBytes = Math.ceil((base64Payload.length * 3) / 4)
          // Limit to 10MB
          if (sizeInBytes <= 10 * 1024 * 1024) {
            const safeName = `msg-${taskId}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`
            const filePath = `chat/${safeName}`
            
            const { error: uploadError } = await supabase.storage
              .from('uploads')
              .upload(filePath, Buffer.from(base64Payload, 'base64'), {
                contentType: mime,
                upsert: true
              })

            if (uploadError) {
              logger.error('Supabase upload error:', uploadError.message)
            } else {
              const { data: { publicUrl } } = supabase.storage
                .from('uploads')
                .getPublicUrl(filePath)
              
              savedAttachmentUrl = publicUrl
            }
          }
        }
      }
    }

    const result = await query(`
      INSERT INTO Messages 
        (TaskID, SenderID, RecipientID, Content, AttachmentType, AttachmentData, AttachmentName, AttachmentMime, IsRead)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      RETURNING MessageID
    `, [
      Number(taskId),
      senderId,
      Number(recipientId),
      content || '',
      attachmentType || null,
      savedAttachmentUrl || attachmentData || null,
      attachmentName || null,
      attachmentMime || null
    ])

    await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, 0, NOW())',
      [Number(recipientId), senderId, Number(taskId), 'You received a new message.']
    )

    const messageId = result[0]?.MessageID || result[0]?.messageid || 0
    return res.json({ success: true, messageId, attachmentUrl: savedAttachmentUrl })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.patch('/:messageId', requireAuth, async (req, res) => {
  try {
    const messageId = Number(req.params.messageId)
    await query('UPDATE Messages SET IsRead = 1 WHERE MessageID = ? AND RecipientID = ?', [messageId, req.user.id])
    return res.json({ success: true })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.patch('/mark-as-read/:taskId', requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId)
    await query('UPDATE Messages SET IsRead = 1 WHERE TaskID = ? AND RecipientID = ?', [taskId, req.user.id])
    return res.json({ success: true })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/notifications', requireAuth, async (req, res) => {
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

router.patch('/notifications/:notificationId', requireAuth, async (req, res) => {
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
