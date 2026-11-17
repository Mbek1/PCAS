# PCAS — Project Coordination Automation System

A standalone browser-based demonstration prototype for an Executive Assistant.

## Run locally

Open `index.html` in a modern browser (Chrome, Edge, Firefox, or Safari). No package installation or build step is required.

## Deploy to Render

Create a **Static Site** in Render and connect this GitHub repository.

Use these settings:

- Branch: `main`
- Root Directory: leave blank (repository root)
- Build Command: `echo "No build required - serving static HTML"`
- Publish Directory: `.`

Render will publish `index.html` and provide an `onrender.com` URL. New pushes to the connected branch can trigger redeployments.

## Prototype features

- Project registration and editing
- Task creation, assignment, priority, due dates, and status tracking
- Team member management
- Dashboard metrics and project completion calculations
- In-app upcoming-deadline and overdue alerts (simulated)
- Task schedule, reports, CSV export, and print view

## Important limitations

This is a demonstration prototype, not a production collaboration platform.

- Project, task, and team data are stored in the current browser's `localStorage`.
- Data is not shared or synchronised between different users, browsers, or devices.
- Clearing browser data or using another browser/device will not carry over local changes.
- Reminder behaviour is simulated in the app; it does not send email, SMS, or Microsoft Teams messages.
- Do not enter confidential or personal organisational information.
- The built-in sample records are fictional and intended only for demonstration.

A production implementation would need a backend, shared database, authentication, role-based permissions, audit history, backups, and actual notification integrations.
