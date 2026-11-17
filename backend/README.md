# PCAS API

Node.js/Express API with MongoDB Atlas persistence, JWT authentication, role-based access and audit records.

## Local setup

1. Install Node.js 20 or later.
2. From this directory run `npm install`.
3. Copy `.env.example` to `.env` and set the required values.
4. Run `npm run dev`.

The API listens on port 10000 by default. Health check: `GET /api/health`.

## Render deployment

Create a separate **Web Service** using this same GitHub repository:

- Branch: `main`
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

Set these environment variables in Render:

- `MONGODB_URI`: MongoDB Atlas connection string
- `JWT_SECRET`: long random secret (at least 32 random bytes)
- `JWT_EXPIRES_IN`: `8h`
- `SETUP_SECRET`: a separate long random one-time setup secret
- `CLIENT_ORIGIN`: exact URL of the deployed PCAS static site

After deployment, verify `https://YOUR-API.onrender.com/api/health`.

## First administrator

Make one POST request to `/api/auth/setup` with JSON:

```json
{
  "setupSecret": "the SETUP_SECRET configured in Render",
  "name": "Executive Assistant",
  "email": "ea@example.com",
  "password": "use-a-unique-password-at-least-12-characters"
}
```

This endpoint only works while the database has no users. It creates the first EA_ADMIN. Keep the setup secret private.

## Roles

- `EA_ADMIN`: user administration and full project/task management
- `PROJECT_MANAGER`: project and task management
- `TEAM_MEMBER`: views assigned tasks and can update their status
- `EXECUTIVE_VIEWER`: read-only access is intended for management dashboards; API access is being expanded with the frontend integration

## Important

The current static HTML frontend still uses localStorage. This API is the first backend foundation; the next step is to connect the login screen and existing project/task screens to these API endpoints. Do not treat the frontend as multi-user until that integration and role-based UI restrictions are complete.
