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
import InvoiceHistory from './components/InvoiceHistory';
import Reports from './components/Reports';
import Settings from './components/Settings';
import InvoicePrintModal from './components/InvoicePrintModal';

import { Menu, Plus, Bell, Store, Save, RefreshCw, Globe, Cloud, CloudOff, CheckCircle2 } from 'lucide-react';
import { getAppLanguage, setAppLanguage, t } from './utils/translations';
import { isSupabaseConnected } from './utils/supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
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

  // Initialize data and setup Auto-Sync on mount
  useEffect(() => {
    initDataStorage();
    refreshAllData();

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

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Navigation 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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
                {activeTab === 'invoices' && translate('history_title')}
                {activeTab === 'reports' && translate('reports_title')}
                {activeTab === 'settings' && translate('settings_title')}
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {business?.name} • {business?.city || 'Distributor HQ'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Live Cloud Sync Status Badge */}
            {cloudConnected ? (
              <div 
                onClick={triggerManualSync}
                className="badge badge-success"
                title="Click to trigger manual sync with Web & Cloud DB"
                style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Cloud size={14} />
                <span>Cloud Synced {lastSyncedTime ? `(${lastSyncedTime})` : ''}</span>
                <RefreshCw size={12} className={isSyncing ? 'spin' : ''} style={{ marginLeft: '2px' }} />
              </div>
            ) : (
              <div 
                onClick={() => setActiveTab('settings')}
                className="badge badge-warning"
                title="Click to setup Supabase Cloud Database credentials"
                style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CloudOff size={14} />
                <span>Offline Mode (Setup Cloud)</span>
              </div>
            )}

            {/* Quick Language Dropdown in Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px 10px' }}>
              <Globe size={16} color="var(--primary-color)" />
              <select
                value={lang}
                onChange={(e) => changeLanguage(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', cursor: 'pointer', outline: 'none' }}
              >
                <option value="en">English</option>
                <option value="hinglish">Hinglish</option>
                <option value="hi">हिंदी (Hindi)</option>
              </select>
            </div>

            {lowStockProducts.length > 0 && (
              <button 
                onClick={() => setActiveTab('inventory')}
                className="badge badge-danger" 
                style={{ cursor: 'pointer', padding: '8px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Bell size={14} />
                <span>{lowStockProducts.length} {translate('low_stock_alert')}</span>
              </button>
            )}

            {activeTab !== 'billing' && (
              <button 
                onClick={() => setActiveTab('billing')}
                className="btn btn-primary"
                style={{ gap: '6px' }}
              >
                <Plus size={18} />
                <span>{translate('new_bill_btn')}</span>
              </button>
            )}

            <button 
              onClick={triggerManualSync}
              className="btn btn-secondary"
              title="Sync with Cloud DB Now"
              style={{ padding: '10px' }}
            >
              <RefreshCw size={18} className={isSyncing ? 'spin' : ''} color="var(--text-muted)" />
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
            setActiveTab={setActiveTab}
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
            setActiveTab={setActiveTab}
            t={translate}
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
            setActiveTab={setActiveTab}
            t={translate}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoiceHistory 
            invoices={invoices}
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
            t={translate}
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

      {/* Invoice Printable Modal */}
      {selectedInvoiceForPrint && (
        <InvoicePrintModal 
          invoice={selectedInvoiceForPrint} 
          business={business}
          onClose={() => setSelectedInvoiceForPrint(null)}
        />
      )}
    </div>
  );
}
