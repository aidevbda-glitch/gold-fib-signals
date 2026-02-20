import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Lock, 
  Shield, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Megaphone, 
  Target,
  Key,
  Smartphone,
  AlertTriangle,
  Check,
  Copy,
  LogOut
} from 'lucide-react';

interface AdminPageProps {
  onBack: () => void;
}

interface AdminStatus {
  mfaEnabled: boolean;
  isTempPassword: boolean;
  isLoggedIn: boolean;
  mfaVerified: boolean;
}

interface AdSettings {
  adsEnabled: boolean;
  adsensePublisherId: string;
  placements: {
    header: { enabled: boolean; slot: string };
    sidebar: { enabled: boolean; slot: string };
    content: { enabled: boolean; slot: string };
    footer: { enabled: boolean; slot: string };
  };
}

interface DonationGoal {
  target: number;
  current: number;
  description: string;
}

interface MfaSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function AdminPage({ onBack }: AdminPageProps) {
  // Auth state
  const [sessionId, setSessionId] = useState<string | null>(() => 
    localStorage.getItem('adminSession')
  );
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Login state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  
  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  
  // MFA setup state
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [mfaSetupToken, setMfaSetupToken] = useState('');
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  
  // Settings state
  const [adSettings, setAdSettings] = useState<AdSettings | null>(null);
  const [donationGoal, setDonationGoal] = useState<DonationGoal | null>(null);
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDescription, setGoalDescription] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, [sessionId]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/status`, {
        headers: sessionId ? { 'X-Admin-Session': sessionId } : {}
      });
      const data = await response.json();
      setAdminStatus(data.data);
      
      if (data.data.isLoggedIn && data.data.mfaVerified) {
        await loadSettings();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const [adRes, goalRes] = await Promise.all([
        fetch(`${API_BASE}/ads/settings`),
        fetch(`${API_BASE}/donations/goal`)
      ]);
      
      if (adRes.ok) {
        const data = await adRes.json();
        setAdSettings(data.data);
      }
      if (goalRes.ok) {
        const data = await goalRes.json();
        setDonationGoal(data.data);
        setGoalTarget(data.data.target.toString());
        setGoalDescription(data.data.description);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setLoginError(data.error || 'Login failed');
        return;
      }
      
      setSessionId(data.data.sessionId);
      localStorage.setItem('adminSession', data.data.sessionId);
      
      // Check auth status first to confirm MFA is actually established
      const statusResponse = await fetch(`${API_BASE}/admin/status`, {
        headers: { 'X-Admin-Session': data.data.sessionId }
      });
      const statusData = await statusResponse.json();
      
      // Only set needsMfa after confirming MFA is established
      if (statusData.data?.mfaEnabled && data.data.mfaRequired) {
        setNeedsMfa(true);
        setAdminStatus(statusData.data);
      } else {
        await checkAuthStatus();
      }
    } catch (error) {
      setLoginError('Connection failed');
    }
  };

  const handleMfaVerify = async () => {
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE}/admin/verify-mfa`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Session': sessionId!
        },
        body: JSON.stringify({ token: mfaToken })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setLoginError(data.error || 'Invalid code');
        return;
      }
      
      setNeedsMfa(false);
      await checkAuthStatus();
    } catch (error) {
      setLoginError('Verification failed');
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/admin/logout`, {
      method: 'POST',
      headers: { 'X-Admin-Session': sessionId! }
    });
    setSessionId(null);
    localStorage.removeItem('adminSession');
    setAdminStatus(null);
    setPassword('');
    setMfaToken('');
    setNeedsMfa(false);
  };

  const handlePasswordChange = async () => {
    setPasswordChangeError('');
    
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordChangeError('Password must be at least 8 characters');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/admin/change-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Session': sessionId!
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setPasswordChangeError(data.error || 'Failed to change password');
        return;
      }
      
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await checkAuthStatus();
      alert('Password changed successfully!');
    } catch (error) {
      setPasswordChangeError('Connection failed');
    }
  };

  const handleMfaSetupStart = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/mfa/setup`, {
        method: 'POST',
        headers: { 'X-Admin-Session': sessionId! }
      });
      
      const data = await response.json();
      setMfaSetup(data.data);
      setShowMfaSetup(true);
    } catch (error) {
      console.error('MFA setup failed:', error);
    }
  };

  const handleMfaEnable = async () => {
    if (!mfaSetup) return;
    
    try {
      const response = await fetch(`${API_BASE}/admin/mfa/enable`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Session': sessionId!
        },
        body: JSON.stringify({ 
          secret: mfaSetup.secret, 
          token: mfaSetupToken,
          backupCodes: mfaSetup.backupCodes
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to enable MFA');
        return;
      }
      
      setShowMfaSetup(false);
      setMfaSetup(null);
      setMfaSetupToken('');
      await checkAuthStatus();
      alert('MFA enabled successfully!');
    } catch (error) {
      console.error('MFA enable failed:', error);
    }
  };

  const handleAdSettingsUpdate = async (updates: Partial<AdSettings>) => {
    try {
      const response = await fetch(`${API_BASE}/ads/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Session': sessionId!
        },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const data = await response.json();
        setAdSettings(data.data);
      }
    } catch (error) {
      console.error('Failed to update ad settings:', error);
    }
  };

  const handleGoalUpdate = async () => {
    try {
      const response = await fetch(`${API_BASE}/donations/goal`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Session': sessionId!
        },
        body: JSON.stringify({ 
          target: parseFloat(goalTarget), 
          description: goalDescription 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setDonationGoal(data.data);
        alert('Goal updated!');
      }
    } catch (error) {
      console.error('Failed to update goal:', error);
    }
  };

  const copyBackupCodes = () => {
    if (mfaSetup) {
      navigator.clipboard.writeText(mfaSetup.backupCodes.join('\n'));
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Login screen (password or MFA)
  if (!adminStatus?.isLoggedIn || needsMfa || (adminStatus.mfaEnabled && !adminStatus.mfaVerified)) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
          <div className="max-w-md mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-yellow-400" />
                <h1 className="text-lg font-bold">Admin Access</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-12">
          <div className="bg-gray-800 rounded-xl p-6">
            {!needsMfa ? (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-8 h-8 text-yellow-400" />
                  </div>
                  <h2 className="text-xl font-bold">Enter Password</h2>
                  <p className="text-gray-400 text-sm mt-1">Access admin settings</p>
                </div>
                
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      placeholder="Password"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {loginError && (
                    <p className="text-red-400 text-sm flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {loginError}
                    </p>
                  )}
                  
                  <button
                    onClick={handleLogin}
                    className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors"
                  >
                    Login
                  </button>
                </div>

                <p className="text-center text-gray-500 text-xs mt-4">
                  Default password: <code className="bg-gray-700 px-1 rounded">GoldFib2024!</code>
                </p>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Smartphone className="w-8 h-8 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold">Two-Factor Auth</h2>
                  <p className="text-gray-400 text-sm mt-1">Enter code from your authenticator app</p>
                </div>
                
                <div className="space-y-4">
                  <input
                    type="text"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleMfaVerify()}
                    placeholder="000000"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    maxLength={6}
                  />
                  
                  {loginError && (
                    <p className="text-red-400 text-sm flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {loginError}
                    </p>
                  )}
                  
                  <button
                    onClick={handleMfaVerify}
                    disabled={mfaToken.length !== 6}
                    className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                  >
                    Verify
                  </button>
                </div>

                <p className="text-center text-gray-500 text-xs mt-4">
                  You can also use a backup code
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // MFA Setup Modal
  if (showMfaSetup && mfaSetup) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md mx-auto bg-gray-800 rounded-xl p-6">
          <div className="text-center mb-6">
            <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold">Setup Two-Factor Auth</h2>
            <p className="text-gray-400 text-sm mt-1">Scan with Google Authenticator or similar</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg mb-4 flex justify-center">
            <img src={mfaSetup.qrCode} alt="MFA QR Code" className="w-48 h-48" />
          </div>
          
          <div className="bg-gray-700 p-3 rounded-lg mb-4">
            <p className="text-xs text-gray-400 mb-1">Manual entry code:</p>
            <code className="text-yellow-400 text-sm break-all">{mfaSetup.secret}</code>
          </div>
          
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-yellow-400">Backup Codes</p>
              <button
                onClick={copyBackupCodes}
                className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
              >
                {copiedBackupCodes ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedBackupCodes ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 font-mono text-sm">
              {mfaSetup.backupCodes.map((code, i) => (
                <code key={i} className="text-gray-300">{code}</code>
              ))}
            </div>
            <p className="text-xs text-yellow-400/70 mt-2">Save these codes! Each can be used once.</p>
          </div>
          
          <div className="space-y-3">
            <input
              type="text"
              value={mfaSetupToken}
              onChange={(e) => setMfaSetupToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code to verify"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-center tracking-widest focus:outline-none focus:border-green-500"
              maxLength={6}
            />
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowMfaSetup(false);
                  setMfaSetup(null);
                }}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleMfaEnable}
                disabled={mfaSetupToken.length !== 6}
                className="flex-1 py-2 bg-green-500 hover:bg-green-400 disabled:bg-gray-600 text-white font-bold rounded-lg"
              >
                Enable MFA
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Password Change Modal
  if (showPasswordChange) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md mx-auto bg-gray-800 rounded-xl p-6">
          <div className="text-center mb-6">
            <Key className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold">Change Password</h2>
          </div>
          
          <div className="space-y-4">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
            />
            
            {passwordChangeError && (
              <p className="text-red-400 text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {passwordChangeError}
              </p>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowPasswordChange(false)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordChange}
                className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg"
              >
                Change
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-800 bg-gradient-to-r from-yellow-900/50 to-gray-900 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-400" />
                <h1 className="text-lg font-bold">Admin Settings</h1>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Security Warning */}
        {adminStatus.isTempPassword && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-400">Change your password!</p>
              <p className="text-sm text-gray-400">You're using the default password. Please change it immediately.</p>
              <button
                onClick={() => setShowPasswordChange(true)}
                className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded"
              >
                Change Password
              </button>
            </div>
          </div>
        )}

        {/* Security Settings */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Security
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-gray-400">Change your admin password</p>
              </div>
              <button
                onClick={() => setShowPasswordChange(true)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                Change
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-gray-400">
                  {adminStatus.mfaEnabled ? 'MFA is enabled' : 'Add extra security with MFA'}
                </p>
              </div>
              {adminStatus.mfaEnabled ? (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Enabled
                </span>
              ) : (
                <button
                  onClick={handleMfaSetupStart}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm"
                >
                  Setup MFA
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Donation Goal */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-yellow-400" />
            Donation Goal
          </h2>
          
          {donationGoal && (
            <div className="mb-4 p-3 bg-gray-700/30 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Current Progress</span>
                <span className="text-yellow-400">
                  ${donationGoal.current} / ${donationGoal.target}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${Math.min(100, (donationGoal.current / donationGoal.target) * 100)}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Target Amount ($)</label>
              <input
                type="number"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <input
                type="text"
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                placeholder="e.g., Server costs"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>
          
          <button
            onClick={handleGoalUpdate}
            className="mt-4 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg"
          >
            Update Goal
          </button>
        </section>

        {/* Ad Settings */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-orange-400" />
            Advertisement Settings
          </h2>
          
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg mb-4">
            <div>
              <p className="font-medium">Enable Ads</p>
              <p className="text-sm text-gray-400">Show advertisements throughout the app</p>
            </div>
            <button
              onClick={() => handleAdSettingsUpdate({ adsEnabled: !adSettings?.adsEnabled })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                adSettings?.adsEnabled ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <span className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                adSettings?.adsEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          
          {/* Publisher ID */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">AdSense Publisher ID</label>
            <input
              type="text"
              value={adSettings?.adsensePublisherId || ''}
              onChange={(e) => handleAdSettingsUpdate({ adsensePublisherId: e.target.value })}
              placeholder="ca-pub-XXXXXXXXXXXXXXXX"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
            />
          </div>
          
          {/* Ad Placements */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-300">Ad Placements</p>
            
            {(['header', 'sidebar', 'content', 'footer'] as const).map((placement) => (
              <div key={placement} className="p-3 bg-gray-700/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300 capitalize">{placement} Ad</span>
                  <button
                    onClick={() => handleAdSettingsUpdate({
                      placements: {
                        ...adSettings?.placements,
                        [placement]: {
                          ...adSettings?.placements?.[placement],
                          enabled: !adSettings?.placements?.[placement]?.enabled
                        }
                      }
                    } as Partial<AdSettings>)}
                    className={`w-8 h-5 rounded-full transition-colors relative ${
                      adSettings?.placements?.[placement]?.enabled ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`absolute w-3 h-3 bg-white rounded-full top-1 transition-transform ${
                      adSettings?.placements?.[placement]?.enabled ? 'translate-x-4' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <input
                  type="text"
                  value={adSettings?.placements?.[placement]?.slot || ''}
                  onChange={(e) => handleAdSettingsUpdate({
                    placements: {
                      ...adSettings?.placements,
                      [placement]: {
                        ...adSettings?.placements?.[placement],
                        slot: e.target.value
                      }
                    }
                  } as Partial<AdSettings>)}
                  placeholder="Ad slot ID"
                  className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
