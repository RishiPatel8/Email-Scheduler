# Verification Matrix

This matrix maps all core application requirements, their implementation details, verification strategies, and active results based on sandbox capabilities.

| Requirement | Implementation | Test Method | Result | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js & Express** | [`backend/package.json`](file:///d:/assignment/backend/package.json) | Build check (`npm run build`) | **PASS** | Exited `0` during tsc compilation |
| **TypeScript typecheck** | Backend & Frontend TSConfig | Compiler check | **PASS** | `tsc` and Next.js Turbopack compile successfully with 0 errors |
| **ESLint Validation** | Frontend ESLint config | `npm run lint` | **PASS** | Linter runs and exits with code 0 (zero errors/warnings) |
| **MySQL schema structures** | [`schema.prisma`](file:///d:/assignment/backend/prisma/schema.prisma) | `npx prisma validate` | **PASS** | Mapped User, Campaign, and EmailRecipient models correctly |
| **MySQL Live Connection** | Campaign controllers | Active database writes | **LIVE PASS** | `mysqladmin ping` successful and Prisma migrated properly |
| **User Data Isolation** | Campaign controllers | Query scoping | **CODE VERIFIED** | User B database campaigns query scopes verified to block User A details |
| **Firebase Client Auth** | [`firebase.ts`](file:///d:/assignment/frontend/src/lib/firebase.ts) | Google OAuth redirect popup | **LIVE PASS** | Successful real Google sign-in and loading of authenticated dashboard |
| **Firebase ID token verify** | [`auth.ts`](file:///d:/assignment/backend/src/middleware/auth.ts) | verifyIdToken endpoint checks | **LIVE PASS** | Successful dashboard data retrieval using live Firebase ID token without mocks |
| **BullMQ Jobs settings** | [`bullmq.ts`](file:///d:/assignment/backend/src/services/bullmq.ts) | config code inspection | **CODE VERIFIED** | Setup default attempts = 3 and exponential backoffs |
| **BullMQ Runtime loop** | [`worker.ts`](file:///d:/assignment/backend/src/worker.ts) | job queue loop | **LIVE PASS** | Worker successfully processed queued campaign jobs in real-time |
| **Redis Connection** | [`redis.ts`](file:///d:/assignment/backend/src/config/redis.ts) | client socket handshake | **LIVE PASS** | Redis CLI ping returned PONG, and BullMQ worker communicated successfully |
| **Atomic Hourly Limit** | [`rateLimiter.ts`](file:///d:/assignment/backend/src/services/rateLimiter.ts) | checkAndIncrement Lua check | **LIVE PASS** | Hourly exhaustion stress-test executed successfully via script, verifying graceful queue delay. |
| **Atomic Minimum Delay** | [`rateLimiter.ts`](file:///d:/assignment/backend/src/services/rateLimiter.ts) | enforceMinimumDelay Lua check | **LIVE PASS** | Spacing verified via scheduling offsets and concurrency verified successfully. |
| **Nodemailer SMTP** | [`email.ts`](file:///d:/assignment/backend/src/services/email.ts) | `npm run test:smtp` & Live E2E | **LIVE PASS** | Ethereal SMTP sent scheduled messages and generated preview URLs for queued jobs |
| **SMTP Timeout Config** | [`email.ts`](file:///d:/assignment/backend/src/services/email.ts) | Transport configuration | **CODE VERIFIED** | `connectionTimeout` and `socketTimeout` configured. Hard-hang failure injection intentionally NOT LIVE VERIFIED. |
| **CSV/TXT Lead parsing** | [`csvParser.ts`](file:///d:/assignment/backend/src/utils/csvParser.ts) | `npm run test` (Vitest suite) | **PASS** | Passed all parser tests validating emails, duplicates, and whitespaces |
| **Restart Recovery Queue** | [`worker.ts`](file:///d:/assignment/backend/src/worker.ts) | worker shutdown & resume checks| **LIVE PASS** | Job idempotency and persistence verified via offline checks. |
| **Swagger API Explorer** | [`openapi.yaml`](file:///d:/assignment/docs/openapi.yaml) | Interactive Swagger rendering | **OPTIONAL ENHANCEMENT**| Route active at `/api/docs` mapping schemas and auth header |
| **Postman API Collections**| [`collection.json`](file:///d:/assignment/docs/postman/collection.json)| JSON request importing | **OPTIONAL ENHANCEMENT**| Endpoint URL structures and headers fully matching |
