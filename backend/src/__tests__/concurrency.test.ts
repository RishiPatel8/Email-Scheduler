import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processEmailJob, recoverStaleDispatches } from '../worker';
import { prisma } from '../config/db';
import { Job } from 'bullmq';
import { sendEmail } from '../services/email';
import { checkAndIncrementRateLimit, enforceMinimumDelay } from '../services/rateLimiter';

// Mock Dependencies
vi.mock('../config/db', () => ({
  prisma: {
    emailRecipient: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({
        id: 'race-rec',
        campaignId: 'c1',
        status: 'PENDING',
        email: 'test@race.com',
        campaign: { id: 'c1', userId: 'u1' }
      })
    },
    emailEvent: {
      create: vi.fn(),
    },
    campaign: {
      updateMany: vi.fn()
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      // Execute the callback with the mocked prisma client
      return callback({
        emailRecipient: { count: vi.fn().mockResolvedValue(0) },
        campaign: { 
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        }
      });
    })
  }
}));

vi.mock('../services/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'mock-id' })
}));

vi.mock('../services/rateLimiter', () => ({
  checkAndIncrementRateLimit: vi.fn().mockResolvedValue(true),
  enforceMinimumDelay: vi.fn().mockResolvedValue(0),
  decrementRateLimit: vi.fn()
}));

vi.mock('../services/bullmq', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/bullmq')>();
  return {
    ...actual,
    scheduleEmailJob: vi.fn(),
    QUEUE_NAME: 'test-queue'
  };
});

describe('Concurrency & Atomic Claim Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Race Test / Concurrent Execution', () => {
    it('should allow ONLY one worker to successfully claim and process the same recipient', async () => {
      const mockJob = { id: 'race-job', data: { recipientId: 'race-rec', campaignId: 'c1', email: 'test@race.com' } } as Job;

      // Simulate a concurrent environment where the first call to updateMany succeeds (claims 1 row),
      // and subsequent concurrent calls fail (claims 0 rows because it is now DISPATCHING).
      let claimCount = 0;
      (prisma.emailRecipient.updateMany as any).mockImplementation(async (args: any) => {
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
        processEmailJob(mockJob),
        processEmailJob(mockJob),
        processEmailJob(mockJob),
        processEmailJob(mockJob),
        processEmailJob(mockJob)
      ]);

      // Only 1 should succeed
      const successes = results.filter(r => r.success && !r.skipped);
      const unclaimables = results.filter(r => !r.success && (r as any).reason === 'unclaimable');

      expect(successes.length).toBe(1);
      expect(unclaimables.length).toBe(4);
      
      // SMTP should have been called EXACTLY once, eliminating duplicate-sends
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Stale Recovery Test', () => {
    it('should successfully recover a DISPATCHING recipient whose lease has expired', async () => {
      (prisma.emailRecipient.updateMany as any).mockResolvedValue({ count: 1 });

      const recoveredCount = await recoverStaleDispatches(600000); // 10 minutes
      
      expect(recoveredCount).toBe(1);
      
      const updateManyArgs = (prisma.emailRecipient.updateMany as any).mock.calls[0][0];
      expect(updateManyArgs.where.status).toBe('DISPATCHING');
      expect(updateManyArgs.where.dispatchStartedAt.lt).toBeInstanceOf(Date);
      expect(updateManyArgs.data.status).toBe('QUEUED');
      expect(updateManyArgs.data.dispatchStartedAt).toBeNull();
    });
  });
});
