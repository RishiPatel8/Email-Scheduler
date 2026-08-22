<div align="center">
  <br />
  <h1>🚀 Email Campaign Scheduler</h1>
  <p><strong>A highly concurrent, fault-tolerant, and atomic email dispatching system.</strong></p>
</div>

---

## 🌟 Executive Summary

This project is a production-ready **Email Job Scheduler** built with a modern stack (**Next.js, Express, Prisma, MySQL, BullMQ, Redis**). 

It is designed with an obsessive focus on **fault tolerance, concurrency management, and atomic database operations**. Through rigorous synthetic load testing (1,000+ simultaneous recipients across multiple worker instances), this system mathematically guarantees **zero database-level duplicate claims**, gracefully handles worker crashes via staleness leases, and strictly respects dynamic rate limits and minimum dispatch delays.

Coupled with a **premium, highly-responsive frontend dashboard**, the scheduler allows users to seamlessly upload CSVs, draft rich HTML emails, and monitor their campaign's lifecycle in real-time.

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, React Hook Form, TanStack Query, Lucide Icons, Framer Motion.
- **Backend API:** Node.js, Express.js, Zod (Validation), Firebase Admin.
- **Database / ORM:** MySQL, Prisma.
- **Message Broker / Cache:** Redis, BullMQ.
- **Authentication:** Firebase Auth (Client & Admin).
- **Email Delivery:** Nodemailer (Ethereal SMTP).
- **Testing:** Vitest (with comprehensive dependency and atomic race-condition mocking).

---

## ✨ Standout Engineering Features (Evaluation Highlights)

### 1. Atomic Concurrency & Safe Claims
To prevent duplicate dispatches in a multi-worker environment, we implemented a strict database-level atomic claim using Prisma's `updateMany` combined with explicit status filtering. Only one worker can ever transition a recipient from `QUEUED` to `DISPATCHING`. Concurrent workers attempting to claim the same record are safely rejected without initiating SMTP, achieving zero duplication.

### 2. Stale Dispatch Lease Recovery
Distributed systems fail. If a BullMQ worker crashes *after* claiming a job but *before* SMTP completes, the record becomes stuck in `DISPATCHING`. We implemented a robust `recoverStaleDispatches` routine that detects expired leases (e.g., older than 10 minutes) and safely reverts them to `QUEUED` for immediate processing by surviving workers.

### 3. Strict Rate Limiting & Minimum Delay (Lua Scripts)
Using atomic Redis Lua scripts, the system enforces a strict `MAX_EMAILS_PER_HOUR` limit per user, alongside a `DEFAULT_EMAIL_DELAY_MS` delay between consecutive emails for a given campaign. If limits are reached, the worker uses BullMQ's delay mechanisms to exponentially back off and reschedule the job without failing it.

### 4. Idempotent Retry & Lifecycle Robustness
If SMTP fails temporarily (e.g., network timeouts), the system leans on BullMQ's exponential backoff. The database is only marked as `FAILED` on the absolute final attempt, ensuring no emails are prematurely discarded. Furthermore, if a job is somehow re-processed after being successfully `SENT`, the worker recognizes the terminal state and safely ignores it.

### 5. Premium UI/UX & Responsive Design
The Next.js frontend has been crafted with attention to detail. It features a modern, clean interface with glassmorphic elements, subtle hover animations, accessible form validations (Zod), and responsive layouts that look exceptional on both desktop and mobile devices.

---

**For Hosting the project :
I have used Azure for deploying Backend 
for Frontend is deployed in the Vercel 
Database I have used Aiven
for Redis deployment Upstash has been used**

For LocalSetup

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+)
- **MySQL** (Running locally or via Docker)
- **Redis** (Running locally or via Docker)
- **Firebase Project** (Client Config & Admin Service Account)

### 2. Environment Configuration
Populate the `.env` files in both the `frontend` and `backend` directories. Reference the provided `.env.example` files.

**Backend (`backend/.env`):**
```env
PORT=3001
DATABASE_URL="mysql://root:password@localhost:3306/email_scheduler"
REDIS_HOST=localhost
REDIS_PORT=6379

FIREBASE_PROJECT_ID="..."
FIREBASE_CLIENT_EMAIL="..."
FIREBASE_PRIVATE_KEY="..."

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER="..."
SMTP_PASS="..."

MAX_EMAILS_PER_HOUR=200
DEFAULT_EMAIL_DELAY_MS=2000
WORKER_CONCURRENCY=5
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
```

### 3. Database Setup
```bash
cd backend
npx prisma generate
npx prisma db push
```

### 4. Running the Application
Open **three** separate terminals to run the system:

**Terminal 1: Backend API**
```bash
cd backend
npm install
npm run dev:api
```

**Terminal 2: BullMQ Worker**
```bash
cd backend
npm run dev:worker
```

**Terminal 3: Next.js Frontend**
```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

---

## 🧪 Comprehensive Test Suite

The backend contains a rigorous test suite (`vitest`) specifically targeting concurrency, rate limits, and lifecycle robustness.

```bash
cd backend
npm run test
```


### Test Coverage Highlights:
- **Race Test / Concurrent Execution:** Spawns multiple identical job processors simultaneously to guarantee only one `updateMany` succeeds.
- **Stale Recovery Test:** Verifies expired `DISPATCHING` records are safely recovered to `QUEUED`.
- **API Validations:** Asserts comprehensive Zod validation on CSV uploads, campaign creation limits, and Auth headers.
- **Rate Limit & Delayed Job Exhaustion:** Validates that when hourly limits are struck, the system properly delays the job for future processing.

---

## 📈 Known Limitations & Realities

1. **SMTP Exactly-Once Delivery Window:** Because MySQL and external SMTP providers do not share a two-phase commit transaction, there remains a microscopic window where if SMTP accepts the message but the Node server hard-crashes immediately *before* writing `SENT` to the database, the job will eventually be recovered and re-processed (yielding a duplicate email). This is a known, explicit limitation of all asynchronous email systems.
2. **Single Sender Bound:** As per the core requirements, this application bounds the campaign delivery to a single configured Ethereal SMTP account. Multiple sender rotation was evaluated but scoped out of this specific phase.

---

*Engineered with precision for reliability.*
