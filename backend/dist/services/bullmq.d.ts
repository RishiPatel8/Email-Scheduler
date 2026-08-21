import { Queue, QueueEvents } from 'bullmq';
export declare const QUEUE_NAME = "email-jobs";
export declare const emailQueue: Queue<any, any, string, any, any, string>;
export declare const emailQueueEvents: QueueEvents;
export declare const scheduleEmailJob: (jobId: string, data: {
    recipientId: string;
    campaignId: string;
    email: string;
}, delay: number) => Promise<void>;
export declare const scheduleEmailJobsBulk: (jobs: {
    name: string;
    data: any;
    opts: any;
}[]) => Promise<void>;
//# sourceMappingURL=bullmq.d.ts.map