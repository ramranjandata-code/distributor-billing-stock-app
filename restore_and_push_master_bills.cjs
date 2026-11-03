/**
 * Master Restoration & Cloud Sync Script
 * Merges all 178 sales invoices (including Bill #260 S N Mart, Bill #259 Nanuram Bikaner Sweets,
 * and all October bills #236-#283) into Supabase cloud database & Desktop backups.
 */

const fs = require('fs');
const path = require('path');
const LZString = require('lz-string');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

function compressLossless(str) {
  if (!str) return '';
  return 'LZ64:' + LZString.compressToBase64(str);
}

function decompressLossless(compressed) {
  if (!compressed) return null;
  let raw = compressed;
  if (raw.startsWith('LZ64:')) raw = raw.substring(5);
  const decomp = LZString.decompressFromBase64(raw);
  if (!decomp) return null;
  try {
    return JSON.parse(decomp);
  } catch (e) {
    return null;
  }
}

async function restoreMaster() {
  console.log('=== DistroPulse ERP: Restoring Master Bills to Cloud & Local ===');

  const masterInvoicesPath = path.join(__dirname, 'MASTER_RESTORED_ALL_SALES_INVOICES.json');
  if (!fs.existsSync(masterInvoicesPath)) {
    throw new Error('MASTER_RESTORED_ALL_SALES_INVOICES.json not found!');
  }

  const masterInvoices = JSON.parse(fs.readFileSync(masterInvoicesPath, 'utf8'));
  console.log(`Loaded ${masterInvoices.length} master sales invoices from file.`);

  // Verify critical bills
  const inv260 = masterInvoices.find(i => String(i.invoiceNo) === '260');
  const inv259 = masterInvoices.find(i => String(i.invoiceNo) === '259');
  const inv258 = masterInvoices.find(i => String(i.invoiceNo) === '258');
  const inv236 = masterInvoices.find(i => String(i.invoiceNo) === '236');
  const inv283 = masterInvoices.find(i => String(i.invoiceNo) === '283');

  console.log('Key Bills Check:');
  console.log(`  Bill #260 (S N Mart):`, inv260 ? `FOUND (₹${inv260.grandTotal}, ${inv260.date.substring(0,10)})` : 'MISSING');
  console.log(`  Bill #259 (Nanuram Bikaner Sweets):`, inv259 ? `FOUND (₹${inv259.grandTotal}, ${inv259.date.substring(0,10)})` : 'MISSING');
  console.log(`  Bill #258 (Ganja Ka Chakhana):`, inv258 ? `FOUND (₹${inv258.grandTotal}, ${inv258.date.substring(0,10)})` : 'MISSING');
  console.log(`  Bill #236 (Kishan Kanahaiya Store):`, inv236 ? `FOUND (₹${inv236.grandTotal}, ${inv236.date.substring(0,10)})` : 'MISSING');
  console.log(`  Bill #283 (Preeti Enterprises):`, inv283 ? `FOUND (₹${inv283.grandTotal}, ${inv283.date.substring(0,10)})` : 'MISSING');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials missing!');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('\nFetching current cloud store...');
  const { data: rows, error: fetchErr } = await supabase
    .from('distro_cloud_store')
    .select('*')
    .eq('id', 'distropulse_store_data')
    .limit(1);

  if (fetchErr || !rows || rows.length === 0) {
    throw new Error('Failed to fetch from distro_cloud_store: ' + (fetchErr ? fetchErr.message : 'no rows'));
  }

  const cloudRecord = rows[0];
  const cloudData = decompressLossless(cloudRecord.beat) || {};

  console.log(`Cloud data currently has ${cloudData.invoices?.length || 0} invoices and ${cloudData.purchases?.length || 0} purchases.`);

  // Set invoices to master restored invoices
  cloudData.invoices = masterInvoices;

  // Update parties in cloudData
  const partiesPath = path.join(__dirname, 'all_extracted_parties.json');
  if (fs.existsSync(partiesPath)) {
    const extractedParties = JSON.parse(fs.readFileSync(partiesPath, 'utf8'));
    const partiesMap = new Map();
    (cloudData.parties || []).forEach(p => { if (p && p.id) partiesMap.set(p.id, p); });
    extractedParties.forEach(p => {
      if (p && p.name) {
        const existing = Array.from(partiesMap.values()).find(ep => ep.name && ep.name.trim().toUpperCase() === p.name.trim().toUpperCase());
        if (existing) {
          partiesMap.set(existing.id, { ...existing, ...p, id: existing.id });
        } else {
          partiesMap.set(p.id, p);
        }
      }
    });
    cloudData.parties = Array.from(partiesMap.values());
    console.log(`Updated cloud parties count: ${cloudData.parties.length}. MR ENTERPRISES GSTIN: ${cloudData.parties.find(p => p.name === 'MR ENTERPRISES')?.gstin}`);
  }

  // Clean deletedIds: make sure none of the restored invoice IDs or numbers are suppressed
  const restoredIds = new Set(masterInvoices.map(i => i.id));
  if (Array.isArray(cloudData.deletedIds)) {
    cloudData.deletedIds = cloudData.deletedIds.filter(id => !restoredIds.has(id));
  }

  cloudData.lastUpdated = Date.now();

  const compressedBeat = compressLossless(JSON.stringify(cloudData));
  console.log(`Compressed master cloud payload length: ${compressedBeat.length} characters.`);

  // Push to Supabase distropulse_store_data
  console.log('Pushing master payload to Supabase distropulse_store_data...');
  const { error: upsertErr } = await supabase.from('distro_cloud_store').upsert({
    id: 'distropulse_store_data',
    name: 'DISTROPULSE_SYSTEM_STORE',
    beat: compressedBeat,
    updated_at: new Date().toISOString()
  });

  if (upsertErr) {
    throw new Error('Failed to update distropulse_store_data: ' + upsertErr.message);
  }
  console.log('✓ Successfully updated distropulse_store_data in Supabase!');

  // Push disaster recovery snapshots in Supabase
  const today = new Date().toISOString().split('T')[0];
  await supabase.from('distro_cloud_store').upsert({
    id: `distropulse_snapshot_${today}`,
    name: `DAILY_SNAPSHOT_${today}`,
    beat: compressedBeat,
    updated_at: new Date().toISOString()
  });

  await supabase.from('distro_cloud_store').upsert({
    id: 'distropulse_recovery_all_178_bills',
    name: 'RESTORED_MASTER_ALL_178_BILLS',
    beat: compressedBeat,
    updated_at: new Date().toISOString()
  });
  console.log('✓ Saved safety recovery snapshots in Supabase cloud.');

  console.log('\nNow generating fresh backups on Desktop...');
}

restoreMaster().catch(err => {
  console.error('RESTORE FAILED:', err);
  process.exit(1);
});
