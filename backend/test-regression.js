"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./src/config/db");
const bullmq_1 = require("./src/services/bullmq");
async function runTest() {
    console.log('--- STARTING CONTROLLED TEST ---');
    let user = await db_1.prisma.user.findFirst();
    if (!user) {
        user = await db_1.prisma.user.create({ data: { firebaseUid: 'test-uid', email: 'test@example.com', name: 'Test User' } });
    }
    // 1. Normal Test
    const campaign1 = await db_1.prisma.campaign.create({
        data: {
            userId: user.id,
            name: 'Normal Test Campaign',
            subject: 'Test Subject',
            body: 'Test Body',
            startTime: new Date(),
            minimumDelay: 1000,
            hourlyLimit: 100,
            status: 'RUNNING'
        }
    });
    const recipient1 = await db_1.prisma.emailRecipient.create({
        data: {
            campaignId: campaign1.id,
            email: 'success-test@example.com',
            status: 'QUEUED',
            scheduledTime: new Date()
        }
    });
    await (0, bullmq_1.scheduleEmailJob)(`job-${campaign1.id}-${recipient1.id}`, { recipientId: recipient1.id, campaignId: campaign1.id, email: recipient1.email }, 0);
    console.log('Queued Normal Test Job');
    // 2. Rate-Limit Test
    const campaign2 = await db_1.prisma.campaign.create({
        data: {
            userId: user.id,
            name: 'Rate Limit Test Campaign',
            subject: 'Test Subject',
            body: 'Test Body',
            startTime: new Date(),
            minimumDelay: 1000,
            hourlyLimit: 1, // very low limit
            status: 'RUNNING'
        }
    });
    const recipient2 = await db_1.prisma.emailRecipient.create({
        data: { campaignId: campaign2.id, email: 'rl1@example.com', status: 'QUEUED', scheduledTime: new Date() }
    });
    const recipient3 = await db_1.prisma.emailRecipient.create({
        data: { campaignId: campaign2.id, email: 'rl2@example.com', status: 'QUEUED', scheduledTime: new Date() }
    });
    await (0, bullmq_1.scheduleEmailJob)(`job-${campaign2.id}-${recipient2.id}`, { recipientId: recipient2.id, campaignId: campaign2.id, email: recipient2.email }, 0);
    await (0, bullmq_1.scheduleEmailJob)(`job-${campaign2.id}-${recipient3.id}`, { recipientId: recipient3.id, campaignId: campaign2.id, email: recipient3.email }, 0);
    console.log('Queued Rate Limit Test Jobs');
    console.log('Tests dispatched to worker. Waiting 10 seconds for processing...');
    await new Promise(r => setTimeout(r, 10000));
}
runTest().catch(console.error).finally(() => process.exit(0));
//# sourceMappingURL=test-regression.js.map