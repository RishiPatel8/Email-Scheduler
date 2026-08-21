import { Request, Response, NextFunction } from 'express';
import { auth, initialized } from '../services/firebase';
import { prisma } from '../config/db';
import { AppError } from './error';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    firebaseUid: string;
    email: string;
    name?: string | null;
    picture?: string | null;
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized - No token provided', 401));
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(new AppError('Unauthorized - Empty token provided', 401));
  }

  try {
    if (!initialized || !auth) {
      return next(new AppError('Unauthorized - Firebase Admin SDK not initialized', 500));
    }
    const verified = await auth.verifyIdToken(token);
    const decodedToken = {
      uid: verified.uid,
      ...(verified.email ? { email: verified.email } : {}),
      ...(verified.name ? { name: verified.name } : {}),
      ...(verified.picture ? { picture: verified.picture } : {})
    };

    if (!decodedToken.uid) {
      return next(new AppError('Unauthorized - Invalid token payload', 401));
    }

    const email = decodedToken.email || `${decodedToken.uid}@firebase-user.com`;

    let user;
    try {
      // Find or create user in MySQL via Prisma
      user = await prisma.user.findUnique({
        where: { firebaseUid: decodedToken.uid }
      });

      if (!user) {
        const existingUserByEmail = await prisma.user.findUnique({
          where: { email }
        });

        if (existingUserByEmail) {
          user = await prisma.user.update({
            where: { id: existingUserByEmail.id },
            data: { firebaseUid: decodedToken.uid }
          });
          logger.info(`Auth: Linked existing email user ${email} to firebaseUid ${decodedToken.uid}`);
        } else {
          user = await prisma.user.create({
            data: {
              firebaseUid: decodedToken.uid,
              email,
              name: decodedToken.name || null,
              picture: decodedToken.picture || null
            }
          });
          logger.info(`Auth: Created new MySQL user ${email} for firebaseUid ${decodedToken.uid}`);
        }
      }
    } catch (dbError: any) {
      throw dbError;
    }

    // Attach user record to request
    req.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      name: user.name,
      picture: user.picture
    };

    next();
  } catch (error: any) {
    logger.error(`Auth middleware verification failed: ${error.message}`);
    return next(new AppError('Unauthorized - Invalid or expired token', 401));
  }
};
