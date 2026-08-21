"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceMinimumDelay = exports.decrementRateLimit = exports.checkAndIncrementRateLimit = void 0;
const redis_1 = require("../config/redis");
const RATE_LIMIT_KEY = 'hourly_email_limit';
const GLOBAL_LAST_SEND_KEY = 'last_email_sent_time';
/**
 * Atomically checks the hourly email count and increments it if it is below the limit.
 * Uses a Redis Lua script to guarantee atomicity across multiple worker instances.
 */
const checkAndIncrementRateLimit = async (maxLimit) => {
    const script = `
    local count = redis.call("GET", KEYS[1])
    local max = tonumber(ARGV[1])
    if count and tonumber(count) >= max then
      return 0
    end
    local current = redis.call("INCR", KEYS[1])
    if current == 1 then
      redis.call("EXPIRE", KEYS[1], 3600)
    end
    return 1
  `;
    const result = await redis_1.redisConnection.eval(script, 1, RATE_LIMIT_KEY, maxLimit.toString());
    return result === 1;
};
exports.checkAndIncrementRateLimit = checkAndIncrementRateLimit;
/**
 * Decrements the hourly email count.
 * Useful to revert the rate limit increment if an email fails to transmit.
 */
const decrementRateLimit = async () => {
    try {
        await redis_1.redisConnection.decr(RATE_LIMIT_KEY);
    }
    catch (err) {
        console.error('Failed to decrement Redis rate limit key:', err.message);
    }
};
exports.decrementRateLimit = decrementRateLimit;
/**
 * Atomically enforces a minimum delay between sequential email dispatches globally.
 * Uses a Redis Lua script to coordinate and delay worker execution across concurrency bounds.
 */
const enforceMinimumDelay = async (minDelay) => {
    const now = Date.now();
    const script = `
    local last_sent = redis.call("GET", KEYS[1])
    local now = tonumber(ARGV[1])
    local delay = tonumber(ARGV[2])
    
    if not last_sent then
      redis.call("SET", KEYS[1], now)
      return 0
    end
    
    local time_passed = now - tonumber(last_sent)
    if time_passed < delay then
      local new_time = tonumber(last_sent) + delay
      redis.call("SET", KEYS[1], new_time)
      return new_time - now
    else
      redis.call("SET", KEYS[1], now)
      return 0
    end
  `;
    const waitTime = await redis_1.redisConnection.eval(script, 1, GLOBAL_LAST_SEND_KEY, now.toString(), minDelay.toString());
    return waitTime;
};
exports.enforceMinimumDelay = enforceMinimumDelay;
//# sourceMappingURL=rateLimiter.js.map