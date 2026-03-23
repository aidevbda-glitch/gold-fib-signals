const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  hasPassword: boolean;
  secure: boolean;
  fromEmail: string;
  fromName: string;
  source: 'database' | 'env';
}

export interface SmtpUpdatePayload {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
  fromEmail?: string;
  fromName?: string;
}

export interface TestSmtpResult {
  success: boolean;
  message: string;
}

/**
 * Get SMTP settings from the server
 * Password is masked - hasPassword indicates if a password is stored
 */
export async function getSmtpSettings(sessionId: string): Promise<SmtpSettings> {
  const response = await fetch(`${API_BASE}/admin/smtp-settings`, {
    headers: {
      'X-Admin-Session': sessionId,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch SMTP settings');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Update SMTP settings on the server
 * Only sends fields that should be updated
 */
export async function updateSmtpSettings(
  sessionId: string,
  settings: SmtpUpdatePayload
): Promise<SmtpSettings> {
  const response = await fetch(`${API_BASE}/admin/smtp-settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Session': sessionId,
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update SMTP settings');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Test SMTP connection
 * Sends a test email to verify configuration
 */
export async function testSmtpConnection(
  sessionId: string,
  to?: string
): Promise<TestSmtpResult> {
  const response = await fetch(`${API_BASE}/admin/smtp-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Session': sessionId,
    },
    body: JSON.stringify({ to }),
  });

  const data = await response.json();
  
  if (!response.ok && !data.success) {
    throw new Error(data.message || data.error || 'SMTP test failed');
  }

  return data;
}

/**
 * Save complete SMTP configuration
 * Helper function to save all fields at once
 */
export async function saveSmtpConfiguration(
  sessionId: string,
  config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
    fromEmail: string;
    fromName: string;
  }
): Promise<SmtpSettings> {
  return updateSmtpSettings(sessionId, config);
}
