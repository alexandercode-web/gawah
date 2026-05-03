-- Clear old notifications to start fresh
USE gawahelperdb;

DELETE FROM Notifications WHERE TaskID IS NULL;

SELECT 'Old notifications deleted' AS status;
