import React, { useEffect, useState } from 'react';
import { Printer, X, CheckCircle, Zap, FileText, Trash2 } from 'lucide-react';
import { formatCartonStock, deleteInvoice } from '../utils/storage';

export default function InvoicePrintModal({ invoice, business, onClose, refreshAllData }) {
  const [paperFormat, setPaperFormat] = useState('A4'); // 'A4' or 'THERMAL'

  if (!invoice) return null;

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

        {/* PRINTABLE BILL CANVAS */}
        <div className="print-area" style={{ 
          padding: paperFormat === 'THERMAL' ? '12px' : '30px', 
          background: '#ffffff', 
          color: '#000000', 
          fontFamily: 'Inter, sans-serif',
          fontSize: paperFormat === 'THERMAL' ? '0.75rem' : '0.85rem'
        }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000000', paddingBottom: '14px', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, textTransform: 'uppercase' }}>
                {business?.name || 'SHREE GANESH SALES AGENCY'}
              </h2>
              <p style={{ fontSize: '0.85rem', margin: '4px 0 0 0', fontWeight: '700' }}>
                {isNonGst ? `Ph: ${business?.phone}` : `GSTIN: ${business?.gstin} • Ph: ${business?.phone}`}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ 
                display: 'inline-block', 
                background: isNonGst ? '#059669' : '#000000', 
                color: '#ffffff', 
                padding: '4px 14px', 
                fontWeight: '800', 
                fontSize: '0.95rem', 
                borderRadius: '4px', 
                textTransform: 'uppercase', 
                marginBottom: '8px' 
              }}>
                {isNonGst ? 'ESTIMATE / CASH MEMO' : 'TAX INVOICE'}
              </div>
              <p style={{ fontSize: '0.9rem', fontWeight: '800', margin: 0 }}>
                Inv No: <span style={{ color: '#000' }}>{invoice.invoiceNo}</span>
              </p>
              <p style={{ fontSize: '0.82rem', margin: '2px 0 0 0' }}>
                Date: <strong>{formattedDate}</strong>
              </p>
            </div>
          </div>

          {/* Party Billed To */}
          <div style={{ border: '1px solid #000000', borderRadius: '4px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.84rem' }}>
            <p style={{ fontWeight: '800', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '6px', textTransform: 'uppercase' }}>
              Billed To (Party Details):
            </p>
            <p style={{ fontWeight: '800', fontSize: '0.95rem', margin: 0 }}>{invoice.partyName}</p>
            {invoice.partyAddress && <p style={{ margin: '2px 0 0 0' }}>Address: {invoice.partyAddress}</p>}
            {invoice.partyPhone && <p style={{ margin: '2px 0 0 0' }}>Contact: {invoice.partyPhone}</p>}
            {!isNonGst && invoice.partyGstin && <p style={{ margin: '2px 0 0 0', fontWeight: '700' }}>GSTIN: {invoice.partyGstin}</p>}
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '16px' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', border: '1px solid #000000', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', border: '1px solid #000' }}>#</th>
                <th style={{ padding: '6px 8px', border: '1px solid #000' }}>Product Name</th>
                <th style={{ padding: '6px 8px', border: '1px solid #000' }}>HSN</th>
                <th style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'center' }}>Qty (Ctn/Pcs)</th>
                <th style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'right' }}>MRP</th>
                <th style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'center' }}>GST %</th>
                <th style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'right' }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index}>
                  <td style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #000', fontWeight: '700' }}>{item.name}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #000' }}>{item.hsn}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'center', fontWeight: '700' }}>
                    {formatCartonStock(item.qty, item.pcsPerCarton)}
                  </td>
                  <td style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'right' }}>₹{item.mrp}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'right' }}>₹{item.price}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'center' }}>
                    {isNonGst ? '0%' : `${item.gstRate}%`}
                  </td>
                  <td style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'right', fontWeight: '700' }}>
                    ₹{(Number(item.total) || (Number(item.price) * Number(item.qty)) || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom Summary Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', fontSize: '0.82rem' }}>
            
            <div>
              <p style={{ fontWeight: '800', marginBottom: '4px' }}>Terms & Conditions:</p>
              <p style={{ whiteSpace: 'pre-line', fontSize: '0.76rem', color: '#444' }}>
                {business?.terms || "1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction."}
              </p>
              {invoice.notes && (
                <div style={{ marginTop: '10px', padding: '6px 10px', background: '#f9fafb', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <strong>Note:</strong> {invoice.notes}
                </div>
              )}
            </div>

            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>Total Amount (Incl. GST):</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right' }}>₹{(Number(invoice.subTotal) || 0).toFixed(2)}</td>
                  </tr>
                  {Boolean(invoice.discount) && (
                    <tr>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>Discount:</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right' }}>- ₹{(Number(invoice.discount) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  {!isNonGst && Boolean(invoice.cgst) && (
                    <tr>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', fontSize: '0.78rem', color: '#555' }}>Incl. CGST:</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.78rem', color: '#555' }}>₹{(Number(invoice.cgst) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  {!isNonGst && Boolean(invoice.sgst) && (
                    <tr>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', fontSize: '0.78rem', color: '#555' }}>Incl. SGST:</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.78rem', color: '#555' }}>₹{(Number(invoice.sgst) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  {!isNonGst && Boolean(invoice.igst) && (
                    <tr>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', fontSize: '0.78rem', color: '#555' }}>Incl. IGST:</td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.78rem', color: '#555' }}>₹{(Number(invoice.igst) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  <tr style={{ background: '#f3f4f6', fontWeight: '800' }}>
                    <td style={{ padding: '6px 8px', border: '1px solid #000', fontSize: '0.95rem' }}>Grand Total:</td>
                    <td style={{ padding: '6px 8px', border: '1px solid #000', textAlign: 'right', fontSize: '1rem' }}>
                      ₹{(Number(invoice.grandTotal) || 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ textAlign: 'right', marginTop: '30px', paddingRight: '10px' }}>
                <p style={{ fontWeight: '800', margin: 0, fontSize: '0.85rem' }}>
                  For {business?.name || 'Distributor Agency'}
                </p>
                <div style={{ height: '40px' }}></div>
                <p style={{ fontSize: '0.78rem', margin: 0, borderTop: '1px solid #000', display: 'inline-block', padding: '2px 20px 0 20px' }}>
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
