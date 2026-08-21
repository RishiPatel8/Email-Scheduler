import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error';
import { parseLeads } from '../utils/csvParser';
import { scheduleEmailJob, scheduleEmailJobsBulk } from '../services/bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { z } from 'zod';

const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(100, "Campaign name must be under 100 characters"),
  subject: z.string().min(1, "Subject is required").max(255, "Subject must be under 255 characters"),
  body: z.string().min(1, "Body is required").max(10000, "Body must be under 10000 characters"),
  startTime: z.string().datetime("Start time must be a valid ISO datetime string"),
  minimumDelay: z.coerce.number().int().min(0, "Minimum delay must be at least 0").optional(),
  hourlyLimit: z.coerce.number().int().positive("Hourly limit must be greater than 0").optional(),
  leads: z.array(z.string().email("Invalid email format")).min(1, "At least one lead is required").max(10000, "Cannot exceed 10000 leads per campaign")
});

export const previewLeads = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const isCsv = req.file.originalname.toLowerCase().endsWith('.csv');
    const result = parseLeads(req.file.buffer, isCsv);

    res.json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const createCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as any;
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
      const campaign = await prisma.campaign.create({
        data: {
          userId,
          name,
          subject,
          body,
          startTime: new Date(startTime),
          minimumDelay: minimumDelay ?? parseInt(env.DEFAULT_EMAIL_DELAY_MS, 10),
          hourlyLimit: hourlyLimit ?? parseInt(env.MAX_EMAILS_PER_HOUR, 10),
          status: 'RUNNING'
        }
      });
      campaignId = campaign.id;

      // 2. Add recipients to DB
      const recipientData = leads.map((email: string) => ({
        campaignId: campaign.id,
        email,
        status: 'PENDING' as any,
        scheduledTime: new Date(startTime)
      }));

      await prisma.emailRecipient.createMany({
        data: recipientData,
        skipDuplicates: true
      });

      // Fetch the inserted recipients to get their IDs
      const recipients = await prisma.emailRecipient.findMany({
        where: { campaignId: campaign.id }
      });
      recipientsScheduled = recipients.length;

      // 3. Prepare Bulk Jobs
      const campaignStartTime = new Date(startTime).getTime();
      const delayStep = campaign.minimumDelay;
      const jobsToQueue = [];

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i]!;
        const now = Date.now();

        // Target time for this specific email
        const targetTime = campaignStartTime + (i * delayStep);
        let jobDelay = targetTime - now;
        if (jobDelay < 0) jobDelay = 0;

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
        await prisma.emailRecipient.update({
          where: { id: recipients[i]!.id },
          data: {
            scheduledTime: new Date(targetTime),
            status: 'QUEUED'
          }
        });
      }

      // 5. Schedule BullMQ Jobs in Bulk (Atomic pipeline insertion)
      try {
        await scheduleEmailJobsBulk(jobsToQueue);
      } catch (queueErr: any) {
        logger.error(`Campaign: Redis offline or bulk queue failure. Marking campaign ${campaign.id} as FAILED: ${queueErr.message}`);
        
        // Recover cleanly: 
        // 1. Mark campaign as FAILED
        // 2. Mark recipients as FAILED
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED' }
        });
        
        await prisma.emailRecipient.updateMany({
          where: { campaignId: campaign.id },
          data: { status: 'FAILED', error: 'Queue insertion failed: ' + queueErr.message }
        });

        throw new AppError(`Failed to schedule campaign due to queue error: ${queueErr.message}`, 500);
      }
    } catch (dbError: any) {
      throw new AppError(`Database or Prisma error: ${dbError.message}`, 500);
    }

    res.status(201).json({
      status: 'success',
      data: {
        campaignId,
        recipientsScheduled
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getScheduledEmails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as any;
    const userId = authReq.user.id;

    let emails;
    try {
      emails = await prisma.emailRecipient.findMany({
        where: {
          campaign: { userId },
          status: { in: ['PENDING', 'QUEUED', 'SENDING'] }
        },
        include: {
          campaign: { select: { name: true, subject: true } }
        },
        orderBy: { scheduledTime: 'asc' }
      });
    } catch (dbError: any) {
      throw dbError;
    }

    res.json({ status: 'success', data: emails });
  } catch (err) {
    next(err);
  }
};

export const getSentEmails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as any;
    const userId = authReq.user.id;

    let emails;
    try {
      emails = await prisma.emailRecipient.findMany({
        where: {
          campaign: { userId },
          status: { in: ['SENT', 'FAILED'] }
        },
        include: {
          campaign: { select: { name: true, subject: true } }
        },
        orderBy: { sentTime: 'desc' }
      });
    } catch (dbError: any) {
      throw dbError;
    }

    res.json({ status: 'success', data: emails });
  } catch (err) {
    next(err);
  }
};

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as any;
    const userId = authReq.user.id;

    let stats;
    try {
      const [scheduledCount, sentCount, failedCount, totalCampaigns, recentActivity] = await Promise.all([
        prisma.emailRecipient.count({ where: { campaign: { userId }, status: { in: ['PENDING', 'QUEUED', 'SENDING'] } } }),
        prisma.emailRecipient.count({ where: { campaign: { userId }, status: 'SENT' } }),
        prisma.emailRecipient.count({ where: { campaign: { userId }, status: 'FAILED' } }),
        prisma.campaign.count({ where: { userId } }),
        prisma.campaign.findMany({
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
    } catch (dbError: any) {
      throw dbError;
    }

    res.json({
      status: 'success',
      data: stats
    });
  } catch (err) {
    next(err);
  }
};
