import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { 
  previewLeads, 
  createCampaign, 
  getScheduledEmails, 
  getSentEmails, 
  getDashboardStats 
} from '../controllers/campaign';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

router.use(requireAuth);

router.post('/preview', upload.single('file'), previewLeads);
router.post('/', createCampaign);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/stats', getDashboardStats);

export default router;
