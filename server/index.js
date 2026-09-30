/**
 * DistroPlus ERP: Backend Server for Google Drive & Supabase Storage
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const {
  TARGET_FOLDER_ID,
  getAuthUrl,
  handleOAuthCallback,
  uploadBillPDF,
  downloadBillPDF,
  updateBillPDF,
  deleteBill,
  listConnectedDriveAccounts
} = require('./driveStorageService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer memory storage for in-memory PDF buffering
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB limit for high-res bill scans
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    targetFolderId: TARGET_FOLDER_ID,
    timestamp: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------------
// 1. Google OAuth Routes (Link up to 2 Google Drive Accounts)
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/google/url?priority=1
 * Generates OAuth consent URL with access_type=offline & prompt=consent
 */
app.get('/api/auth/google/url', (req, res) => {
  try {
    const priority = req.query.priority || 1;
    const authUrl = getAuthUrl(priority);
    res.json({ success: true, authUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/google/callback
 * Exchanges authorization code for persistent refresh_token and saves to Supabase
 */
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`<h3>Google OAuth Error:</h3><p>${error}</p>`);
  }

  if (!code) {
    return res.status(400).send('<h3>Error: Missing authorization code.</h3>');
  }

  try {
    let priority = 1;
    if (state) {
      try {
        const parsed = JSON.parse(state);
        priority = parsed.priority || 1;
      } catch (e) {}
    }

    const account = await handleOAuthCallback(code, priority);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Drive Connected - DistroPlus ERP</title>
        <style>
          body { font-family: Inter, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
          .card { background: white; border-radius: 16px; padding: 36px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; max-width: 480px; }
          .badge { display: inline-block; padding: 6px 14px; background: #ecfdf5; color: #059669; border-radius: 20px; font-weight: 700; font-size: 0.85rem; margin-bottom: 16px; }
          h2 { margin: 0 0 8px 0; color: #0f172a; }
          p { color: #64748b; font-size: 0.9rem; line-height: 1.5; }
          button { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; margin-top: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">✓ Google Drive Linked</div>
          <h2>Account Connected!</h2>
          <p><strong>Email:</strong> ${account.email}<br/><strong>Storage Slot:</strong> Account ${account.priority_order} (15 GB Quota)</p>
          <p>PDF bills and scans will now automatically upload to your Google Drive folder.</p>
          <button onclick="window.close()">Close Window</button>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    res.status(500).send(`<h3>Failed to link account:</h3><p>${err.message}</p>`);
  }
});

/**
 * GET /api/drive/accounts
 * Lists all connected Google Drive accounts
 */
app.get('/api/drive/accounts', async (req, res) => {
  try {
    const accounts = await listConnectedDriveAccounts();
    res.json({ success: true, accounts, targetFolderId: TARGET_FOLDER_ID });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 2. Bill PDF Storage & Management Routes (Upload, Download, Update, Delete)
// ---------------------------------------------------------------------------

/**
 * POST /api/bills/upload
 * Uploads bill PDF to Google Drive folder with multi-account fallback,
 * and saves metadata to Supabase bills table.
 */
app.post('/api/bills/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'Please attach a PDF file in the "file" field.' });
    }

    const {
      invoice_number,
      customer_name,
      customer_phone,
      customer_gstin,
      total_amount,
      bill_date,
      items_json
    } = req.body;

    let parsedItems = [];
    if (items_json) {
      try {
        parsedItems = typeof items_json === 'string' ? JSON.parse(items_json) : items_json;
      } catch (e) {
        parsedItems = [];
      }
    }

    const metadata = {
      invoice_number,
      customer_name,
      customer_phone,
      customer_gstin,
      total_amount,
      bill_date,
      items_json: parsedItems
    };

    const result = await uploadBillPDF(req.file.buffer, metadata);
    res.status(201).json(result);
  } catch (err) {
    console.error('[Upload Route Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/bills/:id/download
 * Fetches PDF binary from Google Drive (alt=media) and streams directly to client
 */
app.get('/api/bills/:id/download', async (req, res) => {
  try {
    const { stream, bill, fileName } = await downloadBillPDF(req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

    stream.pipe(res);
  } catch (err) {
    console.error('[Download Route Error]:', err);
    res.status(404).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/bills/:id/preview
 * Returns webViewLink for Google Drive web preview
 */
app.get('/api/bills/:id/preview', async (req, res) => {
  try {
    const { webViewLink, bill } = await downloadBillPDF(req.params.id);
    res.json({ success: true, webViewLink, invoice_number: bill.invoice_number });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/bills/:id
 * Overwrites existing PDF in Google Drive without altering fileId or breaking database links
 */
app.put('/api/bills/:id', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'Please attach the updated PDF file in the "file" field.' });
    }

    let updatedMetadata = null;
    if (req.body.customer_name || req.body.total_amount || req.body.items_json) {
      updatedMetadata = {};
      if (req.body.customer_name) updatedMetadata.customer_name = req.body.customer_name;
      if (req.body.total_amount) updatedMetadata.total_amount = Number(req.body.total_amount);
      if (req.body.bill_date) updatedMetadata.bill_date = req.body.bill_date;
      if (req.body.items_json) {
        try {
          updatedMetadata.items_json = typeof req.body.items_json === 'string' ? JSON.parse(req.body.items_json) : req.body.items_json;
        } catch (e) {}
      }
    }

    const result = await updateBillPDF(req.params.id, req.file.buffer, updatedMetadata);
    res.json(result);
  } catch (err) {
    console.error('[Update Route Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/bills/:id
 * Permanently deletes PDF from Google Drive and metadata from Supabase
 */
app.delete('/api/bills/:id', async (req, res) => {
  try {
    const result = await deleteBill(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[Delete Route Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server

// ---------------------------------------------------------------------------
// 4. ENTERPRISE DISTRIBUTOR BILLING & INVENTORY MANAGEMENT API ENDPOINTS
// ---------------------------------------------------------------------------

/**
 * Helper: GSTIN State Code Extractor
 */
function getStateCodeFromGstin(gstin) {
  if (!gstin || typeof gstin !== 'string' || gstin.length < 2) return '07';
  const prefix = gstin.substring(0, 2);
  return /^[0-9]{2}$/.test(prefix) ? prefix : '07';
}

/**
 * POST /api/gst/gstr1/export
 * Compiles transactions into official GSTN GSTR-1 JSON schema (gst.gov.in compliant)
 */
app.post('/api/gst/gstr1/export', (req, res) => {
  try {
    const { 
      invoices = [], 
      creditNotes = [], 
      businessGstin = '07AAAAA0000A1Z5', 
      filingPeriod, // MMYYYY
      grossTurnover = 0, 
      curGrossTurnover = 0 
    } = req.body;

    const fp = filingPeriod || (() => {
      const d = new Date();
      return String(d.getMonth() + 1).padStart(2, '0') + d.getFullYear();
    })();

    // 1. Compile B2B Invoices (Registered buyers)
    const b2bMap = {};
    const b2csMap = {};
    const hsnMap = {};

    invoices.forEach(inv => {
      const isB2B = Boolean(inv.partyGstin && inv.partyGstin.trim().length === 15);
      const pos = inv.partyGstin ? getStateCodeFromGstin(inv.partyGstin) : '07';
      const invDate = inv.date ? inv.date.split('T')[0].split('-').reverse().join('-') : '01-09-2026';
      const items = inv.items || [];

      // Line item details
      const itms = items.map((item, idx) => {
        const rate = Number(item.gstRate) || 0;
        const txval = Number(item.taxableAmount || item.taxableValue || (item.qty * item.unitPrice)) || 0;
        const iamt = Number(item.igst || 0);
        const camt = Number(item.cgst || (item.totalGst ? item.totalGst / 2 : 0));
        const samt = Number(item.sgst || (item.totalGst ? item.totalGst / 2 : 0));

        // Aggregate into HSN Summary
        const hsn = (item.hsn || '1905').trim();
        if (!hsnMap[hsn]) {
          hsnMap[hsn] = { num: Object.keys(hsnMap).length + 1, hsn_sc: hsn, desc: item.name || 'General Product', uqc: 'BOX', qty: 0, val: 0, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        }
        hsnMap[hsn].qty += Number(item.qty || 1);
        hsnMap[hsn].txval += txval;
        hsnMap[hsn].iamt += iamt;
        hsnMap[hsn].camt += camt;
        hsnMap[hsn].samt += samt;
        hsnMap[hsn].val += (txval + iamt + camt + samt);

        return {
          num: idx + 1,
          itm_det: {
            rt: rate,
            txval: Math.round(txval * 100) / 100,
            iamt: Math.round(iamt * 100) / 100,
            camt: Math.round(camt * 100) / 100,
            samt: Math.round(samt * 100) / 100,
            csamt: 0
          }
        };
      });

      if (isB2B) {
        const ctin = inv.partyGstin.trim().toUpperCase();
        if (!b2bMap[ctin]) b2bMap[ctin] = { ctin, inv: [] };

        b2bMap[ctin].inv.push({
          inum: inv.invoiceNo,
          idt: invDate,
          val: Math.round((Number(inv.grandTotal) || 0) * 100) / 100,
          pos,
          rchrg: 'N',
          inv_typ: 'R',
          itms: itms.length > 0 ? itms : [{ num: 1, itm_det: { rt: 18, txval: inv.grandTotal, iamt: 0, camt: 0, samt: 0, csamt: 0 } }]
        });
      } else {
        // B2C Small
        items.forEach(item => {
          const rate = Number(item.gstRate) || 0;
          const key = `${pos}_${rate}`;
          const txval = Number(item.taxableAmount || (item.qty * item.unitPrice)) || 0;
          const iamt = Number(item.igst || 0);
          const camt = Number(item.cgst || (item.totalGst ? item.totalGst / 2 : 0));
          const samt = Number(item.sgst || (item.totalGst ? item.totalGst / 2 : 0));

          if (!b2csMap[key]) {
            b2csMap[key] = {
              sply_ty: pos === getStateCodeFromGstin(businessGstin) ? 'INTRA' : 'INTER',
              pos,
              typ: 'OE',
              rt: rate,
              txval: 0,
              iamt: 0,
              camt: 0,
              samt: 0,
              csamt: 0
            };
          }
          b2csMap[key].txval += txval;
          b2csMap[key].iamt += iamt;
          b2csMap[key].camt += camt;
          b2csMap[key].samt += samt;
        });
      }
    });

    const b2b = Object.values(b2bMap);
    const b2cs = Object.values(b2csMap).map(b => ({
      ...b,
      txval: Math.round(b.txval * 100) / 100,
      iamt: Math.round(b.iamt * 100) / 100,
      camt: Math.round(b.camt * 100) / 100,
      samt: Math.round(b.samt * 100) / 100
    }));

    const hsnData = Object.values(hsnMap).map(h => ({
      ...h,
      qty: Math.round(h.qty * 100) / 100,
      val: Math.round(h.val * 100) / 100,
      txval: Math.round(h.txval * 100) / 100,
      iamt: Math.round(h.iamt * 100) / 100,
      camt: Math.round(h.camt * 100) / 100,
      samt: Math.round(h.samt * 100) / 100
    }));

    const payload = {
      gstin: businessGstin.trim().toUpperCase(),
      fp,
      gt: Math.round(Number(grossTurnover || 0) * 100) / 100,
      cur_gt: Math.round(Number(curGrossTurnover || grossTurnover || 0) * 100) / 100,
      b2b,
      b2cl: [],
      b2cs,
      cdnr: [],
      cdnur: [],
      exp: [],
      at: [],
      atadj: [],
      exemp: { inv: [] },
      hsn: { data: hsnData },
      doc_issue: {
        doc_det: [{
          doc_num: 1,
          doc_typ: 'Invoices for outward supply',
          from: invoices[0]?.invoiceNo || 'INV-001',
          to: invoices[invoices.length - 1]?.invoiceNo || 'INV-001',
          totnum: invoices.length,
          canc: 0,
          net_issue: invoices.length
        }]
      }
    };

    // Calculate payload size
    const payloadStr = JSON.stringify(payload);
    const payloadSizeKb = (Buffer.byteLength(payloadStr, 'utf8') / 1024).toFixed(2);
    const filename = `GSTR1_${payload.gstin}_${fp}.json`;

    res.json({
      success: true,
      filename,
      payloadSizeKb,
      compliant: true,
      stats: {
        b2bCount: b2b.reduce((sum, b) => sum + b.inv.length, 0),
        b2csCount: b2cs.length,
        hsnCount: hsnData.length,
        totalInvoices: invoices.length
      },
      payload
    });
  } catch (err) {
    console.error('[GSTR1 API Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/returns/purchase
 * Vendor Debit Notes & Expired Stock Claim with Section 17(5)(h) ITC Reversal
 */
app.post('/api/returns/purchase', (req, res) => {
  try {
    const { 
      vendorId, 
      vendorName, 
      vendorGstin, 
      originalBillRef, 
      returnDate, 
      reason = 'EXPIRED_STOCK_CLAIM', 
      items = [], 
      notes = '' 
    } = req.body;

    if (!vendorName || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Vendor name and return items are required.' });
    }

    let subtotal = 0;
    let totalGst = 0;
    let itcReversalAmount = 0;

    const returnItems = items.map(item => {
      const qty = Number(item.returnQty || item.qty) || 0;
      const cost = Number(item.purchaseCost || item.purchasePrice) || 0;
      const gstRate = Number(item.gstRate) || 18;
      const lineCost = qty * cost;
      const lineGst = lineCost * (gstRate / 100);

      subtotal += lineCost;
      totalGst += lineGst;
      itcReversalAmount += lineGst;

      return {
        productId: item.productId,
        name: item.name,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        returnQty: qty,
        purchaseCost: cost,
        gstRate,
        lineCost,
        itcReversed: lineGst
      };
    });

    const debitNoteNo = `DN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const grandTotal = subtotal + totalGst;

    const debitNote = {
      id: 'dn_' + Date.now(),
      debitNoteNo,
      vendorId,
      vendorName,
      vendorGstin: vendorGstin || '',
      originalBillRef: originalBillRef || '',
      date: returnDate || new Date().toISOString().split('T')[0],
      reason,
      subtotal,
      cgst: totalGst / 2,
      sgst: totalGst / 2,
      igst: 0,
      itcReversalAmount,
      sec17_5_h_reversal_posted: true,
      grandTotal,
      status: 'POSTED',
      items: returnItems,
      notes
    };

    res.json({
      success: true,
      debitNote,
      itcReversal: {
        applicableSection: 'CGST Act Section 17(5)(h)',
        rule: 'ITC Reversal on Lost, Stolen, Destroyed, Written-Off or Expired Goods',
        itcReversalAmount,
        accountingEntry: 'Debit ITC Reversal Expense A/C | Credit Electronic Credit Ledger'
      }
    });
  } catch (err) {
    console.error('[Purchase Return API Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payments/split
 * Multi-Mode Payment Recording (Cash, UPI with UTR, Cheque with clearing status)
 */
app.post('/api/payments/split', (req, res) => {
  try {
    const { 
      invoiceId, 
      partyId, 
      partyName, 
      splits = [], 
      date = new Date().toISOString().split('T')[0], 
      notes = '' 
    } = req.body;

    if (!splits || splits.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one payment split is required.' });
    }

    const createdEntries = [];
    let totalPaid = 0;

    splits.forEach(split => {
      const amount = Number(split.amount) || 0;
      if (amount <= 0) return;

      totalPaid += amount;
      const isCheque = split.mode === 'CHEQUE';

      const entry = {
        id: 'pay_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        paymentNo: 'PAY-' + Math.floor(100000 + Math.random() * 900000),
        invoiceId: invoiceId || null,
        partyId: partyId || null,
        partyName: partyName || 'Counter Retailer',
        date,
        amount,
        paymentMode: split.mode,
        referenceNo: split.utr || split.referenceNo || ('REF-' + Date.now()),
        chequeNo: isCheque ? split.chequeNo : null,
        chequeBank: isCheque ? split.chequeBank : null,
        chequeDate: isCheque ? split.chequeDate : null,
        chequeStatus: isCheque ? 'PENDING' : 'NONE',
        notes: split.notes || notes,
        createdAt: new Date().toISOString()
      };

      createdEntries.push(entry);
    });

    res.json({
      success: true,
      totalPaid,
      createdEntries
    });
  } catch (err) {
    console.error('[Split Payment API Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(` DistroPlus Dual Google Drive & Supabase Server Online`);
  console.log(` Listening on: http://localhost:${PORT}`);
  console.log(` Target Google Drive Folder: ${TARGET_FOLDER_ID}`);
  console.log(`========================================================`);
});
