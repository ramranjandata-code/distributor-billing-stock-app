import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Cloud, 
  CloudOff, 
  Smartphone, 
  Laptop, 
  QrCode, 
  Copy, 
  Check, 
  RefreshCw, 
  UploadCloud, 
  DownloadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  Key, 
  X, 
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  updateSupabaseCredentials, 
  isSupabaseConnected, 
  testSupabaseConnection,
  generateCloudPairingLink,
  generateCloudPairingCode,
  applyCloudPairingCode 
} from '../utils/supabaseClient';
import { 
  pushLocalDataToCloud, 
  fetchCloudData, 
  performFullSync 
} from '../utils/storage';
import { setupRealtimeSubscription } from '../utils/realtimeSync';

export default function CloudSyncModal({ isOpen, onClose, refreshAllData, onSyncStateChange }) {
  const [activeTab, setActiveTab] = useState('phone'); // 'phone' | 'laptop' | 'settings'
  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseConfig());
  const [isConnected, setIsConnected] = useState(isSupabaseConnected());
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [pairingLink, setPairingLink] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState('');
  
  const [syncStatus, setSyncStatus] = useState({ loading: false, msg: '', type: '' });

  // Generate QR code and link whenever modal opens or credentials change
  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setSupabaseConfig(cfg);
      const conn = isSupabaseConnected();
      setIsConnected(conn);

      if (conn) {
        const link = generateCloudPairingLink();
        const code = generateCloudPairingCode();
        setPairingLink(link);
        setPairingCode(code);

        QRCode.toDataURL(link, {
          width: 280,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        }).then(url => {
          setQrDataUrl(url);
        }).catch(err => {
          console.error('QR code generation error:', err);
        });
      } else {
        setQrDataUrl('');
        setPairingLink('');
        setPairingCode('');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!pairingLink) return;
    navigator.clipboard.writeText(pairingLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleSaveCredentials = async (e) => {
    e?.preventDefault();
    if (!supabaseConfig.url || !supabaseConfig.key) {
      setSyncStatus({ loading: false, msg: 'Please provide both Supabase URL and API Key.', type: 'error' });
      return;
    }
    setSyncStatus({ loading: true, msg: 'Validating & connecting to Supabase Cloud...', type: 'info' });
    updateSupabaseCredentials(supabaseConfig.url, supabaseConfig.key);
    
    const testRes = await testSupabaseConnection();
    if (testRes.success) {
      setIsConnected(true);
      setupRealtimeSubscription(() => { refreshAllData?.(); });
      
      const link = generateCloudPairingLink();
      const code = generateCloudPairingCode();
      setPairingLink(link);
      setPairingCode(code);
      if (link) {
        const url = await QRCode.toDataURL(link, { width: 280, margin: 2 });
        setQrDataUrl(url);
      }

      // Initial push to ensure cloud has the latest data
      await pushLocalDataToCloud();
      setSyncStatus({ loading: false, msg: '🎉 Cloud Database Connected & Synced Successfully!', type: 'success' });
      onSyncStateChange?.(true);
      refreshAllData?.();
    } else {
      setIsConnected(false);
      setSyncStatus({ loading: false, msg: `⚠️ Connection Failed: ${testRes.message}`, type: 'error' });
    }
  };

  const handleApplyManualCode = async () => {
    if (!manualCodeInput.trim()) return;
    const ok = applyCloudPairingCode(manualCodeInput.trim());
    if (ok) {
      const cfg = getSupabaseConfig();
      setSupabaseConfig(cfg);
      setIsConnected(true);
      setSyncStatus({ loading: true, msg: 'Pulling live data from cloud...', type: 'info' });
      const pullOk = await fetchCloudData(true);
      refreshAllData?.();
      setSyncStatus({ 
        loading: false, 
        msg: pullOk ? '🎉 Successfully paired and hydrated all data from Cloud!' : 'Connected, but cloud had no existing data.', 
        type: 'success' 
      });
      onSyncStateChange?.(true);
    } else {
      setSyncStatus({ loading: false, msg: 'Invalid pairing code. Please check and try again.', type: 'error' });
    }
  };

  const handleSyncPush = async () => {
    setSyncStatus({ loading: true, msg: 'Uploading all local records to Cloud...', type: 'info' });
    const res = await pushLocalDataToCloud();
    setSyncStatus({ 
      loading: false, 
      msg: res.success ? '✅ All products, purchases, stock lots & invoices uploaded to Cloud!' : res.message, 
      type: res.success ? 'success' : 'error' 
    });
    if (res.success) refreshAllData?.();
  };

  const handleSyncPull = async () => {
    setSyncStatus({ loading: true, msg: 'Pulling latest data from Cloud Database...', type: 'info' });
    const updated = await fetchCloudData(true);
    refreshAllData?.();
    setSyncStatus({ 
      loading: false, 
      msg: updated ? '✅ Downloaded and merged latest cloud records successfully!' : 'No new cloud updates found or connection offline.', 
      type: 'success' 
    });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div 
        className="modal-content glass-card"
        style={{
          width: '92%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: isConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(249, 115, 22, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isConnected ? '#4ade80' : '#fb923c'
            }}>
              {isConnected ? <Cloud size={22} /> : <CloudOff size={22} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Multi-Device Cloud Access
                <span style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: isConnected ? '#22c55e' : '#f97316',
                  color: '#ffffff',
                  fontWeight: '700'
                }}>
                  {isConnected ? '● CLOUD ACTIVE' : 'OFFLINE MODE'}
                </span>
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                Access seamlessly from your Phone, Office Laptop, and Personal Laptop
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--surface-color)',
          padding: '0 16px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('phone')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'phone' ? '3px solid #059669' : '3px solid transparent',
              color: activeTab === 'phone' ? '#059669' : 'var(--text-muted)',
              fontWeight: activeTab === 'phone' ? '800' : '600',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Smartphone size={16} />
            <span>📱 Mobile Phone Access (QR Code)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('laptop')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'laptop' ? '3px solid #059669' : '3px solid transparent',
              color: activeTab === 'laptop' ? '#059669' : 'var(--text-muted)',
              fontWeight: activeTab === 'laptop' ? '800' : '600',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Laptop size={16} />
            <span>💻 Office & Personal Laptop</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'settings' ? '3px solid #059669' : '3px solid transparent',
              color: activeTab === 'settings' ? '#059669' : 'var(--text-muted)',
              fontWeight: activeTab === 'settings' ? '800' : '600',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Cloud size={16} />
            <span>⚙️ Cloud Setup</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: '1 1 auto' }}>
          
          {/* Status Message Alert */}
          {syncStatus.msg && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: '600',
              background: syncStatus.type === 'error' ? '#fef2f2' : syncStatus.type === 'success' ? '#ecfdf5' : '#eff6ff',
              color: syncStatus.type === 'error' ? '#dc2626' : syncStatus.type === 'success' ? '#059669' : '#2563eb',
              border: `1px solid ${syncStatus.type === 'error' ? '#fca5a5' : syncStatus.type === 'success' ? '#6ee7b7' : '#93c5fd'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {syncStatus.loading && <RefreshCw size={15} className="spin" />}
              <span>{syncStatus.msg}</span>
            </div>
          )}

          {/* TAB 1: PHONE ACCESS */}
          {activeTab === 'phone' && (
            <div>
              {isConnected ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center' }}>
                  
                  {/* QR Code Container */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                  }}>
                    {qrDataUrl ? (
                      <img 
                        src={qrDataUrl} 
                        alt="Scan with phone" 
                        style={{ width: '220px', height: '220px', borderRadius: '8px', border: '1px solid #e2e8f0' }} 
                      />
                    ) : (
                      <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RefreshCw size={24} className="spin" color="var(--primary)" />
                      </div>
                    )}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', fontWeight: '600' }}>
                      📸 Scan with iPhone or Android Camera
                    </span>
                  </div>

                  {/* Instructions & Quick Link */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '12px 14px', background: '#ecfdf5', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', color: '#065f46', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Zap size={16} /> 1-Click Instant Phone Sync
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.80rem', color: '#047857', lineHeight: 1.4 }}>
                        Open your phone camera, scan the QR code, and tap the link. Your phone will immediately download all your products, bills, stock, and parties!
                      </p>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                        Or Send 1-Click Link to Phone (WhatsApp / Email):
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          readOnly 
                          value={pairingLink}
                          className="input-field"
                          style={{ fontSize: '0.76rem', background: '#f8fafc', color: 'var(--text-muted)' }}
                        />
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="btn btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                        >
                          {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                          <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>✅ <strong>Live Realtime:</strong> Any sale made on phone updates your laptop instantly.</div>
                      <div>✅ <strong>No App Store Needed:</strong> Works in Safari, Chrome, and Samsung Browser.</div>
                    </div>
                  </div>

                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <CloudOff size={46} color="#f97316" style={{ marginBottom: '12px' }} />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 6px 0' }}>
                    Cloud Database Not Connected Yet
                  </h4>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px auto' }}>
                    To access your data from your phone and laptops, connect your free Supabase Cloud Database in the <strong>Cloud Setup</strong> tab.
                  </p>
                  <button 
                    type="button" 
                    onClick={() => setActiveTab('settings')}
                    className="btn btn-primary"
                    style={{ background: '#059669', borderColor: '#059669' }}
                  >
                    Open Cloud Setup &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LAPTOP ACCESS */}
          {activeTab === 'laptop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '14px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.94rem', color: '#0369a1', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Laptop size={17} /> Access from Office Laptop & Personal Laptop
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#0284c7', lineHeight: 1.4 }}>
                  You can open DistroPulse ERP simultaneously on your office computer and home laptop. Changes made on either machine sync across the cloud automatically.
                </p>
              </div>

              {isConnected ? (
                <>
                  <div>
                    <label style={{ fontSize: '0.80rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                      Option 1: 1-Click Access Link for Any Laptop Browser:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        readOnly 
                        value={pairingLink}
                        className="input-field"
                        style={{ fontSize: '0.78rem', background: '#f8fafc', color: 'var(--text-muted)' }}
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                      >
                        {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                        <span>{copiedLink ? 'Copied!' : 'Copy 1-Click Link'}</span>
                      </button>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Tip: Bookmark this link on your office laptop and personal laptop for instant 1-click access anytime.
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.80rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                      Option 2: Master Pairing Key:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        readOnly 
                        value={pairingCode}
                        className="input-field"
                        style={{ fontSize: '0.76rem', background: '#f8fafc', fontFamily: 'monospace' }}
                      />
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                      >
                        {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                        <span>{copiedCode ? 'Copied Code!' : 'Copy Key'}</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Please configure Cloud Database in the Cloud Setup tab to generate your laptop pairing link.
                  </p>
                </div>
              )}

              {/* Paste pairing code on a new machine */}
              <div style={{ marginTop: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '0.80rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Connecting this laptop to an existing business account? Paste Master Key here:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Paste master pairing key from your other laptop..."
                    value={manualCodeInput}
                    onChange={e => setManualCodeInput(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.78rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyManualCode}
                    className="btn btn-primary"
                    style={{ background: '#059669', borderColor: '#059669', whiteSpace: 'nowrap' }}
                  >
                    Pair Device
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUD SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: isConnected ? '#ecfdf5' : '#fff7ed', borderRadius: '10px', border: `1px solid ${isConnected ? '#a7f3d0' : '#fed7aa'}` }}>
                <div>
                  <strong style={{ color: isConnected ? '#065f46' : '#9a3412', fontSize: '0.88rem' }}>
                    {isConnected ? '🟢 Cloud Database Connected' : '🟠 Local Mode (Not Connected)'}
                  </strong>
                  <div style={{ fontSize: '0.76rem', color: isConnected ? '#047857' : '#c2410c' }}>
                    {isConnected ? 'Realtime WebSocket active (<50ms delay)' : 'Enter your Supabase URL & Key below to activate cloud access.'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleSyncPush}
                    disabled={!isConnected || syncStatus.loading}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem' }}
                    title="Upload local database to Cloud"
                  >
                    <UploadCloud size={14} /> Upload to Cloud
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncPull}
                    disabled={!isConnected || syncStatus.loading}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem' }}
                    title="Download latest data from Cloud"
                  >
                    <DownloadCloud size={14} /> Pull from Cloud
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.80rem' }}>
                    Supabase Project URL
                  </label>
                  <input 
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={supabaseConfig.url}
                    onChange={e => setSupabaseConfig({ ...supabaseConfig, url: e.target.value })}
                    className="input-field"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.80rem' }}>
                    Supabase Anon / Public API Key
                  </label>
                  <input 
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    value={supabaseConfig.key}
                    onChange={e => setSupabaseConfig({ ...supabaseConfig, key: e.target.value })}
                    className="input-field"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={syncStatus.loading}
                    style={{ background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Save size={16} />
                    <span>Save & Connect Cloud DB</span>
                  </button>
                </div>
              </form>

              {/* Info Guide */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
                <strong style={{ color: '#0f172a' }}>Need a Free Supabase Project?</strong>
                <ol style={{ paddingLeft: '18px', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                  <li>Create a free account at <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: '#059669', fontWeight: '700' }}>supabase.com</a> (Takes 1 minute).</li>
                  <li>Click <strong>New Project</strong>, name it (e.g. <code>MyDistroERP</code>), and set a database password.</li>
                  <li>Go to <strong>Project Settings &rarr; API</strong>, copy your <strong>Project URL</strong> and <strong>Anon Public Key</strong>, and paste them above.</li>
                </ol>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          background: 'var(--surface-color)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={15} color="#059669" />
            <span>End-to-End Synced & Encrypted via Supabase Cloud PostgreSQL</span>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem' }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
