import React, { useState, useEffect } from 'react';
import { 
  initDataStorage, 
  fetchBusinessInfo, 
  fetchProducts, 
  fetchParties, 
  fetchInvoices,
  saveBusinessInfo 
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

import { Menu, Plus, Bell, Store, Save, RefreshCw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [business, setBusiness] = useState(null);
  const [products, setProducts] = useState([]);
  const [parties, setParties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState(null);
  const [editSettingsModal, setEditSettingsModal] = useState(false);
  const [settingsFormData, setSettingsFormData] = useState(null);

  // Initialize data on mount
  useEffect(() => {
    initDataStorage();
    refreshAllData();
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
          borderBottom: '1px solid var(--border-color)'
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
                {activeTab === 'dashboard' && '📊 डैशबोर्ड & ओवरव्यू'}
                {activeTab === 'billing' && '🧾 नया बिल बनाएं (Quick POS Billing)'}
                {activeTab === 'inventory' && '📦 इन्वेंट्री & स्टॉक मैनेजमेंट'}
                {activeTab === 'parties' && '👥 ग्राहक खाता (Retailers & Khata)'}
                {activeTab === 'invoices' && '📑 बिल इतिहास & इनवॉइस रिकॉर्ड'}
                {activeTab === 'reports' && '📈 बिक्री व लाभ रिपोर्ट्स (Analytics)'}
                {activeTab === 'settings' && '⚙️ व्यापार सेटिंग्स (Firm Settings)'}
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {business?.name} • {business?.city || 'Distributor HQ'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lowStockProducts.length > 0 && (
              <button 
                onClick={() => setActiveTab('inventory')}
                className="badge badge-danger" 
                style={{ cursor: 'pointer', padding: '8px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Bell size={14} />
                <span>{lowStockProducts.length} Low Stock Alert</span>
              </button>
            )}

            {activeTab !== 'billing' && (
              <button 
                onClick={() => setActiveTab('billing')}
                className="btn btn-primary"
                style={{ gap: '6px' }}
              >
                <Plus size={18} />
                <span>नया बिल (+)</span>
              </button>
            )}

            <button 
              onClick={refreshAllData}
              className="btn btn-secondary"
              title="Refresh Data"
              style={{ padding: '10px' }}
            >
              <RefreshCw size={18} color="var(--text-muted)" />
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
          />
        )}

        {activeTab === 'inventory' && (
          <Inventory 
            products={products}
            refreshAllData={refreshAllData}
          />
        )}

        {activeTab === 'parties' && (
          <Parties 
            parties={parties}
            invoices={invoices}
            refreshAllData={refreshAllData}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoiceHistory 
            invoices={invoices}
            handlePrintInvoice={handlePrintInvoice}
            refreshAllData={refreshAllData}
          />
        )}

        {activeTab === 'reports' && (
          <Reports 
            invoices={invoices}
            products={products}
            parties={parties}
          />
        )}

        {activeTab === 'settings' && (
          <Settings 
            business={business}
            products={products}
            refreshAllData={refreshAllData}
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
