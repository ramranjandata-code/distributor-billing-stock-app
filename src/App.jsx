import React, { useState, useEffect } from 'react';
import { 
  initDataStorage, 
  fetchBusinessInfo, 
  fetchProducts, 
  fetchParties, 
  fetchInvoices,
  saveBusinessInfo,
  performFullSync,
  fetchCloudData
} from './utils/storage';

import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Billing from './components/Billing';
import Parties from './components/Parties';
import ConnectedBanking from './components/ConnectedBanking';
import InvoiceHistory from './components/InvoiceHistory';
import Reports from './components/Reports';
import AuditSecurity from './components/AuditSecurity';
import Settings from './components/Settings';
import InvoicePrintModal from './components/InvoicePrintModal';
import AppLauncher from './components/AppLauncher';

import { Menu, Plus, Bell, Store, Save, RefreshCw, Globe, Cloud, CloudOff, CheckCircle2, Printer, LayoutGrid, AlertCircle, Trash2, X } from 'lucide-react';
import { getAppLanguage, setAppLanguage, t } from './utils/translations';
import { isSupabaseConnected } from './utils/supabaseClient';

export default function App() {
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

  const translate = (key) => t(key, lang);

  const changeLanguage = (newLang) => {
    setAppLanguage(newLang);
    setLang(newLang);
  };

  const triggerManualSync = async () => {
    setIsSyncing(true);
    await performFullSync();
    refreshAllData();
    setLastSyncedTime(new Date().toLocaleTimeString());
    setCloudConnected(true);
    setIsSyncing(false);
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

    // Trigger initial pull on mount
    fetchCloudData().then(() => {
      refreshAllData();
      setLastSyncedTime(new Date().toLocaleTimeString());
      setCloudConnected(true);
    });

    // Listen for local changes to refresh UI instantly
    const handleDataChange = () => {
      refreshAllData();
      setLastSyncedTime(new Date().toLocaleTimeString());
    };
    window.addEventListener('distro_data_changed', handleDataChange);
    window.addEventListener('storage', handleDataChange);

    // Set up auto sync polling every 2 seconds across all devices
    const interval = setInterval(() => {
      fetchCloudData().then((updated) => {
        if (updated) {
          refreshAllData();
          setLastSyncedTime(new Date().toLocaleTimeString());
        }
        setCloudConnected(true);
      }).catch(err => console.warn('Auto polling warning:', err));
    }, 2000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('distro_data_changed', handleDataChange);
      window.removeEventListener('storage', handleDataChange);
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

  if (activeTab === 'home') {
    return (
      <>
        <AppLauncher 
          setActiveTab={navigateToTab}
          business={business}
          products={products}
          parties={parties}
          invoices={invoices}
          cloudConnected={cloudConnected}
          lastSyncedTime={lastSyncedTime}
          triggerManualSync={triggerManualSync}
        />
        {selectedInvoiceForPrint && (
          <InvoicePrintModal 
            invoice={selectedInvoiceForPrint} 
            business={business}
            onClose={() => setSelectedInvoiceForPrint(null)}
            refreshAllData={refreshAllData}
          />
        )}
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Navigation 
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        business={business}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        lowStockCount={lowStockProducts.length}
        t={translate}
      />

      {/* Main Container */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="no-print" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button 
              className="btn btn-secondary no-print"
              onClick={() => navigateToTab('home')}
              title="Return to App Launcher (Home)"
              style={{ gap: '6px', padding: '7px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center' }}
            >
              <LayoutGrid size={17} color="var(--primary)" />
              <span style={{ fontWeight: '700', fontSize: '0.84rem' }}>Apps</span>
            </button>

            <button 
              className="btn btn-secondary no-print"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ display: 'none', padding: '8px 12px' }}
              id="mobile-menu-btn"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
                {activeTab === 'dashboard' && translate('dashboard_title')}
                {activeTab === 'billing' && translate('create_bill')}
                {activeTab === 'inventory' && translate('inventory_title')}
                {activeTab === 'parties' && translate('parties_title')}
                {activeTab === 'banking' && 'Connected Banking & Reconciliation'}
                {activeTab === 'invoices' && translate('history_title')}
                {activeTab === 'reports' && translate('reports_title')}
                {activeTab === 'audit' && 'Security, Audit Trail & System Backup'}
                {activeTab === 'settings' && translate('settings_title')}
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
                title={`Cloud Synced ${lastSyncedTime ? `(${lastSyncedTime})` : ''} - Click to sync`}
                style={{ 
                  cursor: 'pointer', 
                  padding: '5px 10px', 
                  borderRadius: '20px', 
                  background: 'rgba(16, 185, 129, 0.12)', 
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
                  boxShadow: '0 0 8px #10b981',
                  display: 'inline-block'
                }} />
                <span>Cloud</span>
              </div>
            ) : (
              <div 
                onClick={() => navigateToTab('settings')}
                title="Offline Mode - Click to setup Cloud"
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

            {/* Small App Reload Icon Button */}
            <button 
              onClick={handleAppReload}
              className="btn btn-secondary"
              title="Refresh App (Reload - F5)"
              style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        {/* View Switcher */}
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

      {/* Invoice Printable Modal */}
      {selectedInvoiceForPrint && (
        <InvoicePrintModal 
          invoice={selectedInvoiceForPrint} 
          business={business}
          onClose={() => setSelectedInvoiceForPrint(null)}
          refreshAllData={refreshAllData}
        />
      )}
    </div>
  );
}
