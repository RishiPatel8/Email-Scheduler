import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import { prisma } from '../config/db';
import { processEmailJob, recoverStaleDispatches } from '../worker';
import { Job } from 'bullmq';

// Mock the dependencies
vi.mock('../services/email', () => ({
  sendEmail: vi.fn(),
}));

import { sendEmail } from '../services/email';

// Helper to create a fake job
const createFakeJob = (data: any): Job => {
  return {
    id: 'test-job-' + Date.now(),
    data,
    opts: { attempts: 3 },
    attemptsMade: 1,
    moveToDelayed: vi.fn(),
  } as unknown as Job;
};

describe('Dispatch Retry Regression & Stale Recovery Test', () => {
  let userId: string;

  beforeAll(async () => {
    // Clean up
    await prisma.emailEvent.deleteMany();
    await prisma.emailRecipient.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        id: 'test-user-retry-1',
        email: 'retry-test@example.com',
        name: 'Retry Test User',
        firebaseUid: 'retry-firebase-1',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.emailEvent.deleteMany();
    await prisma.emailRecipient.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.user.deleteMany({ where: { id: 'test-user-retry-1' } });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies DISPATCHING -> QUEUED -> BullMQ RETRY -> SENT sequence', async () => {
    // Setup
    const campaign = await prisma.campaign.create({
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

    const recipient = await prisma.emailRecipient.create({
      data: {
        campaignId: campaign.id,
        email: 'test-target@example.com',
        status: 'QUEUED',
        scheduledTime: new Date(),
      },
    });

    // 1. Initial status = QUEUED
    expect(recipient.status).toBe('QUEUED');

    const job = createFakeJob({
      recipientId: recipient.id,
      campaignId: campaign.id,
      email: 'test-target@example.com',
    });

    // First attempt: Mock SMTP to fail
    (sendEmail as any).mockRejectedValueOnce(new Error('ETIMEDOUT'));

    // Execute first attempt
    let errorCaught = false;
    try {
      await processEmailJob(job);
    } catch (e: any) {
      errorCaught = true;
      expect(e.message).toBe('ETIMEDOUT');
    }

    // 4. SMTP fails
    expect(errorCaught).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // Verify DB state after failure
    const afterFailure = await prisma.emailRecipient.findUnique({
      where: { id: recipient.id },
    });

    // 5. Status returns to QUEUED
    expect(afterFailure?.status).toBe('QUEUED');
    // 6. dispatchStartedAt is cleared
    expect(afterFailure?.dispatchStartedAt).toBeNull();

    // Second attempt (BullMQ retry simulation)
    // Mock SMTP to succeed this time
    (sendEmail as any).mockResolvedValueOnce({ messageId: '<test-message-id>' });

    // Execute second attempt
    const result = await processEmailJob(job);
    expect(result.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(2);

    // Verify DB state after success
    const afterSuccess = await prisma.emailRecipient.findUnique({
      where: { id: recipient.id },
      include: { events: true },
    });

    // 10. Final status = SENT
    expect(afterSuccess?.status).toBe('SENT');
    // 11. sentTime exists
    expect(afterSuccess?.sentTime).not.toBeNull();
    // dispatchStartedAt should be cleared for clean state or preserved depending on design, but we assert sent
    
    // 13. Exactly one SEND event (and exactly one successful SMTP call, verified above)
    const sentEvents = afterSuccess?.events.filter((e) => e.status === 'SENT');
    expect(sentEvents?.length).toBe(1);
  });

  it('verifies stale DISPATCHING is recovered, but recent is NOT', async () => {
    const campaign = await prisma.campaign.create({
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
    const staleRecipient = await prisma.emailRecipient.create({
      data: {
        campaignId: campaign.id,
        email: 'stale@example.com',
        status: 'DISPATCHING',
        scheduledTime: new Date(),
        dispatchStartedAt: new Date(Date.now() - 11 * 60 * 1000), // 11 mins ago
      },
    });

    // Recent recipient: just dispatched 1 minute ago
    const recentRecipient = await prisma.emailRecipient.create({
      data: {
        campaignId: campaign.id,
        email: 'recent@example.com',
        status: 'DISPATCHING',
        scheduledTime: new Date(),
        dispatchStartedAt: new Date(Date.now() - 1 * 60 * 1000), // 1 min ago
      },
    });

    // Run recovery
    const recoveredCount = await recoverStaleDispatches();
    expect(recoveredCount).toBe(1);

    // Verify stale became QUEUED
    const staleAfter = await prisma.emailRecipient.findUnique({
      where: { id: staleRecipient.id },
    });
    expect(staleAfter?.status).toBe('QUEUED');
    expect(staleAfter?.dispatchStartedAt).toBeNull();

    // Verify recent stayed DISPATCHING
    const recentAfter = await prisma.emailRecipient.findUnique({
      where: { id: recentRecipient.id },
    });
    expect(recentAfter?.status).toBe('DISPATCHING');
    expect(recentAfter?.dispatchStartedAt).not.toBeNull();
  });

  it('verifies concurrency claim race condition', async () => {
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        name: 'Race Campaign',
        subject: 'Race Test',
        body: 'Testing',
        startTime: new Date(),
        status: 'RUNNING',
      },
    });

    const recipient = await prisma.emailRecipient.create({
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
    (sendEmail as any).mockImplementation(async () => {
      return new Promise((resolve) => setTimeout(() => resolve({ messageId: 'race-msg' }), 50));
    });

    // Fire concurrently
    const [res1, res2] = await Promise.all([
      processEmailJob(job1),
      processEmailJob(job2),
    ]);

    // Exactly one should succeed, exactly one should return unclaimable
    const successCount = [res1, res2].filter((r) => r.success === true).length;
    const unclaimableCount = [res1, res2].filter((r) => r.success === false && r.reason === 'unclaimable').length;

    expect(successCount).toBe(1);
    expect(unclaimableCount).toBe(1);

    // Ensure SMTP was only called once
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
