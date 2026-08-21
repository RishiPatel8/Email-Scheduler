"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = void 0;
const db_1 = require("../config/db");
const error_1 = require("../middleware/error");
const getCurrentUser = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new error_1.AppError('Unauthorized', 401));
        }
        let user;
        try {
            user = await db_1.prisma.user.findUnique({
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
                return next(new error_1.AppError('User not found', 404));
            }
        }
        catch (dbError) {
            throw dbError;
        }
        res.json({
            status: 'success',
            data: {
                user
            }
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getCurrentUser = getCurrentUser;
//# sourceMappingURL=auth.js.map