# Email Notification System - Implementation Plan

## Overview
Secure email notification system with encrypted storage, admin approval workflow, and donation-gated access controls.

---

## Phase 1: Database & Security Foundation

### 1.1 Database Schema Updates
```sql
-- Encrypted email storage table
CREATE TABLE email_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_encrypted TEXT NOT NULL,          -- AES-256 encrypted email
  email_hash TEXT UNIQUE NOT NULL,        -- SHA-256 hash for duplicate checking
  name_encrypted TEXT,                    -- Optional encrypted name
  status TEXT DEFAULT 'pending',          -- pending, approved, rejected
  source TEXT DEFAULT 'request',          -- request, manual_add
  donation_required INTEGER DEFAULT 0,    -- 1 if form required donation
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME,
  approved_by TEXT                        -- Admin session ID
);

-- Subscription requests (pre-approval)
CREATE TABLE subscription_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_encrypted TEXT NOT NULL,
  email_hash TEXT UNIQUE NOT NULL,
  name_encrypted TEXT,
  consent_given INTEGER DEFAULT 0,        -- GDPR consent checkbox
  donation_made INTEGER DEFAULT 0,        -- If donation required and made
  request_token TEXT UNIQUE,              -- Secure token for approval/reject
  status TEXT DEFAULT 'pending',          -- pending, approved, rejected
  ip_address_hash TEXT,                   -- Hashed IP for abuse prevention
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  rejection_reason TEXT
);

-- Admin settings (encrypted admin email)
CREATE TABLE admin_email_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  notification_email_encrypted TEXT,      -- Admin email for receiving requests
  require_donation_for_notifications INTEGER DEFAULT 0,
  show_homepage_banner INTEGER DEFAULT 1,
  banner_text TEXT,
  auto_approve_donors INTEGER DEFAULT 0,  -- Auto-approve if donation made
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Email audit log
CREATE TABLE email_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT,                            -- request_received, approval_sent, etc
  email_hash TEXT,                        -- Hashed email for audit (not full email)
  metadata_encrypted TEXT,                -- Encrypted action details
  ip_address_hash TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 Encryption Service
- Create `encryptionService.js` with:
  - AES-256-GCM encryption for email addresses
  - Environment variable for encryption key (ENCRYPTION_KEY)
  - SHA-256 hashing for duplicate detection
  - Secure key derivation if needed

### 1.3 Security Hardening
- All emails encrypted at rest
- Hash-based duplicate checking (never compare plaintext)
- Secure SMTP headers (no email in Subject, X-headers, etc.)
- IP address hashing for audit trails
- Rate limiting on request endpoints

---

## Phase 2: Backend API Implementation

### 2.1 Encryption Service Module
```javascript
// encryptionService.js
- encryptEmail(plainEmail) -> { encrypted, hash }
- decryptEmail(encryptedData) -> plainEmail
- hashEmail(plainEmail) -> hash (for lookups)
- hashIP(ipAddress) -> hash (for audit)
```

### 2.2 Subscription Request Endpoints
```
POST /api/notifications/request
  Body: { email, name, consentGiven, donationMade }
  Returns: { success, message, requestToken }
  Actions:
    - Validate email format
    - Check consent checkbox
    - Encrypt and store request
    - Generate secure approval token
    - Send approval email to admin
    - Log audit entry

POST /api/notifications/approve/:token
  Query: { token }
  Returns: { success, message }
  Actions:
    - Validate token
    - Move from requests to subscribers
    - Send welcome email to subscriber
    - Log approval

POST /api/notifications/reject/:token
  Query: { token, reason }
  Returns: { success, message }
  Actions:
    - Validate token
    - Update request status to rejected
    - Send rejection email to requester
    - Log rejection
```

### 2.3 Admin Settings Endpoints
```
GET /api/admin/notification-settings
  Returns: { notificationEmail, requireDonation, showBanner, bannerText }

PUT /api/admin/notification-settings
  Body: { notificationEmail, requireDonation, showBanner, bannerText, autoApprove }
  Actions: Encrypt admin email before storage
```

### 2.4 SMTP Receive Capability
```
// Webhook endpoint for inbound email processing
POST /api/notifications/inbound
  Body: { from, to, subject, body, headers }
  Actions:
    - Parse approval/reject responses from admin
    - Extract action from email content
    - Process accordingly
```

### 2.5 Updated Signal Notification
```javascript
// Modify existing sendSignalNotification to:
- Query only 'approved' subscribers
- Decrypt emails at runtime only
- Send with secure headers
- Audit log each send
```

---

## Phase 3: Frontend Implementation

### 3.1 Homepage Banner Component
```tsx
// NotificationBanner.tsx
- Displays at bottom of home page (before footer)
- Only shows if admin setting `showBanner` is true
- Customizable text via admin settings
- CTA button to Donate page (with anchor to notification form)
```

### 3.2 Notification Request Form (Pop-up Modal)
```tsx
// NotificationRequestModal.tsx
Fields:
  - Email (validated)
  - Name (optional)
  - Consent checkbox (required)
  - "I consent to receiving trade signal notifications..."
  - Submit button

States:
  - Loading
  - Success ("Check your email for confirmation")
  - Error display
```

### 3.3 Donate Page Integration
```tsx
// Updates to DonationPage.tsx
- Conditional display of notification form based on settings
- If `requireDonation` is TRUE:
  - Show explanation text: "After donating, you can request..."
  - Show form only after donation complete
  - Add "Skip notification signup" checkbox on donation form
- If `requireDonation` is FALSE:
  - Always show notification request section
```

### 3.4 Admin Settings Page Updates
```tsx
// Add to AdminPage.tsx
Section: "Notification System Settings"
Fields:
  - Admin notification email (encrypted input)
  - Toggle: Require donation for notifications (default: OFF)
  - Toggle: Show homepage banner
  - Textarea: Banner text content
  - Toggle: Auto-approve donors
  - Test email button

Section: "Pending Requests"
Table:
  - Email hash (partially masked)
  - Request date
  - Donation status
  - Actions: Approve/Reject buttons
```

---

## Phase 4: Email Templates

### 4.1 Admin Approval Request Email
```html
Subject: New Notification Request - Action Required

Body:
- Requester: [Name] wants to receive notifications
- Email: [Masked for privacy]
- Consent: Given
- Donation: [Yes/No]

Action Buttons:
  [Approve] -> Links to /api/notifications/approve/:token
  [Reject]  -> Links to /api/notifications/reject/:token
  
Manual option:
  Reply with "APPROVE" or "REJECT"
```

### 4.2 Welcome Email (to approved subscriber)
```html
Subject: Welcome to Gold Fib Signal Notifications

Body:
- Welcome message
- What to expect (signal types, frequency)
- Unsubscribe link (with unique token)
- Privacy notice
```

### 4.3 Rejection Email
```html
Subject: Notification Request Update

Body:
- Your request was declined
- Reason (if provided)
- Can reapply in the future
```

---

## Phase 5: Security Implementation Details

### 5.1 Encryption at Rest
```javascript
// Environment variables
ENCRYPTION_KEY=32-byte-base64-key

// Encryption approach
- Generate random IV for each email
- AES-256-GCM encryption
- Store: iv + authTag + ciphertext
- Key rotation support (version field)
```

### 5.2 Secure SMTP Headers
```javascript
// When sending emails:
- Subject: Never contain email addresses
- X- headers: No PII in custom headers
- From: Use generic "Gold Fib Signals" name
- Reply-To: Admin email (encrypted transport)
- Message-ID: Random, no email in format
```

### 5.3 Audit Logging
```javascript
// Log actions without exposing emails:
{
  action: 'subscription_requested',
  email_hash: 'sha256-hash',
  ip_hash: 'sha256-of-ip',
  timestamp: '2024-01-01T00:00:00Z',
  metadata_encrypted: 'encrypted-details'
}
```

---

## Phase 6: Testing & Validation

### 6.1 Security Tests
- [ ] Verify emails encrypted in database (no plaintext)
- [ ] Verify hash-based lookups work
- [ ] Test key rotation scenario
- [ ] Verify no email in SMTP headers
- [ ] Test SQL injection resistance

### 6.2 Functional Tests
- [ ] Request form submission
- [ ] Admin approval flow
- [ ] Rejection flow
- [ ] Welcome email sent
- [ ] Signal notification with approved list
- [ ] Donation-gated form behavior
- [ ] Skip option functionality

### 6.3 Edge Cases
- [ ] Duplicate email request
- [ ] Expired approval token
- [ ] Admin email not configured
- [ ] SMTP failure handling
- [ ] High volume of requests

---

## Implementation Order

1. **Database & Encryption** (Foundation)
2. **Request API & Form** (User-facing)
3. **Admin Settings & Approval** (Admin-facing)
4. **Email Templates** (Communication)
5. **Security Hardening** (Validation)
6. **Integration Testing** (End-to-end)

---

## Estimated Timeline
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 2-3 hours
- Phase 4: 1 hour
- Phase 5-6: 2-3 hours

**Total: ~10-14 hours of focused development**

---

## Questions for Review

1. **Encryption**: Is AES-256-GCM sufficient, or do you prefer a specific encryption library?
2. **Token Expiry**: How long should approval tokens remain valid? (suggest: 7 days)
3. **Donation Verification**: How do we verify a donation was made? (webhook? manual?)
4. **Admin Email**: Should the admin email be the same as SMTP "from" email or separate?
5. **Rate Limiting**: How many requests per IP per day? (suggest: 3)
6. **Unsubscribe**: Should we implement one-click unsubscribe in notification emails?

Please review and let me know if you'd like to proceed or need modifications!