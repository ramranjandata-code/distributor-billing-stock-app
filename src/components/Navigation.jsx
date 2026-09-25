import React from 'react';
import { 
  LayoutGrid,
  LayoutDashboard, 
  Receipt, 
  Package, 
  Users, 
  FileText, 
  TrendingUp, 
  Settings, 
  Boxes,
  ShieldCheck,
  Building2
} from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, business, lowStockCount, t }) {
  const navItems = [
    { id: 'dashboard', label: t('dashboard') || 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'Invoicing', icon: Receipt, badge: 'POS', badgeColor: 'badge-success' },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'inventory', label: t('inventory') || 'Inventory', icon: Package, badge: lowStockCount > 0 ? `${lowStockCount} Low` : null, badgeColor: 'badge-danger' },
    { id: 'parties', label: t('parties') || 'Parties', icon: Users },
    { id: 'banking', label: t('banking') || 'Banking', icon: Building2, badge: 'Live', badgeColor: 'badge-success' },
    { id: 'reports', label: t('reports') || 'Reports & P&L', icon: TrendingUp },
    { id: 'audit', label: t('audit') || 'Security & Audit', icon: ShieldCheck },
    { id: 'settings', label: t('settings') || 'Settings', icon: Settings }
  ];

  return (
    <nav className="top-nav-bar no-print" style={{
      background: '#ffffff',
      borderBottom: '1px solid var(--border-color)',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      overflowX: 'auto',
      whiteSpace: 'nowrap',
      scrollbarWidth: 'none',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      {/* Brand & Home Launcher Link */}
      <div 
        onClick={() => setActiveTab('home')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          padding: '8px 12px 8px 0',
          borderRight: '1px solid var(--border-color)',
          marginRight: '2px'
        }}
        title="DistroPulse Home / App Launcher"
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
        }}>
          <Boxes size={18} color="#ffffff" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: 1.1 }}>DistroPulse</span>
          <span style={{ fontSize: '0.62rem', color: '#059669', fontWeight: '800', letterSpacing: '0.04em' }}>ERP</span>
        </div>
      </div>

      {/* Apps Launcher Button */}
      <button
        type="button"
        onClick={() => setActiveTab('home')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '8px',
          border: activeTab === 'home' ? '1px solid #a7f3d0' : '1px solid var(--border-color)',
          background: activeTab === 'home' ? '#ecfdf5' : '#f8fafc',
          color: activeTab === 'home' ? '#059669' : 'var(--text-main)',
          fontSize: '0.82rem',
          fontWeight: '700',
          cursor: 'pointer'
        }}
        title="View All Apps Grid"
      >
        <LayoutGrid size={15} color="var(--primary)" />
        <span>Apps</span>
      </button>

      {/* Horizontal Module Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '11px 12px',
                border: 'none',
                background: isActive ? '#ecfdf5' : 'transparent',
                borderBottom: isActive ? '3px solid #059669' : '3px solid transparent',
                color: isActive ? '#059669' : 'var(--text-muted)',
                fontWeight: isActive ? '800' : '600',
                fontSize: '0.83rem',
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-main)';
                  e.currentTarget.style.background = '#f8fafc';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Icon size={15} color={isActive ? '#059669' : 'currentColor'} />
              <span>{item.label}</span>
              {item.badge && (
                <span className={`badge ${item.badgeColor || 'badge-success'}`} style={{ fontSize: '0.64rem', padding: '1px 5px', fontWeight: '800' }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
