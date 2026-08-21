"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logger = {
    info: (msg, meta) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, meta ? JSON.stringify(meta) : '');
    },
    error: (msg, meta) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, meta ? JSON.stringify(meta) : '');
    },
    warn: (msg, meta) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, meta ? JSON.stringify(meta) : '');
    }
};
//# sourceMappingURL=logger.js.map