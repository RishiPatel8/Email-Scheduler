import express from 'express';
import cors from 'cors';
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
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);

// Error Handling
app.use(errorHandler);

if (require.main === module) {
  const port = process.env.PORT || env.PORT || 3000;
  app.listen(Number(port), '0.0.0.0', () => {
    logger.info(`API Server running on port ${port} and bound to 0.0.0.0`);
  });
}

export default app;
