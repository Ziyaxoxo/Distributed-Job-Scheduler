import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  worker: {
    heartbeatIntervalMs: parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS || '5000', 10),
    pollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '1000', 10),
    maxConcurrentJobs: parseInt(process.env.WORKER_MAX_CONCURRENT_JOBS || '5', 10),
    deadThresholdSeconds: parseInt(process.env.WORKER_DEAD_THRESHOLD_SECONDS || '30', 10),
  },
};
