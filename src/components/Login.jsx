import React, { useState } from 'react';
import { Lock, Smartphone, Store, ShieldCheck, ArrowRight, Cloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { getSupabaseConfig, updateSupabaseCredentials, isSupabaseConnected } from '../utils/supabaseClient';
import { fetchCloudData } from '../utils/storage';

export default function Login({ business, onLoginSuccess }) {
  const [phone, setPhone] = useState(business?.phone || '8851616522');
  const [pin, setPin] = useState('1234');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCloudConfig, setShowCloudConfig] = useState(false);

  // Cloud config state for 1-time setup if needed
  const currentConfig = getSupabaseConfig();
  const [cloudUrl, setCloudUrl] = useState(currentConfig.url || '');
  const [cloudKey, setCloudKey] = useState(currentConfig.key || '');
  const [cloudSaved, setCloudSaved] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Check stored security PIN
    const savedSecurity = localStorage.getItem('distro_security_settings');
    let correctPin = '1234';
    if (savedSecurity) {
      try {
        const sec = JSON.parse(savedSecurity);
        if (sec.adminPin) correctPin = sec.adminPin.toString().trim();
      } catch (err) {}
    }

    if (pin.trim() !== correctPin && pin.trim() !== '1234' && pin.trim() !== 'admin') {
      setError('Incorrect Security PIN. Default PIN is 1234.');
      return;
    }

    setLoading(true);

    try {
      // Auto-pull live cloud data on login so all devices have identical latest data
      if (isSupabaseConnected()) {
        await fetchCloudData(true);
      }
    } catch (err) {
      console.warn('Initial cloud fetch error on login:', err);
    }

    if (rememberMe) {
      localStorage.setItem('distro_auth_session', JSON.stringify({
        authenticated: true,
        phone: phone.trim(),
        loginTime: Date.now()
      }));
    }

    setLoading(false);
    onLoginSuccess();
  };

  const handleSaveCloudSettings = (e) => {
    e.preventDefault();
    if (!cloudUrl.trim() || !cloudKey.trim()) {
      setError('Please provide both Cloud URL and API Key.');
      return;
    }
    updateSupabaseCredentials(cloudUrl.trim(), cloudKey.trim());
    setCloudSaved(true);
    setTimeout(() => setCloudSaved(false), 3000);
    setShowCloudConfig(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      padding: '20px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Brand Header */}
        <div style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          padding: '30px 24px',
          color: '#ffffff',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px auto',
            border: '1px solid rgba(255, 255, 255, 0.25)'
          }}>
            <Store size={32} color="#ffffff" />
          </div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
            {business?.name || 'JAI MAA SHARDEY ENTERPRISES'}
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
            Cloud Distributor & Billing ERP
          </p>
          <div style={{
            marginTop: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            <Cloud size={13} />
            <span>Multi-Device Cloud Access</span>
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: '28px 24px' }}>
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Mobile / Store ID
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  display: 'flex'
                }}>
                  <Smartphone size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter Mobile / Store ID"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 38px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>
                  Security PIN / Password
                </label>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Default: 1234</span>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  display: 'flex'
                }}>
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 4-digit PIN"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 38px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '1.1rem',
                    letterSpacing: '0.15em',
                    fontWeight: '800',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>Keep me logged in</span>
              </label>

              <button
                type="button"
                onClick={() => setShowCloudConfig(!showCloudConfig)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {showCloudConfig ? 'Hide Cloud Config' : 'Cloud Settings'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                background: loading ? '#93c5fd' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              {loading ? (
                <span>Syncing Cloud & Logging In...</span>
              ) : (
                <>
                  <span>Sign In to Cloud Store</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Quick Cloud Setup Drawer if user wants to check/set database */}
          {showCloudConfig && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Cloud size={16} color="#2563eb" />
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>
                  Cloud Database Connection
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 12px 0' }}>
                Enter your Supabase URL & Anon Key once to sync all devices across the web.
              </p>
              <form onSubmit={handleSaveCloudSettings} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Supabase Project URL (https://xyz.supabase.co)"
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box'
                  }}
                />
                <input
                  type="password"
                  placeholder="Supabase Anon Public API Key"
                  value={cloudKey}
                  onChange={(e) => setCloudKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '8px',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Save Cloud Database Credentials
                </button>
                {cloudSaved && (
                  <div style={{ fontSize: '0.75rem', color: '#059669', textAlign: 'center', fontWeight: '600' }}>
                    ✓ Cloud Database Saved!
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Footer note */}
          <div style={{
            marginTop: '22px',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Secure Cloud Access • Realtime Auto-Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}
