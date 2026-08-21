# Project Requirements Mapping

This document lists and categorizes all system requirements for the Full-Stack Email Job Scheduler.

---

## 1. Mandatory Assignment Requirements
These are the core constraints and deliverables explicitly requested in the primary assignment:

### A. Backend Architecture
* **Node.js + Express**: Central application server.
* **TypeScript**: Strict typechecking on the backend.
* **Database**: MySQL mapping campaign structures.
* **Queue**: BullMQ delayed jobs handling email scheduling.
* **Queue Storage/Coordination**: Redis daemon instance.
* **Email dispatch**: Nodemailer configured to send via Ethereal SMTP server.

### B. Scheduling Mechanics
* **No CPU-blocking Cron/setInterval**: Scheduling must be managed asynchronously using BullMQ delayed queues.
* **Bulk email dispatch**: The capacity to upload lead lists and process them sequentially.
* **One Job per Recipient**: Dynamic individual job instantiation in BullMQ rather than one single giant job for a whole campaign.

### C. Rate Limits & Concurrency
* **Configurable Concurrency**: Support for customizable worker concurrency numbers.
* **Hourly Email Rate Limit**: An upper boundary on email dispatches allowed within a rolling 60-minute window.
* **Rescheduling**: Jobs hitting the hourly rate limit must not fail permanently; they must calculate the next available block and reschedule dynamically in BullMQ.
* **Global Minimum Delay**: A safety wait margin (e.g. 5000ms) enforced between individual email dispatches.

### D. Lead Upload & Processing
* **CSV and TXT Parsing**: Support for list formats, validating emails, stripping whitespace, and deduplicating records.
* **Campaign Compose**: Form containing input boundaries for subject, body, lead file, minimum delay, hourly limit, and target startTime.

---

## 2. Implementation Choices
These represent the specific engineering tools and framework libraries chosen to fulfill the assignment requirements:

* **Next.js (App Router) & React**: Front-end single-page client architecture.
* **Tailwind CSS**: Utility-first stylesheet mappings for the responsive glassmorphic dashboard views.
* **Prisma ORM**: Client schema wrapper mapping relationships, indexes, and migrations to MySQL database.
* **Firebase Authentication (Google Client SDK & Admin SDK)**: Implemented as the security mechanism for Google Login, token verification, and API route protection.
* **TanStack Query & React Hook Form**: Managing client-side asynchronous queries and form parsing/validations.

---

## 3. Optional Enhancements
These are useful, non-mandatory additions incorporated to improve developer experience, security bounds, and E2E verifiability:

* **Swagger/OpenAPI Explorer**: Built-in interactive REST documentation endpoints at `/api/docs`.
* **Postman Collection**: Pre-configured JSON collection under `docs/postman/` for quick endpoint validation.
* **Redis Lua Scripting**: Atomic Lua checks evaluating minimum delay margins and hourly limit counters to prevent concurrent worker race conditions.
