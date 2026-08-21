import { Queue, QueueEvents, Job } from 'bullmq';
import { env } from '../config/env';
import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';
import { prisma } from '../config/db';

export const QUEUE_NAME = 'email-jobs';

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const emailQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnection,
});

emailQueueEvents.on('completed', ({ jobId }) => {
  logger.info(`Job completed in queue: ${jobId}`);
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Job failed in queue: ${jobId}, reason: ${failedReason}`);
});

export const scheduleEmailJob = async (
  jobId: string, 
  data: { recipientId: string, campaignId: string, email: string },
  delay: number
) => {
  // Use a deterministic job ID for idempotency protection
  await emailQueue.add('send-email', data, {
    jobId, 
    delay
  });
};

export const scheduleEmailJobsBulk = async (
  jobs: { name: string, data: any, opts: any }[]
) => {
  await emailQueue.addBulk(jobs);
};
