"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = exports.getSentEmails = exports.getScheduledEmails = exports.createCampaign = exports.previewLeads = void 0;
const db_1 = require("../config/db");
const error_1 = require("../middleware/error");
const csvParser_1 = require("../utils/csvParser");
const bullmq_1 = require("../services/bullmq");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
const campaignSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Campaign name is required").max(100, "Campaign name must be under 100 characters"),
    subject: zod_1.z.string().min(1, "Subject is required").max(255, "Subject must be under 255 characters"),
    body: zod_1.z.string().min(1, "Body is required").max(10000, "Body must be under 10000 characters"),
    startTime: zod_1.z.string().datetime("Start time must be a valid ISO datetime string"),
    minimumDelay: zod_1.z.coerce.number().int().min(0, "Minimum delay must be at least 0").optional(),
    hourlyLimit: zod_1.z.coerce.number().int().positive("Hourly limit must be greater than 0").optional(),
    leads: zod_1.z.array(zod_1.z.string().email("Invalid email format")).min(1, "At least one lead is required").max(10000, "Cannot exceed 10000 leads per campaign")
});
const previewLeads = async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new error_1.AppError('No file uploaded', 400));
        }
        const isCsv = req.file.originalname.toLowerCase().endsWith('.csv');
        const result = (0, csvParser_1.parseLeads)(req.file.buffer, isCsv);
        res.json({
            status: 'success',
            data: result
        });
    }
    catch (err) {
        next(err);
    }
};
exports.previewLeads = previewLeads;
const createCampaign = async (req, res, next) => {
    try {
        const authReq = req;
        const userId = authReq.user.id;
        const validationResult = campaignSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                issues: validationResult.error.errors
            });
        }
        const { name, subject, body, startTime, minimumDelay, hourlyLimit, leads } = validationResult.data;
        let campaignId = `mock-campaign-${Date.now()}`;
        let recipientsScheduled = leads.length;
        try {
            // 1. Create Campaign
            const campaign = await db_1.prisma.campaign.create({
                data: {
                    userId,
                    name,
                    subject,
                    body,
                    startTime: new Date(startTime),
                    minimumDelay: minimumDelay ?? parseInt(env_1.env.DEFAULT_EMAIL_DELAY_MS, 10),
                    hourlyLimit: hourlyLimit ?? parseInt(env_1.env.MAX_EMAILS_PER_HOUR, 10),
                    status: 'RUNNING'
                }
            });
            campaignId = campaign.id;
            // 2. Add recipients to DB
            const recipientData = leads.map((email) => ({
                campaignId: campaign.id,
                email,
                status: 'PENDING',
                scheduledTime: new Date(startTime)
            }));
            await db_1.prisma.emailRecipient.createMany({
                data: recipientData,
                skipDuplicates: true
            });
            // Fetch the inserted recipients to get their IDs
            const recipients = await db_1.prisma.emailRecipient.findMany({
                where: { campaignId: campaign.id }
            });
            recipientsScheduled = recipients.length;
            // 3. Prepare Bulk Jobs
            const campaignStartTime = new Date(startTime).getTime();
            const delayStep = campaign.minimumDelay;
            const jobsToQueue = [];
            for (let i = 0; i < recipients.length; i++) {
                const recipient = recipients[i];
                const now = Date.now();
                // Target time for this specific email
                const targetTime = campaignStartTime + (i * delayStep);
                let jobDelay = targetTime - now;
                if (jobDelay < 0)
                    jobDelay = 0;
                // Push to array
                const jobId = `job-${campaign.id}-${recipient.id}`;
                jobsToQueue.push({
                    name: 'send-email',
                    data: { recipientId: recipient.id, campaignId: campaign.id, email: recipient.email },
                    opts: { jobId, delay: jobDelay }
                });
            }
            // 4. Update the DB to QUEUED with calculated times
            // We will perform a transaction to update all scheduledTimes if possible, 
            // but Prisma doesn't easily support bulk updating different values natively.
            // Since targetTimes are sequential, we'll update them iteratively.
            for (let i = 0; i < recipients.length; i++) {
                const targetTime = campaignStartTime + (i * delayStep);
                await db_1.prisma.emailRecipient.update({
                    where: { id: recipients[i].id },
                    data: {
                        scheduledTime: new Date(targetTime),
                        status: 'QUEUED'
                    }
                });
            }
            // 5. Schedule BullMQ Jobs in Bulk (Atomic pipeline insertion)
            try {
                await (0, bullmq_1.scheduleEmailJobsBulk)(jobsToQueue);
            }
            catch (queueErr) {
                logger_1.logger.error(`Campaign: Redis offline or bulk queue failure. Marking campaign ${campaign.id} as FAILED: ${queueErr.message}`);
                // Recover cleanly: 
                // 1. Mark campaign as FAILED
                // 2. Mark recipients as FAILED
                await db_1.prisma.campaign.update({
                    where: { id: campaign.id },
                    data: { status: 'FAILED' }
                });
                await db_1.prisma.emailRecipient.updateMany({
                    where: { campaignId: campaign.id },
                    data: { status: 'FAILED', error: 'Queue insertion failed: ' + queueErr.message }
                });
                throw new error_1.AppError('Failed to schedule campaign due to a queue server error.', 500);
            }
        }
        catch (dbError) {
            throw dbError;
        }
        res.status(201).json({
            status: 'success',
            data: {
                campaignId,
                recipientsScheduled
            }
        });
    }
    catch (err) {
        next(err);
    }
};
exports.createCampaign = createCampaign;
const getScheduledEmails = async (req, res, next) => {
    try {
        const authReq = req;
        const userId = authReq.user.id;
        let emails;
        try {
            emails = await db_1.prisma.emailRecipient.findMany({
                where: {
                    campaign: { userId },
                    status: { in: ['PENDING', 'QUEUED', 'SENDING'] }
                },
                include: {
                    campaign: { select: { name: true, subject: true } }
                },
                orderBy: { scheduledTime: 'asc' }
            });
        }
        catch (dbError) {
            throw dbError;
        }
        res.json({ status: 'success', data: emails });
    }
    catch (err) {
        next(err);
    }
};
exports.getScheduledEmails = getScheduledEmails;
const getSentEmails = async (req, res, next) => {
    try {
        const authReq = req;
        const userId = authReq.user.id;
        let emails;
        try {
            emails = await db_1.prisma.emailRecipient.findMany({
                where: {
                    campaign: { userId },
                    status: { in: ['SENT', 'FAILED'] }
                },
                include: {
                    campaign: { select: { name: true, subject: true } }
                },
                orderBy: { sentTime: 'desc' }
            });
        }
        catch (dbError) {
            throw dbError;
        }
        res.json({ status: 'success', data: emails });
    }
    catch (err) {
        next(err);
    }
};
exports.getSentEmails = getSentEmails;
const getDashboardStats = async (req, res, next) => {
    try {
        const authReq = req;
        const userId = authReq.user.id;
        let stats;
        try {
            const [scheduledCount, sentCount, failedCount, totalCampaigns, recentActivity] = await Promise.all([
                db_1.prisma.emailRecipient.count({ where: { campaign: { userId }, status: { in: ['PENDING', 'QUEUED', 'SENDING'] } } }),
                db_1.prisma.emailRecipient.count({ where: { campaign: { userId }, status: 'SENT' } }),
                db_1.prisma.emailRecipient.count({ where: { campaign: { userId }, status: 'FAILED' } }),
                db_1.prisma.campaign.count({ where: { userId } }),
                db_1.prisma.campaign.findMany({
                    where: { userId },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: {
                        _count: {
                            select: { emailRecipients: true }
                        }
                    }
                })
            ]);
            stats = { scheduledCount, sentCount, failedCount, totalCampaigns, recentActivity };
        }
        catch (dbError) {
            throw dbError;
        }
        res.json({
            status: 'success',
            data: stats
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getDashboardStats = getDashboardStats;
//# sourceMappingURL=campaign.js.map