import React, { useEffect, useState } from 'react';
import { Printer, X, Zap, Trash2 } from 'lucide-react';
import { formatCartonStock, deleteInvoice, fetchParties } from '../utils/storage';
import firmLogo from '../assets/firm_logo.png';

// Number to Words Converter for Indian Currency Format
function numToWords(num) {
  if (!num || isNaN(num)) return 'ZERO RUPEES ONLY';
  const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
  const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  function inWords(n) {
    let str = '';
    let numStr = ('000000000' + n).slice(-9);
    let match = numStr.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!match) return '';

    let crore = Number(match[1]);
    let lakh = Number(match[2]);
    let thousand = Number(match[3]);
    let hundred = Number(match[4]);
    let rest = Number(match[5]);

    if (crore) str += (a[crore] || b[Math.floor(crore / 10)] + ' ' + a[crore % 10]) + ' CRORE ';
    if (lakh) str += (a[lakh] || b[Math.floor(lakh / 10)] + ' ' + a[lakh % 10]) + ' LAKH ';
    if (thousand) str += (a[thousand] || b[Math.floor(thousand / 10)] + ' ' + a[thousand % 10]) + ' THOUSAND ';
    if (hundred) str += (a[hundred] || b[Math.floor(hundred / 10)] + ' ' + a[hundred % 10]) + ' HUNDRED ';
    if (rest) str += (str ? 'AND ' : '') + (a[rest] || b[Math.floor(rest / 10)] + ' ' + a[rest % 10]);

    return str.trim();
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  let words = inWords(integerPart) || 'ZERO';
  words += ' RUPEES';
  if (decimalPart > 0) {
    words += ' AND ' + (inWords(decimalPart) || decimalPart) + ' PAISE';
  }
  return words + ' ONLY';
}

export default function InvoicePrintModal({ invoice, business, onClose, refreshAllData }) {
  const [paperFormat, setPaperFormat] = useState('A4'); // 'A4' or 'A5'

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

  // Total Tax Calculation
  const totalTaxAmount = (Number(invoice.cgst) || 0) + (Number(invoice.sgst) || 0) + (Number(invoice.igst) || 0);
  const totalQtyPcs = invoice.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content printable-modal-content" style={{ width: '100%', maxWidth: paperFormat === 'A5' ? '680px' : '900px', background: '#ffffff', color: '#000000', padding: 0, transition: 'all 0.3s ease' }}>
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="modal-header no-print" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: 'var(--text-main)', padding: '12px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>
              Corporate Direct Printer Ready
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

        {/* PRINTABLE BILL CANVAS (Gujarat Freight Tools Style Corporate Layout) */}
        <div className="print-area" style={{ 
          padding: paperFormat === 'A5' ? '4px 6px' : '6px 10px', 
          background: '#ffffff', 
          color: '#000000', 
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: paperFormat === 'A5' ? '10px' : '11px',
          lineHeight: '1.25',
          pageBreakInside: 'avoid',
          breakInside: 'avoid'
        }}>
          
          {/* SECTION 1: TOP UNBOXED HEADER (Logo, Firm Name, Address) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img 
                src={firmLogo} 
                alt="Logo" 
                style={{ 
                  height: paperFormat === 'A5' ? '42px' : '52px', 
                  width: 'auto', 
                  objectFit: 'contain' 
                }} 
              />
              <div>
                <h1 style={{ 
                  fontSize: paperFormat === 'A5' ? '1.3rem' : '1.55rem', 
                  fontWeight: '900', 
                  margin: 0, 
                  textTransform: 'uppercase', 
                  color: '#000000',
                  lineHeight: '1.1'
                }}>
                  {business?.name || 'JAY MAA SHARDAY ENTERPRISES'}
                </h1>
                <p style={{ margin: '2px 0 0 0', fontSize: paperFormat === 'A5' ? '0.72rem' : '0.78rem', color: '#1e293b', fontWeight: '500' }}>
                  {business?.address || 'Main Wholesale Market, Transport Nagar, New Delhi - 110042'}
                </p>
                <div style={{ fontSize: paperFormat === 'A5' ? '0.7rem' : '0.75rem', fontWeight: '600', color: '#334155', marginTop: '1px' }}>
                  {business?.phone ? `Ph: ${business.phone}` : ''}
                  {business?.phone && business?.email ? '  |  ' : ''}
                  {business?.email ? `Email: ${business.email}` : ''}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: MAIN INVOICE METADATA BOX */}
          <div style={{ border: '1.5px solid #000000', marginBottom: '6px' }}>
            
            {/* Header Banner: GSTIN | TAX INVOICE | ORIGINAL FOR RECIPIENT */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.2fr 1fr 1.1fr', 
              borderBottom: '1.5px solid #000000', 
              background: '#f8fafc', 
              padding: '3px 8px', 
              alignItems: 'center' 
            }}>
              <div style={{ fontWeight: '800', fontSize: paperFormat === 'A5' ? '0.8rem' : '0.86rem' }}>
                {!isNonGst && business?.gstin ? `GSTIN : ${business.gstin}` : (business?.phone ? `Ph : ${business.phone}` : '')}
              </div>
              <div style={{ textAlign: 'center', fontWeight: '900', fontSize: paperFormat === 'A5' ? '1rem' : '1.15rem', letterSpacing: '0.5px' }}>
                TAX INVOICE
              </div>
              <div style={{ textAlign: 'right', fontWeight: '700', fontSize: paperFormat === 'A5' ? '0.68rem' : '0.75rem', textTransform: 'uppercase' }}>
                ORIGINAL FOR RECIPIENT
              </div>
            </div>

            {/* 3-Column Info Grid: Party Details | Invoice & Logistics | Dates */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.35fr 1fr 0.9fr', 
              fontSize: paperFormat === 'A5' ? '0.72rem' : '0.78rem' 
            }}>
              
              {/* Col 1: Party / Buyer Info */}
              <div style={{ padding: '4px 8px', borderRight: '1.5px solid #000000' }}>
                <div style={{ display: 'flex', marginBottom: '2px' }}>
                  <span style={{ width: '65px', fontWeight: '700', color: '#000' }}>M/S</span>
                  <strong style={{ fontSize: '0.85rem', color: '#000' }}>{invoice.partyName}</strong>
                </div>
                <div style={{ display: 'flex', marginBottom: '2px' }}>
                  <span style={{ width: '65px', fontWeight: '700', color: '#000' }}>Address</span>
                  <span style={{ color: '#000' }}>{displayAddress}</span>
                </div>
                {invoice.partyPhone && (
                  <div style={{ display: 'flex', marginBottom: '2px' }}>
                    <span style={{ width: '65px', fontWeight: '700', color: '#000' }}>Phone</span>
                    <span style={{ color: '#000' }}>{invoice.partyPhone}</span>
                  </div>
                )}
                {!isNonGst && invoice.partyGstin && (
                  <div style={{ display: 'flex', marginBottom: '2px' }}>
                    <span style={{ width: '65px', fontWeight: '700', color: '#000' }}>GSTIN</span>
                    <span style={{ fontWeight: '700', color: '#000' }}>{invoice.partyGstin}</span>
                  </div>
                )}
                <div style={{ display: 'flex' }}>
                  <span style={{ width: '65px', fontWeight: '700', color: '#000' }}>Place of Supply</span>
                  <span style={{ color: '#000' }}>{partyObj?.state || partyObj?.city || 'Local Market'}</span>
                </div>
              </div>

              {/* Col 2: Invoice & Transport Details */}
              <div style={{ padding: '4px 8px', borderRight: '1.5px solid #000000' }}>
                <div style={{ display: 'flex', marginBottom: '2px' }}>
                  <span style={{ width: '90px', fontWeight: '700', color: '#000' }}>Invoice No.</span>
                  <strong style={{ color: '#000' }}>{invoice.invoiceNo}</strong>
                </div>
                <div style={{ display: 'flex', marginBottom: '2px' }}>
                  <span style={{ width: '90px', fontWeight: '700', color: '#000' }}>Challan No</span>
                  <span style={{ color: '#000' }}>{invoice.challanNo || '-'}</span>
                </div>
                <div style={{ display: 'flex', marginBottom: '2px' }}>
                  <span style={{ width: '90px', fontWeight: '700', color: '#000' }}>E-Way Bill No.</span>
                  <span style={{ color: '#000' }}>{invoice.ewayBillNo || '-'}</span>
                </div>
                <div style={{ display: 'flex' }}>
                  <span style={{ width: '90px', fontWeight: '700', color: '#000' }}>Transport</span>
                  <span style={{ color: '#000' }}>{invoice.transport || 'Self / Direct'}</span>
                </div>
              </div>

              {/* Col 3: Dates */}
              <div style={{ padding: '4px 8px' }}>
                <div style={{ display: 'flex', marginBottom: '2px' }}>
                  <span style={{ width: '82px', fontWeight: '700', color: '#000' }}>Invoice Date</span>
                  <strong style={{ color: '#000' }}>{formattedDate}</strong>
                </div>
                <div style={{ display: 'flex' }}>
                  <span style={{ width: '82px', fontWeight: '700', color: '#000' }}>Challan Date</span>
                  <span style={{ color: '#000' }}>{formattedDate}</span>
                </div>
              </div>

            </div>

          </div>

          {/* SECTION 3: ITEMS GRID TABLE */}
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: '1.5px solid #000000', 
            fontSize: paperFormat === 'A5' ? '9.5px' : '11px', 
            marginBottom: '6px' 
          }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #000000', background: '#f1f5f9', fontWeight: '800', textAlign: 'left' }}>
                <th style={{ padding: '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', width: '4%', color: '#000' }}>Sr. No.</th>
                <th style={{ padding: '3px 6px', borderRight: '1px solid #000000', width: '36%', color: '#000' }}>Name of Product / Service</th>
                <th style={{ padding: '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', width: '9%', color: '#000' }}>HSN / SAC</th>
                <th style={{ padding: '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', width: '10%', color: '#000' }}>Qty</th>
                <th style={{ padding: '3px 6px', borderRight: '1px solid #000000', textAlign: 'right', width: '9%', color: '#000' }}>Rate</th>
                <th style={{ padding: '3px 6px', borderRight: '1px solid #000000', textAlign: 'right', width: '10%', color: '#000' }}>Taxable Value</th>
                <th style={{ padding: '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', width: '11%', color: '#000' }}>GST (% | Amt)</th>
                <th style={{ padding: '3px 6px', textAlign: 'right', width: '11%', color: '#000' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => {
                const itemQty = Number(item.qty) || 0;
                const itemRate = Number(item.price) || 0;
                const taxableVal = itemQty * itemRate;
                const gstRateNum = isNonGst ? 0 : (Number(item.gstRate) || 0);
                const gstAmt = (taxableVal * gstRateNum) / 100;
                const itemTotal = Number(item.total) || (taxableVal + gstAmt);

                return (
                  <tr key={index} style={{ borderBottom: '1px solid #cbd5e1', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td style={{ padding: '2.5px 4px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: '600', color: '#000' }}>{index + 1}</td>
                    <td style={{ padding: '2.5px 6px', borderRight: '1px solid #000000', fontWeight: '700', color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>{item.name}</td>
                    <td style={{ padding: '2.5px 4px', borderRight: '1px solid #000000', textAlign: 'center', color: '#000', fontWeight: '600' }}>{item.hsn}</td>
                    <td style={{ padding: '2.5px 4px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: '800', color: '#000' }}>
                      {formatCartonStock(item.qty, item.pcsPerCarton)}
                    </td>
                    <td style={{ padding: '2.5px 6px', borderRight: '1px solid #000000', textAlign: 'right', color: '#000', fontWeight: '600' }}>₹{itemRate.toFixed(2)}</td>
                    <td style={{ padding: '2.5px 6px', borderRight: '1px solid #000000', textAlign: 'right', color: '#000', fontWeight: '600' }}>₹{taxableVal.toFixed(2)}</td>
                    <td style={{ padding: '2.5px 4px', borderRight: '1px solid #000000', textAlign: 'center', color: '#000', fontWeight: '600' }}>
                      {gstRateNum}% {gstAmt > 0 ? `(₹${gstAmt.toFixed(2)})` : ''}
                    </td>
                    <td style={{ padding: '2.5px 6px', textAlign: 'right', fontWeight: '800', color: '#000' }}>₹{itemTotal.toFixed(2)}</td>
                  </tr>
                );
              })}

              {/* Summary Total Row */}
              <tr style={{ borderTop: '1.5px solid #000000', fontWeight: '800', background: '#f8fafc', color: '#000000' }}>
                <td colSpan={3} style={{ padding: '3px 8px', borderRight: '1px solid #000000', textAlign: 'right' }}>Total</td>
                <td style={{ padding: '3px 4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                  {totalQtyPcs} Pcs
                </td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ padding: '3px 6px', borderRight: '1px solid #000000', textAlign: 'right' }}>
                  ₹{(Number(invoice.subTotal) || 0).toFixed(2)}
                </td>
                <td style={{ padding: '3px 4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                  ₹{totalTaxAmount.toFixed(2)}
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'right', fontSize: '1.05em' }}>
                  ₹{(Number(invoice.grandTotal) || 0).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* SECTION 4: BOTTOM FOOTER GRID (Words, QR Code, Amounts, Signatures, Bank) */}
          <div style={{ border: '1.5px solid #000000', fontSize: paperFormat === 'A5' ? '0.72rem' : '0.76rem', color: '#000000' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 0.7fr 1.15fr' }}>
              
              {/* BLOCK 1: Total in Words, Terms, Customer Signature */}
              <div style={{ padding: '6px', borderRight: '1.5px solid #000000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '4px', fontWeight: '800', lineHeight: '1.2' }}>
                    Total in words : <span style={{ textTransform: 'uppercase' }}>{numToWords(invoice.grandTotal)}</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#1e293b', lineHeight: '1.2' }}>
                    <strong>Terms and Conditions :</strong> {business?.terms || 'Subject to Local Jurisdiction. Goods once sold will not be taken back.'}
                  </div>
                </div>

                <div style={{ marginTop: '22px' }}>
                  <div style={{ 
                    borderTop: '1.5px solid #000000', 
                    display: 'inline-block', 
                    paddingTop: '2px', 
                    paddingRight: '16px',
                    fontWeight: '800',
                    color: '#000000'
                  }}>
                    Customer Signature
                  </div>
                </div>
              </div>

              {/* BLOCK 2: Pay using UPI QR Code */}
              <div style={{ padding: '4px', borderRight: '1.5px solid #000000', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`upi://pay?pa=${business?.phone || '9876543210'}@upi&pn=${encodeURIComponent(business?.name || 'Agency')}&am=${invoice.grandTotal}&cu=INR`)}`} 
                  alt="UPI QR Code" 
                  style={{ width: paperFormat === 'A5' ? '76px' : '92px', height: paperFormat === 'A5' ? '76px' : '92px', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div style={{ fontWeight: '800', marginTop: '3px', fontSize: '0.72rem', color: '#000000' }}>
                  Pay using UPI
                </div>
              </div>

              {/* BLOCK 3: Taxable Amount, Total Tax, Grand Total, Authorized Signatory */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: paperFormat === 'A5' ? '0.72rem' : '0.76rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '3px 6px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#000' }}>Taxable Amount</td>
                      <td style={{ padding: '3px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#000' }}>₹{(Number(invoice.subTotal) || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 6px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#000' }}>Total Tax</td>
                      <td style={{ padding: '3px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#000' }}>₹{totalTaxAmount.toFixed(2)}</td>
                    </tr>
                    <tr style={{ background: '#f8fafc' }}>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #000000', fontWeight: '900', fontSize: '0.85rem', color: '#000' }}>Total Amount After Tax</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #000000', textAlign: 'right', fontWeight: '900', fontSize: '0.96rem', color: '#000' }}>₹{(Number(invoice.grandTotal) || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ padding: '3px 6px', fontWeight: '800', fontSize: '0.72rem', color: '#000' }}>
                        For {business?.name || 'Distributor Agency'} <span style={{ float: 'right', color: '#475569', fontWeight: '600' }}>(E & O.E.)</span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ padding: '6px', textAlign: 'right' }}>
                  <div style={{ height: '18px' }}></div>
                  <div style={{ 
                    borderTop: '1.5px solid #000000', 
                    display: 'inline-block', 
                    paddingTop: '2px', 
                    paddingLeft: '16px',
                    fontWeight: '800',
                    color: '#000000'
                  }}>
                    Authorized Signatory
                  </div>
                </div>
              </div>

            </div>

            {/* BLOCK 4: Bank Details Footer Bar */}
            <div style={{ 
              borderTop: '1.5px solid #000000', 
              padding: '3px 8px', 
              fontWeight: '700', 
              background: '#f8fafc', 
              display: 'flex', 
              justify: 'space-between',
              fontSize: paperFormat === 'A5' ? '0.7rem' : '0.75rem'
            }}>
              <div>
                Bank: <strong>{business?.bankName || 'HDFC Bank Ltd.'}</strong> | A/c No.: <strong>{business?.accountNo || '50200088991122'}</strong> | IFSC: <strong>{business?.ifsc || 'HDFC0001234'}</strong>
              </div>
            </div>

          </div>

          {/* Subtext */}
          <div style={{ textAlign: 'center', marginTop: '4px', fontWeight: '600', fontSize: '0.72rem', color: '#475569', fontStyle: 'italic' }}>
            Thank you for shopping with us!
          </div>

        </div>

      </div>
    </div>
  );
}
