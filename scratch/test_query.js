
import { query } from '../server/db.js';

async function test() {
  try {
    const userId = 1; // Assuming user 1 exists
    const metricsResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM Users) AS TotalUsers,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ? AND Status = 'Open') AS OpenTasks,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ? AND Status = 'Completed') AS CompletedTasks,
        (SELECT COALESCE(SUM(Budget), 0) FROM Tasks WHERE UserID = ? AND Status = 'Completed') AS CompletedValue,
        (SELECT COUNT(*)
         FROM TaskAssignments ta
         INNER JOIN Tasks t ON ta.TaskID = t.TaskID
         WHERE ta.HelperID = ? AND t.Status = 'Completed') AS HelperCompletedTasks,
        (SELECT COALESCE(SUM(t.Budget), 0)
         FROM TaskAssignments ta
         INNER JOIN Tasks t ON ta.TaskID = t.TaskID
         WHERE ta.HelperID = ? AND t.Status = 'Completed') AS HelperCompletedValue,
        (SELECT COUNT(*) FROM TaskAssignments WHERE HelperID = ?) AS HelperAcceptedTasks,
        (SELECT COUNT(*) FROM Categories) AS TotalCategories,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ?) AS MyPostedTasks,
        (SELECT COUNT(*) FROM Tasks WHERE UserID = ? AND Status = 'Completed') AS MyCompletedTasks,
        (
          (SELECT COUNT(*) FROM Tasks WHERE UserID = ? AND Status = 'Completed')
          +
          (SELECT COUNT(*) FROM TaskAssignments ta INNER JOIN Tasks t ON ta.TaskID = t.TaskID WHERE ta.HelperID = ? AND t.Status = 'Completed')
        ) AS AllCompletedTasks
      `, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]);
    
    console.log('Success:', metricsResult);
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit();
}

test();
