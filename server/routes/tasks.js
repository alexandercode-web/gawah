import express from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { requireAuth, requireAdmin, signToken } from '../auth.js'
import { notifyUser } from '../sse.js'
import { supabase } from '../supabase.js'
import logger from '../logger.js'

import { uploadLimiter } from '../config.js'
import { getDbPool } from '../db.js'
import { Buffer } from 'node:buffer'

// Add other necessary imports specific to the module below

const router = express.Router()

router.get('/public/stats', async (_, res) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM Users) AS TotalUsers,
        (SELECT COUNT(*) FROM Tasks WHERE Status = 'Completed') AS CompletedTasks,
        (SELECT COALESCE(SUM(Budget), 0) FROM Tasks WHERE Status = 'Completed') AS TotalValue
    `)

    return res.json(result[0])
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/categories', async (_, res) => {
  try {
    const result = await query('SELECT CategoryID, CategoryName FROM Categories ORDER BY CategoryName')
    return res.json(result)
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/', requireAuth, async (req, res) => {
  const { categoryName } = req.body

  if (!categoryName) {
    return res.status(400).json({ message: 'categoryName is required' })
  }

  try {
    const result = await query('INSERT INTO Categories (CategoryName) VALUES (?) RETURNING CategoryID', [
      categoryName,
    ])

    return res.status(201).json({
      CategoryID: result[0].CategoryID,
      CategoryName: categoryName,
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Category already exists' })
    }
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.patch('/:categoryId', requireAuth, async (req, res) => {
  const categoryId = Number(req.params.categoryId)
  const categoryName = String(req.body.categoryName || '').trim()

  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return res.status(400).json({ message: 'Invalid category id' })
  }

  if (!categoryName) {
    return res.status(400).json({ message: 'categoryName is required' })
  }

  try {
    const exists = await query('SELECT CategoryID FROM Categories WHERE CategoryID = ? LIMIT 1', [categoryId])

    if (exists.length === 0) {
      return res.status(404).json({ message: 'Category not found' })
    }

    await query('UPDATE Categories SET CategoryName = ? WHERE CategoryID = ?', [categoryName, categoryId])

    const updated = await query('SELECT CategoryID, CategoryName FROM Categories WHERE CategoryID = ?', [categoryId])
    return res.json(updated[0])
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Category already exists' })
    }
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.delete('/:categoryId', requireAuth, async (req, res) => {
  const categoryId = Number(req.params.categoryId)

  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return res.status(400).json({ message: 'Invalid category id' })
  }

  try {
    const exists = await query('SELECT CategoryID FROM Categories WHERE CategoryID = ? LIMIT 1', [categoryId])

    if (exists.length === 0) {
      return res.status(404).json({ message: 'Category not found' })
    }

    const inUse = await query('SELECT COUNT(*) AS Total FROM Tasks WHERE CategoryID = ?', [categoryId])
    const total = Number(inUse[0]?.Total || 0)

    if (total > 0) {
      return res.status(409).json({ message: 'Cannot delete category with existing tasks' })
    }

    await query('DELETE FROM Categories WHERE CategoryID = ?', [categoryId])
    return res.json({ message: 'Category deleted', categoryId })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/', async (req, res) => {
  const { status, categoryId, search, location, sort } = req.query
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const offset = Number(req.query.offset) || 0

  try {
    const params = []

    let sqlQuery = `
      SELECT
        t.TaskID,
        t.Title,
        t.Description,
        t.Location,
        t.TaskTime,
        t.Budget,
        t.Status,
        t.CreatedAt,
        u.FullName AS PosterName,
        u.ProfileImage AS PosterProfileImage,
        u.Rating AS PosterRating,
        (SELECT COUNT(*) FROM Reviews WHERE ReviewedUserID = u.UserID) AS PosterReviewCount,
        c.CategoryName
      FROM Tasks t
      INNER JOIN Users u ON t.UserID = u.UserID
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      WHERE 1 = 1
    `

    if (status) {
      sqlQuery += ' AND t.Status = ?'
      params.push(status)
    }

    if (categoryId) {
      sqlQuery += ' AND t.CategoryID = ?'
      params.push(Number(categoryId))
    }

    if (search) {
      sqlQuery += ' AND (LOWER(t.Title) LIKE ? OR LOWER(t.Description) LIKE ?)'
      const searchTerm = `%${String(search).toLowerCase().trim()}%`
      params.push(searchTerm, searchTerm)
    }

    if (location) {
      sqlQuery += ' AND LOWER(t.Location) LIKE ?'
      params.push(`%${String(location).toLowerCase().trim()}%`)
    }

    // Sort options
    if (sort === 'budget') {
      sqlQuery += ' ORDER BY t.Budget DESC, t.CreatedAt DESC'
    } else if (sort === 'taskTime') {
      sqlQuery += ' ORDER BY t.TaskTime ASC, t.CreatedAt DESC'
    } else {
      sqlQuery += ' ORDER BY t.CreatedAt DESC'
    }

    sqlQuery += ' LIMIT ? OFFSET ?'
    params.push(limit, offset)
    const result = await query(sqlQuery, params)
    return res.json(result)
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/my/tasks', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT
        t.TaskID, t.Title, t.Description, t.Location, t.TaskTime, t.Budget, t.Status, t.CreatedAt,
        u.FullName AS PosterName, u.ProfileImage AS PosterProfileImage,
        c.CategoryName
      FROM Tasks t
      INNER JOIN Users u ON t.UserID = u.UserID
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID
      WHERE t.UserID = ? OR ta.HelperID = ?
      ORDER BY t.CreatedAt DESC
    `, [req.user.id, req.user.id])
    return res.json(result)
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/counts-by-category', async (_req, res) => {
  try {
    const result = await query(`
      SELECT c.CategoryID, c.CategoryName, COUNT(t.TaskID) AS TaskCount
      FROM Categories c
      LEFT JOIN Tasks t ON t.CategoryID = c.CategoryID AND t.Status = 'Open'
      GROUP BY c.CategoryID, c.CategoryName
      ORDER BY c.CategoryName
    `)
    return res.json(result)
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/:taskId', async (req, res) => {
  const taskId = Number(req.params.taskId)

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  try {
    const result = await query(
      `
        SELECT
          t.TaskID,
          t.UserID,
          t.Title,
          t.Description,
          t.Location,
          t.TaskTime,
          t.Budget,
          t.Status,
          t.CreatedAt,
          u.FullName AS PosterName,
          u.ProfileImage AS PosterProfileImage,
          u.Rating AS PosterRating,
          (SELECT COUNT(*) FROM Reviews WHERE ReviewedUserID = u.UserID) AS PosterReviewCount,
          c.CategoryName,
          ta.HelperID,
          ta.AcceptedAt AS HelperAcceptedAt,
          ta.ProofImage,
          hu.FullName AS HelperName,
          hu.ProfileImage AS HelperProfileImage,
          hu.Rating AS HelperRating,
          (SELECT COUNT(*) FROM Reviews WHERE ReviewedUserID = hu.UserID) AS HelperReviewCount,
          hu.CancellationCount AS HelperCancellationCount,
          rv.ReviewID AS PosterReviewID,
          rv.Rating AS PosterReviewRating,
          rv.Comment AS PosterReviewComment,
          p.PaymentMethod,
          p.PosterPaymentConfirmed
        FROM Tasks t
        INNER JOIN Users u ON t.UserID = u.UserID
        LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
        LEFT JOIN (
          SELECT ta1.TaskID, ta1.HelperID, ta1.AcceptedAt, ta1.ProofImage
          FROM TaskAssignments ta1
          INNER JOIN (
            SELECT TaskID, MAX(AcceptedAt) AS LatestAcceptedAt
            FROM TaskAssignments
            GROUP BY TaskID
          ) latest
            ON latest.TaskID = ta1.TaskID
           AND latest.LatestAcceptedAt = ta1.AcceptedAt
        ) ta ON ta.TaskID = t.TaskID
        LEFT JOIN Users hu ON hu.UserID = ta.HelperID
        LEFT JOIN Reviews rv
          ON rv.TaskID = t.TaskID
         AND rv.ReviewerID = t.UserID
         AND rv.ReviewedUserID = ta.HelperID
        LEFT JOIN Payments p ON p.TaskID = t.TaskID
        WHERE t.TaskID = ?
        LIMIT 1
      `,
      [taskId]
    )

    if (result.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    return res.json(result[0])
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/', requireAuth, async (req, res) => {
  const { title, description, location, taskTime, budget, categoryId, paymentMethod } = req.body
  const parsedBudget = Math.round(Number(budget))

  if (!title || !description || !location || !taskTime || budget === undefined || !categoryId) {
    return res.status(400).json({ message: 'Missing required task fields' })
  }

  if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
    return res.status(400).json({ message: 'Budget must be greater than 0' })
  }

  const method = paymentMethod && ['Cash', 'GCash'].includes(paymentMethod) ? paymentMethod : 'Cash'

  try {
    const insert = await query(
      `INSERT INTO Tasks (UserID, Title, Description, Location, TaskTime, Budget, CategoryID)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING TaskID`,
      [
        req.user.id,
        title,
        description,
        location,
        new Date(taskTime),
        parsedBudget,
        Number(categoryId),
      ]
    )

    // Create a Payment record with the selected payment method
    await query(
      `INSERT INTO Payments (TaskID, Amount, PaymentMethod, Status, PayerUserID)
       VALUES (?, ?, ?, 'Pending', ?)`,
      [insert[0].TaskID, parsedBudget, method, req.user.id]
    )

    const created = await query('SELECT * FROM Tasks WHERE TaskID = ?', [insert[0].TaskID])
    return res.status(201).json(created[0])
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.patch('/:taskId', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const { title, description, location, taskTime, budget, categoryId } = req.body || {}
  const parsedBudget = Math.round(Number(budget))

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  if (!title || !description || !location || !taskTime || budget === undefined || !categoryId) {
    return res.status(400).json({ message: 'Missing required task fields' })
  }

  if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
    return res.status(400).json({ message: 'Budget must be greater than 0' })
  }

  try {
    const taskRows = await query(
      'SELECT TaskID, UserID, Status FROM Tasks WHERE TaskID = ? LIMIT 1',
      [taskId]
    )

    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = taskRows[0]

    if (Number(task.UserID) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the task poster can update this task' })
    }

    const currentStatus = String(task.Status || '').toLowerCase()
    if (currentStatus !== 'open') {
      return res.status(400).json({ message: 'Only open tasks can be edited' })
    }

    await query(
      `
        UPDATE Tasks
        SET Title = ?, Description = ?, Location = ?, TaskTime = ?, Budget = ?, CategoryID = ?
        WHERE TaskID = ?
      `,
      [
        String(title).trim(),
        String(description).trim(),
        String(location).trim(),
        new Date(taskTime),
        parsedBudget,
        Number(categoryId),
        taskId,
      ]
    )

    const updated = await query('SELECT * FROM Tasks WHERE TaskID = ?', [taskId])
    return res.json(updated[0])
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.delete('/:taskId', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  try {
    const taskRows = await query(
      'SELECT TaskID, UserID, Status FROM Tasks WHERE TaskID = ? LIMIT 1',
      [taskId]
    )

    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = taskRows[0]

    if (Number(task.UserID) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the task poster can delete this task' })
    }

    const currentStatus = String(task.Status || '').toLowerCase()
    if (currentStatus.includes('complete')) {
      return res.status(400).json({ message: 'Completed tasks cannot be deleted' })
    }

    await query('DELETE FROM Notifications WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Messages WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Reviews WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Payments WHERE TaskID = ?', [taskId])
    await query('DELETE FROM TaskAssignments WHERE TaskID = ?', [taskId])
    await query('DELETE FROM Tasks WHERE TaskID = ?', [taskId])

    return res.json({ message: 'Task deleted', taskId })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/:taskId/apply', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const userId = Number(req.user.id)

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  const pool = await getDbPool()
  const conn = await pool.getConnection()

  try {
    const userCheck = await query('SELECT UserID, CancellationCount FROM Users WHERE UserID = ?', [userId])
    if (userCheck.length === 0) {
      return res.status(401).json({ message: 'Your session is from an old database. Please Log Out and Log In again.' })
    }

    // Cancellation cooldown: if 3+ cancellations, check recent activity
    if (Number(userCheck[0].CancellationCount) >= 3) {
      // Check cancellations in the last 7 days by counting recent re-opened tasks
      // A simpler heuristic: if total cancellation count is >= 3, warn; if >= 5 in short time, block
      const recentCancels = await query(`
        SELECT COUNT(*) AS RecentCount FROM Notifications 
        WHERE UserID != ? AND SenderID = ? AND Message LIKE '%cancelled their acceptance%' 
        AND CreatedAt > NOW() - INTERVAL '7 days'
      `, [userId, userId])
      if (Number(recentCancels[0]?.RecentCount || 0) >= 3) {
        return res.status(429).json({ 
          message: 'You have cancelled too many tasks recently. Please wait before accepting new tasks.' 
        })
      }
    }
    await conn.beginTransaction()

    const [taskResult] = await conn.query(
      'SELECT Status, UserID, Title FROM Tasks WHERE TaskID = ? FOR UPDATE',
      [taskId]
    )

    if (taskResult.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Task not found' })
    }

    if (Number(taskResult[0].UserID) === userId) {
      await conn.rollback()
      return res.status(400).json({ message: 'You cannot apply to your own task' })
    }

    if (String(taskResult[0].Status || '') !== 'Open') {
      await conn.rollback()
      return res.status(400).json({ message: 'Task is not open' })
    }

    const [existingAssignments] = await conn.query(
      'SELECT AssignmentID, HelperID FROM TaskAssignments WHERE TaskID = ? LIMIT 1 FOR UPDATE',
      [taskId]
    )

    if (existingAssignments.length > 0) {
      await conn.rollback()
      const claimedBySameUser = Number(existingAssignments[0].HelperID) === userId
      return res.status(409).json({
        message: claimedBySameUser
          ? 'You already applied to this task'
          : 'Task is already assigned to another helper',
      })
    }

    const [inserted] = await conn.query(
      'INSERT INTO TaskAssignments (TaskID, HelperID) VALUES (?, ?)',
      [taskId, userId]
    )

    await conn.query('UPDATE Tasks SET Status = $1 WHERE TaskID = $2', ['Assigned', taskId])

    // Get helper name for notification
    const [helperUserRows] = await conn.query('SELECT FullName FROM Users WHERE UserID = $1', [userId])
    const helperName = helperUserRows[0]?.FullName || 'A helper'
    const taskTitle = taskResult[0].Title || 'your task'
    const posterUserId = taskResult[0].UserID

    // Create notification for task poster with SenderID and TaskID
    await conn.query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES ($1, $2, $3, $4, $5, NOW())',
      [posterUserId, userId, taskId, `${helperName} accepted your task "${taskTitle}"`, 0]
    )

    await conn.commit()

    const assignment = await query('SELECT * FROM TaskAssignments WHERE AssignmentID = ?', [
      inserted.insertId,
    ])

    return res.status(201).json(assignment[0])
  } catch (error) {
    try {
      await conn.rollback()
    } catch {
      // Best effort rollback.
    }

    if (error?.code === '23505') {
      return res.status(409).json({ message: 'Task is already assigned to another helper' })
    }

    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  } finally {
    conn.release()
  }
})

router.post('/:taskId/cancel', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const reason = (req.body.reason || '').trim()

  if (!reason) {
    return res.status(400).json({ message: 'Cancellation reason is required' })
  }

  const pool = await getDbPool()
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()
    const [taskResult] = await conn.execute('SELECT TaskID, UserID, Status FROM Tasks WHERE TaskID = ? FOR UPDATE', [taskId])

    if (taskResult.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = taskResult[0]
    const status = String(task.Status || '').toLowerCase()

    if (status === 'completed' || status === 'cancelled') {
      await conn.rollback()
      return res.status(400).json({ message: 'Task can no longer be cancelled' })
    }

    if (Number(task.UserID) === Number(req.user.id)) {
      await conn.execute('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['Cancelled', taskId])

      // Get the task details for notification
      const [taskDetails] = await conn.execute('SELECT Title FROM Tasks WHERE TaskID = ?', [taskId])
      const taskTitle = taskDetails[0]?.Title || 'Unknown Task'

      // Notify any helpers if the task was assigned
      const [assignments] = await conn.execute('SELECT HelperID FROM TaskAssignments WHERE TaskID = ?', [taskId])
      for (const assignment of assignments) {
        const notificationMessage = `Task "${taskTitle}" has been cancelled by the poster.`
        await conn.execute(
          'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
          [assignment.HelperID, req.user.id, taskId, notificationMessage.slice(0, 255), 0]
        )
      }

      await conn.commit()
      return res.json({ message: 'Task cancelled by poster', taskId, reason })
    }

    const [assignment] = await conn.execute(
      'SELECT AssignmentID, AcceptedAt FROM TaskAssignments WHERE TaskID = ? AND HelperID = ? LIMIT 1 FOR UPDATE',
      [taskId, req.user.id]
    )

    if (assignment.length === 0) {
      await conn.rollback()
      return res.status(403).json({ message: 'You can only cancel tasks you accepted' })
    }

    // Helper cancelling their acceptance — track cancellation count
    await conn.execute('DELETE FROM TaskAssignments WHERE TaskID = ? AND HelperID = ?', [taskId, req.user.id])
    await conn.execute('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['Open', taskId])
    await conn.execute('UPDATE Users SET CancellationCount = CancellationCount + 1 WHERE UserID = ?', [req.user.id])

    // Get the helper name and task title
    const [helperUser] = await conn.execute('SELECT FullName FROM Users WHERE UserID = ?', [req.user.id])
    const [taskDetails2] = await conn.execute('SELECT Title FROM Tasks WHERE TaskID = ?', [taskId])
    const helperName = helperUser[0]?.FullName || 'A helper'
    const taskTitle2 = taskDetails2[0]?.Title || 'Unknown Task'

    // Notify the task poster
    const notificationMessage = `${helperName} cancelled their acceptance of task "${taskTitle2}".`
    await conn.execute(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [task.UserID, req.user.id, taskId, notificationMessage.slice(0, 255), 0]
    )

    await conn.commit()
    return res.json({ message: 'Task acceptance cancelled', taskId, reason })
  } catch (error) {
    if (conn) await conn.rollback()
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/:taskId/proof', requireAuth, uploadLimiter, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const fileName = (req.body.fileName || '').trim()
  const proofDataUrl = (req.body.proofDataUrl || '').trim()
  let proofValue = ''

  if (!proofDataUrl) {
    return res.status(400).json({ message: 'Proof image upload is required' })
  }

  const pool = await getDbPool()
  const conn = await pool.getConnection()

  try {
    const matches = proofDataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/i)

    if (!matches) {
      return res.status(400).json({ message: 'Invalid proof image format' })
    }

    const extension = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : 'png'
    const base64Payload = matches[2]
    
    // Validate image size strictly (5MB = 5 * 1024 * 1024 bytes)
    const sizeInBytes = Math.ceil((base64Payload.length * 3) / 4)
    if (sizeInBytes > 5 * 1024 * 1024) {
      return res.status(413).json({ message: 'Proof image must be 5MB or less' })
    }
    const safeFileName = `proof-${taskId}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(`proofs/${safeFileName}`, Buffer.from(base64Payload, 'base64'), {
        contentType: `image/${extension}`,
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`)
    }

    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(`proofs/${safeFileName}`)

    proofValue = publicUrl

    await conn.beginTransaction()

    const [assignment] = await conn.execute(
      `
        SELECT AssignmentID
        FROM TaskAssignments
        WHERE TaskID = ? AND HelperID = ?
        LIMIT 1 FOR UPDATE
      `,
      [taskId, req.user.id]
    )

    if (assignment.length === 0) {
      await conn.rollback()
      return res.status(403).json({ message: 'Only the assigned helper can submit proof' })
    }

    const [taskRows] = await conn.execute(
      'SELECT UserID, Title, Budget FROM Tasks WHERE TaskID = ? LIMIT 1 FOR UPDATE',
      [taskId]
    )

    if (taskRows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Task not found' })
    }

    const taskMeta = taskRows[0]

    await conn.execute(
      'UPDATE TaskAssignments SET ProofImage = ? WHERE AssignmentID = ?',
      [proofValue, assignment[0].AssignmentID]
    )

    await conn.execute('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['WaitingForReview', taskId])

    const [userRows] = await conn.execute('SELECT FullName FROM Users WHERE UserID = ?', [req.user.id])
    const helperName = userRows[0]?.FullName || 'Your helper'

    await conn.execute(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [taskMeta.UserID, req.user.id, taskId, `${helperName} submitted proof for "${taskMeta.Title || 'your task'}". Please review it.`, 0]
    )

    await conn.commit()
    return res.json({ message: 'Proof submitted successfully', proofImage: proofValue })
  } catch (error) {
    if (conn) await conn.rollback()
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.patch('/:taskId/approve-proof', requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId)
    // Only poster can approve
    const taskRows = await query('SELECT UserID, Status FROM Tasks WHERE TaskID = ?', [taskId])
    if (taskRows.length === 0) return res.status(404).json({ message: 'Task not found.' })
    if (taskRows[0].UserID !== req.user.id) return res.status(403).json({ message: 'Only the poster can approve the proof.' })
    if (taskRows[0].Status !== 'WaitingForReview' && taskRows[0].Status !== 'ProofSubmitted') {
      return res.status(400).json({ message: 'Task is not in a state to approve proof.' })
    }

    await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['ProofApproved', taskId])
    
    const assignmentRows = await query('SELECT HelperID FROM TaskAssignments WHERE TaskID = ?', [taskId])
    if (assignmentRows.length > 0) {
      await query(
        'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES ($1, $2, $3, $4, 0, NOW())',
        [assignmentRows[0].HelperID, req.user.id, taskId, 'Your proof was approved! Payment is pending.']
      )
    }

    return res.json({ success: true, message: 'Proof approved successfully.' })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/:taskId/confirm-payment-sent', requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId)
    const taskRows = await query('SELECT UserID, Status FROM Tasks WHERE TaskID = ?', [taskId])
    if (taskRows.length === 0) return res.status(404).json({ message: 'Task not found.' })
    if (Number(taskRows[0].UserID) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the task poster can confirm payment.' })
    }
    if (taskRows[0].Status !== 'ProofApproved') {
      return res.status(400).json({ message: 'Proof must be approved before confirming payment.' })
    }

    await query('UPDATE Payments SET PosterPaymentConfirmed = 1 WHERE TaskID = ?', [taskId])

    const assignmentRows = await query('SELECT HelperID FROM TaskAssignments WHERE TaskID = ?', [taskId])
    if (assignmentRows.length > 0) {
      const paymentRow = await query('SELECT PaymentMethod, Amount FROM Payments WHERE TaskID = ? LIMIT 1', [taskId])
      const method = paymentRow[0]?.PaymentMethod || 'Cash'
      const amount = paymentRow[0]?.Amount || 0
      await query(
        'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES ($1, $2, $3, $4, 0, NOW())',
        [assignmentRows[0].HelperID, req.user.id, taskId, `Poster confirmed payment of ₱${Number(amount).toFixed(0)} via ${method}. Please confirm you received it.`]
      )
    }

    return res.json({ success: true, message: 'Payment confirmation sent to helper.' })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/:taskId/payment-received', requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId)
    const taskRows = await query('SELECT UserID, Status FROM Tasks WHERE TaskID = ?', [taskId])
    if (taskRows.length === 0) return res.status(404).json({ message: 'Task not found.' })
    if (taskRows[0].Status !== 'ProofApproved') {
      return res.status(400).json({ message: 'Task proof not yet approved by poster.' })
    }

    const paymentRows = await query('SELECT PosterPaymentConfirmed FROM Payments WHERE TaskID = ?', [taskId])
    if (paymentRows.length > 0 && Number(paymentRows[0].PosterPaymentConfirmed) !== 1) {
      return res.status(400).json({ message: 'The poster has not confirmed sending the payment yet.' })
    }

    // Check if req.user.id is the assigned helper
    const assignmentRows = await query('SELECT HelperID FROM TaskAssignments WHERE TaskID = ?', [taskId])
    if (assignmentRows.length === 0 || assignmentRows[0].HelperID !== req.user.id) {
      return res.status(403).json({ message: 'Only the assigned helper can confirm payment.' })
    }

    await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['Completed', taskId])
    await query('UPDATE Payments SET Status = ?, CompletedAt = NOW() WHERE TaskID = ?', ['Completed', taskId])
    
    await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES ($1, $2, $3, $4, 0, NOW())',
      [taskRows[0].UserID, req.user.id, taskId, 'Payment confirmed! The task is now completed.']
    )

    return res.json({ success: true, message: 'Payment confirmed.', status: 'Completed' })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/:taskId/reject-proof', requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId)
    const reason = (req.body.reason || '').trim()

    const taskRows = await query('SELECT UserID, Status, Title FROM Tasks WHERE TaskID = ?', [taskId])
    if (taskRows.length === 0) return res.status(404).json({ message: 'Task not found.' })
    if (Number(taskRows[0].UserID) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the task poster can reject proof.' })
    }
    if (taskRows[0].Status !== 'WaitingForReview') {
      return res.status(400).json({ message: 'Task is not in a state to reject proof.' })
    }

    // Clear proof and revert status
    await query('UPDATE TaskAssignments SET ProofImage = NULL WHERE TaskID = ?', [taskId])
    await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['Assigned', taskId])

    const assignmentRows = await query('SELECT HelperID FROM TaskAssignments WHERE TaskID = ?', [taskId])
    if (assignmentRows.length > 0) {
      const rejectMsg = reason
        ? `Proof for "${taskRows[0].Title}" was not approved. Reason: ${reason}. Please resubmit.`
        : `Proof for "${taskRows[0].Title}" was not approved. Please resubmit.`
      await query(
        'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES ($1, $2, $3, $4, 0, NOW())',
        [assignmentRows[0].HelperID, req.user.id, taskId, rejectMsg.slice(0, 255)]
      )

      // Also send as a message so it's in the chat history
      await query(
        'INSERT INTO Messages (TaskID, SenderID, RecipientID, Content, IsRead, CreatedAt) VALUES ($1, $2, $3, $4, 0, NOW())',
        [taskId, req.user.id, assignmentRows[0].HelperID, `⚠️ Proof rejected${reason ? ': ' + reason : ''}. Please resubmit your proof.`]
      )
    }

    return res.json({ success: true, message: 'Proof rejected. Helper has been notified.' })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/:taskId/dispute', requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId)
    const reason = (req.body.reason || '').trim()

    if (!reason) {
      return res.status(400).json({ message: 'Dispute reason is required.' })
    }

    const taskRows = await query('SELECT UserID, Status, Title FROM Tasks WHERE TaskID = ?', [taskId])
    if (taskRows.length === 0) return res.status(404).json({ message: 'Task not found.' })

    const assignmentRows = await query('SELECT HelperID FROM TaskAssignments WHERE TaskID = ?', [taskId])
    const isPoster = Number(taskRows[0].UserID) === Number(req.user.id)
    const isHelper = assignmentRows.length > 0 && Number(assignmentRows[0].HelperID) === Number(req.user.id)

    if (!isPoster && !isHelper) {
      return res.status(403).json({ message: 'Only the poster or helper can raise a dispute.' })
    }

    // Check for existing open dispute
    const existing = await query('SELECT DisputeID FROM Disputes WHERE TaskID = ? AND Status = ? LIMIT 1', [taskId, 'Open'])
    if (existing.length > 0) {
      return res.status(409).json({ message: 'A dispute is already open for this task.' })
    }

    await query(
      'INSERT INTO Disputes (TaskID, RaisedByUserID, Reason) VALUES (?, ?, ?)',
      [taskId, req.user.id, reason]
    )

    // Notify the other party
    const otherUserId = isPoster ? assignmentRows[0]?.HelperID : taskRows[0].UserID
    if (otherUserId) {
      await query(
        'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES ($1, $2, $3, $4, 0, NOW())',
        [otherUserId, req.user.id, taskId, `A dispute has been raised for task "${taskRows[0].Title}".`]
      )
    }

    return res.json({ success: true, message: 'Dispute raised. An admin will review this.' })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/:taskId/review', requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId)
    const { rating, comment } = req.body
    
    const taskRows = await query('SELECT UserID, Status FROM Tasks WHERE TaskID = ?', [taskId])
    if (taskRows.length === 0) return res.status(404).json({ message: 'Task not found' })
    
    const task = taskRows[0]
    if (task.Status !== 'Completed') {
      return res.status(400).json({ message: 'Cannot review a task that is not completed.' })
    }

    const assignmentRows = await query('SELECT HelperID FROM TaskAssignments WHERE TaskID = ?', [taskId])
    const helperId = assignmentRows.length > 0 ? assignmentRows[0].HelperID : null

    const isPoster = task.UserID === req.user.id
    const isHelper = helperId === req.user.id

    if (!isPoster && !isHelper) {
      return res.status(403).json({ message: 'You are not part of this task.' })
    }

    const reviewedUserId = isPoster ? helperId : task.UserID

    // Check if review already exists
    const existing = await query('SELECT ReviewID FROM Reviews WHERE TaskID = ? AND ReviewerID = ?', [taskId, req.user.id])
    if (existing.length > 0) {
      return res.status(400).json({ message: 'You have already reviewed this task.' })
    }

    await query('INSERT INTO Reviews (TaskID, ReviewerID, ReviewedUserID, Rating, Comment) VALUES (?, ?, ?, ?, ?)', [
      taskId, req.user.id, reviewedUserId, Number(rating), comment || ''
    ])

    // Recalculate and update the reviewed user's average rating in Users table
    const avgRows = await query(
      'SELECT ROUND(AVG(Rating)::numeric, 2) AS AvgRating, COUNT(*) AS ReviewCount FROM Reviews WHERE ReviewedUserID = ?',
      [reviewedUserId]
    )
    if (avgRows.length > 0 && avgRows[0].AvgRating !== null) {
      await query('UPDATE Users SET Rating = ? WHERE UserID = ?', [Number(avgRows[0].AvgRating), reviewedUserId])
    }

    await query(
      'INSERT INTO Notifications (UserID, SenderID, TaskID, Message, IsRead, CreatedAt) VALUES ($1, $2, $3, $4, 0, NOW())',
      [reviewedUserId, req.user.id, taskId, 'You received a new review!']
    )

    return res.json({ success: true, message: 'Review submitted.' })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.delete('/:taskId/proof', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }

  try {
    const assignmentRows = await query(
      `
        SELECT ta.AssignmentID, ta.HelperID, ta.ProofImage, t.UserID AS PosterID, t.Status
        FROM TaskAssignments ta
        INNER JOIN Tasks t ON t.TaskID = ta.TaskID
        WHERE ta.TaskID = ?
        ORDER BY ta.AcceptedAt DESC
        LIMIT 1
      `,
      [taskId]
    )

    if (assignmentRows.length === 0) {
      return res.status(404).json({ message: 'Task assignment not found' })
    }

    const assignment = assignmentRows[0]
    const isUploader = Number(assignment.HelperID) === Number(req.user.id)
    const taskStatus = String(assignment.Status || '').toLowerCase()
    const isApprovedOrCompleted = taskStatus.includes('proofapproved') || taskStatus.includes('complete')

    if (!isUploader) {
      return res.status(403).json({ message: 'Only the proof uploader can delete this image' })
    }

    if (isApprovedOrCompleted) {
      return res.status(403).json({ message: 'Approved proof cannot be deleted' })
    }

    const storedProof = String(assignment.ProofImage || '')

    if (!storedProof) {
      return res.status(400).json({ message: 'No proof image to delete' })
    }

    await query(
      'UPDATE TaskAssignments SET ProofImage = NULL, CompletedAt = NULL WHERE AssignmentID = ?',
      [assignment.AssignmentID]
    )

    await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', ['Assigned', taskId])

    const normalizedProof = storedProof.replace(/\\+/g, '/')
    if (!normalizedProof.startsWith('data:image')) {
      const fileName = normalizedProof.split('/').pop()
      if (fileName) {
        try {
          await supabase.storage.from('uploads').remove([`proofs/${fileName}`])
        } catch (err) {
          logger.error('Failed to remove proof from supabase:', err.message)
        }
      }
    }

    return res.json({ message: 'Proof deleted successfully', taskId })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.patch('/:taskId/status', requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId)
  const { status } = req.body

  if (!['Open', 'Assigned', 'Completed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' })
  }

  try {
    const task = await query('SELECT UserID FROM Tasks WHERE TaskID = ?', [taskId])

    if (task.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const ownerId = task[0].UserID
    if (ownerId !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own tasks' })
    }

    await query('UPDATE Tasks SET Status = ? WHERE TaskID = ?', [status, taskId])

    return res.json({ TaskID: taskId, Status: status })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

export default router
