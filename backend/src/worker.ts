import { Worker, Job } from 'bullmq';
import { env } from './config/env';
import { redisConnection } from './config/redis';
import { logger } from './utils/logger';
import { prisma } from './config/db';
import { checkAndIncrementRateLimit, decrementRateLimit, enforceMinimumDelay } from './services/rateLimiter';
import { sendEmail } from './services/email';
import { QUEUE_NAME, scheduleEmailJob } from './services/bullmq';

logger.info(`Starting BullMQ worker for queue: ${QUEUE_NAME}`);
logger.info(`Concurrency: ${env.WORKER_CONCURRENCY}`);

export const checkAndCompleteCampaign = async (campaignId: string) => {
  try {
    await prisma.$transaction(async (tx) => {
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
  } catch (err) {
    logger.error(`Failed to check/complete campaign ${campaignId}:`, err);
    throw err;
  }
};

export const processEmailJob = async (job: Job) => {
  logger.info(`Processing job ${job.id}`);
  
  const { recipientId, campaignId, email } = job.data;
  
  // 1. Idempotency Check
  const recipient = await prisma.emailRecipient.findUnique({
    where: { id: recipientId },
    include: { campaign: true }
  });
  
  if (!recipient) {
    logger.error(`Recipient not found: ${recipientId}`);
    throw new Error(`Recipient not found: ${recipientId}`);
  }
  
  if (recipient.status === 'SENT') {
    logger.info(`Recipient ${recipientId} already SENT. Reconciling campaign completion and skipping.`);
    await checkAndCompleteCampaign(recipient.campaignId);
    return { success: true, skipped: true };
  }

  // Atomic Claim: Mark as DISPATCHING to exclusively own this recipient
  const claimResult = await prisma.emailRecipient.updateMany({
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
    logger.warn(`Job ${job.id} could not claim recipient ${recipientId}. It may already be processed.`);
    return { success: false, reason: 'unclaimable' };
  }

  await prisma.emailEvent.create({
    data: {
      emailRecipientId: recipientId,
      status: 'DISPATCHING',
      notes: 'Attempting to send email'
    }
  });

  // Resolve campaign configurations with safe defaults
  const minDelay = recipient.campaign.minimumDelay ?? parseInt(env.DEFAULT_EMAIL_DELAY_MS, 10);
  const maxLimit = recipient.campaign.hourlyLimit ?? parseInt(env.MAX_EMAILS_PER_HOUR, 10);

  let smtpMessageId = '';
  try {
    // 2. Hourly Rate Limit Check (Atomic Lua-backed)
    const canSend = await checkAndIncrementRateLimit(maxLimit, campaignId);
    if (!canSend) {
      logger.warn(`Hourly rate limit reached for job ${job.id}. Rescheduling.`);
      
      const ttl = await redisConnection.ttl(`hourly_email_limit:${campaignId}`);
      const delayMs = (ttl > 0 ? ttl : 60) * 1000;
      
      // Reschedule job using a unique incremented key signature
      await scheduleEmailJob(`${job.id}-rescheduled-${Date.now()}`, job.data, delayMs);
      
      // Mark as queued again in DB
      await prisma.emailRecipient.update({
        where: { id: recipientId },
        data: { status: 'QUEUED', error: 'Rate limit hit, rescheduled.', dispatchStartedAt: null }
      });

      return { success: false, reason: 'rate_limit', rescheduled: true };
    }

    // 3. Minimum Delay Enforcement (Atomic Lua-backed)
    const waitTime = await enforceMinimumDelay(minDelay, campaignId);
    if (waitTime > 0) {
      logger.info(`Enforcing minimum delay of ${waitTime}ms for job ${job.id}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // 4. Send Email
    try {
      const info = await sendEmail(email, recipient.campaign.subject, recipient.campaign.body);
      if (info && info.messageId) {
        smtpMessageId = info.messageId;
      }
    } catch (err: any) {
      logger.error(`Failed to send email to ${email}: ${err.message}`);
      await decrementRateLimit(campaignId);
      throw err; 
    }
  } catch (processingError: any) {
    // Revert claim on transient error so BullMQ can retry
    await prisma.emailRecipient.update({
      where: { id: recipientId },
      data: { status: 'QUEUED', dispatchStartedAt: null }
    });
    throw processingError;
  }
  
  // 5. Update Status Post-Send
  // If these operations fail, BullMQ will retry, hit the SENT idempotency check above, and safely retry completion.
  await prisma.emailRecipient.update({
    where: { id: recipientId },
    data: { status: 'SENT', sentTime: new Date() }
  });

  await prisma.emailEvent.create({
    data: {
      emailRecipientId: recipientId,
      status: 'SENT',
      notes: smtpMessageId ? `Email sent successfully. SMTP ID: ${smtpMessageId}` : 'Email sent successfully'
    }
  });

  logger.info(`Finished job ${job.id} for ${email}`);
  
  // 6. Check if Campaign is completely finished
  await checkAndCompleteCampaign(recipient.campaign.id);

  return { success: true, email };
};

export const handleFailedJob = async (job: Job | undefined, err: Error) => {
  logger.error(`Job ${job?.id} has failed with ${err.message}`);
  
  if (job && job.attemptsMade >= job.opts.attempts!) {
    logger.error(`Job ${job.id} has permanently failed after ${job.attemptsMade} attempts.`);
    try {
      const { recipientId } = job.data;
      await prisma.emailRecipient.update({
        where: { id: recipientId },
        data: { status: 'FAILED', error: err.message, dispatchStartedAt: null }
      });
      await prisma.emailEvent.create({
        data: {
          emailRecipientId: recipientId,
          status: 'FAILED',
          notes: `Failed after ${job.attemptsMade} attempts: ${err.message}`
        }
      });
      
      const recipient = await prisma.emailRecipient.findUnique({
        where: { id: recipientId },
        select: { campaignId: true }
      });
      if (recipient) {
        await checkAndCompleteCampaign(recipient.campaignId);
      }
    } catch (dbErr) {
      logger.error(`Failed to update job ${job.id} to FAILED status:`, dbErr);
    }
  }
};

/**
 * Safely recovers records stuck in DISPATCHING state.
 * Expected to be run periodically or on worker startup.
 */
export const recoverStaleDispatches = async (thresholdMs = 10 * 60 * 1000) => {
  const staleThreshold = new Date(Date.now() - thresholdMs);
  
  try {
    const result = await prisma.emailRecipient.updateMany({
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
      logger.info(`Recovered ${result.count} stale DISPATCHING recipients back to QUEUED.`);
    }
    return result.count;
  } catch (err) {
    logger.error('Failed to recover stale dispatches:', err);
    return 0;
  }
};

const worker = new Worker(
  QUEUE_NAME,
  processEmailJob,
  {
    connection: redisConnection,
    concurrency: parseInt(env.WORKER_CONCURRENCY, 10),
  }
);

worker.on('failed', handleFailedJob);

// Recover any stale dispatches on startup
recoverStaleDispatches().catch(err => logger.error('Startup recovery failed:', err));

process.on('SIGINT', async () => {
  logger.info('Shutting down worker...');
  await worker.close();
  process.exit(0);
});
