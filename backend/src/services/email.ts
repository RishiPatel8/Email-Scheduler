import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let cachedTransporter: nodemailer.Transporter | null = null;

const getTransporter = async (): Promise<nodemailer.Transporter> => {
  if (cachedTransporter) return cachedTransporter;

  let user = env.ETHEREAL_USER;
  let pass = env.ETHEREAL_PASS;

  if (!user || !pass) {
    logger.info('SMTP: No credentials found in environment. Generating dynamic Ethereal test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
      logger.info(`SMTP: Generated dynamic test account: User=${user}`);
    } catch (createErr: any) {
      logger.error(`SMTP: Failed to generate dynamic test account: ${createErr.message}. Falling back to default placeholders.`);
      user = 'test@ethereal.email';
      pass = 'password';
    }
  }

  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user, pass },
    connectionTimeout: 10000,
    socketTimeout: 30000
  });

  return cachedTransporter;
};

export const sendEmail = async (to: string, subject: string, body: string) => {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: '"Email Campaign Manager" <no-reply@scheduler.com>',
    to,
    subject,
    text: body,
    html: `<p>${body.replace(/\\n/g, '<br>')}</p>`,
  });

  logger.info(`Message sent: ${info.messageId}`);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info(`Preview URL: ${previewUrl}`);
  }
  
  return info;
};
