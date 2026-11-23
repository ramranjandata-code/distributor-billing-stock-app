import React, { useState } from 'react';
import { 
  Printer, 
  Download, 
  Share2, 
  MessageSquare, 
  X, 
  HardDrive, 
  CheckCircle2, 
  FileText, 
  ArrowLeft, 
  ExternalLink,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { uploadInvoiceToGoogleDrive } from '../utils/googleDriveService';
import { fetchBusinessInfo } from '../utils/storage';

// Number to Words Converter for Indian Currency
function numToWordsIndian(num) {
  if (!num || isNaN(num) || Number(num) === 0) return 'ZERO RUPEES ONLY';
  const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
  const b = ['', '', 'TWENTY ', 'THIRTY ', 'FORTY ', 'FIFTY ', 'SIXTY ', 'SEVENTY ', 'EIGHTY ', 'NINETY '];

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

    if (crore) str += (a[crore] || b[Math.floor(crore / 10)] + a[crore % 10]) + 'CRORE ';
    if (lakh) str += (a[lakh] || b[Math.floor(lakh / 10)] + a[lakh % 10]) + 'LAKH ';
    if (thousand) str += (a[thousand] || b[Math.floor(thousand / 10)] + a[thousand % 10]) + 'THOUSAND ';
    if (hundred) str += (a[hundred] || b[Math.floor(hundred / 10)] + a[hundred % 10]) + 'HUNDRED ';
    if (rest) str += (str ? 'AND ' : '') + (a[rest] || b[Math.floor(rest / 10)] + a[rest % 10]);

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

export default function CreditNoteModal({ isOpen, onClose, returnData, invoiceData, business, party }) {
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [driveUploaded, setDriveUploaded] = useState(false);

  if (!isOpen || (!returnData && !invoiceData)) return null;

  const biz = business || fetchBusinessInfo() || {};
  const cnNumber = returnData?.creditNoteNo || invoiceData?.invoiceNo || 'CN/2026/001';
  const cnDate = returnData?.creditNoteDate || returnData?.date || invoiceData?.date || new Date().toISOString();
  const dateFormatted = new Date(cnDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const originalInvNo = returnData?.invoiceNo || returnData?.originalInvoiceNo || invoiceData?.reversalOf || '-';
  const returnRef = returnData?.returnNumber || 'RMA Return';
  const customerName = returnData?.customerName || invoiceData?.customerName || invoiceData?.partyName || 'Customer';
  const customerAddress = party?.address || returnData?.customerAddress || invoiceData?.partyAddress || 'Local Market';
  const customerGstin = party?.gstin || returnData?.customerGstin || invoiceData?.partyGstin || '';
  const customerPhone = party?.phone || returnData?.customerPhone || invoiceData?.partyPhone || '';

  const items = Array.isArray(returnData?.items) && returnData.items.length > 0
    ? returnData.items
    : (Array.isArray(invoiceData?.items) ? invoiceData.items : []);

  const grandTotal = Number(returnData?.totalAmount || invoiceData?.grandTotal || 0);
  
  // Tax calculation (default 5% GST for confectionery/snacks)
  const gstRate = items[0]?.gstRate !== undefined ? Number(items[0].gstRate) : 5;
  const taxableSubtotal = gstRate > 0 ? Number((grandTotal / (1 + gstRate / 100)).toFixed(2)) : grandTotal;
  const totalTax = Number((grandTotal - taxableSubtotal).toFixed(2));
  const cgst = Number((totalTax / 2).toFixed(2));
  const sgst = Number((totalTax - cgst).toFixed(2));

  const handlePrint = () => {
    const origTitle = document.title;
    document.title = `Credit_Note_${cnNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    window.print();
    document.title = origTitle;
  };

  const handleDownloadHtml = () => {
    const printArea = document.getElementById('printable-credit-note');
    if (!printArea) return;
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Credit Note #${cnNumber} - ${customerName}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #0f172a; background: #ffffff; }
    .cn-card { max-width: 820px; margin: 0 auto; border: 1.5px solid #000000; padding: 20px; box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000000; padding-bottom: 12px; margin-bottom: 14px; }
    .firm-title { font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; }
    .firm-sub { font-size: 11px; color: #334155; margin: 3px 0 0 0; }
    .doc-type { text-align: right; }
    .doc-badge { display: inline-block; padding: 4px 12px; background: #6b21a8; color: #ffffff; font-weight: 900; font-size: 13px; letter-spacing: 1px; border-radius: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; font-size: 11px; }
    .box { border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #faf5ff; }
    .box-title { font-size: 10px; font-weight: 800; color: #6b21a8; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e9d5ff; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    th { background: #581c87; color: #ffffff; padding: 8px 6px; font-size: 10.5px; text-transform: uppercase; }
    td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; }
    .totals-area { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px; padding-top: 10px; border-top: 2px solid #000000; font-size: 11px; }
    .grand-total-box { background: #faf5ff; border: 1.5px solid #6b21a8; padding: 12px 18px; border-radius: 6px; text-align: right; min-width: 220px; }
    .paid-stamp { display: inline-block; padding: 3px 10px; background: #f3e8ff; color: #6b21a8; font-weight: 900; font-size: 11px; border: 1px solid #d8b4fe; border-radius: 4px; margin-top: 6px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
    @media print { body { padding: 0; } .cn-card { border: none; } }
  </style>
</head>
<body>
  ${printArea.innerHTML}
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Credit_Note_${cnNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareWhatsApp = () => {
    const itemsList = items.map((it, idx) => `• ${it.productName || it.name} (${it.quantity || it.qty || 1} ${it.unit || 'Pcs'}) - ₹${Number(it.amount || it.total || 0).toFixed(2)}`).join('\n');
    
    const msg = `*GST CREDIT NOTE* 📄\n` +
      `*${biz.name || 'JAI MAA SHARDEY ENTERPRISES'}*\n` +
      `GSTIN: ${biz.gstin || '07HNPPK7350N1Z4'}\n` +
      `-----------------------------------------\n` +
      `M/s: *${customerName}*\n` +
      `Credit Note No: *${cnNumber}*\n` +
      `Date: *${dateFormatted}*\n` +
      `Against Original Bill: *#${originalInvNo}*\n` +
      `Return RMA Ref: *${returnRef}*\n\n` +
      `*Returned Item(s):* \n${itemsList}\n\n` +
      `*Total Credit Note Amount:* *₹${grandTotal.toFixed(2)}*\n` +
      `(${numToWordsIndian(grandTotal)})\n\n` +
      `*Khata Ledger Status:* ₹${grandTotal.toFixed(2)} aapke khata balance me credit kar diye gaye hain.\n` +
      `-----------------------------------------\n` +
      `Dhanyawad,\n*${biz.name || 'JAI MAA SHARDEY ENTERPRISES'}*`;

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
        date: cnDate,
        grandTotal: grandTotal,
        taxTotal: totalTax,
        taxableSubtotal: taxableSubtotal,
        placeOfSupply: 'Delhi (07)',
        paymentTerms: 'Credit Adjustment',
        items: items.map(it => ({
          name: it.productName || it.name,
          qty: it.quantity || it.qty || 1,
          unit: it.unit || 'Pcs',
          price: it.unitPrice || it.rate || it.price || 0,
          total: it.amount || it.total || 0,
          gstRate: gstRate,
          hsn: it.hsn || '-'
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
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh'
        }}
      >
        {/* Top Control Bar (Hidden during Print) */}
        <div 
          className="no-print"
          style={{
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #4c1d95 0%, #6b21a8 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="#e9d5ff" />
            <div>
              <span style={{ fontWeight: '800', fontSize: '0.96rem' }}>
                Credit Note: {cnNumber}
              </span>
              <span style={{ fontSize: '0.74rem', color: '#e9d5ff', marginLeft: '8px' }}>
                Against Invoice #{originalInvNo}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#6b21a8',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
              title="Print Credit Note (Ctrl + P)"
            >
              <Printer size={15} />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
              title="Download Document"
            >
              <Download size={15} />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                background: '#22c55e',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
              title="Share on WhatsApp"
            >
              <MessageSquare size={15} />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleUploadToDrive}
              disabled={uploadingDrive}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                background: driveUploaded ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: uploadingDrive ? 'not-allowed' : 'pointer'
              }}
              title="Save to Connected Google Drive Folder"
            >
              <HardDrive size={15} />
              <span>{uploadingDrive ? 'Saving...' : driveUploaded ? 'Saved to Drive ✓' : 'Save to Drive'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#e9d5ff',
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
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
          <div 
            id="printable-credit-note"
            style={{
              background: '#ffffff',
              border: '1.5px solid #000000',
              padding: '24px',
              maxWidth: '800px',
              margin: '0 auto',
              color: '#0f172a',
              fontFamily: "'Segoe UI', Arial, sans-serif"
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000000', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {biz.name || 'JAI MAA SHARDEY ENTERPRISES'}
                </h1>
                <p style={{ fontSize: '11px', color: '#334155', margin: '3px 0 0 0' }}>
                  {biz.address || 'Uttam Nagar, New Delhi - 110059'}
                </p>
                <p style={{ fontSize: '11px', color: '#334155', margin: '3px 0 0 0' }}>
                  <strong>GSTIN:</strong> {biz.gstin || '07HNPPK7350N1Z4'} | <strong>Phone:</strong> {biz.phone || '9999999999'}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '4px 14px',
                  background: '#6b21a8',
                  color: '#ffffff',
                  fontWeight: '900',
                  fontSize: '13px',
                  letterSpacing: '1px',
                  borderRadius: '3px'
                }}>
                  GST CREDIT NOTE
                </div>
                <div style={{ fontSize: '10.5px', marginTop: '5px', fontWeight: '700', color: '#64748b' }}>
                  ORIGINAL FOR RECIPIENT
                </div>
                <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                  Section 34, CGST Act 2017
                </div>
              </div>
            </div>

            {/* Meta Grid: 2 Columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px', fontSize: '11px' }}>
              <div style={{ border: '1px solid #cbd5e1', padding: '10px 12px', borderRadius: '6px', background: '#faf5ff' }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#6b21a8', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid #e9d5ff', paddingBottom: '3px' }}>
                  Credit Note Details
                </div>
                <div><strong>Credit Note No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: '800' }}>{cnNumber}</span></div>
                <div><strong>Date of Issue:</strong> {dateFormatted}</div>
                <div><strong>Against Tax Invoice No:</strong> <span style={{ fontWeight: '800' }}>#{originalInvNo}</span></div>
                <div><strong>Return RMA Ref:</strong> {returnRef}</div>
                <div><strong>Reason:</strong> Sales Return / Stock Reversal</div>
                <div><strong>Place of Supply:</strong> Delhi (07)</div>
              </div>

              <div style={{ border: '1px solid #cbd5e1', padding: '10px 12px', borderRadius: '6px', background: '#faf5ff' }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#6b21a8', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid #e9d5ff', paddingBottom: '3px' }}>
                  Credit Issued To (Buyer Details)
                </div>
                <div style={{ fontWeight: '800', fontSize: '12px', color: '#0f172a' }}>{customerName}</div>
                <div>{customerAddress}</div>
                {customerGstin && <div><strong>GSTIN:</strong> {customerGstin}</div>}
                {customerPhone && <div><strong>Phone:</strong> {customerPhone}</div>}
                <div style={{ marginTop: '4px', fontSize: '10px', color: '#7e22ce', fontWeight: '700' }}>
                  ✓ Ledger Balance Adjusted
                </div>
              </div>
            </div>

            {/* Returned Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#581c87', color: '#ffffff' }}>
                  <th style={{ padding: '8px 6px', textAlign: 'center', width: '30px' }}>#</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left' }}>Item Description (Returned)</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', width: '70px' }}>HSN</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', width: '75px' }}>Return Qty</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', width: '75px' }}>Rate (₹)</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', width: '55px' }}>GST%</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', width: '85px' }}>Taxable (₹)</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', width: '85px' }}>Credit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '14px', color: '#64748b' }}>
                      Sales Return Item Adjustment
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const itQty = Number(it.quantity || it.qty || 1);
                    const itRate = Number(it.unitPrice || it.price || it.rate || 0);
                    const itTotal = Number(it.amount || it.total || (itQty * itRate));
                    const itTaxable = gstRate > 0 ? Number((itTotal / (1 + gstRate / 100)).toFixed(2)) : itTotal;

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '11px' }}>
                        <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 6px', fontWeight: '600', color: '#0f172a' }}>
                          {it.productName || it.name || 'Returned Item'}
                          {it.condition && (
                            <span style={{ fontSize: '9px', marginLeft: '6px', padding: '1px 5px', borderRadius: '4px', background: it.condition === 'Resalable' ? '#dcfce7' : '#fee2e2', color: it.condition === 'Resalable' ? '#15803d' : '#b91c1c' }}>
                              {it.condition}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>{it.hsn || '-'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: '700' }}>{itQty} {it.unit || 'Pcs'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>₹{itRate.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>{gstRate}%</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>₹{itTaxable.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '700', color: '#6b21a8' }}>₹{itTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Totals & Declaration Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '10px', paddingTop: '10px', borderTop: '2px solid #000000', fontSize: '11px' }}>
              <div style={{ maxWidth: '440px' }}>
                <div><strong>Amount in Words:</strong></div>
                <div style={{ fontStyle: 'italic', fontWeight: '700', color: '#475569', marginTop: '2px', lineHeight: 1.4 }}>
                  {numToWordsIndian(grandTotal)}
                </div>

                <div style={{ marginTop: '12px', padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '10px', color: '#475569' }}>
                  <strong>Statutory Declaration (GST Section 34):</strong><br />
                  This Credit Note is issued against Sales Return #{returnRef} for Tax Invoice #{originalInvNo}. Customer ledger has been credited by ₹{grandTotal.toFixed(2)}. Tax liability has been adjusted in accordance with GST Rules.
                </div>
              </div>

              {/* Summary Box */}
              <div style={{ background: '#faf5ff', border: '1.5px solid #6b21a8', padding: '12px 18px', borderRadius: '6px', textAlign: 'right', minWidth: '230px' }}>
                <div style={{ fontSize: '11px', color: '#475569', marginBottom: '3px' }}>
                  Taxable Value: <strong>₹{taxableSubtotal.toFixed(2)}</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginBottom: '3px' }}>
                  CGST (2.5%): <strong>₹{cgst.toFixed(2)}</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginBottom: '3px' }}>
                  SGST (2.5%): <strong>₹{sgst.toFixed(2)}</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginBottom: '3px' }}>
                  Total Tax: <strong>₹{totalTax.toFixed(2)}</strong>
                </div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#6b21a8', marginTop: '6px', borderTop: '1px solid #d8b4fe', paddingTop: '6px' }}>
                  Total Credit: ₹{grandTotal.toFixed(2)}
                </div>
                <div style={{ display: 'inline-block', padding: '3px 10px', background: '#f3e8ff', color: '#6b21a8', fontWeight: '900', fontSize: '10px', border: '1px solid #d8b4fe', borderRadius: '4px', marginTop: '6px' }}>
                  ✓ CREDITED TO KHATA
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '10px', color: '#64748b' }}>
              <div>
                <div>Issued on: {new Date().toLocaleString('en-IN')}</div>
                <div>Authorized RMA Accounting Document</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '35px' }}>
                  For {biz.name || 'JAI MAA SHARDEY ENTERPRISES'}
                </div>
                <div style={{ borderTop: '1px solid #000000', paddingTop: '3px', fontWeight: '700' }}>
                  Authorised Signatory
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Print Specific Styles */}
      <style>{`
        @media print {
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
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
