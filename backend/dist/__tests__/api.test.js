"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const db_1 = require("../config/db");
const campaign_1 = require("../controllers/campaign");
const bullmq_1 = require("../services/bullmq");
const auth_1 = require("../middleware/auth");
// Mock Dependencies
vitest_1.vi.mock('../config/db', () => ({
    prisma: {
        campaign: {
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
        },
        emailRecipient: {
            createMany: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            updateMany: vitest_1.vi.fn(),
        }
    }
}));
vitest_1.vi.mock('../services/bullmq', () => ({
    scheduleEmailJobsBulk: vitest_1.vi.fn()
}));
vitest_1.vi.mock('../middleware/auth', () => ({
    requireAuth: vitest_1.vi.fn((req, res, next) => {
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
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.post('/api/campaigns', auth_1.requireAuth, campaign_1.createCampaign);
// Error handler middleware for Express test app
app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});
(0, vitest_1.describe)('API Route Protections & Validations', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.describe)('Authentication Tests', () => {
        (0, vitest_1.it)('should return 401 if no token is provided', async () => {
            const response = await (0, supertest_1.default)(app).post('/api/campaigns').send({});
            (0, vitest_1.expect)(response.status).toBe(401);
            (0, vitest_1.expect)(response.body.message).toBe('No token provided');
        });
        (0, vitest_1.it)('should return 401 if token is invalid', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/campaigns')
                .set('Authorization', 'Bearer invalid-token')
                .send({});
            (0, vitest_1.expect)(response.status).toBe(401);
            (0, vitest_1.expect)(response.body.message).toBe('Invalid token');
        });
        (0, vitest_1.it)('should proceed and hit validation errors if valid token is provided with empty body', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/campaigns')
                .set('Authorization', 'Bearer valid-token')
                .send({});
            // Zod validation should fail with 400
            (0, vitest_1.expect)(response.status).toBe(400);
            (0, vitest_1.expect)(response.body.message).toBe('Validation failed');
        });
    });
    (0, vitest_1.describe)('Campaign Queue Insertion Failure', () => {
        (0, vitest_1.it)('should recover gracefully and return 500 if Redis addBulk fails', async () => {
            const validPayload = {
                name: 'Test Campaign',
                subject: 'Subject',
                body: 'Body',
                startTime: new Date().toISOString(),
                minimumDelay: 1000,
                hourlyLimit: 100,
                leads: ['test@test.com']
            };
            db_1.prisma.campaign.create.mockResolvedValue({ id: 'camp-123' });
            db_1.prisma.emailRecipient.findMany.mockResolvedValue([{ id: 'rec-1', email: 'test@test.com' }]);
            // Simulate BullMQ bulk insert failure (e.g. Redis offline)
            bullmq_1.scheduleEmailJobsBulk.mockRejectedValue(new Error('Redis connection lost'));
            const response = await (0, supertest_1.default)(app)
                .post('/api/campaigns')
                .set('Authorization', 'Bearer valid-token')
                .send(validPayload);
            (0, vitest_1.expect)(response.status).toBe(500);
            (0, vitest_1.expect)(response.body.message).toContain('queue server error');
            // Verify that failure recovery was attempted
            (0, vitest_1.expect)(db_1.prisma.campaign.update).toHaveBeenCalledWith({
                where: { id: 'camp-123' },
                data: { status: 'FAILED' }
            });
            (0, vitest_1.expect)(db_1.prisma.emailRecipient.updateMany).toHaveBeenCalledWith({
                where: { campaignId: 'camp-123' },
                data: { status: 'FAILED', error: vitest_1.expect.stringContaining('Queue insertion failed') }
            });
        });
    });
});
//# sourceMappingURL=api.test.js.map