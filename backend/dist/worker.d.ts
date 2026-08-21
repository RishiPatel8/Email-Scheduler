import { Job } from 'bullmq';
export declare const checkAndCompleteCampaign: (campaignId: string) => Promise<void>;
export declare const processEmailJob: (job: Job) => Promise<{
    success: boolean;
    skipped: boolean;
    reason?: never;
    rescheduled?: never;
    email?: never;
} | {
    success: boolean;
    reason: string;
    skipped?: never;
    rescheduled?: never;
    email?: never;
} | {
    success: boolean;
    reason: string;
    rescheduled: boolean;
    skipped?: never;
    email?: never;
} | {
    success: boolean;
    email: any;
    skipped?: never;
    reason?: never;
    rescheduled?: never;
}>;
export declare const handleFailedJob: (job: Job | undefined, err: Error) => Promise<void>;
/**
 * Safely recovers records stuck in DISPATCHING state.
 * Expected to be run periodically or on worker startup.
 */
export declare const recoverStaleDispatches: (thresholdMs?: number) => Promise<number>;
//# sourceMappingURL=worker.d.ts.map