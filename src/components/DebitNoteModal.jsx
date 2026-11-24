import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  MessageSquare, 
  X, 
  HardDrive, 
  FileText,
  Building2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { uploadInvoiceToGoogleDrive } from '../utils/googleDriveService';
import { fetchBusinessInfo, fetchPurchases, fetchSuppliers } from '../utils/storage';

// Number to Words in Title Case format
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

export default function DebitNoteModal({ isOpen, onClose, debitNote, business, vendor }) {
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [driveUploaded, setDriveUploaded] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!isOpen || !debitNote) return null;

  const biz = business || fetchBusinessInfo() || {};
  const allSuppliers = fetchSuppliers ? fetchSuppliers() : [];
  const allPurchases = fetchPurchases ? fetchPurchases() : [];

  const bizName = biz.name || 'JAI MAA SHARDEY ENTERPRISES';
  const bizGstin = biz.gstin || '07GHQPD6817P1ZI';
  const bizPan = biz.pan || (bizGstin && bizGstin.length >= 12 ? bizGstin.substring(2, 12) : 'GHQPD6817P');
  const bizPhone = biz.phone || '9871789615';

  const rawBizAddr = biz.address || 'Plot No. 78 A, Prem Nagar, Near Chanchal Hospital, New Delhi 110086';
  const addrLines = rawBizAddr.split(/\n|\r\n/);
  const bizAddrLine1 = addrLines[0] || rawBizAddr;
  const bizAddrLine2 = addrLines.slice(1).join(', ') || '';

  // Vendor Details
  const vendorRecord = vendor || allSuppliers.find(s => s.id === debitNote.vendor_id || s.id === debitNote.supplierId) || {};
  const vendorName = debitNote.vendor_name || debitNote.supplierName || vendorRecord.name || 'Vendor / Manufacturer';
  const vendorGstin = vendorRecord.gstin || debitNote.vendorGstin || debitNote.supplierGstin || 'URP';
  const vendorAddress = vendorRecord.address || debitNote.vendorAddress || '';
  const vendorPhone = vendorRecord.phone || debitNote.vendorPhone || '';
  const vendorState = vendorRecord.state || 'Delhi (07)';

  // Debit Note Metadata
  const dnNumber = debitNote.debit_note_number || debitNote.debitNoteNo || 'DN-0001';
  const dnDateFormatted = formatDateDDMMYYYY(debitNote.return_date || debitNote.date);

  const orgBillNo = debitNote.originalBillNo || debitNote.original_bill_no || '-';
  const linkedPurchase = allPurchases.find(p => p.id === debitNote.purchase_bill_id || p.billNo === orgBillNo);
  const orgBillDateRaw = linkedPurchase?.date || debitNote.originalBillDate || '';
  const orgBillDateFormatted = orgBillDateRaw ? formatDateDDMMYYYY(orgBillDateRaw) : '-';

  const returnReason = debitNote.reason || 'Expired Stock';
  const noteStatus = debitNote.status || 'Open';
  const unusedBalance = Number(debitNote.remaining_credit_balance !== undefined ? debitNote.remaining_credit_balance : debitNote.total_credit_amount || 0);

  // Line items
  const rawItems = Array.isArray(debitNote.items) ? debitNote.items : [];
  let calculatedSubtotal = 0;
  let calculatedCgst = 0;
  let calculatedSgst = 0;
  let calculatedIgst = 0;
  let calculatedTotal = 0;

  const isInterState = Boolean(debitNote.isInterState || (vendorGstin && bizGstin && vendorGstin.substring(0, 2) !== bizGstin.substring(0, 2)));

  const processedItems = rawItems.map((it, idx) => {
    const qty = Number(it.return_quantity !== undefined ? it.return_quantity : (it.qty || 1)) || 0;
    const unit = it.unit || 'PCS';
    const rate = Number(it.unit_purchase_price !== undefined ? it.unit_purchase_price : (it.purchasePrice || it.rate || 0)) || 0;
    const taxRate = Number(it.tax_rate !== undefined ? it.tax_rate : (it.gstRate || 5)) || 0;
    const hsn = it.hsn_code || it.hsn || '21069099';
    const batchNo = it.batch_number || it.batchNo || '-';
    const expiryDate = it.expiry_date || it.expiryDate || '';

    const taxableAmount = Math.round((qty * rate) * 100) / 100;
    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;
    let taxTotal = 0;

    if (isInterState) {
      igstRate = taxRate;
      igstAmt = Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;
      taxTotal = igstAmt;
    } else {
      cgstRate = Number((taxRate / 2).toFixed(2));
      sgstRate = Number((taxRate / 2).toFixed(2));
      cgstAmt = Math.round(((taxableAmount * cgstRate) / 100) * 100) / 100;
      sgstAmt = Math.round(((taxableAmount * sgstRate) / 100) * 100) / 100;
      taxTotal = Math.round((cgstAmt + sgstAmt) * 100) / 100;
    }

    const itemTotal = Math.round((taxableAmount + taxTotal) * 100) / 100;

    calculatedSubtotal += taxableAmount;
    calculatedCgst += cgstAmt;
    calculatedSgst += sgstAmt;
    calculatedIgst += igstAmt;
    calculatedTotal += itemTotal;

    return {
      sn: idx + 1,
      name: it.productName || it.name || 'Item',
      hsn,
      batchNo,
      expiryDate,
      qty,
      unit,
      basicPrice: rate,
      taxableAmount,
      taxRate,
      cgstRate,
      cgstAmt,
      sgstRate,
      sgstAmt,
      igstRate,
      igstAmt,
      itemTotal
    };
  });

  const finalSubtotal = Number(debitNote.subtotal !== undefined ? debitNote.subtotal : calculatedSubtotal);
  const finalCgst = Number(debitNote.cgst_amount !== undefined ? debitNote.cgst_amount : calculatedCgst);
  const finalSgst = Number(debitNote.sgst_amount !== undefined ? debitNote.sgst_amount : calculatedSgst);
  const finalIgst = Number(debitNote.igst_amount !== undefined ? debitNote.igst_amount : calculatedIgst);
  const finalTotal = Number(debitNote.total_credit_amount !== undefined ? debitNote.total_credit_amount : (debitNote.totalDebitAmount || calculatedTotal));
  const amountInWords = numToWordsTitleCase(finalTotal);

  // Group by HSN for Tax Summary table
  const hsnMap = {};
  processedItems.forEach(it => {
    const key = `${it.hsn}_${it.taxRate}`;
    if (!hsnMap[key]) {
      hsnMap[key] = {
        hsn: it.hsn,
        taxRate: it.taxRate,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0
      };
    }
    hsnMap[key].taxable += it.taxableAmount;
    hsnMap[key].cgst += it.cgstAmt;
    hsnMap[key].sgst += it.sgstAmt;
    hsnMap[key].igst += it.igstAmt;
    hsnMap[key].totalTax += (it.cgstAmt + it.sgstAmt + it.igstAmt);
  });
  const hsnSummaryList = Object.values(hsnMap);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('statutory-debit-note-document');
    if (!element) return;
    setDownloadingPdf(true);

    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const safeFileName = `${bizName.replace(/[^a-zA-Z0-9]/g, '_')}_(DebitNote)_${dnNumber.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

      const opt = {
        margin: [6, 6, 6, 6],
        filename: safeFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2.2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('Debit note PDF generation failed:', err);
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleWhatsAppShare = () => {
    const textMsg = `*DEBIT NOTE / VENDOR RETURN*\nFrom: ${bizName} (GSTIN: ${bizGstin})\nTo: ${vendorName}\nDebit Note No: ${dnNumber}\nDate: ${dnDateFormatted}\nOriginal Bill Ref: ${orgBillNo} (${orgBillDateFormatted})\nTotal Credit Claimed: ₹${finalTotal.toLocaleString('en-IN')}\nReason: ${returnReason}\n\nThis debit note has been recorded and adjusted against our ledger account. Statutory GST Section 17(5)(h) ITC reversal accounted.`;
    const targetPhone = vendorPhone ? vendorPhone.replace(/\D/g, '') : '';
    const cleanPhone = targetPhone.length === 10 ? '91' + targetPhone : targetPhone;
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textMsg)}`
      : `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
    window.open(url, '_blank');
  };

  const handleDriveUpload = async () => {
    const element = document.getElementById('statutory-debit-note-document');
    if (!element) return;
    setUploadingDrive(true);

    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const opt = {
        margin: [6, 6, 6, 6],
        filename: `${dnNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2.0, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        const res = await uploadInvoiceToGoogleDrive({
          invoiceNo: dnNumber,
          partyName: vendorName,
          date: dnDateFormatted,
          total: finalTotal,
          pdfBase64: base64Data
        });

        if (res && res.success) {
          setDriveUploaded(true);
          alert(`🎉 Debit Note #${dnNumber} backed up to Google Drive successfully!`);
        } else {
          alert(`Google Drive Upload: ${res?.message || 'Could not complete upload. Check Drive settings.'}`);
        }
        setUploadingDrive(false);
      };
    } catch (err) {
      console.error(err);
      alert('Error uploading Debit Note to Google Drive: ' + err.message);
      setUploadingDrive(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #statutory-debit-note-document, #statutory-debit-note-document * {
            visibility: visible !important;
          }
          #statutory-debit-note-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        maxWidth: '920px',
        width: '100%',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden'
      }}>
        {/* Modal Action Header */}
        <div className="no-print" style={{
          padding: '14px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0f172a',
          color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="#38bdf8" />
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', letterSpacing: '0.3px' }}>
                Debit Note Document &bull; {dnNumber}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                Issued to: <strong style={{ color: '#ffffff' }}>{vendorName}</strong> | Value: <strong style={{ color: '#4ade80' }}>₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Printer size={15} /> Print
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Download size={15} /> {downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}
            </button>

            <button
              onClick={handleWhatsAppShare}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <MessageSquare size={15} /> WhatsApp
            </button>

            <button
              onClick={handleDriveUpload}
              disabled={uploadingDrive}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: driveUploaded ? '#065f46' : '#1e293b',
                color: driveUploaded ? '#a7f3d0' : '#ffffff',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <HardDrive size={15} /> {uploadingDrive ? 'Saving...' : driveUploaded ? 'Saved in Drive' : 'Drive'}
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                marginLeft: '8px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div style={{
          overflowY: 'auto',
          padding: '24px',
          backgroundColor: '#f1f5f9',
          flex: 1
        }}>
          {/* Statutory Document (A4 Ratio Format) */}
          <div
            id="statutory-debit-note-document"
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #0f172a',
              borderRadius: '4px',
              padding: '20px',
              maxWidth: '840px',
              margin: '0 auto',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '11px',
              color: '#000000',
              boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
              boxSizing: 'border-box'
            }}
          >
            {/* Header Document Type Banner */}
            <div style={{
              textAlign: 'center',
              borderBottom: '2px solid #0f172a',
              paddingBottom: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1px' }}>
                DEBIT NOTE
              </div>
              <div style={{ fontSize: '10px', color: '#334155', fontWeight: '600' }}>
                (Statutory Debit Note Issued under Section 34(3) of CGST Act, 2017 / Rule 53)
              </div>
            </div>

            {/* Issuer (Distributor / Buyer) & Document Metadata Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              borderBottom: '1.5px solid #0f172a',
              paddingBottom: '10px',
              marginBottom: '10px',
              gap: '12px'
            }}>
              {/* Left: Distributor / Issuer Details */}
              <div>
                <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                  Issued By (Buyer / Distributor):
                </div>
                <div style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
                  {bizName}
                </div>
                <div style={{ fontSize: '10.5px', marginTop: '2px', lineHeight: 1.35 }}>
                  {bizAddrLine1}
                  {bizAddrLine2 ? `, ${bizAddrLine2}` : ''}
                </div>
                <div style={{ fontSize: '10.5px', marginTop: '4px', fontWeight: '700' }}>
                  <span>GSTIN: </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{bizGstin}</span>
                  <span style={{ marginLeft: '12px' }}>PAN: </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{bizPan}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#334155' }}>
                  Phone: {bizPhone}
                </div>
              </div>

              {/* Right: Document & Reference Numbers */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '10.5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '700' }}>Debit Note No:</span>
                  <strong style={{ fontSize: '12px', color: '#0f172a', fontFamily: 'monospace' }}>{dnNumber}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '700' }}>Debit Note Date:</span>
                  <strong>{dnDateFormatted}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
                  <span style={{ color: '#475569' }}>Original Purchase Bill #:</span>
                  <strong style={{ fontFamily: 'monospace' }}>{orgBillNo}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#475569' }}>Original Bill Date:</span>
                  <span>{orgBillDateFormatted}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
                  <span style={{ fontWeight: '700' }}>Return Reason:</span>
                  <span style={{ fontWeight: '800', color: '#b91c1c' }}>{returnReason}</span>
                </div>
              </div>
            </div>

            {/* Vendor / Supplier (Recipient) Box */}
            <div style={{
              border: '1.5px solid #0f172a',
              borderRadius: '4px',
              padding: '8px 12px',
              marginBottom: '12px',
              backgroundColor: '#ffffff'
            }}>
              <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                Addressed To (Supplier / Vendor):
              </div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
                {vendorName}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginTop: '3px', fontSize: '10.5px' }}>
                <div>
                  {vendorAddress ? <div>Address: {vendorAddress}</div> : null}
                  <div>Phone: {vendorPhone || '-'}</div>
                </div>
                <div>
                  <div>GSTIN: <strong style={{ fontFamily: 'monospace', fontSize: '11px' }}>{vendorGstin}</strong></div>
                  <div>State & Code: <strong>{vendorState}</strong></div>
                </div>
              </div>
            </div>

            {/* Line Items Table (11 Columns) */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '10px',
              border: '1.5px solid #0f172a',
              marginBottom: '12px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'center' }}>
                  <th style={{ padding: '6px 4px', width: '28px', borderRight: '1px solid #334155' }}>#</th>
                  <th style={{ padding: '6px 6px', textAlign: 'left', borderRight: '1px solid #334155' }}>Description of Returned Goods</th>
                  <th style={{ padding: '6px 4px', width: '60px', borderRight: '1px solid #334155' }}>HSN/SAC</th>
                  <th style={{ padding: '6px 4px', width: '80px', borderRight: '1px solid #334155' }}>Batch / Exp</th>
                  <th style={{ padding: '6px 4px', width: '48px', borderRight: '1px solid #334155' }}>Qty</th>
                  <th style={{ padding: '6px 4px', width: '58px', textAlign: 'right', borderRight: '1px solid #334155' }}>Rate (₹)</th>
                  <th style={{ padding: '6px 4px', width: '64px', textAlign: 'right', borderRight: '1px solid #334155' }}>Taxable (₹)</th>
                  {!isInterState ? (
                    <>
                      <th style={{ padding: '6px 4px', width: '56px', textAlign: 'right', borderRight: '1px solid #334155' }}>CGST</th>
                      <th style={{ padding: '6px 4px', width: '56px', textAlign: 'right', borderRight: '1px solid #334155' }}>SGST</th>
                    </>
                  ) : (
                    <th style={{ padding: '6px 4px', width: '70px', textAlign: 'right', borderRight: '1px solid #334155' }}>IGST</th>
                  )}
                  <th style={{ padding: '6px 6px', width: '75px', textAlign: 'right' }}>Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {processedItems.map((it) => (
                  <tr key={it.sn} style={{ borderBottom: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>{it.sn}</td>
                    <td style={{ padding: '6px 6px', fontWeight: '700', borderRight: '1px solid #e2e8f0' }}>
                      {it.name}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0' }}>
                      {it.hsn}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: '9px', borderRight: '1px solid #e2e8f0' }}>
                      <div>{it.batchNo}</div>
                      {it.expiryDate && <div style={{ color: '#b91c1c' }}>Exp: {it.expiryDate}</div>}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: '700', borderRight: '1px solid #e2e8f0' }}>
                      {it.qty} {it.unit}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>
                      {it.basicPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: '600', borderRight: '1px solid #e2e8f0' }}>
                      {it.taxableAmount.toFixed(2)}
                    </td>
                    {!isInterState ? (
                      <>
                        <td style={{ padding: '6px 4px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>
                          <div>{it.cgstAmt.toFixed(2)}</div>
                          <div style={{ fontSize: '8.5px', color: '#64748b' }}>({it.cgstRate}%)</div>
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>
                          <div>{it.sgstAmt.toFixed(2)}</div>
                          <div style={{ fontSize: '8.5px', color: '#64748b' }}>({it.sgstRate}%)</div>
                        </td>
                      </>
                    ) : (
                      <td style={{ padding: '6px 4px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>
                        <div>{it.igstAmt.toFixed(2)}</div>
                        <div style={{ fontSize: '8.5px', color: '#64748b' }}>({it.igstRate}%)</div>
                      </td>
                    )}
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: '800' }}>
                      {it.itemTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Calculations & Summary Section */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 1fr',
              gap: '12px',
              borderBottom: '1.5px solid #0f172a',
              paddingBottom: '10px',
              marginBottom: '10px'
            }}>
              {/* Left Column: HSN Tax Summary & Amount In Words */}
              <div>
                <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  HSN / Tax Rate Summary (ITC Reversal Breakdown):
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', border: '1px solid #cbd5e1', marginBottom: '8px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'right' }}>
                      <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #cbd5e1' }}>HSN</th>
                      <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>Taxable</th>
                      {!isInterState ? (
                        <>
                          <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>CGST</th>
                          <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>SGST</th>
                        </>
                      ) : (
                        <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>IGST</th>
                      )}
                      <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hsnSummaryList.map((h, i) => (
                      <tr key={i} style={{ textAlign: 'right' }}>
                        <td style={{ padding: '3px 4px', textAlign: 'left', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}>{h.hsn} ({h.taxRate}%)</td>
                        <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1' }}>₹{h.taxable.toFixed(2)}</td>
                        {!isInterState ? (
                          <>
                            <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1' }}>₹{h.cgst.toFixed(2)}</td>
                            <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1' }}>₹{h.sgst.toFixed(2)}</td>
                          </>
                        ) : (
                          <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1' }}>₹{h.igst.toFixed(2)}</td>
                        )}
                        <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1', fontWeight: '700' }}>₹{h.totalTax.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Amount in Words */}
                <div style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '10px' }}>
                  <div style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b' }}>TOTAL AMOUNT IN WORDS:</div>
                  <div style={{ fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{amountInWords}</div>
                </div>
              </div>

              {/* Right Column: Totals & Balance Breakdown */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #0f172a',
                borderRadius: '4px',
                padding: '8px 12px',
                fontSize: '10.5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>Subtotal (Taxable Amount):</span>
                  <strong>₹{finalSubtotal.toFixed(2)}</strong>
                </div>

                {!isInterState ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span>CGST (Input Reversed):</span>
                      <strong>₹{finalCgst.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span>SGST (Input Reversed):</span>
                      <strong>₹{finalSgst.toFixed(2)}</strong>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>IGST (Input Reversed):</span>
                    <strong>₹{finalIgst.toFixed(2)}</strong>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  marginTop: '4px',
                  borderTop: '2px solid #0f172a',
                  borderBottom: '2px solid #0f172a',
                  fontSize: '13px',
                  fontWeight: '900',
                  color: '#0f172a'
                }}>
                  <span>TOTAL DEBIT AMOUNT:</span>
                  <span>₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0 2px 0', fontSize: '10px', color: '#475569' }}>
                  <span>Status / Settlement:</span>
                  <span style={{
                    fontWeight: '800',
                    color: noteStatus === 'Closed' ? '#15803d' : noteStatus === 'Void' ? '#dc2626' : '#2563eb'
                  }}>
                    {noteStatus === 'Closed' ? 'Fully Adjusted' : noteStatus === 'Void' ? 'VOID' : 'Open Credit'}
                  </span>
                </div>

                {noteStatus === 'Open' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '10px' }}>
                    <span style={{ color: '#059669', fontWeight: '700' }}>Available Credit to Apply:</span>
                    <strong style={{ color: '#059669' }}>₹{unusedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Declaration & Signatures */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.6fr 1fr',
              gap: '14px',
              paddingTop: '6px',
              alignItems: 'flex-end'
            }}>
              <div style={{ fontSize: '9px', color: '#475569', lineHeight: 1.45 }}>
                <strong>Statutory Declaration:</strong>
                <div>1. We have debited your ledger account for the sum of ₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} against the returned/claimed goods listed above.</div>
                <div>2. Applicable Input Tax Credit (ITC) reversed under Section 17(5)(h) & Section 34 of the CGST Act, 2017.</div>
                <div>3. This credit is available to adjust against our upcoming purchase bills or via refund.</div>
              </div>

              <div style={{ textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a' }}>For {bizName}</div>
                <div style={{ height: '36px' }}></div>
                <div style={{ fontSize: '9px', fontWeight: '700', borderTop: '1px dashed #94a3b8', paddingTop: '3px' }}>
                  Authorized Signatory / Distributor
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
