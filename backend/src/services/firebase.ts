import { initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import fs from 'fs';

let firebaseApp: App | undefined;
let firebaseAuth: Auth | undefined;
let initialized = false;

try {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON && fs.existsSync(env.FIREBASE_SERVICE_ACCOUNT_JSON)) {
    const serviceAccount = JSON.parse(fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT_JSON, 'utf8'));
    firebaseApp = initializeApp({
      credential: cert(serviceAccount)
    });
    initialized = true;
    logger.info('Firebase Admin SDK initialized with service account JSON file.');
  } else if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    firebaseApp = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      })
    });
    initialized = true;
    logger.info('Firebase Admin SDK initialized with environment credentials.');
  } else {
    // Attempt default initialization if standard Firebase environments exist in runtime
    firebaseApp = initializeApp();
    initialized = true;
    logger.info('Firebase Admin SDK initialized with default application credentials.');
  }

  if (firebaseApp) {
    firebaseAuth = getAuth(firebaseApp);
  }
} catch (error: any) {
  logger.error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
  logger.warn('Token validation on protected APIs will fail without proper Firebase credentials.');
}

export { firebaseAuth as auth, initialized };
