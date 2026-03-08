# Deploying to Netlify (Frontend Only)

This guide explains how to deploy the **Frontend** to Netlify. 

**Note:** Since this is a full-stack app, you also need to deploy the **Backend** (Node.js/Socket.io) somewhere else (like Render, Railway, or Heroku), because Netlify only hosts static sites and serverless functions, not persistent WebSocket servers.

## Prerequisites

1.  A GitHub account.
2.  A Netlify account.
3.  Push this project to a GitHub repository.

## Steps

1.  **Push to GitHub**:
    *   Initialize a git repo if you haven't: `git init`, `git add .`, `git commit -m "initial commit"`.
    *   Create a new repo on GitHub.
    *   Push your code.

2.  **Deploy Header to Netlify**:
    *   Log in to Netlify.
    *   Click "Add new site" -> "Import from existing project".
    *   Select GitHub and choose your repository.

3.  **Configure Build Settings**:
    *   **Base directory**: `frontend`
    *   **Build command**: `npm run build`
    *   **Publish directory**: `dist`

4.  **Environment Variables**:
    *   You need to tell the frontend where the backend is.
    *   In Netlify Site Settings > Environment Variables, add:
        *   `VITE_API_URL`: The URL of your deployed backend (e.g., `https://my-chat-backend.onrender.com`).

## Important: The Backend Issue
You **cannot** host the Node.js/Socket.io backend on Netlify efficiently. You should deploy the `backend/` folder to a service like **Render** or **Railway**.

### Quick Backend Deployment (Render.com)
1.  Create a "Web Service" on Render.
2.  Connect your GitHub repo.
3.  **Root Directory**: `backend`
4.  **Build Command**: `npm install`
5.  **Start Command**: `node server.js`
6.  Add Environment Variables: `MONGO_URI` (your cloud MongoDB URL, e.g., from MongoDB Atlas).

Once the backend is live, copy its URL and use it in the Netlify Frontend environment variables.
