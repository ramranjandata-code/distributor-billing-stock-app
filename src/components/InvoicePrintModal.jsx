import React, { useEffect, useState, useMemo } from 'react';
import { Printer, X, Zap, Trash2, Send, MessageSquare, Mail, Palette, Truck, QrCode, FileText } from 'lucide-react';
import { formatCartonStock, deleteInvoice, fetchParties } from '../utils/storage';
import { generateUpiQrDataUrl, generateEInvoiceQrDataUrl, buildInvoiceShareText, buildWhatsAppUrl, buildSmsUrl, buildEmailUrl } from '../utils/qrUtils';
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

const formatInr = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Indian statutory currency format in words (e.g. INR Fifty Two Thousand ... Only)
function numToWordsIndian(num, isTax = false) {
  if (!num || isNaN(num) || Number(num) === 0) return 'INR Zero Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];

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

    if (crore) str += (a[crore] || (b[Math.floor(crore / 10)] + a[crore % 10])) + 'Crore ';
    if (lakh) str += (a[lakh] || (b[Math.floor(lakh / 10)] + a[lakh % 10])) + 'Lakh ';
    if (thousand) str += (a[thousand] || (b[Math.floor(thousand / 10)] + a[thousand % 10])) + 'Thousand ';
    if (hundred) str += (a[hundred] || (b[Math.floor(hundred / 10)] + a[hundred % 10])) + 'Hundred ';
    if (rest) str += (a[rest] || (b[Math.floor(rest / 10)] + a[rest % 10]));

    return str.trim();
  }

  const rounded = Number(num).toFixed(2);
  const parts = rounded.split('.');
  const integerPart = Number(parts[0]);
  const decimalPart = Number(parts[1]);

  let words = inWords(integerPart) || 'Zero';
  if (decimalPart > 0) {
    const paiseWords = inWords(decimalPart) || decimalPart;
    return `INR ${words} and ${paiseWords} paise Only`;
  }
  return `INR ${words} Only`;
}

export default function InvoicePrintModal({ invoice, business, onClose, refreshAllData }) {
  const [paperFormat, setPaperFormat] = useState(() => localStorage.getItem('distro_default_paper_format') || 'A5');
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('distro_invoice_theme') || '#059669');
  const [upiQrUrl, setUpiQrUrl] = useState(null);
  const [eInvoiceQrUrl, setEInvoiceQrUrl] = useState(null);

  const changePaperFormat = (fmt) => {
    setPaperFormat(fmt);
    localStorage.setItem('distro_default_paper_format', fmt);
  };

  const changeThemeColor = (color) => {
    setThemeColor(color);
    localStorage.setItem('distro_invoice_theme', color);
  };

  if (!invoice) return null;

  const allParties = fetchParties();
  const partyObj = invoice.partyId ? allParties.find(p => p.id === invoice.partyId) : null;
  const displayAddress = invoice.partyAddress || (partyObj ? (partyObj.address || partyObj.city) : '') || 'Local Market / Counter Sale';

  // Add has-printable-modal class to body during modal lifecycle for print styling
  useEffect(() => {
    document.body.classList.add('has-printable-modal');
    return () => {
      document.body.classList.remove('has-printable-modal');
    };
  }, []);

  // Generate dynamic QR codes locally & offline
  useEffect(() => {
    generateUpiQrDataUrl(business?.upiId, business?.name, invoice.grandTotal, invoice.invoiceNo)
      .then(url => setUpiQrUrl(url));
    generateEInvoiceQrDataUrl(invoice, business)
      .then(url => setEInvoiceQrUrl(url));
  }, [invoice, business]);

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = () => {
    if (window.confirm(`⚠️ Are you sure you want to delete Invoice #${invoice.invoiceNo}?\n\n• All stock items will be automatically returned to the warehouse.\n• Retailer outstanding balance will be automatically adjusted.`)) {
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

  const isNonGst = invoice.taxMode === 'NONE' || 
    invoice.taxMode === 'NON_GST' ||
    invoice.supplyType === 'EXEMPT' ||
    ((Number(invoice.taxTotal) || 0) === 0 && 
     (Number(invoice.cgst) || 0) === 0 && 
     (Number(invoice.sgst) || 0) === 0 && 
     (Number(invoice.igst) || 0) === 0 && 
     (invoice.items || []).every(item => Number(item.gstRate || 0) === 0));
  const isInterState = invoice.taxMode === 'INTER' || (Number(invoice.igst || 0) > 0 && Number(invoice.cgst || 0) === 0 && Number(invoice.sgst || 0) === 0);

  // Process items & calculate exact taxable, tax, and totals matching Billing logic
  let totalTaxableAmountCalculated = 0;
  let totalTaxAmountCalculated = 0;
  let totalCgstCalculated = 0;
  let totalSgstCalculated = 0;
  let totalIgstCalculated = 0;

  const processedItems = (invoice.items || []).map((item) => {
    const itemQty = Number(item.qty) || 0;
    const itemRate = Number(item.price) || 0;
    const itemTotal = Number(item.total) || (itemQty * itemRate);
    const gstRateNum = isNonGst ? 0 : (Number(item.gstRate) || 0);

    let gstAmt = 0;
    if (isNonGst || gstRateNum === 0) {
      gstAmt = 0;
    } else if (item.itemGstAmount !== undefined && item.itemGstAmount !== null && !isNaN(Number(item.itemGstAmount))) {
      gstAmt = Number(item.itemGstAmount);
    } else if (item.gstVal !== undefined && item.gstVal !== null && !isNaN(Number(item.gstVal))) {
      gstAmt = Number(item.gstVal);
    } else {
      gstAmt = itemTotal - (itemTotal / (1 + gstRateNum / 100));
    }

    let taxableVal = 0;
    if (item.taxableAmount !== undefined && item.taxableAmount !== null && !isNaN(Number(item.taxableAmount))) {
      taxableVal = Number(item.taxableAmount);
    } else if (item.taxableVal !== undefined && item.taxableVal !== null && !isNaN(Number(item.taxableVal))) {
      taxableVal = Number(item.taxableVal);
    } else {
      taxableVal = itemTotal - gstAmt;
    }

    // Split GST into CGST, SGST, IGST
    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (!isNonGst && gstRateNum > 0) {
      if (isInterState) {
        igstRate = gstRateNum;
        igstAmt = item.igstAmount !== undefined && item.igstAmount !== null && !isNaN(Number(item.igstAmount))
          ? Number(item.igstAmount)
          : gstAmt;
      } else {
        cgstRate = gstRateNum / 2;
        sgstRate = gstRateNum / 2;
        cgstAmt = item.cgstAmount !== undefined && item.cgstAmount !== null && !isNaN(Number(item.cgstAmount))
          ? Number(item.cgstAmount)
          : (gstAmt / 2);
        sgstAmt = item.sgstAmount !== undefined && item.sgstAmount !== null && !isNaN(Number(item.sgstAmount))
          ? Number(item.sgstAmount)
          : (gstAmt / 2);
      }
    }

    totalTaxableAmountCalculated += taxableVal;
    totalTaxAmountCalculated += gstAmt;
    totalCgstCalculated += cgstAmt;
    totalSgstCalculated += sgstAmt;
    totalIgstCalculated += igstAmt;

    return {
      ...item,
      itemQty,
      itemRate,
      itemTotal,
      gstRateNum,
      gstAmt,
      taxableVal,
      cgstRate,
      sgstRate,
      igstRate,
      cgstAmt,
      sgstAmt,
      igstAmt
    };
  });

  const totalTaxAmount = isNonGst ? 0 : (invoice.taxTotal !== undefined && invoice.taxTotal !== null && Number(invoice.taxTotal) > 0 ? Number(invoice.taxTotal) : totalTaxAmountCalculated);
  const totalTaxableAmount = totalTaxableAmountCalculated;

  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  if (!isNonGst) {
    if (isInterState) {
      totalIgst = invoice.igst !== undefined && invoice.igst !== null && !isNaN(Number(invoice.igst)) && Number(invoice.igst) > 0
        ? Number(invoice.igst)
        : (totalTaxAmount || totalIgstCalculated);
    } else {
      if (invoice.cgst !== undefined && invoice.cgst !== null && !isNaN(Number(invoice.cgst)) && Number(invoice.cgst) > 0) {
        totalCgst = Number(invoice.cgst);
      } else {
        totalCgst = totalTaxAmount > 0 ? (totalTaxAmount / 2) : totalCgstCalculated;
      }

      if (invoice.sgst !== undefined && invoice.sgst !== null && !isNaN(Number(invoice.sgst)) && Number(invoice.sgst) > 0) {
        totalSgst = Number(invoice.sgst);
      } else {
        totalSgst = totalTaxAmount > 0 ? (totalTaxAmount / 2) : totalSgstCalculated;
      }
    }
  }

  const totalQtyPcs = processedItems.reduce((sum, item) => sum + item.itemQty, 0);

  // Statutory HSN/SAC Tax Summary computation
  const hsnSummary = useMemo(() => {
    if (isNonGst) return [];
    const map = {};
    processedItems.forEach(item => {
      const hsnCode = item.hsn || '1905';
      const rate = Number(item.gstRateNum) || 0;
      const key = `${hsnCode}_${rate}`;

      if (!map[key]) {
        map[key] = {
          hsn: hsnCode,
          rate: rate,
          cgstRate: item.cgstRate !== undefined ? item.cgstRate : (rate / 2),
          sgstRate: item.sgstRate !== undefined ? item.sgstRate : (rate / 2),
          igstRate: item.igstRate !== undefined ? item.igstRate : rate,
          taxableVal: 0,
          cgstAmt: 0,
          sgstAmt: 0,
          igstAmt: 0,
          taxAmt: 0
        };
      }

      map[key].taxableVal += (item.taxableVal || 0);
      map[key].cgstAmt += (item.cgstAmt || 0);
      map[key].sgstAmt += (item.sgstAmt || 0);
      map[key].igstAmt += (item.igstAmt || 0);
      map[key].taxAmt += (item.gstAmt || 0);
    });

    return Object.values(map);
  }, [processedItems, isNonGst]);

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content printable-modal-content" style={{ width: '100%', maxWidth: paperFormat === 'A5' ? '680px' : '900px', background: '#ffffff', color: '#000000', padding: 0, transition: 'all 0.3s ease' }}>
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="modal-header no-print" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: 'var(--text-main)', padding: '12px 18px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={20} color={themeColor} />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>
              Corporate Invoice & Thermal POS Ready
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Paper Size Format Switcher */}
            <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
              <button
                onClick={() => changePaperFormat('A4')}
                style={{
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: '4px',
                  background: paperFormat === 'A4' ? '#ffffff' : 'transparent',
                  fontWeight: paperFormat === 'A4' ? '700' : '500',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                {isNonGst ? 'A4 Bill' : 'A4 Tax Bill'}
              </button>
              <button
                onClick={() => changePaperFormat('A5')}
                style={{
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: '4px',
                  background: paperFormat === 'A5' ? '#ffffff' : 'transparent',
                  fontWeight: paperFormat === 'A5' ? '700' : '500',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                A5 Half Page
              </button>
              <button
                onClick={() => changePaperFormat('POS80')}
                style={{
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: '4px',
                  background: paperFormat === 'POS80' ? '#ffffff' : 'transparent',
                  fontWeight: paperFormat === 'POS80' ? '700' : '500',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                80mm Thermal POS
              </button>
            </div>

            {/* Theme Color Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e2e8f0', padding: '3px 6px', borderRadius: '6px' }} title="Invoice Color Theme">
              <Palette size={14} color="#64748b" />
              {[
                { name: 'Emerald', color: '#059669' },
                { name: 'Navy', color: '#1e40af' },
                { name: 'Maroon', color: '#991b1b' },
                { name: 'Slate', color: '#0f172a' }
              ].map(t => (
                <button
                  key={t.color}
                  onClick={() => changeThemeColor(t.color)}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: t.color,
                    border: themeColor === t.color ? '2px solid #ffffff' : 'none',
                    boxShadow: themeColor === t.color ? '0 0 0 1px #000000' : 'none',
                    cursor: 'pointer'
                  }}
                  title={t.name}
                />
              ))}
            </div>

            {/* Instant WhatsApp Share */}
            <button
              onClick={() => {
                const shareText = buildInvoiceShareText(invoice, business);
                const waUrl = buildWhatsAppUrl(invoice.partyPhone, shareText);
                window.open(waUrl, '_blank');
              }}
              className="btn btn-sm"
              style={{ background: '#25D366', color: '#ffffff', border: 'none', padding: '6px 12px', fontWeight: '700', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Send bill on WhatsApp"
            >
              <Send size={14} />
              <span>WhatsApp</span>
            </button>

            {/* Instant SMS Share */}
            <button
              onClick={() => {
                const shareText = buildInvoiceShareText(invoice, business);
                const smsUrl = buildSmsUrl(invoice.partyPhone, shareText);
                window.location.href = smsUrl;
              }}
              className="btn btn-sm btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Share via SMS"
            >
              <MessageSquare size={14} />
              <span>SMS</span>
            </button>

            {/* Instant Email */}
            <button
              onClick={() => {
                const shareText = buildInvoiceShareText(invoice, business);
                const emailUrl = buildEmailUrl(partyObj?.email, `Invoice #${invoice.invoiceNo} from ${business?.name}`, shareText);
                window.location.href = emailUrl;
              }}
              className="btn btn-sm btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Share via Email"
            >
              <Mail size={14} />
              <span>Email</span>
            </button>

            <button onClick={handlePrint} className="btn btn-primary" style={{ gap: '6px', padding: '6px 14px', fontSize: '0.85rem' }}>
              <Printer size={16} />
              <span>Print Bill</span>
            </button>

            <button 
              onClick={handleDelete}
              className="btn btn-sm"
              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Delete Invoice"
            >
              <Trash2 size={16} />
            </button>

            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PRINTABLE BILL CANVAS (A4 / A5 Corporate or 80mm Thermal Receipt) */}
        {paperFormat === 'POS80' ? (
          <div className="print-area" style={{ 
            width: '100%', 
            maxWidth: '330px', 
            margin: '0 auto', 
            padding: '16px 10px', 
            fontFamily: "'Courier New', Courier, monospace", 
            fontSize: '11px', 
            color: '#000000',
            background: '#ffffff',
            boxShadow: '0 0 10px rgba(0,0,0,0.05)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '900', margin: '0 0 2px 0', textTransform: 'uppercase', color: '#000' }}>{business?.name}</h2>
              <div style={{ fontSize: '9.5px', color: '#333' }}>{business?.address}</div>
              <div style={{ fontSize: '9.5px', color: '#333' }}>
                {!isNonGst && business?.gstin ? `GSTIN: ${business.gstin} | ` : ''}Ph: {business?.phone}
              </div>
              <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', margin: '6px 0', padding: '3px 0', fontWeight: 'bold' }}>
                {isNonGst ? 'RETAIL CASH SLIP / BILL OF SUPPLY' : 'RETAIL CASH SLIP / TAX INVOICE'}
              </div>
            </div>

            <div style={{ fontSize: '10px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bill No: <strong>{invoice.invoiceNo}</strong></span>
                <span>Date: {formattedDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cust: <strong>{invoice.partyName || invoice.customerName}</strong></span>
                <span>{invoice.partyPhone || ''}</span>
              </div>
              {invoice.warehouseId && <div>WH: {invoice.warehouseId}</div>}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', borderBottom: '1px dashed #000', marginBottom: '6px' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000', textAlign: 'left' }}>
                  <th style={{ padding: '3px 0' }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '3px 0' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '3px 0' }}>Rate</th>
                  <th style={{ textAlign: 'right', padding: '3px 0' }}>Amt</th>
                </tr>
              </thead>
              <tbody>
                {processedItems.map(item => (
                  <tr key={item.productId || item.name}>
                    <td style={{ padding: '2px 0', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                    <td style={{ textAlign: 'center', padding: '2px 0' }}>{item.itemQty}</td>
                    <td style={{ textAlign: 'right', padding: '2px 0' }}>{item.itemRate}</td>
                    <td style={{ textAlign: 'right', padding: '2px 0' }}>₹{item.itemTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal ({totalQtyPcs} Pcs):</span>
                <span>₹{(isNonGst ? (Number(invoice.subTotal || invoice.subtotal) || totalTaxableAmount) : totalTaxableAmount).toFixed(2)}</span>
              </div>
              {!isNonGst && (
                <>
                  {!isInterState ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>CGST:</span>
                        <span>₹{totalCgst.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>SGST:</span>
                        <span>₹{totalSgst.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>IGST:</span>
                      <span>₹{totalIgst.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Tax (GST):</span>
                    <span>₹{totalTaxAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              {Number(invoice.discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                  <span>Discount:</span>
                  <span>-₹{Number(invoice.discount).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '14px', marginTop: '2px' }}>
                <span>GRAND TOTAL:</span>
                <span>₹{(Number(invoice.grandTotal) || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span>Status:</span>
                <span>{invoice.paymentStatus} ({invoice.paymentMode || 'CASH'})</span>
              </div>
            </div>

            {upiQrUrl && (
              <div style={{ textAlign: 'center', margin: '8px 0' }}>
                <img src={upiQrUrl} alt="UPI QR" style={{ width: '110px', height: '110px', margin: '0 auto' }} />
                <div style={{ fontSize: '9px', fontWeight: 'bold' }}>Scan to Pay with Any UPI App</div>
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '8px' }}>
              <div>Bank: {business?.bankName} (A/C: {business?.accountNo})</div>
              <div style={{ fontStyle: 'italic', marginTop: '4px' }}>Thank you! Visit Again!</div>
            </div>
          </div>
        ) : (
        <div className="print-area" style={{ 
          padding: paperFormat === 'A5' ? '2px 4px' : '6px 10px', 
          background: '#ffffff', 
          color: '#000000', 
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: paperFormat === 'A5' ? '9px' : '11px',
          lineHeight: '1.2',
          pageBreakInside: 'avoid',
          breakInside: 'avoid'
        }}>
          
          {/* SECTION 1: TOP UNBOXED HEADER (Logo, Firm Name, Address) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: paperFormat === 'A5' ? '3px' : '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: paperFormat === 'A5' ? '8px' : '14px' }}>
              <img 
                src={firmLogo} 
                alt="Logo" 
                style={{ 
                  height: paperFormat === 'A5' ? '34px' : '52px', 
                  width: 'auto', 
                  objectFit: 'contain' 
                }} 
              />
              <div>
                <h1 style={{ 
                  fontSize: paperFormat === 'A5' ? '1.1rem' : '1.55rem', 
                  fontWeight: '900', 
                  margin: 0, 
                  textTransform: 'uppercase', 
                  color: '#000000',
                  lineHeight: '1.1'
                }}>
                  {business?.name || 'DISTRIBUTOR AGENCY'}
                </h1>
                {business?.address && (
                  <p style={{ margin: '1px 0 0 0', fontSize: paperFormat === 'A5' ? '0.66rem' : '0.78rem', color: '#1e293b', fontWeight: '500' }}>
                    {business.address}
                  </p>
                )}
                <div style={{ fontSize: paperFormat === 'A5' ? '0.64rem' : '0.75rem', fontWeight: '600', color: '#334155', marginTop: '1px' }}>
                  {business?.phone ? `Ph: ${business.phone}` : ''}
                  {business?.phone && business?.email ? '  |  ' : ''}
                  {business?.email ? `Email: ${business.email}` : ''}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: MAIN INVOICE METADATA BOX */}
          <div style={{ border: '1.5px solid #000000', marginBottom: paperFormat === 'A5' ? '3px' : '6px' }}>
            
            {/* Header Banner: GSTIN | TAX INVOICE | ORIGINAL FOR RECIPIENT */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.2fr 1fr 1.1fr', 
              borderBottom: '1.5px solid #000000', 
              background: '#f8fafc', 
              padding: paperFormat === 'A5' ? '1.5px 6px' : '3px 8px', 
              alignItems: 'center' 
            }}>
              <div style={{ fontWeight: '800', fontSize: paperFormat === 'A5' ? '0.72rem' : '0.86rem' }}>
                {!isNonGst && business?.gstin ? `GSTIN : ${business.gstin}` : (business?.phone ? `Ph : ${business.phone}` : '')}
              </div>
              <div style={{ textAlign: 'center', fontWeight: '900', fontSize: paperFormat === 'A5' ? '0.88rem' : '1.15rem', letterSpacing: '0.5px' }}>
                {isNonGst ? 'BILL OF SUPPLY / CASH MEMO' : 'TAX INVOICE'}
              </div>
              <div style={{ textAlign: 'right', fontWeight: '700', fontSize: paperFormat === 'A5' ? '0.62rem' : '0.75rem', textTransform: 'uppercase' }}>
                ORIGINAL FOR RECIPIENT
              </div>
            </div>

            {/* 3-Column Info Grid: Party Details | Invoice Numbers | Invoice Dates */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.35fr 1fr 0.95fr', 
              fontSize: paperFormat === 'A5' ? '0.66rem' : '0.78rem' 
            }}>
              
              {/* Col 1: Party / Buyer Info */}
              <div style={{ padding: paperFormat === 'A5' ? '2.5px 6px' : '4px 8px', borderRight: '1.5px solid #000000' }}>
                <div style={{ display: 'flex', marginBottom: '1px' }}>
                  <span style={{ width: paperFormat === 'A5' ? '52px' : '65px', fontWeight: '700', color: '#000' }}>M/S</span>
                  <strong style={{ fontSize: paperFormat === 'A5' ? '0.76rem' : '0.85rem', color: '#000' }}>{invoice.partyName}</strong>
                </div>
                <div style={{ display: 'flex', marginBottom: '1px' }}>
                  <span style={{ width: paperFormat === 'A5' ? '52px' : '65px', fontWeight: '700', color: '#000' }}>Address</span>
                  <span style={{ color: '#000' }}>{displayAddress}</span>
                </div>
                {invoice.partyPhone && (
                  <div style={{ display: 'flex', marginBottom: '1px' }}>
                    <span style={{ width: paperFormat === 'A5' ? '52px' : '65px', fontWeight: '700', color: '#000' }}>Phone</span>
                    <span style={{ color: '#000' }}>{invoice.partyPhone}</span>
                  </div>
                )}
                {!isNonGst && invoice.partyGstin && (
                  <div style={{ display: 'flex' }}>
                    <span style={{ width: paperFormat === 'A5' ? '52px' : '65px', fontWeight: '700', color: '#000' }}>GSTIN</span>
                    <span style={{ fontWeight: '700', color: '#000' }}>{invoice.partyGstin}</span>
                  </div>
                )}
              </div>

              {/* Col 2: Invoice No. & Challan No */}
              <div style={{ padding: paperFormat === 'A5' ? '2.5px 6px' : '4px 8px', borderRight: '1.5px solid #000000' }}>
                <div style={{ display: 'flex', marginBottom: '2px' }}>
                  <span style={{ width: paperFormat === 'A5' ? '70px' : '85px', fontWeight: '700', color: '#000' }}>Invoice No.</span>
                  <strong style={{ color: '#000' }}>{invoice.invoiceNo}</strong>
                </div>
                <div style={{ display: 'flex' }}>
                  <span style={{ width: paperFormat === 'A5' ? '70px' : '85px', fontWeight: '700', color: '#000' }}>Challan No</span>
                  <span style={{ color: '#000' }}>{invoice.challanNo || '-'}</span>
                </div>
              </div>

              {/* Col 3: Invoice Date & Challan Date */}
              <div style={{ padding: paperFormat === 'A5' ? '2.5px 6px' : '4px 8px' }}>
                <div style={{ display: 'flex', marginBottom: '2px' }}>
                  <span style={{ width: paperFormat === 'A5' ? '70px' : '80px', fontWeight: '700', color: '#000' }}>Invoice Date</span>
                  <strong style={{ color: '#000' }}>{formattedDate}</strong>
                </div>
                <div style={{ display: 'flex' }}>
                  <span style={{ width: paperFormat === 'A5' ? '70px' : '80px', fontWeight: '700', color: '#000' }}>Challan Date</span>
                  <span style={{ color: '#000' }}>{formattedDate}</span>
                </div>
              </div>

            </div>

            {/* e-Way Bill Information Banner if present */}
            {invoice.ewayBill && (
              <div style={{ 
                borderTop: '1px solid #000000', 
                padding: paperFormat === 'A5' ? '2px 6px' : '3px 8px', 
                background: '#f8fafc', 
                fontSize: paperFormat === 'A5' ? '0.62rem' : '0.74rem', 
                display: 'flex', 
                gap: '14px', 
                fontWeight: '600',
                flexWrap: 'wrap'
              }}>
                <span><strong>e-Way Bill No:</strong> {invoice.ewayBill.ewayBillNo || ('EWB-' + (invoice.invoiceNo || '').replace(/[^0-9]/g, ''))}</span>
                <span><strong>Vehicle No:</strong> {invoice.ewayBill.vehicleNo || 'DL-01-A-1234'}</span>
                <span><strong>Transporter:</strong> {invoice.ewayBill.transporterName || 'Self / Road Transport'}</span>
                {invoice.ewayBill.distanceKm && <span><strong>Distance:</strong> {invoice.ewayBill.distanceKm} KM</span>}
              </div>
            )}


          </div>

          {/* SECTION 3: ITEMS GRID TABLE */}
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: '1.5px solid #000000', 
            fontSize: paperFormat === 'A5' ? '8.5px' : '11px', 
            marginBottom: paperFormat === 'A5' ? '3px' : '6px' 
          }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #000000', background: '#f1f5f9', fontWeight: '800', textAlign: 'left', height: paperFormat === 'A5' ? '20px' : '26px' }}>
                <th style={{ padding: paperFormat === 'A5' ? '1.5px 3px' : '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', width: isNonGst ? '5%' : '4%', color: '#000', whiteSpace: 'nowrap' }}>Sr. No.</th>
                <th style={{ padding: paperFormat === 'A5' ? '1.5px 4px' : '3px 6px', borderRight: '1px solid #000000', width: isNonGst ? '48%' : (isInterState ? '33%' : '27%'), color: '#000', whiteSpace: 'nowrap' }}>Name of Product / Service</th>
                <th style={{ padding: paperFormat === 'A5' ? '1.5px 3px' : '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', width: isNonGst ? '12%' : '8%', color: '#000', whiteSpace: 'nowrap' }}>HSN / SAC</th>
                <th style={{ padding: paperFormat === 'A5' ? '1.5px 3px' : '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', width: isNonGst ? '11%' : (isInterState ? '9%' : '8%'), color: '#000', whiteSpace: 'nowrap' }}>Qty</th>
                <th style={{ padding: paperFormat === 'A5' ? '1.5px 4px' : '3px 6px', borderRight: '1px solid #000000', textAlign: 'right', width: isNonGst ? '11%' : (isInterState ? '10%' : '9%'), color: '#000', whiteSpace: 'nowrap' }}>Rate</th>
                {!isNonGst && (
                  <th style={{ padding: paperFormat === 'A5' ? '1.5px 4px' : '3px 6px', borderRight: '1px solid #000000', textAlign: 'right', width: '11%', color: '#000', whiteSpace: 'nowrap' }}>Taxable Value</th>
                )}
                {!isNonGst && (!isInterState ? (
                  <>
                    <th style={{ padding: paperFormat === 'A5' ? '1.5px 2px' : '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', width: '11%', color: '#000', whiteSpace: 'nowrap' }}>CGST (% | Amt)</th>
                    <th style={{ padding: paperFormat === 'A5' ? '1.5px 2px' : '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', width: '11%', color: '#000', whiteSpace: 'nowrap' }}>SGST (% | Amt)</th>
                  </>
                ) : (
                  <th style={{ padding: paperFormat === 'A5' ? '1.5px 3px' : '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', width: '13%', color: '#000', whiteSpace: 'nowrap' }}>IGST (% | Amt)</th>
                ))}
                <th style={{ padding: paperFormat === 'A5' ? '1.5px 4px' : '3px 6px', textAlign: 'right', width: isNonGst ? '13%' : (isInterState ? '12%' : '11%'), color: '#000', whiteSpace: 'nowrap' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {processedItems.map((item, index) => {
                return (
                  <tr key={index} style={{ borderBottom: '1px solid #cbd5e1', height: paperFormat === 'A5' ? '18px' : '24px', whiteSpace: 'nowrap', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 4px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: '600', color: '#000' }}>{index + 1}</td>
                    <td style={{ padding: paperFormat === 'A5' ? '1px 4px' : '2.5px 6px', borderRight: '1px solid #000000', fontWeight: '700', color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isNonGst ? '320px' : (isInterState ? '220px' : '180px') }}>{item.name}</td>
                    <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 4px', borderRight: '1px solid #000000', textAlign: 'center', color: '#000', fontWeight: '600' }}>{item.hsn || '1905'}</td>
                    <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 4px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: '800', color: '#000' }}>
                      {formatCartonStock(item.itemQty, item.pcsPerCarton)}
                    </td>
                    <td style={{ padding: paperFormat === 'A5' ? '1px 4px' : '2.5px 6px', borderRight: '1px solid #000000', textAlign: 'right', color: '#000', fontWeight: '600' }}>₹{item.itemRate.toFixed(2)}</td>
                    {!isNonGst && (
                      <td style={{ padding: paperFormat === 'A5' ? '1px 4px' : '2.5px 6px', borderRight: '1px solid #000000', textAlign: 'right', color: '#000', fontWeight: '600' }}>₹{item.taxableVal.toFixed(2)}</td>
                    )}
                    {!isNonGst && (!isInterState ? (
                      <>
                        <td style={{ padding: paperFormat === 'A5' ? '1px 2px' : '2.5px 3px', borderRight: '1px solid #000000', textAlign: 'center', color: '#000', fontWeight: '600', fontSize: paperFormat === 'A5' ? '7.5px' : '9px' }}>
                          {item.cgstRate}% {item.cgstAmt > 0 ? `(₹${item.cgstAmt.toFixed(2)})` : ''}
                        </td>
                        <td style={{ padding: paperFormat === 'A5' ? '1px 2px' : '2.5px 3px', borderRight: '1px solid #000000', textAlign: 'center', color: '#000', fontWeight: '600', fontSize: paperFormat === 'A5' ? '7.5px' : '9px' }}>
                          {item.sgstRate}% {item.sgstAmt > 0 ? `(₹${item.sgstAmt.toFixed(2)})` : ''}
                        </td>
                      </>
                    ) : (
                      <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 4px', borderRight: '1px solid #000000', textAlign: 'center', color: '#000', fontWeight: '600', fontSize: paperFormat === 'A5' ? '7.8px' : '9.5px' }}>
                        {item.igstRate}% {item.igstAmt > 0 ? `(₹${item.igstAmt.toFixed(2)})` : ''}
                      </td>
                    ))}
                    <td style={{ padding: paperFormat === 'A5' ? '1px 4px' : '2.5px 6px', textAlign: 'right', fontWeight: '800', color: '#000' }}>₹{item.itemTotal.toFixed(2)}</td>
                  </tr>
                );
              })}

              {/* Grid Filler Rows */}
              {Array.from({ length: Math.max(0, (paperFormat === 'A5' ? 4 : 7) - processedItems.length) }).map((_, emptyIndex) => (
                <tr key={`empty-${emptyIndex}`} style={{ borderBottom: '1px solid #cbd5e1', height: paperFormat === 'A5' ? '18px' : '24px', whiteSpace: 'nowrap', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 4px', borderRight: '1px solid #000000' }}>&nbsp;</td>
                  <td style={{ padding: paperFormat === 'A5' ? '1px 4px' : '2.5px 6px', borderRight: '1px solid #000000' }}>&nbsp;</td>
                  <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 4px', borderRight: '1px solid #000000' }}>&nbsp;</td>
                  <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 4px', borderRight: '1px solid #000000' }}>&nbsp;</td>
                  <td style={{ padding: paperFormat === 'A5' ? '1px 4px' : '2.5px 6px', borderRight: '1px solid #000000' }}>&nbsp;</td>
                  {!isNonGst && (
                    <td style={{ padding: paperFormat === 'A5' ? '1px 4px' : '2.5px 6px', borderRight: '1px solid #000000' }}>&nbsp;</td>
                  )}
                  {!isNonGst && (!isInterState ? (
                    <>
                      <td style={{ padding: paperFormat === 'A5' ? '1px 2px' : '2.5px 3px', borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td style={{ padding: paperFormat === 'A5' ? '1px 2px' : '2.5px 3px', borderRight: '1px solid #000000' }}>&nbsp;</td>
                    </>
                  ) : (
                    <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 4px', borderRight: '1px solid #000000' }}>&nbsp;</td>
                  ))}
                  <td style={{ padding: paperFormat === 'A5' ? '1px 4px' : '2.5px 6px' }}>&nbsp;</td>
                </tr>
              ))}

              {/* Summary Total Row */}
              <tr style={{ borderTop: '1.5px solid #000000', fontWeight: '800', background: '#f8fafc', color: '#000000', height: paperFormat === 'A5' ? '20px' : '26px' }}>
                <td colSpan={3} style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 8px', borderRight: '1px solid #000000', textAlign: 'right' }}>Total</td>
                <td style={{ padding: paperFormat === 'A5' ? '2px 3px' : '3px 4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                  {totalQtyPcs} Pcs
                </td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                {!isNonGst && (
                  <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderRight: '1px solid #000000', textAlign: 'right' }}>
                    ₹{totalTaxableAmount.toFixed(2)}
                  </td>
                )}
                {!isNonGst && (!isInterState ? (
                  <>
                    <td style={{ padding: paperFormat === 'A5' ? '2px 2px' : '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', fontSize: paperFormat === 'A5' ? '7.5px' : '9px' }}>
                      ₹{totalCgst.toFixed(2)}
                    </td>
                    <td style={{ padding: paperFormat === 'A5' ? '2px 2px' : '3px 4px', borderRight: '1px solid #000000', textAlign: 'center', fontSize: paperFormat === 'A5' ? '7.5px' : '9px' }}>
                      ₹{totalSgst.toFixed(2)}
                    </td>
                  </>
                ) : (
                  <td style={{ padding: paperFormat === 'A5' ? '2px 3px' : '3px 4px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                    ₹{totalIgst.toFixed(2)}
                  </td>
                ))}
                <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', textAlign: 'right', fontSize: '1.05em' }}>
                  ₹{(Number(invoice.grandTotal) || 0).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* SECTION 3.5: AMOUNT CHARGEABLE IN WORDS & HSN/SAC TAXABLE SUMMARY */}
          {!isNonGst && (
            <div style={{ marginBottom: paperFormat === 'A5' ? '3px' : '5px', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              
              {/* Amount Chargeable (in words) strip */}
              <div style={{ 
                border: '1.5px solid #000000', 
                borderBottom: 'none',
                padding: paperFormat === 'A5' ? '1.5px 5px' : '2.5px 6px', 
                fontSize: paperFormat === 'A5' ? '0.58rem' : '0.68rem',
                background: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                lineHeight: '1.2'
              }}>
                <div>
                  <span style={{ color: '#475569', fontWeight: '600' }}>Amount Chargeable (in words): </span>
                  <strong style={{ color: '#000000' }}>
                    {numToWordsIndian(invoice.grandTotal)}
                  </strong>
                </div>
                <div style={{ fontWeight: '800', color: '#000000', fontSize: '0.9em' }}>
                  E. & O.E
                </div>
              </div>

              {/* HSN/SAC Taxable Summary Table */}
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                border: '1.5px solid #000000', 
                fontSize: paperFormat === 'A5' ? '7.5px' : '9px',
                color: '#000000',
                lineHeight: '1.15'
              }}>
                <thead>
                  <tr style={{ background: '#f8fafc', fontWeight: '800', borderBottom: '1px solid #000000' }}>
                    <th rowSpan={2} style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2px 4px', borderRight: '1px solid #000000', textAlign: 'center', verticalAlign: 'middle', width: '18%' }}>HSN/SAC</th>
                    <th rowSpan={2} style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2px 4px', borderRight: '1px solid #000000', textAlign: 'right', verticalAlign: 'middle', width: '20%' }}>Taxable Value</th>
                    {!isInterState ? (
                      <>
                        <th colSpan={2} style={{ padding: paperFormat === 'A5' ? '1px 2px' : '1.5px 3px', borderRight: '1px solid #000000', textAlign: 'center', width: '23%' }}>CGST</th>
                        <th colSpan={2} style={{ padding: paperFormat === 'A5' ? '1px 2px' : '1.5px 3px', borderRight: '1px solid #000000', textAlign: 'center', width: '23%' }}>SGST/UTGST</th>
                      </>
                    ) : (
                      <th colSpan={2} style={{ padding: paperFormat === 'A5' ? '1px 2px' : '1.5px 3px', borderRight: '1px solid #000000', textAlign: 'center', width: '46%' }}>Integrated Tax (IGST)</th>
                    )}
                    <th rowSpan={2} style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2px 4px', textAlign: 'right', verticalAlign: 'middle', width: '16%' }}>Total Tax Amount</th>
                  </tr>
                  <tr style={{ background: '#f8fafc', fontWeight: '800', borderBottom: '1px solid #000000' }}>
                    {!isInterState ? (
                      <>
                        <th style={{ padding: paperFormat === 'A5' ? '1px 2px' : '1.5px 3px', borderRight: '1px solid #000000', textAlign: 'center', width: '9%' }}>Rate</th>
                        <th style={{ padding: paperFormat === 'A5' ? '1px 3px' : '1.5px 4px', borderRight: '1px solid #000000', textAlign: 'right', width: '14%' }}>Amount</th>
                        <th style={{ padding: paperFormat === 'A5' ? '1px 2px' : '1.5px 3px', borderRight: '1px solid #000000', textAlign: 'center', width: '9%' }}>Rate</th>
                        <th style={{ padding: paperFormat === 'A5' ? '1px 3px' : '1.5px 4px', borderRight: '1px solid #000000', textAlign: 'right', width: '14%' }}>Amount</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: paperFormat === 'A5' ? '1px 2px' : '1.5px 3px', borderRight: '1px solid #000000', textAlign: 'center', width: '16%' }}>Rate</th>
                        <th style={{ padding: paperFormat === 'A5' ? '1px 3px' : '1.5px 4px', borderRight: '1px solid #000000', textAlign: 'right', width: '30%' }}>Amount</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {hsnSummary.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', height: paperFormat === 'A5' ? '14px' : '17px' }}>
                      <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '1.5px 4px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: '700' }}>{row.hsn}</td>
                      <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '1.5px 4px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: '600' }}>{formatInr(row.taxableVal)}</td>
                      {!isInterState ? (
                        <>
                          <td style={{ padding: paperFormat === 'A5' ? '1px 2px' : '1.5px 3px', borderRight: '1px solid #000000', textAlign: 'center' }}>{row.cgstRate.toFixed(2)}%</td>
                          <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '1.5px 4px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: '600' }}>{formatInr(row.cgstAmt)}</td>
                          <td style={{ padding: paperFormat === 'A5' ? '1px 2px' : '1.5px 3px', borderRight: '1px solid #000000', textAlign: 'center' }}>{row.sgstRate.toFixed(2)}%</td>
                          <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '1.5px 4px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: '600' }}>{formatInr(row.sgstAmt)}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: paperFormat === 'A5' ? '1px 2px' : '1.5px 3px', borderRight: '1px solid #000000', textAlign: 'center' }}>{row.igstRate.toFixed(2)}%</td>
                          <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '1.5px 4px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: '600' }}>{formatInr(row.igstAmt)}</td>
                        </>
                      )}
                      <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '1.5px 4px', textAlign: 'right', fontWeight: '700' }}>{formatInr(row.taxAmt)}</td>
                    </tr>
                  ))}

                  {/* Summary Totals Row */}
                  <tr style={{ borderTop: '1.5px solid #000000', fontWeight: '800', background: '#f8fafc', height: paperFormat === 'A5' ? '15px' : '18px' }}>
                    <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2px 4px', borderRight: '1px solid #000000', textAlign: 'center' }}>Total</td>
                    <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2px 4px', borderRight: '1px solid #000000', textAlign: 'right' }}>{formatInr(totalTaxableAmount)}</td>
                    {!isInterState ? (
                      <>
                        <td style={{ borderRight: '1px solid #000000' }}></td>
                        <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2px 4px', borderRight: '1px solid #000000', textAlign: 'right' }}>{formatInr(totalCgst)}</td>
                        <td style={{ borderRight: '1px solid #000000' }}></td>
                        <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2px 4px', borderRight: '1px solid #000000', textAlign: 'right' }}>{formatInr(totalSgst)}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ borderRight: '1px solid #000000' }}></td>
                        <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2px 4px', borderRight: '1px solid #000000', textAlign: 'right' }}>{formatInr(totalIgst)}</td>
                      </>
                    )}
                    <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2px 4px', textAlign: 'right' }}>{formatInr(totalTaxAmount)}</td>
                  </tr>
                </tbody>
              </table>

            </div>
          )}

          {/* SECTION 4: BOTTOM FOOTER GRID (Words, QR Code, Amounts, Signatures, Bank) */}
          <div style={{ border: '1.5px solid #000000', fontSize: paperFormat === 'A5' ? '0.65rem' : '0.76rem', color: '#000000' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 0.7fr 1.15fr' }}>
              
              {/* BLOCK 1: Total in Words, Terms, Customer Signature */}
              <div style={{ padding: paperFormat === 'A5' ? '4px' : '6px', borderRight: '1.5px solid #000000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  {isNonGst && (
                    <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', marginBottom: '3px', fontWeight: '800', lineHeight: '1.2' }}>
                      Total in words : <span style={{ textTransform: 'uppercase' }}>{numToWords(invoice.grandTotal)}</span>
                    </div>
                  )}
                  <div style={{ fontSize: paperFormat === 'A5' ? '0.6rem' : '0.68rem', color: '#1e293b', lineHeight: '1.2' }}>
                    <strong>Terms and Conditions :</strong> {business?.terms || 'Subject to Local Jurisdiction. Goods once sold will not be taken back.'}
                  </div>
                </div>

                <div style={{ marginTop: paperFormat === 'A5' ? '10px' : '22px' }}>
                  <div style={{ 
                    borderTop: '1.5px solid #000000', 
                    display: 'inline-block', 
                    paddingTop: '1px', 
                    paddingRight: '12px',
                    fontWeight: '800',
                    color: '#000000'
                  }}>
                    Customer Signature
                  </div>
                </div>
              </div>

              {/* BLOCK 2: Pay using UPI QR Code (MargPay Instant Digital Payment) */}
              <div style={{ padding: '3px', borderRight: '1.5px solid #000000', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
                {upiQrUrl ? (
                  <img 
                    src={upiQrUrl} 
                    alt="UPI QR Code" 
                    style={{ width: paperFormat === 'A5' ? '68px' : '96px', height: paperFormat === 'A5' ? '68px' : '96px', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ width: paperFormat === 'A5' ? '68px' : '96px', height: paperFormat === 'A5' ? '68px' : '96px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>
                    UPI QR
                  </div>
                )}
                <div style={{ fontWeight: '800', marginTop: '2px', fontSize: paperFormat === 'A5' ? '0.62rem' : '0.72rem', color: '#000000' }}>
                  Scan & Pay UPI
                </div>
              </div>

              {/* BLOCK 3: Taxable Amount / Subtotal, Total Tax, Grand Total, Authorized Signatory */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: paperFormat === 'A5' ? '0.65rem' : '0.76rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#000' }}>
                        {isNonGst ? 'Subtotal' : 'Taxable Amount'}
                      </td>
                      <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#000' }}>
                        ₹{(isNonGst ? (Number(invoice.subTotal || invoice.subtotal) || totalTaxableAmount) : totalTaxableAmount).toFixed(2)}
                      </td>
                    </tr>
                    {!isNonGst && !isInterState && (
                      <>
                        <tr>
                          <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#000' }}>CGST</td>
                          <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#000' }}>₹{totalCgst.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#000' }}>SGST</td>
                          <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#000' }}>₹{totalSgst.toFixed(2)}</td>
                        </tr>
                      </>
                    )}
                    {!isNonGst && isInterState && (
                      <tr>
                        <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#000' }}>IGST</td>
                        <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#000' }}>₹{totalIgst.toFixed(2)}</td>
                      </tr>
                    )}
                    {!isNonGst && (
                      <tr>
                        <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#000' }}>Total Tax</td>
                        <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#000' }}>₹{totalTaxAmount.toFixed(2)}</td>
                      </tr>
                    )}
                    {Number(invoice.discount || 0) > 0 && (
                      <tr>
                        <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#059669' }}>Discount</td>
                        <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#059669' }}>-₹{Number(invoice.discount).toFixed(2)}</td>
                      </tr>
                    )}
                    {Number(invoice.roundOff || 0) !== 0 && (
                      <tr>
                        <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#000' }}>Round Off</td>
                        <td style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', color: '#000' }}>
                          {Number(invoice.roundOff) > 0 ? `+₹${Number(invoice.roundOff).toFixed(2)}` : `-₹${Math.abs(Number(invoice.roundOff)).toFixed(2)}`}
                        </td>
                      </tr>
                    )}
                    <tr style={{ background: '#f8fafc' }}>
                      <td style={{ padding: paperFormat === 'A5' ? '2.5px 4px' : '4px 6px', borderBottom: '1px solid #000000', fontWeight: '900', fontSize: paperFormat === 'A5' ? '0.72rem' : '0.85rem', color: '#000' }}>
                        {isNonGst ? 'Grand Total' : 'Total Amount After Tax'}
                      </td>
                      <td style={{ padding: paperFormat === 'A5' ? '2.5px 4px' : '4px 6px', borderBottom: '1px solid #000000', textAlign: 'right', fontWeight: '900', fontSize: paperFormat === 'A5' ? '0.82rem' : '0.96rem', color: '#000' }}>₹{(Number(invoice.grandTotal) || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ padding: paperFormat === 'A5' ? '2px 4px' : '3px 6px', fontWeight: '800', fontSize: paperFormat === 'A5' ? '0.62rem' : '0.72rem', color: '#000' }}>
                        For {business?.name || 'Distributor Agency'} <span style={{ float: 'right', color: '#475569', fontWeight: '600' }}>(E & O.E.)</span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ padding: paperFormat === 'A5' ? '3px 4px' : '6px', textAlign: 'right' }}>
                  <div style={{ height: paperFormat === 'A5' ? '8px' : '18px' }}></div>
                  <div style={{ 
                    borderTop: '1.5px solid #000000', 
                    display: 'inline-block', 
                    paddingTop: '1px', 
                    paddingLeft: '12px',
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
              padding: paperFormat === 'A5' ? '2px 6px' : '3px 8px', 
              fontWeight: '700', 
              background: '#f8fafc', 
              fontSize: paperFormat === 'A5' ? '0.63rem' : '0.74rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                Bank: <strong>{business?.bankName || 'State Bank of India'}</strong> | A/c No: <strong>{business?.accountNo || '389201009823'}</strong> | IFSC: <strong>{business?.ifscCode || 'SBIN0001420'}</strong>
              </div>
              <div style={{ fontStyle: 'italic', fontWeight: '600', color: '#334155' }}>
                Thank you for shopping with us!
              </div>
            </div>

          </div>

        </div>
        )}

      </div>
    </div>
  );
}
