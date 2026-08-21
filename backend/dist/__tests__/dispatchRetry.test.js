"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const db_1 = require("../config/db");
const worker_1 = require("../worker");
// Mock the dependencies
vitest_1.vi.mock('../services/email', () => ({
    sendEmail: vitest_1.vi.fn(),
}));
const email_1 = require("../services/email");
// Helper to create a fake job
const createFakeJob = (data) => {
    return {
        id: 'test-job-' + Date.now(),
        data,
        opts: { attempts: 3 },
        attemptsMade: 1,
        moveToDelayed: vitest_1.vi.fn(),
    };
};
(0, vitest_1.describe)('Dispatch Retry Regression & Stale Recovery Test', () => {
    let userId;
    (0, vitest_1.beforeAll)(async () => {
        // Clean up
        await db_1.prisma.emailEvent.deleteMany();
        await db_1.prisma.emailRecipient.deleteMany();
        await db_1.prisma.campaign.deleteMany();
        await db_1.prisma.user.deleteMany();
        const user = await db_1.prisma.user.create({
            data: {
                id: 'test-user-retry-1',
                email: 'retry-test@example.com',
                name: 'Retry Test User',
                firebaseUid: 'retry-firebase-1',
            },
        });
        userId = user.id;
    });
    (0, vitest_1.afterAll)(async () => {
        await db_1.prisma.emailEvent.deleteMany();
        await db_1.prisma.emailRecipient.deleteMany();
        await db_1.prisma.campaign.deleteMany();
        await db_1.prisma.user.deleteMany({ where: { id: 'test-user-retry-1' } });
    });
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('verifies DISPATCHING -> QUEUED -> BullMQ RETRY -> SENT sequence', async () => {
        // Setup
        const campaign = await db_1.prisma.campaign.create({
            data: {
                userId,
                name: 'Retry Test Campaign',
                subject: 'Retry Test',
                body: 'Testing',
                startTime: new Date(),
                status: 'RUNNING',
                minimumDelay: 0,
                hourlyLimit: 1000,
            },
        });
        const recipient = await db_1.prisma.emailRecipient.create({
            data: {
                campaignId: campaign.id,
                email: 'test-target@example.com',
                status: 'QUEUED',
                scheduledTime: new Date(),
            },
        });
        // 1. Initial status = QUEUED
        (0, vitest_1.expect)(recipient.status).toBe('QUEUED');
        const job = createFakeJob({
            recipientId: recipient.id,
            campaignId: campaign.id,
            email: 'test-target@example.com',
        });
        // First attempt: Mock SMTP to fail
        email_1.sendEmail.mockRejectedValueOnce(new Error('ETIMEDOUT'));
        // Execute first attempt
        let errorCaught = false;
        try {
            await (0, worker_1.processEmailJob)(job);
        }
        catch (e) {
            errorCaught = true;
            (0, vitest_1.expect)(e.message).toBe('ETIMEDOUT');
        }
        // 4. SMTP fails
        (0, vitest_1.expect)(errorCaught).toBe(true);
        (0, vitest_1.expect)(email_1.sendEmail).toHaveBeenCalledTimes(1);
        // Verify DB state after failure
        const afterFailure = await db_1.prisma.emailRecipient.findUnique({
            where: { id: recipient.id },
        });
        // 5. Status returns to QUEUED
        (0, vitest_1.expect)(afterFailure?.status).toBe('QUEUED');
        // 6. dispatchStartedAt is cleared
        (0, vitest_1.expect)(afterFailure?.dispatchStartedAt).toBeNull();
        // Second attempt (BullMQ retry simulation)
        // Mock SMTP to succeed this time
        email_1.sendEmail.mockResolvedValueOnce({ messageId: '<test-message-id>' });
        // Execute second attempt
        const result = await (0, worker_1.processEmailJob)(job);
        (0, vitest_1.expect)(result.success).toBe(true);
        (0, vitest_1.expect)(email_1.sendEmail).toHaveBeenCalledTimes(2);
        // Verify DB state after success
        const afterSuccess = await db_1.prisma.emailRecipient.findUnique({
            where: { id: recipient.id },
            include: { events: true },
        });
        // 10. Final status = SENT
        (0, vitest_1.expect)(afterSuccess?.status).toBe('SENT');
        // 11. sentTime exists
        (0, vitest_1.expect)(afterSuccess?.sentTime).not.toBeNull();
        // dispatchStartedAt should be cleared for clean state or preserved depending on design, but we assert sent
        // 13. Exactly one SEND event (and exactly one successful SMTP call, verified above)
        const sentEvents = afterSuccess?.events.filter((e) => e.status === 'SENT');
        (0, vitest_1.expect)(sentEvents?.length).toBe(1);
    });
    (0, vitest_1.it)('verifies stale DISPATCHING is recovered, but recent is NOT', async () => {
        const campaign = await db_1.prisma.campaign.create({
            data: {
                userId,
                name: 'Stale Recovery Campaign',
                subject: 'Stale Test',
                body: 'Testing',
                startTime: new Date(),
                status: 'RUNNING',
            },
        });
        // Stale recipient: older than 10 minutes
        const staleRecipient = await db_1.prisma.emailRecipient.create({
            data: {
                campaignId: campaign.id,
                email: 'stale@example.com',
                status: 'DISPATCHING',
                scheduledTime: new Date(),
                dispatchStartedAt: new Date(Date.now() - 11 * 60 * 1000), // 11 mins ago
            },
        });
        // Recent recipient: just dispatched 1 minute ago
        const recentRecipient = await db_1.prisma.emailRecipient.create({
            data: {
                campaignId: campaign.id,
                email: 'recent@example.com',
                status: 'DISPATCHING',
                scheduledTime: new Date(),
                dispatchStartedAt: new Date(Date.now() - 1 * 60 * 1000), // 1 min ago
            },
        });
        // Run recovery
        const recoveredCount = await (0, worker_1.recoverStaleDispatches)();
        (0, vitest_1.expect)(recoveredCount).toBe(1);
        // Verify stale became QUEUED
        const staleAfter = await db_1.prisma.emailRecipient.findUnique({
            where: { id: staleRecipient.id },
        });
        (0, vitest_1.expect)(staleAfter?.status).toBe('QUEUED');
        (0, vitest_1.expect)(staleAfter?.dispatchStartedAt).toBeNull();
        // Verify recent stayed DISPATCHING
        const recentAfter = await db_1.prisma.emailRecipient.findUnique({
            where: { id: recentRecipient.id },
        });
        (0, vitest_1.expect)(recentAfter?.status).toBe('DISPATCHING');
        (0, vitest_1.expect)(recentAfter?.dispatchStartedAt).not.toBeNull();
    });
    (0, vitest_1.it)('verifies concurrency claim race condition', async () => {
        const campaign = await db_1.prisma.campaign.create({
            data: {
                userId,
                name: 'Race Campaign',
                subject: 'Race Test',
                body: 'Testing',
                startTime: new Date(),
                status: 'RUNNING',
            },
        });
        const recipient = await db_1.prisma.emailRecipient.create({
            data: {
                campaignId: campaign.id,
                email: 'race@example.com',
                status: 'QUEUED',
                scheduledTime: new Date(),
            },
        });
        const job1 = createFakeJob({
            recipientId: recipient.id,
            campaignId: campaign.id,
            email: 'race@example.com',
        });
        const job2 = createFakeJob({
            recipientId: recipient.id,
            campaignId: campaign.id,
            email: 'race@example.com',
        });
        // We will simulate SMTP success, but add a slight delay in sendEmail mock to ensure both hit processEmailJob
        email_1.sendEmail.mockImplementation(async () => {
            return new Promise((resolve) => setTimeout(() => resolve({ messageId: 'race-msg' }), 50));
        });
        // Fire concurrently
        const [res1, res2] = await Promise.all([
            (0, worker_1.processEmailJob)(job1),
            (0, worker_1.processEmailJob)(job2),
        ]);
        // Exactly one should succeed, exactly one should return unclaimable
        const successCount = [res1, res2].filter((r) => r.success === true).length;
        const unclaimableCount = [res1, res2].filter((r) => r.success === false && r.reason === 'unclaimable').length;
        (0, vitest_1.expect)(successCount).toBe(1);
        (0, vitest_1.expect)(unclaimableCount).toBe(1);
        // Ensure SMTP was only called once
        (0, vitest_1.expect)(email_1.sendEmail).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=dispatchRetry.test.js.map