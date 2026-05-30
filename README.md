# OpenPaws Stewardship Workspace

OpenPaws is a donor stewardship platform for creating synthetic donation records, reviewing AI-generated thank-you drafts, and managing the approval-and-send workflow for donor communication.

<!-- Tech badges removed as requested -->

## Quick Summary

The app moves a donation through a stewardship lifecycle: capture the gift, generate a thank-you draft, review and refine the draft, then approve or send the final communication. The user experience is intentionally centered on three things: visibility, review, and completion.

## Project Overview

This repository contains a full-stack stewardship workflow designed for donor operations teams. The client provides a dashboard, donation records, draft review queue, and draft editor. The server handles donor and donation persistence, draft generation, draft review, approval, and email actions. Prisma maps the application to PostgreSQL, while OpenRouter and Gmail support the thank-you draft and send flow.

The application is structured around three core experiences:

- Creating or syncing a donation record.
- Generating and refining a donor thank-you draft.
- Approving, rejecting, or sending the final communication.

## System Workflow

1. A user opens the client and lands on the dashboard.
2. The dashboard summarizes donor and donation activity and links to the main work areas.
3. The user can create a synthetic donation, browse donation records, or move into the draft review queue.
4. When a donation needs a thank-you message, the system generates a draft from donor and gift context.
5. The draft can be reviewed, edited, saved, approved, rejected, or sent.
6. Final workflow state is persisted so records and review views stay aligned with the latest action.

## Database & Persistence

The backend uses PostgreSQL through Prisma to store the working data that powers the stewardship workflow. At a high level, the database layer handles three things:

1. Donation records are written when synthetic test donations are created.
2. Draft records are updated as drafts move through review, approval, rejection, and send states.
3. Email logs are stored so the send history stays traceable and can be reviewed later.

The practical flow is:

- Client action -> Express API
- Express API -> Prisma models
- Prisma models -> PostgreSQL tables
- Database result -> refreshed dashboard, records, and review views

This keeps the app consistent across page reloads and makes the dashboard, records table, and draft queue reflect the same source of truth.

### Flow Diagram

```mermaid
flowchart LR
  U[User]
  UI[Client UI\nDashboard, Records, Reviews, Draft Editor]
  APP[Application Flow\nNavigation, State, Actions]
  API[Server Layer\nBusiness Workflow]
  DB[(PostgreSQL\nPrisma Data Layer)]
  AI[Draft Generation\nOpenRouter]
  MAIL[Email Delivery\nGmail Workflow]
  OUT[Updated Stewardship Outcome\nSaved Records, Reviewed Drafts, Sent Emails]

  U --> UI
  UI --> APP
  APP --> API
  API --> DB
  API --> AI
  API --> MAIL
  DB --> OUT
  MAIL --> OUT
  OUT --> UI
```

## Product Glimpse

The UI is organized into a focused stewardship workspace with a premium dark glass aesthetic. The main surfaces are:

- Dashboard for quick visibility into donors, donations, and recent activity.
- Donation Records for browsing and filtering stored gifts.
- Draft Review Queue for monitoring draft status and bulk review actions.
- Draft Review for editing, approving, rejecting, and sending donor thank-you messages.

Visually, the interface emphasizes a compact sidebar, a precise top bar, and fewer distracting cards so the workflow stays centered on stewardship tasks.

## Core Features

- Donation creation for synthetic test data.
- Dashboard summaries for donor and donation activity.
- Donation record filtering and pagination.
- Draft generation for donor thank-you communication.
- Draft review, editing, saving, approval, and rejection.
- Batch approval and batch send support.
- Persistent draft and donation state through the server and database.
- Gmail-based email workflow for final message delivery.
- OpenRouter-based draft generation with structured JSON output.

## Technologies Used

### Client

- React 18
- Vite
- React Router
- Tailwind CSS

### Server

- Node.js
- Express
- Prisma
- PostgreSQL
- Zod
- Google APIs for Gmail integration
- OpenRouter for draft generation

### Supporting Libraries

- dotenv for environment configuration
- cors for browser access
- morgan for request logging

## Installation

### Prerequisites

- Node.js 18 or later
- npm
- PostgreSQL database
- OpenRouter API key if you want live draft generation
- Gmail OAuth credentials if you want live email delivery

### 1. Install client dependencies

```bash
cd client
npm install
```

### 2. Install server dependencies

```bash
cd server
npm install
```

### 3. Configure environment variables

Create a `.env` file in the `server` folder with the required values:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=anthropic/claude-sonnet-4
OPENROUTER_FALLBACK_MODEL=openai/gpt-4.1
OPENROUTER_SITE_URL=http://localhost:5000
OPENROUTER_APP_NAME=Donor Thank-You Automation
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REDIRECT_URI=http://localhost:5000/api/email/gmail/oauth2callback
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token
GMAIL_SENDER_EMAIL=your_sender_email@example.com
PORT=5000
```

If you want the client to target a different backend URL, create `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

## Run

### Start the server

```bash
cd server
npm run dev
```

The server runs on port `5000` by default.

### Start the client

```bash
cd client
npm run dev
```

The Vite client runs on port `5173` by default.

### Optional seed data

```bash
cd server
npm run seed
```

## Screenshots & Visual Notes

### Dashboard

- The dashboard uses a dark "glass" aesthetic with a compact left navigation and a focused top bar. Key summary cards show counts and totals (example: "Donors synced" = 25, "Donations synced" = 51, "Captured amount" ≈ $23,475) along with a recent activity feed. Primary CTAs include `Open records` and `Preview review queue` to move quickly into workflows.

### Draft Review Queue

- The Draft Review Queue presents a tabular list of donation drafts with columns for `Donor`, `Donation`, `Review`, `Email`, `Match`, and `Actions`. Rows show review status (e.g. `APPROVED`), email send state (`SENT`), and match classification (`MATCHED` / `NO MATCH`). Action buttons include `Open` for detail and `Regenerate` to request a new draft.

### Thank-you Email Preview (mobile)

- The email preview demonstrates the generated thank-you content as rendered in a mobile inbox: personalized salutation, explicit mention of the gift amount (e.g. `$100`), program designation ("Emergency Rescue Fund"), a concise gratitude paragraph, and a warm sign-off ("With heartfelt appreciation, OpenPaws"). This view highlights the importance of previewing drafts in mobile layouts for readability and line breaks.

These visual notes map directly to product features: the dashboard for oversight, the Draft Review Queue for bulk and individual review workflows, and the email preview for final-quality checks before sending.

### Embedded Screenshots

Below are the screenshots referenced in the visual notes and stored in `assets/screenshots/`.

![Dashboard](./assets/screenshots/Screenshot%202026-05-30%20161222.png)

![Draft Review Queue](./assets/screenshots/Screenshot%202026-05-30%20161240.png)

<div align="center">
  <img src="./assets/screenshots/WhatsApp%20Image%202026-05-30%20at%204.13.50%20PM.jpeg" alt="Thank-you Email Preview (mobile)" width="320" />
</div>

## Data Model Summary

The Prisma schema centers on five main entities:

- `donors` for donor profiles and history.
- `donations` for gift records and acknowledgment status.
- `drafts` for AI-generated thank-you content and review state.
- `email_logs` for outbound email tracking.
- `audit_logs` for operational traceability.

This structure supports the stewardship flow from donation capture through draft review and final email delivery.

## Notes

- The client is designed to remain visible even when the backend is unavailable by falling back to local demo content.
- If OpenRouter or Gmail credentials are missing, those live workflow steps will not complete successfully.
- The README diagram is intentionally high-level so it can be pasted directly into GitHub.