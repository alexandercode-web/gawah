-- Clear all data while keeping tables intact
-- Order matters due to foreign keys

USE GawaHelperDB;
GO

-- Delete data from dependent tables first (if they exist)
IF OBJECT_ID('Messages') IS NOT NULL DELETE FROM Messages;
IF OBJECT_ID('Notifications') IS NOT NULL DELETE FROM Notifications;
IF OBJECT_ID('Reviews') IS NOT NULL DELETE FROM Reviews;
IF OBJECT_ID('Reports') IS NOT NULL DELETE FROM Reports;    
IF OBJECT_ID('Payments') IS NOT NULL DELETE FROM Payments;
IF OBJECT_ID('TaskAssignments') IS NOT NULL DELETE FROM TaskAssignments;
IF OBJECT_ID('Tasks') IS NOT NULL DELETE FROM Tasks;

-- Reset user ratings to 0 (keeps user accounts)
UPDATE Users SET Rating = 0;

-- Reset identity seeds to start from 1 again (if tables exist)
IF OBJECT_ID('Messages') IS NOT NULL DBCC CHECKIDENT ('Messages', RESEED, 0);
IF OBJECT_ID('Notifications') IS NOT NULL DBCC CHECKIDENT ('Notifications', RESEED, 0);
IF OBJECT_ID('Reviews') IS NOT NULL DBCC CHECKIDENT ('Reviews', RESEED, 0);
IF OBJECT_ID('Reports') IS NOT NULL DBCC CHECKIDENT ('Reports', RESEED, 0);
IF OBJECT_ID('Payments') IS NOT NULL DBCC CHECKIDENT ('Payments', RESEED, 0);
IF OBJECT_ID('TaskAssignments') IS NOT NULL DBCC CHECKIDENT ('TaskAssignments', RESEED, 0);
IF OBJECT_ID('Tasks') IS NOT NULL DBCC CHECKIDENT ('Tasks', RESEED, 0);

PRINT 'All data cleared successfully. User accounts preserved with ratings reset to 0.';
