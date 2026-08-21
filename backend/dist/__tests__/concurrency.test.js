"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const worker_1 = require("../worker");
const db_1 = require("../config/db");
const email_1 = require("../services/email");
// Mock Dependencies
vitest_1.vi.mock('../config/db', () => ({
    prisma: {
        emailRecipient: {
            updateMany: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            findUnique: vitest_1.vi.fn().mockResolvedValue({
                id: 'race-rec',
                campaignId: 'c1',
                status: 'PENDING',
                email: 'test@race.com',
                campaign: { id: 'c1', userId: 'u1' }
            })
        },
        emailEvent: {
            create: vitest_1.vi.fn(),
        },
        campaign: {
            updateMany: vitest_1.vi.fn()
        },
        $transaction: vitest_1.vi.fn().mockImplementation(async (callback) => {
            // Execute the callback with the mocked prisma client
            return callback({
                emailRecipient: { count: vitest_1.vi.fn().mockResolvedValue(0) },
                campaign: {
                    update: vitest_1.vi.fn().mockResolvedValue({}),
                    updateMany: vitest_1.vi.fn().mockResolvedValue({ count: 1 })
                }
            });
        })
    }
}));
vitest_1.vi.mock('../services/email', () => ({
    sendEmail: vitest_1.vi.fn().mockResolvedValue({ messageId: 'mock-id' })
}));
vitest_1.vi.mock('../services/rateLimiter', () => ({
    checkAndIncrementRateLimit: vitest_1.vi.fn().mockResolvedValue(true),
    enforceMinimumDelay: vitest_1.vi.fn().mockResolvedValue(0),
    decrementRateLimit: vitest_1.vi.fn()
}));
vitest_1.vi.mock('../services/bullmq', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        scheduleEmailJob: vitest_1.vi.fn(),
        QUEUE_NAME: 'test-queue'
    };
});
(0, vitest_1.describe)('Concurrency & Atomic Claim Tests', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.describe)('Race Test / Concurrent Execution', () => {
        (0, vitest_1.it)('should allow ONLY one worker to successfully claim and process the same recipient', async () => {
            const mockJob = { id: 'race-job', data: { recipientId: 'race-rec', campaignId: 'c1', email: 'test@race.com' } };
            // Simulate a concurrent environment where the first call to updateMany succeeds (claims 1 row),
            // and subsequent concurrent calls fail (claims 0 rows because it is now DISPATCHING).
            let claimCount = 0;
            db_1.prisma.emailRecipient.updateMany.mockImplementation(async (args) => {
                if (args.where.status.in.includes('PENDING')) {
                    if (claimCount === 0) {
                        claimCount++;
                        return { count: 1 };
                    }
                    return { count: 0 };
                }
                return { count: 0 };
            });
            // Launch 5 "workers" simultaneously
            const results = await Promise.all([
                (0, worker_1.processEmailJob)(mockJob),
                (0, worker_1.processEmailJob)(mockJob),
                (0, worker_1.processEmailJob)(mockJob),
                (0, worker_1.processEmailJob)(mockJob),
                (0, worker_1.processEmailJob)(mockJob)
            ]);
            // Only 1 should succeed
            const successes = results.filter(r => r.success && !r.skipped);
            const unclaimables = results.filter(r => !r.success && r.reason === 'unclaimable');
            (0, vitest_1.expect)(successes.length).toBe(1);
            (0, vitest_1.expect)(unclaimables.length).toBe(4);
            // SMTP should have been called EXACTLY once, eliminating duplicate-sends
            (0, vitest_1.expect)(email_1.sendEmail).toHaveBeenCalledTimes(1);
        });
    });
    (0, vitest_1.describe)('Stale Recovery Test', () => {
        (0, vitest_1.it)('should successfully recover a DISPATCHING recipient whose lease has expired', async () => {
            db_1.prisma.emailRecipient.updateMany.mockResolvedValue({ count: 1 });
            const recoveredCount = await (0, worker_1.recoverStaleDispatches)(600000); // 10 minutes
            (0, vitest_1.expect)(recoveredCount).toBe(1);
            const updateManyArgs = db_1.prisma.emailRecipient.updateMany.mock.calls[0][0];
            (0, vitest_1.expect)(updateManyArgs.where.status).toBe('DISPATCHING');
            (0, vitest_1.expect)(updateManyArgs.where.dispatchStartedAt.lt).toBeInstanceOf(Date);
            (0, vitest_1.expect)(updateManyArgs.data.status).toBe('QUEUED');
            (0, vitest_1.expect)(updateManyArgs.data.dispatchStartedAt).toBeNull();
        });
    });
});
//# sourceMappingURL=concurrency.test.js.map