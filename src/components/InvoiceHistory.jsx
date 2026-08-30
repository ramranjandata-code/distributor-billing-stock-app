import React, { useState } from 'react';
import { FileText, Search, Printer, Calendar, Filter, User, Trash2, Download } from 'lucide-react';
import { deleteInvoice } from '../utils/storage';

export default function InvoiceHistory({ invoices, handlePrintInvoice, refreshAllData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inv.partyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleDelete = (inv) => {
    if (window.confirm(`⚠️ क्या आप सचमुच इनवॉइस #${inv.invoiceNo} (${inv.partyName}) को डिलीट करना चाहते हैं?\n\n• इस इनवॉइस के सभी स्टॉक आइटम्स गोदाम में वापस जुड़ जाएंगे।\n• रिटेलर का बकाया उधार स्वतः एडजस्ट हो जाएगा।`)) {
      deleteInvoice(inv.id);
      if (refreshAllData) refreshAllData();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Search & Filter Bar */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text"
                className="input-field"
                placeholder="इनवॉइस नंबर या रिटेलर नाम से खोजें..."
                style={{ paddingLeft: '38px' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select 
              className="input-field select-field" 
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">सभी बिल (All Invoices)</option>
              <option value="PAID">नकद चुकता (PAID)</option>
              <option value="UNPAID">उधार (UNPAID)</option>
              <option value="PARTIAL">आंशिक (PARTIAL)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Invoices Table */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>
            बिल इतिहास ({sortedInvoices.length} इनवॉइस)
          </h3>
        </div>

        {sortedInvoices.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            कोई इनवॉइस बिल नहीं मिला।
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 10px' }}>इनवॉइस नं</th>
                  <th style={{ padding: '12px 10px' }}>दिनांक (Date)</th>
                  <th style={{ padding: '12px 10px' }}>रिटेलर / पार्टी</th>
                  <th style={{ padding: '12px 10px' }}>आइटम्स</th>
                  <th style={{ padding: '12px 10px' }}>कुल रकम (Grand Total)</th>
                  <th style={{ padding: '12px 10px' }}>जमा राशि</th>
                  <th style={{ padding: '12px 10px' }}>स्थिति (Status)</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>एक्शन</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map(inv => {
                  const invDate = new Date(inv.date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: '700', color: 'var(--primary)' }}>
                        {inv.invoiceNo}
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {invDate}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{inv.partyName}</div>
                        {inv.partyGstin && <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>GST: {inv.partyGstin}</div>}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span className="badge badge-info">{inv.items?.length || 0} आइटम्स</span>
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: '800', color: 'var(--text-main)' }}>
                        ₹{inv.grandTotal.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 10px', color: '#34d399' }}>
                        ₹{inv.paidAmount?.toFixed(2) || '0.00'}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span className={`badge ${
                          inv.paymentStatus === 'PAID' ? 'badge-success' : inv.paymentStatus === 'UNPAID' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button 
                            onClick={() => handlePrintInvoice(inv)}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="इनवॉइस डाउनलोड / पीडीएफ (Download Invoice PDF)"
                          >
                            <Download size={15} />
                          </button>

                          <button 
                            onClick={() => handlePrintInvoice(inv)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="इनवॉइस प्रिंट करें (Print Invoice)"
                          >
                            <Printer size={15} />
                          </button>

                          <button 
                            onClick={() => handleDelete(inv)}
                            className="btn btn-sm"
                            style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
                            title="इनवॉइस डिलीट करें (Delete Invoice)"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
