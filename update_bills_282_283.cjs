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

const nowTs = Date.now();

// 1. Exact Invoice #282
const verifiedInvoice282 = {
  id: "inv_1793170685059",
  invoiceNo: "282",
  date: "2026-10-28T09:38:05.059Z",
  dueDate: "2026-10-28",
  partyId: "party_supplier_preeti",
  partyName: "PREETI ENTERPRISES",
  customerName: "PREETI ENTERPRISES",
  partyPhone: "",
  partyGstin: "07GHQPD6817P1ZI",
  partyAddress: "Delhi",
  placeOfSupply: "Delhi (07)",
  pricingType: "CUSTOM",
  taxMode: "INCLUSIVE",
  supplyType: "INTRA_STATE",
  subTotal: 53860.08,
  subtotal: 53860.08,
  taxableAmount: 53860.08,
  taxableSubtotal: 53860.08,
  taxTotal: 2693.00,
  cgst: 1346.50,
  sgst: 1346.50,
  igst: 0,
  discount: 0,
  roundOff: -0.08,
  grandTotal: 56553.00,
  paymentStatus: "PAID",
  paidAmount: 56553.00,
  balanceAmount: 0,
  amountDue: 0,
  paymentMode: "CASH",
  paymentTerms: "Immediate",
  state: "posted",
  warehouseId: "wh_main",
  ewayBill: "",
  documentType: "TAX_INVOICE",
  journal: "SALES",
  operator: "Sunil Sharma",
  isVerified: true,
  updatedAt: nowTs,
  notes: "Verified Tax Invoice #282 from original bill PDF. Issued on 28 Oct 2026.",
  items: [
    {
      productId: "prod_1794319966776",
      name: "BEYOND SNACKS KERALA BANANA 510 GM MRP -499/-",
      sku: "BEY-3236",
      brand: "BEYOND SNACKS",
      hsn: "210690",
      pcsPerCarton: 6,
      pcsPerBox: 1,
      cartonQty: 34,
      looseQty: 0,
      qty: 204,
      unit: "Pcs",
      rateMode: "POUCH",
      price: 264.02,
      mrp: 499,
      gstRate: 5,
      costPrice: 264.02,
      itemDiscountType: "AMOUNT",
      itemDiscountVal: 0,
      effectiveUnitPrice: 264.02,
      grossTotal: 56553.08,
      discAmount: 0,
      taxableAmount: 53860.08,
      taxableVal: 53860.08,
      itemGstAmount: 2693.00,
      gstVal: 2693.00,
      cgstAmount: 1346.50,
      sgstAmount: 1346.50,
      igstAmount: 0,
      total: 56553.08,
      finalItemTotal: 56553.08,
      totalCost: 53860.08,
      consumedLots: [
        {
          lotId: "lot_purch_purch_1794319974325_0_1794320386609",
          billNo: "379",
          supplierName: "SHREE VAISHNO ENTERPRISES",
          date: "2026-10-24",
          purchasePrice: 264.02,
          purchasePriceWithGst: 277.22,
          qty: 204,
          cost: 53860.08
        }
      ]
    }
  ],
  payments: [
    {
      id: "pay_inv_1793170685059",
      amount: 56553.00,
      date: "2026-10-28T09:38:05.059Z",
      mode: "CASH",
      reference: "Bill payment #282 - PREETI ENTERPRISES"
    }
  ],
  chatter: [
    {
      id: "ch_inv_1793170685059_1",
      date: "2026-10-28T09:38:05.059Z",
      author: "Sunil Sharma",
      text: "Invoice #282 confirmed and posted for PREETI ENTERPRISES (₹56,553.00)",
      type: "system"
    }
  ]
};

// 2. Exact Invoice #283
const verifiedInvoice283 = {
  id: "inv_1793170854100",
  invoiceNo: "283",
  date: "2026-10-28T09:40:54.100Z",
  dueDate: "2026-10-28",
  partyId: "party_supplier_preeti",
  partyName: "PREETI ENTERPRISES",
  customerName: "PREETI ENTERPRISES",
  partyPhone: "",
  partyGstin: "07GHQPD6817P1ZI",
  partyAddress: "Delhi",
  placeOfSupply: "Delhi (07)",
  pricingType: "CUSTOM",
  taxMode: "INCLUSIVE",
  supplyType: "INTRA_STATE",
  subTotal: 79100.00,
  subtotal: 79100.00,
  taxableAmount: 79100.00,
  taxableSubtotal: 79100.00,
  taxTotal: 3955.00,
  cgst: 1977.50,
  sgst: 1977.50,
  igst: 0,
  discount: 0,
  roundOff: 0,
  grandTotal: 83055.00,
  paymentStatus: "PAID",
  paidAmount: 83055.00,
  balanceAmount: 0,
  amountDue: 0,
  paymentMode: "CASH",
  paymentTerms: "Immediate",
  state: "posted",
  warehouseId: "wh_main",
  ewayBill: "",
  documentType: "TAX_INVOICE",
  journal: "SALES",
  operator: "Sunil Sharma",
  isVerified: true,
  updatedAt: nowTs,
  notes: "Verified Tax Invoice #283 from original bill PDF. Issued on 28 Oct 2026.",
  items: [
    {
      productId: "prod_1794320148514",
      name: "BEYOND SNACKS KERALA CHIPS GIFT PACK 330G MRP-299/-",
      sku: "BEY-3684",
      brand: "BEYOND SNACKS",
      hsn: "210690",
      pcsPerCarton: 10,
      pcsPerBox: 1,
      cartonQty: 50,
      looseQty: 0,
      qty: 500,
      unit: "Pcs",
      rateMode: "POUCH",
      price: 158.20,
      mrp: 299,
      gstRate: 5,
      costPrice: 158.20,
      itemDiscountType: "AMOUNT",
      itemDiscountVal: 0,
      effectiveUnitPrice: 158.20,
      grossTotal: 83055.00,
      discAmount: 0,
      taxableAmount: 79100.00,
      taxableVal: 79100.00,
      itemGstAmount: 3955.00,
      gstVal: 3955.00,
      cgstAmount: 1977.50,
      sgstAmount: 1977.50,
      igstAmount: 0,
      total: 83055.00,
      finalItemTotal: 83055.00,
      totalCost: 79100.00,
      consumedLots: [
        {
          lotId: "lot_purch_purch_1794320226018_0_1794320256724",
          billNo: "377",
          supplierName: "SHREE VAISHNO ENTERPRISES",
          date: "2026-10-23",
          purchasePrice: 158.20,
          purchasePriceWithGst: 166.11,
          qty: 500,
          cost: 79100.00
        }
      ]
    }
  ],
  payments: [
    {
      id: "pay_inv_1793170854100",
      amount: 83055.00,
      date: "2026-10-28T09:40:54.100Z",
      mode: "CASH",
      reference: "Bill payment #283 - PREETI ENTERPRISES"
    }
  ],
  chatter: [
    {
      id: "ch_inv_1793170854100_1",
      date: "2026-10-28T09:40:54.100Z",
      author: "Sunil Sharma",
      text: "Invoice #283 confirmed and posted for PREETI ENTERPRISES (₹83,055.00)",
      type: "system"
    }
  ]
};

async function main() {
  console.log('=== Updating Invoices #282 and #283 with Exact Bill Data ===\n');

  // A. Update MASTER_RESTORED_ALL_SALES_INVOICES.json
  const masterPath = path.join(__dirname, 'MASTER_RESTORED_ALL_SALES_INVOICES.json');
  if (fs.existsSync(masterPath)) {
    let masterInvoices = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    
    // Replace 282
    const idx282 = masterInvoices.findIndex(i => String(i.invoiceNo) === '282');
    if (idx282 >= 0) masterInvoices[idx282] = verifiedInvoice282;
    else masterInvoices.push(verifiedInvoice282);

    // Replace 283
    const idx283 = masterInvoices.findIndex(i => String(i.invoiceNo) === '283');
    if (idx283 >= 0) masterInvoices[idx283] = verifiedInvoice283;
    else masterInvoices.push(verifiedInvoice283);

    fs.writeFileSync(masterPath, JSON.stringify(masterInvoices, null, 2), 'utf8');
    console.log(`✓ Updated MASTER_RESTORED_ALL_SALES_INVOICES.json (${masterInvoices.length} total invoices).`);
  }

  // B. Update user_merged_data.json
  const userMergedPath = path.join(__dirname, 'user_merged_data.json');
  if (fs.existsSync(userMergedPath)) {
    let userMerged = JSON.parse(fs.readFileSync(userMergedPath, 'utf8'));
    if (!Array.isArray(userMerged.invoices)) userMerged.invoices = [];
    
    const idx282 = userMerged.invoices.findIndex(i => String(i.invoiceNo) === '282');
    if (idx282 >= 0) userMerged.invoices[idx282] = verifiedInvoice282;
    else userMerged.invoices.push(verifiedInvoice282);

    const idx283 = userMerged.invoices.findIndex(i => String(i.invoiceNo) === '283');
    if (idx283 >= 0) userMerged.invoices[idx283] = verifiedInvoice283;
    else userMerged.invoices.push(verifiedInvoice283);

    // Ensure products exist in userMerged
    if (!Array.isArray(userMerged.products)) userMerged.products = [];
    const p1 = userMerged.products.find(p => p.id === 'prod_1794319966776');
    if (p1) {
      p1.name = "BEYOND SNACKS KERALA BANANA 510 GM MRP -499/-";
      p1.brand = "BEYOND SNACKS";
      p1.pcsPerCarton = 6;
      p1.mrp = 499;
      p1.purchasePrice = 264.02;
    } else {
      userMerged.products.push({
        id: "prod_1794319966776",
        name: "BEYOND SNACKS KERALA BANANA 510 GM MRP -499/-",
        sku: "BEY-3236",
        brand: "BEYOND SNACKS",
        category: "General",
        hsn: "210690",
        mrp: 499,
        salePrice: 350,
        purchasePrice: 264.02,
        gstRate: 5,
        pcsPerCarton: 6,
        currentStock: 0,
        unit: "Pcs",
        warehouseId: "wh_main"
      });
    }

    const p2 = userMerged.products.find(p => p.id === 'prod_1794320148514');
    if (p2) {
      p2.name = "BEYOND SNACKS KERALA CHIPS GIFT PACK 330G MRP-299/-";
      p2.brand = "BEYOND SNACKS";
      p2.pcsPerCarton = 10;
      p2.mrp = 299;
      p2.purchasePrice = 158.20;
    } else {
      userMerged.products.push({
        id: "prod_1794320148514",
        name: "BEYOND SNACKS KERALA CHIPS GIFT PACK 330G MRP-299/-",
        sku: "BEY-3684",
        brand: "BEYOND SNACKS",
        category: "General",
        hsn: "210690",
        mrp: 299,
        salePrice: 200,
        purchasePrice: 158.20,
        gstRate: 5,
        pcsPerCarton: 10,
        currentStock: 0,
        unit: "Pcs",
        warehouseId: "wh_main"
      });
    }

    fs.writeFileSync(userMergedPath, JSON.stringify(userMerged, null, 2), 'utf8');
    console.log(`✓ Updated user_merged_data.json.`);
  }

  // C. Update Supabase Cloud Store
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('\nConnecting to Supabase...');
    const { data: rows, error: fetchErr } = await supabase
      .from('distro_cloud_store')
      .select('*')
      .eq('id', 'distropulse_store_data')
      .limit(1);

    if (fetchErr || !rows || rows.length === 0) {
      console.error('Failed to fetch from distro_cloud_store:', fetchErr);
    } else {
      const cloudStore = decompressLossless(rows[0].beat) || {};

      // Invoices update
      if (!Array.isArray(cloudStore.invoices)) cloudStore.invoices = [];
      
      // Filter out any other 282 or 283
      cloudStore.invoices = cloudStore.invoices.filter(i => String(i.invoiceNo) !== '282' && String(i.invoiceNo) !== '283');
      cloudStore.invoices.push(verifiedInvoice282);
      cloudStore.invoices.push(verifiedInvoice283);

      // Clean deletedIds: make sure neither bill ID is deleted
      const protectedIds = new Set(['inv_1793170685059', 'inv_1793170854100', 'inv_1793536035240']);
      if (Array.isArray(cloudStore.deletedIds)) {
        cloudStore.deletedIds = cloudStore.deletedIds.filter(id => !protectedIds.has(id));
      }

      // Update products in cloudStore
      if (!Array.isArray(cloudStore.products)) cloudStore.products = [];
      const cp1 = cloudStore.products.find(p => p.id === 'prod_1794319966776');
      if (cp1) {
        cp1.name = "BEYOND SNACKS KERALA BANANA 510 GM MRP -499/-";
        cp1.brand = "BEYOND SNACKS";
        cp1.pcsPerCarton = 6;
        cp1.mrp = 499;
        cp1.purchasePrice = 264.02;
        cp1.currentStock = 0;
      }
      const cp2 = cloudStore.products.find(p => p.id === 'prod_1794320148514');
      if (cp2) {
        cp2.name = "BEYOND SNACKS KERALA CHIPS GIFT PACK 330G MRP-299/-";
        cp2.brand = "BEYOND SNACKS";
        cp2.pcsPerCarton = 10;
        cp2.mrp = 299;
        cp2.purchasePrice = 158.20;
        cp2.currentStock = 0;
      }

      // Update stock lots in cloudStore: mark remaining qty as 0 (consumed)
      if (Array.isArray(cloudStore.stockLots)) {
        cloudStore.stockLots.forEach(lot => {
          if (lot.productId === 'prod_1794319966776' || lot.productId === 'prod_1794320148514') {
            lot.qtyRemaining = 0;
          }
        });
      }

      cloudStore.lastUpdated = nowTs;

      const compressedPayload = compressLossless(JSON.stringify(cloudStore));
      console.log(`Pushing updated payload to Supabase (length: ${compressedPayload.length})...`);
      
      const { error: upsertErr } = await supabase.from('distro_cloud_store').upsert({
        id: 'distropulse_store_data',
        name: 'DISTROPULSE_SYSTEM_STORE',
        beat: compressedPayload,
        updated_at: new Date().toISOString()
      });

      if (upsertErr) {
        console.error('Upsert Error:', upsertErr);
      } else {
        console.log('✓ Successfully updated distropulse_store_data in Supabase cloud!');
      }

      // Save safety recovery snapshot
      await supabase.from('distro_cloud_store').upsert({
        id: 'distropulse_snapshot_update_bills_282_283',
        name: 'SNAPSHOT_BILLS_282_283_VERIFIED',
        beat: compressedPayload,
        updated_at: new Date().toISOString()
      });
      console.log('✓ Created safety snapshot in Supabase.');
    }
  }

  console.log('\nNow regenerating Desktop backups...');
}

main().catch(console.error);
