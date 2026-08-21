"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
exports.redisConnection = new ioredis_1.default({
    host: env_1.env.REDIS_HOST,
    port: parseInt(env_1.env.REDIS_PORT, 10),
    maxRetriesPerRequest: null,
    lazyConnect: process.env.NODE_ENV === 'test',
});
exports.redisConnection.on('error', (err) => {
    console.error('Redis connection error:', err);
});
//# sourceMappingURL=redis.js.map