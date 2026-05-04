CREATE TABLE Users (
    UserID SERIAL PRIMARY KEY,
    FullName VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    PasswordHash VARCHAR(255) NOT NULL,
    Rating DECIMAL(2,1) DEFAULT 0,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Categories (
    CategoryID SERIAL PRIMARY KEY,
    CategoryName VARCHAR(50) NOT NULL
);

CREATE TABLE Tasks (
    TaskID SERIAL PRIMARY KEY,
    UserID INT NOT NULL,
    Title VARCHAR(100) NOT NULL,
    Description TEXT NOT NULL,
    Location VARCHAR(100) NOT NULL,
    TaskTime TIMESTAMP NOT NULL,
    Budget DECIMAL(10,2) NOT NULL,
    CategoryID INT NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'Open',
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID)
);

CREATE TABLE TaskAssignments (
    AssignmentID SERIAL PRIMARY KEY,
    TaskID INT NOT NULL,
    HelperID INT NOT NULL,
    AcceptedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CompletedAt TIMESTAMP NULL,
    ProofImage VARCHAR(255),

    FOREIGN KEY (TaskID) REFERENCES Tasks(TaskID),
    FOREIGN KEY (HelperID) REFERENCES Users(UserID)
);

CREATE TABLE Payments (
    PaymentID SERIAL PRIMARY KEY,
    TaskID INT NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    PaymentMethod VARCHAR(20) NOT NULL CHECK (PaymentMethod IN ('Cash', 'GCash')),
    Status VARCHAR(20) DEFAULT 'Pending',
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (TaskID) REFERENCES Tasks(TaskID)
);

CREATE TABLE Reviews (
    ReviewID SERIAL PRIMARY KEY,
    TaskID INT NOT NULL,
    ReviewerID INT NOT NULL,
    ReviewedUserID INT NOT NULL,
    Rating INT CHECK (Rating BETWEEN 1 AND 5),
    Comment TEXT,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (TaskID) REFERENCES Tasks(TaskID),
    FOREIGN KEY (ReviewerID) REFERENCES Users(UserID),
    FOREIGN KEY (ReviewedUserID) REFERENCES Users(UserID)
);

CREATE TABLE Notifications (
    NotificationID SERIAL PRIMARY KEY,
    UserID INT NOT NULL,
    SenderID INT,
    TaskID INT,
    Message VARCHAR(255) NOT NULL,
    IsRead BOOLEAN DEFAULT FALSE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (SenderID) REFERENCES Users(UserID),
    FOREIGN KEY (TaskID) REFERENCES Tasks(TaskID)
);

CREATE TABLE Reports (
    ReportID SERIAL PRIMARY KEY,
    ReporterID INT NOT NULL,
    ReportedUserID INT NOT NULL,
    Reason TEXT NOT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ReporterID) REFERENCES Users(UserID),
    FOREIGN KEY (ReportedUserID) REFERENCES Users(UserID)
);

CREATE TABLE Messages (
    MessageID SERIAL PRIMARY KEY,
    TaskID INT NOT NULL,
    SenderID INT NOT NULL,
    RecipientID INT NOT NULL,
    Content TEXT NOT NULL,
    AttachmentType VARCHAR(20) NULL,
    AttachmentData TEXT NULL,
    AttachmentName VARCHAR(255) NULL,
    AttachmentMime VARCHAR(100) NULL,
    IsRead BOOLEAN DEFAULT FALSE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (TaskID) REFERENCES Tasks(TaskID),
    FOREIGN KEY (SenderID) REFERENCES Users(UserID),
    FOREIGN KEY (RecipientID) REFERENCES Users(UserID)
);

INSERT INTO Categories (CategoryName)
VALUES
('Cleaning'),
('Delivery'),
('Tutoring'),
('Repairs'),
('Shopping');
