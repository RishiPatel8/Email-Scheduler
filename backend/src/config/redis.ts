import Redis from 'ioredis';
import { env } from './env';

export const redisConnection = env.REDIS_URL 
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: process.env.NODE_ENV === 'test' })
  : new Redis({
      host: env.REDIS_HOST,
      port: parseInt(env.REDIS_PORT, 10),
      maxRetriesPerRequest: null,
      lazyConnect: process.env.NODE_ENV === 'test',
    });

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});
