import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { prisma } from '../config/db';
import { createCampaign } from '../controllers/campaign';
import { scheduleEmailJobsBulk } from '../services/bullmq';
import { requireAuth } from '../middleware/auth';

// Mock Dependencies
vi.mock('../config/db', () => ({
  prisma: {
    campaign: {
      create: vi.fn(),
      update: vi.fn(),
    },
    emailRecipient: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    }
  }
}));

vi.mock('../services/bullmq', () => ({
  scheduleEmailJobsBulk: vi.fn()
}));

vi.mock('../middleware/auth', () => ({
  requireAuth: vi.fn((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    if (token === 'valid-token') {
      req.user = { id: 'user-123' };
      return next();
    }
    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  })
}));

const app = express();
app.use(express.json());
app.post('/api/campaigns', requireAuth, createCampaign);

// Error handler middleware for Express test app
app.use((err: any, req: any, res: any, next: any) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

describe('API Route Protections & Validations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication Tests', () => {
    it('should return 401 if no token is provided', async () => {
      const response = await request(app).post('/api/campaigns').send({});
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    });

    it('should return 401 if token is invalid', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', 'Bearer invalid-token')
        .send({});
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });

    it('should proceed and hit validation errors if valid token is provided with empty body', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', 'Bearer valid-token')
        .send({});
      // Zod validation should fail with 400
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('Campaign Queue Insertion Failure', () => {
    it('should recover gracefully and return 500 if Redis addBulk fails', async () => {
      const validPayload = {
        name: 'Test Campaign',
        subject: 'Subject',
        body: 'Body',
        startTime: new Date().toISOString(),
        minimumDelay: 1000,
        hourlyLimit: 100,
        leads: ['test@test.com']
      };

      (prisma.campaign.create as any).mockResolvedValue({ id: 'camp-123' });
      (prisma.emailRecipient.findMany as any).mockResolvedValue([{ id: 'rec-1', email: 'test@test.com' }]);
      
      // Simulate BullMQ bulk insert failure (e.g. Redis offline)
      (scheduleEmailJobsBulk as any).mockRejectedValue(new Error('Redis connection lost'));

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', 'Bearer valid-token')
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('queue server error');

      // Verify that failure recovery was attempted
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'camp-123' },
        data: { status: 'FAILED' }
      });
      expect(prisma.emailRecipient.updateMany).toHaveBeenCalledWith({
        where: { campaignId: 'camp-123' },
        data: { status: 'FAILED', error: expect.stringContaining('Queue insertion failed') }
      });
    });
  });
});
