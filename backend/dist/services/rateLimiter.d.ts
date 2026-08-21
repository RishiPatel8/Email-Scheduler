/**
 * Atomically checks the hourly email count and increments it if it is below the limit.
 * Uses a Redis Lua script to guarantee atomicity across multiple worker instances.
 */
export declare const checkAndIncrementRateLimit: (maxLimit: number) => Promise<boolean>;
/**
 * Decrements the hourly email count.
 * Useful to revert the rate limit increment if an email fails to transmit.
 */
export declare const decrementRateLimit: () => Promise<void>;
/**
 * Atomically enforces a minimum delay between sequential email dispatches globally.
 * Uses a Redis Lua script to coordinate and delay worker execution across concurrency bounds.
 */
export declare const enforceMinimumDelay: (minDelay: number) => Promise<number>;
//# sourceMappingURL=rateLimiter.d.ts.map