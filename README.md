# GawaHelper System

This project is a full-stack starter system based on your SQL schema where one account type (user/student) can both post tasks and do tasks.

- User/student registration and login (no admin account)
- Category management
- Task posting and listing
- Helper task applications
- Task status updates

## Project Structure

- `db/mysql_schema.sql` -> MySQL / phpMyAdmin database script
- `server/index.js` -> Express API
- `src/App.jsx` -> React app routes

## 1) Create The Database

Create/import database using phpMyAdmin:

1. Open `http://localhost/phpmyadmin`
2. Create database named `gawahelperdb`
3. Import `db/mysql_schema.sql`

## 2) Configure Environment

Copy `.env.example` to `.env` and update values:

```
PORT=4000
JWT_SECRET=replace-with-a-long-random-secret
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=gawahelperdb
DB_USER=root
DB_PASSWORD=
```

## 3) Run The API

```
npm run server
```

API base URL: `http://localhost:4000/api`

## 4) Run The Frontend

Open a second terminal:

```
npm run dev
```

Frontend URL: `http://localhost:5173`

## 5) Run Both Together (Recommended)

Use one command so register/login never fails due to backend being stopped:

```
npm run dev:all
```

## Available Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users` (Authenticated)
- `GET /api/categories`
- `POST /api/categories` (Authenticated)
- `GET /api/tasks`
- `POST /api/tasks` (Authenticated)
- `POST /api/tasks/:taskId/apply` (Authenticated)
- `PATCH /api/tasks/:taskId/status` (Owner only)
- `GET /api/my/tasks` (Authenticated)
