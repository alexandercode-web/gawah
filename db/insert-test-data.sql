-- Add test data for multi-user testing

USE gawahelperdb;

-- Insert test users if they don't exist
INSERT INTO Users (FullName, Email, PasswordHash, Rating, CreatedAt)
VALUES 
  ('John Smith', 'john@test.com', '$2b$10$YourHashedPasswordHere1', 4.5, NOW()),
  ('Jane Doe', 'jane@test.com', '$2b$10$YourHashedPasswordHere2', 4.8, NOW())
ON DUPLICATE KEY UPDATE UserID=LAST_INSERT_ID(UserID);

-- Get the user IDs
SET @user1_id = (SELECT UserID FROM Users WHERE Email = 'john@test.com' LIMIT 1);
SET @user2_id = (SELECT UserID FROM Users WHERE Email = 'jane@test.com' LIMIT 1);

-- Insert sample tasks from each user
INSERT INTO Tasks (UserID, Title, Description, Location, TaskTime, Budget, CategoryID, Status, CreatedAt)
VALUES
  (@user1_id, 'Buy groceries from supermarket', 'Please buy milk, eggs, and bread', 'Main Market', DATE_ADD(NOW(), INTERVAL 2 HOUR), 150, 
    (SELECT CategoryID FROM Categories WHERE CategoryName = 'Shopping' LIMIT 1), 'Open', NOW()),
  (@user1_id, 'Deliver package to dorm', 'Send this box to Building C Room 302', 'Building A', DATE_ADD(NOW(), INTERVAL 3 HOUR), 100, 
    (SELECT CategoryID FROM Categories WHERE CategoryName = 'Delivery' LIMIT 1), 'Open', NOW()),
  (@user2_id, 'Tutor Math exam prep', 'Need help preparing for calculus midterm', 'Library 2nd floor', DATE_ADD(NOW(), INTERVAL 1 HOUR), 200, 
    (SELECT CategoryID FROM Categories WHERE CategoryName = 'Tutoring' LIMIT 1), 'Open', NOW()),
  (@user2_id, 'Clean dorm room', 'Deep cleaning of dorm including floor and windows', 'Dorm Block D', DATE_ADD(NOW(), INTERVAL 4 HOUR), 180, 
    (SELECT CategoryID FROM Categories WHERE CategoryName = 'Cleaning' LIMIT 1), 'Open', NOW());

SELECT 'Test data inserted successfully. Users created with test credentials.' AS status;
