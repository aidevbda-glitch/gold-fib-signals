import nodemailer from 'nodemailer';
import db from './database.js';

// Email configuration store
let emailConfig = null;

/**
 * Initialize email settings table
 */
export function initEmailSettings() {
  const createTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      smtpHost TEXT NOT NULL DEFAULT '',
      smtpPort INTEGER NOT NULL DEFAULT 587,
      smtpUser TEXT NOT NULL DEFAULT '',
      smtpPass TEXT NOT NULL DEFAULT '',
      fromEmail TEXT NOT NULL DEFAULT '',
      fromName TEXT NOT NULL DEFAULT 'Gold Fib Signals',
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  createTable.run();

  // Create email subscribers table
  const createSubscribersTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS email_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  createSubscribersTable.run();

  // Create email notifications log table
  const createLogTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS email_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriber_email TEXT NOT NULL,
      signal_id TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL,
      error_message TEXT
    )
  `);
  createLogTable.run();

  // Insert default settings if not exists
  const insertDefault = db.prepare(`
    INSERT OR IGNORE INTO email_settings (id, smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName, enabled)
    VALUES (1, '', 587, '', '', '', 'Gold Fib Signals', 0)
  `);
  insertDefault.run();
}

/**
 * Get email settings
 */
export function getEmailSettings() {
  const stmt = db.prepare('SELECT * FROM email_settings WHERE id = 1');
  return stmt.get();
}

/**
 * Update email settings
 */
export function updateEmailSettings(settings) {
  const stmt = db.prepare(`
    UPDATE email_settings SET
      smtpHost = ?,
      smtpPort = ?,
      smtpUser = ?,
      smtpPass = ?,
      fromEmail = ?,
      fromName = ?,
      enabled = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);
  
  stmt.run(
    settings.smtpHost || '',
    settings.smtpPort || 587,
    settings.smtpUser || '',
    settings.smtpPass || '',
    settings.fromEmail || '',
    settings.fromName || 'Gold Fib Signals',
    settings.enabled ? 1 : 0
  );
  
  // Clear cached config
  emailConfig = null;
  
  return getEmailSettings();
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(settings) {
  try {
    const transporter = nodemailer.createTransporter({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });

    await transporter.verify();
    return { success: true, message: 'SMTP connection verified' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Get or create email transporter
 */
function getTransporter() {
  if (emailConfig) {
    return emailConfig;
  }

  const settings = getEmailSettings();
  
  if (!settings || !settings.enabled || !settings.smtpHost) {
    return null;
  }

  emailConfig = nodemailer.createTransporter({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
  });

  return emailConfig;
}

/**
 * Get all email subscribers
 */
export function getEmailSubscribers() {
  const stmt = db.prepare('SELECT * FROM email_subscribers ORDER BY created_at DESC');
  return stmt.all();
}

/**
 * Get enabled email subscribers only
 */
export function getEnabledSubscribers() {
  const stmt = db.prepare('SELECT * FROM email_subscribers WHERE enabled = 1');
  return stmt.all();
}

/**
 * Add email subscriber
 */
export function addEmailSubscriber(email, name = '') {
  const stmt = db.prepare(`
    INSERT INTO email_subscribers (email, name, enabled)
    VALUES (?, ?, 1)
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(email, name);
  return { email, name, enabled: 1 };
}

/**
 * Update email subscriber
 */
export function updateEmailSubscriber(id, updates) {
  const subscriber = db.prepare('SELECT * FROM email_subscribers WHERE id = ?').get(id);
  if (!subscriber) return null;

  const stmt = db.prepare(`
    UPDATE email_subscribers SET
      email = ?,
      name = ?,
      enabled = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  stmt.run(
    updates.email || subscriber.email,
    updates.name !== undefined ? updates.name : subscriber.name,
    updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : subscriber.enabled,
    id
  );
  
  return db.prepare('SELECT * FROM email_subscribers WHERE id = ?').get(id);
}

/**
 * Delete email subscriber
 */
export function deleteEmailSubscriber(id) {
  const stmt = db.prepare('DELETE FROM email_subscribers WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Send signal notification email
 */
export async function sendSignalNotification(signal) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('Email notifications not configured or disabled');
    return { sent: 0, failed: 0 };
  }

  const settings = getEmailSettings();
  const subscribers = getEnabledSubscribers();
  
  if (subscribers.length === 0) {
    console.log('No enabled subscribers to notify');
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const emailSubject = `🚨 ${signal.type} Signal - $${signal.price.toFixed(2)}`;
  const emailBody = generateSignalEmail(signal);

  for (const subscriber of subscribers) {
    try {
      await transporter.sendMail({
        from: `"${settings.fromName}" <${settings.fromEmail}>`,
        to: subscriber.email,
        subject: emailSubject,
        html: emailBody,
      });

      // Log successful send
      const logStmt = db.prepare(`
        INSERT INTO email_notifications (subscriber_email, signal_id, signal_type, status)
        VALUES (?, ?, ?, 'sent')
      `);
      logStmt.run(subscriber.email, signal.id, signal.type);
      
      sent++;
    } catch (error) {
      console.error(`Failed to send email to ${subscriber.email}:`, error);
      
      // Log failed send
      const logStmt = db.prepare(`
        INSERT INTO email_notifications (subscriber_email, signal_id, signal_type, status, error_message)
        VALUES (?, ?, ?, 'failed', ?)
      `);
      logStmt.run(subscriber.email, signal.id, signal.type, error.message);
      
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Generate HTML email for signal
 */
function generateSignalEmail(signal) {
  const isBuy = signal.type === 'BUY';
  const color = isBuy ? '#22c55e' : '#ef4444';
  const emoji = isBuy ? '🟢' : '🔴';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .price { font-size: 32px; font-weight: bold; color: #111827; margin: 20px 0; }
    .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
    .strength { display: inline-block; padding: 5px 15px; background: ${color}; color: white; border-radius: 20px; font-size: 14px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} ${signal.type} SIGNAL</h1>
      <span class="strength">${signal.strength}</span>
    </div>
    <div class="content">
      <div class="price">$${signal.price.toFixed(2)}</div>
      
      <div class="details">
        <div class="detail-row">
          <span>Signal Type:</span>
          <strong>${signal.type}</strong>
        </div>
        <div class="detail-row">
          <span>Signal Strength:</span>
          <strong>${signal.strength}</strong>
        </div>
        <div class="detail-row">
          <span>Fibonacci Level:</span>
          <strong>${signal.fibLevel}</strong>
        </div>
        <div class="detail-row">
          <span>Time:</span>
          <strong>${new Date(signal.timestamp).toLocaleString()}</strong>
        </div>
      </div>
      
      <p><strong>Explanation:</strong></p>
      <p>${signal.explanation?.replace(/\n/g, '<br>') || 'No explanation provided.'}</p>
      
      ${signal.macroContext ? `
      <div class="details">
        <h3>📊 Macro Context</h3>
        <div class="detail-row">
          <span>Regime:</span>
          <strong>${signal.macroContext.regime}</strong>
        </div>
        <div class="detail-row">
          <span>Gold Bias:</span>
          <strong>${signal.macroContext.goldBias}</strong>
        </div>
        <div class="detail-row">
          <span>Macro Confirms:</span>
          <strong>${signal.macroContext.confirms ? 'Yes' : 'No'}</strong>
        </div>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>This is an automated notification from Gold Fib Signals.</p>
      <p>For educational purposes only. Not financial advice.</p>
      <p>Visit <a href="https://trade-gold.scottkennedy.dev">Gold Fib Signals</a> for more details.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Get email notification statistics
 */
export function getEmailStats() {
  const totalSent = db.prepare("SELECT COUNT(*) as count FROM email_notifications WHERE status = 'sent'").get();
  const totalFailed = db.prepare("SELECT COUNT(*) as count FROM email_notifications WHERE status = 'failed'").get();
  const recentNotifications = db.prepare(`
    SELECT * FROM email_notifications 
    ORDER BY sent_at DESC 
    LIMIT 50
  `).all();
  
  return {
    totalSent: totalSent.count,
    totalFailed: totalFailed.count,
    recentNotifications,
  };
}

export default {
  initEmailSettings,
  getEmailSettings,
  updateEmailSettings,
  testEmailConfiguration,
  getEmailSubscribers,
  getEnabledSubscribers,
  addEmailSubscriber,
  updateEmailSubscriber,
  deleteEmailSubscriber,
  sendSignalNotification,
  getEmailStats,
};
