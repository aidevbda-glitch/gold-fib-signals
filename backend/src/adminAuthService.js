import db from './database.js';
import crypto from 'crypto';
import { authenticator } from 'otplib';

// Initialize admin auth table
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_auth (
    id TEXT PRIMARY KEY DEFAULT 'admin',
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    is_temp_password INTEGER DEFAULT 1,
    mfa_enabled INTEGER DEFAULT 0,
    mfa_secret TEXT,
    mfa_backup_codes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    mfa_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
`);

// Default temp password
const DEFAULT_TEMP_PASSWORD = 'GoldFib2024!';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hash a password with salt
 */
function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Initialize admin account with default password if not exists
 */
function initializeAdmin() {
  const existing = db.prepare('SELECT id FROM admin_auth WHERE id = ?').get('admin');
  if (!existing) {
    const { hash, salt } = hashPassword(DEFAULT_TEMP_PASSWORD);
    db.prepare(`
      INSERT INTO admin_auth (id, password_hash, password_salt, is_temp_password)
      VALUES ('admin', ?, ?, 1)
    `).run(hash, salt);
    console.log('🔐 Admin account initialized with default password');
  }
}

// Initialize on load
initializeAdmin();

/**
 * Verify password
 */
export function verifyPassword(password) {
  const admin = db.prepare('SELECT password_hash, password_salt FROM admin_auth WHERE id = ?').get('admin');
  if (!admin) return false;
  
  const { hash } = hashPassword(password, admin.password_salt);
  return hash === admin.password_hash;
}

/**
 * Change password
 */
export function changePassword(currentPassword, newPassword) {
  if (!verifyPassword(currentPassword)) {
    return { success: false, error: 'Current password is incorrect' };
  }
  
  if (newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' };
  }
  
  const { hash, salt } = hashPassword(newPassword);
  db.prepare(`
    UPDATE admin_auth SET 
      password_hash = ?, 
      password_salt = ?, 
      is_temp_password = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 'admin'
  `).run(hash, salt);
  
  return { success: true };
}

/**
 * Create a session token
 */
export function createSession(mfaVerified = false) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  
  db.prepare(`
    INSERT INTO admin_sessions (id, admin_id, expires_at, mfa_verified)
    VALUES (?, 'admin', ?, ?)
  `).run(sessionId, expiresAt, mfaVerified ? 1 : 0);
  
  // Clean up expired sessions
  db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now());
  
  return { sessionId, expiresAt };
}

/**
 * Verify session token
 */
export function verifySession(sessionId) {
  if (!sessionId) return { valid: false };
  
  const session = db.prepare(`
    SELECT * FROM admin_sessions WHERE id = ? AND expires_at > ?
  `).get(sessionId, Date.now());
  
  if (!session) return { valid: false };
  
  const admin = db.prepare('SELECT mfa_enabled, is_temp_password FROM admin_auth WHERE id = ?').get('admin');
  
  return {
    valid: true,
    mfaVerified: !!session.mfa_verified,
    mfaRequired: !!admin.mfa_enabled,
    isTempPassword: !!admin.is_temp_password
  };
}

/**
 * Update session MFA status
 */
export function updateSessionMfa(sessionId, verified) {
  db.prepare(`
    UPDATE admin_sessions SET mfa_verified = ? WHERE id = ?
  `).run(verified ? 1 : 0, sessionId);
}

/**
 * Invalidate session (logout)
 */
export function invalidateSession(sessionId) {
  db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(sessionId);
}

/**
 * Setup MFA - generate secret and backup codes
 */
export function setupMfa() {
  const secret = authenticator.generateSecret();
  const backupCodes = Array.from({ length: 8 }, () => 
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
  
  // Don't save yet - just return for user to verify first
  return {
    secret,
    otpauthUrl: authenticator.keyuri('admin', 'GoldFibSignals', secret),
    backupCodes
  };
}

/**
 * Verify and enable MFA
 */
export function enableMfa(secret, token, backupCodes) {
  const isValid = authenticator.verify({ token, secret });
  
  if (!isValid) {
    return { success: false, error: 'Invalid verification code' };
  }
  
  db.prepare(`
    UPDATE admin_auth SET 
      mfa_enabled = 1, 
      mfa_secret = ?, 
      mfa_backup_codes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 'admin'
  `).run(secret, JSON.stringify(backupCodes));
  
  return { success: true };
}

/**
 * Verify MFA token
 */
export function verifyMfa(token) {
  const admin = db.prepare('SELECT mfa_secret, mfa_backup_codes FROM admin_auth WHERE id = ?').get('admin');
  
  if (!admin || !admin.mfa_secret) {
    return { success: false, error: 'MFA not configured' };
  }
  
  // Check TOTP token
  if (authenticator.verify({ token, secret: admin.mfa_secret })) {
    return { success: true };
  }
  
  // Check backup codes
  const backupCodes = JSON.parse(admin.mfa_backup_codes || '[]');
  const codeIndex = backupCodes.indexOf(token.toUpperCase());
  
  if (codeIndex !== -1) {
    // Remove used backup code
    backupCodes.splice(codeIndex, 1);
    db.prepare(`
      UPDATE admin_auth SET mfa_backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'admin'
    `).run(JSON.stringify(backupCodes));
    
    return { success: true, usedBackupCode: true, remainingBackupCodes: backupCodes.length };
  }
  
  return { success: false, error: 'Invalid code' };
}

/**
 * Disable MFA
 */
export function disableMfa(password) {
  if (!verifyPassword(password)) {
    return { success: false, error: 'Invalid password' };
  }
  
  db.prepare(`
    UPDATE admin_auth SET 
      mfa_enabled = 0, 
      mfa_secret = NULL, 
      mfa_backup_codes = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 'admin'
  `).run();
  
  return { success: true };
}

/**
 * Get admin status (for frontend)
 */
export function getAdminStatus() {
  const admin = db.prepare('SELECT mfa_enabled, is_temp_password, updated_at FROM admin_auth WHERE id = ?').get('admin');
  
  return {
    mfaEnabled: !!admin?.mfa_enabled,
    isTempPassword: !!admin?.is_temp_password,
    lastUpdated: admin?.updated_at
  };
}

export default {
  verifyPassword,
  changePassword,
  createSession,
  verifySession,
  updateSessionMfa,
  invalidateSession,
  setupMfa,
  enableMfa,
  verifyMfa,
  disableMfa,
  getAdminStatus
};
