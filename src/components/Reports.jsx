import React from 'react';
import { TrendingUp, IndianRupee, PieChart, ShoppingCart, Award, ShieldCheck, Layers } from 'lucide-react';

export default function Reports({ invoices, products, parties }) {
  // Financial totals
  const totalSales = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const totalUdhar = invoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);

  const totalCgst = invoices.reduce((sum, inv) => sum + (inv.cgst || 0), 0);
  const totalSgst = invoices.reduce((sum, inv) => sum + (inv.sgst || 0), 0);
  const totalIgst = invoices.reduce((sum, inv) => sum + (inv.igst || 0), 0);
  const totalTax = totalCgst + totalSgst + totalIgst;

  // Top Selling Products Breakdown
  const productSalesMap = {};
  invoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = {
          name: item.name,
          sku: item.sku,
          totalQty: 0,
          totalAmount: 0
        };
      }
      productSalesMap[item.productId].totalQty += Number(item.qty) || 0;
      productSalesMap[item.productId].totalAmount += Number(item.total) || 0;
    });
  });

  const topProducts = Object.values(productSalesMap).sort((a, b) => b.totalAmount - a.totalAmount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px' }}>
        
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>कुल कारोबार (Total Revenue)</span>
            <TrendingUp size={20} color="#10b981" />
          </div>
          <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>
            ₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {invoices.length} इनवॉइस बिल
          </p>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>प्राप्त नगद (Collected Cash)</span>
            <IndianRupee size={20} color="#34d399" />
          </div>
          <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#34d399' }}>
            ₹{totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            खाते व नकद में जमा राशि
          </p>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>कुल बाज़ार उधार (Market Udhar)</span>
            <IndianRupee size={20} color="#fbbf24" />
          </div>
          <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fbbf24' }}>
            ₹{totalUdhar.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            रिटेलर्स पर बकाया अनपेड बिल
          </p>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>कुल GST कलेक्शन</span>
            <ShieldCheck size={20} color="#818cf8" />
          </div>
          <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#818cf8' }}>
            ₹{totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            CGST: ₹{totalCgst.toFixed(0)} | SGST: ₹{totalSgst.toFixed(0)}
          </p>
        </div>

      </div>

      {/* Top Products Table */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <Award size={22} color="var(--primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>सर्वाधिक बिकने वाले प्रोडक्ट्स (Top Selling Products)</h3>
        </div>

        {topProducts.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>कोई बिक्री डेटा उपलब्ध नहीं है।</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px' }}>#</th>
                  <th style={{ padding: '10px' }}>प्रोडक्ट का नाम</th>
                  <th style={{ padding: '10px' }}>SKU</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>कुल बिकी मात्रा</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>कुल बिक्री रकम (₹)</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((prod, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px', fontWeight: '700', color: 'var(--primary)' }}>#{idx + 1}</td>
                    <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>{prod.name}</td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{prod.sku}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span className="badge badge-info">{prod.totalQty} यूनिट्स</span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>
                      ₹{prod.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
