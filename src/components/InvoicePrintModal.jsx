import React, { useEffect, useState } from 'react';
import { Printer, X, CheckCircle, Zap, FileText, Trash2, MapPin } from 'lucide-react';
import { formatCartonStock, deleteInvoice, fetchParties } from '../utils/storage';
import firmLogo from '../assets/firm_logo.png';

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
      <div className="modal-content printable-modal-content" style={{ width: '100%', maxWidth: paperFormat === 'A5' ? '640px' : '850px', background: '#ffffff', color: '#000000', padding: 0, transition: 'all 0.3s ease' }}>
        
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
                  padding: '4px 12px',
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
                onClick={() => setPaperFormat('A5')}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  background: paperFormat === 'A5' ? '#ffffff' : 'transparent',
                  fontWeight: paperFormat === 'A5' ? '700' : '500',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                📜 Compact A5 (Half Page)
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

        {/* PRINTABLE BILL CANVAS (A4 / A5 Page Layout) */}
        <div className="print-area" style={{ 
          padding: paperFormat === 'A5' ? '3px 4px' : '4px 6px', 
          background: '#ffffff', 
          color: '#000000', 
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: paperFormat === 'A5' ? '10.5px' : '11.5px',
          lineHeight: '1.2',
          pageBreakInside: 'avoid',
          breakInside: 'avoid'
        }}>
          
          {/* Boxed Classic FMCG Distributor Header (User Requested Layout) */}
          <div style={{ 
            border: '1.5px solid #000000', 
            padding: '4px 8px', 
            marginBottom: '4px',
            textAlign: 'center',
            position: 'relative'
          }}>
            {/* Top Bar: GSTIN (Far Left), Date (Far Right) */}
            <div style={{ 
              display: 'flex', 
              justify: 'space-between', 
              alignItems: 'center', 
              width: '100%',
              fontSize: paperFormat === 'A5' ? '0.74rem' : '0.8rem',
              fontWeight: '700',
              borderBottom: '1px solid #cbd5e1',
              paddingBottom: '3px',
              marginBottom: '4px',
              color: '#000000'
            }}>
              <div style={{ textAlign: 'left' }}>
                {!isNonGst && business?.gstin ? `GSTIN: ${business.gstin}` : (business?.phone ? `Ph: ${business.phone}` : '')}
              </div>

              {/* Far Right Corner: Date ONLY */}
              <div style={{ textAlign: 'right', fontWeight: '800', marginLeft: 'auto' }}>
                Date: {formattedDate}
              </div>
            </div>

            {/* Business Header Center with Logo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '3px 0 2px 0' }}>
              <img 
                src={firmLogo} 
                alt="Firm Logo" 
                style={{ 
                  height: paperFormat === 'A5' ? '36px' : '44px', 
                  width: 'auto',
                  objectFit: 'contain'
                }} 
              />
              <h2 style={{ 
                fontSize: paperFormat === 'A5' ? '1.15rem' : '1.35rem', 
                fontWeight: '900', 
                margin: 0, 
                textTransform: 'uppercase', 
                letterSpacing: '0.6px',
                color: '#000000',
                lineHeight: '1.1'
              }}>
                {business?.name || 'SHREE GANESH SALES AGENCY'}
              </h2>
            </div>

            {/* Address (Normal Weight) */}
            <p style={{ 
              fontSize: paperFormat === 'A5' ? '0.72rem' : '0.78rem', 
              margin: '2px 0', 
              fontWeight: '400', 
              color: '#000000' 
            }}>
              {business?.address || business?.city || 'Main Wholesale Market, Transport Nagar'}
            </p>

            {/* Bottom Row inside Box: Centered Phone & Email, Right Corner Inv No */}
            <div style={{ 
              display: 'flex', 
              justify: 'space-between', 
              alignItems: 'center', 
              marginTop: '3px',
              fontSize: paperFormat === 'A5' ? '0.72rem' : '0.76rem',
              fontWeight: '400',
              color: '#000000'
            }}>
              <div style={{ minWidth: '100px' }}></div>

              <div style={{ textAlign: 'center', flex: 1 }}>
                {business?.phone ? `Ph: ${business.phone}` : ''}
                {business?.phone && (business?.email || true) ? '  |  ' : ''}
                Email: {business?.email || 'sales@distributor.com'}
              </div>

              {/* Bottom Right Corner of Header Box: Inv No */}
              <div style={{ minWidth: '100px', textAlign: 'right', fontWeight: '800', fontSize: paperFormat === 'A5' ? '0.75rem' : '0.8rem' }}>
                Inv No: {invoice.invoiceNo}
              </div>
            </div>
          </div>

          {/* 1-Line Party Details */}
          <div style={{ borderBottom: '1.5px solid #000000', paddingBottom: '3px', marginBottom: '4px', fontSize: paperFormat === 'A5' ? '0.75rem' : '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#000000' }}>
            <div>
              <span style={{ fontWeight: '800', textTransform: 'uppercase' }}>BILLED TO: </span>
              <strong style={{ fontSize: '0.88rem', color: '#000000' }}>{invoice.partyName}</strong>
              {invoice.partyPhone && <span style={{ fontWeight: '600' }}> • Ph: {invoice.partyPhone}</span>}
              {!isNonGst && invoice.partyGstin && <span style={{ fontWeight: '600' }}> • GSTIN: {invoice.partyGstin}</span>}
            </div>
            <div style={{ textAlign: 'right', fontWeight: '800' }}>
              📍 {displayAddress}
            </div>
          </div>

          {/* Items Table (40-Item Optimized) */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: paperFormat === 'A5' ? '10px' : '11.5px', marginBottom: '6px' }}>
            <thead>
              <tr style={{ borderTop: '2px solid #000000', borderBottom: '2px solid #000000', textAlign: 'left', fontWeight: '800', background: '#f1f5f9' }}>
                <th style={{ padding: '2.5px 5px', width: '4%', color: '#000' }}>#</th>
                <th style={{ padding: '2.5px 5px', width: '38%', color: '#000' }}>Product Name</th>
                <th style={{ padding: '2.5px 5px', width: '10%', color: '#000' }}>HSN</th>
                <th style={{ padding: '2.5px 5px', textAlign: 'center', width: '10%', color: '#000' }}>Qty</th>
                <th style={{ padding: '2.5px 5px', textAlign: 'right', width: '9%', color: '#000' }}>MRP</th>
                <th style={{ padding: '2.5px 5px', textAlign: 'right', width: '9%', color: '#000' }}>Rate (₹)</th>
                <th style={{ padding: '2.5px 5px', textAlign: 'center', width: '6%', color: '#000' }}>GST%</th>
                <th style={{ padding: '2.5px 5px', textAlign: 'right', width: '14%', color: '#000' }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index} style={{ pageBreakInside: 'avoid', breakInside: 'avoid', borderBottom: '1px solid #cbd5e1' }}>
                  <td style={{ padding: '2px 4px', textAlign: 'center', fontWeight: '600', color: '#000' }}>{index + 1}</td>
                  <td style={{ padding: '2px 4px', fontWeight: '700', color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{item.name}</td>
                  <td style={{ padding: '2px 4px', color: '#000', fontWeight: '600' }}>{item.hsn}</td>
                  <td style={{ padding: '2px 4px', textAlign: 'center', fontWeight: '800', color: '#000' }}>
                    {formatCartonStock(item.qty, item.pcsPerCarton)}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right', color: '#000', fontWeight: '600' }}>₹{item.mrp}</td>
                  <td style={{ padding: '2px 4px', textAlign: 'right', color: '#000', fontWeight: '600' }}>₹{item.price}</td>
                  <td style={{ padding: '2px 4px', textAlign: 'center', color: '#000', fontWeight: '600' }}>
                    {isNonGst ? '0%' : `${item.gstRate}%`}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: '800', color: '#000' }}>
                    ₹{(Number(item.total) || (Number(item.price) * Number(item.qty)) || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom Summary Section (Notes on Left, Totals Table on Right) */}
          <div className="print-summary-signature" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '12px', fontSize: paperFormat === 'A5' ? '0.74rem' : '0.8rem', pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: '6px' }}>
            
            <div>
              {invoice.notes && (
                <div style={{ padding: '4px 8px', borderLeft: '4px solid #000', fontSize: '0.75rem', background: '#f8fafc', fontWeight: '600', color: '#000' }}>
                  <strong>Note:</strong> {invoice.notes}
                </div>
              )}
            </div>

            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: paperFormat === 'A5' ? '10px' : '11.5px' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '2px 5px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#000' }}>Total (Incl. GST):</td>
                    <td style={{ padding: '2px 5px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#000' }}>₹{(Number(invoice.subTotal) || 0).toFixed(2)}</td>
                  </tr>
                  {Boolean(invoice.discount) && (
                    <tr>
                      <td style={{ padding: '2px 5px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#000' }}>Discount:</td>
                      <td style={{ padding: '2px 5px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#000' }}>- ₹{(Number(invoice.discount) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  {!isNonGst && Boolean(invoice.cgst) && (
                    <tr>
                      <td style={{ padding: '2px 5px', borderBottom: '1px solid #cbd5e1', fontSize: '10.5px', color: '#334155', fontWeight: '600' }}>Incl. CGST:</td>
                      <td style={{ padding: '2px 5px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontSize: '10.5px', color: '#334155', fontWeight: '700' }}>₹{(Number(invoice.cgst) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  {!isNonGst && Boolean(invoice.sgst) && (
                    <tr>
                      <td style={{ padding: '2px 5px', borderBottom: '1px solid #cbd5e1', fontSize: '10.5px', color: '#334155', fontWeight: '600' }}>Incl. SGST:</td>
                      <td style={{ padding: '2px 5px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontSize: '10.5px', color: '#334155', fontWeight: '700' }}>₹{(Number(invoice.sgst) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  {!isNonGst && Boolean(invoice.igst) && (
                    <tr>
                      <td style={{ padding: '2px 5px', borderBottom: '1px solid #cbd5e1', fontSize: '10.5px', color: '#334155', fontWeight: '600' }}>Incl. IGST:</td>
                      <td style={{ padding: '2px 5px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontSize: '10.5px', color: '#334155', fontWeight: '700' }}>₹{(Number(invoice.igst) || 0).toFixed(2)}</td>
                    </tr>
                  )}
                  <tr style={{ fontWeight: '900', borderTop: '2.5px solid #000000', borderBottom: '2.5px solid #000000', background: '#f8fafc' }}>
                    <td style={{ padding: '4px 5px', fontSize: '0.92rem', color: '#000000' }}>Grand Total:</td>
                    <td style={{ padding: '4px 5px', textAlign: 'right', fontSize: '1rem', color: '#000000' }}>
                      ₹{(Number(invoice.grandTotal) || 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          {/* DUAL SIGNATURE SECTION - BULLETPROOF 100% TABLE LAYOUT */}
          <table style={{ 
            width: '100%', 
            marginTop: '35px', 
            borderCollapse: 'collapse', 
            border: 'none',
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', verticalAlign: 'bottom', border: 'none', padding: '0 0 0 2px', width: '50%' }}>
                  <div style={{ height: '28px' }}></div>
                  <div style={{ 
                    borderTop: '1.5px solid #000000', 
                    display: 'inline-block', 
                    paddingTop: '3px', 
                    paddingRight: '24px',
                    fontWeight: '800', 
                    fontSize: '0.84rem',
                    color: '#000000' 
                  }}>
                    Receiver's Signature
                  </div>
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'bottom', border: 'none', padding: '0 2px 0 0', width: '50%' }}>
                  <div style={{ fontWeight: '800', fontSize: '0.84rem', marginBottom: '6px', color: '#000000' }}>
                    For {business?.name || 'Distributor Agency'}
                  </div>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ 
                    borderTop: '1.5px solid #000000', 
                    display: 'inline-block', 
                    paddingTop: '3px', 
                    paddingLeft: '24px',
                    fontWeight: '800', 
                    fontSize: '0.84rem',
                    color: '#000000' 
                  }}>
                    Authorized Signatory
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

        </div>

      </div>
    </div>
  );
}
