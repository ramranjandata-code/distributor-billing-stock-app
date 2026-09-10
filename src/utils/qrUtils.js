import QRCode from 'qrcode';

/**
 * Generate a dynamic UPI payment string:
 * e.g. upi://pay?pa=agency@upi&pn=BusinessName&am=1250.00&cu=INR&tn=Invoice SGA/26-27/1001
 */
export const buildUpiPaymentUrl = (vpa, payeeName, amount, invoiceNo = '') => {
  const cleanVpa = (vpa || 'payee@upi').trim();
  const cleanName = (payeeName || 'Distributor Agency').trim();
  const cleanAmount = Number(amount || 0).toFixed(2);
  const note = invoiceNo ? `Bill ${invoiceNo}` : 'Payment';
  
  return `upi://pay?pa=${encodeURIComponent(cleanVpa)}&pn=${encodeURIComponent(cleanName)}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent(note)}`;
};

/**
 * Generates an SVG / PNG Data URL for a UPI payment QR
 */
export const generateUpiQrDataUrl = async (vpa, payeeName, amount, invoiceNo = '') => {
  const url = buildUpiPaymentUrl(vpa, payeeName, amount, invoiceNo);
  try {
    return await QRCode.toDataURL(url, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Error generating UPI QR code:', err);
    return null;
  }
};

/**
 * Generates e-Invoice QR Code Data URL with standard GST JSON payload
 */
export const generateEInvoiceQrDataUrl = async (invoice, business) => {
  const payload = JSON.stringify({
    SellerGSTIN: business?.gstin || '07AAACG1234F1Z8',
    BuyerGSTIN: invoice?.partyGstin || 'URP',
    DocNo: invoice?.invoiceNo || 'INV',
    DocTyp: 'INV',
    DocDt: (invoice?.date || new Date().toISOString()).split('T')[0],
    TotInvVal: Number(invoice?.grandTotal || 0).toFixed(2),
    ItemCnt: (invoice?.items || []).length,
    MainHsnCode: invoice?.items?.[0]?.hsn || '1905',
    Irn: invoice?.irn || 'IRN-SIMULATED'
  });

  try {
    return await QRCode.toDataURL(payload, {
      width: 220,
      margin: 1,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Error generating e-Invoice QR:', err);
    return null;
  }
};

/**
 * Builds formatted text message for instant WhatsApp / SMS sharing
 */
export const buildInvoiceShareText = (invoice, business) => {
  const invNo = invoice?.invoiceNo || 'Bill';
  const total = Number(invoice?.grandTotal || 0).toLocaleString('en-IN');
  const paid = Number(invoice?.paidAmount || 0).toLocaleString('en-IN');
  const balance = Number(invoice?.balanceAmount || 0).toLocaleString('en-IN');
  const bName = business?.name || 'Distributor Agency';
  const upiId = business?.upiId || business?.email || '';

  let text = `*INVOICE: ${invNo}*\n`;
  text += `From: *${bName}*\n`;
  text += `Date: ${new Date(invoice?.date || Date.now()).toLocaleDateString('en-IN')}\n\n`;
  text += `*Bill Amount:* ₹${total}\n`;
  text += `*Payment Received:* ₹${paid}\n`;
  
  if (Number(invoice?.balanceAmount) > 0) {
    text += `*Due Balance:* ₹${balance}\n`;
  }
  text += `*Status:* ${invoice?.paymentStatus || 'PAID'}\n\n`;

  text += `*Items Summary:*\n`;
  (invoice?.items || []).slice(0, 5).forEach((item, idx) => {
    text += `${idx + 1}. ${item.name} (${item.qty} ${item.unit || 'Pcs'}) - ₹${Number(item.total || 0).toLocaleString('en-IN')}\n`;
  });
  if ((invoice?.items || []).length > 5) {
    text += `...and ${(invoice.items.length - 5)} more items.\n`;
  }

  if (upiId && Number(invoice?.balanceAmount) > 0) {
    text += `\n📲 *Pay via UPI:* ${upiId}\n`;
  }
  text += `\nThank you for doing business with us!`;

  return text;
};

/**
 * Builds WhatsApp Web / Mobile redirect link
 */
export const buildWhatsAppUrl = (phone, message) => {
  let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
};

/**
 * Builds SMS URL
 */
export const buildSmsUrl = (phone, message) => {
  let cleanPhone = (phone || '').replace(/[^0-9+]/g, '');
  return `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
};

/**
 * Builds Email mailto URL
 */
export const buildEmailUrl = (email, subject, body) => {
  return `mailto:${email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
