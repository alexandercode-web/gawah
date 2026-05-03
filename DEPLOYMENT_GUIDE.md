# GawaHelper Deployment Guide (Render.com + PostgreSQL)

This guide provides a step-by-step process for deploying the GawaHelper platform to **Render.com**.

## Prerequisites
1.  A [GitHub](https://github.com/) account with your code pushed to a repository.
2.  A [Render](https://render.com/) account.
3.  Your PostgreSQL database schema ready (already handled in `server/db.js`).

---

## Step 1: Create a PostgreSQL Database on Render
1.  Log in to your Render Dashboard.
2.  Click **New +** and select **PostgreSQL**.
3.  **Name**: `gawahelper-db`
4.  **Database**: `gawahelper`
5.  **User**: (keep default)
6.  **Region**: Choose the one closest to you (e.g., Singapore or Oregon).
7.  Click **Create Database**.
8.  **IMPORTANT**: Once created, copy the **Internal Database URL** (for the backend) and the **External Database URL** (for local testing).

---

## Step 2: Deploy the Backend (Web Service)
1.  Click **New +** and select **Web Service**.
2.  Connect your GitHub repository.
3.  **Name**: `gawahelper-api`
4.  **Environment**: `Node`
5.  **Root Directory**: `server` (This is where your `index.js` and `db.js` are located).
6.  **Build Command**: `npm install`
7.  **Start Command**: `node index.js`
8.  **Environment Variables**:
    Click **Advanced** -> **Add Environment Variable**:
    | Key | Value |
    | :--- | :--- |
    | `DATABASE_URL` | (Paste your **Internal Database URL** from Step 1) |
    | `PORT` | `4000` |
    | `JWT_SECRET` | (Your secret key, e.g., `gawahelper_secret_2024`) |
    | `NODE_ENV` | `production` |
9.  Click **Create Web Service**.

---

## Step 3: Deploy the Frontend (Static Site)
1.  Click **New +** and select **Static Site**.
2.  Connect the same GitHub repository.
3.  **Name**: `gawahelper-web`
4.  **Build Command**: `npm install && npm run build`
5.  **Publish Directory**: `dist`
6.  **Environment Variables**:
    You need to tell the frontend where the API is:
    | Key | Value |
    | :--- | :--- |
    | `VITE_API_URL` | (Paste the URL of your **Backend Web Service** created in Step 2) |
7.  **Redirects/Rewrites**:
    Since this is a Single Page Application (SPA), go to **Redirects/Rewrites** in the settings:
    - **Source**: `/*`
    - **Destination**: `/index.html`
    - **Action**: `Rewrite`
    (This prevents 404 errors on page refreshes).

---

## Step 4: Verify Deployment
1.  Open your Frontend URL (e.g., `https://gawahelper-web.onrender.com`).
2.  Try to login as admin (`gawahelper-admin` / `gawahelper`).
3.  Check if the **Dashboard Statistics** are loading (this confirms DB connection).
4.  Check **Reports** and **Messages** to ensure data is flowing.

---

## Troubleshooting
-   **Database Connection Refused**: Ensure you used the **Internal Database URL** in the backend environment variables.
-   **White Screen on Frontend**: Ensure you added the **Rewrite rule** (Step 3.7) to point all routes to `index.html`.
-   **API Errors**: Check the Render logs in the Backend Web Service to see if there are any SQL or startup errors.
