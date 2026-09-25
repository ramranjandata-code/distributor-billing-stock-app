import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Download, 
  Upload, 
  RefreshCw, 
  History, 
  UserCheck, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Key,
  Database,
  Cloud,
  Layers,
  Trash2
} from 'lucide-react';
import { 
  fetchAuditLogs, 
  clearAuditLogs, 
  getCurrentOperator, 
  setCurrentOperator, 
  getSecuritySettings, 
  saveSecuritySettings, 
  exportBackupJSON, 
  restoreBackupJSON, 
  performFullSync, 
  logAuditAction 
} from '../utils/storage';

export default function AuditSecurity({ refreshAllData }) {
  const [logs, setLogs] = useState(fetchAuditLogs());
  const [currentOp, setCurrentOp] = useState(getCurrentOperator());
  const [security, setSecurity] = useState(getSecuritySettings());
  const [searchLog, setSearchLog] = useState('');
  const [filterModule, setFilterModule] = useState('ALL');

  // PIN settings state
  const [pinInput, setPinInput] = useState(security.adminPin || '1234');
  const [pinEnabled, setPinEnabled] = useState(security.pinEnabled || false);

  // Operator list
  const availableOperators = [
    { id: 'op_admin', name: 'Admin', role: 'Admin / Proprietor', badge: 'ADMIN' },
    { id: 'op_billing', name: 'Cashier', role: 'Counter Billing Cashier', badge: 'BILLING' },
    { id: 'op_store', name: 'Store Manager', role: 'Warehouse & Inventory Manager', badge: 'INVENTORY' },
    { id: 'op_sales', name: 'Sales Representative', role: 'Field Sales Representative', badge: 'FIELD' }
  ];

  const refreshLogs = () => {
    setLogs(fetchAuditLogs());
  };

  const handleSwitchOperator = (op) => {
    setCurrentOperator(op);
    setCurrentOp(op);
    refreshLogs();
    alert(`Switched active operator to: ${op.name} (${op.role})`);
  };

  const handleSaveSecurity = (e) => {
    e.preventDefault();
    const updated = {
      ...security,
      pinEnabled,
      adminPin: pinInput
    };
    saveSecuritySettings(updated);
    setSecurity(updated);
    alert('Security PIN settings saved successfully!');
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DistroPulse-Backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logAuditAction('BACKUP_DOWNLOAD', 'Security & Audit', 'Downloaded manual JSON database backup file');
    refreshLogs();
    alert('✅ Database backup file downloaded successfully!');
  };

  const handleRestoreFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('⚠️ WARNING: Restoring from a backup will overwrite existing local data. Do you want to continue?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const res = restoreBackupJSON(content);
      if (res.success) {
        alert(res.message);
        if (refreshAllData) refreshAllData();
        refreshLogs();
      } else {
        alert(res.message);
      }
    };
    reader.readAsText(file);
  };

  const handleManualCloudSync = async () => {
    alert('Syncing database with Supabase cloud...');
    const res = await performFullSync();
    logAuditAction('CLOUD_SYNC', 'Security & Audit', 'Triggered full Supabase cloud sync snapshot');
    refreshLogs();
    if (refreshAllData) refreshAllData();
    alert(res.message || 'Cloud sync complete!');
  };

  const handleClearLogs = () => {
    if (window.confirm('Clear all audit logs? This action is permanent.')) {
      clearAuditLogs();
      setLogs([]);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(l => {
    const matchesSearch = l.details.toLowerCase().includes(searchLog.toLowerCase()) || 
                          l.action.toLowerCase().includes(searchLog.toLowerCase()) ||
                          l.operator.toLowerCase().includes(searchLog.toLowerCase());
    const matchesModule = filterModule === 'ALL' || l.module === filterModule;
    return matchesSearch && matchesModule;
  });

  const uniqueModules = ['ALL', ...new Set(logs.map(l => l.module).filter(Boolean))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a, #1e293b)',
        borderRadius: '16px',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              background: '#3b82f6',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: '800',
              padding: '3px 10px',
              borderRadius: '20px',
              letterSpacing: '0.05em'
            }}>
              7-LAYER ENTERPRISE SECURITY
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Audit Trails • Operator Roles • Multi-Layer Backup</span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>Audit Trails & Security Center</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '6px', maxWidth: '640px' }}>
            Maintain compliance, monitor chronological operator actions, and safeguard distributor data with zero-loss automatic backups.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={handleManualCloudSync}
            className="btn btn-primary"
            style={{ padding: '10px 18px', fontWeight: '700', gap: '8px' }}
          >
            <Cloud size={18} />
            <span>Cloud Sync Now</span>
          </button>
          <button 
            onClick={handleDownloadBackup}
            className="btn btn-secondary"
            style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', gap: '8px' }}
          >
            <Download size={18} />
            <span>Download JSON Backup</span>
          </button>
        </div>
      </div>

      {/* Grid: Operator Switcher & Security Configuration */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        
        {/* Active Operator Switcher */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={18} color="var(--primary)" />
              <span>Current Logged-in Operator</span>
            </h3>
            <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
              {currentOp.badge}
            </span>
          </div>

          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>{currentOp.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{currentOp.role}</div>
            <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: '700', marginTop: '6px' }}>
              • All billing, stock, and ledger modifications are stamped with this operator name.
            </div>
          </div>

          <label className="form-label">Switch System Operator:</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {availableOperators.map(op => (
              <button 
                key={op.id}
                onClick={() => handleSwitchOperator(op)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: currentOp.id === op.id ? '2px solid #059669' : '1px solid var(--border-color)',
                  background: currentOp.id === op.id ? '#ecfdf5' : '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: '700', fontSize: '0.84rem', color: currentOp.id === op.id ? '#059669' : 'var(--text-main)' }}>
                  {op.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{op.role}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Security PIN & Backup Restore */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="#2563eb" />
                <span>Admin PIN & Access Protection</span>
              </h3>
            </div>

            <form onSubmit={handleSaveSecurity} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox"
                  id="pinToggle"
                  checked={pinEnabled}
                  onChange={e => setPinEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="pinToggle" style={{ fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer' }}>
                  Require Admin PIN for Bill Deletions & Settings
                </label>
              </div>

              {pinEnabled && (
                <div className="form-group" style={{ marginTop: '4px' }}>
                  <label className="form-label">4-Digit Security PIN</label>
                  <input 
                    type="password"
                    maxLength={6}
                    className="form-control"
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    style={{ width: '140px', letterSpacing: '0.2em', fontWeight: '800' }}
                  />
                </div>
              )}

              <button type="submit" className="btn btn-secondary" style={{ width: 'fit-content', padding: '6px 14px', fontSize: '0.8rem' }}>
                Save Security Settings
              </button>
            </form>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: '800', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={16} color="var(--primary)" />
              <span>Restore Database from File</span>
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
              Upload a previously exported JSON backup file to restore products, invoices, and parties.
            </p>
            <input 
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              style={{ fontSize: '0.8rem' }}
            />
          </div>
        </div>
      </div>

      {/* Audit Trail Log Stream */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={20} color="var(--primary)" />
              <span>Real-Time System Audit Trail ({filteredLogs.length} Events)</span>
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Chronological history of all business transactions</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select 
              className="form-control"
              value={filterModule}
              onChange={e => setFilterModule(e.target.value)}
              style={{ width: '180px', fontSize: '0.82rem', padding: '6px 10px' }}
            >
              {uniqueModules.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <input 
              type="text"
              className="form-control"
              placeholder="Search audit trail..."
              value={searchLog}
              onChange={e => setSearchLog(e.target.value)}
              style={{ width: '200px', fontSize: '0.82rem', padding: '6px 10px' }}
            />

            <button 
              onClick={handleClearLogs}
              className="btn btn-secondary"
              title="Clear all logs"
              style={{ padding: '6px 10px', color: '#dc2626' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 12px', color: 'var(--text-muted)' }}>
            No audit events matched your filter.
          </div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Timestamp</th>
                  <th style={{ padding: '10px' }}>Operator</th>
                  <th style={{ padding: '10px' }}>Module</th>
                  <th style={{ padding: '10px' }}>Action & Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                        {log.operator}
                      </span>
                    </td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                        {log.module}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{log.action}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>{log.details}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
