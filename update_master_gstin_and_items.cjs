const fs = require('fs');
const path = require('path');

console.log('=== Updating Master Dataset with verified GSTIN and Exact Bill Items ===');

// 1. Update MASTER_RESTORED_ALL_SALES_INVOICES.json
const masterPath = path.join(__dirname, 'MASTER_RESTORED_ALL_SALES_INVOICES.json');
const invoices = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

// Exact items for Invoice 261 (MR ENTERPRISES) from user bill screenshot
const mrEnterprisesItems = [
  {
    productId: 'prod_1790511542352',
    name: 'BS TOMATO - MRP-20/-',
    sku: 'SKU-4033',
    brand: 'BEYOND SNACKS',
    hsn: '210690',
    pcsPerCarton: 75,
    pcsPerBox: 1,
    cartonQty: 3,
    looseQty: 0,
    qty: 225,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 13.88,
    mrp: 20,
    gstRate: 5,
    costPrice: 13.22,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 13.88,
    grossTotal: 3123.00,
    discAmount: 0,
    taxableAmount: 2974.29,
    taxableVal: 2974.29,
    itemGstAmount: 148.71,
    gstVal: 148.71,
    cgstAmount: 74.36,
    sgstAmount: 74.36,
    igstAmount: 0,
    total: 3123.00,
    finalItemTotal: 3123.00,
    totalCost: 2974.50
  },
  {
    productId: 'prod_1790511436640',
    name: 'BS MASALA - MRP-20/-',
    sku: 'SKU-8239',
    brand: 'BEYOND SNACKS',
    hsn: '210690',
    pcsPerCarton: 75,
    pcsPerBox: 1,
    cartonQty: 3,
    looseQty: 0,
    qty: 225,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 13.88,
    mrp: 20,
    gstRate: 5,
    costPrice: 13.22,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 13.88,
    grossTotal: 3123.00,
    discAmount: 0,
    taxableAmount: 2974.29,
    taxableVal: 2974.29,
    itemGstAmount: 148.71,
    gstVal: 148.71,
    cgstAmount: 74.36,
    sgstAmount: 74.36,
    igstAmount: 0,
    total: 3123.00,
    finalItemTotal: 3123.00,
    totalCost: 2974.50
  },
  {
    productId: 'prod_1790511246158',
    name: 'BS PUDINA - MRP-20/-',
    sku: 'SKU-8989',
    brand: 'BEYOND SNACKS',
    hsn: '210690',
    pcsPerCarton: 75,
    pcsPerBox: 1,
    cartonQty: 3,
    looseQty: 0,
    qty: 225,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 13.88,
    mrp: 20,
    gstRate: 5,
    costPrice: 13.22,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 13.88,
    grossTotal: 3123.00,
    discAmount: 0,
    taxableAmount: 2974.29,
    taxableVal: 2974.29,
    itemGstAmount: 148.71,
    gstVal: 148.71,
    cgstAmount: 74.36,
    sgstAmount: 74.36,
    igstAmount: 0,
    total: 3123.00,
    finalItemTotal: 3123.00,
    totalCost: 2974.50
  },
  {
    productId: 'prod_1790511164075',
    name: 'BS ACHARI - MRP-20/-',
    sku: 'SKU-4478',
    brand: 'BEYOND SNACKS',
    hsn: '210690',
    pcsPerCarton: 75,
    pcsPerBox: 1,
    cartonQty: 3,
    looseQty: 0,
    qty: 225,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 13.88,
    mrp: 20,
    gstRate: 5,
    costPrice: 13.22,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 13.88,
    grossTotal: 3123.00,
    discAmount: 0,
    taxableAmount: 2974.29,
    taxableVal: 2974.29,
    itemGstAmount: 148.71,
    gstVal: 148.71,
    cgstAmount: 74.35,
    sgstAmount: 74.35,
    igstAmount: 0,
    total: 3123.00,
    finalItemTotal: 3123.00,
    totalCost: 2974.50
  }
];

// Update Invoice 261
const inv261 = invoices.find(i => String(i.invoiceNo) === '261');
if (inv261) {
  inv261.partyId = 'party_mr_enterprises_matiala';
  inv261.partyName = 'MR ENTERPRISES';
  inv261.customerName = 'MR ENTERPRISES';
  inv261.partyGstin = '07CKQPA7563Q1ZB';
  inv261.partyAddress = 'GROUND FLOOR, BACK SIDE KH NO 30/7 VILLAGE MATIALA, PLOT NO 6, Mansa Ram Nanhey Park Road, Sheetla Balloon Decoration Shop, Matiyala, New Delhi, West Delhi, Delhi, 110059';
  inv261.items = mrEnterprisesItems;
  inv261.subTotal = 11897.14;
  inv261.subtotal = 11897.14;
  inv261.taxableAmount = 11897.14;
  inv261.taxableSubtotal = 11897.14;
  inv261.taxTotal = 594.86;
  inv261.cgst = 297.43;
  inv261.sgst = 297.43;
  inv261.grandTotal = 12492.00;
  inv261.paidAmount = 12492.00;
  console.log('✓ Invoice #261 updated with GSTIN 07CKQPA7563Q1ZB and 4 Beyond Snacks cartons.');
}

// Items for Invoice 260 (S N MART)
const snMartItems = [
  {
    productId: 'prod_1790481627866',
    name: 'FALHARI - MRP-35/-',
    sku: 'SKU-5110',
    brand: 'SIFI PARKASH',
    hsn: '21069099',
    pcsPerCarton: 50,
    pcsPerBox: 1,
    cartonQty: 0,
    looseQty: 25,
    qty: 25,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 27.00,
    mrp: 35,
    gstRate: 5,
    costPrice: 22.07,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 27.00,
    grossTotal: 675.00,
    discAmount: 0,
    taxableAmount: 642.86,
    taxableVal: 642.86,
    itemGstAmount: 32.14,
    gstVal: 32.14,
    cgstAmount: 16.07,
    sgstAmount: 16.07,
    igstAmount: 0,
    total: 675.00,
    finalItemTotal: 675.00,
    totalCost: 551.75
  },
  {
    productId: 'prod_1790511352175',
    name: 'BS SENDHA NAMAK - MRP-20/-',
    sku: 'SKU-7721',
    brand: 'BEYOND SNACKS',
    hsn: '210690',
    pcsPerCarton: 75,
    pcsPerBox: 1,
    cartonQty: 0,
    looseQty: 50,
    qty: 50,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 15.00,
    mrp: 20,
    gstRate: 5,
    costPrice: 13.22,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 15.00,
    grossTotal: 750.00,
    discAmount: 0,
    taxableAmount: 714.28,
    taxableVal: 714.28,
    itemGstAmount: 35.72,
    gstVal: 35.72,
    cgstAmount: 17.86,
    sgstAmount: 17.86,
    igstAmount: 0,
    total: 750.00,
    finalItemTotal: 750.00,
    totalCost: 661.00
  }
];

// Update Invoice 260
const inv260 = invoices.find(i => String(i.invoiceNo) === '260');
if (inv260) {
  inv260.partyId = 'party_1791509089626';
  inv260.partyName = 'S N MART ';
  inv260.customerName = 'S N MART ';
  inv260.partyPhone = '9017690160';
  inv260.partyGstin = '07CLIPK0898R1Z5';
  inv260.partyAddress = 'GROUND FLOOR KH. NO. 46/12 BAKKARWALA VILLAGE  NEW DELHI 110041';
  inv260.items = snMartItems;
  inv260.subTotal = 1357.14;
  inv260.subtotal = 1357.14;
  inv260.taxableAmount = 1357.14;
  inv260.taxableSubtotal = 1357.14;
  inv260.taxTotal = 67.86;
  inv260.cgst = 33.93;
  inv260.sgst = 33.93;
  inv260.grandTotal = 1425.00;
  inv260.paidAmount = 1425.00;
  console.log('✓ Invoice #260 updated with GSTIN 07CLIPK0898R1Z5 and Falhari + Beyond Snacks items.');
}

// Items for Invoice 259 (NANURAM BIKANER SWEET)
const nanuramItems = [
  {
    productId: 'prod_1790511542352',
    name: 'BS TOMATO - MRP-20/-',
    sku: 'SKU-4033',
    brand: 'BEYOND SNACKS',
    hsn: '210690',
    pcsPerCarton: 75,
    pcsPerBox: 1,
    cartonQty: 1,
    looseQty: 0,
    qty: 75,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 15.00,
    mrp: 20,
    gstRate: 5,
    costPrice: 13.22,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 15.00,
    grossTotal: 1125.00,
    discAmount: 0,
    taxableAmount: 1071.43,
    taxableVal: 1071.43,
    itemGstAmount: 53.57,
    gstVal: 53.57,
    cgstAmount: 26.79,
    sgstAmount: 26.79,
    igstAmount: 0,
    total: 1125.00,
    finalItemTotal: 1125.00,
    totalCost: 991.50
  },
  {
    productId: 'prod_1790511436640',
    name: 'BS MASALA - MRP-20/-',
    sku: 'SKU-8239',
    brand: 'BEYOND SNACKS',
    hsn: '210690',
    pcsPerCarton: 75,
    pcsPerBox: 1,
    cartonQty: 1,
    looseQty: 0,
    qty: 75,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 15.00,
    mrp: 20,
    gstRate: 5,
    costPrice: 13.22,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 15.00,
    grossTotal: 1125.00,
    discAmount: 0,
    taxableAmount: 1071.43,
    taxableVal: 1071.43,
    itemGstAmount: 53.57,
    gstVal: 53.57,
    cgstAmount: 26.79,
    sgstAmount: 26.79,
    igstAmount: 0,
    total: 1125.00,
    finalItemTotal: 1125.00,
    totalCost: 991.50
  },
  {
    productId: 'prod_1790511246158',
    name: 'BS PUDINA - MRP-20/-',
    sku: 'SKU-8989',
    brand: 'BEYOND SNACKS',
    hsn: '210690',
    pcsPerCarton: 75,
    pcsPerBox: 1,
    cartonQty: 1,
    looseQty: 0,
    qty: 75,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 15.00,
    mrp: 20,
    gstRate: 5,
    costPrice: 13.22,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 15.00,
    grossTotal: 1125.00,
    discAmount: 0,
    taxableAmount: 1071.43,
    taxableVal: 1071.43,
    itemGstAmount: 53.57,
    gstVal: 53.57,
    cgstAmount: 26.78,
    sgstAmount: 26.78,
    igstAmount: 0,
    total: 1125.00,
    finalItemTotal: 1125.00,
    totalCost: 991.50
  },
  {
    productId: 'prod_1790511164075',
    name: 'BS ACHARI - MRP-20/-',
    sku: 'SKU-4478',
    brand: 'BEYOND SNACKS',
    hsn: '210690',
    pcsPerCarton: 75,
    pcsPerBox: 1,
    cartonQty: 1,
    looseQty: 0,
    qty: 75,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 15.00,
    mrp: 20,
    gstRate: 5,
    costPrice: 13.22,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 15.00,
    grossTotal: 1125.00,
    discAmount: 0,
    taxableAmount: 1071.43,
    taxableVal: 1071.43,
    itemGstAmount: 53.57,
    gstVal: 53.57,
    cgstAmount: 26.78,
    sgstAmount: 26.78,
    igstAmount: 0,
    total: 1125.00,
    finalItemTotal: 1125.00,
    totalCost: 991.50
  },
  {
    productId: 'prod_1790481627866',
    name: 'FALHARI - MRP-35/-',
    sku: 'SKU-5110',
    brand: 'SIFI PARKASH',
    hsn: '21069099',
    pcsPerCarton: 50,
    pcsPerBox: 1,
    cartonQty: 0,
    looseQty: 16,
    qty: 16,
    unit: 'Pcs',
    rateMode: 'POUCH',
    price: 27.8125,
    mrp: 35,
    gstRate: 5,
    costPrice: 22.07,
    itemDiscountType: 'AMOUNT',
    itemDiscountVal: 0,
    effectiveUnitPrice: 27.8125,
    grossTotal: 445.00,
    discAmount: 0,
    taxableAmount: 423.80,
    taxableVal: 423.80,
    itemGstAmount: 21.20,
    gstVal: 21.20,
    cgstAmount: 10.60,
    sgstAmount: 10.60,
    igstAmount: 0,
    total: 445.00,
    finalItemTotal: 445.00,
    totalCost: 353.12
  }
];

// Update Invoice 259
const inv259 = invoices.find(i => String(i.invoiceNo) === '259');
if (inv259) {
  inv259.partyId = 'party_nanuram_bikaner_sweet';
  inv259.partyName = 'NANURAM BIKANER SWEET';
  inv259.customerName = 'NANURAM BIKANER SWEET';
  inv259.partyAddress = 'Shop No. 1, E-561/C, Sector 7 Dwarka / Palam Extension, New Delhi 110045';
  inv259.items = nanuramItems;
  inv259.subTotal = 4709.52;
  inv259.subtotal = 4709.52;
  inv259.taxableAmount = 4709.52;
  inv259.taxableSubtotal = 4709.52;
  inv259.taxTotal = 235.48;
  inv259.cgst = 117.74;
  inv259.sgst = 117.74;
  inv259.grandTotal = 4945.00;
  console.log('✓ Invoice #259 updated with proper items & address.');
}

// Save back to MASTER_RESTORED_ALL_SALES_INVOICES.json
fs.writeFileSync(masterPath, JSON.stringify(invoices, null, 2), 'utf8');
console.log('✓ Saved updated MASTER_RESTORED_ALL_SALES_INVOICES.json');

// 2. Update all_extracted_parties.json
const partiesPath = path.join(__dirname, 'all_extracted_parties.json');
let extractedParties = [];
if (fs.existsSync(partiesPath)) {
  extractedParties = JSON.parse(fs.readFileSync(partiesPath, 'utf8'));
}

const mrParty = {
  name: 'MR ENTERPRISES',
  contactPerson: '',
  phone: '8851616522',
  city: 'MATIALA / DELHI',
  address: 'GROUND FLOOR, BACK SIDE KH NO 30/7 VILLAGE MATIALA, PLOT NO 6, Mansa Ram Nanhey Park Road, Sheetla Balloon Decoration Shop, Matiyala, New Delhi, West Delhi, Delhi, 110059',
  gstin: '07CKQPA7563Q1ZB',
  creditLimit: 50000,
  balance: 0,
  id: 'party_mr_enterprises_matiala'
};

const nanuParty = {
  name: 'NANURAM BIKANER SWEET',
  contactPerson: '',
  phone: '',
  city: 'DWARKA / DELHI',
  address: 'Shop No. 1, E-561/C, Sector 7 Dwarka / Palam Extension, New Delhi 110045',
  gstin: '',
  creditLimit: 50000,
  balance: 0,
  id: 'party_nanuram_bikaner_sweet'
};

// Add or update in extractedParties
const existingMrIdx = extractedParties.findIndex(p => p.name === 'MR ENTERPRISES');
if (existingMrIdx >= 0) extractedParties[existingMrIdx] = mrParty;
else extractedParties.push(mrParty);

const existingNanuIdx = extractedParties.findIndex(p => p.name === 'NANURAM BIKANER SWEET');
if (existingNanuIdx >= 0) extractedParties[existingNanuIdx] = nanuParty;
else extractedParties.push(nanuParty);

fs.writeFileSync(partiesPath, JSON.stringify(extractedParties, null, 2), 'utf8');
console.log(`✓ Saved all_extracted_parties.json (${extractedParties.length} parties).`);

// 3. Update user_merged_data.json
const userMergedPath = path.join(__dirname, 'user_merged_data.json');
if (fs.existsSync(userMergedPath)) {
  const mergedData = JSON.parse(fs.readFileSync(userMergedPath, 'utf8'));
  
  // Update parties array
  if (!Array.isArray(mergedData.parties)) mergedData.parties = [];
  const pMrIdx = mergedData.parties.findIndex(p => p.name === 'MR ENTERPRISES');
  if (pMrIdx >= 0) mergedData.parties[pMrIdx] = mrParty;
  else mergedData.parties.push(mrParty);

  const pNanuIdx = mergedData.parties.findIndex(p => p.name === 'NANURAM BIKANER SWEET');
  if (pNanuIdx >= 0) mergedData.parties[pNanuIdx] = nanuParty;
  else mergedData.parties.push(nanuParty);

  // Update invoices in mergedData
  mergedData.invoices = invoices;

  fs.writeFileSync(userMergedPath, JSON.stringify(mergedData, null, 2), 'utf8');
  console.log(`✓ Saved user_merged_data.json with updated parties and invoices.`);
}

console.log('=== All files updated successfully! ===');
