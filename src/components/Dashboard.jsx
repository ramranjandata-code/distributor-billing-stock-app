import React from 'react';
import { 
  TrendingUp, 
  IndianRupee, 
  AlertTriangle, 
  Users, 
  Receipt, 
  Plus, 
  ArrowUpRight, 
  Eye, 
  Printer, 
  Boxes,
  CheckCircle2,
  Clock
} from 'lucide-react';

export default function Dashboard({ products, parties, invoices, business, setActiveTab, handlePrintInvoice, t }) {
  // KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter(inv => inv.date?.startsWith(todayStr));
  const todaySales = todayInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

  const totalStockValue = products.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.purchasePrice || 0)), 0);
  const totalStockItems = products.reduce((sum, p) => sum + (p.currentStock || 0), 0);

  const totalOutstandingBalance = parties.reduce((sum, prt) => sum + (prt.balance || 0), 0);

  const lowStockProducts = products.filter(p => p.currentStock <= (p.minStockLimit || 10));

  const recentInvoices = [...invoices].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Welcome Banner */}
      <div className="glass-card" style={{ 
        padding: '24px', 
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(99, 102, 241, 0.1))',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>
            {t('welcome')} {business?.proprietor || business?.name}! 👋
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {t('dashboard_title')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setActiveTab('billing')} 
            className="btn btn-primary"
            style={{ gap: '8px' }}
          >
            <Receipt size={18} />
            <span>{t('quick_bill')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('inventory')} 
            className="btn btn-secondary"
            style={{ gap: '8px' }}
          >
            <Boxes size={18} />
            <span>{t('update_stock')}</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', 
        gap: '18px' 
      }}>
        {/* Today's Sales */}
        <div className="glass-card glass-card-interactive" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>{t('today_sales')}</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} color="#10b981" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>
            ₹{todaySales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {todayInvoices.length} {t('invoices_cut')}
          </p>
        </div>

        {/* Total Stock Value */}
        <div className="glass-card glass-card-interactive" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>{t('stock_value')}</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes size={20} color="#6366f1" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>
            ₹{totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {totalStockItems} {t('total_units')} • {products.length} {t('total_products')}
          </p>
        </div>

        {/* Total Khata Outstanding */}
        <div className="glass-card glass-card-interactive" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>{t('khata_balance')}</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={20} color="#f59e0b" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#c2410c' }}>
            ₹{totalOutstandingBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {parties.filter(p => p.balance > 0).length} {t('due_on_retailers')}
          </p>
        </div>

        {/* Low Stock Warning Card */}
        <div className="glass-card glass-card-interactive" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>{t('low_stock_items')}</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} color="#f43f5e" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: lowStockProducts.length > 0 ? '#f87171' : '#10b981' }}>
            {lowStockProducts.length} आइटम्स
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {lowStockProducts.length > 0 ? 'तुरंत री-ऑर्डर करने की आवश्यकता' : 'सभी प्रोडक्ट्स का स्टॉक पर्याप्त है'}
          </p>
        </div>
      </div>

      {/* Main Content Grid: Low Stock Alert & Recent Invoices */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Low Stock Warning Section */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="#f59e0b" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>लो-स्टॉक चेतावनी (Low Stock Warnings)</h3>
            </div>
            <button 
              onClick={() => setActiveTab('inventory')}
              className="btn btn-secondary btn-sm"
            >
              सभी देखें
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
              <p style={{ fontWeight: '600', color: 'var(--text-main)' }}>स्टॉक स्थिति उत्तम है!</p>
              <p style={{ fontSize: '0.82rem' }}>किसी भी प्रोडक्ट का स्टॉक लिमिट से नीचे नहीं है।</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lowStockProducts.map(prod => (
                <div 
                  key={prod.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.2)'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)' }}>{prod.name}</h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SKU: {prod.sku} • MRP: ₹{prod.mrp}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
                      बचा स्टॉक: {prod.currentStock} {prod.unit}
                    </span>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      न्यूनतम: {prod.minStockLimit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Bills & Invoices Table */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>हाल ही के बिल (Recent Bills)</h3>
            </div>
            <button 
              onClick={() => setActiveTab('invoices')}
              className="btn btn-secondary btn-sm"
            >
              सभी इनवॉइस
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              <Clock size={36} style={{ margin: '0 auto 10px auto' }} />
              <p>कोई बिल रिकॉर्ड नहीं मिला।</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>इनवॉइस नं</th>
                    <th style={{ padding: '8px 10px' }}>रिटेलर (Party)</th>
                    <th style={{ padding: '8px 10px' }}>रकम</th>
                    <th style={{ padding: '8px 10px' }}>स्थिति</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>प्रिंट</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px', fontWeight: '700', color: 'var(--primary)' }}>{inv.invoiceNo}</td>
                      <td style={{ padding: '10px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.partyName}
                      </td>
                      <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                        ₹{inv.grandTotal.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span className={`badge ${
                          inv.paymentStatus === 'PAID' ? 'badge-success' : inv.paymentStatus === 'UNPAID' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <button 
                          onClick={() => handlePrintInvoice(inv)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Print / View PDF"
                        >
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
