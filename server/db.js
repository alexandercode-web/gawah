import pg from 'pg'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

dotenv.config()

const { Pool } = pg

const dbName = process.env.DB_NAME || 'gawahelperdb'

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }

let pool
let initialized = false
let initializingPromise = null

export async function initDatabase() {
  if (initialized) return
  if (initializingPromise) return initializingPromise

  initializingPromise = (async () => {
    pool = new Pool(poolConfig)

    // Test connection
    try {
      const client = await pool.connect()
      console.log('PostgreSQL Connected successfully')
      client.release()
    } catch (err) {
      console.error('PostgreSQL Connection Error:', err.message)
    }

    // Users Table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS Users (
      UserID SERIAL PRIMARY KEY,
      FullName VARCHAR(100) NOT NULL,
      Email VARCHAR(100) NOT NULL UNIQUE,
      PasswordHash VARCHAR(255) NOT NULL,
      Rating DECIMAL(3,1) NOT NULL DEFAULT 5.0,
      WalletBalance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      ProfileImage VARCHAR(255) NULL,
      CurrentChallenge VARCHAR(255) NULL,
      IsAdmin SMALLINT NOT NULL DEFAULT 0,
      IsDeactivated SMALLINT NOT NULL DEFAULT 0,
      CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // Admins Table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS Admins (
      AdminID SERIAL PRIMARY KEY,
      Username VARCHAR(50) NOT NULL UNIQUE,
      PasswordHash VARCHAR(255) NOT NULL,
      FullName VARCHAR(100) NOT NULL DEFAULT 'Administrator',
      CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // Categories Table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS Categories (
      CategoryID SERIAL PRIMARY KEY,
      CategoryName VARCHAR(50) NOT NULL UNIQUE
    )
  `)

    console.log('PostgreSQL: Tables created, seeding defaults...')
    // Seed default admin
    const admins = await pool.query('SELECT AdminID FROM Admins LIMIT 1')
    if (admins.rows.length === 0) {
      const salt = await bcrypt.genSalt(10)
      const hash = await bcrypt.hash('gawahelper', salt)
      await pool.query(
        'INSERT INTO Admins (Username, PasswordHash, FullName) VALUES ($1, $2, $3)',
        ['gawahelper-admin', hash, 'Main Administrator']
      )
      console.log('Default admin account created: gawahelper-admin / gawahelper')
    }

    console.log('PostgreSQL: Admin seeded, seeding categories...')
    // Seed Categories
    await pool.query(`
    INSERT INTO Categories (CategoryName) 
    VALUES ('Cleaning'), ('Delivery'), ('Tutoring'), ('Repairs'), ('Shopping')
    ON CONFLICT (CategoryName) DO NOTHING
  `)

    // PasswordResetCodes
    await pool.query(`
    CREATE TABLE IF NOT EXISTS PasswordResetCodes (
      CodeID SERIAL PRIMARY KEY,
      UserID INT NOT NULL REFERENCES Users(UserID),
      ResetCode VARCHAR(10) NOT NULL,
      ExpiresAt TIMESTAMPTZ NOT NULL,
      IsUsed SMALLINT NOT NULL DEFAULT 0,
      CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // WebAuthnCredentials
    await pool.query(`
    CREATE TABLE IF NOT EXISTS WebAuthnCredentials (
      ID SERIAL PRIMARY KEY,
      UserID INT NOT NULL REFERENCES Users(UserID),
      CredentialID VARCHAR(255) NOT NULL UNIQUE,
      PublicKey TEXT NOT NULL,
      Counter INT NOT NULL DEFAULT 0,
      Transports VARCHAR(255) NULL,
      CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // Tasks Table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS Tasks (
      TaskID SERIAL PRIMARY KEY,
      UserID INT NOT NULL REFERENCES Users(UserID),
      Title VARCHAR(100) NOT NULL,
      Description TEXT NOT NULL,
      Location VARCHAR(100) NOT NULL,
      TaskTime TIMESTAMPTZ NOT NULL,
      Budget DECIMAL(10,2) NOT NULL CHECK (Budget > 0),
      CategoryID INT NOT NULL REFERENCES Categories(CategoryID),
      Status VARCHAR(20) NOT NULL DEFAULT 'Open',
      CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // TaskAssignments
    await pool.query(`
    CREATE TABLE IF NOT EXISTS TaskAssignments (
      AssignmentID SERIAL PRIMARY KEY,
      TaskID INT NOT NULL REFERENCES Tasks(TaskID),
      HelperID INT NOT NULL REFERENCES Users(UserID),
      AcceptedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CompletedAt TIMESTAMPTZ NULL,
      ProofImage VARCHAR(255) NULL,
      CONSTRAINT uq_task_helper UNIQUE (TaskID, HelperID)
    )
  `)

    // Payments Table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS Payments (
      PaymentID SERIAL PRIMARY KEY,
      TaskID INT NOT NULL REFERENCES Tasks(TaskID),
      Amount DECIMAL(10,2) NOT NULL,
      PaymentMethod VARCHAR(20) NOT NULL CHECK (PaymentMethod IN ('Cash', 'GCash')),
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      PayerUserID INT NULL,
      PayeeUserID INT NULL,
      CompletedAt TIMESTAMPTZ NULL,
      CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // Messages Table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS Messages (
      MessageID SERIAL PRIMARY KEY,
      TaskID INT NOT NULL REFERENCES Tasks(TaskID),
      SenderID INT NOT NULL REFERENCES Users(UserID),
      RecipientID INT NOT NULL REFERENCES Users(UserID),
      Content TEXT NOT NULL,
      AttachmentType VARCHAR(20) NULL,
      AttachmentData TEXT NULL,
      AttachmentName VARCHAR(255) NULL,
      AttachmentMime VARCHAR(100) NULL,
      IsRead SMALLINT NOT NULL DEFAULT 0,
      CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // Reviews Table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS Reviews (
      ReviewID SERIAL PRIMARY KEY,
      TaskID INT NOT NULL REFERENCES Tasks(TaskID),
      ReviewerID INT NOT NULL REFERENCES Users(UserID),
      ReviewedUserID INT NOT NULL REFERENCES Users(UserID),
      Rating DECIMAL(2,1) NOT NULL CHECK (Rating >= 0.5 AND Rating <= 5.0),
      Comment TEXT NULL,
      CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // Notifications Table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS Notifications (
      NotificationID SERIAL PRIMARY KEY,
      UserID INT NOT NULL REFERENCES Users(UserID),
      SenderID INT NULL REFERENCES Users(UserID),
      TaskID INT NULL REFERENCES Tasks(TaskID),
      Message VARCHAR(255) NOT NULL,
      IsRead SMALLINT NOT NULL DEFAULT 0,
      CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // Reports Table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS Reports (
      ReportID SERIAL PRIMARY KEY,
      ReporterID INT NOT NULL REFERENCES Users(UserID),
      ReportedUserID INT NOT NULL REFERENCES Users(UserID),
      Reason TEXT NOT NULL,
      CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // Repair: Ensure all tasks have a payment record (fixes orphaned tasks from migration)
    await pool.query(`
    INSERT INTO Payments (TaskID, Amount, PaymentMethod, Status, PayerUserID)
    SELECT t.TaskID, t.Budget, 'Cash', 'Pending', t.UserID
    FROM Tasks t
    LEFT JOIN Payments p ON t.TaskID = p.TaskID
    WHERE p.PaymentID IS NULL
    ON CONFLICT DO NOTHING
  `)

    console.log('PostgreSQL: All tables and constraints verified.')

    // Migration: Convert Reviews.Rating from INT to DECIMAL if needed
    await pool.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'reviews' AND column_name = 'rating' AND data_type = 'integer'
        ) THEN
          ALTER TABLE Reviews ALTER COLUMN Rating TYPE DECIMAL(2,1);
          ALTER TABLE Reviews DROP CONSTRAINT IF EXISTS reviews_rating_check;
          ALTER TABLE Reviews ADD CONSTRAINT reviews_rating_check CHECK (Rating >= 0.5 AND Rating <= 5.0);
          RAISE NOTICE 'Migrated Reviews.Rating from INT to DECIMAL(2,1)';
        END IF;
      END $$;
    `)

    // Migration: Add IsDeactivated column to Users if it doesn't exist
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'isdeactivated'
        ) THEN
          ALTER TABLE Users ADD COLUMN IsDeactivated SMALLINT NOT NULL DEFAULT 0;
          RAISE NOTICE 'Added IsDeactivated column to Users table';
        END IF;
      END $$;
    `)
    initialized = true
    initializingPromise = null
  })()

  return initializingPromise
}

const keyMap = {
  userid: 'UserID',
  fullname: 'FullName',
  email: 'Email',
  passwordhash: 'PasswordHash',
  rating: 'Rating',
  walletbalance: 'WalletBalance',
  profileimage: 'ProfileImage',
  currentchallenge: 'CurrentChallenge',
  isadmin: 'IsAdmin',
  createdat: 'CreatedAt',
  adminid: 'AdminID',
  username: 'Username',
  categoryid: 'CategoryID',
  categoryname: 'CategoryName',
  codeid: 'CodeID',
  resetcode: 'ResetCode',
  expiresat: 'ExpiresAt',
  isused: 'IsUsed',
  id: 'ID',
  credentialid: 'CredentialID',
  publickey: 'PublicKey',
  counter: 'Counter',
  transports: 'Transports',
  taskid: 'TaskID',
  title: 'Title',
  description: 'Description',
  location: 'Location',
  tasktime: 'TaskTime',
  budget: 'Budget',
  status: 'Status',
  assignmentid: 'AssignmentID',
  helperid: 'HelperID',
  acceptedat: 'AcceptedAt',
  completedat: 'CompletedAt',
  proofimage: 'ProofImage',
  paymentid: 'PaymentID',
  amount: 'Amount',
  paymentmethod: 'PaymentMethod',
  payeruserid: 'PayerUserID',
  payeeuserid: 'PayeeUserID',
  messageid: 'MessageID',
  senderid: 'SenderID',
  recipientid: 'RecipientID',
  content: 'Content',
  attachmenttype: 'AttachmentType',
  attachmentdata: 'AttachmentData',
  attachmentname: 'AttachmentName',
  attachmentmime: 'AttachmentMime',
  isread: 'IsRead',
  reviewid: 'ReviewID',
  reviewerid: 'ReviewerID',
  revieweduserid: 'ReviewedUserID',
  comment: 'Comment',
  notificationid: 'NotificationID',
  message: 'Message',
  reportid: 'ReportID',
  reporterid: 'ReporterID',
  reporteduserid: 'ReportedUserID',
  reason: 'Reason',
  postername: 'PosterName',
  posterrating: 'PosterRating',
  posterid: 'PosterID',
  helpername: 'HelperName',
  helperprofileimage: 'HelperProfileImage',
  helperrating: 'HelperRating',
  helperacceptedat: 'HelperAcceptedAt',
  sendername: 'SenderName',
  recipientname: 'RecipientName',
  tasktitle: 'TaskTitle',
  posterprofileimage: 'PosterProfileImage',
  posterreviewid: 'PosterReviewID',
  posterreviewrating: 'PosterReviewRating',
  posterreviewcomment: 'PosterReviewComment',
  reviewername: 'ReviewerName',
  reviewerprofileimage: 'ReviewerProfileImage',
  role: 'Role',
  referenceid: 'referenceId',
  totalusers: 'TotalUsers',
  totaltasks: 'TotalTasks',
  opentasks: 'OpenTasks',
  assignedtasks: 'AssignedTasks',
  completedtasks: 'CompletedTasks',
  cancelledtasks: 'CancelledTasks',
  totalbudget: 'TotalBudget',
  completedvalue: 'CompletedValue',
  avgbudget: 'AvgBudget',
  totalassignments: 'TotalAssignments',
  totalhelpers: 'TotalHelpers',
  totalpayments: 'TotalPayments',
  completedpayments: 'CompletedPayments',
  totalearnings: 'TotalEarnings',
  rating: 'Rating',
  totalmessages: 'TotalMessages',
  totalreviews: 'TotalReviews',
  totalvalue: 'TotalValue',
  avgrating: 'AvgRating',
  allcompletedtasks: 'AllCompletedTasks',
  reviewcount: 'reviewCount',
  ratingcount: 'RatingCount',
  taskcount: 'TaskCount',
  completedcount: 'CompletedCount',
  activecount: 'ActiveCount',
  pendingcount: 'PendingCount',
  activetasks: 'ActiveTasks',
  activehelpers: 'ActiveHelpers',
  isdeactivated: 'IsDeactivated',
  tasksposted: 'TasksPosted',
  taskscompleted: 'TasksCompleted',
  helpercompletedtasks: 'HelperCompletedTasks',
  helpercompletedvalue: 'HelperCompletedValue',
  helperacceptedtasks: 'HelperAcceptedTasks',
  totalcategories: 'TotalCategories',
  mypostedtasks: 'MyPostedTasks',
  mycompletedtasks: 'MyCompletedTasks',
  attachmentdata: 'AttachmentData',
  attachmentname: 'AttachmentName',
  attachmenttype: 'AttachmentType',
  username: 'UserName',
  referenceid: 'ReferenceId',
  timestamp: 'Timestamp',
  sendername: 'SenderName',
  recipientname: 'RecipientName',
  helpername: 'HelperName',
  unreadcount: 'UnreadCount'
};

/**
 * Custom query wrapper that converts MySQL '?' placeholders to PostgreSQL '$n' format.
 * It also maps lowercase PostgreSQL keys back to PascalCase for the frontend.
 */
export async function query(sql, params = []) {
  if (!initialized) await initDatabase()

  let index = 1
  const postgresSql = sql.replace(/\?/g, () => `$${index++}`)

  try {
    const res = await pool.query(postgresSql, params)

    // Map lowercase keys back to PascalCase
    return res.rows.map(row => {
      const newRow = {};
      for (const key in row) {
        if (keyMap[key]) {
          newRow[keyMap[key]] = row[key];
        } else {
          newRow[key] = row[key];
        }
      }
      return newRow;
    });
  } catch (err) {
    console.error('PostgreSQL Query Error:', { sql: postgresSql, error: err.message })
    throw err
  }
}

export async function getDbPool() {
  if (!initialized) {
    await initDatabase()
  }

  // Attach a mock getConnection to support legacy mysql2 transaction syntax
  if (!pool.getConnection) {
    pool.getConnection = async () => {
      const client = await pool.connect();
      return {
        beginTransaction: async () => await client.query('BEGIN'),
        commit: async () => await client.query('COMMIT'),
        rollback: async () => await client.query('ROLLBACK'),
        release: () => client.release(),
        query: async (sql, params = []) => {
          let index = 1;
          const postgresSql = sql.replace(/\?/g, () => `$${index++}`);
          const res = await client.query(postgresSql, params);

          // Apply keyMap to restore PascalCase
          const mappedRows = res.rows.map(row => {
            const newRow = {};
            for (const key in row) {
              if (keyMap[key]) {
                newRow[keyMap[key]] = row[key];
              } else {
                newRow[key] = row[key];
              }
            }
            return newRow;
          });
          return [mappedRows, res.fields];
        },
        execute: async function (sql, params) {
          return this.query(sql, params);
        }
      };
    };
  }

  return pool
}
