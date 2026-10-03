import React, { useEffect, useState, useMemo } from 'react';
import { Printer, X, Zap, Trash2, Send, MessageSquare, Mail, Palette, Truck, QrCode, FileText, Edit3, Plus, Minus, Save, CheckCircle } from 'lucide-react';
import { formatCartonStock, deleteInvoice, fetchParties, fetchProducts, updateInvoice } from '../utils/storage';
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

export default function InvoicePrintModal({ invoice, business, onClose, refreshAllData, onEditInvoice }) {
  const [paperFormat, setPaperFormat] = useState(() => localStorage.getItem('distro_default_paper_format') || 'A5');
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('distro_invoice_theme') || '#059669');
  const [upiQrUrl, setUpiQrUrl] = useState(null);
  const [eInvoiceQrUrl, setEInvoiceQrUrl] = useState(null);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editInvoiceNo, setEditInvoiceNo] = useState('');
  const [editItems, setEditItems] = useState([]);
  const [editPartyId, setEditPartyId] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('PAID');
  const [editPaymentMode, setEditPaymentMode] = useState('CASH');
  const [editPaidAmount, setEditPaidAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editProductSearch, setEditProductSearch] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    // If user has uploaded a custom UPI QR image, use it directly
    if (business?.upiQrImage) {
      setUpiQrUrl(business.upiQrImage);
    } else {
      generateUpiQrDataUrl(business?.upiId, business?.name, invoice.grandTotal, invoice.invoiceNo)
        .then(url => setUpiQrUrl(url));
    }
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

  const handleEditInvoice = () => {
    // Open inline edit panel — no delete, no navigation
    setEditInvoiceNo(invoice.invoiceNo || '');
    setEditItems((invoice.items || []).map(item => ({ ...item })));
    setEditPartyId(invoice.partyId || '');
    setEditCustomerName(invoice.partyName || invoice.customerName || '');
    setEditPaymentStatus(invoice.paymentStatus || 'PAID');
    setEditPaymentMode(invoice.paymentMode || 'CASH');
    setEditPaidAmount(invoice.paidAmount || '');
    setEditNotes(invoice.notes || '');
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    const allProducts = fetchProducts();
    // Recalculate totals for edited items
    const updatedItems = editItems.map(item => {
      const price = Number(item.price) || 0;
      const qty = Number(item.qty) || 0;
      const total = price * qty;
      const gstRate = Number(item.gstRate) || 0;
      const gstAmt = total - (total / (1 + gstRate / 100));
      return { ...item, qty, price, total, itemGstAmount: gstAmt, taxableAmount: total - gstAmt };
    });
    const grandTotal = updatedItems.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const totalTax = updatedItems.reduce((s, i) => s + (Number(i.itemGstAmount) || 0), 0);
    const taxableSubtotal = grandTotal - totalTax;

    // Resolve party
    const allParties = fetchParties();
    const chosenParty = allParties.find(p => p.id === editPartyId);

    const paidAmt = editPaymentStatus === 'PAID' ? grandTotal : (Number(editPaidAmount) || 0);
    const finalInvNo = (editInvoiceNo && editInvoiceNo.trim()) ? editInvoiceNo.trim() : invoice.invoiceNo;

    const updatedInvoiceData = {
      ...invoice,
      invoiceNo: finalInvNo,
      items: updatedItems,
      partyId: editPartyId || invoice.partyId,
      partyName: chosenParty?.name || editCustomerName || invoice.partyName,
      customerName: chosenParty?.name || editCustomerName || invoice.customerName,
      partyPhone: chosenParty?.phone || invoice.partyPhone,
      partyAddress: chosenParty?.address || invoice.partyAddress,
      paymentStatus: editPaymentStatus,
      paymentMode: editPaymentMode,
      paidAmount: paidAmt,
      notes: editNotes,
      grandTotal,
      taxTotal: totalTax,
      taxableSubtotal,
      subtotal: taxableSubtotal,
      subTotal: taxableSubtotal,
      cgst: totalTax / 2,
      sgst: totalTax / 2,
    };

    updateInvoice(invoice, {
      ...updatedInvoiceData,
      invoiceNo: finalInvNo
    });
    if (refreshAllData) refreshAllData();
    setEditMode(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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
  const isDense = (paperFormat === "A5" && processedItems.length >= 10);

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
    <>
            {/* Dynamic @page sizing for A3, A4, and A5 printing */}
      <style>{`
        @media print {
          @page {
            size: ${paperFormat === 'A3' ? 'A3 portrait' : 'auto'} !important;
            margin: ${paperFormat === 'A3' ? '8mm 10mm' : '2mm 4mm 0mm 4mm'} !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body.has-printable-modal,
          body.has-printable-modal .app-container,
          body.has-printable-modal .modal-overlay,
          body.has-printable-modal .printable-modal-content,
          body.has-printable-modal .print-area {
            margin: 0 !important;
            padding: 0 !important;
            top: 0 !important;
            left: 0 !important;
            position: static !important;
          }
          .print-area-a5 {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            max-height: 138mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .print-area-a5 table,
          .print-area-a5 tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
      <div className="modal-overlay" style={{ zIndex: 1000 }}>
        <div className="modal-content printable-modal-content" style={{ width: '100%', maxWidth: paperFormat === 'A5' ? '820px' : paperFormat === 'A3' ? '1060px' : '900px', background: '#ffffff', color: '#000000', padding: 0, transition: 'all 0.3s ease' }}>
        
        {/* Success Banner */}
        {saveSuccess && (
          <div className="no-print" style={{ background: '#059669', color: '#fff', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.9rem' }}>
            <CheckCircle size={18} />
            ✅ Bill updated successfully! Same invoice number kept — {invoice.invoiceNo}
          </div>
        )}

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
                A5 Half Page (A4 Cut)
              </button>
              <button
                onClick={() => changePaperFormat('A3')}
                style={{
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: '4px',
                  background: paperFormat === 'A3' ? '#ffffff' : 'transparent',
                  fontWeight: paperFormat === 'A3' ? '700' : '500',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                A3 Page (12+ Items)
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

            {paperFormat === 'A3' && (
              <span style={{ fontSize: '0.72rem', color: '#1d4ed8', background: '#eff6ff', padding: '3px 8px', borderRadius: '4px', fontWeight: '700', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>⚡ A3 Large Page: 12+ Items Fit Guarantee</span>
              </span>
            )}
            {paperFormat === 'A5' && (
              <span style={{ fontSize: '0.72rem', color: '#047857', background: '#ecfdf5', padding: '3px 8px', borderRadius: '4px', fontWeight: '700', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>⚡ A4 Sheet Beech se Phad kar Print karein: 100% Top Half Fit</span>
              </span>
            )}

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

            {onEditInvoice && (
              <button
                onClick={handleEditInvoice}
                className="btn btn-sm"
                style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '700' }}
                title="Edit this bill — correct any mistake"
              >
                <Edit3 size={14} />
                <span>Edit Bill</span>
              </button>
            )}

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
        <div className={`print-area ${paperFormat === 'A5' ? 'print-area-a5' : paperFormat === 'A3' ? 'print-area-a3' : 'print-area-a4'} ${isDense ? 'is-dense' : ''}`} style={{ 
          width: '100%',
          maxWidth: '100%',
          padding: paperFormat === 'A5' ? '1px 2px' : '6px 10px', 
          background: '#ffffff', 
          color: '#000000', 
          fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif",
          fontSize: paperFormat === 'A5' ? '8.2px' : '10.5px',
          lineHeight: '1.2',
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
          pageBreakAfter: 'avoid',
          breakAfter: 'avoid',
          boxSizing: 'border-box'
        }}>
          
          {/* ========================================================= */}
          {/* SECTION 1: EXECUTIVE DISTRIBUTOR LETTERHEAD */}
          {/* ========================================================= */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            borderBottom: '2px solid #000000',
            paddingBottom: paperFormat === 'A5' ? '3px' : '6px',
            marginBottom: paperFormat === 'A5' ? '3px' : '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: paperFormat === 'A5' ? '10px' : '14px' }}>
              <img 
                src={firmLogo} 
                alt="Logo" 
                style={{ 
                  height: paperFormat === 'A5' ? '38px' : '52px', 
                  width: 'auto', 
                  objectFit: 'contain' 
                }} 
              />
              <div>
                <h1 style={{ 
                  fontSize: paperFormat === 'A5' ? '1.18rem' : '1.55rem', 
                  fontWeight: '900', 
                  margin: 0, 
                  textTransform: 'uppercase', 
                  color: '#000000',
                  lineHeight: '1.1',
                  letterSpacing: '0.4px'
                }}>
                  {business?.name || 'JAI MAA SHARDEY ENTERPRISES'}
                </h1>
                <p style={{ margin: '1.5px 0 0 0', fontSize: paperFormat === 'A5' ? '0.68rem' : '0.80rem', color: '#1e293b', fontWeight: '500', lineHeight: 1.2 }}>
                  {business?.address || 'K-6/73A, Gali No.8, Near Vikrant Chowk, Mohan Garden, Uttam Nagar, New Delhi - 110059'}
                </p>
                <div style={{ fontSize: paperFormat === 'A5' ? '0.66rem' : '0.76rem', fontWeight: '600', color: '#334155', marginTop: '1px' }}>
                  {business?.phone ? <span>Ph: <strong>{business.phone}</strong></span> : ''}
                  {business?.phone && business?.email ? '  •  ' : ''}
                  {business?.email ? <span>Email: <strong>{business.email}</strong></span> : ''}
                  {business?.proprietor ? <span>  •  Proprietor: <strong>{business.proprietor}</strong></span> : ''}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 2: STATUTORY INVOICE HEADER & 2-COLUMN METADATA */}
          {/* ========================================================= */}
          <div style={{ 
            border: '1px solid #000000', 
            marginBottom: paperFormat === 'A5' ? '3px' : '6px',
            background: '#ffffff'
          }}>
            
            {/* Top Bar: GSTIN | TAX INVOICE | ORIGINAL FOR RECIPIENT */}
            <div style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #000000', 
              background: '#f1f5f9', 
              padding: paperFormat === 'A5' ? '2px 6px' : '3px 8px'
            }}>
              <div style={{ fontWeight: '800', fontSize: paperFormat === 'A5' ? '0.72rem' : '0.84rem', color: '#000000' }}>
                {!isNonGst && business?.gstin ? <span>GSTIN: <strong>{business.gstin}</strong></span> : (business?.phone ? <span>Ph: {business.phone}</span> : '')}
              </div>
              <div style={{ 
                textAlign: 'center', 
                fontWeight: '900', 
                fontSize: paperFormat === 'A5' ? '0.88rem' : '1.10rem', 
                letterSpacing: '0.8px', 
                color: '#000000' 
              }}>
                {isNonGst ? 'BILL OF SUPPLY / CASH MEMO' : 'TAX INVOICE'}
              </div>
              <div style={{ textAlign: 'right', fontWeight: '800', fontSize: paperFormat === 'A5' ? '0.66rem' : '0.74rem', color: '#334155', textTransform: 'uppercase' }}>
                ORIGINAL FOR RECIPIENT
              </div>
            </div>

            {/* 2-Column Buyer & Invoice Details */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.25fr 1fr', 
              fontSize: paperFormat === 'A5' ? '0.72rem' : '0.80rem' 
            }}>
              
              {/* Left Box: Buyer (Bill to) */}
              <div style={{ padding: paperFormat === 'A5' ? '3px 6px' : '5px 8px', borderRight: '1px solid #000000' }}>
                <div style={{ fontSize: paperFormat === 'A5' ? '0.62rem' : '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '1px' }}>
                  BUYER (BILL TO) / CONSIGNEE:
                </div>
                <div style={{ fontSize: paperFormat === 'A5' ? '0.84rem' : '0.94rem', fontWeight: '900', color: '#000000', marginBottom: '1px' }}>
                  {invoice.partyName || invoice.customerName}
                </div>
                <div style={{ fontSize: paperFormat === 'A5' ? '0.70rem' : '0.78rem', color: '#1e293b', lineHeight: 1.2, marginBottom: '2px' }}>
                  {displayAddress}
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: paperFormat === 'A5' ? '0.70rem' : '0.78rem', color: '#000000', flexWrap: 'wrap' }}>
                  {invoice.partyPhone && <span>Phone: <strong>{invoice.partyPhone}</strong></span>}
                  {!isNonGst && invoice.partyGstin && <span>GSTIN: <strong style={{ fontFamily: 'monospace' }}>{invoice.partyGstin}</strong></span>}
                </div>
              </div>

              {/* Right Box: Structured Invoice Numbers & Dates */}
              <div style={{ padding: paperFormat === 'A5' ? '3px 6px' : '5px 8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: paperFormat === 'A5' ? '0.70rem' : '0.78rem', lineHeight: 1.25 }}>
                  <tbody>
                    <tr>
                      <td style={{ color: '#475569', fontWeight: '600', width: '85px', padding: '0.8px 0' }}>Invoice No.:</td>
                      <td style={{ fontWeight: '800', color: '#000000', padding: '0.8px 0' }}>{invoice.invoiceNo}</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#475569', fontWeight: '600', padding: '0.8px 0' }}>Invoice Date:</td>
                      <td style={{ fontWeight: '800', color: '#000000', padding: '0.8px 0' }}>{formattedDate}</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#475569', fontWeight: '600', padding: '0.8px 0' }}>Payment Mode:</td>
                      <td style={{ fontWeight: '700', color: '#000000', padding: '0.8px 0' }}>{invoice.paymentMode || 'CASH'} ({invoice.paymentStatus})</td>
                    </tr>
                    {!isNonGst && (
                      <tr>
                        <td style={{ color: '#475569', fontWeight: '600', padding: '0.8px 0' }}>Place of Supply:</td>
                        <td style={{ color: '#1e293b', padding: '0.8px 0' }}>{business?.state ? `${business.state} (${business.stateCode || '07'})` : 'Delhi (07)'}</td>
                      </tr>
                    )}
                    {invoice.challanNo && (
                      <tr>
                        <td style={{ color: '#475569', fontWeight: '600', padding: '0.8px 0' }}>Challan No.:</td>
                        <td style={{ color: '#1e293b', padding: '0.8px 0' }}>{invoice.challanNo}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Optional e-Way Bill Banner */}
            {invoice.ewayBill && (
              <div style={{ 
                borderTop: '1px solid #000000', 
                padding: '2px 6px', 
                background: '#f8fafc', 
                fontSize: paperFormat === 'A5' ? '0.64rem' : '0.74rem', 
                display: 'flex', 
                gap: '12px', 
                fontWeight: '600',
                color: '#1e293b',
                flexWrap: 'wrap'
              }}>
                <span><strong>e-Way Bill No:</strong> {invoice.ewayBill.ewayBillNo || ('EWB-' + (invoice.invoiceNo || '').replace(/[^0-9]/g, ''))}</span>
                <span><strong>Vehicle No:</strong> {invoice.ewayBill.vehicleNo || 'DL-01-A-1234'}</span>
                <span><strong>Transporter:</strong> {invoice.ewayBill.transporterName || 'Road Transport'}</span>
                {invoice.ewayBill.distanceKm && <span><strong>Distance:</strong> {invoice.ewayBill.distanceKm} KM</span>}
              </div>
            )}

          </div>

          {/* ========================================================= */}
          {/* SECTION 3: ITEMS GRID TABLE */}
          {/* ========================================================= */}
          <table className="items-table" style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: '1px solid #000000', 
            fontSize: paperFormat === 'A5' ? '8.2px' : '10.5px', 
            marginBottom: paperFormat === 'A5' ? '2px' : '5px' 
          }}>
            <thead>
              <tr style={{ 
                borderBottom: '1px solid #000000', 
                background: '#f1f5f9', 
                fontWeight: '800', 
                textAlign: 'left', 
                color: '#000000'
              }}>
                <th style={{ padding: paperFormat === 'A5' ? '2px 3px' : '3.5px 5px', borderRight: '1px solid #000000', textAlign: 'center', width: '4%' }}>#</th>
                <th style={{ padding: paperFormat === 'A5' ? '2px 5px' : '3.5px 7px', borderRight: '1px solid #000000', width: isNonGst ? '52%' : '44%' }}>Product Description</th>
                <th style={{ padding: paperFormat === 'A5' ? '2px 3px' : '3.5px 5px', borderRight: '1px solid #000000', textAlign: 'center', width: '10%' }}>HSN/SAC</th>
                <th style={{ padding: paperFormat === 'A5' ? '2px 3px' : '3.5px 5px', borderRight: '1px solid #000000', textAlign: 'center', width: '9%' }}>Qty</th>
                <th style={{ padding: paperFormat === 'A5' ? '2px 5px' : '3.5px 7px', borderRight: '1px solid #000000', textAlign: 'right', width: '11%' }}>Rate (₹)</th>
                {!isNonGst && (
                  <th style={{ padding: paperFormat === 'A5' ? '2px 5px' : '3.5px 7px', borderRight: '1px solid #000000', textAlign: 'right', width: '11%' }}>Taxable (₹)</th>
                )}
                <th style={{ padding: paperFormat === 'A5' ? '2px 5px' : '3.5px 7px', textAlign: 'right', width: isNonGst ? '14%' : '11%' }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {processedItems.map((item, index) => (
                <tr key={index} style={{ 
                  borderBottom: '1px solid #e2e8f0', 
                  height: paperFormat === 'A5' ? '15px' : '22px', 
                  pageBreakInside: 'avoid', 
                  breakInside: 'avoid',
                  background: index % 2 === 1 ? '#fafafa' : '#ffffff'
                }}>
                  <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 5px', borderRight: '1px solid #e2e8f0', textAlign: 'center', color: '#475569' }}>{index + 1}</td>
                  <td style={{ padding: paperFormat === 'A5' ? '1px 5px' : '2.5px 7px', borderRight: '1px solid #e2e8f0', fontWeight: '700', color: '#000000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</td>
                  <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 5px', borderRight: '1px solid #e2e8f0', textAlign: 'center', color: '#334155', fontFamily: 'monospace' }}>{item.hsn || '1905'}</td>
                  <td style={{ padding: paperFormat === 'A5' ? '1px 3px' : '2.5px 5px', borderRight: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', color: '#000000' }}>
                    {formatCartonStock(item.itemQty, item.pcsPerCarton)}
                  </td>
                  <td style={{ padding: paperFormat === 'A5' ? '1px 5px' : '2.5px 7px', borderRight: '1px solid #e2e8f0', textAlign: 'right', color: '#334155' }}>₹{item.itemRate.toFixed(2)}</td>
                  {!isNonGst && (
                    <td style={{ padding: paperFormat === 'A5' ? '1px 5px' : '2.5px 7px', borderRight: '1px solid #e2e8f0', textAlign: 'right', color: '#334155' }}>₹{item.taxableVal.toFixed(2)}</td>
                  )}
                  <td style={{ padding: paperFormat === 'A5' ? '1px 5px' : '2.5px 7px', textAlign: 'right', fontWeight: '800', color: '#000000' }}>₹{item.itemTotal.toFixed(2)}</td>
                </tr>
              ))}

              {/* Summary Total Row */}
              <tr style={{ 
                borderTop: '1px solid #000000', 
                fontWeight: '900', 
                background: '#f8fafc', 
                color: '#000000', 
                height: paperFormat === 'A5' ? '16px' : '24px' 
              }}>
                <td colSpan={3} style={{ padding: paperFormat === 'A5' ? '1.5px 6px' : '3px 8px', borderRight: '1px solid #000000', textAlign: 'right' }}>Total</td>
                <td style={{ padding: paperFormat === 'A5' ? '1.5px 3px' : '3px 5px', borderRight: '1px solid #000000', textAlign: 'center' }}>
                  {totalQtyPcs} Pcs
                </td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                {!isNonGst && (
                  <td style={{ padding: paperFormat === 'A5' ? '1.5px 5px' : '3px 7px', borderRight: '1px solid #000000', textAlign: 'right' }}>
                    ₹{totalTaxableAmount.toFixed(2)}
                  </td>
                )}
                <td style={{ padding: paperFormat === 'A5' ? '1.5px 5px' : '3px 7px', textAlign: 'right', fontSize: '1.05em' }}>
                  ₹{(Number(invoice.grandTotal) || 0).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ========================================================= */}
          {/* SECTION 3.5: AMOUNT IN WORDS STRIP */}
          {/* ========================================================= */}
          <div style={{ 
            border: '1px solid #000000', 
            borderBottom: isNonGst ? '1px solid #000000' : 'none',
            padding: paperFormat === 'A5' ? '2px 6px' : '3px 8px', 
            fontSize: paperFormat === 'A5' ? '0.66rem' : '0.76rem',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: isNonGst ? '2px' : '0'
          }}>
            <div>
              <span style={{ color: '#475569', fontWeight: '600' }}>Amount in words: </span>
              <strong style={{ color: '#000000' }}>{numToWordsIndian(invoice.grandTotal)}</strong>
            </div>
            <div style={{ fontWeight: '800', color: '#475569', fontSize: '0.9em' }}>
              E. & O.E.
            </div>
          </div>

          {/* HSN/SAC Tax Summary Table */}
          {!isNonGst && (
            <table className="hsn-table" style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              border: '1px solid #000000', 
              fontSize: paperFormat === 'A5' ? '7.4px' : '8.8px',
              color: '#000000',
              marginBottom: paperFormat === 'A5' ? '2px' : '5px'
            }}>
              <thead>
                <tr style={{ background: '#f1f5f9', fontWeight: '800', borderBottom: '1px solid #000000', height: paperFormat === 'A5' ? '13px' : '18px' }}>
                  <th style={{ padding: '1px 3px', borderRight: '1px solid #cbd5e1', textAlign: 'center', width: '16%' }}>HSN/SAC</th>
                  <th style={{ padding: '1px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'right', width: '20%' }}>Taxable Value</th>
                  {!isInterState ? (
                    <>
                      <th style={{ padding: '1px 3px', borderRight: '1px solid #cbd5e1', textAlign: 'center', width: '9%' }}>CGST %</th>
                      <th style={{ padding: '1px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'right', width: '15%' }}>CGST Amt</th>
                      <th style={{ padding: '1px 3px', borderRight: '1px solid #cbd5e1', textAlign: 'center', width: '9%' }}>SGST %</th>
                      <th style={{ padding: '1px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'right', width: '15%' }}>SGST Amt</th>
                    </>
                  ) : (
                    <>
                      <th style={{ padding: '1px 3px', borderRight: '1px solid #cbd5e1', textAlign: 'center', width: '16%' }}>IGST %</th>
                      <th style={{ padding: '1px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'right', width: '32%' }}>IGST Amt</th>
                    </>
                  )}
                  <th style={{ padding: '1px 4px', textAlign: 'right', width: '16%' }}>Total Tax</th>
                </tr>
              </thead>
              <tbody>
                {hsnSummary.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', height: paperFormat === 'A5' ? '12px' : '15px' }}>
                    <td style={{ padding: '1px 3px', borderRight: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '700', fontFamily: 'monospace' }}>{row.hsn}</td>
                    <td style={{ padding: '1px 4px', borderRight: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '600' }}>{formatInr(row.taxableVal)}</td>
                    {!isInterState ? (
                      <>
                        <td style={{ padding: '1px 3px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>{row.cgstRate.toFixed(1)}%</td>
                        <td style={{ padding: '1px 4px', borderRight: '1px solid #e2e8f0', textAlign: 'right' }}>{formatInr(row.cgstAmt)}</td>
                        <td style={{ padding: '1px 3px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>{row.sgstRate.toFixed(1)}%</td>
                        <td style={{ padding: '1px 4px', borderRight: '1px solid #e2e8f0', textAlign: 'right' }}>{formatInr(row.sgstAmt)}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '1px 3px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>{row.igstRate.toFixed(1)}%</td>
                        <td style={{ padding: '1px 4px', borderRight: '1px solid #e2e8f0', textAlign: 'right' }}>{formatInr(row.igstAmt)}</td>
                      </>
                    )}
                    <td style={{ padding: '1px 4px', textAlign: 'right', fontWeight: '700' }}>{formatInr(row.taxAmt)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid #000000', fontWeight: '800', background: '#f8fafc', height: paperFormat === 'A5' ? '12px' : '16px' }}>
                  <td style={{ padding: '1px 3px', borderRight: '1px solid #000000', textAlign: 'center' }}>Total</td>
                  <td style={{ padding: '1px 4px', borderRight: '1px solid #000000', textAlign: 'right' }}>{formatInr(totalTaxableAmount)}</td>
                  {!isInterState ? (
                    <>
                      <td style={{ borderRight: '1px solid #cbd5e1' }}></td>
                      <td style={{ padding: '1px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'right' }}>{formatInr(totalCgst)}</td>
                      <td style={{ borderRight: '1px solid #cbd5e1' }}></td>
                      <td style={{ padding: '1px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'right' }}>{formatInr(totalSgst)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ borderRight: '1px solid #cbd5e1' }}></td>
                      <td style={{ padding: '1px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'right' }}>{formatInr(totalIgst)}</td>
                    </>
                  )}
                  <td style={{ padding: '1px 4px', textAlign: 'right' }}>{formatInr(totalTaxAmount)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {/* ========================================================= */}
          {/* SECTION 4: FOOTER GRID (Terms, UPI QR, Totals, Signature) */}
          {/* ========================================================= */}
          <div style={{ 
            border: '1px solid #000000', 
            fontSize: paperFormat === 'A5' ? '0.68rem' : '0.78rem', 
            color: '#000000',
            background: '#ffffff',
            display: 'grid', 
            gridTemplateColumns: paperFormat === 'A5' ? '1.2fr 0.7fr 1.4fr' : '1.3fr 0.7fr 1.35fr' 
          }}>
            
            {/* Box 1: Terms & Customer Signature */}
            <div style={{ padding: paperFormat === 'A5' ? '3px 5px' : '5px 7px', borderRight: '1px solid #000000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: '800', color: '#334155', textTransform: 'uppercase', fontSize: paperFormat === 'A5' ? '0.62rem' : '0.70rem', marginBottom: '1.5px' }}>
                  Terms & Conditions:
                </div>
                <div style={{ fontSize: paperFormat === 'A5' ? '0.58rem' : '0.66rem', color: '#475569', lineHeight: 1.2 }}>
                  1. Goods once sold will not be taken back.<br />
                  2. Subject to Delhi jurisdiction only.
                </div>
              </div>

              <div style={{ marginTop: paperFormat === 'A5' ? '8px' : '14px' }}>
                <div style={{ 
                  borderTop: '1px solid #000000', 
                  display: 'inline-block', 
                  paddingTop: '2px', 
                  paddingRight: '14px',
                  fontWeight: '700',
                  color: '#000000',
                  fontSize: paperFormat === 'A5' ? '0.62rem' : '0.70rem'
                }}>
                  Customer's Signature
                </div>
              </div>
            </div>

            {/* Box 2: UPI QR Code (Enlarged, Sharp, Centered) */}
            <div style={{ padding: '3px', borderRight: '1px solid #000000', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
              {upiQrUrl ? (
                <img 
                  src={upiQrUrl} 
                  alt="UPI QR Code" 
                  style={{ 
                    width: paperFormat === 'A5' ? '54px' : '76px', 
                    height: paperFormat === 'A5' ? '54px' : '76px', 
                    objectFit: 'contain', 
                    background: '#ffffff', 
                    padding: '2px', 
                    borderRadius: '3px', 
                    border: '1px solid #cbd5e1' 
                  }} 
                />
              ) : (
                <div style={{ width: '54px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', border: '1px dashed #cbd5e1' }}>
                  UPI QR
                </div>
              )}
              <div style={{ fontWeight: '800', marginTop: '2px', fontSize: paperFormat === 'A5' ? '0.58rem' : '0.66rem', color: '#000000', letterSpacing: '0.2px' }}>
                Scan & Pay UPI
              </div>
            </div>

            {/* Box 3: Totals & Authorized Signatory */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: paperFormat === 'A5' ? '0.68rem' : '0.76rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                      {isNonGst ? 'Subtotal' : 'Taxable Amount'}
                    </td>
                    <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700', color: '#000000' }}>
                      ₹{(isNonGst ? (Number(invoice.subTotal || invoice.subtotal) || totalTaxableAmount) : totalTaxableAmount).toFixed(2)}
                    </td>
                  </tr>
                  {!isNonGst && !isInterState && (
                    <>
                      <tr>
                        <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>CGST</td>
                        <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700', color: '#000000' }}>₹{totalCgst.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>SGST</td>
                        <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700', color: '#000000' }}>₹{totalSgst.toFixed(2)}</td>
                      </tr>
                    </>
                  )}
                  {!isNonGst && isInterState && (
                    <tr>
                      <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>IGST</td>
                      <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700', color: '#000000' }}>₹{totalIgst.toFixed(2)}</td>
                    </tr>
                  )}
                  {Number(invoice.discount || 0) > 0 && (
                    <tr>
                      <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', color: '#059669', fontWeight: '600' }}>Discount</td>
                      <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700', color: '#059669' }}>-₹{Number(invoice.discount).toFixed(2)}</td>
                    </tr>
                  )}
                  {Number(invoice.roundOff || 0) !== 0 && (
                    <tr>
                      <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>Round Off</td>
                      <td style={{ padding: '1px 5px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700', color: '#000000' }}>
                        {Number(invoice.roundOff) > 0 ? `+₹${Number(invoice.roundOff).toFixed(2)}` : `-₹${Math.abs(Number(invoice.roundOff)).toFixed(2)}`}
                      </td>
                    </tr>
                  )}
                  {/* PROMINENT BOLD TOTAL AMOUNT ROW */}
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #000000', borderBottom: '2px solid #000000' }}>
                    <td style={{ 
                      padding: paperFormat === 'A5' ? '3px 6px' : '5px 8px', 
                      fontWeight: '900', 
                      fontSize: paperFormat === 'A5' ? '0.88rem' : '1.05rem', 
                      color: '#000000',
                      letterSpacing: '0.3px',
                      textTransform: 'uppercase'
                    }}>
                      TOTAL AMOUNT
                    </td>
                    <td style={{ 
                      padding: paperFormat === 'A5' ? '3px 6px' : '5px 8px', 
                      textAlign: 'right', 
                      fontWeight: '900', 
                      fontSize: paperFormat === 'A5' ? '1.15rem' : '1.35rem', 
                      color: '#000000',
                      letterSpacing: '0.5px'
                    }}>
                      ₹{(Number(invoice.grandTotal) || 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ padding: '3px 6px', textAlign: 'right' }}>
                <div style={{ fontSize: paperFormat === 'A5' ? '0.60rem' : '0.68rem', fontWeight: '700', color: '#334155' }}>
                  For {business?.name || 'JAI MAA SHARDEY ENTERPRISES'}
                </div>
                <div style={{ height: paperFormat === 'A5' ? '8px' : '14px' }}></div>
                <div style={{ 
                  borderTop: '1px solid #000000', 
                  display: 'inline-block', 
                  paddingTop: '2px', 
                  paddingLeft: '14px',
                  fontWeight: '800',
                  color: '#000000',
                  fontSize: paperFormat === 'A5' ? '0.62rem' : '0.70rem'
                }}>
                  Authorized Signatory
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* SECTION 5: STATUTORY BANK DETAILS & VISIT AGAIN FOOTER */}
          {/* ========================================================= */}
          <div style={{ 
            marginTop: '2px',
            border: '1px solid #000000', 
            background: '#f8fafc', 
            padding: paperFormat === 'A5' ? '1.5px 6px' : '3px 8px', 
            fontSize: paperFormat === 'A5' ? '0.62rem' : '0.72rem',
            color: '#334155',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <div>
              Bank: <strong>{business?.bankName || 'State Bank of India'}</strong> | A/c No: <strong>{business?.accountNo || '389201009823'}</strong> | IFSC: <strong>{business?.ifscCode || 'SBIN0001420'}</strong>
            </div>
            <div style={{ fontStyle: 'italic', fontWeight: '700', color: '#000000' }}>
              Thank you for shopping with us!
            </div>
          </div>
        </div>
        )}

      </div>
    </div>

    {/* Inline Edit Bill Panel */}
    {editMode && (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflow: 'auto', padding: '24px', border: '1px solid var(--border-color)' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} color="#d97706" />
                Edit Bill — {editInvoiceNo || invoice.invoiceNo}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>You can update items, party, payment, or invoice number. Changes save instantly.</div>
            </div>
            <button onClick={() => setEditMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>

          {/* Top Row: Invoice Number & Customer / Party */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Invoice Number (Customizable)
              </label>
              <input
                type="text"
                className="input-field"
                value={editInvoiceNo}
                onChange={e => setEditInvoiceNo(e.target.value)}
                placeholder="e.g. 155 or INV-155"
                style={{ fontWeight: '700' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Customer / Party
              </label>
              <select
                className="input-field"
                value={editPartyId}
                onChange={e => {
                  const p = fetchParties().find(x => x.id === e.target.value);
                  setEditPartyId(e.target.value);
                  if (p) setEditCustomerName(p.name);
                }}
                style={{ marginBottom: '6px' }}
              >
                <option value="">-- Cash Customer --</option>
                {fetchParties().map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {!editPartyId && (
                <input
                  className="input-field"
                  placeholder="Customer name (optional)"
                  value={editCustomerName}
                  onChange={e => setEditCustomerName(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Items Table */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Items</label>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: '80px' }}>Qty</th>
                    <th style={{ padding: '8px', textAlign: 'right', width: '100px' }}>Rate (₹)</th>
                    <th style={{ padding: '8px', textAlign: 'right', width: '90px' }}>Total</th>
                    <th style={{ padding: '8px', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px', fontWeight: '600', color: 'var(--text-main)' }}>
                        {item.name || item.productName}
                        {item.hsn && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HSN: {item.hsn}</div>}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editItems];
                              updated[idx] = { ...updated[idx], qty: Math.max(1, (Number(updated[idx].qty) || 1) - 1) };
                              setEditItems(updated);
                            }}
                            style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={e => {
                              const updated = [...editItems];
                              updated[idx] = { ...updated[idx], qty: Number(e.target.value) || 1 };
                              setEditItems(updated);
                            }}
                            style={{ width: '44px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.84rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editItems];
                              updated[idx] = { ...updated[idx], qty: (Number(updated[idx].qty) || 1) + 1 };
                              setEditItems(updated);
                            }}
                            style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '6px' }}>
                        <input
                          type="number"
                          value={item.price}
                          onChange={e => {
                            const updated = [...editItems];
                            updated[idx] = { ...updated[idx], price: Number(e.target.value) || 0 };
                            setEditItems(updated);
                          }}
                          style={{ width: '90px', textAlign: 'right', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.84rem' }}
                        />
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                        ₹{((Number(item.price) || 0) * (Number(item.qty) || 0)).toFixed(2)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Product from inventory */}
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="input-field"
                style={{ flex: 1, minWidth: '200px' }}
                value=""
                onChange={e => {
                  if (!e.target.value) return;
                  const prod = fetchProducts().find(p => p.id === e.target.value);
                  if (prod) {
                    setEditItems([...editItems, {
                      productId: prod.id,
                      name: prod.name,
                      hsn: prod.hsn || '',
                      price: prod.salePrice || prod.mrp || 0,
                      qty: 1,
                      unit: prod.unit || 'Pcs',
                      gstRate: prod.gstRate || 0,
                      mrp: prod.mrp || 0,
                      pcsPerCarton: prod.pcsPerCarton || 24,
                      total: prod.salePrice || 0
                    }]);
                  }
                  e.target.value = '';
                }}
              >
                <option value="">+ Add product from inventory...</option>
                {fetchProducts().map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.salePrice}</option>)}
              </select>
            </div>
          </div>

          {/* Payment */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Payment Status</label>
              <select className="input-field" value={editPaymentStatus} onChange={e => setEditPaymentStatus(e.target.value)}>
                <option value="PAID">PAID</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PARTIAL">PARTIAL</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Payment Mode</label>
              <select className="input-field" value={editPaymentMode} onChange={e => setEditPaymentMode(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="NEFT">NEFT / Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            {editPaymentStatus === 'PARTIAL' && (
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Amount Paid (₹)</label>
                <input type="number" className="input-field" value={editPaidAmount} onChange={e => setEditPaidAmount(e.target.value)} />
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Notes</label>
              <input type="text" className="input-field" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Optional note..." />
            </div>
          </div>

          {/* Grand Total Preview */}
          <div style={{ padding: '12px 16px', background: 'rgba(5,150,105,0.08)', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>New Grand Total:</span>
            <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary)' }}>
              ₹{editItems.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0).toFixed(2)}
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setEditMode(false)} className="btn btn-secondary">Cancel</button>
            <button
              onClick={handleSaveEdit}
              className="btn btn-primary"
              style={{ gap: '6px', display: 'flex', alignItems: 'center' }}
            >
              <Save size={16} />
              Update Bill
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
