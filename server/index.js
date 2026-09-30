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
app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(` DistroPlus Dual Google Drive & Supabase Server Online`);
  console.log(` Listening on: http://localhost:${PORT}`);
  console.log(` Target Google Drive Folder: ${TARGET_FOLDER_ID}`);
  console.log(`========================================================`);
});
