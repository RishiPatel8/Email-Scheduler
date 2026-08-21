import express from 'express';
import cors from 'cors';
import { prisma } from './config/db';
import { redisConnection } from './config/redis';
import { exec } from 'child_process';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { logger } from './utils/logger';

// Import Routes
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaign';

const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation
try {
  const swaggerDocument = YAML.load(path.join(__dirname, '../../docs/openapi.yaml'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  logger.warn('Swagger documentation not found or failed to load.');
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check database connection
app.get('/api/debug/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', message: 'Database connected successfully!' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message, stack: error.stack });
  }
});



// Debug endpoint to manually trigger database migrations
app.get('/api/debug/migrate', (req, res) => {
  exec('node node_modules/prisma/build/index.js migrate deploy', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ status: 'error', message: error.message, stdout, stderr });
    }
    res.json({ status: 'success', stdout, stderr });
  });
});

// Debug endpoint to check Redis connection
app.get('/api/debug/redis', async (req, res) => {
  try {
    const ping = await redisConnection.ping();
    res.json({ status: 'success', message: 'Redis is connected!', response: ping });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message, stack: error.stack });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);

// Error Handling
app.use(errorHandler);

if (require.main === module) {
  // Initialize background worker in the same process
  import('./worker');

  const port = process.env.PORT || env.PORT || 3000;
  app.listen(Number(port), '0.0.0.0', () => {
    logger.info(`API Server running on port ${port} and bound to 0.0.0.0`);
  });
}

export default app;
