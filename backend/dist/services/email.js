"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
let cachedTransporter = null;
const getTransporter = async () => {
    if (cachedTransporter)
        return cachedTransporter;
    let user = env_1.env.ETHEREAL_USER;
    let pass = env_1.env.ETHEREAL_PASS;
    if (!user || !pass) {
        logger_1.logger.info('SMTP: No credentials found in environment. Generating dynamic Ethereal test account...');
        try {
            const testAccount = await nodemailer_1.default.createTestAccount();
            user = testAccount.user;
            pass = testAccount.pass;
            logger_1.logger.info(`SMTP: Generated dynamic test account: User=${user}`);
        }
        catch (createErr) {
            logger_1.logger.error(`SMTP: Failed to generate dynamic test account: ${createErr.message}. Falling back to default placeholders.`);
            user = 'test@ethereal.email';
            pass = 'password';
        }
    }
    cachedTransporter = nodemailer_1.default.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user, pass },
        connectionTimeout: 10000,
        socketTimeout: 30000
    });
    return cachedTransporter;
};
const sendEmail = async (to, subject, body) => {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
        from: '"Email Campaign Manager" <no-reply@scheduler.com>',
        to,
        subject,
        text: body,
        html: `<p>${body.replace(/\\n/g, '<br>')}</p>`,
    });
    logger_1.logger.info(`Message sent: ${info.messageId}`);
    const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
    if (previewUrl) {
        logger_1.logger.info(`Preview URL: ${previewUrl}`);
    }
    return info;
};
exports.sendEmail = sendEmail;
//# sourceMappingURL=email.js.map