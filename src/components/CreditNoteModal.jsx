import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  MessageSquare, 
  X, 
  HardDrive, 
  FileText
} from 'lucide-react';
import { uploadInvoiceToGoogleDrive } from '../utils/googleDriveService';
import { fetchBusinessInfo, fetchInvoices } from '../utils/storage';

// Number to Words in Title Case format (e.g. Rupees Sixteen Thousand Seven Hundred Seventy Five Only)
function numToWordsTitleCase(num) {
  if (!num || isNaN(num) || Number(num) === 0) return 'Rupees Zero Only';
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

    if (crore) str += (a[crore] || b[Math.floor(crore / 10)] + a[crore % 10]) + 'Crore ';
    if (lakh) str += (a[lakh] || b[Math.floor(lakh / 10)] + a[lakh % 10]) + 'Lakh ';
    if (thousand) str += (a[thousand] || b[Math.floor(thousand / 10)] + a[thousand % 10]) + 'Thousand ';
    if (hundred) str += (a[hundred] || b[Math.floor(hundred / 10)] + a[hundred % 10]) + 'Hundred ';
    if (rest) str += (str ? 'and ' : '') + (a[rest] || b[Math.floor(rest / 10)] + a[rest % 10]);

    return str.trim();
  }

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);
  let words = 'Rupees ' + (inWords(integerPart) || 'Zero');
  if (decimalPart > 0) {
    words += ' and ' + (inWords(decimalPart) || decimalPart) + ' Paise';
  }
  return words + ' Only';
}

function formatDateDDMMYYYY(dateVal) {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch (e) {
    return String(dateVal);
  }
}

export default function CreditNoteModal({ isOpen, onClose, returnData, invoiceData, business, party }) {
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [driveUploaded, setDriveUploaded] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!isOpen || (!returnData && !invoiceData)) return null;

  const biz = business || fetchBusinessInfo() || {};
  const allInvoices = fetchInvoices ? fetchInvoices() : [];

  const bizName = biz.name || 'PREETI ENTERPRISES';
  const bizGstin = biz.gstin || '07GHQPD6817P1ZI';
  const bizPan = biz.pan || (bizGstin && bizGstin.length >= 12 ? bizGstin.substring(2, 12) : 'GHQPD6817P');
  const bizPhone = biz.phone || '9871789615';
  
  // Format business address into 2 lines
  const rawBizAddr = biz.address || 'Building No.:plot No.78 A, Kh No., 29/24 Road Agar Nagar Prem Nagar\nNear by Chanchal Hospital, New Delhi 110086';
  const addrLines = rawBizAddr.split(/\n|\r\n/);
  const bizAddrLine1 = addrLines[0] || rawBizAddr;
  const bizAddrLine2 = addrLines.slice(1).join(', ') || '';

  // Credit Note Numbers & Dates
  const cnNumber = returnData?.creditNoteNo || invoiceData?.invoiceNo || 'CN/2026/001';
  const cnDateRaw = returnData?.creditNoteDate || returnData?.date || invoiceData?.date || new Date().toISOString();
  const cnDateFormatted = formatDateDDMMYYYY(cnDateRaw);

  const originalInvNo = returnData?.invoiceNo || returnData?.originalInvoiceNo || invoiceData?.reversalOf || '-';
  const parentInv = allInvoices.find(i => i.invoiceNo === originalInvNo || i.id === returnData?.invoiceId);
  const orgInvDateRaw = parentInv?.date || returnData?.originalInvoiceDate || returnData?.invoiceDate || '';
  const orgInvDateFormatted = orgInvDateRaw ? formatDateDDMMYYYY(orgInvDateRaw) : cnDateFormatted;

  // Party Details
  const customerName = returnData?.customerName || invoiceData?.customerName || invoiceData?.partyName || party?.name || 'Customer';
  const customerAddress = party?.address || returnData?.customerAddress || invoiceData?.partyAddress || '';
  const customerGstin = party?.gstin || returnData?.customerGstin || invoiceData?.partyGstin || '';
  const customerPhone = party?.phone || returnData?.customerPhone || invoiceData?.partyPhone || '';

  // Items processing
  const rawItems = Array.isArray(returnData?.items) && returnData.items.length > 0
    ? returnData.items
    : (Array.isArray(invoiceData?.items) ? invoiceData.items : []);

  const defaultGstRate = rawItems[0]?.gstRate !== undefined ? Number(rawItems[0].gstRate) : 5;

  const processedItems = rawItems.map((it, idx) => {
    const qty = Number(it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : 1)) || 0;
    const unit = it.unit || 'PCS';
    const hsn = it.hsn || it.hsnCode || '21069099';
    const taxRate = Number(it.taxRate !== undefined ? it.taxRate : (it.gstRate !== undefined ? it.gstRate : defaultGstRate)) || 0;
    const cgstRatePercent = Number((taxRate / 2).toFixed(2));
    const sgstRatePercent = Number((taxRate / 2).toFixed(2));

    let itemTotal = Number(it.amount !== undefined ? it.amount : (it.total !== undefined ? it.total : 0));
    let unitPrice = Number(it.unitPrice !== undefined ? it.unitPrice : (it.salePrice || it.rate || it.price || 0));

    if (!itemTotal && unitPrice && qty) {
      itemTotal = qty * unitPrice * (1 + taxRate / 100);
    }

    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let basicPrice = 0;

    if (itemTotal > 0) {
      taxableAmount = taxRate > 0 ? Number((itemTotal / (1 + taxRate / 100)).toFixed(2)) : itemTotal;
      const totalTax = Number((itemTotal - taxableAmount).toFixed(2));
      cgstAmount = Number((totalTax / 2).toFixed(2));
      sgstAmount = Number((totalTax - cgstAmount).toFixed(2));
      basicPrice = qty > 0 ? Number((taxableAmount / qty).toFixed(2)) : 0;
    } else if (unitPrice > 0 && qty > 0) {
      basicPrice = unitPrice;
      taxableAmount = Number((qty * basicPrice).toFixed(2));
      cgstAmount = Number((taxableAmount * (cgstRatePercent / 100)).toFixed(2));
      sgstAmount = Number((taxableAmount * (sgstRatePercent / 100)).toFixed(2));
      itemTotal = Number((taxableAmount + cgstAmount + sgstAmount).toFixed(2));
    }

    return {
      sn: idx + 1,
      name: it.productName || it.name || 'Item',
      hsn,
      qty,
      unit,
      basicPrice,
      cgstRatePercent,
      cgstAmount,
      sgstRatePercent,
      sgstAmount,
      taxableAmount,
      taxRate,
      itemTotal
    };
  });

  const totalItemAmount = processedItems.reduce((acc, it) => acc + it.itemTotal, 0);
  const totalQty = processedItems.reduce((acc, it) => acc + it.qty, 0);
  const grandTotal = Number(returnData?.totalAmount || invoiceData?.grandTotal || totalItemAmount);

  const rawTotal = totalItemAmount > 0 ? totalItemAmount : grandTotal;
  const roundedGrandTotal = Math.round(rawTotal);
  const roundOffVal = Number((roundedGrandTotal - rawTotal).toFixed(2));

  // Group by HSN for Tax Summary table
  const hsnGroups = {};
  processedItems.forEach(it => {
    const key = `${it.hsn}_${it.taxRate}`;
    if (!hsnGroups[key]) {
      hsnGroups[key] = {
        hsn: it.hsn,
        taxRate: it.taxRate,
        taxableAmt: 0,
        cgstAmt: 0,
        sgstAmt: 0,
        totalTax: 0
      };
    }
    hsnGroups[key].taxableAmt += it.taxableAmount;
    hsnGroups[key].cgstAmt += it.cgstAmount;
    hsnGroups[key].sgstAmt += it.sgstAmount;
    hsnGroups[key].totalTax += (it.cgstAmount + it.sgstAmount);
  });
  const hsnSummaryList = Object.values(hsnGroups);

  // Pad empty rows to maintain professional Tally/Busy paper form height
  const minRows = 8;
  const emptyRowsCount = Math.max(0, minRows - processedItems.length);

  const handlePrint = () => {
    const origTitle = document.title;
    document.title = `Credit_Note_${cnNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    window.print();
    document.title = origTitle;
  };

  const handleDownloadPdf = async () => {
    const printArea = document.getElementById('printable-credit-note');
    if (!printArea) return;
    setDownloadingPdf(true);

    const safeTitle = `Credit_Note_${cnNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    try {
      let html2pdfLib = window.html2pdf;
      if (!html2pdfLib) {
        try {
          const mod = await import('html2pdf.js');
          html2pdfLib = mod.default || mod;
        } catch (e) {
          console.warn('html2pdf module import fallback:', e);
        }
      }

      if (!html2pdfLib) {
        // Dynamic CDN fallback
        await new Promise((resolve, reject) => {
          if (window.html2pdf) return resolve(window.html2pdf);
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = () => resolve(window.html2pdf);
          script.onerror = reject;
          document.head.appendChild(script);
        });
        html2pdfLib = window.html2pdf;
      }

      if (html2pdfLib) {
        const opt = {
          margin: [8, 8, 8, 8],
          filename: `${safeTitle}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2, 
            useCORS: true, 
            letterRendering: true,
            backgroundColor: '#ffffff'
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdfLib().set(opt).from(printArea).save();
      } else {
        handlePrint();
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      handlePrint();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleShareWhatsApp = () => {
    const itemsList = processedItems.map(it => `• ${it.name} (${it.qty.toFixed(2)} ${it.unit}) - ₹${it.itemTotal.toFixed(2)}`).join('\n');
    
    const msg = `*GST CREDIT NOTE* 📄\n` +
      `*${bizName}*\n` +
      `GSTIN: ${bizGstin}\n` +
      `-----------------------------------------\n` +
      `Party: *${customerName}*\n` +
      `Cr. Note No: *${cnNumber}*\n` +
      `Cr. Note Date: *${cnDateFormatted}*\n` +
      `Org. Inv. No: *${originalInvNo}*\n` +
      `Org. Inv. Date: *${orgInvDateFormatted}*\n\n` +
      `*Items Returned:* \n${itemsList}\n\n` +
      `*Grand Total:* *₹${roundedGrandTotal.toFixed(2)}*\n` +
      `(${numToWordsTitleCase(roundedGrandTotal)})\n\n` +
      `Ledger balance has been credited accordingly.\n` +
      `-----------------------------------------\n` +
      `*${bizName}*`;

    const cleanPhone = (customerPhone || '').replace(/[^0-9]/g, '');
    const waUrl = cleanPhone.length >= 10
      ? `https://api.whatsapp.com/send?phone=${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(waUrl, '_blank');
  };

  const handleUploadToDrive = async () => {
    setUploadingDrive(true);
    try {
      const creditNoteDoc = {
        invoiceNo: cnNumber,
        customerName: customerName,
        partyName: customerName,
        partyAddress: customerAddress,
        partyGstin: customerGstin,
        partyPhone: customerPhone,
        date: cnDateRaw,
        grandTotal: roundedGrandTotal,
        taxTotal: processedItems.reduce((acc, it) => acc + it.cgstAmount + it.sgstAmount, 0),
        taxableSubtotal: processedItems.reduce((acc, it) => acc + it.taxableAmount, 0),
        placeOfSupply: 'Delhi (07)',
        paymentTerms: 'Credit Adjustment',
        items: processedItems.map(it => ({
          name: it.name,
          qty: it.qty,
          unit: it.unit,
          price: it.basicPrice,
          total: it.itemTotal,
          gstRate: it.taxRate,
          hsn: it.hsn
        })),
        documentType: 'out_refund'
      };
      const res = await uploadInvoiceToGoogleDrive(creditNoteDoc, biz);
      if (res && res.success) {
        setDriveUploaded(true);
        alert(`🎉 Success!\n\nCredit Note #${cnNumber} has been uploaded to your Google Drive folder.`);
      } else {
        alert(res?.error || 'Saved in queue. Will auto-sync to Google Drive.');
      }
    } catch(err) {
      alert('Error uploading to Drive: ' + err.message);
    } finally {
      setUploadingDrive(false);
    }
  };

  return (
    <div 
      className="credit-note-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="credit-note-container"
        style={{
          width: '100%',
          maxWidth: '860px',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '94vh'
        }}
      >
        {/* Top Control Bar (Hidden during Print) */}
        <div 
          className="no-print"
          style={{
            padding: '10px 18px',
            background: '#1e293b',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#93c5fd" />
            <span style={{ fontWeight: '700', fontSize: '0.92rem' }}>
              Credit Note: {cnNumber}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '6px' }}>
              (Against Bill #{originalInvNo})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
              title="Print Credit Note (Ctrl + P)"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: downloadingPdf ? 'wait' : 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
              }}
              title="Download as PDF file (.pdf)"
            >
              <Download size={14} />
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
              title="Share on WhatsApp"
            >
              <MessageSquare size={14} />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleUploadToDrive}
              disabled={uploadingDrive}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: driveUploaded ? '#059669' : '#334155',
                color: '#ffffff',
                border: '1px solid #475569',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: uploadingDrive ? 'not-allowed' : 'pointer'
              }}
              title="Save to Connected Google Drive Folder"
            >
              <HardDrive size={14} />
              <span>{uploadingDrive ? 'Saving...' : driveUploaded ? 'Saved ✓' : 'Save to Drive'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close Modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#f1f5f9' }}>
          <div 
            id="printable-credit-note"
            style={{
              background: '#ffffff',
              border: '1px solid #000000',
              padding: '16px 20px',
              maxWidth: '800px',
              margin: '0 auto',
              color: '#000000',
              fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
              fontSize: '11px',
              lineHeight: 1.35
            }}
          >
            {/* 1. Header Top Row: GSTIN (Left) | Pre-auth / Copy (Right) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 'bold' }}>
                GSTIN : {bizGstin}
              </div>
              <div style={{ textAlign: 'right', fontSize: '10.5px', lineHeight: 1.3 }}>
                <div>Original Copy</div>
                <div>Pre Authenticated by</div>
                <div style={{ marginTop: '2px', fontWeight: 'bold' }}>for {bizName}</div>
              </div>
            </div>

            {/* 2. Header Center: Title, Company Name, Address, PAN, Tel */}
            <div style={{ textAlign: 'center', marginTop: '-12px', marginBottom: '10px' }}>
              <div style={{ textDecoration: 'underline', fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' }}>
                Credit Note
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px' }}>
                {bizName}
              </div>
              <div style={{ fontSize: '10.5px' }}>{bizAddrLine1}</div>
              {bizAddrLine2 && <div style={{ fontSize: '10.5px' }}>{bizAddrLine2}</div>}
              <div style={{ fontSize: '10.5px' }}>PAN : {bizPan}</div>
              <div style={{ fontSize: '10.5px' }}>Tel. : {bizPhone}</div>
            </div>

            {/* 3. Divider Line */}
            <div style={{ borderTop: '1px solid #000000', margin: '0 -20px 0 -20px' }}></div>

            {/* 4. Party Details (Left) & Credit Note Meta Details (Right) */}
            <div style={{ display: 'flex', margin: '0 -20px', borderBottom: '1px solid #000000', minHeight: '110px' }}>
              {/* Left Column: Party Details */}
              <div style={{ width: '58%', padding: '8px 16px', fontSize: '10.5px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Party Details :</div>
                <div style={{ fontWeight: 'bold', fontSize: '11.5px', textTransform: 'uppercase' }}>
                  {customerName}
                </div>
                {customerAddress ? (
                  <div style={{ whiteSpace: 'pre-line', marginTop: '2px' }}>
                    {customerAddress}
                  </div>
                ) : (
                  <div>Local Market, Delhi</div>
                )}
                <div style={{ fontWeight: 'bold', marginTop: '4px' }}>
                  GSTIN / UIN : {customerGstin || 'Unregistered'}
                </div>
              </div>

              {/* Right Column: Cr. Note No & Dates */}
              <div style={{ width: '42%', borderLeft: '1px solid #000000', padding: '8px 14px', fontSize: '10.5px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 0', width: '92px' }}>Cr. Note No.</td>
                      <td style={{ border: 'none', padding: '2px 4px', width: '10px' }}>:</td>
                      <td style={{ border: 'none', padding: '2px 0', fontWeight: 'bold' }}>{cnNumber}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 0' }}>Cr. Note Date</td>
                      <td style={{ border: 'none', padding: '2px 4px' }}>:</td>
                      <td style={{ border: 'none', padding: '2px 0' }}>{cnDateFormatted}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 0' }}>Org. Inv. No.</td>
                      <td style={{ border: 'none', padding: '2px 4px' }}>:</td>
                      <td style={{ border: 'none', padding: '2px 0', fontWeight: 'bold' }}>{originalInvNo}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 0' }}>Org. Inv. Date</td>
                      <td style={{ border: 'none', padding: '2px 4px' }}>:</td>
                      <td style={{ border: 'none', padding: '2px 0' }}>{orgInvDateFormatted}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Main Items Table (11 Columns exactly matching user template) */}
            <div style={{ margin: '0 -20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', fontSize: '10px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000000' }}>
                    <th style={{ width: '32px', textAlign: 'center', borderRight: '1px solid #000000', padding: '5px 2px' }}>S.N.</th>
                    <th style={{ textAlign: 'left', borderRight: '1px solid #000000', padding: '5px 6px' }}>Description of Goods</th>
                    <th style={{ width: '70px', textAlign: 'center', borderRight: '1px solid #000000', padding: '5px 2px' }}>HSN/SAC<br />Code</th>
                    <th style={{ width: '48px', textAlign: 'right', borderRight: '1px solid #000000', padding: '5px 4px' }}>Qty.</th>
                    <th style={{ width: '40px', textAlign: 'center', borderRight: '1px solid #000000', padding: '5px 2px' }}>Unit</th>
                    <th style={{ width: '62px', textAlign: 'right', borderRight: '1px solid #000000', padding: '5px 4px' }}>Price</th>
                    <th style={{ width: '46px', textAlign: 'center', borderRight: '1px solid #000000', padding: '5px 2px' }}>CGST<br />Rate</th>
                    <th style={{ width: '56px', textAlign: 'right', borderRight: '1px solid #000000', padding: '5px 4px' }}>CGST<br />Amount</th>
                    <th style={{ width: '46px', textAlign: 'center', borderRight: '1px solid #000000', padding: '5px 2px' }}>SGST<br />Rate</th>
                    <th style={{ width: '56px', textAlign: 'right', borderRight: '1px solid #000000', padding: '5px 4px' }}>SGST<br />Amount</th>
                    <th style={{ width: '75px', textAlign: 'right', padding: '5px 6px' }}>Amount(` )</th>
                  </tr>
                </thead>
                <tbody>
                  {processedItems.map((item, idx) => (
                    <tr key={idx} style={{ height: '22px' }}>
                      <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '3px 2px' }}>{item.sn}.</td>
                      <td style={{ textAlign: 'left', borderRight: '1px solid #000000', padding: '3px 6px' }}>{item.name}</td>
                      <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '3px 2px' }}>{item.hsn}</td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '3px 4px' }}>{item.qty.toFixed(2)}</td>
                      <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '3px 2px' }}>{item.unit}</td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '3px 4px' }}>{item.basicPrice.toFixed(2)}</td>
                      <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '3px 2px' }}>{item.cgstRatePercent.toFixed(1)} %</td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '3px 4px' }}>{item.cgstAmount.toFixed(2)}</td>
                      <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '3px 2px' }}>{item.sgstRatePercent.toFixed(1)} %</td>
                      <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '3px 4px' }}>{item.sgstAmount.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 6px' }}>
                        {item.itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}

                  {/* Empty Spacer Rows for professional form height */}
                  {Array.from({ length: emptyRowsCount }).map((_, i) => (
                    <tr key={`empty_${i}`} style={{ height: '22px' }}>
                      <td style={{ borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td style={{ borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td style={{ borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td style={{ borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td style={{ borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td style={{ borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td style={{ borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td style={{ borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td style={{ borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td style={{ borderRight: '1px solid #000000' }}>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  ))}

                  {/* Subtotal of items */}
                  <tr style={{ borderTop: '1px solid #000000' }}>
                    <td colSpan="10" style={{ borderRight: '1px solid #000000', borderBottom: 'none' }}></td>
                    <td style={{ textAlign: 'right', padding: '4px 6px', fontWeight: '500' }}>
                      {rawTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Round Off Row */}
                  <tr>
                    <td colSpan="8" style={{ borderRight: 'none', borderBottom: 'none' }}></td>
                    <td colSpan="2" style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '3px 6px', fontSize: '9.5px' }}>
                      {roundOffVal >= 0 ? 'Add  : Rounded Off (+)' : 'Less : Rounded Off (-)'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '3px 6px', fontSize: '9.5px' }}>
                      {Math.abs(roundOffVal).toFixed(2)}
                    </td>
                  </tr>

                  {/* Grand Total Row */}
                  <tr style={{ borderTop: '1px solid #000000', borderBottom: '1px solid #000000', fontWeight: 'bold' }}>
                    <td colSpan="3" style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '4px 6px' }}>
                      Grand Total
                    </td>
                    <td style={{ textAlign: 'right', borderRight: '1px solid #000000', padding: '4px 4px' }}>
                      {totalQty.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', borderRight: '1px solid #000000', padding: '4px 2px' }}>
                      {processedItems[0]?.unit || 'PCS'}
                    </td>
                    <td colSpan="5" style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ textAlign: 'right', padding: '4px 6px', fontSize: '11px' }}>
                      ₹ {roundedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 6. HSN/SAC Tax Summary Table */}
            <div style={{ marginTop: '14px', marginBottom: '8px' }}>
              <table style={{ width: '70%', borderCollapse: 'collapse', border: 'none', fontSize: '9.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000000' }}>
                    <th style={{ textAlign: 'left', padding: '3px 4px', borderBottom: '1px solid #000000' }}>HSN/SAC</th>
                    <th style={{ textAlign: 'center', padding: '3px 4px', borderBottom: '1px solid #000000' }}>Tax Rate</th>
                    <th style={{ textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #000000' }}>Taxable Amt.</th>
                    <th style={{ textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #000000' }}>CGST Amt.</th>
                    <th style={{ textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #000000' }}>SGST Amt.</th>
                    <th style={{ textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #000000' }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnSummaryList.map((h, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'left', padding: '3px 4px' }}>{h.hsn}</td>
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>{h.taxRate}%</td>
                      <td style={{ textAlign: 'right', padding: '3px 4px' }}>
                        {h.taxableAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', padding: '3px 4px' }}>
                        {h.cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', padding: '3px 4px' }}>
                        {h.sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', padding: '3px 4px' }}>
                        {h.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 7. Rupees in Words */}
            <div style={{ marginTop: '6px', marginBottom: '14px', fontSize: '10.5px', fontWeight: 'bold' }}>
              {numToWordsTitleCase(roundedGrandTotal)}
            </div>

            {/* 8. Bottom Footer (Terms, Receiver Sign, and Authorized Signatory) */}
            <div style={{ borderTop: '1px solid #000000', margin: '0 -20px 0 -20px' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '8px -10px 0 -10px', fontSize: '10px' }}>
              <div style={{ width: '32%', padding: '0 10px' }}>
                <div style={{ textDecoration: 'underline', fontWeight: 'bold' }}>Terms & Conditions</div>
                <div style={{ marginTop: '2px' }}>E.& O.E.</div>
              </div>

              <div style={{ width: '33%', textAlign: 'left', padding: '0 10px' }}>
                <div>Receiver's Signature :</div>
              </div>

              <div style={{ width: '35%', textAlign: 'right', padding: '0 10px' }}>
                <div style={{ fontWeight: 'bold' }}>for {bizName}</div>
                <div style={{ height: '48px' }}></div>
                <div style={{ fontWeight: 'bold' }}>Authorised Signatory</div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Print Specific CSS */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body * {
            visibility: hidden;
          }
          .credit-note-modal-overlay {
            position: absolute !important;
            inset: 0 !important;
            background: #ffffff !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .credit-note-container {
            max-width: 100% !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          #printable-credit-note, #printable-credit-note * {
            visibility: visible !important;
          }
          #printable-credit-note {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            border: 1px solid #000000 !important;
            padding: 14px 18px !important;
          }
        }
      `}</style>
    </div>
  );
}
