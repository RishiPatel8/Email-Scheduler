"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialized = exports.auth = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const fs_1 = __importDefault(require("fs"));
let firebaseApp;
let firebaseAuth;
let initialized = false;
exports.initialized = initialized;
try {
    if (env_1.env.FIREBASE_SERVICE_ACCOUNT_JSON && fs_1.default.existsSync(env_1.env.FIREBASE_SERVICE_ACCOUNT_JSON)) {
        const serviceAccount = JSON.parse(fs_1.default.readFileSync(env_1.env.FIREBASE_SERVICE_ACCOUNT_JSON, 'utf8'));
        firebaseApp = (0, app_1.initializeApp)({
            credential: (0, app_1.cert)(serviceAccount)
        });
        exports.initialized = initialized = true;
        logger_1.logger.info('Firebase Admin SDK initialized with service account JSON file.');
    }
    else if (env_1.env.FIREBASE_PROJECT_ID && env_1.env.FIREBASE_CLIENT_EMAIL && env_1.env.FIREBASE_PRIVATE_KEY) {
        const privateKey = env_1.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        firebaseApp = (0, app_1.initializeApp)({
            credential: (0, app_1.cert)({
                projectId: env_1.env.FIREBASE_PROJECT_ID,
                clientEmail: env_1.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            })
        });
        exports.initialized = initialized = true;
        logger_1.logger.info('Firebase Admin SDK initialized with environment credentials.');
    }
    else {
        // Attempt default initialization if standard Firebase environments exist in runtime
        firebaseApp = (0, app_1.initializeApp)();
        exports.initialized = initialized = true;
        logger_1.logger.info('Firebase Admin SDK initialized with default application credentials.');
    }
    if (firebaseApp) {
        exports.auth = firebaseAuth = (0, auth_1.getAuth)(firebaseApp);
    }
}
catch (error) {
    logger_1.logger.error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
    logger_1.logger.warn('Token validation on protected APIs will fail without proper Firebase credentials.');
}
//# sourceMappingURL=firebase.js.map