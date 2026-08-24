import React, { useEffect, useState } from 'react';
import { Printer, X, CheckCircle, Zap, FileText, Trash2, MapPin } from 'lucide-react';
import { formatCartonStock, deleteInvoice, fetchParties } from '../utils/storage';

export default function InvoicePrintModal({ invoice, business, onClose, refreshAllData }) {
  const [paperFormat, setPaperFormat] = useState('A4'); // 'A4' or 'THERMAL'

  if (!invoice) return null;

  const allParties = fetchParties();
  const partyObj = invoice.partyId ? allParties.find(p => p.id === invoice.partyId) : null;
  const displayAddress = invoice.partyAddress || (partyObj ? (partyObj.address || partyObj.city) : '') || 'Local Market / Counter Sale';

  // Auto trigger printer dialog on modal load
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = () => {
    if (window.confirm(`⚠️ क्या आप सचमुच इनवॉइस #${invoice.invoiceNo} को डिलीट करना चाहते हैं?\n\n• इस इनवॉइस के सभी स्टॉक आइटम्स गोदाम में वापस जुड़ जाएंगे।\n• रिटेलर का बकाया उधार स्वतः एडजस्ट हो जाएगा।`)) {
      deleteInvoice(invoice.id);
      if (refreshAllData) refreshAllData();
      onClose();
    }
  };

  const formattedDate = new Date(invoice.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const isNonGst = invoice.taxMode === 'NONE' || invoice.taxTotal === 0;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: paperFormat === 'THERMAL' ? '400px' : '850px', background: '#ffffff', color: '#000000', padding: 0, transition: 'all 0.3s ease' }}>
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="modal-header no-print" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: 'var(--text-main)', padding: '12px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>
              Instant Direct Printer Ready
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Paper Size Format Switcher */}
            <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
              <button
                onClick={() => setPaperFormat('A4')}
                style={{
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: '4px',
                  background: paperFormat === 'A4' ? '#ffffff' : 'transparent',
                  fontWeight: paperFormat === 'A4' ? '700' : '500',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                📄 Standard A4
              </button>
              <button
                onClick={() => setPaperFormat('THERMAL')}
                style={{
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: '4px',
                  background: paperFormat === 'THERMAL' ? '#ffffff' : 'transparent',
                  fontWeight: paperFormat === 'THERMAL' ? '700' : '500',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                🧾 POS Thermal (3-inch)
              </button>
            </div>

            <button onClick={handlePrint} className="btn btn-primary" style={{ gap: '6px', padding: '8px 16px' }}>
              <Printer size={16} />
              <span>🖨️ Print Now</span>
            </button>

            <button 
              onClick={handleDelete}
              className="btn btn-sm"
              style={{ gap: '4px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '8px 12px' }}
              title="यह इनवॉइस डिलीट करें"
            >
              <Trash2 size={16} />
              <span>हटाएं</span>
            </button>

            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '8px' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PRINTABLE BILL CANVAS (PLAIN Sleek Layout) */}
        <div className="print-area" style={{ 
          padding: paperFormat === 'THERMAL' ? '2px' : '2px 4px', 
          background: '#ffffff', 
          color: '#000000', 
          fontFamily: 'Inter, sans-serif',
          fontSize: paperFormat === 'THERMAL' ? '0.45rem' : '0.46rem',
          lineHeight: '0.98',
          pageBreakInside: 'avoid',
          breakInside: 'avoid'
        }}>
          
          {/* Plain Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #000000', paddingBottom: '1px', marginBottom: '2px' }}>
            <div>
              <h2 style={{ fontSize: '0.75rem', fontWeight: '800', margin: 0, textTransform: 'uppercase', lineHeight: '1.0' }}>
                {business?.name || 'SHREE GANESH SALES AGENCY'}
              </h2>
              <p style={{ fontSize: '0.46rem', margin: 0, fontWeight: '700' }}>
                {isNonGst ? `Ph: ${business?.phone}` : `GSTIN: ${business?.gstin} • Ph: ${business?.phone}`}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ 
                fontWeight: '800', 
                fontSize: '0.5rem', 
                textTransform: 'uppercase', 
                marginRight: '8px'
              }}>
                {isNonGst ? 'ESTIMATE / CASH MEMO' : 'TAX INVOICE'}
              </span>
              <span style={{ fontSize: '0.48rem', fontWeight: '800' }}>
                Inv: <strong style={{ color: '#000' }}>{invoice.invoiceNo}</strong> • Date: <strong>{formattedDate}</strong>
              </span>
            </div>
          </div>

          {/* Plain 1-Line Party Details (No Box) */}
          <div style={{ borderBottom: '1px solid #000000', paddingBottom: '1px', marginBottom: '2px', fontSize: '0.46rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: '800', textTransform: 'uppercase' }}>BILLED TO: </span>
              <strong style={{ fontSize: '0.5rem' }}>{invoice.partyName}</strong>
              {invoice.partyPhone && <span> • Ph: {invoice.partyPhone}</span>}
              {!isNonGst && invoice.partyGstin && <span> • GSTIN: {invoice.partyGstin}</span>}
            </div>
            <div style={{ textAlign: 'right', fontWeight: '700' }}>
              📍 {displayAddress}
            </div>
          </div>

          {/* Items Table (Plain Borderless Layout) */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.46rem', marginBottom: '2px' }}>
            <thead>
              <tr style={{ borderTop: '1px solid #000000', borderBottom: '1px solid #000000', textAlign: 'left', fontWeight: '800' }}>
                <th style={{ padding: '0.5px 2px', height: '10px' }}>#</th>
                <th style={{ padding: '0.5px 2px', height: '10px' }}>Product Name</th>
                <th style={{ padding: '0.5px 2px', height: '10px' }}>HSN</th>
                <th style={{ padding: '0.5px 2px', textAlign: 'center', height: '10px' }}>Qty</th>
                <th style={{ padding: '0.5px 2px', textAlign: 'right', height: '10px' }}>MRP</th>
                <th style={{ padding: '0.5px 2px', textAlign: 'right', height: '10px' }}>Rate (₹)</th>
                <th style={{ padding: '0.5px 2px', textAlign: 'center', height: '10px' }}>GST%</th>
                <th style={{ padding: '0.5px 2px', textAlign: 'right', height: '10px' }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index} style={{ pageBreakInside: 'avoid', breakInside: 'avoid', borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5px 2px', textAlign: 'center', height: '9.5px' }}>{index + 1}</td>
                  <td style={{ padding: '0.5px 2px', fontWeight: '700', height: '9.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{item.name}</td>
                  <td style={{ padding: '0.5px 2px', height: '9.5px' }}>{item.hsn}</td>
                  <td style={{ padding: '0.5px 2px', textAlign: 'center', fontWeight: '700', height: '9.5px' }}>
                    {formatCartonStock(item.qty, item.pcsPerCarton)}
                  </td>
                  <td style={{ padding: '0.5px 2px', textAlign: 'right', height: '9.5px' }}>₹{item.mrp}</td>
                  <td style={{ padding: '0.5px 2px', textAlign: 'right', height: '9.5px' }}>₹{item.price}</td>
                  <td style={{ padding: '0.5px 2px', textAlign: 'center', height: '9.5px' }}>
                    {isNonGst ? '0%' : `${item.gstRate}%`}
                  </td>
                  <td style={{ padding: '0.5px 2px', textAlign: 'right', fontWeight: '700', height: '9.5px' }}>
                    ₹{(Number(item.total) || (Number(item.price) * Number(item.qty)) || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom Summary Section (Plain Grid) */}
          <div className="print-summary-signature" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4px', fontSize: '0.46rem', pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: '2px' }}>
            
            <div>
              {invoice.notes && (
                <div style={{ padding: '1px 3px', borderLeft: '2px solid #000', fontSize: '0.44rem' }}>
                  <strong>Note:</strong> {invoice.notes}
                </div>
              )}
            </div>

            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.46rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.5px 2px', borderBottom: '1px solid #eee' }}>Total (Incl. GST):</td>
                    <td style={{ padding: '0.5px 2px', borderBottom: '1px solid #eee', textAlign: 'right' }}>₹{(Number(invoice.subTotal) || 0).toFixed(2)}</td>
                  </tr>
                  {Boolean(invoice.discount) && (
                    <tr>
                      <td style={{ padding: '0.5px 2px', borderBottom: '1px solid #eee' }}>Discount:</td>
                      <td style={{ padding: '0.5px 2px', borderBottom: '1px solid #eee', textAlign: 'right' }}>- ₹{(Number(invoice.discount) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  {!isNonGst && Boolean(invoice.cgst) && (
                    <tr>
                      <td style={{ padding: '0.5px 2px', borderBottom: '1px solid #eee', fontSize: '0.42rem', color: '#555' }}>Incl. CGST:</td>
                      <td style={{ padding: '0.5px 2px', borderBottom: '1px solid #eee', textAlign: 'right', fontSize: '0.42rem', color: '#555' }}>₹{(Number(invoice.cgst) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  {!isNonGst && Boolean(invoice.sgst) && (
                    <tr>
                      <td style={{ padding: '0.5px 2px', borderBottom: '1px solid #eee', fontSize: '0.42rem', color: '#555' }}>Incl. SGST:</td>
                      <td style={{ padding: '0.5px 2px', borderBottom: '1px solid #eee', textAlign: 'right', fontSize: '0.42rem', color: '#555' }}>₹{(Number(invoice.sgst) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  {!isNonGst && Boolean(invoice.igst) && (
                    <tr>
                      <td style={{ padding: '0.5px 2px', borderBottom: '1px solid #eee', fontSize: '0.42rem', color: '#555' }}>Incl. IGST:</td>
                      <td style={{ padding: '0.5px 2px', borderBottom: '1px solid #eee', textAlign: 'right', fontSize: '0.42rem', color: '#555' }}>₹{(Number(invoice.igst) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  <tr style={{ fontWeight: '800', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                    <td style={{ padding: '1px 2px', fontSize: '0.5rem' }}>Grand Total:</td>
                    <td style={{ padding: '1px 2px', textAlign: 'right', fontSize: '0.52rem' }}>
                      ₹{(Number(invoice.grandTotal) || 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ textAlign: 'right', marginTop: '4px', paddingRight: '2px' }}>
                <p style={{ fontWeight: '800', margin: 0, fontSize: '0.46rem' }}>
                  For {business?.name || 'Distributor Agency'}
                </p>
                <div style={{ height: '8px' }}></div>
                <p style={{ fontSize: '0.44rem', margin: 0, borderTop: '1px solid #000', display: 'inline-block', padding: '1px 6px 0 6px' }}>
                  Authorized Signatory
                </p>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
