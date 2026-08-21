import { Router } from 'express';
import { getCurrentUser } from '../controllers/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/me', requireAuth, getCurrentUser);

export default router;
