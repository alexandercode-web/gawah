-- Migration: Add SenderID and TaskID to Notifications table

USE gawahelperdb;

-- Check if columns exist, if not add them
ALTER TABLE Notifications 
ADD COLUMN SenderID INT NULL AFTER UserID,
ADD COLUMN TaskID INT NULL AFTER SenderID,
ADD CONSTRAINT fk_notifications_sender FOREIGN KEY (SenderID) REFERENCES Users(UserID),
ADD CONSTRAINT fk_notifications_task FOREIGN KEY (TaskID) REFERENCES Tasks(TaskID);

SELECT 'Notifications table updated with SenderID and TaskID columns' AS status;
