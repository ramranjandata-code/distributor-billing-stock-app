import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Package, 
  Users, 
  FileText, 
  TrendingUp, 
  Settings, 
  X, 
  Boxes,
  ShieldCheck
} from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, business, mobileOpen, setMobileOpen, lowStockCount, t }) {
  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'billing', label: t('billing'), icon: Receipt, badge: 'POS' },
    { id: 'inventory', label: t('inventory'), icon: Package, badge: lowStockCount > 0 ? `${lowStockCount} Low` : null, badgeColor: 'badge-danger' },
    { id: 'parties', label: t('parties'), icon: Users },
    { id: 'invoices', label: t('invoices'), icon: FileText },
    { id: 'reports', label: t('reports'), icon: TrendingUp },
    { id: 'settings', label: t('settings'), icon: Settings }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="modal-overlay no-print" 
          style={{ zIndex: 45 }}
          onClick={() => setMobileOpen(false)} 
        />
      )}

      <aside className={`sidebar no-print ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Sidebar Header */}
        <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '10px', 
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              <Boxes size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: 1.2 }}>DistroPulse</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '700', letterSpacing: '0.05em' }}>STOCK & BILLING</span>
            </div>
          </div>
          {mobileOpen && (
            <button 
              onClick={() => setMobileOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Distributor Quick Info */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', background: '#f8fafc' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {business?.name || 'Distributor Agency'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={14} color="#059669" />
            <span>GSTIN: {business?.gstin || '07AAACG1234F1Z8'}</span>
          </div>
        </div>

        {/* Navigation List */}
        <nav style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: isActive ? '#ecfdf5' : 'transparent',
                    color: isActive ? '#059669' : 'var(--text-muted)',
                    fontWeight: isActive ? '800' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderLeft: isActive ? '3px solid #059669' : '3px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icon size={19} color={isActive ? '#059669' : 'var(--text-muted)'} />
                    <span style={{ fontSize: '0.88rem' }}>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`badge ${item.badgeColor || 'badge-success'}`} style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

      </aside>
    </>
  );
}
