"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
async function main() {
    console.log('Testing SMTP configuration...');
    let user = env_1.env.ETHEREAL_USER;
    let pass = env_1.env.ETHEREAL_PASS;
    if (!user || !pass) {
        console.log('No credentials found in environment. Generating dynamic Ethereal test account...');
        try {
            const testAccount = await nodemailer_1.default.createTestAccount();
            user = testAccount.user;
            pass = testAccount.pass;
            console.log(`Generated test account: User=${user}, Pass=${pass}`);
        }
        catch (createErr) {
            console.error(`Failed to generate Ethereal test account: ${createErr.message}`);
            return;
        }
    }
    console.log(`SMTP Credentials: User=${user}`);
    const transporter = nodemailer_1.default.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user, pass }
    });
    try {
        console.log('Verifying SMTP connection...');
        await transporter.verify();
        console.log('SMTP Connection verified successfully! Transporter is ready to deliver.');
        console.log('Sending test email via Ethereal...');
        const info = await transporter.sendMail({
            from: '"SMTP Verification" <no-reply@scheduler.com>',
            to: 'verification.test@example.com',
            subject: 'Ethereal SMTP Transporter Check',
            text: 'If you see this, your SMTP connection is fully operational.'
        });
        console.log(`Message delivered! Message ID: ${info.messageId}`);
        const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`Email Preview URL: ${previewUrl}`);
        }
        console.log('SMTP test complete! 🚀');
    }
    catch (err) {
        console.error(`Transporter check failed: ${err.message}`);
        console.log('Please ensure your network allows SMTP outbound traffic on port 587.');
    }
}
main();
//# sourceMappingURL=test-smtp.js.map