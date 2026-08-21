import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';

export const getCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401));
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          firebaseUid: true,
          email: true,
          name: true,
          picture: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return next(new AppError('User not found', 404));
      }
    } catch (dbError: any) {
      throw dbError;
    }

    res.json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    next(err);
  }
};
