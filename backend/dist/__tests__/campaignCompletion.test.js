"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const db_1 = require("../config/db");
const worker_1 = require("../worker");
const email_1 = require("../services/email");
const bullmq_1 = require("../services/bullmq");
const redis_1 = require("../config/redis");
const rateLimiter_1 = require("../services/rateLimiter");
// Mock dependencies
vitest_1.vi.mock('../config/db', () => ({
    prisma: {
        $transaction: vitest_1.vi.fn(async (cb) => cb(db_1.prisma)),
        emailRecipient: {
            count: vitest_1.vi.fn(),
            findUnique: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            updateMany: vitest_1.vi.fn(),
        },
        campaign: {
            updateMany: vitest_1.vi.fn(),
        },
        emailEvent: {
            create: vitest_1.vi.fn(),
        }
    }
}));
vitest_1.vi.mock('bullmq', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        Worker: vitest_1.vi.fn().mockImplementation(() => ({
            on: vitest_1.vi.fn(),
            close: vitest_1.vi.fn(),
        }))
    };
});
vitest_1.vi.mock('../services/email', () => ({
    sendEmail: vitest_1.vi.fn()
}));
vitest_1.vi.mock('../services/rateLimiter', () => ({
    checkAndIncrementRateLimit: vitest_1.vi.fn(),
    decrementRateLimit: vitest_1.vi.fn(),
    enforceMinimumDelay: vitest_1.vi.fn()
}));
vitest_1.vi.mock('../services/bullmq', () => ({
    QUEUE_NAME: 'test-queue',
    scheduleEmailJob: vitest_1.vi.fn()
}));
vitest_1.vi.mock('../config/env', () => ({
    env: {
        DEFAULT_EMAIL_DELAY_MS: '0',
        MAX_EMAILS_PER_HOUR: '100',
        WORKER_CONCURRENCY: '1'
    }
}));
vitest_1.vi.mock('../services/bullmq', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        scheduleEmailJob: vitest_1.vi.fn(),
        QUEUE_NAME: 'test-queue'
    };
});
vitest_1.vi.mock('../config/redis', () => ({
    redisConnection: {
        ttl: vitest_1.vi.fn()
    }
}));
(0, vitest_1.describe)('Campaign Lifecycle Robustness', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.describe)('checkAndCompleteCampaign', () => {
        (0, vitest_1.it)('1. Final recipient becomes SENT → campaign becomes COMPLETED', async () => {
            db_1.prisma.emailRecipient.count.mockResolvedValue(0);
            await (0, worker_1.checkAndCompleteCampaign)('camp-1');
            (0, vitest_1.expect)(db_1.prisma.campaign.updateMany).toHaveBeenCalledWith({
                where: { id: 'camp-1', status: 'RUNNING' },
                data: { status: 'COMPLETED' }
            });
        });
        (0, vitest_1.it)('2. Pending recipients remain → campaign stays RUNNING', async () => {
            db_1.prisma.emailRecipient.count.mockResolvedValue(1);
            await (0, worker_1.checkAndCompleteCampaign)('camp-2');
            (0, vitest_1.expect)(db_1.prisma.campaign.updateMany).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)('5. Multiple concurrent completion attempts → safely processed via Prisma conditions', async () => {
            db_1.prisma.emailRecipient.count.mockResolvedValue(0);
            // Simulating concurrent calls
            await Promise.all([
                (0, worker_1.checkAndCompleteCampaign)('camp-concurrent'),
                (0, worker_1.checkAndCompleteCampaign)('camp-concurrent')
            ]);
            // Both will try to update with { status: 'RUNNING' } which is safe in SQL
            (0, vitest_1.expect)(db_1.prisma.campaign.updateMany).toHaveBeenCalledTimes(2);
            (0, vitest_1.expect)(db_1.prisma.campaign.updateMany).toHaveBeenCalledWith({
                where: { id: 'camp-concurrent', status: 'RUNNING' },
                data: { status: 'COMPLETED' }
            });
        });
    });
    (0, vitest_1.describe)('processEmailJob', () => {
        (0, vitest_1.it)('6. Recipient is already SENT, completion check previously failed → retry does not send SMTP again and reconciles', async () => {
            const mockJob = { id: 'job-1', data: { recipientId: 'rec-1', campaignId: 'camp-1', email: 'test@test.com' } };
            db_1.prisma.emailRecipient.findUnique.mockResolvedValue({
                id: 'rec-1',
                campaignId: 'camp-1',
                status: 'SENT',
                campaign: { id: 'camp-1' }
            });
            db_1.prisma.emailRecipient.count.mockResolvedValue(0);
            const result = await (0, worker_1.processEmailJob)(mockJob);
            (0, vitest_1.expect)(result).toEqual({ success: true, skipped: true });
            (0, vitest_1.expect)(email_1.sendEmail).not.toHaveBeenCalled(); // SMTP NOT sent
            (0, vitest_1.expect)(db_1.prisma.campaign.updateMany).toHaveBeenCalled(); // Reconciliation occurred
        });
        (0, vitest_1.it)('Post-Send DB failure safely throws without decrementing rate limit', async () => {
            const mockJob = { id: 'job-2', data: { recipientId: 'rec-2', campaignId: 'camp-2', email: 'test@test.com' } };
            db_1.prisma.emailRecipient.findUnique.mockResolvedValue({
                id: 'rec-2',
                campaignId: 'camp-2',
                status: 'QUEUED',
                campaign: { id: 'camp-2', minimumDelay: 0, hourlyLimit: 100 }
            });
            rateLimiter_1.checkAndIncrementRateLimit.mockResolvedValue(true);
            rateLimiter_1.enforceMinimumDelay.mockResolvedValue(0);
            db_1.prisma.emailRecipient.updateMany.mockResolvedValue({ count: 1 });
            // SMTP succeeds
            email_1.sendEmail.mockResolvedValue({ messageId: 'test-message-id' });
            // DB Update fails ONLY for the SENT status update
            db_1.prisma.emailRecipient.update.mockImplementation(async (args) => {
                if (args.data.status === 'SENT') {
                    throw new Error('Transient DB connection lost');
                }
                return {};
            });
            await (0, vitest_1.expect)((0, worker_1.processEmailJob)(mockJob)).rejects.toThrow('Transient DB connection lost');
            (0, vitest_1.expect)(email_1.sendEmail).toHaveBeenCalled();
            (0, vitest_1.expect)(rateLimiter_1.decrementRateLimit).not.toHaveBeenCalled(); // Rate limit was correctly consumed
        });
        (0, vitest_1.it)('7. Hourly limit reached → job rescheduled and status set to QUEUED with error', async () => {
            const mockJob = { id: 'job-limit', data: { recipientId: 'rec-limit', campaignId: 'camp-limit', email: 'test@limit.com' } };
            db_1.prisma.emailRecipient.findUnique.mockResolvedValue({
                id: 'rec-limit',
                campaignId: 'camp-limit',
                status: 'QUEUED',
                campaign: { id: 'camp-limit', minimumDelay: 0, hourlyLimit: 100 }
            });
            db_1.prisma.emailRecipient.updateMany.mockResolvedValue({ count: 1 });
            // Simulate rate limit failure
            rateLimiter_1.checkAndIncrementRateLimit.mockResolvedValue(false);
            redis_1.redisConnection.ttl.mockResolvedValue(60);
            const result = await (0, worker_1.processEmailJob)(mockJob);
            (0, vitest_1.expect)(result).toEqual({ success: false, reason: 'rate_limit', rescheduled: true });
            // Check that it rescheduled in BullMQ
            (0, vitest_1.expect)(bullmq_1.scheduleEmailJob).toHaveBeenCalledWith(vitest_1.expect.stringContaining('job-limit-rescheduled-'), mockJob.data, vitest_1.expect.any(Number));
            // Check that DB was updated back to QUEUED
            (0, vitest_1.expect)(db_1.prisma.emailRecipient.update).toHaveBeenCalledWith({
                where: { id: 'rec-limit' },
                data: { status: 'QUEUED', error: 'Rate limit hit, rescheduled.', dispatchStartedAt: null }
            });
            // SMTP should never be called
            (0, vitest_1.expect)(email_1.sendEmail).not.toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)('handleFailedJob', () => {
        (0, vitest_1.it)('3. Temporary worker failure before final attempt → recipient is not marked FAILED and campaign does not complete', async () => {
            const mockJob = { id: 'job-3', attemptsMade: 1, opts: { attempts: 3 }, data: { recipientId: 'rec-3' } };
            const err = new Error('SMTP timeout');
            await (0, worker_1.handleFailedJob)(mockJob, err);
            (0, vitest_1.expect)(db_1.prisma.emailRecipient.update).not.toHaveBeenCalled();
            (0, vitest_1.expect)(db_1.prisma.emailRecipient.count).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)('4. Final BullMQ failure → recipient reaches FAILED and campaign is reconciled', async () => {
            const mockJob = { id: 'job-4', attemptsMade: 3, opts: { attempts: 3 }, data: { recipientId: 'rec-4' } };
            const err = new Error('SMTP permanently down');
            db_1.prisma.emailRecipient.findUnique.mockResolvedValue({
                id: 'rec-4',
                campaignId: 'camp-failed'
            });
            db_1.prisma.emailRecipient.count.mockResolvedValue(0);
            await (0, worker_1.handleFailedJob)(mockJob, err);
            (0, vitest_1.expect)(db_1.prisma.emailRecipient.update).toHaveBeenCalledWith({
                where: { id: 'rec-4' },
                data: { status: 'FAILED', error: err.message, dispatchStartedAt: null }
            });
            (0, vitest_1.expect)(db_1.prisma.campaign.updateMany).toHaveBeenCalledWith({
                where: { id: 'camp-failed', status: 'RUNNING' },
                data: { status: 'COMPLETED' }
            });
        });
    });
});
//# sourceMappingURL=campaignCompletion.test.js.map