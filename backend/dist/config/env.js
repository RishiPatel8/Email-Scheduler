"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('3001'),
    DATABASE_URL: zod_1.z.string(),
    REDIS_HOST: zod_1.z.string().default('localhost'),
    REDIS_PORT: zod_1.z.string().default('6379'),
    JWT_SECRET: zod_1.z.string().default('default_secret_please_change'),
    GOOGLE_CLIENT_ID: zod_1.z.string().optional(),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().optional(),
    FIREBASE_PROJECT_ID: zod_1.z.string().optional(),
    FIREBASE_CLIENT_EMAIL: zod_1.z.string().optional(),
    FIREBASE_PRIVATE_KEY: zod_1.z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: zod_1.z.string().optional(),
    ETHEREAL_USER: zod_1.z.string().optional(),
    ETHEREAL_PASS: zod_1.z.string().optional(),
    MAX_EMAILS_PER_HOUR: zod_1.z.string().default('200'),
    DEFAULT_EMAIL_DELAY_MS: zod_1.z.string().default('2000'),
    WORKER_CONCURRENCY: zod_1.z.string().default('5'),
    FRONTEND_URL: zod_1.z.string().default('http://localhost:3000')
});
exports.env = envSchema.parse(process.env);
//# sourceMappingURL=env.js.map