"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const campaign_1 = require("../controllers/campaign");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
router.use(auth_1.requireAuth);
router.post('/preview', upload.single('file'), campaign_1.previewLeads);
router.post('/', campaign_1.createCampaign);
router.get('/scheduled', campaign_1.getScheduledEmails);
router.get('/sent', campaign_1.getSentEmails);
router.get('/stats', campaign_1.getDashboardStats);
exports.default = router;
//# sourceMappingURL=campaign.js.map