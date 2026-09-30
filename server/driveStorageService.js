/**
 * DistroPlus ERP: Dual Google Drive Storage & Supabase Integration Engine
 * Provides persistent OAuth 2.0 token management, multi-account fallback (15GB + 15GB = 30GB),
 * and targeted file CRUD operations for bill PDF documents.
 */

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { Readable } = require('stream');
require('dotenv').config();

// Initialize Supabase Client for backend operations
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('[DriveStorage] Warning: SUPABASE_URL or SUPABASE_ANON_KEY is not defined in environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Target Google Drive Parent Folder ID
const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '15Ub1FksCAldnMYBwxfUTwXzB7Kx5w_8E';

/**
 * Creates a configured Google OAuth2 Client instance
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Utility: Converts a Buffer to a Readable Stream for Google Drive API uploads
 */
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
 * Requirement 2: Generates OAuth 2.0 Consent URL for linking Google Drive accounts
 * Uses access_type=offline and prompt=consent to ensure a persistent refresh_token is returned.
 */
function getAuthUrl(priority = 1) {
  const oauth2Client = createOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: JSON.stringify({ priority: Number(priority) || 1 })
  });
}

/**
 * Requirement 2: Handles Google OAuth 2.0 callback, extracts refresh_token,
 * and records the account into the Supabase `drive_accounts` table.
 */
async function handleOAuthCallback(code, priorityOrder = 1) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (!tokens.refresh_token) {
    throw new Error('No refresh_token returned by Google. Ensure prompt=consent and access_type=offline were used.');
  }

  // Fetch account email & profile from Google
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email || `drive-account-${Date.now()}@gmail.com`;
  const name = userInfo.data.name || `Google Drive Account ${priorityOrder}`;

  // Upsert account record in Supabase drive_accounts
  const { data, error } = await supabase
    .from('drive_accounts')
    .upsert({
      email,
      account_name: name,
      refresh_token: tokens.refresh_token,
      priority_order: Number(priorityOrder) || 1,
      is_active: true
    }, { onConflict: 'email' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store drive account in Supabase: ${error.message}`);
  }

  return data;
}

/**
 * Requirement 2: Reads stored refresh_token from Supabase and auto-refreshes the access_token.
 */
async function getAccessToken(drive_account_id) {
  const { data: account, error } = await supabase
    .from('drive_accounts')
    .select('*')
    .eq('id', drive_account_id)
    .single();

  if (error || !account) {
    throw new Error(`Google Drive account ${drive_account_id} not found in database: ${error?.message}`);
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: account.refresh_token });

  const tokenResponse = await oauth2Client.getAccessToken();
  return {
    accessToken: tokenResponse.token,
    oauth2Client,
    account
  };
}

/**
 * Returns an authenticated Google Drive v3 client for a given drive_account_id
 */
async function getDriveClient(drive_account_id) {
  const { oauth2Client } = await getAccessToken(drive_account_id);
  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Fetches all active Google Drive accounts ordered by priority (1 = Primary, 2 = Fallback)
 */
async function getActiveDriveAccounts() {
  const { data, error } = await supabase
    .from('drive_accounts')
    .select('*')
    .eq('is_active', true)
    .order('priority_order', { ascending: true });

  if (error) {
    throw new Error(`Error fetching active drive accounts: ${error.message}`);
  }

  return data || [];
}

/**
 * Requirement 3.1 & 3.5: Upload Bill PDF with Multi-Account Fallback
 * Uploads PDF into the specific parent folder `GOOGLE_DRIVE_FOLDER_ID` (`15Ub1FksCAldnMYBwxfUTwXzB7Kx5w_8E`).
 * If Account 1 runs out of storage quota or fails, it automatically falls back to Account 2.
 * Saves billing metadata + generated `drive_file_id` + `drive_account_id` into Supabase `bills`.
 */
async function uploadBillPDF(fileBuffer, metadata) {
  const accounts = await getActiveDriveAccounts();

  if (accounts.length === 0) {
    throw new Error('No active Google Drive accounts configured. Please link an account via Google OAuth.');
  }

  const {
    invoice_number,
    customer_name,
    customer_phone = '',
    customer_gstin = '',
    total_amount = 0,
    bill_date = new Date().toISOString().split('T')[0],
    items_json = []
  } = metadata;

  if (!invoice_number || !customer_name) {
    throw new Error('Invoice number and Customer name are required.');
  }

  const fileName = `Bill_${invoice_number.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.pdf`;
  let uploadResult = null;
  let successfulAccount = null;
  let lastError = null;

  // Multi-account fallback loop: Try Account 1, fall back to Account 2
  for (const account of accounts) {
    try {
      console.log(`[DriveStorage] Attempting upload to Drive Account: ${account.email} (Priority ${account.priority_order})...`);
      const drive = await getDriveClient(account.id);

      const fileMetadata = {
        name: fileName,
        parents: [TARGET_FOLDER_ID]
      };

      const media = {
        mimeType: 'application/pdf',
        body: bufferToStream(fileBuffer)
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, webViewLink, webContentLink, size'
      });

      uploadResult = response.data;
      successfulAccount = account;
      console.log(`[DriveStorage] Successfully uploaded ${fileName} to Drive Account: ${account.email}. File ID: ${uploadResult.id}`);
      break; // Upload succeeded, exit loop
    } catch (err) {
      console.warn(`[DriveStorage] Upload failed on account ${account.email}: ${err.message}. Attempting fallback to next account...`);
      lastError = err;
    }
  }

  if (!uploadResult || !successfulAccount) {
    throw new Error(`All Google Drive accounts failed upload. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  // Save metadata to Supabase bills table
  const billRecord = {
    invoice_number,
    customer_name,
    customer_phone,
    customer_gstin,
    total_amount: Number(total_amount) || 0,
    bill_date,
    items_json: Array.isArray(items_json) ? items_json : [],
    drive_account_id: successfulAccount.id,
    drive_file_id: uploadResult.id,
    drive_web_link: uploadResult.webViewLink || ''
  };

  const { data: savedBill, error: dbError } = await supabase
    .from('bills')
    .upsert(billRecord, { onConflict: 'invoice_number' })
    .select()
    .single();

  if (dbError) {
    throw new Error(`Failed to save bill metadata in Supabase: ${dbError.message}`);
  }

  return {
    success: true,
    bill: savedBill,
    drive_file_id: uploadResult.id,
    drive_account_id: successfulAccount.id,
    drive_account_email: successfulAccount.email,
    webViewLink: uploadResult.webViewLink
  };
}

/**
 * Requirement 3.2: Download Bill PDF
 * Fetches PDF binary stream from Google Drive using `alt=media`, or returns preview links (`webViewLink`).
 */
async function downloadBillPDF(billId) {
  const { data: bill, error } = await supabase
    .from('bills')
    .select('*, drive_accounts(*)')
    .eq('id', billId)
    .single();

  if (error || !bill) {
    throw new Error(`Bill record ${billId} not found in database: ${error?.message}`);
  }

  if (!bill.drive_file_id || !bill.drive_account_id) {
    throw new Error(`Bill ${bill.invoice_number} has no associated Google Drive file.`);
  }

  const drive = await getDriveClient(bill.drive_account_id);

  // Retrieve file binary stream
  const response = await drive.files.get(
    { fileId: bill.drive_file_id, alt: 'media' },
    { responseType: 'stream' }
  );

  // Also fetch webViewLink preview metadata
  let webViewLink = bill.drive_web_link;
  try {
    const meta = await drive.files.get({ fileId: bill.drive_file_id, fields: 'webViewLink, webContentLink, name' });
    webViewLink = meta.data.webViewLink || webViewLink;
  } catch (e) {}

  return {
    stream: response.data,
    bill,
    fileName: `Bill_${bill.invoice_number}.pdf`,
    webViewLink
  };
}

/**
 * Requirement 3.3: Update Bill PDF
 * Overwrites existing file contents in Google Drive via `drive.files.update` without changing
 * the existing `drive_file_id` or breaking database links.
 */
async function updateBillPDF(billId, updatedFileBuffer, updatedMetadata = null) {
  const { data: bill, error } = await supabase
    .from('bills')
    .select('*')
    .eq('id', billId)
    .single();

  if (error || !bill) {
    throw new Error(`Bill ${billId} not found in database: ${error?.message}`);
  }

  const drive = await getDriveClient(bill.drive_account_id);

  const media = {
    mimeType: 'application/pdf',
    body: bufferToStream(updatedFileBuffer)
  };

  const updateResponse = await drive.files.update({
    fileId: bill.drive_file_id,
    media,
    fields: 'id, name, webViewLink, size'
  });

  // Optionally update Supabase metadata
  let finalBill = bill;
  if (updatedMetadata && typeof updatedMetadata === 'object') {
    const { data: patchedBill } = await supabase
      .from('bills')
      .update({
        ...updatedMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', billId)
      .select()
      .single();

    if (patchedBill) finalBill = patchedBill;
  }

  return {
    success: true,
    bill: finalBill,
    drive_file_id: updateResponse.data.id,
    webViewLink: updateResponse.data.webViewLink
  };
}

/**
 * Requirement 3.4: Delete Bill
 * Permanently deletes the file from Google Drive via `drive.files.delete`
 * and removes the corresponding metadata record from Supabase `bills`.
 */
async function deleteBill(billId) {
  const { data: bill, error } = await supabase
    .from('bills')
    .select('*')
    .eq('id', billId)
    .single();

  if (error || !bill) {
    throw new Error(`Bill ${billId} not found in database: ${error?.message}`);
  }

  // Delete from Google Drive if file exists
  if (bill.drive_file_id && bill.drive_account_id) {
    try {
      const drive = await getDriveClient(bill.drive_account_id);
      await drive.files.delete({ fileId: bill.drive_file_id });
      console.log(`[DriveStorage] Deleted Google Drive file: ${bill.drive_file_id}`);
    } catch (err) {
      console.warn(`[DriveStorage] Warning: Failed to delete Google Drive file ${bill.drive_file_id}: ${err.message}`);
    }
  }

  // Delete from Supabase
  const { error: deleteError } = await supabase
    .from('bills')
    .delete()
    .eq('id', billId);

  if (deleteError) {
    throw new Error(`Failed to delete bill from database: ${deleteError.message}`);
  }

  return {
    success: true,
    deletedBillId: billId,
    invoice_number: bill.invoice_number
  };
}

/**
 * Lists all connected drive accounts with priority status
 */
async function listConnectedDriveAccounts() {
  const { data, error } = await supabase
    .from('drive_accounts')
    .select('id, email, account_name, is_active, priority_order, created_at, updated_at')
    .order('priority_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to retrieve drive accounts: ${error.message}`);
  }

  return data || [];
}

module.exports = {
  TARGET_FOLDER_ID,
  getAuthUrl,
  handleOAuthCallback,
  getAccessToken,
  getDriveClient,
  getActiveDriveAccounts,
  uploadBillPDF,
  downloadBillPDF,
  updateBillPDF,
  deleteBill,
  listConnectedDriveAccounts
};
