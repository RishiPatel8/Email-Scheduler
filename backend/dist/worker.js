"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverStaleDispatches = exports.handleFailedJob = exports.processEmailJob = exports.checkAndCompleteCampaign = void 0;
const bullmq_1 = require("bullmq");
const env_1 = require("./config/env");
const redis_1 = require("./config/redis");
const logger_1 = require("./utils/logger");
const db_1 = require("./config/db");
const rateLimiter_1 = require("./services/rateLimiter");
const email_1 = require("./services/email");
const bullmq_2 = require("./services/bullmq");
logger_1.logger.info(`Starting BullMQ worker for queue: ${bullmq_2.QUEUE_NAME}`);
logger_1.logger.info(`Concurrency: ${env_1.env.WORKER_CONCURRENCY}`);
const checkAndCompleteCampaign = async (campaignId) => {
    try {
        await db_1.prisma.$transaction(async (tx) => {
            // Check for any remaining non-terminal recipients
            const pendingCount = await tx.emailRecipient.count({
                where: {
                    campaignId,
                    status: { in: ['PENDING', 'QUEUED', 'SENDING'] }
                }
            });
            if (pendingCount === 0) {
                // Move campaign from RUNNING to COMPLETED atomically
                await tx.campaign.updateMany({
                    where: { id: campaignId, status: 'RUNNING' },
                    data: { status: 'COMPLETED' }
                });
            }
        });
    }
    catch (err) {
        logger_1.logger.error(`Failed to check/complete campaign ${campaignId}:`, err);
        throw err;
    }
};
exports.checkAndCompleteCampaign = checkAndCompleteCampaign;
const processEmailJob = async (job) => {
    logger_1.logger.info(`Processing job ${job.id}`);
    const { recipientId, campaignId, email } = job.data;
    // 1. Idempotency Check
    const recipient = await db_1.prisma.emailRecipient.findUnique({
        where: { id: recipientId },
        include: { campaign: true }
    });
    if (!recipient) {
        logger_1.logger.error(`Recipient not found: ${recipientId}`);
        throw new Error(`Recipient not found: ${recipientId}`);
    }
    if (recipient.status === 'SENT') {
        logger_1.logger.info(`Recipient ${recipientId} already SENT. Reconciling campaign completion and skipping.`);
        await (0, exports.checkAndCompleteCampaign)(recipient.campaignId);
        return { success: true, skipped: true };
    }
    // Atomic Claim: Mark as DISPATCHING to exclusively own this recipient
    const claimResult = await db_1.prisma.emailRecipient.updateMany({
        where: {
            id: recipientId,
            status: { in: ['PENDING', 'QUEUED'] }
        },
        data: {
            status: 'DISPATCHING',
            dispatchStartedAt: new Date()
        }
    });
    if (claimResult.count === 0) {
        logger_1.logger.warn(`Job ${job.id} could not claim recipient ${recipientId}. It may already be processed.`);
        return { success: false, reason: 'unclaimable' };
    }
    await db_1.prisma.emailEvent.create({
        data: {
            emailRecipientId: recipientId,
            status: 'DISPATCHING',
            notes: 'Attempting to send email'
        }
    });
    // Resolve campaign configurations with safe defaults
    const minDelay = recipient.campaign.minimumDelay ?? parseInt(env_1.env.DEFAULT_EMAIL_DELAY_MS, 10);
    const maxLimit = recipient.campaign.hourlyLimit ?? parseInt(env_1.env.MAX_EMAILS_PER_HOUR, 10);
    // 2. Hourly Rate Limit Check (Atomic Lua-backed)
    const canSend = await (0, rateLimiter_1.checkAndIncrementRateLimit)(maxLimit);
    if (!canSend) {
        logger_1.logger.warn(`Hourly rate limit reached for job ${job.id}. Rescheduling.`);
        const ttl = await redis_1.redisConnection.ttl('hourly_email_limit');
        const delayMs = (ttl > 0 ? ttl : 60) * 1000;
        // Reschedule job using a unique incremented key signature
        await (0, bullmq_2.scheduleEmailJob)(`${job.id}-rescheduled-${Date.now()}`, job.data, delayMs);
        // Mark as queued again in DB
        await db_1.prisma.emailRecipient.update({
            where: { id: recipientId },
            data: { status: 'QUEUED', error: 'Rate limit hit, rescheduled.' }
        });
        return { success: false, reason: 'rate_limit', rescheduled: true };
    }
    // 3. Minimum Delay Enforcement (Atomic Lua-backed)
    const waitTime = await (0, rateLimiter_1.enforceMinimumDelay)(minDelay);
    if (waitTime > 0) {
        logger_1.logger.info(`Enforcing minimum delay of ${waitTime}ms for job ${job.id}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    // 4. Send Email
    let smtpMessageId = '';
    try {
        const info = await (0, email_1.sendEmail)(email, recipient.campaign.subject, recipient.campaign.body);
        if (info && info.messageId) {
            smtpMessageId = info.messageId;
        }
    }
    catch (err) {
        logger_1.logger.error(`Failed to send email to ${email}: ${err.message}`);
        // Decrement the rate limit counter ONLY if SMTP dispatch failed
        await (0, rateLimiter_1.decrementRateLimit)();
        // Throw to let BullMQ handle retry for transient failures
        throw err;
    }
    // 5. Update Status Post-Send
    // If these operations fail, BullMQ will retry, hit the SENT idempotency check above, and safely retry completion.
    await db_1.prisma.emailRecipient.update({
        where: { id: recipientId },
        data: { status: 'SENT', sentTime: new Date() }
    });
    await db_1.prisma.emailEvent.create({
        data: {
            emailRecipientId: recipientId,
            status: 'SENT',
            notes: smtpMessageId ? `Email sent successfully. SMTP ID: ${smtpMessageId}` : 'Email sent successfully'
        }
    });
    logger_1.logger.info(`Finished job ${job.id} for ${email}`);
    // 6. Check if Campaign is completely finished
    await (0, exports.checkAndCompleteCampaign)(recipient.campaign.id);
    return { success: true, email };
};
exports.processEmailJob = processEmailJob;
const handleFailedJob = async (job, err) => {
    logger_1.logger.error(`Job ${job?.id} has failed with ${err.message}`);
    if (job && job.attemptsMade >= job.opts.attempts) {
        logger_1.logger.error(`Job ${job.id} has permanently failed after ${job.attemptsMade} attempts.`);
        try {
            const { recipientId } = job.data;
            await db_1.prisma.emailRecipient.update({
                where: { id: recipientId },
                data: { status: 'FAILED', error: err.message, dispatchStartedAt: null }
            });
            await db_1.prisma.emailEvent.create({
                data: {
                    emailRecipientId: recipientId,
                    status: 'FAILED',
                    notes: `Failed after ${job.attemptsMade} attempts: ${err.message}`
                }
            });
            const recipient = await db_1.prisma.emailRecipient.findUnique({
                where: { id: recipientId },
                select: { campaignId: true }
            });
            if (recipient) {
                await (0, exports.checkAndCompleteCampaign)(recipient.campaignId);
            }
        }
        catch (dbErr) {
            logger_1.logger.error(`Failed to update job ${job.id} to FAILED status:`, dbErr);
        }
    }
};
exports.handleFailedJob = handleFailedJob;
/**
 * Safely recovers records stuck in DISPATCHING state.
 * Expected to be run periodically or on worker startup.
 */
const recoverStaleDispatches = async (thresholdMs = 10 * 60 * 1000) => {
    const staleThreshold = new Date(Date.now() - thresholdMs);
    try {
        const result = await db_1.prisma.emailRecipient.updateMany({
            where: {
                status: 'DISPATCHING',
                dispatchStartedAt: { lt: staleThreshold }
            },
            data: {
                status: 'QUEUED',
                dispatchStartedAt: null
            }
        });
        if (result.count > 0) {
            logger_1.logger.info(`Recovered ${result.count} stale DISPATCHING recipients back to QUEUED.`);
        }
        return result.count;
    }
    catch (err) {
        logger_1.logger.error('Failed to recover stale dispatches:', err);
        return 0;
    }
};
exports.recoverStaleDispatches = recoverStaleDispatches;
const worker = new bullmq_1.Worker(bullmq_2.QUEUE_NAME, exports.processEmailJob, {
    connection: redis_1.redisConnection,
    concurrency: parseInt(env_1.env.WORKER_CONCURRENCY, 10),
});
worker.on('failed', exports.handleFailedJob);
process.on('SIGINT', async () => {
    logger_1.logger.info('Shutting down worker...');
    await worker.close();
    process.exit(0);
});
//# sourceMappingURL=worker.js.map