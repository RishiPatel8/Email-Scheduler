"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const firebase_1 = require("../services/firebase");
const db_1 = require("../config/db");
const error_1 = require("./error");
const logger_1 = require("../utils/logger");
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new error_1.AppError('Unauthorized - No token provided', 401));
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return next(new error_1.AppError('Unauthorized - Empty token provided', 401));
    }
    try {
        if (!firebase_1.initialized || !firebase_1.auth) {
            return next(new error_1.AppError('Unauthorized - Firebase Admin SDK not initialized', 500));
        }
        const verified = await firebase_1.auth.verifyIdToken(token);
        const decodedToken = {
            uid: verified.uid,
            ...(verified.email ? { email: verified.email } : {}),
            ...(verified.name ? { name: verified.name } : {}),
            ...(verified.picture ? { picture: verified.picture } : {})
        };
        if (!decodedToken.uid) {
            return next(new error_1.AppError('Unauthorized - Invalid token payload', 401));
        }
        const email = decodedToken.email || `${decodedToken.uid}@firebase-user.com`;
        let user;
        try {
            // Find or create user in MySQL via Prisma
            user = await db_1.prisma.user.findUnique({
                where: { firebaseUid: decodedToken.uid }
            });
            if (!user) {
                const existingUserByEmail = await db_1.prisma.user.findUnique({
                    where: { email }
                });
                if (existingUserByEmail) {
                    user = await db_1.prisma.user.update({
                        where: { id: existingUserByEmail.id },
                        data: { firebaseUid: decodedToken.uid }
                    });
                    logger_1.logger.info(`Auth: Linked existing email user ${email} to firebaseUid ${decodedToken.uid}`);
                }
                else {
                    user = await db_1.prisma.user.create({
                        data: {
                            firebaseUid: decodedToken.uid,
                            email,
                            name: decodedToken.name || null,
                            picture: decodedToken.picture || null
                        }
                    });
                    logger_1.logger.info(`Auth: Created new MySQL user ${email} for firebaseUid ${decodedToken.uid}`);
                }
            }
        }
        catch (dbError) {
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
    }
    catch (error) {
        logger_1.logger.error(`Auth middleware verification failed: ${error.message}`);
        return next(new error_1.AppError('Unauthorized - Invalid or expired token', 401));
    }
};
exports.requireAuth = requireAuth;
//# sourceMappingURL=auth.js.map