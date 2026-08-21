import { redisConnection } from '../config/redis';

const RATE_LIMIT_KEY = 'hourly_email_limit';
const GLOBAL_LAST_SEND_KEY = 'last_email_sent_time';

/**
 * Atomically checks the hourly email count and increments it if it is below the limit.
 * Uses a Redis Lua script to guarantee atomicity across multiple worker instances.
 */
export const checkAndIncrementRateLimit = async (maxLimit: number): Promise<boolean> => {
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
  const result = await redisConnection.eval(script, 1, RATE_LIMIT_KEY, maxLimit.toString()) as number;
  return result === 1;
};

/**
 * Decrements the hourly email count.
 * Useful to revert the rate limit increment if an email fails to transmit.
 */
export const decrementRateLimit = async (): Promise<void> => {
  try {
    await redisConnection.decr(RATE_LIMIT_KEY);
  } catch (err: any) {
    console.error('Failed to decrement Redis rate limit key:', err.message);
  }
};

/**
 * Atomically enforces a minimum delay between sequential email dispatches globally.
 * Uses a Redis Lua script to coordinate and delay worker execution across concurrency bounds.
 */
export const enforceMinimumDelay = async (minDelay: number): Promise<number> => {
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
  
  const waitTime = await redisConnection.eval(
    script, 
    1, 
    GLOBAL_LAST_SEND_KEY, 
    now.toString(), 
    minDelay.toString()
  ) as number;
  
  return waitTime;
};
