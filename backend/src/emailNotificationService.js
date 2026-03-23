import db from './database.js';
import nodemailer from 'nodemailer';
import { 
  encrypt, 
  decrypt, 
  hashEmail, 
  generateToken, 
  hashToken,
  isEncryptionConfigured 
} from './encryptionService.js';

// Token expiry: 7 days
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Rate limiting: 3 requests per IP per day
const RATE_LIMIT_REQUESTS = 3;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// In-memory rate limit store (resets on server restart)
const rateLimitStore = new Map();

// Email transporter cache
let emailTransporter = null;

/**
 * Initialize database tables for secure email notifications
 */
export function initSecureEmailTables() {
  // Encrypted email subscribers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_hash TEXT UNIQUE NOT NULL,
      email_encrypted TEXT NOT NULL,
      name TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'unsubscribed', 'rejected')),
      verification_method TEXT CHECK(verification_method IN ('stripe', 'manual', null)),
      stripe_payment_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      unsubscribed_at DATETIME
    )
  `);

  // Subscription requests table (for approval workflow)
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_hash TEXT NOT NULL,
      email_encrypted TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      token_hash TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'expired')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      approved_at DATETIME,
      approved_by TEXT,
      rejected_at DATETIME,
      rejection_reason TEXT
    )
  `);

  // Admin notification settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_notification_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      admin_email TEXT,
      require_approval INTEGER DEFAULT 1,
      require_donation INTEGER DEFAULT 0,
      min_donation_amount INTEGER DEFAULT 0,
      email_subject_prefix TEXT DEFAULT '[Gold Fib Signals]',
      notification_email_template TEXT DEFAULT 'default',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Email audit log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      email_hash TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Unsubscribe tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_hash TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      token_hash TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME
    )
  `);

  // Stripe webhook events table (for idempotency)
  db.exec(`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payment_intent_id TEXT,
      customer_email TEXT,
      amount INTEGER,
      currency TEXT,
      status TEXT NOT NULL,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default admin settings if not exists
  const insertDefault = db.prepare(`
    INSERT OR IGNORE INTO admin_notification_settings 
    (id, admin_email, require_approval, require_donation, min_donation_amount)
    VALUES (1, '', 1, 0, 0)
  `);
  insertDefault.run();

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_subscribers_email_hash ON email_subscribers(email_hash);
    CREATE INDEX IF NOT EXISTS idx_subscribers_status ON email_subscribers(status);
    CREATE INDEX IF NOT EXISTS idx_requests_token_hash ON subscription_requests(token_hash);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON subscription_requests(status);
    CREATE INDEX IF NOT EXISTS idx_requests_expires ON subscription_requests(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_email_hash ON email_audit_log(email_hash);
    CREATE INDEX IF NOT EXISTS idx_unsubscribe_token_hash ON unsubscribe_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_stripe_events_payment ON stripe_webhook_events(payment_intent_id);
  `);

  console.log('✅ Secure email notification tables initialized');
}

// ==================== RATE LIMITING ====================

/**
 * Check if IP is rate limited
 * @param {string} ip - IP address
 * @returns {object} Rate limit status
 */
export function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip;
  
  const record = rateLimitStore.get(key);
  
  if (!record) {
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }
  
  // Reset if window has passed
  if (now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }
  
  // Check limit
  if (record.count >= RATE_LIMIT_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  
  return { allowed: true, remaining: RATE_LIMIT_REQUESTS - record.count - 1, resetAt: record.resetAt };
}

/**
 * Increment rate limit counter for IP
 * @param {string} ip - IP address
 */
function incrementRateLimit(ip) {
  const now = Date.now();
  const key = ip;
  
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
  } else {
    record.count++;
  }
}

// ==================== SUBSCRIPTION REQUESTS ====================

/**
 * Request email subscription (creates pending request)
 * @param {string} email - Email address
 * @param {string} name - Optional name
 * @param {string} ip - IP address
 * @param {string} userAgent - User agent string
 * @returns {object} Result with token
 */
export function requestSubscription(email, name = '', ip = null, userAgent = null) {
  // Check rate limit
  const rateLimit = checkRateLimit(ip || 'unknown');
  if (!rateLimit.allowed) {
    const hoursUntilReset = Math.ceil((rateLimit.resetAt - Date.now()) / (60 * 60 * 1000));
    throw new Error(`Rate limit exceeded. Please try again in ${hoursUntilReset} hour(s).`);
  }

  // Validate email
  if (!email || !isValidEmail(email)) {
    throw new Error('Invalid email address');
  }

  // Check if encryption is configured
  if (!isEncryptionConfigured()) {
    throw new Error('Email encryption is not configured. Please contact the administrator.');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const emailHash = hashEmail(normalizedEmail);
  
  // Check if already subscribed
  const existingSubscriber = db.prepare('SELECT status FROM email_subscribers WHERE email_hash = ?').get(emailHash);
  if (existingSubscriber) {
    if (existingSubscriber.status === 'active') {
      throw new Error('This email is already subscribed to notifications.');
    } else if (existingSubscriber.status === 'pending') {
      throw new Error('This email has a pending subscription request. Please check your email for approval.');
    }
  }

  // Check for existing pending request
  const existingRequest = db.prepare(`
    SELECT * FROM subscription_requests 
    WHERE email_hash = ? AND status = 'pending' AND expires_at > datetime('now')
  `).get(emailHash);
  
  if (existingRequest) {
    throw new Error('A subscription request is already pending for this email. Please wait for admin approval.');
  }

  // Create new request
  const token = generateToken();
  const tokenHash = hashToken(token);
  const encryptedEmail = encrypt(normalizedEmail);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();

  const insert = db.prepare(`
    INSERT INTO subscription_requests 
    (email_hash, email_encrypted, token, token_hash, ip_address, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  insert.run(emailHash, encryptedEmail, token, tokenHash, ip, userAgent, expiresAt);

  // Increment rate limit
  incrementRateLimit(ip || 'unknown');

  // Log audit
  logAuditAction('subscription_requested', emailHash, { ip, name }, ip, userAgent);

  // Send admin notification
  sendAdminApprovalRequest(normalizedEmail, name, token);

  return {
    success: true,
    message: 'Subscription request submitted. An administrator will review your request.',
    email: maskEmail(normalizedEmail)
  };
}

/**
 * Approve subscription request
 * @param {string} token - Approval token
 * @param {string} adminIdentifier - Admin who approved
 * @returns {object} Result
 */
export function approveSubscription(token, adminIdentifier = 'admin') {
  const tokenHash = hashToken(token);
  
  const request = db.prepare(`
    SELECT * FROM subscription_requests 
    WHERE token_hash = ? AND status = 'pending'
  `).get(tokenHash);
  
  if (!request) {
    throw new Error('Invalid or expired approval token.');
  }
  
  // Check expiry
  if (new Date(request.expires_at) < new Date()) {
    // Mark as expired
    db.prepare("UPDATE subscription_requests SET status = 'expired' WHERE id = ?").run(request.id);
    throw new Error('This approval request has expired.');
  }

  const email = decrypt(request.email_encrypted);
  
  // Update request status
  const updateRequest = db.prepare(`
    UPDATE subscription_requests 
    SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ?
    WHERE id = ?
  `);
  updateRequest.run(adminIdentifier, request.id);

  // Add to subscribers
  const insertSubscriber = db.prepare(`
    INSERT INTO email_subscribers (email_hash, email_encrypted, name, status, verification_method)
    VALUES (?, ?, ?, 'active', 'manual')
    ON CONFLICT(email_hash) DO UPDATE SET
      status = 'active',
      updated_at = CURRENT_TIMESTAMP,
      verification_method = 'manual'
  `);
  insertSubscriber.run(request.email_hash, request.email_encrypted, request.name || '');

  // Generate unsubscribe token
  const unsubscribeToken = generateUnsubscribeToken(request.email_hash);

  // Log audit
  logAuditAction('subscription_approved', request.email_hash, { approved_by: adminIdentifier }, null, null);

  // Send welcome email
  sendWelcomeEmail(email, request.name || '', unsubscribeToken);

  return {
    success: true,
    message: 'Subscription approved successfully.',
    email: maskEmail(email)
  };
}

/**
 * Reject subscription request
 * @param {string} token - Approval token
 * @param {string} reason - Rejection reason
 * @param {string} adminIdentifier - Admin who rejected
 * @returns {object} Result
 */
export function rejectSubscription(token, reason = '', adminIdentifier = 'admin') {
  const tokenHash = hashToken(token);
  
  const request = db.prepare(`
    SELECT * FROM subscription_requests 
    WHERE token_hash = ? AND status = 'pending'
  `).get(tokenHash);
  
  if (!request) {
    throw new Error('Invalid or expired rejection token.');
  }
  
  // Check expiry
  if (new Date(request.expires_at) < new Date()) {
    db.prepare("UPDATE subscription_requests SET status = 'expired' WHERE id = ?").run(request.id);
    throw new Error('This request has expired.');
  }

  const email = decrypt(request.email_encrypted);
  
  // Update request status
  const updateRequest = db.prepare(`
    UPDATE subscription_requests 
    SET status = 'rejected', rejected_at = CURRENT_TIMESTAMP, rejection_reason = ?
    WHERE id = ?
  `);
  updateRequest.run(reason || null, request.id);

  // Mark subscriber as rejected if exists
  db.prepare("UPDATE email_subscribers SET status = 'rejected' WHERE email_hash = ?").run(request.email_hash);

  // Log audit
  logAuditAction('subscription_rejected', request.email_hash, { reason, rejected_by: adminIdentifier }, null, null);

  // Send rejection email
  sendRejectionEmail(email, reason);

  return {
    success: true,
    message: 'Subscription request rejected.',
    email: maskEmail(email)
  };
}

/**
 * Get pending subscription requests
 * @returns {array} Pending requests
 */
export function getPendingRequests() {
  const requests = db.prepare(`
    SELECT 
      id,
      email_hash,
      email_encrypted,
      token,
      ip_address,
      status,
      created_at,
      expires_at
    FROM subscription_requests 
    WHERE status = 'pending' AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `).all();

  return requests.map(req => ({
    id: req.id,
    emailHash: req.email_hash,
    emailMasked: maskEmail(decrypt(req.email_encrypted)),
    ipAddress: req.ip_address,
    createdAt: req.created_at,
    expiresAt: req.expires_at,
    token: req.token
  }));
}

// ==================== UNSUBSCRIBE ====================

/**
 * Generate unsubscribe token
 * @param {string} emailHash - Email hash
 * @returns {string} Unsubscribe token
 */
function generateUnsubscribeToken(emailHash) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  
  const insert = db.prepare(`
    INSERT INTO unsubscribe_tokens (email_hash, token, token_hash)
    VALUES (?, ?, ?)
  `);
  insert.run(emailHash, token, tokenHash);
  
  return token;
}

/**
 * Unsubscribe using token
 * @param {string} token - Unsubscribe token
 * @returns {object} Result
 */
export function unsubscribe(token) {
  const tokenHash = hashToken(token);
  
  const tokenRecord = db.prepare(`
    SELECT * FROM unsubscribe_tokens 
    WHERE token_hash = ? AND used = 0
  `).get(tokenHash);
  
  if (!tokenRecord) {
    throw new Error('Invalid or already used unsubscribe link.');
  }

  // Mark token as used
  db.prepare(`
    UPDATE unsubscribe_tokens 
    SET used = 1, used_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(tokenRecord.id);

  // Update subscriber status
  db.prepare(`
    UPDATE email_subscribers 
    SET status = 'unsubscribed', unsubscribed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE email_hash = ?
  `).run(tokenRecord.email_hash);

  // Log audit
  logAuditAction('unsubscribed', tokenRecord.email_hash, {}, null, null);

  return {
    success: true,
    message: 'You have been successfully unsubscribed from email notifications.'
  };
}

// ==================== STRIPE WEBHOOK ====================

/**
 * Handle Stripe webhook for donation verification
 * @param {object} event - Stripe event object
 * @returns {object} Result
 */
export function handleStripeWebhook(event) {
  // Check for duplicate events
  const existingEvent = db.prepare('SELECT id FROM stripe_webhook_events WHERE id = ?').get(event.id);
  if (existingEvent) {
    return { success: true, message: 'Event already processed', duplicate: true };
  }

  // Store event
  const insertEvent = db.prepare(`
    INSERT INTO stripe_webhook_events 
    (id, event_type, payment_intent_id, customer_email, amount, currency, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let email = null;
  let paymentIntentId = null;
  let amount = null;
  let currency = null;

  switch (event.type) {
    case 'payment_intent.succeeded':
    case 'charge.succeeded':
      const object = event.data.object;
      paymentIntentId = object.id;
      email = object.receipt_email || (object.charges?.data[0]?.receipt_email);
      amount = object.amount;
      currency = object.currency;
      
      insertEvent.run(event.id, event.type, paymentIntentId, email, amount, currency, 'processed');
      
      // If we have an email and it matches a pending request, auto-approve
      if (email) {
        autoApproveByDonation(email, paymentIntentId, amount, currency);
      }
      break;
      
    case 'checkout.session.completed':
      const session = event.data.object;
      email = session.customer_email || session.customer_details?.email;
      paymentIntentId = session.payment_intent;
      amount = session.amount_total;
      currency = session.currency;
      
      insertEvent.run(event.id, event.type, paymentIntentId, email, amount, currency, 'processed');
      
      if (email) {
        autoApproveByDonation(email, paymentIntentId, amount, currency);
      }
      break;
      
    default:
      insertEvent.run(event.id, event.type, null, null, null, null, 'ignored');
  }

  return { success: true, message: 'Event processed' };
}

/**
 * Auto-approve subscription by donation
 * @param {string} email - Customer email
 * @param {string} paymentIntentId - Payment intent ID
 * @param {number} amount - Amount in cents
 * @param {string} currency - Currency code
 */
function autoApproveByDonation(email, paymentIntentId, amount, currency) {
  const normalizedEmail = email.toLowerCase().trim();
  const emailHash = hashEmail(normalizedEmail);
  
  // Check settings
  const settings = getAdminNotificationSettings();
  if (!settings.require_donation) {
    return; // Auto-approval not enabled
  }

  // Check minimum amount
  const minAmount = settings.min_donation_amount || 0;
  if (amount < minAmount * 100) { // Stripe amounts are in cents
    console.log(`Donation amount ${amount} below minimum ${minAmount * 100}`);
    return;
  }

  // Find pending request
  const pendingRequest = db.prepare(`
    SELECT * FROM subscription_requests 
    WHERE email_hash = ? AND status = 'pending'
  `).get(emailHash);
  
  if (pendingRequest) {
    // Approve the request
    const token = pendingRequest.token;
    approveSubscription(token, 'stripe_webhook');
    
    // Update subscriber with donation info
    db.prepare(`
      UPDATE email_subscribers 
      SET verification_method = 'stripe', stripe_payment_id = ?
      WHERE email_hash = ?
    `).run(paymentIntentId, emailHash);
    
    console.log(`Auto-approved subscription for ${maskEmail(email)} via Stripe donation`);
  }
}

// ==================== ADMIN SETTINGS ====================

/**
 * Get admin notification settings
 * @returns {object} Settings
 */
export function getAdminNotificationSettings() {
  const stmt = db.prepare('SELECT * FROM admin_notification_settings WHERE id = 1');
  const settings = stmt.get();
  return settings || {
    admin_email: '',
    require_approval: 1,
    require_donation: 0,
    min_donation_amount: 0,
    email_subject_prefix: '[Gold Fib Signals]'
  };
}

/**
 * Update admin notification settings
 * @param {object} updates - Settings to update
 * @returns {object} Updated settings
 */
export function updateAdminNotificationSettings(updates) {
  const fields = [];
  const values = [];
  
  if (updates.adminEmail !== undefined) {
    fields.push('admin_email = ?');
    values.push(updates.adminEmail);
  }
  if (updates.requireApproval !== undefined) {
    fields.push('require_approval = ?');
    values.push(updates.requireApproval ? 1 : 0);
  }
  if (updates.requireDonation !== undefined) {
    fields.push('require_donation = ?');
    values.push(updates.requireDonation ? 1 : 0);
  }
  if (updates.minDonationAmount !== undefined) {
    fields.push('min_donation_amount = ?');
    values.push(updates.minDonationAmount);
  }
  if (updates.emailSubjectPrefix !== undefined) {
    fields.push('email_subject_prefix = ?');
    values.push(updates.emailSubjectPrefix);
  }
  
  if (fields.length === 0) {
    return getAdminNotificationSettings();
  }
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  
  const query = `UPDATE admin_notification_settings SET ${fields.join(', ')} WHERE id = 1`;
  db.prepare(query).run(...values);
  
  return getAdminNotificationSettings();
}

// ==================== EMAIL SENDING ====================

/**
 * Get or create email transporter
 * @returns {object} Nodemailer transporter
 */
function getTransporter() {
  if (emailTransporter) {
    return emailTransporter;
  }

  const settings = db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
  
  if (!settings || !settings.enabled || !settings.smtpHost) {
    return null;
  }

  emailTransporter = nodemailer.createTransporter({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
  });

  return emailTransporter;
}

/**
 * Send admin approval request email
 * @param {string} subscriberEmail - Requester's email
 * @param {string} name - Requester's name
 * @param {string} token - Approval token
 */
async function sendAdminApprovalRequest(subscriberEmail, name, token) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('Email not configured, skipping admin approval request');
    return;
  }

  const settings = db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
  const adminSettings = getAdminNotificationSettings();
  
  const adminEmail = adminSettings.admin_email || settings.smtpUser;
  if (!adminEmail) {
    console.log('No admin email configured, skipping approval request');
    return;
  }

  // Get base URL from environment or default
  const baseUrl = process.env.APP_URL || 'https://trade-gold.scottkennedy.dev';
  const approveUrl = `${baseUrl}/api/notifications/approve/${token}`;
  const rejectUrl = `${baseUrl}/api/notifications/reject/${token}`;
  const adminPanelUrl = `${baseUrl}/admin`;

  const subject = `${adminSettings.email_subject_prefix} New Subscription Request`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; margin: 5px; border-radius: 6px; text-decoration: none; font-weight: bold; }
    .approve { background: #22c55e; color: white; }
    .reject { background: #ef4444; color: white; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 New Subscription Request</h1>
    </div>
    <div class="content">
      <p>A new user has requested to subscribe to Gold Fib Signals email notifications.</p>
      
      <div class="details">
        <p><strong>Email:</strong> ${maskEmail(subscriberEmail)}</p>
        <p><strong>Name:</strong> ${name || 'Not provided'}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>
      
      <p><strong>Actions:</strong></p>
      <div style="text-align: center;">
        <a href="${approveUrl}" class="button approve">✓ Approve</a>
        <a href="${rejectUrl}" class="button reject">✗ Reject</a>
      </div>
      
      <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
        You can also manage this request from the <a href="${adminPanelUrl}">Admin Panel</a>.
      </p>
    </div>
    
    <div class="footer">
      <p>This is an automated message from Gold Fib Signals.</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: adminEmail,
      subject,
      html,
      // Don't include subscriber email in headers for privacy
      headers: {
        'X-Request-Type': 'subscription-approval'
      }
    });
    console.log(`📧 Admin approval request sent for ${maskEmail(subscriberEmail)}`);
  } catch (error) {
    console.error('Failed to send admin approval request:', error);
  }
}

/**
 * Send welcome email to new subscriber
 * @param {string} email - Subscriber email
 * @param {string} name - Subscriber name
 * @param {string} unsubscribeToken - Unsubscribe token
 */
async function sendWelcomeEmail(email, name, unsubscribeToken) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('Email not configured, skipping welcome email');
    return;
  }

  const settings = db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
  const adminSettings = getAdminNotificationSettings();
  
  const baseUrl = process.env.APP_URL || 'https://trade-gold.scottkennedy.dev';
  const unsubscribeUrl = `${baseUrl}/api/notifications/unsubscribe/${unsubscribeToken}`;

  const subject = `${adminSettings.email_subject_prefix} Welcome to Gold Fib Signals!`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .feature { display: flex; align-items: center; margin: 10px 0; }
    .feature-icon { width: 24px; height: 24px; margin-right: 10px; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
    .unsubscribe { color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🥇 Welcome to Gold Fib Signals!</h1>
      <p>Your subscription has been approved</p>
    </div>
    <div class="content">
      <p>Hi${name ? ' ' + name : ''},</p>
      
      <p>Welcome to Gold Fib Signals! You'll now receive email notifications whenever we publish new trading signals.</p>
      
      <div class="features">
        <h3>What you'll get:</h3>
        <div class="feature">
          <span class="feature-icon">🚨</span>
          <span>Instant alerts for BUY and SELL signals</span>
        </div>
        <div class="feature">
          <span class="feature-icon">📊</span>
          <span>Signal strength and Fibonacci level analysis</span>
        </div>
        <div class="feature">
          <span class="feature-icon">🌍</span>
          <span>Macro context and market regime insights</span>
        </div>
        <div class="feature">
          <span class="feature-icon">⚡</span>
          <span>Real-time notifications when opportunities arise</span>
        </div>
      </div>
      
      <p>You can manage your subscription or unsubscribe at any time:</p>
      <p style="text-align: center;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
      </p>
    </div>
    
    <div class="footer">
      <p>Gold Fib Signals - For educational purposes only. Not financial advice.</p>
      <p><a href="${baseUrl}" style="color: #f59e0b;">Visit our website</a></p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: email,
      subject,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'X-Subscription-Type': 'gold-fib-signals'
      }
    });
    console.log(`📧 Welcome email sent to ${maskEmail(email)}`);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }
}

/**
 * Send rejection email
 * @param {string} email - Subscriber email
 * @param {string} reason - Rejection reason
 */
async function sendRejectionEmail(email, reason) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('Email not configured, skipping rejection email');
    return;
  }

  const settings = db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
  const adminSettings = getAdminNotificationSettings();
  
  const baseUrl = process.env.APP_URL || 'https://trade-gold.scottkennedy.dev';

  const subject = `${adminSettings.email_subject_prefix} Subscription Request Update`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6b7280; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Subscription Request</h1>
    </div>
    <div class="content">
      <p>Thank you for your interest in Gold Fib Signals.</p>
      
      <p>We regret to inform you that your subscription request could not be approved at this time.</p>
      
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      
      <p>If you believe this is an error or have any questions, please contact us.</p>
      
      <p>You can still access all our signals on our website:</p>
      <p style="text-align: center;">
        <a href="${baseUrl}" style="color: #f59e0b; font-weight: bold;">Visit Gold Fib Signals</a>
      </p>
    </div>
    
    <div class="footer">
      <p>Gold Fib Signals</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: email,
      subject,
      html
    });
    console.log(`📧 Rejection email sent to ${maskEmail(email)}`);
  } catch (error) {
    console.error('Failed to send rejection email:', error);
  }
}

// ==================== AUDIT LOGGING ====================

/**
 * Log audit action
 * @param {string} action - Action type
 * @param {string} emailHash - Hashed email
 * @param {object} details - Additional details
 * @param {string} ip - IP address
 * @param {string} userAgent - User agent
 */
function logAuditAction(action, emailHash, details = {}, ip = null, userAgent = null) {
  try {
    const insert = db.prepare(`
      INSERT INTO email_audit_log (action, email_hash, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `);
    insert.run(action, emailHash, JSON.stringify(details), ip, userAgent);
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
}

/**
 * Get audit log
 * @param {number} limit - Number of entries to return
 * @returns {array} Audit log entries
 */
export function getAuditLog(limit = 100) {
  const stmt = db.prepare(`
    SELECT * FROM email_audit_log 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(limit).map(entry => ({
    ...entry,
    details: JSON.parse(entry.details || '{}')
  }));
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Mask email for display
 * @param {string} email - Email to mask
 * @returns {string} Masked email
 */
function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  
  const maskedLocal = local.length > 2 
    ? local.slice(0, 2) + '***' 
    : '***';
  
  const [domainName, tld] = domain.split('.');
  const maskedDomain = domainName.length > 2
    ? domainName.slice(0, 2) + '***'
    : '***';
  
  return `${maskedLocal}@${maskedDomain}.${tld}`;
}

// ==================== STATS ====================

/**
 * Get secure email notification stats
 * @returns {object} Statistics
 */
export function getSecureEmailStats() {
  const totalSubscribers = db.prepare("SELECT COUNT(*) as count FROM email_subscribers WHERE status = 'active'").get();
  const pendingRequests = db.prepare("SELECT COUNT(*) as count FROM subscription_requests WHERE status = 'pending'").get();
  const totalUnsubscribed = db.prepare("SELECT COUNT(*) as count FROM email_subscribers WHERE status = 'unsubscribed'").get();
  const totalRejected = db.prepare("SELECT COUNT(*) as count FROM email_subscribers WHERE status = 'rejected'").get();
  const recentAudit = db.prepare('SELECT * FROM email_audit_log ORDER BY created_at DESC LIMIT 10').all();
  
  return {
    subscribers: {
      active: totalSubscribers.count,
      pending: pendingRequests.count,
      unsubscribed: totalUnsubscribed.count,
      rejected: totalRejected.count
    },
    recentActivity: recentAudit.map(entry => ({
      ...entry,
      details: JSON.parse(entry.details || '{}')
    }))
  };
}

export default {
  initSecureEmailTables,
  requestSubscription,
  approveSubscription,
  rejectSubscription,
  unsubscribe,
  getPendingRequests,
  handleStripeWebhook,
  getAdminNotificationSettings,
  updateAdminNotificationSettings,
  getAuditLog,
  getSecureEmailStats,
  checkRateLimit,
};