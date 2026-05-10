import express from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { requireAuth, requireAdmin, signToken } from '../auth.js'
import { notifyUser } from '../sse.js'
import { supabase } from '../supabase.js'
import logger from '../logger.js'

// Add other necessary imports specific to the module below

const router = express.Router()



router.post('/users', requireAdmin, async (req, res) => {
  const { fullName, email, password } = req.body

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'Full name, email, and password are required' })
  }

  try {
    const existing = await query('SELECT UserID FROM Users WHERE Email = ?', [email])
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' })
    }

    const hash = await bcrypt.hash(password, 10)
    const result = await query(
      'INSERT INTO Users (FullName, Email, PasswordHash, EmailVerified) VALUES (?, ?, ?, ?) RETURNING UserID',
      [fullName, email, hash, 1]
    )

    return res.status(201).json({
      UserID: result[0]?.UserID || result.insertId,
      FullName: fullName,
      Email: email,
      Rating: null
    })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.put('/users/:userId', requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId)
  const { fullName, email, rating } = req.body

  if (!Number.isFinite(userId)) return res.status(400).json({ message: 'Invalid user ID' })

  try {
    const fields = []
    const params = []

    if (fullName) { fields.push('FullName = ?'); params.push(fullName) }
    if (email) { fields.push('Email = ?'); params.push(email) }
    if (rating !== undefined) { fields.push('Rating = ?'); params.push(Number(rating)) }

    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' })

    params.push(userId)
    await query(`UPDATE Users SET ${fields.join(', ')} WHERE UserID = ?`, params)

    return res.json({ message: 'User updated successfully' })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM Users) AS totalUsers,
        (SELECT COUNT(*) FROM Tasks WHERE LOWER(Status) NOT IN ('completed','cancelled')) AS activeTasks,
        (SELECT COUNT(*) FROM Tasks WHERE Status = 'Completed') AS completedTasks,
        (SELECT COALESCE(SUM(Budget), 0) FROM Tasks) AS totalValue,
        (SELECT COUNT(*) FROM Messages) AS totalMessages,
        (SELECT COUNT(DISTINCT ta.HelperID) FROM TaskAssignments ta INNER JOIN Tasks t ON ta.TaskID = t.TaskID WHERE LOWER(t.Status) NOT IN ('cancelled')) AS activeHelpers
    `)
    return res.json(result[0])
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/users', requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const offset = Number(req.query.offset) || 0
  try {
    const result = await query(`
      SELECT
        u.UserID,
        u.FullName,
        u.Email,
        u.Rating,
        u.IsDeactivated,
        u.CreatedAt,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = u.UserID) AS TasksPosted,
        (SELECT COUNT(*) FROM TaskAssignments ta INNER JOIN Tasks t ON ta.TaskID = t.TaskID WHERE ta.HelperID = u.UserID AND t.Status = 'Completed') AS TasksCompleted
      FROM Users u
      ORDER BY u.CreatedAt DESC LIMIT ? OFFSET ?
    `, [limit, offset])
    return res.json(result)
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/tasks', requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const offset = Number(req.query.offset) || 0
  try {
    const result = await query(`
      SELECT
        t.TaskID, t.Title, t.Status, t.Budget, t.CreatedAt,
        u.FullName AS PosterName,
        hu.FullName AS HelperName
      FROM Tasks t
      INNER JOIN Users u ON t.UserID = u.UserID
      LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID
      LEFT JOIN Users hu ON hu.UserID = ta.HelperID
      ORDER BY t.CreatedAt DESC LIMIT ? OFFSET ?
    `, [limit, offset])
    return res.json(result)
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/messages', requireAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        m.MessageID, m.TaskID, m.Content, m.AttachmentType, m.AttachmentData, m.AttachmentName, m.CreatedAt,
        s.FullName AS SenderName,
        r.FullName AS RecipientName,
        t.Title AS TaskTitle
      FROM Messages m
      INNER JOIN Users s ON m.SenderID = s.UserID
      INNER JOIN Users r ON m.RecipientID = r.UserID
      INNER JOIN Tasks t ON m.TaskID = t.TaskID
      ORDER BY m.CreatedAt DESC
      LIMIT 100
    `)
    return res.json(result)
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/users/:userId/suspend', requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user id' })
  }
  try {
    const userRows = await query('SELECT UserID FROM Users WHERE UserID = ? LIMIT 1', [userId])
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }
    // For now, delete the user (or you could add a Suspended column)
    // Instead of deleting, we toggle the deactivation flag to preserve platform history
    await query('UPDATE Users SET IsDeactivated = 1 WHERE UserID = ?', [userId])
    return res.json({ message: 'User deactivated successfully', userId })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/users/:userId/activate', requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user id' })
  }
  try {
    const userRows = await query('SELECT UserID FROM Users WHERE UserID = ? LIMIT 1', [userId])
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }
    await query('UPDATE Users SET IsDeactivated = 0 WHERE UserID = ?', [userId])
    return res.json({ message: 'User reactivated successfully', userId })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.delete('/tasks/:taskId', requireAdmin, async (req, res) => {
  const taskId = Number(req.params.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task id' })
  }
  try {
    const taskRows = await query('SELECT TaskID FROM Tasks WHERE TaskID = ? LIMIT 1', [taskId])
    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
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

router.get('/summary', requireAdmin, async (req, res) => {
  try {
    // Overall platform stats
    const [statsResult] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*) FROM Users) AS totalUsers,
          (SELECT COUNT(*) FROM Tasks) AS totalTasks,
          (SELECT COUNT(*) FROM Tasks WHERE Status = 'Open') AS openTasks,
          (SELECT COUNT(*) FROM Tasks WHERE Status = 'Assigned') AS assignedTasks,
          (SELECT COUNT(*) FROM Tasks WHERE Status = 'Completed') AS completedTasks,
          (SELECT COUNT(*) FROM Tasks WHERE Status = 'Cancelled') AS cancelledTasks,
          (SELECT COALESCE(SUM(Budget), 0) FROM Tasks) AS totalBudget,
          (SELECT COALESCE(SUM(Budget), 0) FROM Tasks WHERE Status = 'Completed') AS completedValue,
          (SELECT COALESCE(AVG(Budget), 0) FROM Tasks) AS avgBudget,
          (SELECT COUNT(*) FROM TaskAssignments) AS totalAssignments,
          (SELECT COUNT(*) FROM Messages) AS totalMessages,
          (SELECT COUNT(*) FROM Reviews) AS totalReviews,
          (SELECT COALESCE(AVG(Rating), 0) FROM Reviews) AS avgRating,
          (SELECT COUNT(*) FROM Payments) AS totalPayments,
          (SELECT COALESCE(SUM(Amount), 0) FROM Payments WHERE Status = 'Completed') AS completedPayments
      `)
    ])

    // Tasks created per month (last 12 months)
    const tasksByMonth = await query(`
      SELECT 
        TO_CHAR(CreatedAt, 'YYYY-MM') AS month,
        COUNT(*) AS count,
        COALESCE(SUM(Budget), 0) AS totalBudget
      FROM Tasks
      WHERE CreatedAt >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(CreatedAt, 'YYYY-MM')
      ORDER BY month ASC
    `)

    // Tasks by status
    const tasksByStatus = await query(`
      SELECT Status AS status, COUNT(*) AS count
      FROM Tasks
      GROUP BY Status
      ORDER BY count DESC
    `)

    // Tasks by category
    const tasksByCategory = await query(`
      SELECT
        COALESCE(c.CategoryName, 'Uncategorized') AS category,
        COUNT(*) AS count,
        COALESCE(SUM(t.Budget), 0) AS totalBudget
      FROM Tasks t
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      GROUP BY c.CategoryName
      ORDER BY count DESC
    `)

    // User registrations per month (last 12 months)
    const usersByMonth = await query(`
      SELECT 
        TO_CHAR(CreatedAt, 'YYYY-MM') AS month,
        COUNT(*) AS count
      FROM Users
      WHERE CreatedAt >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(CreatedAt, 'YYYY-MM')
      ORDER BY month ASC
    `)

    // Top helpers by completed tasks
    const topHelpers = await query(`
      SELECT
        u.FullName AS name,
        u.Rating AS rating,
        COUNT(ta.AssignmentID) AS completedTasks,
        COALESCE(SUM(t.Budget), 0) AS totalEarnings
      FROM TaskAssignments ta
      INNER JOIN Users u ON ta.HelperID = u.UserID
      INNER JOIN Tasks t ON ta.TaskID = t.TaskID
      WHERE t.Status = 'Completed'
      GROUP BY u.UserID, u.FullName, u.Rating
      ORDER BY totalEarnings DESC
      LIMIT 5
    `)

    // Recent completed tasks
    const recentCompleted = await query(`
      SELECT
        t.TaskID,
        t.Title,
        t.Budget,
        t.Status,
        t.CreatedAt,
        u.FullName AS posterName,
        hu.FullName AS helperName,
        c.CategoryName AS category
      FROM Tasks t
      INNER JOIN Users u ON t.UserID = u.UserID
      LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID
      LEFT JOIN Users hu ON hu.UserID = ta.HelperID
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      WHERE t.Status = 'Completed'
      ORDER BY t.CreatedAt DESC
      LIMIT 10
    `)

    // Revenue by payment method
    const revenueByMethod = await query(`
      SELECT
        PaymentMethod AS method,
        COUNT(*) AS count,
        COALESCE(SUM(Amount), 0) AS total
      FROM Payments
      GROUP BY PaymentMethod
      ORDER BY total DESC
    `)

    return res.json({
      stats: statsResult[0],
      tasksByMonth,
      tasksByStatus,
      tasksByCategory,
      usersByMonth,
      topHelpers,
      recentCompleted,
      revenueByMethod,
    })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/transactions', requireAdmin, async (req, res) => {
  try {
    const transactions = await query(`
      SELECT
        p.PaymentID,
        p.TaskID,
        t.Title AS taskTitle,
        p.Amount,
        p.PaymentMethod,
        p.Status,
        p.CreatedAt,
        p.CompletedAt,
        poster.FullName AS posterName,
        helper.FullName AS helperName,
        c.CategoryName AS category
      FROM Payments p
      INNER JOIN Tasks t ON p.TaskID = t.TaskID
      INNER JOIN Users poster ON t.UserID = poster.UserID
      LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID
      LEFT JOIN Users helper ON helper.UserID = ta.HelperID
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      ORDER BY p.CreatedAt DESC
      LIMIT 100
    `)

    return res.json(transactions)
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/activity', requireAdmin, async (req, res) => {
  try {
    // Recent task-related activities
    const activities = await query(`
      (
        SELECT
          'task_created' AS type,
          t.TaskID AS referenceId,
          t.Title AS description,
          u.FullName AS userName,
          t.CreatedAt AS timestamp
        FROM Tasks t
        INNER JOIN Users u ON t.UserID = u.UserID
        ORDER BY t.CreatedAt DESC
        LIMIT 20
      )
      UNION ALL
      (
        SELECT
          'task_assigned' AS type,
          ta.TaskID AS referenceId,
          CONCAT('Accepted task: ', t.Title) AS description,
          u.FullName AS userName,
          ta.AcceptedAt AS timestamp
        FROM TaskAssignments ta
        INNER JOIN Tasks t ON ta.TaskID = t.TaskID
        INNER JOIN Users u ON ta.HelperID = u.UserID
        ORDER BY ta.AcceptedAt DESC
        LIMIT 20
      )
      UNION ALL
      (
        SELECT
          'review_submitted' AS type,
          r.TaskID AS referenceId,
          CONCAT('Rated ', r.Rating, ' stars') AS description,
          u.FullName AS userName,
          r.CreatedAt AS timestamp
        FROM Reviews r
        INNER JOIN Users u ON r.ReviewerID = u.UserID
        ORDER BY r.CreatedAt DESC
        LIMIT 20
      )
      UNION ALL
      (
        SELECT
          'user_registered' AS type,
          u.UserID AS referenceId,
          CONCAT('New user registered: ', u.FullName) AS description,
          u.FullName AS userName,
          u.CreatedAt AS timestamp
        FROM Users u
        ORDER BY u.CreatedAt DESC
        LIMIT 20
      )
      ORDER BY timestamp DESC
      LIMIT 50
    `)

    return res.json(activities)
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.post('/audit-log', requireAdmin, async (req, res) => {
  const { action, targetType, targetId, details } = req.body
  try {
    await query(
      'INSERT INTO AuditLogs (AdminID, Action, TargetType, TargetID, Details) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, action || 'unknown', targetType || 'unknown', targetId || null, details || null]
    )
    return res.json({ success: true })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/audit-log', requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  try {
    const result = await query(`
      SELECT l.*, a.Username AS AdminUsername
      FROM AuditLogs l
      LEFT JOIN Admins a ON a.AdminID = l.AdminID
      ORDER BY l.CreatedAt DESC
      LIMIT ? OFFSET ?
    `, [limit, offset])
    return res.json(result)
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

export default router
