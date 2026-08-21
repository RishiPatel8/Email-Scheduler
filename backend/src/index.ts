import app from './api';
import { env } from './config/env';
import { logger } from './utils/logger';

// Start the Express API Server
app.listen(env.PORT, () => {
  logger.info(`API Server running on port ${env.PORT}`);
});

// Import the worker to start BullMQ processing in the same process
import './worker';
logger.info('Combined API and Worker process started successfully.');
