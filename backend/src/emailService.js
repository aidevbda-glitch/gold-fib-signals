import nodemailer from 'nodemailer';
import db from './database.js';
import { decrypt, hashEmail } from './encryptionService.js';

// Email configuration store
let emailConfig = null;

/**
 * Initialize email settings table
 * NOTE: Tables are now created by emailNotificationService.js with encrypted storage
 * This function only inserts default settings for backward compatibility
 */
export function initEmailSettings() {
  // Insert default settings if not exists (table created by emailNotificationService.js)
  const insertDefault = db.prepare(`
    INSERT OR IGNORE INTO admin_notification_settings (id, admin_email, require_approval, require_donation, min_donation_amount)
    VALUES (1, '', 1, 0, 0)
  `);
  insertDefault.run();
}

/**
 * Get email settings (legacy - uses admin_notification_settings)
 */
export function getEmailSettings() {
  const stmt = db.prepare('SELECT * FROM admin_notification_settings WHERE id = 1');
  const settings = stmt.get();
  if (!settings) return null;
  
  // Map new schema to legacy format
  return {
    id: 1,
    smtpHost: '', // SMTP settings now from env vars
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    fromEmail: settings.admin_email || '',
    fromName: settings.email_subject_prefix || 'Gold Fib Signals',
    enabled: 1, // Always enabled if admin_email is set
    require_approval: settings.require_approval,
    require_donation: settings.require_donation,
    updated_at: settings.updated_at
  };
}

/**
 * Update email settings (legacy)
 */
export function updateEmailSettings(settings) {
  const stmt = db.prepare(`
    UPDATE admin_notification_settings SET
      admin_email = ?,
      email_subject_prefix = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);
  
  stmt.run(
    settings.fromEmail || settings.admin_email || '',
    settings.fromName || 'Gold Fib Signals'
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
 * Get all email subscribers (legacy - returns masked emails)
 */
export function getEmailSubscribers() {
  const stmt = db.prepare(`
    SELECT id, email_hash, email_encrypted, name, status, 
           verification_method, created_at, updated_at
    FROM email_subscribers 
    ORDER BY created_at DESC
  `);
  const rows = stmt.all();
  
  return rows.map(row => {
    // Return masked email for privacy
    const email = decrypt(row.email_encrypted) || '***';
    const masked = email.length > 6 
      ? email.substring(0, 3) + '***' + email.substring(email.length - 3)
      : '***';
    
    return {
      id: row.id,
      email: masked,
      emailHash: row.email_hash,
      name: row.name,
      enabled: row.status === 'active' ? 1 : 0,
      status: row.status,
      verification_method: row.verification_method,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  });
}

/**
 * Get enabled/active email subscribers only
 */
export function getEnabledSubscribers() {
  const stmt = db.prepare(`
    SELECT id, email_hash, email_encrypted, name, status
    FROM email_subscribers 
    WHERE status = 'active'
  `);
  const rows = stmt.all();
  
  return rows.map(row => ({
    id: row.id,
    email_hash: row.email_hash,
    email: decrypt(row.email_encrypted), // Decrypt for sending emails
    name: row.name,
    enabled: 1
  }));
}

/**
 * Add email subscriber (legacy - redirects to secure subscription request)
 * Note: This now requires admin approval in the new system
 */
export function addEmailSubscriber(email, name = '') {
  // Hash the email for lookup
  const emailHash = hashEmail(email);
  
  // Check if already exists
  const existing = db.prepare('SELECT status FROM email_subscribers WHERE email_hash = ?').get(emailHash);
  if (existing) {
    return { 
      email, 
      name, 
      enabled: existing.status === 'active' ? 1 : 0,
      status: existing.status,
      note: 'Subscriber already exists'
    };
  }
  
  // Return info that they need to use the secure subscription flow
  return { 
    email, 
    name, 
    enabled: 0,
    status: 'pending',
    note: 'Use POST /api/notifications/request to securely subscribe with approval'
  };
}

/**
 * Update email subscriber (legacy - limited functionality)
 */
export function updateEmailSubscriber(id, updates) {
  const subscriber = db.prepare('SELECT * FROM email_subscribers WHERE id = ?').get(id);
  if (!subscriber) return null;

  // Only allow updating name and status (not email for security)
  const stmt = db.prepare(`
    UPDATE email_subscribers SET
      name = COALESCE(?, name),
      status = CASE 
        WHEN ? = 1 THEN 'active' 
        WHEN ? = 0 THEN 'unsubscribed'
        ELSE status 
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  const enabledValue = updates.enabled !== undefined ? updates.enabled : (subscriber.status === 'active' ? 1 : 0);
  
  stmt.run(
    updates.name,
    enabledValue,
    enabledValue,
    id
  );
  
  return db.prepare('SELECT * FROM email_subscribers WHERE id = ?').get(id);
}

/**
 * Delete email subscriber (legacy)
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

      // Log successful send to audit log
      const logStmt = db.prepare(`
        INSERT INTO email_audit_log (action, email_hash, details, ip_address, user_agent)
        VALUES (?, ?, ?, '', '')
      `);
      logStmt.run(
        'signal_notification_sent', 
        subscriber.email_hash,
        JSON.stringify({ signal_id: signal.id, signal_type: signal.type, status: 'sent' })
      );
      
      sent++;
    } catch (error) {
      console.error(`Failed to send email to subscriber:`, error);
      
      // Log failed send to audit log
      const logStmt = db.prepare(`
        INSERT INTO email_audit_log (action, email_hash, details, ip_address, user_agent)
        VALUES (?, ?, ?, '', '')
      `);
      logStmt.run(
        'signal_notification_failed',
        subscriber.email_hash,
        JSON.stringify({ signal_id: signal.id, signal_type: signal.type, status: 'failed', error: error.message })
      );
      
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
 * Get email notification statistics (legacy - uses new schema)
 */
export function getEmailStats() {
  // Count active subscribers
  const activeCount = db.prepare("SELECT COUNT(*) as count FROM email_subscribers WHERE status = 'active'").get();
  const pendingCount = db.prepare("SELECT COUNT(*) as count FROM email_subscribers WHERE status = 'pending'").get();
  const unsubscribedCount = db.prepare("SELECT COUNT(*) as count FROM email_subscribers WHERE status = 'unsubscribed'").get();
  
  // Count pending requests
  const pendingRequests = db.prepare("SELECT COUNT(*) as count FROM subscription_requests WHERE status = 'pending'").get();
  
  return {
    totalSubscribers: activeCount.count + pendingCount.count + unsubscribedCount.count,
    activeSubscribers: activeCount.count,
    pendingSubscribers: pendingCount.count,
    unsubscribedSubscribers: unsubscribedCount.count,
    pendingRequests: pendingRequests.count,
    // Legacy fields
    totalSent: 0, // No longer tracked in legacy format
    totalFailed: 0,
    recentNotifications: []
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
