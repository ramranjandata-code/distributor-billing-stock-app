import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  Smartphone, 
  Laptop, 
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
  ArrowRight,
  Lock,
  HardDrive
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  updateSupabaseCredentials, 
  isSupabaseConnected, 
  testSupabaseConnection 
} from '../utils/supabaseClient';
import { 
  pushLocalDataToCloud, 
  fetchCloudData, 
  performFullSync,
  exportGoogleDriveBackup
} from '../utils/storage';

export default function CloudSyncModal({ isOpen, onClose, refreshAllData, onSyncStateChange }) {
  const [activeTab, setActiveTab] = useState('browser'); // 'browser' | 'database'
  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseConfig());
  const [isConnected, setIsConnected] = useState(isSupabaseConnected());
  const [copiedLink, setCopiedLink] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState({ loading: false, msg: '', type: '' });

  const LIVE_WEB_LINK = 'https://ramranjandata-code.github.io/distributor-billing-stock-app/';

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setSupabaseConfig(cfg);
      const conn = isSupabaseConnected();
      setIsConnected(conn);
      setSyncStatus({ loading: false, msg: '', type: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(LIVE_WEB_LINK);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    setSyncStatus({ loading: true, msg: 'Testing and connecting to Cloud Database...', type: 'info' });
    
    updateSupabaseCredentials(supabaseConfig.url, supabaseConfig.key);
    const testResult = await testSupabaseConnection();

    if (testResult.success) {
      setIsConnected(true);
      if (onSyncStateChange) onSyncStateChange(true);
      setSyncStatus({ loading: false, msg: '✓ Connected! Automatically syncing data with cloud...', type: 'success' });
      await performFullSync();
      if (refreshAllData) refreshAllData();
      setTimeout(() => {
        setSyncStatus({ loading: false, msg: '', type: '' });
      }, 3000);
    } else {
      setIsConnected(false);
      if (onSyncStateChange) onSyncStateChange(false);
      setSyncStatus({ loading: false, msg: `⚠️ ${testResult.message}`, type: 'error' });
    }
  };

  const handleManualPush = async () => {
    setSyncStatus({ loading: true, msg: 'Uploading all local products, bills & parties to cloud...', type: 'info' });
    const res = await pushLocalDataToCloud();
    setSyncStatus({ 
      loading: false, 
      msg: res.success ? '✓ All data uploaded to cloud successfully!' : `⚠️ ${res.message}`, 
      type: res.success ? 'success' : 'error' 
    });
    if (res.success && refreshAllData) refreshAllData();
  };

  const handleManualPull = async () => {
    setSyncStatus({ loading: true, msg: 'Pulling latest data from Cloud Database...', type: 'info' });
    const success = await fetchCloudData(true);
    if (success) {
      if (refreshAllData) refreshAllData();
      setSyncStatus({ loading: false, msg: '✓ Latest cloud data loaded into app!', type: 'success' });
    } else {
      setSyncStatus({ loading: false, msg: '⚠️ Could not pull from cloud. Check connection.', type: 'error' });
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="modal-content" style={{ maxWidth: '640px', width: '92%', borderRadius: '20px', padding: '0', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: isConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${isConnected ? '#10b981' : '#ef4444'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isConnected ? '#10b981' : '#ef4444'
            }}>
              {isConnected ? <Cloud size={26} /> : <CloudOff size={26} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.01em' }}>
                Multi-Device Cloud Access
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isConnected ? '#10b981' : '#f59e0b',
                  boxShadow: isConnected ? '0 0 8px #10b981' : 'none'
                }} />
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>
                  {isConnected ? '⚡ Cloud Database Active & Connected' : '🟡 Cloud Database Not Connected'}
                </span>
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Status Notification Banner */}
        {syncStatus.msg && (
          <div style={{
            padding: '12px 24px',
            background: syncStatus.type === 'success' ? '#ecfdf5' : syncStatus.type === 'error' ? '#fef2f2' : '#eff6ff',
            borderBottom: `1px solid ${syncStatus.type === 'success' ? '#a7f3d0' : syncStatus.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
            color: syncStatus.type === 'success' ? '#065f46' : syncStatus.type === 'error' ? '#991b1b' : '#1e40af',
            fontSize: '0.85rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {syncStatus.loading && <RefreshCw size={16} className="spin" />}
            {syncStatus.type === 'success' && <CheckCircle2 size={16} />}
            {syncStatus.type === 'error' && <AlertCircle size={16} />}
            <span>{syncStatus.msg}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('browser')}
            style={{
              padding: '14px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'browser' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'browser' ? '#2563eb' : '#64748b',
              fontWeight: activeTab === 'browser' ? '800' : '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Globe size={18} />
            <span>Web Browser Access</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('database')}
            style={{
              padding: '14px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'database' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'database' ? '#2563eb' : '#64748b',
              fontWeight: activeTab === 'database' ? '800' : '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Key size={18} />
            <span>Cloud Database Settings</span>
          </button>
        </div>

        {/* Tab 1: Web Browser Access */}
        {activeTab === 'browser' && (
          <div style={{ padding: '24px 28px' }}>
            <div style={{
              background: '#f1f5f9',
              borderRadius: '14px',
              padding: '18px 20px',
              border: '1px solid #e2e8f0',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Live Cloud Web App Link
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: '#ffffff',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1'
              }}>
                <Globe size={20} color="#2563eb" style={{ flexShrink: 0 }} />
                <span style={{
                  flex: 1,
                  fontSize: '0.88rem',
                  fontFamily: 'monospace',
                  color: '#0f172a',
                  fontWeight: '600',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {LIVE_WEB_LINK}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: copiedLink ? '#059669' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Step-by-Step Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '22px' }}>
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: '700', fontSize: '0.9rem' }}>
                  <Smartphone size={18} color="#2563eb" />
                  <span>📱 Mobile Phone Access</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                  Open Chrome or Safari on your phone, paste the link, enter your Security PIN (<strong>1234</strong>), and you have full access to all bills and stock.
                </p>
              </div>

              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: '700', fontSize: '0.9rem' }}>
                  <Laptop size={18} color="#2563eb" />
                  <span>💻 Office & Personal Laptop</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                  Open the link in any laptop browser, log in with your PIN (<strong>1234</strong>), and all items, customer khatas, and purchase bills are live.
                </p>
              </div>
            </div>

            {/* Live Lossless Compression Engine Badge */}
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>⚡</span>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '0.86rem', color: '#065f46' }}>
                    Lossless Compression: Active (0% Data Loss)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#047857' }}>
                    70% Database space saved. 512 MB holds ~15 Lakhs+ bills safely.
                  </div>
                </div>
              </div>
              <span style={{
                background: '#047857',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: '800'
              }}>
                LOSSLESS LZ64
              </span>
            </div>

            {/* Google Drive 30GB Cloud Backup Banner */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <HardDrive size={22} color="#2563eb" />
                <div>
                  <div style={{ fontWeight: '800', fontSize: '0.86rem', color: '#1e40af' }}>
                    Google Drive 30 GB Permanent Backup (15GB + 15GB)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#3b82f6' }}>
                    Save full accounting backup for Google Drive cloud archiving.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const res = exportGoogleDriveBackup();
                    alert(`🎉 Google Drive Backup File Generated!\n\nFile: ${res.fileName}\nSaved to your Downloads. You can drop it into your Google Drive folder.`);
                  }}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Save to Drive
                </button>
                <a
                  href="https://drive.google.com/drive/folders/15Ub1FksCAldnMYBwxfUTwXzB7Kx5w_8E"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Open Folder</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{
              display: 'flex',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid #e2e8f0'
            }}>
              <button
                type="button"
                onClick={handleManualPush}
                disabled={!isConnected}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '10px',
                  background: isConnected ? '#059669' : '#e2e8f0',
                  color: isConnected ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: isConnected ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <UploadCloud size={16} />
                <span>Upload Local Data to Cloud</span>
              </button>

              <button
                type="button"
                onClick={handleManualPull}
                disabled={!isConnected}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '10px',
                  background: isConnected ? '#2563eb' : '#e2e8f0',
                  color: isConnected ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: isConnected ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <DownloadCloud size={16} />
                <span>Pull from Cloud</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Cloud Database Settings */}
        {activeTab === 'database' && (
          <div style={{ padding: '24px 28px' }}>
            <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseConfig.url}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, url: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Supabase Anon / Public API Key
                </label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseConfig.key}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, key: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  disabled={syncStatus.loading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Save & Connect Database
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
