import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '../config/db';
import { checkAndCompleteCampaign, processEmailJob, handleFailedJob } from '../worker';
import { Job } from 'bullmq';
import { sendEmail } from '../services/email';
import { scheduleEmailJob } from '../services/bullmq';
import { redisConnection } from '../config/redis';
import { checkAndIncrementRateLimit, decrementRateLimit, enforceMinimumDelay } from '../services/rateLimiter';

// Mock dependencies
vi.mock('../config/db', () => ({
  prisma: {
    $transaction: vi.fn(async (cb) => cb(prisma)),
    emailRecipient: {
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    campaign: {
      updateMany: vi.fn(),
    },
    emailEvent: {
      create: vi.fn(),
    }
  }
}));

vi.mock('bullmq', async (importOriginal) => {
  const actual = await importOriginal<typeof import('bullmq')>();
  return {
    ...actual,
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn(),
    }))
  };
});

vi.mock('../services/email', () => ({
  sendEmail: vi.fn()
}));

vi.mock('../services/rateLimiter', () => ({
  checkAndIncrementRateLimit: vi.fn(),
  decrementRateLimit: vi.fn(),
  enforceMinimumDelay: vi.fn()
}));

vi.mock('../services/bullmq', () => ({
  QUEUE_NAME: 'test-queue',
  scheduleEmailJob: vi.fn()
}));

vi.mock('../config/env', () => ({
  env: {
    DEFAULT_EMAIL_DELAY_MS: '0',
    MAX_EMAILS_PER_HOUR: '100',
    WORKER_CONCURRENCY: '1'
  }
}));

vi.mock('../services/bullmq', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/bullmq')>();
  return {
    ...actual,
    scheduleEmailJob: vi.fn(),
    QUEUE_NAME: 'test-queue'
  };
});

vi.mock('../config/redis', () => ({
  redisConnection: {
    ttl: vi.fn()
  }
}));

describe('Campaign Lifecycle Robustness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkAndCompleteCampaign', () => {
    it('1. Final recipient becomes SENT → campaign becomes COMPLETED', async () => {
      (prisma.emailRecipient.count as any).mockResolvedValue(0);
      
      await checkAndCompleteCampaign('camp-1');
      
      expect(prisma.campaign.updateMany).toHaveBeenCalledWith({
        where: { id: 'camp-1', status: 'RUNNING' },
        data: { status: 'COMPLETED' }
      });
    });

    it('2. Pending recipients remain → campaign stays RUNNING', async () => {
      (prisma.emailRecipient.count as any).mockResolvedValue(1);
      
      await checkAndCompleteCampaign('camp-2');
      
      expect(prisma.campaign.updateMany).not.toHaveBeenCalled();
    });

    it('5. Multiple concurrent completion attempts → safely processed via Prisma conditions', async () => {
      (prisma.emailRecipient.count as any).mockResolvedValue(0);
      
      // Simulating concurrent calls
      await Promise.all([
        checkAndCompleteCampaign('camp-concurrent'),
        checkAndCompleteCampaign('camp-concurrent')
      ]);
      
      // Both will try to update with { status: 'RUNNING' } which is safe in SQL
      expect(prisma.campaign.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.campaign.updateMany).toHaveBeenCalledWith({
        where: { id: 'camp-concurrent', status: 'RUNNING' },
        data: { status: 'COMPLETED' }
      });
    });
  });

  describe('processEmailJob', () => {
    it('6. Recipient is already SENT, completion check previously failed → retry does not send SMTP again and reconciles', async () => {
      const mockJob = { id: 'job-1', data: { recipientId: 'rec-1', campaignId: 'camp-1', email: 'test@test.com' } } as Job;
      
      (prisma.emailRecipient.findUnique as any).mockResolvedValue({
        id: 'rec-1',
        campaignId: 'camp-1',
        status: 'SENT',
        campaign: { id: 'camp-1' }
      });
      (prisma.emailRecipient.count as any).mockResolvedValue(0);

      const result = await processEmailJob(mockJob);

      expect(result).toEqual({ success: true, skipped: true });
      expect(sendEmail).not.toHaveBeenCalled(); // SMTP NOT sent
      expect(prisma.campaign.updateMany).toHaveBeenCalled(); // Reconciliation occurred
    });

    it('Post-Send DB failure safely throws without decrementing rate limit', async () => {
      const mockJob = { id: 'job-2', data: { recipientId: 'rec-2', campaignId: 'camp-2', email: 'test@test.com' } } as Job;
      
      (prisma.emailRecipient.findUnique as any).mockResolvedValue({
        id: 'rec-2',
        campaignId: 'camp-2',
        status: 'QUEUED',
        campaign: { id: 'camp-2', minimumDelay: 0, hourlyLimit: 100 }
      });
      (checkAndIncrementRateLimit as any).mockResolvedValue(true);
      (enforceMinimumDelay as any).mockResolvedValue(0);
      
      (prisma.emailRecipient.updateMany as any).mockResolvedValue({ count: 1 });
      
      // SMTP succeeds
      (sendEmail as any).mockResolvedValue({ messageId: 'test-message-id' });
      
      // DB Update fails ONLY for the SENT status update
      (prisma.emailRecipient.update as any).mockImplementation(async (args: any) => {
        if (args.data.status === 'SENT') {
          throw new Error('Transient DB connection lost');
        }
        return {};
      });

      await expect(processEmailJob(mockJob)).rejects.toThrow('Transient DB connection lost');
      
      expect(sendEmail).toHaveBeenCalled();
      expect(decrementRateLimit).not.toHaveBeenCalled(); // Rate limit was correctly consumed
    });

    it('7. Hourly limit reached → job rescheduled and status set to QUEUED with error', async () => {
      const mockJob = { id: 'job-limit', data: { recipientId: 'rec-limit', campaignId: 'camp-limit', email: 'test@limit.com' } } as Job;
      
      (prisma.emailRecipient.findUnique as any).mockResolvedValue({
        id: 'rec-limit',
        campaignId: 'camp-limit',
        status: 'QUEUED',
        campaign: { id: 'camp-limit', minimumDelay: 0, hourlyLimit: 100 }
      });
      (prisma.emailRecipient.updateMany as any).mockResolvedValue({ count: 1 });
      
      // Simulate rate limit failure
      (checkAndIncrementRateLimit as any).mockResolvedValue(false);
      (redisConnection.ttl as any).mockResolvedValue(60);
      
      const result = await processEmailJob(mockJob);
      
      expect(result).toEqual({ success: false, reason: 'rate_limit', rescheduled: true });
      
      // Check that it rescheduled in BullMQ
      expect(scheduleEmailJob).toHaveBeenCalledWith(
        expect.stringContaining('job-limit-rescheduled-'),
        mockJob.data,
        expect.any(Number)
      );
      
      // Check that DB was updated back to QUEUED
      expect(prisma.emailRecipient.update).toHaveBeenCalledWith({
        where: { id: 'rec-limit' },
        data: { status: 'QUEUED', error: 'Rate limit hit, rescheduled.', dispatchStartedAt: null }
      });
      
      // SMTP should never be called
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('handleFailedJob', () => {
    it('3. Temporary worker failure before final attempt → recipient is not marked FAILED and campaign does not complete', async () => {
      const mockJob = { id: 'job-3', attemptsMade: 1, opts: { attempts: 3 }, data: { recipientId: 'rec-3' } } as unknown as Job;
      const err = new Error('SMTP timeout');
      
      await handleFailedJob(mockJob, err);
      
      expect(prisma.emailRecipient.update).not.toHaveBeenCalled();
      expect(prisma.emailRecipient.count).not.toHaveBeenCalled();
    });

    it('4. Final BullMQ failure → recipient reaches FAILED and campaign is reconciled', async () => {
      const mockJob = { id: 'job-4', attemptsMade: 3, opts: { attempts: 3 }, data: { recipientId: 'rec-4' } } as unknown as Job;
      const err = new Error('SMTP permanently down');
      
      (prisma.emailRecipient.findUnique as any).mockResolvedValue({
        id: 'rec-4',
        campaignId: 'camp-failed'
      });
      (prisma.emailRecipient.count as any).mockResolvedValue(0);
      
      await handleFailedJob(mockJob, err);
      
      expect(prisma.emailRecipient.update).toHaveBeenCalledWith({
        where: { id: 'rec-4' },
        data: { status: 'FAILED', error: err.message, dispatchStartedAt: null }
      });
      
      expect(prisma.campaign.updateMany).toHaveBeenCalledWith({
        where: { id: 'camp-failed', status: 'RUNNING' },
        data: { status: 'COMPLETED' }
      });
    });
  });
});
