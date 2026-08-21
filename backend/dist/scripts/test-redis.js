"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
async function main() {
    const host = env_1.env.REDIS_HOST || 'localhost';
    const port = parseInt(env_1.env.REDIS_PORT || '6379', 10);
    console.log(`Connecting to Redis on ${host}:${port}...`);
    const redis = new ioredis_1.default({
        host,
        port,
        maxRetriesPerRequest: 1
    });
    try {
        const ping = await redis.ping();
        console.log(`Redis Ping Result: ${ping}`);
        // Set a test key
        await redis.set('redis_test_key', 'OK', 'EX', 10);
        const value = await redis.get('redis_test_key');
        console.log(`Redis Get Test Key: ${value}`);
        // Verify Lua script execution
        console.log('Verifying Redis Lua script engine...');
        const script = `
      local val = redis.call("GET", KEYS[1])
      return val
    `;
        const res = await redis.eval(script, 1, 'redis_test_key');
        console.log(`Lua Script Return: ${res}`);
        console.log('Redis and Lua engine verified successfully! 🚀');
    }
    catch (err) {
        console.error(`Redis connection or execution failed: ${err.message}`);
        console.log('Ensure Redis is running via docker compose or locally on the configured port.');
    }
    finally {
        await redis.disconnect();
    }
}
main();
//# sourceMappingURL=test-redis.js.map