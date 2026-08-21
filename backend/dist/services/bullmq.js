"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleEmailJobsBulk = exports.scheduleEmailJob = exports.emailQueueEvents = exports.emailQueue = exports.QUEUE_NAME = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
exports.QUEUE_NAME = 'email-jobs';
exports.emailQueue = new bullmq_1.Queue(exports.QUEUE_NAME, {
    connection: redis_1.redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});
exports.emailQueueEvents = new bullmq_1.QueueEvents(exports.QUEUE_NAME, {
    connection: redis_1.redisConnection,
});
exports.emailQueueEvents.on('completed', ({ jobId }) => {
    logger_1.logger.info(`Job completed in queue: ${jobId}`);
});
exports.emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
    logger_1.logger.error(`Job failed in queue: ${jobId}, reason: ${failedReason}`);
});
const scheduleEmailJob = async (jobId, data, delay) => {
    // Use a deterministic job ID for idempotency protection
    await exports.emailQueue.add('send-email', data, {
        jobId,
        delay
    });
};
exports.scheduleEmailJob = scheduleEmailJob;
const scheduleEmailJobsBulk = async (jobs) => {
    await exports.emailQueue.addBulk(jobs);
};
exports.scheduleEmailJobsBulk = scheduleEmailJobsBulk;
//# sourceMappingURL=bullmq.js.map