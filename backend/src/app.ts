import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { cleanupDeadWorkers } from './services/workerService';
import { config } from './config';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
  app.use('/api', routes);
  app.use(errorHandler);

  return app;
}

export function startCleanupInterval() {
  const intervalMs = config.worker.deadThresholdSeconds * 1000;
  setInterval(async () => {
    try {
      const result = await cleanupDeadWorkers();
      if (result.cleaned > 0) {
        console.log(`Cleaned up ${result.cleaned} dead worker(s)`);
      }
    } catch (err) {
      console.error('Dead worker cleanup failed:', err);
    }
  }, intervalMs);
}
