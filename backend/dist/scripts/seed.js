"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database with testing data...');
    // Create mock user matching the offline developer token
    const user = await prisma.user.upsert({
        where: { firebaseUid: 'dummy-firebase-uid' },
        update: {},
        create: {
            firebaseUid: 'dummy-firebase-uid',
            email: 'devuser@example.com',
            name: 'Developer Evaluation User',
            picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=devuser'
        }
    });
    console.log(`User created/updated: ${user.email} (${user.id})`);
    // Create a past completed campaign
    const oldCampaign = await prisma.campaign.create({
        data: {
            userId: user.id,
            name: 'Past Promotion Campaign',
            subject: 'Great deals!',
            body: 'Check out our deals.',
            startTime: new Date(Date.now() - 24 * 60 * 60000), // yesterday
            minimumDelay: 1000,
            hourlyLimit: 200,
            status: 'COMPLETED'
        }
    });
    await prisma.emailRecipient.createMany({
        data: [
            {
                campaignId: oldCampaign.id,
                email: 'past.user1@example.com',
                status: 'SENT',
                scheduledTime: new Date(Date.now() - 24 * 60 * 60000),
                sentTime: new Date(Date.now() - 24 * 60 * 60000)
            },
            {
                campaignId: oldCampaign.id,
                email: 'past.user2@example.com',
                status: 'SENT',
                scheduledTime: new Date(Date.now() - 24 * 60 * 60000 + 1000),
                sentTime: new Date(Date.now() - 24 * 60 * 60000 + 1000)
            }
        ]
    });
    // Create a pending active campaign
    const activeCampaign = await prisma.campaign.create({
        data: {
            userId: user.id,
            name: 'Active Queue Campaign',
            subject: 'Pending deliveries',
            body: 'Active scheduling test.',
            startTime: new Date(Date.now() + 10 * 60000), // +10 minutes from now
            minimumDelay: 5000,
            hourlyLimit: 10,
            status: 'RUNNING'
        }
    });
    await prisma.emailRecipient.createMany({
        data: [
            {
                campaignId: activeCampaign.id,
                email: 'active.user1@example.com',
                status: 'QUEUED',
                scheduledTime: new Date(Date.now() + 10 * 60000)
            },
            {
                campaignId: activeCampaign.id,
                email: 'active.user2@example.com',
                status: 'QUEUED',
                scheduledTime: new Date(Date.now() + 10 * 60000 + 5000)
            },
            {
                campaignId: activeCampaign.id,
                email: 'active.user3@example.com',
                status: 'PENDING',
                scheduledTime: new Date(Date.now() + 10 * 60000 + 10000)
            }
        ]
    });
    console.log('Database successfully seeded! 🚀');
}
main()
    .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map