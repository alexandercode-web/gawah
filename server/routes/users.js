import express from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { requireAuth, requireAdmin, signToken } from '../auth.js'
import { notifyUser } from '../sse.js'
import { supabase } from '../supabase.js'
import logger from '../logger.js'

// Add other necessary imports specific to the module below

const router = express.Router()

router.get('/home/summary', requireAuth, async (req, res) => {
  try {
    const metricsResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM Users) AS TotalUsers,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ?::int AND LOWER(Status) = 'open') AS OpenTasks,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ?::int AND LOWER(Status) = 'completed') AS CompletedTasks,
        (SELECT COALESCE(SUM(Budget), 0) FROM Tasks WHERE UserID = ?::int AND LOWER(Status) = 'completed') AS CompletedValue,
        (SELECT COUNT(*)
         FROM TaskAssignments ta
         INNER JOIN Tasks t ON ta.TaskID = t.TaskID
         WHERE ta.HelperID = ?::int AND LOWER(t.Status) = 'completed') AS HelperCompletedTasks,
        (SELECT COALESCE(SUM(t.Budget), 0)
         FROM TaskAssignments ta
         INNER JOIN Tasks t ON ta.TaskID = t.TaskID
         WHERE ta.HelperID = ?::int AND LOWER(t.Status) = 'completed') AS HelperCompletedValue,
        (SELECT COUNT(*) FROM TaskAssignments WHERE HelperID = ?::int) AS HelperAcceptedTasks,
        (SELECT COUNT(*) FROM Categories) AS TotalCategories,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ?::int) AS MyPostedTasks,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ?::int AND LOWER(Status) = 'completed') AS MyCompletedTasks,
        (
          (SELECT COUNT(*) FROM Tasks WHERE UserID = ?::int AND LOWER(Status) = 'completed')
          +
          (SELECT COUNT(*) FROM TaskAssignments ta INNER JOIN Tasks t ON ta.TaskID = t.TaskID WHERE ta.HelperID = ?::int AND LOWER(t.Status) = 'completed')
        ) AS AllCompletedTasks
      `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id])

    const recentTasksResult = await query(`
      SELECT DISTINCT
        t.TaskID, t.Title, t.Location, t.Budget, t.Status,
        u.FullName AS PosterName, u.Rating AS PosterRating,
        c.CategoryName, t.CreatedAt
      FROM Tasks t
      INNER JOIN Users u ON t.UserID = u.UserID
      LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
      LEFT JOIN TaskAssignments ta ON ta.TaskID = t.TaskID AND ta.HelperID = ?
      WHERE LOWER(t.Status) NOT IN ('completed', 'cancelled')
        AND (LOWER(t.Status) = 'open' OR t.UserID = ? OR ta.HelperID = ?)
      ORDER BY t.CreatedAt DESC
      LIMIT 6
    `, [req.user.id, req.user.id, req.user.id])

    return res.json({ metrics: metricsResult[0], recentTasks: recentTasksResult })
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/', requireAuth, async (_req, res) => {
  try {
    const result = await query(`
      SELECT UserID, FullName, Email, CreatedAt
      FROM Users
      ORDER BY CreatedAt DESC
    `)

    return res.json(result)
  } catch (error) {
    logger.error('API Error:', error.message);
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

router.get('/:userId/profile', requireAuth, async (req, res) => {
  const userId = Number(req.params.userId)
  try {
    const userRows = await query(`
      SELECT u.UserID, u.FullName, u.Email, u.Rating, u.ProfileImage, u.CancellationCount, u.CreatedAt,
        (SELECT COUNT(*) FROM Reviews WHERE ReviewedUserID = u.UserID) AS ReviewCount,
        (SELECT COUNT(*) FROM TaskAssignments ta INNER JOIN Tasks t ON ta.TaskID = t.TaskID WHERE ta.HelperID = u.UserID AND t.Status = 'Completed') AS CompletedAsHelper,
        (SELECT COUNT(*) FROM TaskAssignments WHERE HelperID = u.UserID) AS TotalAccepted
      FROM Users u WHERE u.UserID = ? LIMIT 1
    `, [userId])
    if (userRows.length === 0) return res.status(404).json({ message: 'User not found' })

    const user = userRows[0]
    const totalAccepted = Number(user.TotalAccepted || 0)
    const completionRate = totalAccepted > 0 
      ? Math.round(((totalAccepted - Number(user.CancellationCount || 0)) / totalAccepted) * 100)
      : 100

    return res.json({ ...user, CompletionRate: Math.max(0, completionRate) })
  } catch (error) {
    logger.error('API Error:', error.message)
    return res.status(500).json({ message: 'An internal server error occurred.' })
  }
})

export default router
