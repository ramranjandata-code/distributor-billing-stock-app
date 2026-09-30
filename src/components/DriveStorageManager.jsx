import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  UploadCloud, 
  FileText, 
  Trash2, 
  Eye, 
  ShieldCheck, 
  Folder,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function DriveStorageManager() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [folderId, setFolderId] = useState('15Ub1FksCAldnMYBwxfUTwXzB7Kx5w_8E');
  const [statusMsg, setStatusMsg] = useState('');

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/drive/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        if (data.targetFolderId) setFolderId(data.targetFolderId);
      }
    } catch (e) {
      // Backend not running on localhost:3000
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleConnectAccount = async (priority) => {
    try {
      const res = await fetch(`http://localhost:3000/api/auth/google/url?priority=${priority}`);
      const data = await res.json();
      if (data.success && data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        setStatusMsg(`OAuth authorization window opened for Account ${priority}. Complete sign-in, then click Refresh.`);
      }
    } catch (e) {
      alert('Backend server on http://localhost:3000 is not reachable. Start the server with: npm run server');
    }
  };

  const account1 = accounts.find(a => a.priority_order === 1);
  const account2 = accounts.find(a => a.priority_order === 2);

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'rgba(37, 99, 235, 0.2)',
            border: '1px solid #3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#60a5fa'
          }}>
            <HardDrive size={30} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800' }}>
              Dual Google Drive Storage & Supabase Sync
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Offload all Bill PDFs & Scans across 2 Google Drive accounts (15 GB + 15 GB = 30 GB Free Storage)
            </p>
          </div>
        </div>

        <button
          onClick={fetchAccounts}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh Status</span>
        </button>
      </div>

      {statusMsg && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1e40af',
          fontSize: '0.85rem',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Target Folder ID Callout */}
      <div style={{
        background: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Folder size={22} color="#f59e0b" />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
              Target Google Drive Parent Folder
            </div>
            <div style={{ fontSize: '0.95rem', fontFamily: 'monospace', fontWeight: '700', color: '#0f172a' }}>
              {folderId}
            </div>
          </div>
        </div>
        <a 
          href={`https://drive.google.com/drive/folders/${folderId}`} 
          target="_blank" 
          rel="noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontWeight: '700',
            color: '#2563eb',
            textDecoration: 'none'
          }}
        >
          <span>Open Folder in Google Drive</span>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Dual Drive Account Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* Account 1: Primary */}
        <div style={{
          background: '#ffffff',
          border: account1 ? '2px solid #10b981' : '1.5px dashed #cbd5e1',
          borderRadius: '14px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: '20px',
                background: '#ecfdf5',
                color: '#059669',
                fontSize: '0.75rem',
                fontWeight: '800'
              }}>
                PRIMARY (15 GB)
              </span>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                fontWeight: '700',
                color: account1 ? '#10b981' : '#f59e0b'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: account1 ? '#10b981' : '#f59e0b'
                }} />
                {account1 ? 'Connected & Active' : 'Not Connected'}
              </span>
            </div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
              Drive Account #1
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#64748b' }}>
              {account1 ? account1.email : 'Primary storage for incoming purchase and sales invoice PDFs.'}
            </p>
          </div>

          <button
            onClick={() => handleConnectAccount(1)}
            style={{
              padding: '11px',
              borderRadius: '10px',
              background: account1 ? '#f1f5f9' : '#2563eb',
              color: account1 ? '#334155' : '#ffffff',
              border: account1 ? '1px solid #cbd5e1' : 'none',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Cloud size={16} />
            <span>{account1 ? 'Reconnect Account 1' : 'Connect Google Drive Account 1'}</span>
          </button>
        </div>

        {/* Account 2: Secondary Fallback */}
        <div style={{
          background: '#ffffff',
          border: account2 ? '2px solid #3b82f6' : '1.5px dashed #cbd5e1',
          borderRadius: '14px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: '20px',
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: '0.75rem',
                fontWeight: '800'
              }}>
                FALLBACK BUFFER (15 GB)
              </span>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                fontWeight: '700',
                color: account2 ? '#3b82f6' : '#94a3b8'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: account2 ? '#3b82f6' : '#94a3b8'
                }} />
                {account2 ? 'Connected & Active' : 'Standby / Optional'}
              </span>
            </div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
              Drive Account #2
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#64748b' }}>
              {account2 ? account2.email : 'Automatic fallback: activates instantly if Account 1 runs out of storage.'}
            </p>
          </div>

          <button
            onClick={() => handleConnectAccount(2)}
            style={{
              padding: '11px',
              borderRadius: '10px',
              background: account2 ? '#f1f5f9' : '#059669',
              color: account2 ? '#334155' : '#ffffff',
              border: account2 ? '1px solid #cbd5e1' : 'none',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Cloud size={16} />
            <span>{account2 ? 'Reconnect Account 2' : 'Connect Google Drive Account 2'}</span>
          </button>
        </div>

      </div>

      {/* Supabase Keep-Alive Info Card */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: '#dcfce7',
          color: '#16a34a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <ShieldCheck size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
            Automated Supabase Keep-Alive Protection Active
          </h4>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
            GitHub Actions runs every 5 days (<code>0 0 */5 * *</code>) to query the Supabase database. This guarantees your database never deactivates or pauses due to 7 days of inactivity.
          </p>
        </div>
      </div>

    </div>
  );
}
