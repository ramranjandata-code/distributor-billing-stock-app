import React, { useState } from 'react';
import { 
  TrendingUp, 
  IndianRupee, 
  ShieldCheck, 
  Award, 
  Calendar, 
  Printer, 
  FileText, 
  Users, 
  Filter,
  ArrowDownToLine
} from 'lucide-react';

export default function Reports({ invoices = [], products = [], parties = [], business }) {
  const [period, setPeriod] = useState('MONTHLY'); // 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM', 'ALL'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Date Filtering Helper
  const filterInvoicesByPeriod = () => {
    const now = new Date();

    return invoices.filter(inv => {
      if (!inv || !inv.date) return false;
      const invDate = new Date(inv.date);
      if (isNaN(invDate.getTime())) return false;

      if (period === 'ALL') return true;

      if (period === 'WEEKLY') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return invDate >= weekAgo && invDate <= now;
      }

      if (period === 'MONTHLY') {
        const monthAgo = new Date();
        monthAgo.setDate(now.getDate() - 30);
        return invDate >= monthAgo && invDate <= now;
      }

      if (period === 'QUARTERLY') {
        const quarterAgo = new Date();
        quarterAgo.setDate(now.getDate() - 90);
        return invDate >= quarterAgo && invDate <= now;
      }

      if (period === 'YEARLY') {
        const yearAgo = new Date();
        yearAgo.setDate(now.getDate() - 365);
        return invDate >= yearAgo && invDate <= now;
      }

      if (period === 'CUSTOM') {
        let pass = true;
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          pass = pass && invDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          pass = pass && invDate <= end;
        }
        return pass;
      }

      return true;
    });
  };

  const filteredInvoices = filterInvoicesByPeriod();

  // Aggregate Financial Metrics for Filtered Period
  const totalSales = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  const totalCollected = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
  const totalUdhar = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.balanceAmount) || 0), 0);

  const totalCgst = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.cgst) || 0), 0);
  const totalSgst = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.sgst) || 0), 0);
  const totalIgst = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.igst) || 0), 0);
  const totalTax = totalCgst + totalSgst + totalIgst;

  // Product Sales Breakdown
  const productSalesMap = {};
  filteredInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = {
          name: item.name,
          sku: item.sku || '-',
          totalQty: 0,
          totalAmount: 0
        };
      }
      productSalesMap[item.productId].totalQty += Number(item.qty) || 0;
      productSalesMap[item.productId].totalAmount += Number(item.total) || (Number(item.price) * Number(item.qty)) || 0;
    });
  });

  const topProducts = Object.values(productSalesMap).sort((a, b) => b.totalAmount - a.totalAmount);

  // Party Sales Breakdown
  const partySalesMap = {};
  filteredInvoices.forEach(inv => {
    const key = inv.partyName || 'Cash Customer';
    if (!partySalesMap[key]) {
      partySalesMap[key] = {
        name: key,
        phone: inv.partyPhone || '-',
        billCount: 0,
        totalSales: 0,
        totalBalance: 0
      };
    }
    partySalesMap[key].billCount += 1;
    partySalesMap[key].totalSales += Number(inv.grandTotal) || 0;
    partySalesMap[key].totalBalance += Number(inv.balanceAmount) || 0;
  });

  const partyBreakdown = Object.values(partySalesMap).sort((a, b) => b.totalSales - a.totalSales);

  // Period Text Header
  const getPeriodLabel = () => {
    switch (period) {
      case 'WEEKLY': return 'साप्ताहिक रिपोर्ट (Weekly Report - Last 7 Days)';
      case 'MONTHLY': return 'मासिक रिपोर्ट (Monthly Report - Last 30 Days)';
      case 'QUARTERLY': return 'तिमाही रिपोर्ट (Quarterly Report - Last 90 Days)';
      case 'YEARLY': return 'वार्षिक रिपोर्ट (Yearly Report - Last 1 Year)';
      case 'CUSTOM': return `कस्टम अवधि रिपोर्ट (${startDate || 'प्रारंभ'} से ${endDate || 'आज'})`;
      default: return 'कुल सर्वकालिक रिपोर्ट (All Time Sales Report)';
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* TOP CONTROLS & PERIOD SELECTOR (Hidden on Print) */}
      <div className="glass-card no-print" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        
        {/* Filter Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', flex: 1 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '2px' }}>
            <Calendar size={15} />
            समय अवधि:
          </span>

          <button 
            type="button" 
            onClick={() => setPeriod('WEEKLY')} 
            className={`btn btn-sm ${period === 'WEEKLY' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            साप्ताहिक (Weekly)
          </button>
          
          <button 
            type="button" 
            onClick={() => setPeriod('MONTHLY')} 
            className={`btn btn-sm ${period === 'MONTHLY' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            मासिक (Monthly)
          </button>

          <button 
            type="button" 
            onClick={() => setPeriod('QUARTERLY')} 
            className={`btn btn-sm ${period === 'QUARTERLY' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            तिमाही (Quarterly)
          </button>

          <button 
            type="button" 
            onClick={() => setPeriod('YEARLY')} 
            className={`btn btn-sm ${period === 'YEARLY' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            वार्षिक (Yearly)
          </button>

          <button 
            type="button" 
            onClick={() => setPeriod('ALL')} 
            className={`btn btn-sm ${period === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            सभी (All)
          </button>

          <button 
            type="button" 
            onClick={() => setPeriod('CUSTOM')} 
            className={`btn btn-sm ${period === 'CUSTOM' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            कस्टम (Custom)
          </button>
        </div>

        {/* PDF Export / Print Button */}
        <button 
          type="button" 
          onClick={handlePrintPDF} 
          className="btn btn-primary"
          style={{ gap: '6px', padding: '6px 14px', fontWeight: '700', fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 'auto' }}
        >
          <Printer size={15} />
          <span>Export PDF</span>
        </button>

      </div>

      {/* CUSTOM DATE RANGE PICKER (If Custom selected) */}
      {period === 'CUSTOM' && (
        <div className="glass-card no-print" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>प्रारंभ तिथि (Start Date):</label>
            <input 
              type="date" 
              className="input-field" 
              style={{ width: 'auto' }}
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>अंतिम तिथि (End Date):</label>
            <input 
              type="date" 
              className="input-field" 
              style={{ width: 'auto' }}
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
          </div>
        </div>
      )}

      {/* PRINTABLE REPORT CANVAS */}
      <div className="print-area" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Printable Official Header (Visible on print & report screen) */}
        <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                {business?.name || 'SHREE GANESH SALES AGENCY'}
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {business?.address || 'Authorized FMCG & Wholesale Distributor'}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '2px 0 0 0' }}>
                GSTIN: {business?.gstin || 'N/A'} • Phone: {business?.phone || 'N/A'}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="badge badge-info" style={{ fontSize: '0.85rem', padding: '6px 12px', fontWeight: '800' }}>
                {getPeriodLabel()}
              </span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                तारीख: {new Date().toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          
          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>कुल कारोबार (Total Revenue)</span>
              <TrendingUp size={20} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
              ₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              {filteredInvoices.length} इनवॉइस बिल जारी
            </p>
          </div>

          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>प्राप्त नकद (Collected Cash)</span>
              <IndianRupee size={20} color="#34d399" />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#34d399', margin: 0 }}>
              ₹{totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              जमा व नकद भुगतान
            </p>
          </div>

          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>बकाया बाजार उधार (Market Udhar)</span>
              <IndianRupee size={20} color="#fbbf24" />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fbbf24', margin: 0 }}>
              ₹{totalUdhar.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              रिटेलर्स पर बकाया अनपेड राशि
            </p>
          </div>

          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>GST टैक्स कलेक्शन</span>
              <ShieldCheck size={20} color="#818cf8" />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#818cf8', margin: 0 }}>
              ₹{totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              CGST: ₹{totalCgst.toFixed(2)} | SGST: ₹{totalSgst.toFixed(2)}
            </p>
          </div>

        </div>

        {/* TABLES GRID: 1. Top Selling Products | 2. Party Revenue Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          
          {/* Top Selling Products Table */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <Award size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>
                प्रोडक्ट बिक्री रिपोर्ट (Product-wise Sales Performance)
              </h3>
            </div>

            {topProducts.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                इस अवधि में कोई बिक्री रिकॉर्ड नहीं पाया गया।
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px' }}>#</th>
                      <th style={{ padding: '8px' }}>प्रोडक्ट नाम</th>
                      <th style={{ padding: '8px' }}>SKU</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>बिकी मात्रा (Units)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>कुल बिक्री रकम (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((prod, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>#{idx + 1}</td>
                        <td style={{ padding: '8px', fontWeight: '700', color: 'var(--text-main)' }}>{prod.name}</td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{prod.sku}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{prod.totalQty}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>
                          ₹{prod.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Party Breakdown Table */}
          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <Users size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>
                रिटेलर / पार्टी बिक्री रिपोर्ट (Party-wise Sales & Udhar Breakdown)
              </h3>
            </div>

            {partyBreakdown.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                इस अवधि में कोई पार्टी रिकॉर्ड नहीं पाया गया।
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px' }}>#</th>
                      <th style={{ padding: '8px' }}>पार्टी / ग्राहक नाम</th>
                      <th style={{ padding: '8px' }}>फोन</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>कुल बिल (Invoices)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>कुल बिक्री रकम (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>बकाया उधार (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partyBreakdown.map((party, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>#{idx + 1}</td>
                        <td style={{ padding: '8px', fontWeight: '700', color: 'var(--text-main)' }}>{party.name}</td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{party.phone}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{party.billCount}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>
                          ₹{party.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: party.totalBalance > 0 ? '#fbbf24' : '#34d399' }}>
                          ₹{party.totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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

    </div>
  );
}
