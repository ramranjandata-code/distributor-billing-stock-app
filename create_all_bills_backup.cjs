/**
 * Script to create complete, verified backup of all bills
 * (Sales Invoices & Purchase Bills) for JAI MAA SHARDEY ENTERPRISES
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const LZString = require('lz-string');
require('dotenv').config();

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str}"`;
  }
  return str;
}

function formatDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toISOString().split('T')[0];
  } catch (e) {
    return String(d);
  }
}

async function run() {
  console.log('=== DistroPulse ERP: Creating Complete Bills Backup ===');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials missing in .env!');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Connecting to cloud database...');
  const { data, error } = await supabase.from('distro_cloud_store').select('*').eq('id', 'distropulse_store_data');

  if (error || !data || !data[0] || !data[0].beat) {
    throw new Error('Failed to retrieve cloud store data: ' + (error ? error.message : 'empty data'));
  }

  let beat = data[0].beat;
  if (beat.startsWith('LZ64:')) beat = beat.substring(5);
  const decompressed = LZString.decompressFromBase64(beat);
  const cloudData = JSON.parse(decompressed);

  const business = cloudData.business || {};
  const invoices = cloudData.invoices || [];
  const purchases = cloudData.purchases || [];
  const products = cloudData.products || [];
  const parties = cloudData.parties || [];
  const suppliers = cloudData.suppliers || [];
  const warehouses = cloudData.warehouses || [];
  const stockLots = cloudData.stockLots || [];
  const currentOperator = cloudData.currentOperator || {};

  let auditLogs = [];
  let bankAccounts = [];
  let expenses = [];
  let proprietorCapital = {};
  if (fs.existsSync('user_merged_data.json')) {
    try {
      const um = JSON.parse(fs.readFileSync('user_merged_data.json', 'utf8'));
      if (Array.isArray(um.audit_logs)) auditLogs = um.audit_logs;
      if (Array.isArray(um.bank_accounts)) bankAccounts = um.bank_accounts;
      if (Array.isArray(um.expenses)) expenses = um.expenses;
      if (um.proprietor_capital) proprietorCapital = um.proprietor_capital;
    } catch (e) {}
  }

  const workspaceBackupDir = path.resolve(__dirname, 'backups');
  const desktopBackupDir = path.resolve(os.homedir(), 'Desktop', 'DistroPulse_Bills_Backup');

  if (!fs.existsSync(workspaceBackupDir)) fs.mkdirSync(workspaceBackupDir, { recursive: true });
  if (!fs.existsSync(desktopBackupDir)) fs.mkdirSync(desktopBackupDir, { recursive: true });

  console.log(`Target directories:\n 1. Workspace: ${workspaceBackupDir}\n 2. Desktop: ${desktopBackupDir}`);

  invoices.sort((a, b) => {
    const numA = parseInt(String(a.invoiceNo).replace(/\D/g, '')) || 0;
    const numB = parseInt(String(b.invoiceNo).replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  purchases.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  const totalSalesAmount = invoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  const totalPurchaseAmount = purchases.reduce((sum, p) => sum + (Number(p.grandTotal || p.totalAmount) || 0), 0);

  const masterBackup = {
    backupName: 'DistroPulse ERP - Complete Bills Backup',
    createdAt: new Date().toISOString(),
    business: business,
    summary: {
      salesInvoiceCount: invoices.length,
      purchaseBillCount: purchases.length,
      partiesCount: parties.length,
      productsCount: products.length,
      suppliersCount: suppliers.length,
      totalSalesAmount: totalSalesAmount,
      totalPurchaseAmount: totalPurchaseAmount
    },
    salesInvoices: invoices,
    purchaseBills: purchases,
    parties: parties,
    products: products,
    suppliers: suppliers,
    stockLots: stockLots,
    warehouses: warehouses,
    auditLogs: auditLogs
  };

  const restoreBackup = {
    version: '2.0.0',
    app: 'DistroPlus ERP',
    exportedAt: new Date().toISOString(),
    business: business,
    products: products,
    parties: parties,
    suppliers: suppliers,
    invoices: invoices,
    purchases: purchases,
    warehouses: warehouses,
    bankAccounts: bankAccounts,
    bankTransactions: [],
    expenses: expenses,
    proprietorCapital: proprietorCapital,
    auditLogs: auditLogs,
    salesReturns: [],
    invoiceHistory: []
  };

  const filesToWrite = [
    {
      name: 'ALL_BILLS_MASTER_BACKUP.json',
      content: JSON.stringify(masterBackup, null, 2)
    },
    {
      name: 'DISTROPULSE_ERP_RESTORE_BACKUP.json',
      content: JSON.stringify(restoreBackup, null, 2)
    },
    {
      name: 'SALES_INVOICES_ALL.json',
      content: JSON.stringify(invoices, null, 2)
    },
    {
      name: 'PURCHASE_BILLS_ALL.json',
      content: JSON.stringify(purchases, null, 2)
    }
  ];

  const BOM = '\uFEFF';

  const salesSummaryHeaders = [
    'Invoice No',
    'Date',
    'Customer / Party Name',
    'Customer Phone',
    'Customer GSTIN',
    'Customer Address',
    'Items Count',
    'SubTotal (Excl GST)',
    'CGST Amount',
    'SGST Amount',
    'IGST Amount',
    'Total GST',
    'Round Off',
    'Grand Total (INR)',
    'Payment Status',
    'Paid Amount',
    'Balance Due',
    'Payment Mode',
    'Due Date',
    'IRN / E-Invoice Ack',
    'Operator'
  ];

  const salesSummaryRows = invoices.map(inv => [
    escapeCsv(inv.invoiceNo),
    escapeCsv(formatDate(inv.date)),
    escapeCsv(inv.partyName || inv.customerName),
    escapeCsv(inv.partyPhone),
    escapeCsv(inv.partyGstin),
    escapeCsv(inv.partyAddress),
    escapeCsv((inv.items || []).length),
    escapeCsv(Number(inv.subTotal || inv.subtotal || inv.taxableAmount || 0).toFixed(2)),
    escapeCsv(Number(inv.cgst || 0).toFixed(2)),
    escapeCsv(Number(inv.sgst || 0).toFixed(2)),
    escapeCsv(Number(inv.igst || 0).toFixed(2)),
    escapeCsv(Number(inv.taxTotal || 0).toFixed(2)),
    escapeCsv(Number(inv.roundOff || 0).toFixed(2)),
    escapeCsv(Number(inv.grandTotal || 0).toFixed(2)),
    escapeCsv(inv.paymentStatus || 'UNPAID'),
    escapeCsv(Number(inv.paidAmount || 0).toFixed(2)),
    escapeCsv(Number(inv.balanceAmount !== undefined ? inv.balanceAmount : (inv.grandTotal - (inv.paidAmount || 0))).toFixed(2)),
    escapeCsv(inv.paymentMode || 'CASH'),
    escapeCsv(formatDate(inv.dueDate)),
    escapeCsv(inv.ackNo || inv.irn || ''),
    escapeCsv(inv.operator || '')
  ]);

  const salesSummaryCsv = BOM + [salesSummaryHeaders.join(','), ...salesSummaryRows.map(r => r.join(','))].join('\r\n');
  filesToWrite.push({ name: 'SALES_INVOICES_SUMMARY.csv', content: salesSummaryCsv });

  const salesItemsHeaders = [
    'Invoice No',
    'Invoice Date',
    'Customer Name',
    'Item Name',
    'SKU',
    'Brand',
    'Category',
    'HSN Code',
    'Quantity',
    'Unit',
    'Pcs Per Carton',
    'MRP',
    'Selling Price (Excl GST)',
    'GST Rate (%)',
    'Taxable Subtotal',
    'CGST Amount',
    'SGST Amount',
    'IGST Amount',
    'Item Total (INR)'
  ];

  const salesItemsRows = [];
  invoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const taxable = item.taxableAmount || (item.salePrice * item.qty) || 0;
      salesItemsRows.push([
        escapeCsv(inv.invoiceNo),
        escapeCsv(formatDate(inv.date)),
        escapeCsv(inv.partyName || inv.customerName),
        escapeCsv(item.name),
        escapeCsv(item.sku),
        escapeCsv(item.brand),
        escapeCsv(item.category),
        escapeCsv(item.hsn),
        escapeCsv(item.qty),
        escapeCsv(item.unit || 'Pcs'),
        escapeCsv(item.pcsPerCarton || 1),
        escapeCsv(Number(item.mrp || 0).toFixed(2)),
        escapeCsv(Number(item.salePrice || 0).toFixed(2)),
        escapeCsv(item.gstRate || 0),
        escapeCsv(Number(taxable).toFixed(2)),
        escapeCsv(Number(item.cgstAmount || (item.gstVal ? item.gstVal / 2 : 0)).toFixed(2)),
        escapeCsv(Number(item.sgstAmount || (item.gstVal ? item.gstVal / 2 : 0)).toFixed(2)),
        escapeCsv(Number(item.igstAmount || 0).toFixed(2)),
        escapeCsv(Number(item.total || item.finalItemTotal || 0).toFixed(2))
      ]);
    });
  });

  const salesItemsCsv = BOM + [salesItemsHeaders.join(','), ...salesItemsRows.map(r => r.join(','))].join('\r\n');
  filesToWrite.push({ name: 'SALES_INVOICES_ITEMS_BREAKDOWN.csv', content: salesItemsCsv });

  const purchSummaryHeaders = [
    'Bill No',
    'Bill Date',
    'Supplier / Party Name',
    'Supplier GSTIN',
    'Warehouse',
    'Items Count',
    'SubTotal (Excl GST)',
    'Total GST',
    'Grand Total (INR)',
    'Created At'
  ];

  const purchSummaryRows = purchases.map(p => [
    escapeCsv(p.billNo || p.id),
    escapeCsv(formatDate(p.date)),
    escapeCsv(p.partyName || p.supplierName),
    escapeCsv(p.partyGst || p.supplierGstin),
    escapeCsv(p.warehouseId || 'wh_main'),
    escapeCsv((p.items || []).length),
    escapeCsv(Number(p.totalAmountExGst || 0).toFixed(2)),
    escapeCsv(Number(p.totalGst || 0).toFixed(2)),
    escapeCsv(Number(p.grandTotal || p.totalAmount || 0).toFixed(2)),
    escapeCsv(formatDate(p.createdAt))
  ]);

  const purchSummaryCsv = BOM + [purchSummaryHeaders.join(','), ...purchSummaryRows.map(r => r.join(','))].join('\r\n');
  filesToWrite.push({ name: 'PURCHASE_BILLS_SUMMARY.csv', content: purchSummaryCsv });

  const purchItemsHeaders = [
    'Bill No',
    'Bill Date',
    'Supplier Name',
    'Product Name',
    'SKU',
    'Brand',
    'Category',
    'HSN Code',
    'Batch No',
    'Expiry Date',
    'Quantity',
    'Unit',
    'MRP',
    'Purchase Price (Excl GST)',
    'GST Rate (%)',
    'Purchase Price (Incl GST)',
    'Taxable Total (Excl GST)',
    'Total Amount (Incl GST)'
  ];

  const purchItemsRows = [];
  purchases.forEach(p => {
    (p.items || []).forEach(item => {
      purchItemsRows.push([
        escapeCsv(p.billNo || p.id),
        escapeCsv(formatDate(p.date)),
        escapeCsv(p.partyName || p.supplierName),
        escapeCsv(item.name),
        escapeCsv(item.sku),
        escapeCsv(item.brand),
        escapeCsv(item.category),
        escapeCsv(item.hsn),
        escapeCsv(item.batchNo || ''),
        escapeCsv(item.expiryDate || ''),
        escapeCsv(item.qty),
        escapeCsv(item.unit || 'Pcs'),
        escapeCsv(Number(item.mrp || 0).toFixed(2)),
        escapeCsv(Number(item.purchasePrice || 0).toFixed(2)),
        escapeCsv(item.gstRate || 0),
        escapeCsv(Number(item.purchasePriceWithGst || 0).toFixed(2)),
        escapeCsv(Number(item.totalExGst || 0).toFixed(2)),
        escapeCsv(Number(item.totalWithGst || 0).toFixed(2))
      ]);
    });
  });

  const purchItemsCsv = BOM + [purchItemsHeaders.join(','), ...purchItemsRows.map(r => r.join(','))].join('\r\n');
  filesToWrite.push({ name: 'PURCHASE_BILLS_ITEMS_BREAKDOWN.csv', content: purchItemsCsv });

  const readmeMd = `# DistroPulse ERP - Bills & Complete System Backup
**Business**: ${business.name || 'JAI MAA SHARDEY ENTERPRISES'}  
**GSTIN**: ${business.gstin || '07HNPPK7350N1Z4'}  
**Backup Timestamp**: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}  

---

### Backup Overview
- **Sales Invoices**: ${invoices.length} bills (Invoices ${invoices[0] ? invoices[0].invoiceNo : ''} to ${invoices[invoices.length - 1] ? invoices[invoices.length - 1].invoiceNo : ''})
- **Total Sales Turnover**: ₹${totalSalesAmount.toLocaleString('en-IN')}
- **Purchase Bills**: ${purchases.length} bills
- **Total Purchase Amount**: ₹${totalPurchaseAmount.toLocaleString('en-IN')}
- **Registered Customers / Parties**: ${parties.length}
- **Catalog Products**: ${products.length}
- **Suppliers**: ${suppliers.length}
- **Stock Lots**: ${stockLots.length}

---

### File Inventory
1. **\`ALL_BILLS_MASTER_BACKUP.json\`**: Master consolidated JSON containing all sales bills, purchase bills, parties, products, and business info.
2. **\`DISTROPULSE_ERP_RESTORE_BACKUP.json\`**: Ready-to-use 1-click restore backup file for DistroPulse ERP (*Settings -> Restore Backup*).
3. **\`SALES_INVOICES_ALL.json\`**: Complete raw array of all ${invoices.length} sales invoices with line items and tax calculations.
4. **\`PURCHASE_BILLS_ALL.json\`**: Complete raw array of all ${purchases.length} purchase bills with line items.
5. **\`SALES_INVOICES_SUMMARY.csv\`**: Open in Microsoft Excel or Google Sheets for bill-by-bill sales report.
6. **\`SALES_INVOICES_ITEMS_BREAKDOWN.csv\`**: Open in Microsoft Excel for item-by-item sales breakdown.
7. **\`PURCHASE_BILLS_SUMMARY.csv\`**: Open in Microsoft Excel for purchase bills register.
8. **\`PURCHASE_BILLS_ITEMS_BREAKDOWN.csv\`**: Open in Microsoft Excel for item-by-item purchase inventory breakdown.
`;

  filesToWrite.push({ name: 'README_BACKUP_DETAILS.md', content: readmeMd });

  for (const f of filesToWrite) {
    fs.writeFileSync(path.join(workspaceBackupDir, f.name), f.content, 'utf8');
    fs.writeFileSync(path.join(desktopBackupDir, f.name), f.content, 'utf8');
    console.log(`  Created: ${f.name} (${(Buffer.byteLength(f.content, 'utf8') / 1024).toFixed(1)} KB)`);
  }

  console.log('Creating ZIP archive in PowerShell...');
  const zipPathWorkspace = path.join(workspaceBackupDir, 'DistroPulse_Bills_Backup.zip');
  const zipPathDesktop = path.join(os.homedir(), 'Desktop', 'DistroPulse_Bills_Backup.zip');

  const psZipCmd = `Compress-Archive -Path "${desktopBackupDir}\\*" -DestinationPath "${zipPathWorkspace}" -Force`;
  execSync(`powershell -Command "${psZipCmd}"`, { stdio: 'inherit' });

  fs.copyFileSync(zipPathWorkspace, zipPathDesktop);
  console.log('ZIP archives created:');
  console.log('  - ' + zipPathWorkspace);
  console.log('  - ' + zipPathDesktop);

  console.log('\n=== ALL BILLS BACKUP COMPLETED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('BACKUP FAILED:', err);
  process.exit(1);
});
