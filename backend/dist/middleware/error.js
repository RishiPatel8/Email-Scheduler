"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, next) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    else if (err.name === 'ZodError') {
        statusCode = 400;
        message = 'Validation Error';
    }
    else {
        logger_1.logger.error('Unhandled Error', err);
    }
    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message,
        ...(err.name === 'ZodError' ? { details: err.errors } : {})
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.js.map