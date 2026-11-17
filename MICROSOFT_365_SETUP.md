# PCAS Microsoft 365 Integration Readiness

## What is included in the current prototype

The PCAS interface includes launch panels for Microsoft Teams, Microsoft Planner, OneDrive, Outlook, Power Automate, Power BI and Microsoft Copilot. These open the relevant Microsoft web applications in a new tab. The PCAS Planner is a separate internal task schedule backed by the PCAS API.

**These are launch links, not live Microsoft 365 integrations.** PCAS does not currently read or write Microsoft 365 data, create Teams meetings, sync Planner tasks, access OneDrive files, send Outlook email, trigger Power Automate flows, embed Power BI reports, or call the Copilot API.

## Required before enabling live integration

An organisation Microsoft 365 administrator must:

1. Confirm the organisation's Microsoft 365 tenant and approve the proposed integration.
2. Register a PCAS application in Microsoft Entra admin centre (App registrations).
3. Configure the exact PCAS redirect URI and supported account type.
4. Select the minimum Microsoft Graph delegated or application permissions required for the approved features.
5. Grant administrator consent where required.
6. Provide the tenant ID and application/client ID to the deployment administrator through a secure channel.
7. Configure a server-side OAuth authorization-code flow, token validation, refresh-token handling and encrypted token storage. Do not put client secrets or refresh tokens in the browser or commit them to GitHub.
8. Implement and test each integration separately, including access controls, audit logging, revocation and error handling.

## Suggested integration scope

- **Teams:** link project workspaces to Teams teams/channels and optionally create meeting links.
- **Planner:** map PCAS projects/tasks to Planner plans, buckets and tasks; define which system is authoritative to avoid conflicting updates.
- **OneDrive:** link or upload project documents to approved SharePoint/OneDrive locations with permission checks.
- **Outlook:** create calendar events and send approved task/meeting notifications.
- **Power Automate:** invoke approved flows for task assignment, due-date reminders and project approvals.
- **Power BI:** publish management dashboards using a controlled dataset or API.
- **Copilot:** use the organisation's approved Copilot/Microsoft 365 extensibility route; the current PCAS assistant is only a local summary of data already loaded into PCAS.

## Render configuration

The PCAS frontend calls the backend API at:

`https://pcas-backend.onrender.com/api`

If `https://pcas-x07f.onrender.com` is the deployed PCAS frontend, set the backend Render Web Service environment variable:

`CLIENT_ORIGIN=https://pcas-x07f.onrender.com`

Use the frontend origin only (no path and no trailing slash). If the actual frontend URL is different, use that exact origin instead. Save the environment variable and redeploy/restart the backend.

The frontend uses the existing PCAS backend routes for sign-in, users, projects and tasks. The backend must be live, connected to MongoDB Atlas, and have valid `MONGODB_URI`, `JWT_SECRET` and `SETUP_SECRET` values.

## Important deployment note

The existing first administrator account remains in MongoDB. Sign in with that account; do not run the one-time setup endpoint again. Team accounts can be created from **Team directory** by an EA administrator. Passwords must be at least 12 characters.
