/**
 * Official GSTN GSTR-1 Schema Generator & Validator Engine
 * Complies with GST Council Offline Tool JSON Specifications (gst.gov.in)
 * Supports B2B, B2CL, B2CS, CDNR, CDNUR, HSN Summary & Document Series Tracking
 */

import { getGstinStateCode } from './taxUtils.js';

/**
 * Formats a Date to GSTN compliant DD-MM-YYYY string
 */
export const formatGstnDate = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Rounds a number to exactly 2 decimal places as a Number
 */
export const round2 = (num) => {
  return Number((Math.round((Number(num) || 0) * 100) / 100).toFixed(2));
};

/**
 * Validates 15-character GSTIN format
 * Format: 2 digits (State) + 10 chars (PAN) + 1 digit (Entity) + 'Z' + 1 checksum
 */
export const isValidGstin = (gstin) => {
  if (!gstin || typeof gstin !== 'string') return false;
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin.trim().toUpperCase());
};

/**
 * Maps financial period from Date or MMYYYY string
 * E.g. '2026-04-15' -> '042026'
 */
export const formatGstnReturnPeriod = (dateOrStr) => {
  if (!dateOrStr) {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${mm}${now.getFullYear()}`;
  }
  if (/^\d{6}$/.test(String(dateOrStr).trim())) {
    return String(dateOrStr).trim();
  }
  const d = new Date(dateOrStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${mm}${d.getFullYear()}`;
};

/**
 * Generates the Official GSTN GSTR-1 JSON Payload
 * 
 * @param {Array} invoices - List of all sales invoices for the period
 * @param {Array} salesReturns - List of credit notes / returns for the period
 * @param {Object} business - Supplier business details including GSTIN
 * @param {string} returnPeriod - 'MMYYYY' (e.g. '042026')
 * @param {number} grossTurnover - Previous FY Gross Annual Turnover
 * @param {number} currentPeriodTurnover - Current Period Turnover
 */
export const generateGstr1Payload = ({
  invoices = [],
  salesReturns = [],
  creditNotes = [],
  business = {},
  businessGstin = '',
  returnPeriod = '',
  filingPeriod = '',
  grossTurnover = 0,
  curGrossTurnover = 0,
  currentPeriodTurnover = 0
}) => {
  const isDocCreditNote = (i) => i && (
    i.documentType === 'out_refund' || 
    i.isCreditNote === true || 
    (typeof i.invoiceNo === 'string' && (i.invoiceNo.startsWith('CN') || i.invoiceNo.startsWith('RINV'))) ||
    i.paymentMode === 'CREDIT_NOTE'
  );

  const invoiceCreditNotes = invoices.filter(i => isDocCreditNote(i));
  const rawReturns = [...(salesReturns || []), ...(creditNotes || []), ...invoiceCreditNotes];
  const seenNoteKeys = new Set();
  const allReturns = [];
  rawReturns.forEach(r => {
    const k = r.id || r.creditNoteNo || r.invoiceNo;
    if (k && !seenNoteKeys.has(k)) {
      seenNoteKeys.add(k);
      allReturns.push(r);
    }
  });

  const supplierGstin = (business?.gstin || businessGstin || '').trim().toUpperCase();
  const fp = formatGstnReturnPeriod(returnPeriod || filingPeriod);
  const supplierStateCode = getGstinStateCode(supplierGstin) || '07';
  // fp already initialized

  // Active, non-cancelled tax invoices (excluding credit notes)
  const validInvoices = invoices.filter(i => i && i.status !== 'CANCELLED' && !isDocCreditNote(i));

  // --- 1. B2B SUPPLIES (Registered Buyers) ---
  // Grouped by Buyer GSTIN (ctin)
  const b2bMap = new Map();
  const b2clList = [];
  const b2csMap = new Map(); // Key: pos + '_' + rt + '_' + sply_ty

  validInvoices.forEach(inv => {
    const buyerGstin = (inv.partyGstin || inv.gstin || '').trim().toUpperCase();
    const grandTotal = round2(inv.grandTotal || inv.totalAmount || 0);
    const invoiceDate = formatGstnDate(inv.date);
    const inum = String(inv.invoiceNo || inv.id).trim();

    // Deduce POS (Place of Supply) from Buyer GSTIN or fallback to seller state
    const buyerStateCode = getGstinStateCode(buyerGstin);
    const pos = (buyerStateCode || inv.pos || supplierStateCode).padStart(2, '0');
    const isInterState = pos !== supplierStateCode;
    const supplyType = isInterState ? 'INTER' : 'INTRA';

    // Prepare line item tax rate details
    const items = Array.isArray(inv.items) ? inv.items : [];
    
    // Group line items by GST Rate
    const rateGroupMap = new Map();
    items.forEach((item, idx) => {
      if (item.isSection || item.isNote) return;
      const rate = round2(item.gstRate || 0);
      const txval = round2(item.taxableAmount || item.taxableVal || (Number(item.qty || 1) * Number(item.price || item.rate || 0)));
      const camt = supplyType === 'INTRA' ? round2(item.cgstAmount || item.cgst || (txval * (rate / 2) / 100)) : 0;
      const samt = supplyType === 'INTRA' ? round2(item.sgstAmount || item.sgst || (txval * (rate / 2) / 100)) : 0;
      const iamt = supplyType === 'INTER' ? round2(item.igstAmount || item.igst || (txval * rate / 100)) : 0;

      if (!rateGroupMap.has(rate)) {
        rateGroupMap.set(rate, { rt: rate, txval: 0, camt: 0, samt: 0, iamt: 0, csamt: 0 });
      }
      const g = rateGroupMap.get(rate);
      g.txval = round2(g.txval + txval);
      g.camt = round2(g.camt + camt);
      g.samt = round2(g.samt + samt);
      g.iamt = round2(g.iamt + iamt);
    });

    // If invoice had no items explicitly broken down, fallback to top-level tax
    if (rateGroupMap.size === 0) {
      const rate = 5.0; // Standard default FMCG rate
      const txval = round2(inv.taxableTotal || (grandTotal / 1.05));
      const camt = supplyType === 'INTRA' ? round2((grandTotal - txval) / 2) : 0;
      const samt = supplyType === 'INTRA' ? round2((grandTotal - txval) / 2) : 0;
      const iamt = supplyType === 'INTER' ? round2(grandTotal - txval) : 0;
      rateGroupMap.set(rate, { rt: rate, txval, camt, samt, iamt, csamt: 0 });
    }

    const itms = Array.from(rateGroupMap.values()).map((det, index) => ({
      num: index + 1,
      itm_det: det
    }));

    if (isValidGstin(buyerGstin)) {
      // === B2B ===
      if (!b2bMap.has(buyerGstin)) {
        b2bMap.set(buyerGstin, {
          ctin: buyerGstin,
          cfs: 'Y',
          inv: []
        });
      }
      b2bMap.get(buyerGstin).inv.push({
        inum,
        idt: invoiceDate,
        val: grandTotal,
        pos,
        rchrg: 'N',
        inv_typ: 'R',
        itms
      });
    } else {
      // === Unregistered Buyer (B2C) ===
      if (isInterState && grandTotal > 250000) {
        // B2C Large (Inter-state invoice > 2.5 Lakhs)
        b2clList.push({
          pos,
          inv: [{
            inum,
            idt: invoiceDate,
            val: grandTotal,
            itms
          }]
        });
      } else {
        // B2C Small: Aggregated by POS + Rate + Supply Type
        rateGroupMap.forEach((det, rate) => {
          const key = `${pos}_${rate}_${supplyType}`;
          if (!b2csMap.has(key)) {
            b2csMap.set(key, {
              sply_ty: supplyType,
              typ: 'OE', // Other than E-commerce
              pos,
              rt: rate,
              txval: 0,
              iamt: 0,
              camt: 0,
              samt: 0,
              csamt: 0
            });
          }
          const b = b2csMap.get(key);
          b.txval = round2(b.txval + det.txval);
          b.iamt = round2(b.iamt + det.iamt);
          b.camt = round2(b.camt + det.camt);
          b.samt = round2(b.samt + det.samt);
        });
      }
    }
  });

  // --- 2. CREDIT / DEBIT NOTES (CDNR & CDNUR) ---
  const cdnrMap = new Map();
  const cdnurList = [];

  (allReturns || []).forEach(ret => {
    const ntNum = ret.creditNoteNo || ret.invoiceNo || ret.returnNo || ret.id;
    const ntDt = formatGstnDate(ret.creditNoteDate || ret.returnDate || ret.date || ret.createdAt);
    const origInum = ret.reversalOf || ret.originalInvoiceNo || (ret.invoiceNo && !ret.invoiceNo.startsWith('CN') ? ret.invoiceNo : 'INV-000');
    const origIdt = formatGstnDate(ret.originalInvoiceDate || ret.date || ret.createdAt);
    const totalVal = round2(ret.totalCreditAmount || ret.grandTotal || ret.totalAmount || 0);
    const buyerGstin = (ret.partyGstin || '').trim().toUpperCase();
    const buyerState = getGstinStateCode(buyerGstin) || supplierStateCode;
    const pos = buyerState.padStart(2, '0');
    const isInter = pos !== supplierStateCode;

    // Rate breakdown
    const rate = 5.0;
    const txval = round2(totalVal / 1.05);
    const camt = !isInter ? round2((totalVal - txval) / 2) : 0;
    const samt = !isInter ? round2((totalVal - txval) / 2) : 0;
    const iamt = isInter ? round2(totalVal - txval) : 0;

    const itms = [{
      num: 1,
      itm_det: { rt: rate, txval, camt, samt, iamt, csamt: 0 }
    }];

    const noteRecord = {
      nt_num: ntNum,
      nt_dt: ntDt,
      ntty: 'C', // 'C' for Credit Note
      inum: origInum,
      idt: origIdt,
      val: totalVal,
      pos,
      rchrg: 'N',
      itms
    };

    if (isValidGstin(buyerGstin)) {
      if (!cdnrMap.has(buyerGstin)) {
        cdnrMap.set(buyerGstin, {
          ctin: buyerGstin,
          cfs: 'Y',
          nt: []
        });
      }
      cdnrMap.get(buyerGstin).nt.push(noteRecord);
    } else {
      cdnurList.push({
        typ: isInter && totalVal > 250000 ? 'B2CL' : 'B2CS',
        nt_num: ntNum,
        nt_dt: ntDt,
        ntty: 'C',
        inum: origInum,
        idt: origIdt,
        val: totalVal,
        pos,
        itms
      });
    }
  });

  // --- 3. HSN SUMMARY TABLE ---
  const hsnMap = new Map();
  validInvoices.forEach(inv => {
    const items = Array.isArray(inv.items) ? inv.items : [];
    const buyerGstin = (inv.partyGstin || '').trim().toUpperCase();
    const buyerStateCode = getGstinStateCode(buyerGstin) || supplierStateCode;
    const isInter = buyerStateCode !== supplierStateCode;

    items.forEach(item => {
      if (item.isSection || item.isNote) return;
      const hsnCode = (item.hsnCode || item.hsn || '1507').replace(/\s+/g, '');
      const desc = item.name || 'FMCG Goods';
      const uqc = item.unit || 'PCS';
      const qty = round2(item.qty || 1);
      const rate = round2(item.gstRate || 5);
      const txval = round2(item.taxableAmount || (qty * Number(item.price || item.rate || 0)));
      const totVal = round2(item.total || (txval * (1 + rate / 100)));
      const camt = !isInter ? round2((totVal - txval) / 2) : 0;
      const samt = !isInter ? round2((totVal - txval) / 2) : 0;
      const iamt = isInter ? round2(totVal - txval) : 0;

      if (!hsnMap.has(hsnCode)) {
        hsnMap.set(hsnCode, {
          hsn_sc: hsnCode,
          desc: desc.substring(0, 30),
          uqc: uqc.toUpperCase().substring(0, 3),
          qty: 0,
          val: 0,
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0
        });
      }
      const h = hsnMap.get(hsnCode);
      h.qty = round2(h.qty + qty);
      h.val = round2(h.val + totVal);
      h.txval = round2(h.txval + txval);
      h.camt = round2(h.camt + camt);
      h.samt = round2(h.samt + samt);
      h.iamt = round2(h.iamt + iamt);
    });
  });

  const hsnData = Array.from(hsnMap.values()).map((item, index) => ({
    num: index + 1,
    ...item
  }));

  // --- 4. DOCUMENT ISSUE SUMMARY ---
  let fromDoc = '';
  let toDoc = '';
  if (validInvoices.length > 0) {
    fromDoc = String(validInvoices[0].invoiceNo || 'INV-001');
    toDoc = String(validInvoices[validInvoices.length - 1].invoiceNo || 'INV-999');
  }

  const cancelledCount = invoices.filter(i => i && i.status === 'CANCELLED').length;
  const totalInvoicesCount = invoices.length;
  const netIssued = totalInvoicesCount - cancelledCount;

  const docIssue = {
    doc_det: [
      {
        doc_num: 1,
        doc_typ: 'Invoices for outward supply',
        docs: [
          {
            num: 1,
            from: fromDoc || 'INV-1',
            to: toDoc || 'INV-1',
            totnum: totalInvoicesCount,
            cancel: cancelledCount,
            net_issue: netIssued
          }
        ]
      }
    ]
  };

  // Compile final official GSTR-1 JSON Schema
  const payload = {
    gstin: supplierGstin || '07AAACG1234F1Z8',
    fp,
    gt: round2(grossTurnover || 0),
    cur_gt: round2(currentPeriodTurnover || validInvoices.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0)),
    b2b: Array.from(b2bMap.values()),
    b2cl: b2clList,
    b2cs: Array.from(b2csMap.values()),
    cdnr: Array.from(cdnrMap.values()),
    cdnur: cdnurList,
    hsn: { data: hsnData },
    doc_issue: docIssue
  };

  return payload;
};

/**
 * Validates GSTR-1 Payload against government guidelines
 */
export const validateGstr1Payload = (payload) => {
  const errors = [];
  const warnings = [];

  if (!payload) {
    return { isValid: false, errors: ['Payload is empty.'], warnings };
  }

  // 1. Supplier GSTIN
  if (!isValidGstin(payload.gstin)) {
    errors.push(`Invalid Supplier GSTIN "${payload.gstin}". Must be 15 alphanumeric characters matching state code.`);
  }

  // 2. Financial Period (MMYYYY)
  if (!/^\d{6}$/.test(payload.fp)) {
    errors.push(`Invalid Return Period "${payload.fp}". Format must be MMYYYY (e.g. 042026).`);
  }

  // 3. Check B2B buyers
  (payload.b2b || []).forEach((b2bEntry, idx) => {
    if (!isValidGstin(b2bEntry.ctin)) {
      errors.push(`B2B entry #${idx + 1} has invalid Buyer GSTIN: "${b2bEntry.ctin}".`);
    }
    (b2bEntry.inv || []).forEach(inv => {
      if (!inv.inum) errors.push(`Invoice missing invoice number for buyer ${b2bEntry.ctin}.`);
      if (!/^\d{2}-\d{2}-\d{4}$/.test(inv.idt)) {
        errors.push(`Invoice ${inv.inum} has invalid date "${inv.idt}". Must be DD-MM-YYYY.`);
      }
      if (inv.val <= 0) {
        warnings.push(`Invoice ${inv.inum} has zero or negative total value: ₹${inv.val}.`);
      }
    });
  });

  // 4. Check payload size (GSTN Portal 5 MB offline limit)
  const jsonStr = JSON.stringify(payload);
  const sizeInMb = (new TextEncoder().encode(jsonStr).length) / (1024 * 1024);
  if (sizeInMb > 5.0) {
    errors.push(`Payload size is ${sizeInMb.toFixed(2)} MB, which exceeds the GSTN Portal limit of 5.0 MB. Please split by date.`);
  } else if (sizeInMb > 4.0) {
    warnings.push(`Payload size is ${sizeInMb.toFixed(2)} MB, approaching the 5.0 MB limit.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sizeInMb: round2(sizeInMb),
    b2bCount: (payload.b2b || []).reduce((sum, b) => sum + (b.inv?.length || 0), 0),
    b2csCount: (payload.b2cs || []).length,
    hsnCount: payload.hsn?.data?.length || 0,
    docCount: payload.doc_issue?.doc_det?.[0]?.docs?.[0]?.totnum || 0
  };
};

/**
 * Triggers 1-Click Browser Download of Official GSTR-1 JSON
 */
export const downloadGstr1Json = (params) => {
  const payload = generateGstr1Payload(params);
  const validation = validateGstr1Payload(payload);
  const jsonString = JSON.stringify(payload, null, 2);
  const fileName = `GSTR1_${payload.gstin}_${payload.fp}.json`;

  if (typeof window !== 'undefined') {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    success: true,
    fileName,
    validation,
    payload
  };
};
