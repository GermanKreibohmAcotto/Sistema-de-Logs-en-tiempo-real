import { Redis } from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Separate connections for each role: `ioredis` puts a subscriber connection
 * into a special mode where it can no longer run normal commands, and
 * publish/read paths must not be blocked by that mode.
 */
export function createRedisClient(name: string): Redis {
  const client = new Redis(config.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: null,
  });
  client.on('error', (err: Error) =>
    logger.error({ err, client: name }, 'Error de conexion a Redis'),
  );
  return client;
}

export const redisPub = createRedisClient('pub');
export const redisCmd = createRedisClient('cmd');
export const redisSub = createRedisClient('sub');
