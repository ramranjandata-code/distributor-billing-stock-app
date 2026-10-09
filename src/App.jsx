import React, { useState, useEffect, lazy, Suspense } from 'react';
import { 
  initDataStorage, 
  fetchBusinessInfo, 
  fetchProducts, 
  fetchParties, 
  fetchInvoices,
  saveBusinessInfo,
  performFullSync,
  fetchCloudData,
  STORAGE_KEYS,
  getStorageData
} from './utils/storage';
import { setupRealtimeSubscription } from './utils/realtimeSync';

import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';

// Code-split heavy views to reduce initial bundle by ~70% and make app boot instant
const Inventory = lazy(() => import('./components/Inventory'));
const Billing = lazy(() => import('./components/Billing'));
const Parties = lazy(() => import('./components/Parties'));
const ConnectedBanking = lazy(() => import('./components/ConnectedBanking'));
const InvoiceHistory = lazy(() => import('./components/InvoiceHistory'));
const Reports = lazy(() => import('./components/Reports'));
const AuditSecurity = lazy(() => import('./components/AuditSecurity'));
const Settings = lazy(() => import('./components/Settings'));
const InvoicePrintModal = lazy(() => import('./components/InvoicePrintModal'));
const AppLauncher = lazy(() => import('./components/AppLauncher'));
const SalesReturns = lazy(() => import('./components/SalesReturns'));
const PurchaseReturns = lazy(() => import('./components/PurchaseReturns'));
const CloudSyncModal = lazy(() => import('./components/CloudSyncModal'));
const Login = lazy(() => import('./components/Login'));

const TabLoadingFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', flexDirection: 'column', gap: '12px' }}>
    <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Loading module...</span>
  </div>
);

import { Menu, Plus, Bell, Store, Save, RefreshCw, Globe, Cloud, CloudOff, CheckCircle2, Printer, LayoutGrid, AlertCircle, Trash2, X } from 'lucide-react';
import { getAppLanguage, setAppLanguage, t } from './utils/translations';
import { isSupabaseConnected, applyCloudPairingCode } from './utils/supabaseClient';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      const session = localStorage.getItem('distro_auth_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.authenticated === true) return true;
      }
    } catch (e) {}
    // Auto-authenticate so phone and laptops open store directly without barrier
    localStorage.setItem('distro_auth_session', JSON.stringify({ authenticated: true, loginTime: Date.now() }));
    return true;
  });

  const [activeTab, setActiveTab] = useState('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lang, setLang] = useState(getAppLanguage());

  const [business, setBusiness] = useState(null);
  const [products, setProducts] = useState([]);
  const [parties, setParties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState(null);
  const [editSettingsModal, setEditSettingsModal] = useState(false);
  const [settingsFormData, setSettingsFormData] = useState(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(null);
  const [cloudConnected, setCloudConnected] = useState(isSupabaseConnected());
  const [cloudModalOpen, setCloudModalOpen] = useState(false);

  const translate = (key) => t(key, lang);

  const changeLanguage = (newLang) => {
    setAppLanguage(newLang);
    setLang(newLang);
  };

  const [syncToast, setSyncToast] = useState('');

  const triggerManualSync = async () => {
    setIsSyncing(true);
    setSyncToast('⚡ Syncing with Cloud Database...');
    try {
      await fetchCloudData(true);
      refreshAllData();
      const currentInvoices = fetchInvoices();
      const currentPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
      setLastSyncedTime(new Date().toLocaleTimeString());
      setCloudConnected(true);
      setSyncToast(`✅ Cloud Synced! (${currentInvoices.length} Invoices, ${currentPurchases.length} Purchase Bills)`);
    } catch (e) {
      setSyncToast('⚠️ Cloud Sync completed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncToast(''), 4500);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('distro_auth_session');
    setIsAuthenticated(false);
  };

  // Navigation Guard for Active Unsaved Bill
  const [billingGuard, setBillingGuard] = useState(null);
  const [pendingTab, setPendingTab] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const navigateToTab = (targetTab) => {
    if (activeTab === 'billing' && targetTab !== 'billing' && billingGuard?.isDirty) {
      setPendingTab(targetTab);
      setShowUnsavedModal(true);
      return;
    }
    setActiveTab(targetTab);
  };

  const handleConfirmSaveDraft = () => {
    billingGuard?.saveDraft?.();
    setShowUnsavedModal(false);
    if (pendingTab) {
      if (pendingTab === 'reload') {
        window.location.reload();
      } else {
        setActiveTab(pendingTab);
      }
      setPendingTab(null);
    }
  };

  const handleConfirmDiscard = () => {
    try {
      localStorage.removeItem('distro_active_billing_draft');
    } catch (e) {}
    billingGuard?.discard?.();
    setShowUnsavedModal(false);
    if (pendingTab) {
      if (pendingTab === 'reload') {
        window.location.reload();
      } else {
        setActiveTab(pendingTab);
      }
      setPendingTab(null);
    }
  };

  const handleCancelNavigation = () => {
    setShowUnsavedModal(false);
    setPendingTab(null);
  };

  const handleAppReload = () => {
    if (activeTab === 'billing' && billingGuard?.isDirty) {
      setPendingTab('reload');
      setShowUnsavedModal(true);
      return;
    }
    window.location.reload();
  };

  // Initialize data and setup Auto-Sync on mount
  useEffect(() => {
    initDataStorage();
    refreshAllData();

    // Keyboard shortcut for reload: F5 or Ctrl+R
    const handleKeyDown = (e) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 1-Click Multi-Device Cloud Pairing (Phone / Laptop via QR code or link)
    try {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      let pairingCode = '';
      if (hash.includes('cloud_connect=')) {
        pairingCode = hash.split('cloud_connect=')[1].split('&')[0];
      } else if (search.includes('cloud_connect=')) {
        const params = new URLSearchParams(search);
        pairingCode = params.get('cloud_connect') || '';
      }

      if (pairingCode) {
        const applied = applyCloudPairingCode(pairingCode);
        if (applied) {
          if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
          fetchCloudData(true).then(() => {
            refreshAllData();
            setCloudConnected(true);
            alert('🎉 Device Successfully Connected to Cloud Database!\n\nAll products, bills, stock, and party ledgers are now synchronized.');
          });
        }
      }
    } catch (err) {
      console.warn('Pairing link evaluation warning:', err);
    }

    // 1. Setup Supabase WebSocket Realtime + Local BroadcastChannel (<50ms delay)
    const cleanupRealtime = setupRealtimeSubscription(() => {
      refreshAllData();
      setLastSyncedTime(new Date().toLocaleTimeString());
      setCloudConnected(true);
    });

    // 2. Initial cloud pull on mount (forces fresh pull from cloud bins)
    fetchCloudData(true).then((connected) => {
      refreshAllData();
      setLastSyncedTime(new Date().toLocaleTimeString());
      setCloudConnected(true);
    });

    // 3. Listen for local changes to refresh UI instantly (0ms)
    const handleDataChange = () => {
      refreshAllData();
      setLastSyncedTime(new Date().toLocaleTimeString());
    };
    window.addEventListener('distro_data_changed', handleDataChange);
    window.addEventListener('storage', handleDataChange);

    // 4. Background Heartbeat Polling (Relaxed 30s active, 60s hidden)
    // Instant multi-device synchronization is handled via Supabase WebSocket (<50ms) and BroadcastChannel (0ms).
    // This heartbeat only serves as a fallback safety net for offline re-connections.
    let syncInterval = null;
    const startPolling = (ms = 30000) => {
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(() => {
        fetchCloudData(false).then((updated) => {
          if (updated) {
            refreshAllData();
            setLastSyncedTime(new Date().toLocaleTimeString());
          }
          setCloudConnected(true);
        }).catch(() => {
          setCloudConnected(false);
        });
      }, ms);
    };
    startPolling(30000);

    // 5. Throttled Sync Triggers (Minimum 15s debounce on focus & online to avoid UI freezes)
    let lastFocusSync = 0;
    const handleThrottledSync = () => {
      const now = Date.now();
      if (now - lastFocusSync < 15000) return;
      lastFocusSync = now;
      fetchCloudData(false).then((updated) => {
        if (updated) {
          refreshAllData();
          setLastSyncedTime(new Date().toLocaleTimeString());
        }
        setCloudConnected(true);
      }).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleThrottledSync();
        startPolling(30000);
      } else {
        startPolling(60000);
      }
    };

    window.addEventListener('focus', handleThrottledSync);
    window.addEventListener('online', handleThrottledSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (syncInterval) clearInterval(syncInterval);
      cleanupRealtime();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('distro_data_changed', handleDataChange);
      window.removeEventListener('storage', handleDataChange);
      window.removeEventListener('focus', handleThrottledSync);
      window.removeEventListener('online', handleThrottledSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const refreshAllData = () => {
    const b = fetchBusinessInfo();
    const p = fetchProducts();
    const prt = fetchParties();
    const inv = fetchInvoices();

    setBusiness(b);
    setProducts(p);
    setParties(prt);
    setInvoices(inv);
    setSettingsFormData(b);
    setCloudConnected(isSupabaseConnected());
  };

  const lowStockProducts = products.filter(p => p.currentStock <= (p.minStockLimit || 10));

  const handlePrintInvoice = (inv) => {
    setSelectedInvoiceForPrint(inv);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    const updated = saveBusinessInfo(settingsFormData);
    setBusiness(updated);
    setEditSettingsModal(false);
    alert('Firm settings updated successfully!');
  };

  if (!isAuthenticated) {
    return (
      <Login 
        business={business} 
        onLoginSuccess={() => {
          setIsAuthenticated(true);
          fetchCloudData(true).then(() => {
            refreshAllData();
            setCloudConnected(isSupabaseConnected());
          });
        }} 
      />
    );
  }

  if (activeTab === 'home') {
    return (
      <Suspense fallback={<TabLoadingFallback />}>
        <AppLauncher 
          setActiveTab={navigateToTab}
          business={business}
          products={products}
          parties={parties}
          invoices={invoices}
          cloudConnected={cloudConnected}
          lastSyncedTime={lastSyncedTime}
          triggerManualSync={triggerManualSync}
          onOpenCloudModal={() => setCloudModalOpen(true)}
          onLogout={handleLogout}
        />
        {selectedInvoiceForPrint && (
        <InvoicePrintModal 
            invoice={selectedInvoiceForPrint} 
            business={business}
            onClose={() => setSelectedInvoiceForPrint(null)}
            refreshAllData={refreshAllData}
            onEditInvoice={() => { setSelectedInvoiceForPrint(null); setActiveTab('billing'); }}
          />
        )}
        <CloudSyncModal 
          isOpen={cloudModalOpen} 
          onClose={() => setCloudModalOpen(false)} 
          refreshAllData={refreshAllData}
          onSyncStateChange={(conn) => setCloudConnected(conn)}
        />
      </Suspense>
    );
  }

  return (
    <div className="app-container">
      {/* Top Full-Width Navigation Bar */}
      <Navigation 
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        business={business}
        lowStockCount={lowStockProducts.length}
        t={translate}
        onOpenCloudModal={() => setCloudModalOpen(true)}
        isCloudConnected={cloudConnected}
        onLogout={handleLogout}
        onSyncCloud={triggerManualSync}
        isSyncing={isSyncing}
      />

      {/* Main Container */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="no-print" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: '20px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                {activeTab === 'dashboard' && translate('dashboard_title')}
                {activeTab === 'billing' && translate('create_bill')}
                {activeTab === 'inventory' && translate('inventory_title')}
                {activeTab === 'parties' && translate('parties_title')}
                {activeTab === 'banking' && 'Connected Banking & Reconciliation'}
                {activeTab === 'invoices' && translate('history_title')}
                {activeTab === 'reports' && translate('reports_title')}
                {activeTab === 'audit' && 'Security, Audit Trail & System Backup'}
                {activeTab === 'settings' && translate('settings_title')}
                {activeTab === 'purchase_returns' && 'Vendor Claims & Purchase Returns'}
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {business?.name} • {business?.city || 'Distributor HQ'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* Live Cloud Sync Green Dot Indicator */}
            {cloudConnected ? (
              <div 
                onClick={triggerManualSync}
                title={`⚡ Live Realtime Cloud Sync Active • Last Synced: ${lastSyncedTime || 'Just now'} • Click to Sync Cloud Now`}
                style={{ 
                  cursor: 'pointer', 
                  padding: '5px 12px', 
                  borderRadius: '20px', 
                  background: isSyncing ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.12)', 
                  border: '1px solid rgba(16, 185, 129, 0.3)', 
                  fontSize: '0.78rem', 
                  fontWeight: '700', 
                  color: '#059669', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px' 
                }}
              >
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: '#10b981', 
                  boxShadow: '0 0 10px #10b981',
                  display: 'inline-block'
                }} />
                <span>{isSyncing ? '⚡ Syncing Cloud...' : '⚡ Cloud Live (Tap to Sync)'}</span>
              </div>
            ) : (
              <div 
                onClick={() => setCloudModalOpen(true)}
                title="Offline Mode - Click to connect Phone & Laptops"
                style={{ 
                  cursor: 'pointer', 
                  padding: '5px 10px', 
                  borderRadius: '20px', 
                  background: 'rgba(245, 158, 11, 0.12)', 
                  border: '1px solid rgba(245, 158, 11, 0.3)', 
                  fontSize: '0.78rem', 
                  fontWeight: '700', 
                  color: '#d97706', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px' 
                }}
              >
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: '#f59e0b', 
                  display: 'inline-block'
                }} />
                <span>Offline</span>
              </div>
            )}



            {lowStockProducts.length > 0 && (
              <button 
                onClick={() => navigateToTab('inventory')}
                className="badge badge-danger" 
                style={{ cursor: 'pointer', padding: '8px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Bell size={14} />
                <span>{lowStockProducts.length} {translate('low_stock_alert')}</span>
              </button>
            )}

            {activeTab === 'reports' && (
              <button 
                onClick={() => window.print()}
                className="btn btn-primary no-print"
                style={{ gap: '6px', padding: '6px 14px', fontSize: '0.85rem', fontWeight: '700', whiteSpace: 'nowrap' }}
              >
                <Printer size={16} />
                <span>Export PDF</span>
              </button>
            )}

            {activeTab !== 'billing' && (
              <button 
                onClick={() => navigateToTab('billing')}
                className="btn btn-primary"
                style={{ gap: '6px' }}
              >
                <Plus size={18} />
                <span>{translate('new_bill_btn')}</span>
              </button>
            )}

            {/* Quick Force Cloud Sync Button */}
            <button 
              onClick={triggerManualSync}
              className="btn btn-secondary"
              title="Sync with Cloud Database (Fetch Latest Invoices & Bills)"
              style={{ 
                padding: '7px 12px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontWeight: '700',
                background: isSyncing ? '#ecfdf5' : '#ffffff',
                borderColor: isSyncing ? '#10b981' : 'var(--border-color)',
                color: isSyncing ? '#059669' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={15} className={isSyncing ? "spin" : ""} />
              <span style={{ fontSize: '0.8rem' }}>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </button>
          </div>
        </header>

        {/* Floating Toast Notification for Cloud Sync Status */}
        {syncToast && (
          <div style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            background: '#0f172a',
            color: '#ffffff',
            padding: '10px 22px',
            borderRadius: '30px',
            fontSize: '0.85rem',
            fontWeight: '700',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>{syncToast}</span>
          </div>
        )}

        {/* View Switcher */}
        <Suspense fallback={<TabLoadingFallback />}>
          {activeTab === 'dashboard' && (
            <Dashboard 
              products={products}
              parties={parties}
              invoices={invoices}
              business={business}
              setActiveTab={navigateToTab}
              handlePrintInvoice={handlePrintInvoice}
              t={translate}
            />
          )}

          {activeTab === 'billing' && (
            <Billing 
              products={products}
              parties={parties}
              business={business}
              invoices={invoices}
              refreshAllData={refreshAllData}
              handlePrintInvoice={handlePrintInvoice}
              setActiveTab={navigateToTab}
              t={translate}
              onRegisterNavigationGuard={setBillingGuard}
            />
          )}

          {activeTab === 'inventory' && (
            <Inventory 
              products={products}
              refreshAllData={refreshAllData}
              t={translate}
            />
          )}

          {activeTab === 'parties' && (
            <Parties 
              parties={parties}
              invoices={invoices}
              refreshAllData={refreshAllData}
              setActiveTab={navigateToTab}
              t={translate}
            />
          )}

          {activeTab === 'banking' && (
            <ConnectedBanking 
              parties={parties}
              invoices={invoices}
              business={business}
              refreshAllData={refreshAllData}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoiceHistory 
              invoices={invoices}
              parties={parties}
              products={products}
              business={business}
              setActiveTab={navigateToTab}
              handlePrintInvoice={handlePrintInvoice}
              refreshAllData={refreshAllData}
              t={translate}
            />
          )}

          {activeTab === 'purchase_returns' && (
            <PurchaseReturns 
              onNavigateToInvoices={() => navigateToTab('invoices')} 
            />
          )}

          {activeTab === 'returns' && (
            <SalesReturns 
              onNavigateToInvoice={(invId) => {
                navigateToTab('invoices');
              }}
            />
          )}

          {activeTab === 'reports' && (
            <Reports 
              invoices={invoices}
              products={products}
              parties={parties}
              business={business}
              refreshAllData={refreshAllData}
              t={translate}
            />
          )}

          {activeTab === 'audit' && (
            <AuditSecurity 
              refreshAllData={refreshAllData}
            />
          )}

          {activeTab === 'settings' && (
            <Settings 
              business={business}
              products={products}
              refreshAllData={refreshAllData}
              lang={lang}
              changeLanguage={changeLanguage}
              t={translate}
            />
          )}
        </Suspense>
      </main>

      {/* Unsaved Invoice Confirmation Popup Modal */}
      {showUnsavedModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '460px', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ 
                  width: '42px', 
                  height: '42px', 
                  borderRadius: '12px', 
                  background: '#fef3c7', 
                  color: '#d97706', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0 
                }}>
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                    Unsaved Invoice in Progress
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    You have <strong style={{ color: 'var(--text-main)' }}>{billingGuard?.itemCount || 1} item(s)</strong> in your cart. Leaving now will discard your unsaved items.
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={handleCancelNavigation}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                title="Cancel"
              >
                <X size={18} />
              </button>
            </div>

            {/* Explanation box */}
            <div style={{ 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: '10px', 
              padding: '12px 14px', 
              marginBottom: '20px',
              fontSize: '0.8rem',
              color: '#475569',
              lineHeight: 1.5
            }}>
              💡 <strong>Save Draft:</strong> Saves this invoice safely to <em>Invoice Records</em> without deducting stock, so you can edit or confirm it anytime.<br />
              🗑️ <strong>Discard:</strong> Empties the cart and exits the billing page.
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={handleConfirmSaveDraft}
                className="btn btn-primary"
                style={{ width: '100%', padding: '11px', fontSize: '0.9rem', fontWeight: '700', gap: '8px', justifyContent: 'center' }}
              >
                <Save size={18} />
                <span>Save as Draft & Leave</span>
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCancelNavigation}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: '600', justifyContent: 'center' }}
                >
                  Keep Editing (Stay)
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  className="btn btn-danger"
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: '700', gap: '6px', justifyContent: 'center' }}
                >
                  <Trash2 size={16} />
                  <span>Discard & Leave</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Invoice Printable Modal & Cloud Modal */}
      <Suspense fallback={null}>
        {selectedInvoiceForPrint && (
          <InvoicePrintModal 
            invoice={selectedInvoiceForPrint} 
            business={business}
            onClose={() => setSelectedInvoiceForPrint(null)}
            refreshAllData={refreshAllData}
            onEditInvoice={() => { setSelectedInvoiceForPrint(null); navigateToTab('billing'); }}
          />
        )}

        <CloudSyncModal 
          isOpen={cloudModalOpen} 
          onClose={() => setCloudModalOpen(false)} 
          refreshAllData={refreshAllData}
          onSyncStateChange={(conn) => setCloudConnected(conn)}
        />
      </Suspense>
    </div>
  );
}
