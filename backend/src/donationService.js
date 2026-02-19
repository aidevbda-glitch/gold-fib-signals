import db from './database.js';
import { randomUUID } from 'crypto';

// Initialize donations table
db.exec(`
  CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    donor_name TEXT,
    donor_email TEXT,
    message TEXT,
    payment_provider TEXT DEFAULT 'stripe',
    payment_id TEXT,
    status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
    is_anonymous INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at);
  CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
`);

/**
 * Record a new donation
 */
export function recordDonation({
  amount,
  currency = 'USD',
  donorName = null,
  donorEmail = null,
  message = null,
  paymentProvider = 'stripe',
  paymentId = null,
  isAnonymous = false
}) {
  const id = randomUUID();
  
  db.prepare(`
    INSERT INTO donations (id, amount, currency, donor_name, donor_email, message, payment_provider, payment_id, status, is_anonymous)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
  `).run(id, amount, currency, donorName, donorEmail, message, paymentProvider, paymentId, isAnonymous ? 1 : 0);
  
  return { id, amount, currency, donorName, message, createdAt: new Date().toISOString() };
}

/**
 * Get donation statistics
 */
export function getDonationStats() {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(amount), 0) as total_amount,
      COALESCE(AVG(amount), 0) as average_amount,
      MAX(amount) as largest_donation,
      MIN(created_at) as first_donation_at,
      MAX(created_at) as last_donation_at
    FROM donations
    WHERE status = 'completed'
  `).get();
  
  // Get monthly stats
  const monthlyStats = db.prepare(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as count,
      SUM(amount) as amount
    FROM donations
    WHERE status = 'completed'
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month DESC
    LIMIT 12
  `).all();
  
  return {
    totalCount: stats.total_count,
    totalAmount: parseFloat(stats.total_amount.toFixed(2)),
    averageAmount: parseFloat(stats.average_amount.toFixed(2)),
    largestDonation: stats.largest_donation,
    firstDonationAt: stats.first_donation_at,
    lastDonationAt: stats.last_donation_at,
    monthlyStats
  };
}

/**
 * Get recent donations (for donor wall)
 */
export function getRecentDonations(limit = 10) {
  return db.prepare(`
    SELECT 
      id,
      amount,
      currency,
      CASE WHEN is_anonymous = 1 THEN 'Anonymous' ELSE donor_name END as donor_name,
      message,
      created_at
    FROM donations
    WHERE status = 'completed'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Get top donors
 */
export function getTopDonors(limit = 10) {
  return db.prepare(`
    SELECT 
      CASE WHEN is_anonymous = 1 THEN 'Anonymous' ELSE donor_name END as donor_name,
      SUM(amount) as total_amount,
      COUNT(*) as donation_count
    FROM donations
    WHERE status = 'completed' AND donor_name IS NOT NULL
    GROUP BY CASE WHEN is_anonymous = 1 THEN id ELSE donor_name END
    ORDER BY total_amount DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Get donation goal progress
 */
export function getDonationGoal() {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('donation_goal');
  const goal = setting ? JSON.parse(setting.value) : { target: 1000, description: 'Server costs' };
  
  const current = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM donations
    WHERE status = 'completed'
  `).get();
  
  return {
    target: goal.target,
    current: parseFloat(current.total.toFixed(2)),
    description: goal.description,
    percentage: Math.min(100, (current.total / goal.target) * 100).toFixed(1)
  };
}

/**
 * Set donation goal
 */
export function setDonationGoal(target, description = 'Server costs') {
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at)
    VALUES ('donation_goal', ?, CURRENT_TIMESTAMP)
  `).run(JSON.stringify({ target, description }));
}

export default {
  recordDonation,
  getDonationStats,
  getRecentDonations,
  getTopDonors,
  getDonationGoal,
  setDonationGoal
};
