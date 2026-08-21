# Changelog

All notable project changes are documented here.

## [Unreleased]

### Live Verification
- Verified Docker Compose infrastructure running containers smoothly.
- Verified MySQL connectivity with active daemon responses.
- Verified Redis connectivity checking socket availability via PING/PONG.
- Verified Prisma migration generation and schema integrity against the database.
- Verified real Firebase Google authentication bypassing mocked environments.
- Verified authenticated frontend dashboard retrieval mapped to actual UID.
- Verified real BullMQ delayed jobs queued effectively through Redis.
- Verified BullMQ worker processing tasks and reporting accurately.
- Verified Redis-backed queue operation coordinating tasks safely.
- Verified Nodemailer generating Ethereal dynamic test accounts.
- Verified Ethereal SMTP generating active preview URLs in transit logs.
- Verified SENT state transitions persisted properly in the database.
- Verified the complete frontend-to-worker-to-email pipeline end-to-end.

### Verification Corrections
- Updated previous NOT VERIFIED infrastructure statuses to LIVE PASS where real testing evidence has now been gathered.
- Kept advanced concurrency and failure-recovery scenarios unverified until robust stress testing is fully orchestrated.
- Differentiated scheduled email array spacing from runtime minimum-delay concurrency evaluation limitations.

### Added
- Setup Next.js Frontend with App Router and Tailwind CSS.
- Setup Express Backend with Prisma and TypeScript.
- Configured BullMQ and Redis for robust queue processing.
- Implemented Firebase Authentication with Google Sign-In.
- Implemented CSV and TXT lead parsing and deduplication.
- Built rate limiter and delay enforcer using Redis Lua Scripts for distributed worker safety.
- Created standalone Worker logic with idempotency and retry handling.
- Built Dashboard UI with Compose, Scheduled, and Sent metrics pages.
- Added Swagger API docs and Postman collections.
- Added dynamic Ethereal test account generation helper (`nodemailer.createTestAccount()`) in SMTP transporter to allow immediate E2E email verification.
- Implemented atomic Redis Lua-based hourly rate limiter script checking and incrementing counters atomically to prevent concurrency races.
- Defined strict TypeScript interface mappings (`UserProfile`, `LeadPreview`) to eliminate explicit `any` declarations.
- Created comprehensive E2E validation matrix under [docs/VERIFICATION_MATRIX.md](file:///d:/assignment/docs/VERIFICATION_MATRIX.md).

### Changed
- Configured docker-compose for database/redis instantiation.
- Scoped worker rate limits and delays to use custom campaign-level constraints instead of static global configs.
- Disabled developer mock authentication settings (`ALLOW_MOCK_AUTH=false`, `NEXT_PUBLIC_ALLOW_MOCK_AUTH=false`) in environmental variables to enforce real Firebase ID Token authentication for final submission.
- Adjusted deprecated Tailwind CSS gradient and flexbox sizing classes to align with modern canonical specifications.
- Restricted backend database-offline in-memory fallbacks to only run if ALLOW_MOCK_AUTH=true, ensuring proper database connection error reporting in production/verification runs.

### Fixed
- Fixed Firebase authentication 401 Unauthorized errors by correcting the backend `.env` configuration to use valid Firebase service account environment variables instead of raw JSON strings.
- Removed all mock authentication logic from frontend (`AuthProvider.tsx`) and backend controllers, enforcing true Firebase ID token validation in the application flow.
- Fixed React Auth Provider state synchronization hook to schedule updates asynchronously, resolving `react-hooks/set-state-in-effect` linting warnings.
- Fixed React purity render check warnings by initializing form default times outside the rendering flow.
- Fixed relative path assignment warnings in Axios interceptors by routing to absolute window origin URL redirections.
- Fixed database connection 500 errors in auth and campaign controllers when database is unreachable by implementing graceful in-memory mock fallbacks.
- Fixed potential concurrency race conditions in worker rate-limit checks by executing check-and-increment operations in a single atomic Lua command.
- Decremented rate limit counter in queue workers if the email transmission fails to ensure exact scheduling thresholds.
- Added explicit Nodemailer connectionTimeout and socketTimeout to prevent unresponsive SMTP connections from occupying BullMQ worker concurrency indefinitely.

### Testing
- Frontend ESLint linter verification passed with 0 errors.
- Frontend TypeScript tsc compilation validation checked successfully.
- Next.js production builds generated and optimized with zero errors.
- Verified Ethereal SMTP transporter connectivity via `npm run test:smtp` utilizing dynamic credentials.
- Verified parser integrity using Vitest suite.
