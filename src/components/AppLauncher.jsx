import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  ShoppingBag, 
  Boxes, 
  Building2, 
  TrendingUp, 
  Users, 
  Settings, 
  ShieldCheck,
  Search,
  Cloud,
  CloudOff,
  RefreshCw,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function AppLauncher({ 
  setActiveTab, 
  business, 
  products = [], 
  parties = [], 
  invoices = [], 
  cloudConnected, 
  lastSyncedTime, 
  triggerManualSync 
}) {
  const [searchTerm, setSearchTerm] = useState('');

  // Live metric counters for badges
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter(inv => inv.date?.startsWith(todayStr));
  const todaySales = todayInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const lowStockCount = products.filter(p => p.currentStock <= (p.minStockLimit || 10)).length;
  const duePartiesCount = parties.filter(p => (p.balance || 0) > 0).length;
  const unpaidInvoicesCount = invoices.filter(inv => inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'PARTIALLY_PAID').length;
  const totalStockItems = products.reduce((sum, p) => sum + (p.currentStock || 0), 0);

  // App definitions mirroring DistroPulse signature green theme & modules
  const apps = [
    {
      id: 'dashboard',
      name: 'Main Dashboard',
      category: 'Analytics',
      description: 'KPIs, Diagrams, Pie Charts, Bar Graphs & Histograms',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      shadowColor: 'rgba(16, 185, 129, 0.25)',
      badge: 'Live Charts',
      badgeBg: '#ecfdf5',
      badgeColor: '#059669',
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      )
    },
    {
      id: 'billing',
      name: 'Invoicing',
      category: 'Billing',
      description: 'Create Tax Invoice, POS Billing & Barcode Counter',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
      shadowColor: 'rgba(2, 132, 199, 0.25)',
      badge: todayInvoices.length > 0 ? `${todayInvoices.length} Today` : 'New Bill (+)',
      badgeBg: todayInvoices.length > 0 ? '#e0f2fe' : '#dcfce7',
      badgeColor: todayInvoices.length > 0 ? '#0284c7' : '#059669',
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      )
    },
    {
      id: 'invoices',
      name: 'Invoice History',
      category: 'Records',
      description: 'All Billed Records, Payment Status & Credit Notes',
      gradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
      shadowColor: 'rgba(79, 70, 229, 0.25)',
      badge: unpaidInvoicesCount > 0 ? `${unpaidInvoicesCount} Pending` : `${invoices.length} Bills`,
      badgeBg: unpaidInvoicesCount > 0 ? '#fee2e2' : '#ede9fe',
      badgeColor: unpaidInvoicesCount > 0 ? '#dc2626' : '#4f46e5',
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      )
    },
    {
      id: 'inventory',
      name: 'Inventory',
      category: 'Stock',
      description: 'Stock Ledger, Carton Packing & Godown Valuation',
      gradient: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
      shadowColor: 'rgba(13, 148, 136, 0.25)',
      badge: lowStockCount > 0 ? `⚠️ ${lowStockCount} Low` : `${products.length} Items`,
      badgeBg: lowStockCount > 0 ? '#fee2e2' : '#dcfce7',
      badgeColor: lowStockCount > 0 ? '#dc2626' : '#059669',
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      )
    },
    {
      id: 'banking',
      name: 'Banking',
      category: 'Finance',
      description: 'Connected Bank Accounts, UPI Reconciliation & Transfers',
      gradient: 'linear-gradient(135deg, #0891b2 0%, #0284c7 100%)',
      shadowColor: 'rgba(8, 145, 178, 0.25)',
      badge: 'Live Auto',
      badgeBg: '#cffafe',
      badgeColor: '#0891b2',
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="21" x2="21" y2="21" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <polygon points="12 3 2 10 22 10 12 3" />
          <line x1="6" y1="10" x2="6" y2="21" />
          <line x1="10" y1="10" x2="10" y2="21" />
          <line x1="14" y1="10" x2="14" y2="21" />
          <line x1="18" y1="10" x2="18" y2="21" />
        </svg>
      )
    },
    {
      id: 'reports',
      name: 'Reports',
      category: 'Accounting',
      description: 'Sole Proprietor P&L, GST Returns (GSTR-1, 3B) & Day Book',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      shadowColor: 'rgba(139, 92, 246, 0.25)',
      badge: 'P&L / GST',
      badgeBg: '#f3e8ff',
      badgeColor: '#7c3aed',
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      )
    },
    {
      id: 'parties',
      name: 'Retailers & Khata',
      category: 'CRM & Credit',
      description: 'Retailer Accounts, Credit Limits & Balance Recovery',
      gradient: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
      shadowColor: 'rgba(234, 88, 12, 0.25)',
      badge: duePartiesCount > 0 ? `${duePartiesCount} Udhar` : `${parties.length} Retailers`,
      badgeBg: duePartiesCount > 0 ? '#ffedd5' : '#fef3c7',
      badgeColor: duePartiesCount > 0 ? '#ea580c' : '#d97706',
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    },
    {
      id: 'settings',
      name: 'Settings',
      category: 'System',
      description: 'Firm Profile, Cloud DB Credentials & Backup',
      gradient: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
      shadowColor: 'rgba(71, 85, 105, 0.25)',
      badge: 'Config',
      badgeBg: '#f1f5f9',
      badgeColor: '#475569',
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )
    },
    {
      id: 'audit',
      name: 'Audit & Security',
      category: 'Security',
      description: 'System Activity Logs, User Access & Data Integrity',
      gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      shadowColor: 'rgba(30, 41, 59, 0.25)',
      badge: 'Protected',
      badgeBg: '#e2e8f0',
      badgeColor: '#334155',
      icon: (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    }
  ];

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#f8fafc',
      color: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-body)',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      
      {/* Ambient background subtle lighting */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '800px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.09) 0%, rgba(5, 150, 105, 0.03) 50%, transparent 80%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* TOP HEADER BAR */}
      <header style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 28px',
        borderBottom: '1px solid #e2e8f0',
        backdropFilter: 'blur(16px)',
        background: 'rgba(255, 255, 255, 0.95)',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
      }}>
        
        {/* Brand & Firm Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)'
          }}>
            <Boxes size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#0f172a' }}>
                DistroPulse ERP
              </span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px',
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0'
              }}>
                v2.0 Distributor Edition
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
              {business?.name || 'Distributor Agency'} • {business?.city || 'Distributor HQ'}
            </p>
          </div>
        </div>

        {/* Global App Search Input */}
        <div style={{
          position: 'relative',
          minWidth: '280px',
          maxWidth: '440px',
          flex: 1
        }}>
          <Search 
            size={16} 
            color="#64748b" 
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} 
          />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search apps (Dashboard, Invoicing, Inventory, Reports...)"
            style={{
              width: '100%',
              padding: '9px 14px 9px 38px',
              borderRadius: '24px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontSize: '0.86rem',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
            onFocus={(e) => {
              e.target.style.background = '#ffffff';
              e.target.style.borderColor = '#059669';
              e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.2)';
            }}
            onBlur={(e) => {
              e.target.style.background = '#ffffff';
              e.target.style.borderColor = '#cbd5e1';
              e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
            }}
          />
        </div>

        {/* Right Status Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {cloudConnected ? (
            <div 
              onClick={triggerManualSync}
              title={`Cloud Synced ${lastSyncedTime ? `(${lastSyncedTime})` : ''} - Click to refresh`}
              style={{
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '20px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                fontSize: '0.78rem',
                fontWeight: '700',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)'
              }} />
              <span>Cloud DB Active</span>
            </div>
          ) : (
            <div 
              onClick={() => setActiveTab('settings')}
              style={{
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '20px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                fontSize: '0.78rem',
                fontWeight: '700',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
              <span>Offline Mode</span>
            </div>
          )}

          <button 
            onClick={() => window.location.reload()}
            className="btn btn-secondary"
            title="Reload App (F5)"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      {/* MAIN LAUNCHER BODY */}
      <main style={{
        position: 'relative',
        zIndex: 5,
        flex: 1,
        maxWidth: '1240px',
        width: '100%',
        margin: '0 auto',
        padding: '40px 24px 60px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        
        {/* Apps Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 150px))',
          gap: '28px 24px',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '960px',
          margin: '20px auto 40px auto'
        }}>
          {filteredApps.map(app => (
            <div
              key={app.id}
              onClick={() => setActiveTab(app.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                const iconBox = e.currentTarget.querySelector('.odoo-app-icon');
                if (iconBox) {
                  iconBox.style.transform = 'scale(1.06)';
                  iconBox.style.boxShadow = `0 14px 28px ${app.shadowColor}, 0 0 0 2px rgba(16, 185, 129, 0.25)`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
                const iconBox = e.currentTarget.querySelector('.odoo-app-icon');
                if (iconBox) {
                  iconBox.style.transform = 'scale(1)';
                  iconBox.style.boxShadow = `0 8px 20px ${app.shadowColor}`;
                }
              }}
            >
              {/* App Icon Tile */}
              <div 
                className="odoo-app-icon"
                style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '18px',
                  background: app.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 8px 20px ${app.shadowColor}`,
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  position: 'relative',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {app.icon}

                {/* Notification Badge */}
                {app.badge && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-8px',
                    fontSize: '0.68rem',
                    fontWeight: '800',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    background: app.badgeBg,
                    color: app.badgeColor,
                    border: `1px solid ${app.badgeColor}30`,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
                    whiteSpace: 'nowrap'
                  }}>
                    {app.badge}
                  </span>
                )}
              </div>

              {/* App Name Label */}
              <span style={{
                marginTop: '10px',
                fontSize: '0.88rem',
                fontWeight: '700',
                color: '#1e293b',
                textAlign: 'center',
                letterSpacing: '-0.01em',
                textShadow: 'none'
              }}>
                {app.name}
              </span>

              {/* Sub-label Category */}
              <span style={{
                fontSize: '0.74rem',
                color: '#64748b',
                textAlign: 'center',
                marginTop: '2px',
                fontWeight: '500'
              }}>
                {app.category}
              </span>
            </div>
          ))}
        </div>

        {/* QUICK STATS & LAUNCH BAR (At the bottom of Launcher) */}
        <div style={{
          width: '100%',
          maxWidth: '960px',
          marginTop: 'auto',
          padding: '20px 24px',
          borderRadius: '18px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '18px'
        }}>
          {/* Today's Sales */}
          <div 
            onClick={() => setActiveTab('billing')}
            style={{ cursor: 'pointer', padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9', transition: 'all 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Today's Sales
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#059669', marginTop: '3px' }}>
              ₹{todaySales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
              <span>{todayInvoices.length} orders issued</span>
              <ArrowRight size={12} color="#059669" />
            </div>
          </div>

          {/* Active Inventory */}
          <div 
            onClick={() => setActiveTab('inventory')}
            style={{ cursor: 'pointer', padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9', transition: 'all 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Inventory Stock
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#2563eb', marginTop: '3px' }}>
              {totalStockItems} <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>Units</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: lowStockCount > 0 ? '#dc2626' : '#059669', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
              <span>{lowStockCount > 0 ? `${lowStockCount} items low stock` : 'Healthy stock levels'}</span>
              <ArrowRight size={12} color={lowStockCount > 0 ? '#dc2626' : '#059669'} />
            </div>
          </div>

          {/* Outstanding Khata */}
          <div 
            onClick={() => setActiveTab('parties')}
            style={{ cursor: 'pointer', padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9', transition: 'all 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Retailer Dues (Khata)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#d97706', marginTop: '3px' }}>
              ₹{parties.reduce((s, p) => s + (p.balance || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#b45309', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
              <span>{duePartiesCount} retailers with balance</span>
              <ArrowRight size={12} color="#d97706" />
            </div>
          </div>

          {/* Quick Action: Open Dashboard */}
          <div 
            onClick={() => setActiveTab('dashboard')}
            style={{
              cursor: 'pointer',
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '1px solid #a7f3d0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.08)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(5, 150, 105, 0.16)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(5, 150, 105, 0.08)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#065f46' }}>View Analytics</span>
              <ArrowRight size={16} color="#059669" />
            </div>
            <span style={{ fontSize: '0.74rem', color: '#047857', marginTop: '4px', fontWeight: '500' }}>
              Open Bar Graphs, Pie Charts & Histograms
            </span>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        padding: '16px 20px',
        borderTop: '1px solid #e2e8f0',
        background: '#ffffff',
        color: '#64748b',
        fontSize: '0.76rem',
        fontWeight: '500'
      }}>
        DistroPulse ERP • Enterprise Distribution System • 100% English Edition
      </footer>

    </div>
  );
}
