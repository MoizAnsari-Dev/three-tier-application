const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

const connectRedis = () => {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  return redis;
};

const getRedis = () => {
  if (!redis) {
    throw new Error('Redis not initialised. Call connectRedis() first.');
  }
  return redis;
};

module.exports = { connectRedis, getRedis };
