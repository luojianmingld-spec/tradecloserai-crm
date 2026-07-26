/**
 * Email Service — IMAP/SMTP integration for CRM
 */
import crypto from 'crypto';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { simpleParser } from 'mailparser';

const prisma = new PrismaClient();

// Encryption key (derived from a fixed secret)
const ENCRYPTION_KEY = crypto.scryptSync('whatsapp-crm-email-secret-2024', 'salt', 32);
const IV_LENGTH = 16;

/**
 * Encrypt password for storage
 */
export function encryptPassword(plain) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plain, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt password from storage
 */
export function decryptPassword(encrypted) {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Provider presets for common email services
export const PROVIDER_PRESETS = {
  gmail: {
    imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465,
    needAppPassword: true, hint: 'Gmail需要在"Google账号→安全性→应用专用密码"生成16位授权码',
  },
  outlook: {
    imapHost: 'outlook.office365.com', imapPort: 993, smtpHost: 'smtp.office365.com', smtpPort: 587,
    needAppPassword: true, hint: 'Outlook/Hotmail需要在"账户安全→应用密码"生成授权码',
  },
  qq: {
    imapHost: 'imap.qq.com', imapPort: 993, smtpHost: 'smtp.qq.com', smtpPort: 465,
    needAppPassword: true, hint: 'QQ邮箱需要在"设置→账户→POP3/IMAP/SMTP"开启IMAP并生成授权码',
  },
  '163': {
    imapHost: 'imap.163.com', imapPort: 993, smtpHost: 'smtp.163.com', smtpPort: 465,
    needAppPassword: true, hint: '163邮箱需要在"设置→POP3/SMTP/IMAP"开启IMAP并生成授权码',
  },
  exmail: {
    imapHost: 'imap.exmail.qq.com', imapPort: 993, smtpHost: 'smtp.exmail.qq.com', smtpPort: 465,
    hint: '腾讯企业邮，用账号密码登录（如开了安全登录需用客户端专用密码）',
  },
  aliyun: {
    imapHost: 'imap.qiye.aliyun.com', imapPort: 993, smtpHost: 'smtp.qiye.aliyun.com', smtpPort: 465,
    hint: '阿里企业邮，直接用账号密码登录',
  },
  icloud: {
    imapHost: 'imap.mail.me.com', imapPort: 993, smtpHost: 'smtp.mail.me.com', smtpPort: 587,
    needAppPassword: true, hint: 'iCloud需要在appleid.apple.com生成"App专用密码"',
  },
  yahoo: {
    imapHost: 'imap.mail.yahoo.com', imapPort: 993, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465,
    needAppPassword: true, hint: 'Yahoo需要在"Account Security→Generate app password"',
  },
  zoho: {
    imapHost: 'imap.zoho.com', imapPort: 993, smtpHost: 'smtp.zoho.com', smtpPort: 465,
    hint: 'Zoho邮箱，开启IMAP后用账号密码或应用专用密码',
  },
  custom: { imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465, hint: '请填写IMAP/SMTP服务器地址' },
};

/**
 * Create an IMAP client for an account
 */
function createImapClient(account) {
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: true,
    auth: {
      user: account.email,
      pass: decryptPassword(account.password).replace(/\s/g, ""),
    },
    logger: false,
  });
}

/**
 * Create SMTP transporter for an account
 */
function createSmtpTransporter(account) {
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: {
      user: account.email,
      pass: decryptPassword(account.password).replace(/\s/g, ""),
    },
  });
}

/**
 * Test IMAP/SMTP connection for an account
 */
export async function testConnection(account) {
  const result = { imap: false, smtp: false, imapError: null, smtpError: null };

  // Test IMAP
  try {
    const client = createImapClient(account);
    await client.connect();
    await client.logout();
    result.imap = true;
  } catch (err) {
    result.imapError = err.message;
    console.error('[Email] IMAP test failed:', err.message);
  }

  // Test SMTP
  try {
    const transporter = createSmtpTransporter(account);
    await transporter.verify();
    result.smtp = true;
  } catch (err) {
    result.smtpError = err.message;
    console.error('[Email] SMTP test failed:', err.message);
  }

  return result;
}

/**
 * Sync emails from IMAP for an account (fetch recent emails)
 */
export async function syncEmails(accountId) {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) throw new Error('Account not found');

  const client = createImapClient(account);
  let synced = 0;

  try {
    await client.connect();

    // Open INBOX
    const mailbox = await client.mailboxOpen('INBOX');
    console.log(`[Email] INBOX has ${mailbox.exists} messages`);

    // Determine range: fetch last 30 days of emails
    // Use sequence numbers for the most recent emails (last 100 max)
    const totalMessages = mailbox.exists;
    if (totalMessages === 0) {
      await client.logout();
      return { synced: 0 };
    }

    const rangeEnd = totalMessages;
    const rangeStart = Math.max(1, totalMessages - 100);

    // Fetch messages
    for await (const msg of client.fetch(`${rangeStart}:${rangeEnd}`, {
      envelope: true,
      bodyStructure: true,
      uid: true,
      source: true,
    })) {
      try {
        const parsed = await simpleParser(msg.source);

        const messageId = parsed.messageId || null;
        const from = parsed.from?.text || parsed.from?.value?.[0]?.address || 'unknown';
        const to = parsed.to?.text || 'unknown';
        const subject = parsed.subject || '(No Subject)';
        const bodyHtml = parsed.html || null;
        const bodyPlain = parsed.text || null;
        const body = bodyPlain || stripHtml(bodyHtml || '');

        // Determine direction
        const accountEmail = account.email.toLowerCase();
        const fromLower = from.toLowerCase();
        const direction = fromLower.includes(accountEmail) ? 'outbound' : 'inbound';

        // Extract attachment filenames
        let attachmentNames = null;
        if (parsed.attachments && parsed.attachments.length > 0) {
          attachmentNames = JSON.stringify(parsed.attachments.map(a => a.filename || 'attachment'));
        }

        // Check if already exists
        const existing = await prisma.emailMessage.findUnique({
          where: {
            accountId_messageId: {
              accountId,
              messageId: messageId || `fallback-${msg.uid}`,
            },
          },
        });

        if (!existing) {
          await prisma.emailMessage.create({
            data: {
              accountId,
              messageId: messageId || `fallback-${msg.uid}`,
              from,
              to,
              subject,
              body,
              bodyHtml,
              bodyPlain,
              direction,
              attachmentNames,
              createdAt: parsed.date || new Date(),
            },
          });
          synced++;
        }
      } catch (msgErr) {
        console.error(`[Email] Error processing message ${msg.uid}:`, msgErr.message);
      }
    }

    // Update lastSyncAt and status
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { lastSyncAt: new Date(), status: 'connected' },
    });

    await client.logout();
    return { synced };
  } catch (err) {
    console.error('[Email] Sync error:', err.message);
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { status: 'error' },
    }).catch(() => {});
    throw err;
  }
}

/**
 * Send an email
 */
export async function sendEmail(accountId, { to, subject, body, html }) {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) throw new Error('Account not found');

  const transporter = createSmtpTransporter(account);

  const mailOptions = {
    from: account.email,
    to,
    subject,
    text: body,
    html: html || body,
  };

  const info = await transporter.sendMail(mailOptions);

  // Save to database as outbound email
  const saved = await prisma.emailMessage.create({
    data: {
      accountId,
      messageId: info.messageId,
      from: account.email,
      to,
      subject,
      body: body,
      bodyHtml: html || body,
      bodyPlain: body,
      direction: 'outbound',
    },
  });

  return saved;
}

/**
 * Auto-match email sender to existing customer or create new one
 */
export async function matchOrCreateCustomer(userId, emailMessage) {
  if (emailMessage.direction !== 'inbound') return null;

  // Extract email address from "from" field
  const emailMatch = emailMessage.from.match(/<(.+?)>/);
  const emailAddr = emailMatch ? emailMatch[1] : emailMessage.from;

  // Try to find customer by email
  let customer = await prisma.customer.findFirst({
    where: { userId, email: emailAddr },
  });

  if (customer) return customer;

  // Try to extract name from "from" field
  const nameMatch = emailMessage.from.match(/^"?(.+?)"?\s*</);
  const name = nameMatch ? nameMatch[1] : emailAddr.split('@')[0];

  // Create new customer
  customer = await prisma.customer.create({
    data: {
      userId,
      name,
      email: emailAddr,
      source: 'email',
      status: 'potential',
      assignedTo: userId,
    },
  });

  return customer;
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
