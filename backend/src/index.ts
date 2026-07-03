import { createApp, startCleanupInterval } from './app';
import { config } from './config';

const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  startCleanupInterval();
  app.listen(config.port, () => {
    console.log(`API server listening on port ${config.port}`);
  });
}

export default app;
