import React, { useState } from 'react';
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
  Clock,
  Search,
  X,
  MessageCircle,
  Phone,
  ChevronRight
} from 'lucide-react';

export default function Dashboard({ products, parties, invoices, business, setActiveTab, handlePrintInvoice, t }) {
  const [udharModalOpen, setUdharModalOpen] = useState(false);
  const [udharSearchTerm, setUdharSearchTerm] = useState('');

  // KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter(inv => inv.date?.startsWith(todayStr));
  const todaySales = todayInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

  const totalStockValue = products.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.purchasePrice || 0)), 0);
  const totalStockItems = products.reduce((sum, p) => sum + (p.currentStock || 0), 0);

  const totalOutstandingBalance = parties.reduce((sum, prt) => sum + (prt.balance || 0), 0);
  const dueParties = parties.filter(p => (p.balance || 0) > 0);

  const filteredDueParties = dueParties.filter(p => 
    p.name?.toLowerCase().includes(udharSearchTerm.toLowerCase()) ||
    p.phone?.includes(udharSearchTerm) ||
    (p.city && p.city.toLowerCase().includes(udharSearchTerm.toLowerCase())) ||
    (p.address && p.address.toLowerCase().includes(udharSearchTerm.toLowerCase()))
  );

  const sendWhatsAppReminder = (party) => {
    const cleanPhone = party.phone ? party.phone.replace(/[^0-9]/g, '') : '';
    const message = `नमस्ते ${party.name} जी,\n\n${business?.name || 'DistroPulse Distributor'} से आपका कुल बकाया उधार (Khata Balance) ₹${party.balance?.toLocaleString('en-IN')} है।\n\nकृपया जल्द से जल्द भुगतान करने की कृपा करें।\nधन्यवाद!`;
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

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

        {/* Total Khata Outstanding Card */}
        <div 
          onClick={() => setUdharModalOpen(true)}
          className="glass-card glass-card-interactive" 
          style={{ 
            padding: '20px', 
            cursor: 'pointer', 
            border: '2px solid rgba(245, 158, 11, 0.4)',
            position: 'relative',
            transition: 'all 0.2s ease-in-out'
          }}
          title="उधार रिटेलर्स की सूची देखने के लिए क्लिक करें"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>{t('khata_balance')}</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={20} color="#f59e0b" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#c2410c' }}>
            ₹{totalOutstandingBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            <p style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: '600' }}>
              {dueParties.length} {t('due_on_retailers')}
            </p>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '2px' }}>
              सूची देखें <ChevronRight size={14} />
            </span>
          </div>
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

      {/* Retailers Market Udhar / Due List Modal */}
      {udharModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '780px', width: '92vw', padding: '0', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ 
              padding: '20px 24px', 
              background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', 
              borderBottom: '1px solid #fed7aa',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#9a3412', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IndianRupee size={22} color="#c2410c" />
                  <span>💳 बाजार बकाया / उधार रिटेलर्स लिस्ट (Market Udhar Summary)</span>
                </h3>
                <p style={{ fontSize: '0.86rem', color: '#ea580c', marginTop: '3px', fontWeight: '600' }}>
                  कुल मार्केट बकाया (Total Market Udhar): <strong style={{ fontSize: '1.05rem', color: '#9a3412' }}>₹{totalOutstandingBalance.toLocaleString('en-IN')}</strong> ({dueParties.length} रिटेलर्स पर बाकी)
                </p>
              </div>
              <button 
                onClick={() => setUdharModalOpen(false)}
                style={{ 
                  background: '#ffffff', 
                  border: '1px solid #fdba74', 
                  borderRadius: '50%', 
                  width: '32px', 
                  height: '32px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#9a3412', 
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Filter Bar */}
            <div style={{ padding: '14px 24px', background: '#ffffff', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="दुकान का नाम, फोन नंबर या एरिया लिखकर खोजें..." 
                  style={{ paddingLeft: '38px', width: '100%', fontSize: '0.88rem' }}
                  value={udharSearchTerm}
                  onChange={e => setUdharSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Modal Body / Table */}
            <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
              {filteredDueParties.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={44} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    {udharSearchTerm ? 'कोई मैचिंग बकाया रिटेलर नहीं मिला' : 'कोई बकाया उधार नहीं है! 🎉'}
                  </h4>
                  <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                    {udharSearchTerm ? 'कृपया खोज शब्द बदलें' : 'सभी रिटेलर्स का खाता चुकता है।'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredDueParties.map((party, idx) => (
                    <div 
                      key={party.id || idx}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: '#fff7ed',
                        border: '1px solid #ffedd5',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        flexWrap: 'wrap',
                        gap: '14px'
                      }}
                    >
                      {/* Left Details */}
                      <div style={{ minWidth: '220px', flex: '1 1 220px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: '800', background: '#ea580c', color: '#ffffff', padding: '2px 8px', borderRadius: '12px' }}>
                            #{idx + 1}
                          </span>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#1e293b' }}>
                            {party.name}
                          </h4>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '0.82rem', color: '#64748b' }}>
                          <span>संपर्क: <strong style={{ color: '#334155' }}>{party.contactPerson || 'N/A'}</strong></span>
                          {party.phone && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontWeight: '600' }}>
                              <Phone size={13} />
                              {party.phone}
                            </span>
                          )}
                          {party.city && (
                            <span style={{ color: '#475569' }}>📍 {party.city}</span>
                          )}
                        </div>
                      </div>

                      {/* Center Balance Amount */}
                      <div style={{ textAlign: 'right', minWidth: '130px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '600', color: '#9a3412' }}>कुल बकाया उधार:</span>
                        <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#c2410c' }}>
                          ₹{party.balance?.toLocaleString('en-IN')}
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {party.phone && (
                          <button
                            onClick={() => sendWhatsAppReminder(party)}
                            className="btn btn-secondary btn-sm"
                            style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: '700', gap: '5px' }}
                            title="WhatsApp पेमेंट रिमाइंडर भेजें"
                          >
                            <MessageCircle size={14} color="#16a34a" />
                            <span>WhatsApp रिमाइंडर</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setUdharModalOpen(false);
                            setActiveTab('parties');
                          }}
                          className="btn btn-primary btn-sm"
                          style={{ gap: '4px', fontWeight: '700' }}
                          title="खाते में जाएं"
                        >
                          <Eye size={14} />
                          <span>खाता देखें</span>
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                कुल {filteredDueParties.length} रिटेलर्स सूची में प्रदर्शित हैं
              </span>
              <button 
                onClick={() => setUdharModalOpen(false)}
                className="btn btn-secondary"
              >
                बंद करें (Close)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

