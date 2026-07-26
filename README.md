# Hogwarts Studio CRM

Hogwarts Studio CRM is a full-stack CRM and operations platform for managing clients, shoots, payments, editing work, attendance, and team workflows.

The repository is split into two apps:

- `backend/` - Express + MongoDB API
- `frontend/` - Next.js App Router frontend with server-side API proxy routes

## Tech Stack

- Backend: Express, Mongoose, MongoDB, JWT, bcrypt, cookie-parser, CORS, Zod
- Frontend: Next.js 13 App Router, React 18, TypeScript, Tailwind CSS, Radix UI, Sonner
- Integrations: n8n webhooks for proposal sending, payment link sending, and payment confirmation

## Repository Layout

- `backend/src/app.js` - Express app wiring and route mounting
- `backend/src/index.js` - server bootstrap and MongoDB connection
- `backend/src/models/` - MongoDB schemas
- `backend/src/controllers/` - business logic for each domain
- `backend/src/routes/` - Express route definitions
- `frontend/app/` - Next.js pages and route handlers
- `frontend/components/` - shared UI components
- `frontend/lib/` - auth, data, formatting, and domain helpers
- `frontend/hooks/` - client hooks

## MongoDB Schemas

The backend defines these Mongoose models:

- `User` - users, roles, auth fields, avatar, refresh token, profile data
- `Client` - leads/clients, proposal state, service data, sales notes, delivery fields
- `Project` - project ownership, membership, description, and member roles
- `Payment` - payment tracking, verification, status, installment details
- `Attendance` - per-employee attendance records, check-in/out, status, work location
- `EditProject` - editing workflow record for a lead/project, delivery metadata, revisions
- `EditingTask` - task-level editing work items, assignment history, deadlines, delivery state
- `Note` - project notes, content, author, project relation
- `Revision` - revision history and feedback records
- `SalesTeam` - sales team reference data and expertise details
- `Shoot` - shoot scheduling, logistics, extra add-ons, handover fields
- `Task` - project tasks, subtasks, attachments, assignee, completion state

## Express API

All backend routes are mounted under `/api/v1` in `backend/src/app.js`.

### Core and Auth

- `GET /` - backend status message
- `GET /api/v1/healthcheck` - health check
- `POST /api/v1/auth/register` - register a user
- `POST /api/v1/auth/login` - log in
- `GET /api/v1/auth/verify-email/:token` - email verification
- `POST /api/v1/auth/forgot-password` - start password reset
- `POST /api/v1/auth/reset-password/:token` - complete password reset
- `POST /api/v1/auth/refresh-token` - refresh access token
- `POST /api/v1/auth/logout` - log out
- `POST /api/v1/auth/resend-verification-email` - resend verification email
- `GET /api/v1/auth/me` - current user profile
- `POST /api/v1/auth/change-password` - change password

### Users

- `GET /api/v1/users` - list users
- `PUT /api/v1/users/:id` - update a user

### Clients

- `GET /api/v1/clients` - list leads/clients
- `POST /api/v1/clients` - create a lead/client
- `PUT /api/v1/clients/:leadId` - update a lead/client

### Shoots

- `GET /api/v1/shoots` - list shoots
- `POST /api/v1/shoots` - create a shoot
- `PUT /api/v1/shoots/:shootId` - update a shoot

### Payments

- `GET /api/v1/payments` - list payments
- `POST /api/v1/payments` - create a payment record
- `PUT /api/v1/payments/:paymentId/verify` - verify a payment

### Editing

- `GET /api/v1/editing` - fetch editing dashboard data
- `PUT /api/v1/editing/task/:taskId` - update an editing task
- `POST /api/v1/editing/revision` - add a revision record

### Attendance

- `POST /api/v1/attendance/check-in` - check in
- `POST /api/v1/attendance/check-out` - check out
- `GET /api/v1/attendance/my-attendance` - current user attendance
- `GET /api/v1/attendance/team-attendance` - team attendance view

### Realtime Data

- `GET /api/v1/realtime-data` - dashboard summary data

## Express Route Modules Present But Not Mounted

These route files exist in the repository, but they are not currently mounted in `backend/src/app.js`:

- `backend/src/routes/project.routes.js`
- `backend/src/routes/task.routes.js`
- `backend/src/routes/note.routes.js`

That means the route handlers in those files are not exposed by the running backend unless they are mounted later.

## Next.js API Routes

The frontend uses App Router API handlers in `frontend/app/api/`.

### Auth and Session

- `POST /api/auth/login` - log in through Express and store cookies
- `POST /api/auth/logout` - clear session cookies
- `POST /api/auth/update-profile` - update the authenticated user profile

### Backend Proxy Routes

These handlers call the Express API and reshape responses for the UI:

- `GET /api/attendance` - fetch attendance data
- `POST /api/attendance` - check in or check out
- `GET /api/clients` - fetch clients
- `POST /api/clients` - create client
- `PUT /api/clients` - update client
- `GET /api/editing` - fetch editing dashboard data
- `PUT /api/editing` - update editing task
- `GET /api/payments` - fetch payments
- `POST /api/payments` - create payment
- `GET /api/realtime-data` - fetch dashboard summary data
- `GET /api/shoots` - fetch shoots
- `POST /api/shoots` - create shoot
- `PUT /api/shoots` - update shoot
- `GET /api/users` - fetch users
- `POST /api/users` - create user
- `PUT /api/users` - update user

### Automation/Webhook Routes

- `POST /api/send-proposal` - sends proposal payload to n8n
- `POST /api/send-payment-link` - uploads invoice/payment link data to n8n
- `POST /api/confirm-payment` - confirms payment through n8n

## Data Flow

1. The Next.js frontend calls its own `/api/*` route handlers.
2. Those handlers check the session cookies and proxy requests to the Express backend.
3. Express validates JWT auth, talks to MongoDB through Mongoose models, and returns structured JSON.
4. Some frontend routes bypass Express and send data directly to n8n webhooks for automation workflows.

## Environment Variables

### Backend

The backend reads from `backend/.env` through `dotenv`.

Common variables used in code:

- `PORT`
- `MONGODB_URI`
- `CORS_ORIGIN`
- `ACCESS_TOKEN_SECRET`
- `ACCESS_TOKEN_EXPIRY`
- `REFRESH_TOKEN_SECRET`
- `REFRESH_TOKEN_EXPIRY`

### Frontend

The frontend reads from `frontend/.env`.

Common variables used in code:

- `NEXT_PUBLIC_BACKEND_URL`
- `N8N_SEND_PROPOSAL_WEBHOOK_URL`
- `N8N_SEND_PAYMENT_LINK_WEBHOOK_URL`
- `N8N_CONFIRM_PAYMENT_WEBHOOK_URL`

## Run Commands

### Backend

From `backend/`:

- `npm install`
- `npm run dev`
- `npm start`

### Frontend

From `frontend/`:

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run typecheck`

## Important Notes

- The backend currently mounts `auth`, `users`, `clients`, `shoots`, `payments`, `editing`, `realtime-data`, `attendance`, and `healthcheck`.
- The route files for `projects`, `tasks`, and `notes` are present but not active in the Express app.
- The frontend session cookies are named `howgarts_session` and `howgarts_token`.
- `frontend/app/api/auth/login/route.ts` depends on the Express auth response shape and stores both the user profile and the JWT token in cookies.

## Summary

This codebase is a CRM for managing:

- users and roles
- clients and proposals
- shoots and shoot logistics
- payments and verification
- editing tasks and revisions
- attendance tracking
- realtime dashboard data
- automation through external webhooks
