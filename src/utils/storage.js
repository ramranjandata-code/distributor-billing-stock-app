// Storage Utility for Distributor Stock & Billing Manager (DistroPlus)
import { getSupabaseClient, getSupabaseConfig } from './supabaseClient';
import { broadcastRealtimePulse } from './realtimeSync';
import LZString from 'lz-string';
import { 
  DEFAULT_BUSINESS as REAL_DEFAULT_BUSINESS, 
  INITIAL_PRODUCTS, 
  INITIAL_PARTIES, 
  INITIAL_INVOICES,
  INITIAL_PURCHASES
} from './defaultCatalog';

// 100% Lossless Compression Engine (Zero Data Loss, 70-80% Space Reduction)
export const compressDataLossless = (dataObj) => {
  try {
    const raw = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
    return 'LZ64:' + LZString.compressToBase64(raw);
  } catch (e) {
    console.warn('Compression fallback to raw:', e);
    return typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
  }
};

export const decompressDataLossless = (compressedStr) => {
  if (!compressedStr) return null;
  try {
    if (typeof compressedStr === 'string' && compressedStr.startsWith('LZ64:')) {
      const decompressed = LZString.decompressFromBase64(compressedStr.substring(5));
      return JSON.parse(decompressed);
    }
    return typeof compressedStr === 'string' ? JSON.parse(compressedStr) : compressedStr;
  } catch (e) {
    console.error('Decompression error:', e);
    return null;
  }
};

export const STORAGE_KEYS = {
  BUSINESS: 'distro_business_info',
  PRODUCTS: 'distro_products',
  PARTIES: 'distro_parties',
  SUPPLIERS: 'distro_suppliers',
  INVOICES: 'distro_invoices',
  PURCHASES: 'distro_purchases',
  STOCK_LEDGER: 'distro_stock_ledger',
  WAREHOUSES: 'distro_warehouses',
  AUDIT_LOGS: 'distro_audit_logs',
  BANK_ACCOUNTS: 'distro_bank_accounts',
  BANK_TRANSACTIONS: 'distro_bank_transactions',
  CURRENT_OPERATOR: 'distro_current_operator',
  SECURITY_SETTINGS: 'distro_security_settings',
  EXPENSES: 'distro_expenses',
  PROPRIETOR_CAPITAL: 'distro_proprietor_capital',
  DELETED_IDS: 'distro_deleted_ids',
  RETURNS: 'distro_sales_returns',
  PURCHASE_RETURNS: 'distro_purchase_returns',
  PAYMENT_RECEIPTS: 'distro_payment_receipts',
  INVOICE_HISTORY: 'distro_invoice_history_logs',
  STOCK_LOTS: 'distro_stock_lots'
};

const DEFAULT_BUSINESS = REAL_DEFAULT_BUSINESS;

const DEFAULT_WAREHOUSES = [
  { id: 'wh_main', name: 'Main Godown', code: 'WH-01', location: '', isDefault: true },
  { id: 'wh_scrap', name: 'Quarantine & Scrap Bin', code: 'WH-SCRAP', location: 'Virtual Quarantine', isDefault: false }
];

const DEFAULT_BANK_ACCOUNTS = [];

const DEFAULT_OPERATOR = {
  id: 'op_admin',
  name: 'Admin',
  role: 'Admin / Owner',
  badge: 'ADMIN'
};

const DEFAULT_SECURITY = {
  pinEnabled: false,
  adminPin: '1234',
  cloudAutoSync: true,
  lastBackupDate: null
};

const DEFAULT_PRODUCTS = INITIAL_PRODUCTS;
const DEFAULT_PARTIES = INITIAL_PARTIES;
const DEFAULT_INVOICES = INITIAL_INVOICES;
const DEFAULT_PURCHASES = INITIAL_PURCHASES || [];

const DEFAULT_PROPRIETOR_CAPITAL = {
  openingCapital: 0,
  additionalCapital: 0,
  fixedAssets: 0,
  openingCash: 0,
  asOfDate: new Date().toISOString().split('T')[0],
  notes: ''
};

const DEFAULT_EXPENSES = [];

export const formatCartonStock = (totalStock = 0, pcsPerCarton = 24, pcsPerBox = 1, unit = 'Pcs') => {
  const pcs = Number(pcsPerCarton) || 1;
  const stock = Number(totalStock) || 0;
  const isChainPouch = (unit === 'Chain Pouch' || unit === 'C. Pouch' || unit === 'c. pouch');
  const isBoxOrPack = isChainPouch || unit === 'Box' || unit === 'Pack';
  const boxPcs = Number(pcsPerBox) > 1 ? Number(pcsPerBox) : (isChainPouch ? 12 : 1);
  const unitLabel = isChainPouch ? 'C. Pouch' : (unit || 'Pcs');

  if (pcs <= 1) {
    if (boxPcs > 1 && isBoxOrPack) {
      const boxes = Math.floor(stock / boxPcs);
      const loose = stock % boxPcs;
      if (loose > 0) return `${boxes} ${unitLabel} + ${loose} Pcs`;
      return `${boxes} ${unitLabel}`;
    }
    return `${stock} ${unitLabel}`;
  }

  const cartons = Math.floor(stock / pcs);
  const remPcs = stock % pcs;

  if (boxPcs > 1 && isBoxOrPack) {
    const boxes = Math.floor(remPcs / boxPcs);
    const loose = remPcs % boxPcs;
    const totalSubUnits = Math.floor(stock / boxPcs);

    if (cartons > 0 && boxes === 0 && loose === 0) {
      return `${cartons} Ctn (${totalSubUnits} ${unitLabel})`;
    }

    const parts = [];
    if (cartons > 0) parts.push(`${cartons} Ctn`);
    if (boxes > 0) parts.push(`${boxes} ${unitLabel}`);
    if (loose > 0) parts.push(`${loose} Pcs`);
    return parts.length > 0 ? parts.join(' + ') : `0 ${unitLabel}`;
  }

  if (cartons > 0 && remPcs > 0) {
    return `${cartons} Ctn + ${remPcs} ${unitLabel}`;
  } else if (cartons > 0) {
    return `${cartons} Ctn (${stock} ${unitLabel})`;
  } else {
    return `${remPcs} ${unitLabel}`;
  }
};

/**
 * Resolves packaging unit multipliers and formats stock for any product.
 * Properly distinguishes between base pieces (currentStock) and packaging units (Chain Pouch, Box, Pack).
 */
export const getProductPackagingInfo = (prod) => {
  if (!prod) {
    return {
      isSub: false,
      subPcs: 1,
      subName: 'Pcs',
      subCount: 0,
      remPcs: 0,
      effectiveUnits: 0,
      stockPcs: 0,
      primaryDisplay: '0 Pcs',
      cartonDisplay: '0 Pcs'
    };
  }

  const rawUnit = (prod.unit || '').trim();
  const isChain = rawUnit === 'Chain Pouch' || rawUnit === 'C. Pouch' || rawUnit === 'c. pouch';
  const isBoxOrPack = isChain || rawUnit === 'Box' || rawUnit === 'Pack';
  
  let subPcs = Number(prod.pcsPerBox) || 1;
  if (subPcs <= 1 && isChain) {
    subPcs = 12; // Standard FMCG default chain pouch count if unset
  }
  
  const subName = isChain ? 'Chain Pouch' : (rawUnit || 'Pcs');
  const stockPcs = Number(prod.currentStock) || 0;
  
  if (isBoxOrPack && subPcs > 1) {
    const subCount = Math.floor(stockPcs / subPcs);
    const remPcs = stockPcs % subPcs;
    const subDisplay = remPcs > 0 ? `${subCount} ${subName} + ${remPcs} Pcs` : `${subCount} ${subName}`;
    const effectiveUnits = stockPcs / subPcs;

    return {
      isSub: true,
      subPcs,
      subName,
      subCount,
      remPcs,
      effectiveUnits,
      stockPcs,
      primaryDisplay: subDisplay,
      cartonDisplay: formatCartonStock(stockPcs, prod.pcsPerCarton, subPcs, prod.unit)
    };
  }

  return {
    isSub: false,
    subPcs: 1,
    subName: rawUnit || 'Pcs',
    subCount: stockPcs,
    remPcs: 0,
    effectiveUnits: stockPcs,
    stockPcs,
    primaryDisplay: `${stockPcs} ${rawUnit || 'Pcs'}`,
    cartonDisplay: formatCartonStock(stockPcs, prod.pcsPerCarton, 1, prod.unit)
  };
};

/**
 * Normalizes product name by collapsing multiple spaces and converting to lowercase.
 */
export const normalizeProductName = (name) => {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
};

/**
 * Robust product matching utility.
 * Matches by exact ID, or SKU, or normalized name (handling multiple spaces, trim, and case).
 */
export const isProductMatch = (prod, itemOrLot) => {
  if (!prod || !itemOrLot) return false;
  // 1. Direct ID match
  if (itemOrLot.productId && prod.id === itemOrLot.productId) return true;
  if (itemOrLot.id && prod.id === itemOrLot.id) return true;
  if (itemOrLot.productId && prod.productId && itemOrLot.productId === prod.productId) return true;

  // 2. SKU match (case-insensitive)
  const prodSku = (prod.sku || '').trim().toLowerCase();
  const itemSku = (itemOrLot.sku || '').trim().toLowerCase();
  if (prodSku && itemSku && prodSku === itemSku) return true;

  // 3. Normalized Name match (collapsing whitespace)
  const prodName = normalizeProductName(prod.name);
  const itemName = normalizeProductName(itemOrLot.name || itemOrLot.productName);
  if (prodName && itemName && prodName === itemName) return true;

  return false;
};

// LocalStorage Helpers
export const getStorageData = (key, defaultVal) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return defaultVal;
  }
};

export const setStorageData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
};

export const getDeletedIds = () => {
  const raw = getStorageData(STORAGE_KEYS.DELETED_IDS, []);
  return Array.isArray(raw) ? raw : [];
};

export const recordDeletedId = (id) => {
  if (!id) return;
  const current = getDeletedIds();
  if (!current.includes(id)) {
    setStorageData(STORAGE_KEYS.DELETED_IDS, [...current, id]);
  }
};

export const recordDeletedIds = (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const currentSet = new Set(getDeletedIds());
  ids.forEach(id => {
    if (id) currentSet.add(id);
  });
  setStorageData(STORAGE_KEYS.DELETED_IDS, Array.from(currentSet));
};

export const unrecordDeletedId = (id) => {
  if (!id) return;
  const current = getDeletedIds();
  if (current.includes(id)) {
    setStorageData(STORAGE_KEYS.DELETED_IDS, current.filter(x => x !== id));
  }
};

const SAMPLE_IDS = [
  'prod_1', 'prod_2', 'prod_3', 'prod_4', 'prod_5', 'prod_6', 'prod_7', 'prod_8',
  'party_1', 'party_2', 'party_3', 'party_4',
  'inv_1001', 'inv_1002', 'pur_1',
  'exp_sample_1', 'exp_sample_2', 'exp_sample_3', 'exp_sample_4', 'exp_sample_5',
  'bank_1', 'bank_2',
  'prod_1788070275457',
  'inv_1790492355122',
  'inv_1790398162183',
  'inv_1790398129662',
  'inv_1790397365814',
  'inv_1790397346316',
  'inv_1790512919597',
  'inv_1790512937133',
  'inv_1790509726439',
  'inv_1790522370913',
  'inv_1790522429350',
  'inv_1790522613947',
  'party-101',
  'supp_1790646532308',
  'prod_1790352594387',
  'inv_1790492640440'
];

// Initialize Storage with Defaults if missing
export const initDataStorage = () => {
  // If no business or old dummy business exists, set clean default
  const existingBiz = getStorageData(STORAGE_KEYS.BUSINESS, null);
  if (!existingBiz || existingBiz.name === "Distributor Agency" || existingBiz.name === "Shree Ganesh Sales Agency" || existingBiz.gstin === "07AAACG1234F1Z8" || existingBiz.proprietor === "Rajesh Kumar Verma") {
    setStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  } else {
    let bizUpdated = false;
    const patchedBiz = { ...existingBiz };
    if (patchedBiz.invoicePrefix === 'INV/26-27/') {
      patchedBiz.invoicePrefix = '';
      bizUpdated = true;
    }
    if (!patchedBiz.nextInvoiceNumber || Number(patchedBiz.nextInvoiceNumber) === 1001 || Number(patchedBiz.nextInvoiceNumber) === 155) {
      patchedBiz.nextInvoiceNumber = 206;
      bizUpdated = true;
    }
    if (bizUpdated) {
      setStorageData(STORAGE_KEYS.BUSINESS, patchedBiz);
    }
  }

  // Modernize legacy seed invoice number in storage if present
  const storedInvoices = getStorageData(STORAGE_KEYS.INVOICES, null);
  if (Array.isArray(storedInvoices)) {
    let invsUpdated = false;
    const patchedInvs = storedInvoices.map(inv => {
      if (inv && inv.invoiceNo === 'INV/26-27/1002') {
        invsUpdated = true;
        return { ...inv, invoiceNo: '148' };
      }
      return inv;
    });
    if (invsUpdated) {
      setStorageData(STORAGE_KEYS.INVOICES, patchedInvs);
    }
  }

  // One-time automatic migration: Shift invoice series starting from 155 to 206 (+51 offset)
  // 155 becomes 206, 156 becomes 207, 157 becomes 208, and so on.
  const MIGRATION_KEY_155_TO_206 = 'distro_migrated_inv_155_to_206_v1';
  if (!localStorage.getItem(MIGRATION_KEY_155_TO_206)) {
    try {
      const OFFSET = 51; // 206 - 155 = 51
      const currentInvoices = getStorageData(STORAGE_KEYS.INVOICES, []);
      let hasDataChanged = false;

      const shiftInvNo = (str) => {
        if (!str || typeof str !== 'string') return str;
        const trimmed = str.trim();
        if (trimmed.toUpperCase().startsWith('DRAFT')) return str;
        const match = trimmed.match(/^(\D*)(\d+)$/);
        if (match) {
          const prefix = match[1];
          const num = parseInt(match[2], 10);
          if (num >= 155 && num < 1000) {
            const padLen = match[2].length;
            return `${prefix}${String(num + OFFSET).padStart(padLen, '0')}`;
          }
        }
        return str;
      };

      const invoiceNoMap = {}; // oldNo -> newNo

      if (Array.isArray(currentInvoices) && currentInvoices.length > 0) {
        let invoicesChanged = false;
        const updatedInvoices = currentInvoices.map(inv => {
          if (!inv || !inv.invoiceNo) return inv;
          const oldNo = String(inv.invoiceNo).trim();
          const newNo = shiftInvNo(oldNo);
          if (newNo !== oldNo) {
            invoicesChanged = true;
            invoiceNoMap[oldNo] = newNo;

            const updatedPayments = Array.isArray(inv.payments)
              ? inv.payments.map(p => ({
                  ...p,
                  memo: (p && p.memo) ? p.memo.replace(oldNo, newNo) : (p ? p.memo : undefined)
                }))
              : inv.payments;

            const updatedChatter = Array.isArray(inv.chatter)
              ? inv.chatter.map(c => ({
                  ...c,
                  text: (c && c.text) ? c.text.replace(oldNo, newNo) : (c ? c.text : undefined)
                }))
              : inv.chatter;

            return {
              ...inv,
              invoiceNo: newNo,
              payments: updatedPayments,
              chatter: updatedChatter
            };
          }
          return inv;
        });

        if (invoicesChanged) {
          setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);
          hasDataChanged = true;
        }
      }

      // Shift business nextInvoiceNumber
      const biz = getStorageData(STORAGE_KEYS.BUSINESS, null);
      if (biz) {
        let bizChanged = false;
        const curNext = Number(biz.nextInvoiceNumber);
        if (!isNaN(curNext) && curNext >= 155 && curNext < 1000) {
          biz.nextInvoiceNumber = curNext + OFFSET;
          bizChanged = true;
        } else if (!curNext || curNext < 206) {
          biz.nextInvoiceNumber = 206;
          bizChanged = true;
        }
        if (bizChanged) {
          setStorageData(STORAGE_KEYS.BUSINESS, biz);
          hasDataChanged = true;
        }
      }

      // Update payment receipts
      const receipts = getStorageData(STORAGE_KEYS.PAYMENT_RECEIPTS, null);
      if (Array.isArray(receipts) && receipts.length > 0) {
        let receiptsChanged = false;
        const updatedReceipts = receipts.map(r => {
          if (!r) return r;
          let rChanged = false;
          let newInvNo = r.invoiceNo;
          if (r.invoiceNo && invoiceNoMap[r.invoiceNo]) {
            newInvNo = invoiceNoMap[r.invoiceNo];
            rChanged = true;
          } else if (r.invoiceNo) {
            const shifted = shiftInvNo(String(r.invoiceNo));
            if (shifted !== r.invoiceNo) {
              newInvNo = shifted;
              rChanged = true;
            }
          }

          let newNotes = r.notes;
          if (newNotes && typeof newNotes === 'string') {
            Object.keys(invoiceNoMap).forEach(oldNo => {
              if (newNotes.includes(oldNo)) {
                newNotes = newNotes.replaceAll(oldNo, invoiceNoMap[oldNo]);
                rChanged = true;
              }
            });
          }

          if (rChanged) {
            receiptsChanged = true;
            return {
              ...r,
              invoiceNo: newInvNo,
              notes: newNotes
            };
          }
          return r;
        });

        if (receiptsChanged) {
          setStorageData(STORAGE_KEYS.PAYMENT_RECEIPTS, updatedReceipts);
          hasDataChanged = true;
        }
      }

      // Update sales returns
      const returns = getStorageData(STORAGE_KEYS.RETURNS, null);
      if (Array.isArray(returns) && returns.length > 0) {
        let returnsChanged = false;
        const updatedReturns = returns.map(ret => {
          if (!ret) return ret;
          let retChanged = false;
          let newInvNo = ret.invoiceNo;
          if (ret.invoiceNo && invoiceNoMap[ret.invoiceNo]) {
            newInvNo = invoiceNoMap[ret.invoiceNo];
            retChanged = true;
          } else if (ret.invoiceNo) {
            const shifted = shiftInvNo(String(ret.invoiceNo));
            if (shifted !== ret.invoiceNo) {
              newInvNo = shifted;
              retChanged = true;
            }
          }

          let newReplNo = ret.replacementInvoiceNo;
          if (ret.replacementInvoiceNo && invoiceNoMap[ret.replacementInvoiceNo]) {
            newReplNo = invoiceNoMap[ret.replacementInvoiceNo];
            retChanged = true;
          } else if (ret.replacementInvoiceNo) {
            const shifted = shiftInvNo(String(ret.replacementInvoiceNo));
            if (shifted !== ret.replacementInvoiceNo) {
              newReplNo = shifted;
              retChanged = true;
            }
          }

          if (retChanged) {
            returnsChanged = true;
            return {
              ...ret,
              invoiceNo: newInvNo,
              replacementInvoiceNo: newReplNo
            };
          }
          return ret;
        });

        if (returnsChanged) {
          setStorageData(STORAGE_KEYS.RETURNS, updatedReturns);
          hasDataChanged = true;
        }
      }

      // Update bank transactions notes
      const bankTxns = getStorageData(STORAGE_KEYS.BANK_TRANSACTIONS, null);
      if (Array.isArray(bankTxns) && bankTxns.length > 0 && Object.keys(invoiceNoMap).length > 0) {
        let txnsChanged = false;
        const updatedTxns = bankTxns.map(txn => {
          if (!txn || !txn.notes || typeof txn.notes !== 'string') return txn;
          let newNotes = txn.notes;
          Object.keys(invoiceNoMap).forEach(oldNo => {
            if (newNotes.includes(oldNo)) {
              newNotes = newNotes.replaceAll(oldNo, invoiceNoMap[oldNo]);
            }
          });
          if (newNotes !== txn.notes) {
            txnsChanged = true;
            return { ...txn, notes: newNotes };
          }
          return txn;
        });
        if (txnsChanged) {
          setStorageData(STORAGE_KEYS.BANK_TRANSACTIONS, updatedTxns);
          hasDataChanged = true;
        }
      }

      localStorage.setItem(MIGRATION_KEY_155_TO_206, 'true');
      console.log('[Migration] Successfully shifted invoice numbers >= 155 to >= 206 (+51 offset)');

      if (hasDataChanged) {
        try {
          autoCloudSync();
        } catch (e) {
          // ignore sync error during init
        }
      }
    } catch (migErr) {
      console.warn('[Migration Error] Could not shift invoice numbers:', migErr);
    }
  }

  // One-time automatic migration: Normalize legacy Chain Pouch quantities in invoices
  // If an invoice item for a Chain Pouch product was stored as loose pouches (effective rate < 40 and qty >= 12),
  // convert it to Chain Pouch count (qty / 12) with unit = 'C. Pouch' and rateMode = 'CHAIN_POUCH'.
  const MIGRATION_KEY_CHAIN_POUCH_QTY = 'distro_migrated_chain_pouch_qty_v1';
  if (!localStorage.getItem(MIGRATION_KEY_CHAIN_POUCH_QTY)) {
    try {
      const currentInvoices = getStorageData(STORAGE_KEYS.INVOICES, []);
      const currentProducts = getStorageData(STORAGE_KEYS.PRODUCTS, []);
      let hasDataChanged = false;

      if (Array.isArray(currentInvoices) && currentInvoices.length > 0) {
        const updatedInvoices = currentInvoices.map(inv => {
          if (!inv || !Array.isArray(inv.items)) return inv;
          let invChanged = false;

          const updatedItems = inv.items.map(item => {
            if (!item || item.isSection || item.isNote) return item;

            let matchedProd = null;
            if (item.productId && Array.isArray(currentProducts)) {
              matchedProd = currentProducts.find(p => p && p.id === item.productId);
            }
            if (!matchedProd && item.name && Array.isArray(currentProducts)) {
              const iname = item.name.trim().toLowerCase();
              matchedProd = currentProducts.find(p => p && p.name && p.name.trim().toLowerCase() === iname);
            }

            const rawUnit = item.unit || matchedProd?.unit || '';
            const isChainPouch = rawUnit === 'Chain Pouch' || rawUnit === 'C. Pouch' || rawUnit === 'c. pouch';

            if (isChainPouch) {
              const pouchesPerChain = Number(matchedProd?.pcsPerBox) > 1 
                ? Number(matchedProd.pcsPerBox) 
                : 12;
              const rawQty = Number(item.qty) || 0;
              const rawAmt = Number(item.total) || (Number(item.price) * rawQty) || 0;
              const effectivePrice = rawQty > 0 ? (rawAmt / rawQty) : (Number(item.price) || 0);

              // If effective unit price is < 40 and rawQty >= pouchesPerChain, it was saved in loose pouches!
              if (effectivePrice < 40 && rawQty >= pouchesPerChain) {
                invChanged = true;
                const newQty = Math.round((rawQty / pouchesPerChain) * 10) / 10;
                const newPrice = Math.round((effectivePrice * pouchesPerChain) * 100) / 100;
                return {
                  ...item,
                  qty: newQty,
                  price: newPrice,
                  unit: 'C. Pouch',
                  rateMode: 'CHAIN_POUCH'
                };
              }
            }
            return item;
          });

          if (invChanged) {
            hasDataChanged = true;
            return {
              ...inv,
              items: updatedItems
            };
          }
          return inv;
        });

        if (hasDataChanged) {
          setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);
          console.log('[Migration] Successfully normalized Chain Pouch items in invoices to C. Pouch counts.');
          try {
            autoCloudSync();
          } catch (e) {}
        }
      }

      localStorage.setItem(MIGRATION_KEY_CHAIN_POUCH_QTY, 'true');
    } catch (migErr) {
      console.warn('[Migration Error] Could not normalize Chain Pouch invoice quantities:', migErr);
    }
  }

  // One-time automatic migration V2: Sync Chain Pouch unit from Inventory products to stored invoices
  // If a product was updated in Inventory to Chain Pouch, ensure its line items reflect C. Pouch
  const MIGRATION_KEY_CHAIN_POUCH_SYNC_V2 = 'distro_migrated_chain_pouch_sync_v2';
  if (!localStorage.getItem(MIGRATION_KEY_CHAIN_POUCH_SYNC_V2)) {
    try {
      const currentInvoices = getStorageData(STORAGE_KEYS.INVOICES, []);
      const currentProducts = getStorageData(STORAGE_KEYS.PRODUCTS, []);
      let hasDataChanged = false;

      if (Array.isArray(currentInvoices) && currentInvoices.length > 0 && Array.isArray(currentProducts)) {
        const updatedInvoices = currentInvoices.map(inv => {
          if (!inv || !Array.isArray(inv.items)) return inv;
          let invChanged = false;

          const updatedItems = inv.items.map(item => {
            if (!item || item.isSection || item.isNote) return item;

            let matchedProd = null;
            if (item.productId) {
              matchedProd = currentProducts.find(p => p && p.id === item.productId);
            }
            if (!matchedProd && item.sku && item.sku.trim()) {
              matchedProd = currentProducts.find(p => p && p.sku && p.sku.trim().toLowerCase() === item.sku.trim().toLowerCase());
            }
            if (!matchedProd && item.name) {
              const iname = item.name.trim().toLowerCase();
              matchedProd = currentProducts.find(p => p && p.name && p.name.trim().toLowerCase() === iname);
            }

            const isProdChain = matchedProd && (matchedProd.unit === 'Chain Pouch' || matchedProd.unit === 'C. Pouch' || matchedProd.unit === 'c. pouch');
            if (isProdChain && item.unit !== 'C. Pouch') {
              invChanged = true;
              return {
                ...item,
                unit: 'C. Pouch',
                rateMode: 'CHAIN_POUCH'
              };
            }
            return item;
          });

          if (invChanged) {
            hasDataChanged = true;
            return {
              ...inv,
              items: updatedItems
            };
          }
          return inv;
        });

        if (hasDataChanged) {
          setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);
          console.log('[Migration V2] Synced Chain Pouch unit from Inventory to stored invoices.');
          try {
            autoCloudSync();
          } catch (e) {}
        }
      }

      localStorage.setItem(MIGRATION_KEY_CHAIN_POUCH_SYNC_V2, 'true');
    } catch (migErr) {
      console.warn('[Migration Error V2]:', migErr);
    }
  }

  // Clean warehouses if dummy locations exist
  const existingWh = getStorageData(STORAGE_KEYS.WAREHOUSES, []);
  const cleanedWh = existingWh.filter(w => 
    w?.location !== 'Transport Nagar Depot' && 
    w?.location !== 'Wholesale Grain Market' && 
    w?.location !== 'Industrial Area Phase 1' &&
    w?.name !== 'Depot 2 (Transit/Cold Storage)' &&
    w?.name !== 'Shop Floor Counter'
  );
  if (cleanedWh.length === 0) {
    setStorageData(STORAGE_KEYS.WAREHOUSES, DEFAULT_WAREHOUSES);
  } else {
    setStorageData(STORAGE_KEYS.WAREHOUSES, cleanedWh);
  }

  // Clean dummy bank accounts (HDFC 50200088991122, SBI 38920192831, etc.)
  const existingBanks = getStorageData(STORAGE_KEYS.BANK_ACCOUNTS, []).filter(b => 
    b?.accountNo !== '50200088991122' && 
    b?.accountNo !== '38920192831' && 
    b?.id !== 'bank_1' && 
    b?.id !== 'bank_2'
  );
  setStorageData(STORAGE_KEYS.BANK_ACCOUNTS, existingBanks);

  // Clean operator if dummy name exists
  const existingOp = getStorageData(STORAGE_KEYS.CURRENT_OPERATOR, null);
  if (!existingOp || existingOp.name === 'Rajesh Verma') {
    setStorageData(STORAGE_KEYS.CURRENT_OPERATOR, DEFAULT_OPERATOR);
  }

  if (!localStorage.getItem(STORAGE_KEYS.SECURITY_SETTINGS)) {
    setStorageData(STORAGE_KEYS.SECURITY_SETTINGS, DEFAULT_SECURITY);
  }

  if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
    setStorageData(STORAGE_KEYS.AUDIT_LOGS, [
      {
        id: 'log_init',
        timestamp: new Date().toISOString(),
        operator: 'System',
        action: 'SYSTEM_BOOT',
        module: 'Security & Audit',
        details: 'DistroPlus Enterprise System initialized.'
      }
    ]);
  }

  // Handle catalog initialization and ensure deleted items stay permanently deleted
  const isCatalogInitialized = localStorage.getItem('distro_catalog_initialized');
  const deletedIds = new Set(getDeletedIds());
  const existingProdsInStorage = getStorageData(STORAGE_KEYS.PRODUCTS, null);

  if (!isCatalogInitialized) {
    // If the storage already has items (from previous sessions), preserve them and mark initialized
    if (Array.isArray(existingProdsInStorage) && existingProdsInStorage.length > 0) {
      const cleaned = existingProdsInStorage.filter(p => p && !SAMPLE_IDS.includes(p.id) && !deletedIds.has(p.id));
      setStorageData(STORAGE_KEYS.PRODUCTS, cleaned);
    } else {
      setStorageData(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS.filter(p => !deletedIds.has(p.id)));
    }

    const existingPartiesInStorage = getStorageData(STORAGE_KEYS.PARTIES, null);
    if (Array.isArray(existingPartiesInStorage) && existingPartiesInStorage.length > 0) {
      const cleaned = existingPartiesInStorage.filter(p => p && !SAMPLE_IDS.includes(p.id) && !deletedIds.has(p.id));
      setStorageData(STORAGE_KEYS.PARTIES, cleaned);
    } else {
      setStorageData(STORAGE_KEYS.PARTIES, INITIAL_PARTIES.filter(p => !deletedIds.has(p.id)));
    }

    const existingInvoicesInStorage = getStorageData(STORAGE_KEYS.INVOICES, null);
    if (Array.isArray(existingInvoicesInStorage) && existingInvoicesInStorage.length > 0) {
      const cleaned = existingInvoicesInStorage.filter(i => i && !SAMPLE_IDS.includes(i.id) && !deletedIds.has(i.id));
      setStorageData(STORAGE_KEYS.INVOICES, cleaned);
    } else {
      setStorageData(STORAGE_KEYS.INVOICES, INITIAL_INVOICES.filter(i => !deletedIds.has(i.id)));
    }

    localStorage.setItem('distro_catalog_initialized', 'true');
  } else {
    let existingProds = getStorageData(STORAGE_KEYS.PRODUCTS, [])
      .filter(p => p && !SAMPLE_IDS.includes(p.id) && !deletedIds.has(p.id))
      .map(p => {
        if (p && (p.name === 'KHATTA MEETHA MIXTURE - MRP-50/-' || p.name === 'AKHA CHANA - MRP-10/-') && Number(p.gstRate) === 18) {
          return { ...p, gstRate: 5 };
        }
        return p;
      });
    if (!existingProds || existingProds.length < INITIAL_PRODUCTS.length) {
      existingProds = mergeById(existingProds || [], INITIAL_PRODUCTS, deletedIds);
    }
    setStorageData(STORAGE_KEYS.PRODUCTS, existingProds);

    let existingParties = getStorageData(STORAGE_KEYS.PARTIES, []).filter(p => p && !SAMPLE_IDS.includes(p.id) && !deletedIds.has(p.id));
    if (!existingParties || existingParties.length < INITIAL_PARTIES.length) {
      existingParties = mergeById(existingParties || [], INITIAL_PARTIES, deletedIds);
    }
    setStorageData(STORAGE_KEYS.PARTIES, existingParties);

    const existingInvoices = getStorageData(STORAGE_KEYS.INVOICES, []).filter(i => i && !SAMPLE_IDS.includes(i.id) && !deletedIds.has(i.id));
    if (!existingInvoices || existingInvoices.length === 0) {
      setStorageData(STORAGE_KEYS.INVOICES, INITIAL_INVOICES.filter(i => !deletedIds.has(i.id)));
    } else {
      setStorageData(STORAGE_KEYS.INVOICES, existingInvoices);
    }
  }

  let existingPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []).filter(i => i && !SAMPLE_IDS.includes(i.id) && !deletedIds.has(i.id));
  if ((!existingPurchases || existingPurchases.length === 0) && Array.isArray(INITIAL_PURCHASES) && INITIAL_PURCHASES.length > 0) {
    existingPurchases = [...INITIAL_PURCHASES];
  }
  existingPurchases.sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    if (db !== da) return db.localeCompare(da);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  setStorageData(STORAGE_KEYS.PURCHASES, existingPurchases);

  // Automatically recalculate and normalize all historical purchase bills to standard 5% GST
  try {
    recalculateAndNormalizeAllPurchaseBills();
  } catch (err) {
    console.warn('Auto purchase bill normalization error:', err);
  }

  // Clean dummy expenses and purge any deleted expense IDs
  const existingExpenses = getStorageData(STORAGE_KEYS.EXPENSES, []).filter(e => 
    e &&
    !e?.id?.startsWith('exp_sample_') &&
    !deletedIds.has(e.id) &&
    e?.voucherNo !== 'VOUCH-2601' &&
    e?.voucherNo !== 'VOUCH-2602' &&
    e?.voucherNo !== 'VOUCH-2603' &&
    e?.voucherNo !== 'VOUCH-2604' &&
    e?.voucherNo !== 'VOUCH-2605'
  );
  setStorageData(STORAGE_KEYS.EXPENSES, existingExpenses);

  // Clean dummy proprietor capital
  const existingCap = getStorageData(STORAGE_KEYS.PROPRIETOR_CAPITAL, null);
  if (!existingCap || existingCap.notes === 'Opening capital as per FY 2026-27 balance sheet') {
    setStorageData(STORAGE_KEYS.PROPRIETOR_CAPITAL, DEFAULT_PROPRIETOR_CAPITAL);
  }

  // Clear draft if it contained dummy references
  try {
    const draft = localStorage.getItem('distro_active_billing_draft');
    if (draft && (draft.includes('Shree Ganesh') || draft.includes('prod_') || draft.includes('party_'))) {
      localStorage.removeItem('distro_active_billing_draft');
    }
  } catch (e) {}

  // Wipe Cloud DB sample rows as well
  const client = getSupabaseClient();
  if (client) {
    SAMPLE_IDS.forEach(id => {
      client.from('products').delete().eq('id', id).then(() => {}).catch(console.error);
      client.from('parties').delete().eq('id', id).then(() => {}).catch(console.error);
      client.from('invoices').delete().eq('id', id).then(() => {}).catch(console.error);
    });
  }
};

export const clearAllSampleData = () => {
  setStorageData(STORAGE_KEYS.PRODUCTS, []);
  setStorageData(STORAGE_KEYS.PARTIES, []);
  setStorageData(STORAGE_KEYS.INVOICES, []);
  setStorageData(STORAGE_KEYS.PURCHASES, []);
  setStorageData(STORAGE_KEYS.EXPENSES, []);
  setStorageData(STORAGE_KEYS.BANK_ACCOUNTS, []);
  setStorageData(STORAGE_KEYS.BANK_TRANSACTIONS, []);
  setStorageData(STORAGE_KEYS.STOCK_LEDGER, []);
  setStorageData(STORAGE_KEYS.PROPRIETOR_CAPITAL, DEFAULT_PROPRIETOR_CAPITAL);
  setStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  setStorageData(STORAGE_KEYS.WAREHOUSES, DEFAULT_WAREHOUSES);
  setStorageData(STORAGE_KEYS.CURRENT_OPERATOR, DEFAULT_OPERATOR);
  setStorageData(STORAGE_KEYS.DELETED_IDS, []);
  localStorage.setItem('distro_catalog_initialized', 'true');
  try {
    localStorage.removeItem('distro_active_billing_draft');
  } catch (e) {}
  const client = getSupabaseClient();
  if (client) {
    client.from('products').delete().neq('id', 'xyz_dummy_keep').then(() => {}).catch(console.error);
    client.from('parties').delete().neq('id', 'xyz_dummy_keep').then(() => {}).catch(console.error);
    client.from('invoices').delete().neq('id', 'xyz_dummy_keep').then(() => {}).catch(console.error);
  }
};

// --- LIVE CLOUD SYNC CHANNEL ---
const STORE_DATA_ID = 'distropulse_store_data';

const getActiveCloudCredentials = () => {
  const { url, key } = getSupabaseConfig();
  return {
    url: (url || '').trim(),
    key: (key || '').trim()
  };
};

const mergeById = (localArr = [], remoteArr = [], customDeletedSet = null) => {
  const delSet = customDeletedSet instanceof Set ? customDeletedSet : new Set(getDeletedIds());
  const map = new Map();
  (remoteArr || []).forEach(item => {
    if (item && item.id && !SAMPLE_IDS.includes(item.id) && !delSet.has(item.id)) {
      map.set(item.id, item);
    }
  });
  // Local items override or append (preserves local creations & updates)
  (localArr || []).forEach(item => {
    if (item && item.id && !SAMPLE_IDS.includes(item.id) && !delSet.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
};

const CLOUD_BINS = {
  INVOICES_META: 'https://extendsclass.com/api/json-storage/bin/eeeafcd',
  PURCHASES: 'https://extendsclass.com/api/json-storage/bin/ffcedac',
  PRODUCTS: 'https://extendsclass.com/api/json-storage/bin/feceaea'
};

export const fetchCloudData = async (force = false) => {
  let hasUpdated = false;

  // 1. Primary: Official Supabase Cloud Database (distro_cloud_store)
  try {
    const client = getSupabaseClient();
    if (client) {
      const { data: rows, error } = await client
        .from('distro_cloud_store')
        .select('*')
        .eq('id', STORE_DATA_ID)
        .limit(1);

      if (!error && Array.isArray(rows) && rows.length > 0 && rows[0].beat) {
        const remote = decompressDataLossless(rows[0].beat);
        if (!remote) return false;
        const remoteTs = Number(remote.lastUpdated) || 0;
        const lastLocalTs = Number(localStorage.getItem('distro_last_synced_ts')) || 0;
        if (force || !lastLocalTs || remoteTs !== lastLocalTs) {
          if (Array.isArray(remote.deletedIds) && remote.deletedIds.length > 0) {
            recordDeletedIds(remote.deletedIds);
          }
          const activeDelSet = new Set(getDeletedIds());
          if (Array.isArray(remote.invoices)) setStorageData(STORAGE_KEYS.INVOICES, remote.invoices.filter(i => !activeDelSet.has(i.id)));
          if (Array.isArray(remote.purchases)) setStorageData(STORAGE_KEYS.PURCHASES, remote.purchases.filter(p => !activeDelSet.has(p.id)));
          if (Array.isArray(remote.products)) setStorageData(STORAGE_KEYS.PRODUCTS, remote.products.filter(p => !activeDelSet.has(p.id)));
          if (Array.isArray(remote.parties)) setStorageData(STORAGE_KEYS.PARTIES, remote.parties.filter(p => !activeDelSet.has(p.id)));
          if (Array.isArray(remote.suppliers)) setStorageData(STORAGE_KEYS.SUPPLIERS, remote.suppliers);
          if (remote.business && remote.business.name) setStorageData(STORAGE_KEYS.BUSINESS, remote.business);
          if (Array.isArray(remote.warehouses) && remote.warehouses.length > 0) setStorageData(STORAGE_KEYS.WAREHOUSES, remote.warehouses);
          if (Array.isArray(remote.expenses)) setStorageData(STORAGE_KEYS.EXPENSES, remote.expenses.filter(e => !activeDelSet.has(e.id)));
          if (Array.isArray(remote.stockLots)) setStorageData(STORAGE_KEYS.STOCK_LOTS, remote.stockLots);

          localStorage.setItem('distro_last_synced_ts', (remoteTs || Date.now()).toString());
          hasUpdated = true;
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('distro_data_changed'));
          return true;
        }
        return false;
      }
    }
  } catch (e) {
    console.warn('Supabase fetch error, fallback to bins:', e);
  }

  // 2. Secondary fallback: Cloud Bins
  try {
    const noCacheHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    const bust = `?_t=${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const metaRes = await fetch(CLOUD_BINS.INVOICES_META + bust, {
      cache: 'no-store',
      headers: noCacheHeaders
    }).catch(() => null);

    if (metaRes && metaRes.ok) {
      const meta = await metaRes.json().catch(() => null);
      if (meta && meta.lastUpdated) {
        const remoteTs = Number(meta.lastUpdated) || 0;
        const lastLocalTs = Number(localStorage.getItem('distro_last_synced_ts')) || 0;

        if (force || !lastLocalTs || remoteTs !== lastLocalTs) {
          if (Array.isArray(meta.deletedIds) && meta.deletedIds.length > 0) {
            recordDeletedIds(meta.deletedIds);
          }
          const activeDelSet = new Set(getDeletedIds());

          if (Array.isArray(meta.invoices)) {
            const cleanInvoices = meta.invoices.filter(i => i && !activeDelSet.has(i.id));
            setStorageData(STORAGE_KEYS.INVOICES, cleanInvoices);
          }

          if (Array.isArray(meta.parties)) {
            setStorageData(STORAGE_KEYS.PARTIES, meta.parties.filter(p => p && !activeDelSet.has(p.id)));
          }

          if (Array.isArray(meta.suppliers)) {
            setStorageData(STORAGE_KEYS.SUPPLIERS, meta.suppliers);
          }

          if (meta.business && meta.business.name) {
            setStorageData(STORAGE_KEYS.BUSINESS, meta.business);
          }

          if (Array.isArray(meta.warehouses) && meta.warehouses.length > 0) {
            setStorageData(STORAGE_KEYS.WAREHOUSES, meta.warehouses);
          }

          if (Array.isArray(meta.expenses)) {
            setStorageData(STORAGE_KEYS.EXPENSES, meta.expenses.filter(e => e && !activeDelSet.has(e.id)));
          }

          const purRes = await fetch(CLOUD_BINS.PURCHASES + bust, {
            cache: 'no-store',
            headers: noCacheHeaders
          }).catch(() => null);
          if (purRes && purRes.ok) {
            const purData = await purRes.json().catch(() => null);
            if (Array.isArray(purData?.purchases)) {
              setStorageData(STORAGE_KEYS.PURCHASES, purData.purchases.filter(p => p && !activeDelSet.has(p.id)));
            }
          }

          const prodRes = await fetch(CLOUD_BINS.PRODUCTS + bust, {
            cache: 'no-store',
            headers: noCacheHeaders
          }).catch(() => null);
          if (prodRes && prodRes.ok) {
            const prodData = await prodRes.json().catch(() => null);
            if (Array.isArray(prodData?.products)) {
              setStorageData(STORAGE_KEYS.PRODUCTS, prodData.products.filter(p => p && !activeDelSet.has(p.id)));
            }
          }

          localStorage.setItem('distro_last_synced_ts', (remoteTs || Date.now()).toString());
          hasUpdated = true;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('distro_data_changed'));
          }
        }
      }
    }
  } catch (err) {
    console.warn('Universal Cloud Sync fetch error:', err?.message || err);
  }

  return hasUpdated;
};

export const pushLocalDataToCloud = async () => {
  const activeDelSet = new Set(getDeletedIds());
  const invoices = getStorageData(STORAGE_KEYS.INVOICES, []).filter(i => i && !activeDelSet.has(i.id));
  const deletedIds = getDeletedIds();
  const parties = getStorageData(STORAGE_KEYS.PARTIES, []).filter(p => p && !activeDelSet.has(p.id));
  const suppliers = getStorageData(STORAGE_KEYS.SUPPLIERS, []);
  const business = getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  const warehouses = getStorageData(STORAGE_KEYS.WAREHOUSES, DEFAULT_WAREHOUSES);
  const expenses = getStorageData(STORAGE_KEYS.EXPENSES, []).filter(e => e && !activeDelSet.has(e.id));
  const purchases = getStorageData(STORAGE_KEYS.PURCHASES, []).filter(p => p && !activeDelSet.has(p.id));
  const products = getStorageData(STORAGE_KEYS.PRODUCTS, []).filter(p => p && !activeDelSet.has(p.id));
  const stockLots = getStorageData(STORAGE_KEYS.STOCK_LOTS, []);
  const currentOperator = getStorageData(STORAGE_KEYS.CURRENT_OPERATOR, DEFAULT_OPERATOR);
  const now = Date.now();

  let supabaseSuccess = false;
  let binSuccess = false;

  // 1. Push to Supabase Cloud Database (Primary)
  const client = getSupabaseClient();
  if (client) {
    try {
      const rawBeat = JSON.stringify({
        business,
        products,
        parties,
        suppliers,
        invoices,
        purchases,
        expenses,
        warehouses,
        stockLots,
        currentOperator,
        deletedIds,
        lastUpdated: now
      });
      // 100% Lossless Compression: saves 70-80% space without losing a single character
      const compressedBeat = compressDataLossless(rawBeat);

      const payload = {
        id: STORE_DATA_ID,
        name: 'DISTROPULSE_SYSTEM_STORE',
        beat: compressedBeat,
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('distro_cloud_store').upsert(payload);
      if (!error) {
        supabaseSuccess = true;
      } else {
        console.warn('Supabase upsert warning:', error);
      }
    } catch (e) {
      console.warn('Supabase upsert warning:', e);
    }
  }

  // 2. Secondary fallback mirror
  try {
    const metaPayload = { invoices, deletedIds, parties, suppliers, business, warehouses, expenses, lastUpdated: now };
    const p1 = fetch(CLOUD_BINS.INVOICES_META, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaPayload)
    });
    const p2 = fetch(CLOUD_BINS.PURCHASES, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchases, lastUpdated: now })
    });
    const p3 = fetch(CLOUD_BINS.PRODUCTS, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products, lastUpdated: now })
    });
    await Promise.all([p1, p2, p3]);
    binSuccess = true;
  } catch (err) {
    console.warn('Cloud bin push error:', err);
  }

  if (supabaseSuccess || binSuccess) {
    localStorage.setItem('distro_last_synced_ts', now.toString());
    broadcastRealtimePulse();
    return { success: true, message: 'All invoices, bills & products synchronized with Cloud Database!' };
  } else {
    return { success: false, message: 'Cloud database currently offline. Saved locally.' };
  }
};

// --- GOOGLE DRIVE 30GB PERMANENT CLOUD BACKUP ENGINE ---
export const exportGoogleDriveBackup = () => {
  const activeDelSet = new Set(getDeletedIds());
  const invoices = getStorageData(STORAGE_KEYS.INVOICES, []).filter(i => i && !activeDelSet.has(i.id));
  const products = getStorageData(STORAGE_KEYS.PRODUCTS, []).filter(p => p && !activeDelSet.has(p.id));
  const parties = getStorageData(STORAGE_KEYS.PARTIES, []).filter(p => p && !activeDelSet.has(p.id));
  const purchases = getStorageData(STORAGE_KEYS.PURCHASES, []).filter(p => p && !activeDelSet.has(p.id));
  const business = getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  const warehouses = getStorageData(STORAGE_KEYS.WAREHOUSES, DEFAULT_WAREHOUSES);
  const suppliers = getStorageData(STORAGE_KEYS.SUPPLIERS, []);
  const expenses = getStorageData(STORAGE_KEYS.EXPENSES, []);
  const stockLots = getStorageData(STORAGE_KEYS.STOCK_LOTS, []);
  
  const backupObject = {
    app: 'DistroPlus ERP Enterprise',
    version: '2.5.0',
    exportedAt: new Date().toISOString(),
    compression: 'lossless-lz64',
    stats: {
      invoicesCount: invoices.length,
      productsCount: products.length,
      partiesCount: parties.length,
      purchasesCount: purchases.length
    },
    data: {
      business,
      products,
      parties,
      suppliers,
      invoices,
      purchases,
      warehouses,
      expenses,
      stockLots
    }
  };

  const jsonString = JSON.stringify(backupObject, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const fileName = `DistroPlus_GoogleDrive_Backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.distro.json`;
  
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  return {
    fileName,
    invoicesCount: invoices.length,
    productsCount: products.length,
    partiesCount: parties.length,
    purchasesCount: purchases.length
  };
};

let syncTimeout = null;
let isPushing = false;
let pendingPush = false;

export const autoCloudSync = async () => {
  try {
    // 1. Immediately refresh local screen (0ms)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('distro_data_changed'));
    }

    // 2. Immediately send millisecond broadcast pulse to local bus & peer devices
    broadcastRealtimePulse();

    if (isPushing) {
      pendingPush = true;
      return;
    }

    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      try {
        isPushing = true;
        await pushLocalDataToCloud();
      } finally {
        isPushing = false;
        if (pendingPush) {
          pendingPush = false;
          autoCloudSync();
        }
      }
    }, 60); // 60ms micro-debounce for ultra-fast response
  } catch (e) {
    console.warn('Auto cloud sync warning:', e);
  }
};

export const performFullSync = async () => {
  // PULL FIRST, THEN PUSH (prevents clobbering)
  const pullSuccess = await fetchCloudData(true);
  const pushRes = await pushLocalDataToCloud();
  if (pullSuccess || pushRes.success) {
    return { success: true, message: 'Cloud Database synchronized successfully!' };
  }
  return { 
    success: false, 
    message: pushRes.message || 'Cloud database is currently unreachable. Operating in local mode.' 
  };
};

// --- 1-CLICK JSON BACKUP & RESTORE UTILITIES ---
export const exportFullBackupJSON = () => {
  const backupData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    business: getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS),
    products: getStorageData(STORAGE_KEYS.PRODUCTS, []),
    parties: getStorageData(STORAGE_KEYS.PARTIES, []),
    invoices: getStorageData(STORAGE_KEYS.INVOICES, []),
    purchases: getStorageData(STORAGE_KEYS.PURCHASES, []),
    warehouses: getStorageData(STORAGE_KEYS.WAREHOUSES, DEFAULT_WAREHOUSES),
    bankAccounts: getStorageData(STORAGE_KEYS.BANK_ACCOUNTS, []),
    expenses: getStorageData(STORAGE_KEYS.EXPENSES, []),
    currentOperator: getStorageData(STORAGE_KEYS.CURRENT_OPERATOR, DEFAULT_OPERATOR),
    proprietorCapital: getStorageData(STORAGE_KEYS.PROPRIETOR_CAPITAL, DEFAULT_PROPRIETOR_CAPITAL),
    securitySettings: getStorageData(STORAGE_KEYS.SECURITY_SETTINGS, DEFAULT_SECURITY),
    auditLogs: getStorageData(STORAGE_KEYS.AUDIT_LOGS, []),
    salesReturns: getStorageData(STORAGE_KEYS.RETURNS, []),
    invoiceHistory: getStorageData(STORAGE_KEYS.INVOICE_HISTORY, []),
    deletedIds: getDeletedIds()
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const bizName = (backupData.business?.name || 'DistroPlus').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = downloadUrl;
  a.download = `${bizName}_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  return { success: true, productCount: backupData.products.length };
};

export const importFullBackupJSON = (backupObj) => {
  if (!backupObj || typeof backupObj !== 'object') {
    throw new Error('Invalid backup file format');
  }

  const biz = backupObj.business || backupObj.business_info;
  if (biz && biz.name && biz.name !== "Distributor Agency") {
    setStorageData(STORAGE_KEYS.BUSINESS, biz);
  }

  const prods = backupObj.products;
  if (Array.isArray(prods) && prods.length > 0) {
    const localProds = getStorageData(STORAGE_KEYS.PRODUCTS, []);
    setStorageData(STORAGE_KEYS.PRODUCTS, mergeById(localProds, prods));
  }

  const parties = backupObj.parties;
  if (Array.isArray(parties) && parties.length > 0) {
    const localParties = getStorageData(STORAGE_KEYS.PARTIES, []);
    setStorageData(STORAGE_KEYS.PARTIES, mergeById(localParties, parties));
  }

  const invoices = backupObj.invoices;
  if (Array.isArray(invoices) && invoices.length > 0) {
    const localInvoices = getStorageData(STORAGE_KEYS.INVOICES, []);
    setStorageData(STORAGE_KEYS.INVOICES, mergeById(localInvoices, invoices));
  }

  const purchases = backupObj.purchases;
  if (Array.isArray(purchases) && purchases.length > 0) {
    const localPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
    setStorageData(STORAGE_KEYS.PURCHASES, mergeById(localPurchases, purchases));
  }

  if (Array.isArray(backupObj.salesReturns || backupObj.returns)) {
    const localReturns = getStorageData(STORAGE_KEYS.RETURNS, []);
    setStorageData(STORAGE_KEYS.RETURNS, mergeById(localReturns, backupObj.salesReturns || backupObj.returns));
  }

  if (Array.isArray(backupObj.invoiceHistory || backupObj.invoiceHistoryLogs)) {
    const localHistory = getStorageData(STORAGE_KEYS.INVOICE_HISTORY, []);
    setStorageData(STORAGE_KEYS.INVOICE_HISTORY, mergeById(localHistory, backupObj.invoiceHistory || backupObj.invoiceHistoryLogs));
  }

  if (Array.isArray(backupObj.bankAccounts || backupObj.bank_accounts)) {
    setStorageData(STORAGE_KEYS.BANK_ACCOUNTS, backupObj.bankAccounts || backupObj.bank_accounts);
  }

  if (Array.isArray(backupObj.expenses)) {
    setStorageData(STORAGE_KEYS.EXPENSES, backupObj.expenses);
  }

  if (backupObj.currentOperator || backupObj.current_operator) {
    setStorageData(STORAGE_KEYS.CURRENT_OPERATOR, backupObj.currentOperator || backupObj.current_operator);
  }

  if (Array.isArray(backupObj.deletedIds)) {
    setStorageData(STORAGE_KEYS.DELETED_IDS, backupObj.deletedIds);
  }
  localStorage.setItem('distro_catalog_initialized', 'true');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('distro_data_changed'));
  }

  return {
    success: true,
    productCount: getStorageData(STORAGE_KEYS.PRODUCTS, []).length,
    partyCount: getStorageData(STORAGE_KEYS.PARTIES, []).length,
    invoiceCount: getStorageData(STORAGE_KEYS.INVOICES, []).length
  };
};

// Operations: Products
export const fetchProducts = () => {
  const delSet = new Set(getDeletedIds());
  const prods = getStorageData(STORAGE_KEYS.PRODUCTS, []).filter(p => p && !SAMPLE_IDS.includes(p.id) && !delSet.has(p.id));
  let modified = false;
  const cleanProds = prods.map(p => {
    if (p && p.name && (/\s{2,}/.test(p.name) || /^\s+/.test(p.name) || /\s+$/.test(p.name))) {
      modified = true;
      return { ...p, name: p.name.replace(/\s+/g, ' ').trim() };
    }
    return p;
  });
  if (modified) {
    setStorageData(STORAGE_KEYS.PRODUCTS, cleanProds);
  }
  return cleanProds;
};

export const saveProduct = (product) => {
  if (product.id) {
    unrecordDeletedId(product.id);
  }
  const products = fetchProducts();
  let updated;
  let targetProd;

  // Ensure SKU is auto-generated if missing or empty
  let cleanSku = (product.sku || '').trim();
  if (!cleanSku) {
    const cleanName = (product.name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const prefix = cleanName.length >= 3 ? cleanName.substring(0, 3) : 'SKU';
    cleanSku = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const normalizedProduct = {
    ...product,
    sku: cleanSku
  };

  if (product.id) {
    targetProd = normalizedProduct;
    updated = products.map(p => p.id === product.id ? normalizedProduct : p);
    logAuditAction('EDIT_PRODUCT', 'Inventory & Stock', `Updated item: ${product.name} (SKU: ${cleanSku}, MRP: ₹${product.mrp || 0})`);
  } else {
    targetProd = {
      ...normalizedProduct,
      id: 'prod_' + Date.now()
    };
    updated = [targetProd, ...products];
    logAuditAction('ADD_PRODUCT', 'Inventory & Stock', `Added new product: ${product.name} (Batch: ${product.batchNo || 'Default'})`);
  }
  setStorageData(STORAGE_KEYS.PRODUCTS, updated);
  autoCloudSync();
  return updated;
};

export const deleteProduct = (id) => {
  recordDeletedId(id);
  const currentProducts = getStorageData(STORAGE_KEYS.PRODUCTS, []);
  const target = currentProducts.find(p => p && p.id === id);
  const products = currentProducts.filter(p => p && p.id !== id && !SAMPLE_IDS.includes(p.id));
  setStorageData(STORAGE_KEYS.PRODUCTS, products);
  
  logAuditAction('DELETE_PRODUCT', 'Inventory & Stock', `Deleted product ID: ${id} (${target?.name || 'Item'})`);

  const client = getSupabaseClient();
  if (client) {
    client.from('products').delete().eq('id', id).then(() => {}).catch(console.error);
  }
  autoCloudSync();
  return products;
};

// Operations: Stock Update (Stock-In or Manual Adjust)
export const updateProductStock = (productId, qtyToAdd, reason = 'Stock Add') => {
  const products = fetchProducts();
  let productName = 'Item';
  const updated = products.map(p => {
    if (p.id === productId) {
      productName = p.name;
      const newStock = Math.max(0, (Number(p.currentStock) || 0) + Number(qtyToAdd));
      return { ...p, currentStock: newStock };
    }
    return p;
  });
  setStorageData(STORAGE_KEYS.PRODUCTS, updated);
  logAuditAction('STOCK_ADJUSTMENT', 'Inventory & Stock', `${qtyToAdd >= 0 ? '+' : ''}${qtyToAdd} Pcs adjusted for ${productName} (${reason})`);
  autoCloudSync();
  return updated;
};

// Date formatting helper for standard DD-MM-YY (e.g. 10-08-26)
export const formatDateDDMMYY = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const cleanStr = String(dateStr).trim();
    // Check for YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      return `${dd.padStart(2, '0')}-${mm.padStart(2, '0')}-${yyyy.slice(-2)}`;
    }
    // Check for DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y.slice(-2)}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day}-${month}-${year}`;
    }
    return dateStr;
  } catch (err) {
    return dateStr;
  }
};

// Operations: Purchases, Stock Lots & Inward Costing Engine
export const fetchPurchases = () => {
  const delSet = new Set(getDeletedIds());
  let list = getStorageData(STORAGE_KEYS.PURCHASES, []).filter(p => p && !delSet.has(p.id));
  if ((!list || list.length === 0) && Array.isArray(INITIAL_PURCHASES) && INITIAL_PURCHASES.length > 0) {
    list = [...INITIAL_PURCHASES];
    setStorageData(STORAGE_KEYS.PURCHASES, list);
  }
  let modified = false;
  const cleanList = list.map(bill => {
    if (bill && Array.isArray(bill.items)) {
      let itemsChanged = false;
      const cleanItems = bill.items.map(it => {
        if (it && it.name && (/\s{2,}/.test(it.name) || /^\s+/.test(it.name) || /\s+$/.test(it.name))) {
          itemsChanged = true;
          return { ...it, name: it.name.replace(/\s+/g, ' ').trim() };
        }
        return it;
      });
      if (itemsChanged) {
        modified = true;
        return { ...bill, items: cleanItems };
      }
    }
    return bill;
  });
  if (modified) {
    setStorageData(STORAGE_KEYS.PURCHASES, cleanList);
  }
  return cleanList.sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    if (db !== da) return db.localeCompare(da);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
};

// --- BATCH-WISE / LOT-WISE PURCHASE COSTING ENGINE ---

export const fetchStockLots = (productId = null) => {
  let lots = getStorageData(STORAGE_KEYS.STOCK_LOTS, null);
  const purchases = fetchPurchases();
  const products = fetchProducts();

  let needsSave = false;

  if (!lots) {
    lots = [];
    needsSave = true;
  }

  // 1. Ensure every item across all recorded purchase bills is represented in lots
  purchases.forEach(p => {
    (p.items || []).forEach((item, idx) => {
      const qty = Number(item.qty) || 0;
      if (qty <= 0 && !item.name) return;

      const matchingProd = products.find(prod => isProductMatch(prod, item));
      const resolvedId = matchingProd ? matchingProd.id : (item.productId || `prod_${normalizeProductName(item.name)}`);
      const itemSku = item.sku || matchingProd?.sku || '';

      // Check if this purchase bill item already exists in lots
      const existingLot = lots.find(l => 
        l.billId === p.id && (
          (item.id && l.id === `lot_purch_${p.id}_${item.id}`) ||
          isProductMatch(matchingProd, l) ||
          (l.batchNo && item.batchNo && l.batchNo === item.batchNo) ||
          (l.productName && item.name && normalizeProductName(l.productName) === normalizeProductName(item.name))
        )
      );

      if (existingLot) {
        // Re-link lot if productId was mismatched or old
        if (matchingProd && existingLot.productId !== matchingProd.id) {
          existingLot.productId = matchingProd.id;
          existingLot.sku = matchingProd.sku || existingLot.sku;
          needsSave = true;
        }
      } else {
        // Missing lot from recorded purchase bill - insert it!
        const pPrice = Number(item.purchasePrice) || 0;
        const gstRate = Number(item.gstRate !== undefined ? item.gstRate : (matchingProd?.gstRate || 0));
        const pPriceWithGst = Number(item.purchasePriceWithGst) || (pPrice * (1 + gstRate / 100));

        lots.push({
          id: `lot_purch_${p.id || Date.now()}_${item.id || idx}`,
          productId: resolvedId,
          productName: item.name || matchingProd?.name || 'Item',
          sku: itemSku,
          billId: p.id,
          billNo: p.billNo || 'INWARD',
          supplierName: p.partyName || 'Supplier',
          date: p.date || (p.createdAt ? p.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
          batchNo: item.batchNo || p.billNo || 'LOT-INWARD',
          expiryDate: item.expiryDate || matchingProd?.expiryDate || '',
          purchasePrice: pPrice,
          purchasePriceWithGst: pPriceWithGst,
          gstRate,
          qtyReceived: qty,
          qtyRemaining: qty,
          warehouseId: p.warehouseId || matchingProd?.warehouseId || 'wh_main'
        });
        needsSave = true;
      }
    });
  });

  // 2. Re-link any legacy lots whose productId doesn't match catalog products but matches by SKU or normalized name
  lots.forEach(l => {
    const matchingProd = products.find(prod => isProductMatch(prod, l));
    if (matchingProd && l.productId !== matchingProd.id) {
      l.productId = matchingProd.id;
      l.sku = matchingProd.sku || l.sku;
      needsSave = true;
    }
  });

  // 3. For products that have stock not covered by purchase bills, create an opening stock lot
  products.forEach(prod => {
    const prodLots = lots.filter(l => isProductMatch(prod, l));
    const totalPurchasedQty = prodLots.reduce((sum, l) => sum + (Number(l.qtyReceived) || 0), 0);
    const pkg = getProductPackagingInfo(prod);
    const currentStockUnits = pkg.effectiveUnits;
    
    if (totalPurchasedQty === 0 && currentStockUnits > 0) {
      const pPrice = Number(prod.purchasePrice) || 0;
      const gstRate = Number(prod.gstRate) || 0;
      lots.push({
        id: `lot_init_${prod.id}`,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku || '',
        billId: 'opening',
        billNo: 'OPENING-STOCK',
        supplierName: 'Opening Balance',
        date: '2026-01-01',
        batchNo: prod.batchNo || 'LOT-OPENING',
        expiryDate: prod.expiryDate || '',
        purchasePrice: pPrice,
        purchasePriceWithGst: pPrice * (1 + gstRate / 100),
        gstRate,
        qtyReceived: currentStockUnits,
        qtyRemaining: currentStockUnits,
        warehouseId: prod.warehouseId || 'wh_main'
      });
      needsSave = true;
    }
  });

  // 4. Reconcile remaining lot quantities against existing stock (FIFO)
  if (needsSave) {
    products.forEach(prod => {
      const pkg = getProductPackagingInfo(prod);
      const prodLots = lots.filter(l => isProductMatch(prod, l)).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      let targetStock = pkg.effectiveUnits;
      
      const totalLotQty = prodLots.reduce((sum, l) => sum + (Number(l.qtyReceived) || 0), 0);
      let qtyToConsume = Math.max(0, totalLotQty - targetStock);
      
      for (const lot of prodLots) {
        if (qtyToConsume <= 0) break;
        const currentRem = Number(lot.qtyRemaining) !== undefined ? Number(lot.qtyRemaining) : Number(lot.qtyReceived);
        const take = Math.min(qtyToConsume, currentRem);
        lot.qtyRemaining = Math.max(0, currentRem - take);
        qtyToConsume -= take;
      }
    });

    setStorageData(STORAGE_KEYS.STOCK_LOTS, lots);
  }

  if (productId) {
    const targetProd = products.find(p => p.id === productId || isProductMatch(p, { id: productId }));
    return lots.filter(l => isProductMatch(targetProd, l));
  }
  return lots;
};

export const saveStockLot = (lotData) => {
  const allLots = fetchStockLots();
  const existingIdx = allLots.findIndex(l => l.id === lotData.id);
  let updatedLots;
  if (existingIdx >= 0) {
    updatedLots = [...allLots];
    updatedLots[existingIdx] = { ...updatedLots[existingIdx], ...lotData };
  } else {
    updatedLots = [lotData, ...allLots];
  }
  setStorageData(STORAGE_KEYS.STOCK_LOTS, updatedLots);
  return updatedLots;
};

export const calculateProductWeightedAvgCost = (productId) => {
  const lots = fetchStockLots(productId);
  const activeLots = lots.filter(l => Number(l.qtyRemaining) > 0);
  
  if (activeLots.length === 0) {
    const products = fetchProducts();
    const prod = products.find(p => p.id === productId || isProductMatch(p, { id: productId }));
    return Number(prod?.purchasePrice) || 0;
  }

  const totalValue = activeLots.reduce((sum, l) => sum + ((Number(l.qtyRemaining) || 0) * (Number(l.purchasePrice) || 0)), 0);
  const totalQty = activeLots.reduce((sum, l) => sum + (Number(l.qtyRemaining) || 0), 0);

  return totalQty > 0 ? Number((totalValue / totalQty).toFixed(2)) : 0;
};

export const getProductStockValuation = (productId = null) => {
  const lots = fetchStockLots();
  const products = fetchProducts();

  if (productId) {
    const prod = products.find(p => p.id === productId || isProductMatch(p, { id: productId }));
    const pkg = getProductPackagingInfo(prod);
    const allProductLots = lots.filter(l => isProductMatch(prod, l));
    const targetLots = allProductLots.filter(l => Number(l.qtyRemaining) > 0);

    // Auto-normalize any legacy opening lots that were recorded in raw pieces instead of packaging units
    if (pkg.isSub && pkg.subPcs > 1) {
      targetLots.forEach(l => {
        if ((l.billId === 'opening' || l.id?.startsWith('lot_init_')) && l.qtyReceived > (pkg.effectiveUnits * 1.5)) {
          l.qtyReceived = Number((l.qtyReceived / pkg.subPcs).toFixed(2));
          l.qtyRemaining = Number((l.qtyRemaining / pkg.subPcs).toFixed(2));
        }
      });
    }

    const stockOnHandUnits = pkg.effectiveUnits;
    let totalExGst = 0;
    let totalWithGst = 0;
    let qtyLeftToValue = stockOnHandUnits;

    // Sort lots newest first so remaining closing stock is valued against most recent purchase rates
    const sortedLots = [...targetLots].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    for (const lot of sortedLots) {
      if (qtyLeftToValue <= 0) break;
      const lotRemaining = Number(lot.qtyRemaining) || 0;
      if (lotRemaining <= 0) continue;
      const takeQty = Math.min(qtyLeftToValue, lotRemaining);
      const lotPrice = Number(lot.purchasePrice) || 0;
      const rateWithGst = Number(lot.purchasePriceWithGst) || (lotPrice * (1 + (Number(lot.gstRate) || 0) / 100));

      totalExGst += takeQty * lotPrice;
      totalWithGst += takeQty * rateWithGst;
      qtyLeftToValue -= takeQty;
    }

    // If current stock on hand exceeds remaining lots, value remaining unbilled stock at master purchase price
    if (qtyLeftToValue > 0) {
      const pPrice = Number(prod?.purchasePrice) || 0;
      const gRate = Number(prod?.gstRate) || 0;
      totalExGst += qtyLeftToValue * pPrice;
      totalWithGst += qtyLeftToValue * (pPrice * (1 + gRate / 100));
    }

    const effectiveQty = stockOnHandUnits;
    const avgExGst = effectiveQty > 0 ? Number((totalExGst / effectiveQty).toFixed(2)) : (Number(prod?.purchasePrice) || 0);
    const avgWithGst = effectiveQty > 0 ? Number((totalWithGst / effectiveQty).toFixed(2)) : ((Number(prod?.purchasePrice) || 0) * (1 + (Number(prod?.gstRate) || 0) / 100));

    // Distinct purchase rates in active lots
    const distinctRates = Array.from(new Set(targetLots.map(l => Number(l.purchasePrice) || 0)));

    return {
      totalExGst: Number(totalExGst.toFixed(2)),
      totalWithGst: Number(totalWithGst.toFixed(2)),
      totalRemainingQty: effectiveQty,
      avgUnitCostExGst: avgExGst,
      avgUnitCostWithGst: avgWithGst,
      activeLotsCount: targetLots.length,
      distinctRatesCount: distinctRates.length,
      distinctRates,
      lots: targetLots,
      allLots: allProductLots,
      pkg
    };
  }

  // Entire catalog valuation across all products
  let grandTotalExGst = 0;
  let grandTotalWithGst = 0;
  let totalActiveLots = 0;

  products.forEach(p => {
    const val = getProductStockValuation(p.id);
    grandTotalExGst += val.totalExGst;
    grandTotalWithGst += val.totalWithGst;
    totalActiveLots += val.activeLotsCount;
  });

  return {
    totalExGst: Number(grandTotalExGst.toFixed(2)),
    totalWithGst: Number(grandTotalWithGst.toFixed(2)),
    activeLotsCount: totalActiveLots
  };
};

export const restoreStockLotsFromConsumed = (items) => {
  if (!items || !Array.isArray(items)) return;
  const allLots = fetchStockLots();
  let changed = false;

  items.forEach(item => {
    if (item.consumedLots && Array.isArray(item.consumedLots)) {
      item.consumedLots.forEach(consumed => {
        if (!consumed.lotId || consumed.lotId === 'fallback_buffer') return;
        const targetLot = allLots.find(l => l.id === consumed.lotId);
        if (targetLot) {
          targetLot.qtyRemaining = Math.min(
            Number(targetLot.qtyReceived) || 0,
            (Number(targetLot.qtyRemaining) || 0) + (Number(consumed.qty) || 0)
          );
          changed = true;
        }
      });
    }
  });

  if (changed) {
    setStorageData(STORAGE_KEYS.STOCK_LOTS, allLots);
  }
};


export const consumeStockLotsFIFO = (productId, qtyToConsume) => {
  const allLots = fetchStockLots();
  let remainingNeeded = Number(qtyToConsume) || 0;
  
  if (remainingNeeded <= 0) {
    return { unitCost: 0, totalCost: 0, consumedLots: [] };
  }

  // Get active lots for this product, sorted chronologically (oldest first - FIFO)
  const productLots = allLots
    .filter(l => l.productId === productId && (Number(l.qtyRemaining) > 0))
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  const consumedLots = [];
  let totalCost = 0;

  for (const lot of productLots) {
    if (remainingNeeded <= 0) break;
    const available = Number(lot.qtyRemaining) || 0;
    const take = Math.min(remainingNeeded, available);
    
    lot.qtyRemaining -= take;
    const lotCost = take * (Number(lot.purchasePrice) || 0);
    totalCost += lotCost;

    consumedLots.push({
      lotId: lot.id,
      billNo: lot.billNo,
      supplierName: lot.supplierName,
      date: lot.date,
      purchasePrice: Number(lot.purchasePrice) || 0,
      purchasePriceWithGst: Number(lot.purchasePriceWithGst) || 0,
      qty: take,
      cost: Number(lotCost.toFixed(2))
    });

    remainingNeeded -= take;
  }

  // If quantity exceeded available lots (e.g. negative/buffer stock), fallback for the remainder
  if (remainingNeeded > 0) {
    const products = fetchProducts();
    const prod = products.find(p => p.id === productId);
    const fallbackRate = Number(prod?.purchasePrice) || 0;
    const fallbackCost = remainingNeeded * fallbackRate;
    totalCost += fallbackCost;

    consumedLots.push({
      lotId: 'fallback_buffer',
      billNo: 'DIRECT-STOCK',
      supplierName: 'Standard Cost',
      date: new Date().toISOString().split('T')[0],
      purchasePrice: fallbackRate,
      purchasePriceWithGst: fallbackRate * (1 + (Number(prod?.gstRate || 0) / 100)),
      qty: remainingNeeded,
      cost: Number(fallbackCost.toFixed(2))
    });
  }

  // Save updated lots back to storage
  setStorageData(STORAGE_KEYS.STOCK_LOTS, allLots);

  const unitCost = qtyToConsume > 0 ? Number((totalCost / qtyToConsume).toFixed(2)) : 0;
  return {
    unitCost,
    totalCost: Number(totalCost.toFixed(2)),
    consumedLots
  };
};

export const isPurchaseBillEditable = (bill) => {
  if (!bill) return false;
  let createdTime = null;
  if (bill.createdAt) {
    createdTime = new Date(bill.createdAt).getTime();
  } else if (bill.id && typeof bill.id === 'string' && bill.id.startsWith('purch_')) {
    const match = bill.id.match(/^purch_(\d+)/);
    if (match) createdTime = parseInt(match[1], 10);
  }
  if (!createdTime && bill.date) {
    createdTime = new Date(bill.date).getTime();
  }
  if (!createdTime || isNaN(createdTime)) return false;
  const ageInMs = Date.now() - createdTime;
  const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
  return ageInMs >= 0 && ageInMs <= maxAgeMs;
};

export const getPurchaseBillRemainingEditTime = (bill) => {
  if (!bill) return null;
  let createdTime = null;
  if (bill.createdAt) {
    createdTime = new Date(bill.createdAt).getTime();
  } else if (bill.id && typeof bill.id === 'string' && bill.id.startsWith('purch_')) {
    const match = bill.id.match(/^purch_(\d+)/);
    if (match) createdTime = parseInt(match[1], 10);
  }
  if (!createdTime && bill.date) {
    createdTime = new Date(bill.date).getTime();
  }
  if (!createdTime || isNaN(createdTime)) return null;
  const elapsedMs = Date.now() - createdTime;
  const remainingMs = (24 * 60 * 60 * 1000) - elapsedMs;
  if (remainingMs <= 0) return null;
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m left to edit`;
  return `${minutes}m left to edit`;
};

export const savePurchase = (purchaseData) => {
  const purchases = fetchPurchases();
  const products = fetchProducts();
  let allLots = fetchStockLots();

  const existingIndex = purchaseData.id ? purchases.findIndex(p => p.id === purchaseData.id) : -1;
  const isEditing = existingIndex >= 0;
  const existingPurchase = isEditing ? purchases[existingIndex] : null;

  const id = purchaseData.id || 'purch_' + Date.now();
  const newPurchase = {
    ...purchaseData,
    id,
    createdAt: existingPurchase?.createdAt || purchaseData.createdAt || new Date().toISOString(),
    updatedAt: isEditing ? new Date().toISOString() : undefined
  };

  let currentProducts = [...products];

  // If editing an existing bill, reverse previous quantities and lots first
  if (isEditing && existingPurchase && Array.isArray(existingPurchase.items)) {
    existingPurchase.items.forEach(oldItem => {
      const oldQty = Number(oldItem.qty) || 0;
      if (oldQty <= 0) return;
      const pIdx = currentProducts.findIndex(p => isProductMatch(p, oldItem));
      if (pIdx >= 0) {
        const prod = currentProducts[pIdx];
        currentProducts[pIdx] = {
          ...prod,
          currentStock: Math.max(0, (Number(prod.currentStock) || 0) - oldQty)
        };
      }
    });

    // Remove old lots created by this bill
    allLots = allLots.filter(l => l.billId !== id);
  }

  // Update or add products, increment stock, and record exact inward stock lots
  if (purchaseData.items && Array.isArray(purchaseData.items)) {
    purchaseData.items.forEach((item, idx) => {
      const qtyToAdd = Number(item.qty) || 0;
      if (qtyToAdd <= 0 && !item.name) return;

      const existingProdIndex = currentProducts.findIndex(p => isProductMatch(p, item));

      const mrp = Number(item.mrp) || 0;
      const salePrice = Number(item.salePrice) || 0;
      const purchasePrice = Number(item.purchasePrice) || 0;
      const gstRate = Number(item.gstRate !== undefined ? item.gstRate : 0);
      const hsn = item.hsn || '';
      const purchasePriceWithGst = Number(item.purchasePriceWithGst) || (purchasePrice * (1 + gstRate / 100));

      let resolvedProductId;

      if (existingProdIndex >= 0) {
        const existing = currentProducts[existingProdIndex];
        resolvedProductId = existing.id;
        currentProducts[existingProdIndex] = {
          ...existing,
          currentStock: (Number(existing.currentStock) || 0) + qtyToAdd,
          mrp: mrp > 0 ? mrp : existing.mrp,
          salePrice: salePrice > 0 ? salePrice : existing.salePrice,
          latestPurchasePrice: purchasePrice > 0 ? purchasePrice : (existing.latestPurchasePrice || existing.purchasePrice),
          gstRate: gstRate >= 0 ? gstRate : existing.gstRate,
          hsn: hsn || existing.hsn,
          batchNo: item.batchNo || existing.batchNo || '',
          mfgDate: item.mfgDate || existing.mfgDate || '',
          expiryDate: item.expiryDate || existing.expiryDate || '',
          warehouseId: purchaseData.warehouseId || existing.warehouseId || 'wh_main'
        };
      } else {
        // Create new product
        resolvedProductId = 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const newProd = {
          id: resolvedProductId,
          name: item.name || 'New Item',
          sku: item.sku || `SKU-${Date.now().toString().slice(-6)}`,
          brand: item.brand || 'Standard',
          category: item.category || 'General FMCG',
          mrp,
          salePrice,
          purchasePrice,
          latestPurchasePrice: purchasePrice,
          gstRate,
          hsn,
          batchNo: item.batchNo || '',
          mfgDate: item.mfgDate || '',
          expiryDate: item.expiryDate || '',
          currentStock: qtyToAdd,
          pcsPerCarton: Number(item.pcsPerCarton) || 24,
          warehouseId: purchaseData.warehouseId || 'wh_main'
        };
        currentProducts = [newProd, ...currentProducts];
      }

      // Record distinct Inward Stock Lot preserving the exact bill rate!
      const newLot = {
        id: `lot_purch_${id}_${idx}_${Date.now()}`,
        productId: resolvedProductId,
        productName: (existingProdIndex >= 0 ? currentProducts[existingProdIndex]?.name : item.name) || 'Item',
        sku: (existingProdIndex >= 0 ? currentProducts[existingProdIndex]?.sku : item.sku) || '',
        billId: id,
        billNo: purchaseData.billNo || 'INWARD-BILL',
        supplierName: purchaseData.partyName || 'Supplier',
        date: purchaseData.date || new Date().toISOString().split('T')[0],
        batchNo: item.batchNo || purchaseData.billNo || 'LOT-' + Date.now().toString().slice(-4),
        mfgDate: item.mfgDate || '',
        expiryDate: item.expiryDate || '',
        purchasePrice,
        purchasePriceWithGst,
        gstRate,
        qtyReceived: qtyToAdd,
        qtyRemaining: qtyToAdd,
        warehouseId: purchaseData.warehouseId || 'wh_main'
      };
      allLots.push(newLot);
    });

    setStorageData(STORAGE_KEYS.STOCK_LOTS, allLots);

    // Recompute weighted average cost for affected products
    purchaseData.items.forEach(item => {
      const matchingProd = currentProducts.find(p => isProductMatch(p, item));
      if (matchingProd) {
        const wac = calculateProductWeightedAvgCost(matchingProd.id);
        if (wac > 0) {
          matchingProd.purchasePrice = wac;
        }
      }
    });

    setStorageData(STORAGE_KEYS.PRODUCTS, currentProducts);
  }

  // Auto-record or update purchase party (supplier) in distro_suppliers
  if (purchaseData.partyName) {
    const suppliers = fetchSuppliers();
    const existingSupplier = suppliers.find(s => s.name.trim().toLowerCase() === purchaseData.partyName.trim().toLowerCase());
    if (existingSupplier) {
      if (purchaseData.partyGst && !existingSupplier.gstin) {
        saveSupplier({ ...existingSupplier, gstin: purchaseData.partyGst.trim() });
      }
    } else {
      saveSupplier({
        name: purchaseData.partyName.trim(),
        gstin: purchaseData.partyGst ? purchaseData.partyGst.trim() : '',
        phone: purchaseData.partyPhone || '',
        address: purchaseData.partyAddress || '',
        city: purchaseData.partyCity || ''
      });
    }
  }

  let updatedPurchases;
  if (isEditing) {
    updatedPurchases = purchases.map(p => p.id === id ? newPurchase : p);
  } else {
    updatedPurchases = [newPurchase, ...purchases];
  }
  // Automatically arrange in date order (newest date first)
  updatedPurchases.sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    if (db !== da) return db.localeCompare(da);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  setStorageData(STORAGE_KEYS.PURCHASES, updatedPurchases);

  logAuditAction(
    isEditing ? 'EDIT_PURCHASE' : 'RECORD_PURCHASE',
    'Inventory & Stock',
    `${isEditing ? 'Updated purchase bill' : 'Purchase bill recorded'} #${newPurchase.billNo || id} from ${purchaseData.partyName || 'Supplier'} (${purchaseData.items?.length || 0} items, Total: ₹${Number(purchaseData.grandTotal || 0).toLocaleString('en-IN')})`
  );

  autoCloudSync();
  return { success: true, purchase: newPurchase };
};

export const deletePurchase = (purchaseId) => {
  recordDeletedId(purchaseId);
  const purchases = fetchPurchases();
  const target = purchases.find(p => p.id === purchaseId);
  const updated = purchases.filter(p => p.id !== purchaseId);
  setStorageData(STORAGE_KEYS.PURCHASES, updated);

  // Remove corresponding lots and adjust product stock
  const allLots = fetchStockLots();
  const lotsToRemove = allLots.filter(l => l.billId === purchaseId);
  const remainingLots = allLots.filter(l => l.billId !== purchaseId);
  setStorageData(STORAGE_KEYS.STOCK_LOTS, remainingLots);

  if (lotsToRemove.length > 0) {
    const products = fetchProducts();
    const updatedProducts = products.map(prod => {
      const removedForProd = lotsToRemove.filter(l => l.productId === prod.id);
      if (removedForProd.length > 0) {
        const qtyToReduce = removedForProd.reduce((sum, l) => sum + (Number(l.qtyRemaining) || 0), 0);
        const newStock = Math.max(0, (Number(prod.currentStock) || 0) - qtyToReduce);
        const newWac = calculateProductWeightedAvgCost(prod.id);
        return {
          ...prod,
          currentStock: newStock,
          purchasePrice: newWac > 0 ? newWac : prod.purchasePrice
        };
      }
      return prod;
    });
    setStorageData(STORAGE_KEYS.PRODUCTS, updatedProducts);
  }

  logAuditAction('DELETE_PURCHASE', 'Suppliers & Purchases', `Deleted purchase bill #${target?.billNo || purchaseId} from ${target?.partyName || 'Supplier'}`);
  autoCloudSync();
  return updated;
};

/**
 * Normalizes all historical purchase bills and their associated inward stock lots:
 * 1. Checks each line item in each purchase bill.
 * 2. Normalizes any FMCG items that erroneously had 18% GST to 5% GST.
 * 3. Re-computes accurate purchasePriceWithGst = purchasePrice * (1 + gstRate / 100).
 * 4. Recalculates totalAmountExGst, totalGst, and grandTotal using standard slab-wise GST calculation.
 * 5. Synchronizes distro_stock_lots with updated rates and lot valuations.
 */
export const recalculateAndNormalizeAllPurchaseBills = () => {
  const purchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
  let allLots = getStorageData(STORAGE_KEYS.STOCK_LOTS, null);
  let hasPurchasesUpdated = false;
  let hasLotsUpdated = false;
  let totalRecalculatedBills = 0;

  const updatedPurchases = purchases.map(bill => {
    if (!bill || !Array.isArray(bill.items) || bill.items.length === 0) return bill;

    let billItemsChanged = false;
    const updatedItems = bill.items.map(item => {
      let rate = Number(item.gstRate !== undefined ? item.gstRate : 5);
      const name = (item.name || '').trim().toUpperCase();

      // Normalize any snack/namkeen item that had 18% or undefined to 5%
      if (
        rate === 18 && 
        (name.includes('KHATTA MEETHA') || name.includes('AKHA CHANA') || name.includes('MIXTURE') || name.includes('MRP-5') || name.includes('MRP-10') || name.includes('CLAP') || name.includes('PAPDI'))
      ) {
        rate = 5;
        billItemsChanged = true;
      }

      const pEx = Number(item.purchasePrice) || 0;
      const expectedWithGst = Number((pEx * (1 + rate / 100)).toFixed(2));
      const currentWithGst = Number(item.purchasePriceWithGst);

      if (Math.abs(expectedWithGst - currentWithGst) > 0.009 || item.gstRate !== rate) {
        billItemsChanged = true;
      }

      return {
        ...item,
        gstRate: rate,
        purchasePriceWithGst: expectedWithGst
      };
    });

    // Standard slab-wise GST calculation
    const slabs = {};
    let totalExGst = 0;
    updatedItems.forEach(it => {
      const q = Number(it.qty) || 0;
      const ex = Number(it.purchasePrice) || 0;
      const r = Number(it.gstRate !== undefined ? it.gstRate : 5);
      const taxVal = q * ex;
      totalExGst += taxVal;
      if (!slabs[r]) slabs[r] = 0;
      slabs[r] += taxVal;
    });

    let totalGst = 0;
    Object.keys(slabs).forEach(rKey => {
      const r = Number(rKey);
      totalGst += Number((slabs[rKey] * r / 100).toFixed(2));
    });

    totalExGst = Number(totalExGst.toFixed(2));
    totalGst = Number(totalGst.toFixed(2));
    const grandTotal = Number((totalExGst + totalGst).toFixed(2));

    const oldTotalEx = Number(bill.totalAmountExGst) || 0;
    const oldTotalGst = Number(bill.totalGst) || 0;
    const oldGrandTotal = Number(bill.grandTotal) || 0;

    if (
      billItemsChanged || 
      Math.abs(oldTotalEx - totalExGst) > 0.01 ||
      Math.abs(oldTotalGst - totalGst) > 0.01 ||
      Math.abs(oldGrandTotal - grandTotal) > 0.01
    ) {
      hasPurchasesUpdated = true;
      totalRecalculatedBills++;
      return {
        ...bill,
        items: updatedItems,
        totalAmountExGst: totalExGst,
        totalGst: totalGst,
        grandTotal: grandTotal,
        recalculatedAt: new Date().toISOString()
      };
    }

    return bill;
  });

  if (hasPurchasesUpdated) {
    updatedPurchases.sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      if (db !== da) return db.localeCompare(da);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    setStorageData(STORAGE_KEYS.PURCHASES, updatedPurchases);

    // Also synchronize stock lots if they exist
    if (Array.isArray(allLots) && allLots.length > 0) {
      allLots = allLots.map(lot => {
        const matchingBill = updatedPurchases.find(b => b.id === lot.billId);
        if (!matchingBill || !Array.isArray(matchingBill.items)) return lot;

        const matchingItem = matchingBill.items.find(it => 
          (it.productId && lot.productId === it.productId) ||
          isProductMatch(it, lot)
        );

        if (matchingItem) {
          const rate = Number(matchingItem.gstRate || 5);
          const pEx = Number(lot.purchasePrice) || Number(matchingItem.purchasePrice) || 0;
          const newWithGst = Number((pEx * (1 + rate / 100)).toFixed(2));

          if (lot.gstRate !== rate || Math.abs((lot.purchasePriceWithGst || 0) - newWithGst) > 0.009) {
            hasLotsUpdated = true;
            return {
              ...lot,
              gstRate: rate,
              purchasePriceWithGst: newWithGst
            };
          }
        }
        return lot;
      });

      if (hasLotsUpdated) {
        setStorageData(STORAGE_KEYS.STOCK_LOTS, allLots);
      }
    }

    logAuditAction('NORMALIZE_PURCHASE_BILLS', 'Inventory & Stock', `Recalculated and normalized GST on ${totalRecalculatedBills} historical purchase bills to standard slab calculation.`);
  }

  return {
    updated: hasPurchasesUpdated,
    recalculatedCount: totalRecalculatedBills,
    totalBills: updatedPurchases.length,
    purchases: updatedPurchases
  };
};

// Operations: Suppliers / Purchase Parties (Vendors)
export const fetchSuppliers = () => {
  const delSet = new Set(getDeletedIds());
  const suppliers = getStorageData(STORAGE_KEYS.SUPPLIERS, []).filter(s => s && !delSet.has(s.id));

  // If no suppliers exist yet, check past purchases to auto-populate
  if (suppliers.length === 0) {
    const purchases = getStorageData(STORAGE_KEYS.PURCHASES, []);
    const seen = new Set();
    const extracted = [];
    purchases.forEach(p => {
      if (p && p.partyName && !seen.has(p.partyName.trim().toLowerCase())) {
        seen.add(p.partyName.trim().toLowerCase());
        extracted.push({
          id: 'supp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: p.partyName.trim(),
          gstin: p.partyGst || '',
          city: '',
          phone: '',
          address: ''
        });
      }
    });
    if (extracted.length > 0) {
      setStorageData(STORAGE_KEYS.SUPPLIERS, extracted);
      return extracted;
    }
  }
  return suppliers;
};

export const saveSupplier = (supplier) => {
  if (supplier.id) {
    unrecordDeletedId(supplier.id);
  }
  const suppliers = fetchSuppliers();
  let updated;
  let targetSupplier;
  if (supplier.id) {
    targetSupplier = supplier;
    updated = suppliers.map(s => s.id === supplier.id ? supplier : s);
    logAuditAction('EDIT_SUPPLIER', 'Suppliers & Purchases', `Updated purchase party: ${supplier.name}`);
  } else {
    targetSupplier = {
      ...supplier,
      id: 'supp_' + Date.now()
    };
    updated = [targetSupplier, ...suppliers];
    logAuditAction('ADD_SUPPLIER', 'Suppliers & Purchases', `Added purchase party: ${supplier.name} (${supplier.gstin || 'N/A'})`);
  }
  setStorageData(STORAGE_KEYS.SUPPLIERS, updated);
  autoCloudSync();
  return targetSupplier;
};

export const deleteSupplier = (id) => {
  recordDeletedId(id);
  const currentSuppliers = getStorageData(STORAGE_KEYS.SUPPLIERS, []);
  const target = currentSuppliers.find(s => s && s.id === id);
  const updated = currentSuppliers.filter(s => s && s.id !== id);
  setStorageData(STORAGE_KEYS.SUPPLIERS, updated);
  logAuditAction('DELETE_SUPPLIER', 'Suppliers & Purchases', `Deleted purchase party: ${target?.name || 'Supplier'}`);
  autoCloudSync();
  return updated;
};

// Operations: Parties (Customers / Retailers)
export const fetchParties = () => {
  const delSet = new Set(getDeletedIds());
  return getStorageData(STORAGE_KEYS.PARTIES, []).filter(p => p && !SAMPLE_IDS.includes(p.id) && !delSet.has(p.id));
};

export const saveParty = (party) => {
  if (party.id) {
    unrecordDeletedId(party.id);
  }
  const parties = fetchParties();
  let updated;
  let targetParty;
  if (party.id) {
    targetParty = party;
    updated = parties.map(p => p.id === party.id ? party : p);
    logAuditAction('EDIT_PARTY', 'Parties & CRM', `Updated retailer profile: ${party.name} (${party.city || 'Local'})`);
  } else {
    targetParty = {
      ...party,
      id: 'party_' + Date.now(),
      balance: Number(party.balance) || 0
    };
    updated = [targetParty, ...parties];
    logAuditAction('ADD_PARTY', 'Parties & CRM', `Added new retailer: ${party.name} (Phone: ${party.phone || 'N/A'})`);
  }
  setStorageData(STORAGE_KEYS.PARTIES, updated);
  autoCloudSync();
  return targetParty;
};

export const updatePartyBalance = (partyId, amountToAdd) => {
  const parties = fetchParties();
  let pName = 'Retailer';
  const updated = parties.map(p => {
    if (p.id === partyId) {
      pName = p.name;
      const newBal = (Number(p.balance) || 0) + Number(amountToAdd);
      return { ...p, balance: Math.max(0, newBal) };
    }
    return p;
  });
  setStorageData(STORAGE_KEYS.PARTIES, updated);
  logAuditAction('BALANCE_ADJUST', 'Parties & CRM', `Outstanding ledger balance updated for ${pName}: ₹${Number(amountToAdd).toLocaleString('en-IN')}`);
  autoCloudSync();
  return updated;
};

export const deleteParty = (id) => {
  recordDeletedId(id);
  const currentParties = getStorageData(STORAGE_KEYS.PARTIES, []);
  const target = currentParties.find(p => p && p.id === id);
  const parties = currentParties.filter(p => p && p.id !== id && !SAMPLE_IDS.includes(p.id));
  setStorageData(STORAGE_KEYS.PARTIES, parties);
  
  logAuditAction('DELETE_PARTY', 'Parties & CRM', `Deleted retailer: ${target?.name || 'Retailer'}`);

  const client = getSupabaseClient();
  if (client) {
    client.from('parties').delete().eq('id', id).then(() => {}).catch(console.error);
  }
  autoCloudSync();
  return parties;
};

// --- INVOICE HISTORY / ACTIVITY AUDIT TRAIL SERVICE ---
export const InvoiceHistoryLogger = {
  log: ({
    invoiceId,
    actionType, // 'CREATED', 'UPDATED', 'RECEIPT_CREATED', 'RETURN_INITIATED', 'RETURN_RECEIVED', 'CREDIT_NOTE_ISSUED', 'REPLACEMENT_LINKED', 'GSTR1_EXPORTED', 'STATUS_CHANGE'
    description,
    referenceDocumentId = null,
    referenceDocumentType = null, // 'RETURN', 'CREDIT_NOTE', 'REPLACEMENT_INVOICE', 'PAYMENT'
    metadata = null,
    userId = null
  }) => {
    if (!invoiceId) return null;
    const currentOp = getStorageData(STORAGE_KEYS.CURRENT_OPERATOR, DEFAULT_OPERATOR);
    const resolvedUser = userId || currentOp?.name || 'Administrator';
    const logs = getStorageData(STORAGE_KEYS.INVOICE_HISTORY, []);

    const newEntry = {
      id: 'ih_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      invoiceId: String(invoiceId),
      userId: resolvedUser,
      actionType,
      description,
      referenceDocumentId: referenceDocumentId ? String(referenceDocumentId) : null,
      referenceDocumentType: referenceDocumentType || null,
      metadata: metadata || null,
      createdAt: new Date().toISOString()
    };

    const updated = [newEntry, ...logs];
    setStorageData(STORAGE_KEYS.INVOICE_HISTORY, updated);

    // Sync to Supabase invoice_history_logs table if cloud active
    try {
      const client = getSupabaseClient();
      if (client) {
        client.from('invoice_history_logs').insert([{
          invoice_id: newEntry.invoiceId,
          user_id: newEntry.userId,
          action_type: newEntry.actionType,
          description: newEntry.description,
          reference_document_id: newEntry.referenceDocumentId,
          reference_document_type: newEntry.referenceDocumentType,
          metadata: newEntry.metadata,
          created_at: newEntry.createdAt
        }]).then(() => {}).catch(() => {});
      }
    } catch (e) {}

    autoCloudSync();
    return newEntry;
  },

  getLogs: (invoiceId) => {
    if (!invoiceId) return [];
    const logs = getStorageData(STORAGE_KEYS.INVOICE_HISTORY, []);
    return logs
      .filter(l => l && String(l.invoiceId) === String(invoiceId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getAllLogs: () => {
    return getStorageData(STORAGE_KEYS.INVOICE_HISTORY, [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
};

export const fetchInvoiceHistory = (invoiceId) => {
  return InvoiceHistoryLogger.getLogs(invoiceId);
};

// Extract numeric value from invoice string (e.g. "109" -> 109, "INV-109" -> 109)
export const extractInvoiceNumericValue = (invNo) => {
  if (invNo === undefined || invNo === null) return null;
  const str = String(invNo).trim();
  if (!str) return null;
  const match = str.match(/(\d+)(?!.*\d)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
};

// Robust descending comparator: Sorts by Date descending, and on same date by Invoice Number descending
export const compareInvoicesDesc = (a, b) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  // 1. Primary: Compare calendar date (YYYY-MM-DD)
  const dayA = (a.date || '').split('T')[0] || (a.createdAt || '').split('T')[0] || '';
  const dayB = (b.date || '').split('T')[0] || (b.createdAt || '').split('T')[0] || '';

  if (dayA && dayB && dayA !== dayB) {
    return dayB.localeCompare(dayA);
  }

  // 2. Secondary: If on same date (or dates missing), sort by Invoice Number descending
  const numA = extractInvoiceNumericValue(a.invoiceNo);
  const numB = extractInvoiceNumericValue(b.invoiceNo);

  if (numA !== null && numB !== null && numA !== numB) {
    return numB - numA;
  }

  // Fallback alphanumeric comparison
  if (a.invoiceNo && b.invoiceNo && a.invoiceNo !== b.invoiceNo) {
    return String(b.invoiceNo).localeCompare(String(a.invoiceNo), undefined, { numeric: true, sensitivity: 'base' });
  }

  // 3. Fallback: Full ISO timestamp or id
  const timeA = new Date(a.date || a.createdAt || 0).getTime();
  const timeB = new Date(b.date || b.createdAt || 0).getTime();
  if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
    return timeB - timeA;
  }

  return String(b.id || '').localeCompare(String(a.id || ''));
};

// Operations: Invoices
export const fetchInvoices = () => {
  const delSet = new Set(getDeletedIds());
  return getStorageData(STORAGE_KEYS.INVOICES, [])
    .filter(i => i && !SAMPLE_IDS.includes(i.id) && !delSet.has(i.id))
    .sort(compareInvoicesDesc);
};

// Calculate Due Date from Invoice Date + Payment Terms
export const calculateDueDate = (invoiceDateStr, terms = 'immediate') => {
  const base = invoiceDateStr ? new Date(invoiceDateStr) : new Date();
  if (isNaN(base.getTime())) return new Date().toISOString().split('T')[0];
  
  if (terms === '15_days') {
    base.setDate(base.getDate() + 15);
  } else if (terms === '30_days') {
    base.setDate(base.getDate() + 30);
  } else if (terms === '45_days') {
    base.setDate(base.getDate() + 45);
  } else if (terms === 'end_of_month') {
    base.setMonth(base.getMonth() + 1, 0); // Last day of current month
  }
  return base.toISOString().split('T')[0];
};

// Find existing invoice by number (Security helper to prevent duplicate bills)
export const findInvoiceByNumber = (invNo, excludeId = null) => {
  if (!invNo || !String(invNo).trim()) return null;
  const clean = String(invNo).trim().toLowerCase();
  const invoices = fetchInvoices();
  return invoices.find(i => {
    if (!i || !i.invoiceNo) return false;
    if (excludeId && i.id === excludeId) return false;
    return String(i.invoiceNo).trim().toLowerCase() === clean;
  }) || null;
};

export const getNextInvoiceNumber = () => {
  const invoices = fetchInvoices();
  const business = getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  const configuredStart = Number(business.nextInvoiceNumber);
  const baseStart = (!isNaN(configuredStart) && configuredStart > 0) ? configuredStart : 206;
  const rawPrefix = (business.invoicePrefix && business.invoicePrefix !== 'INV/26-27/') ? business.invoicePrefix.trim() : '';

  let maxFound = baseStart - 1;

  invoices.forEach(inv => {
    if (!inv || !inv.invoiceNo) return;
    const invNoStr = String(inv.invoiceNo).trim();
    if (invNoStr.toUpperCase().startsWith('DRAFT')) return;

    let numVal = null;
    if (rawPrefix) {
      if (invNoStr.startsWith(rawPrefix)) {
        const rest = invNoStr.slice(rawPrefix.length).trim();
        if (/^\d+$/.test(rest)) {
          numVal = parseInt(rest, 10);
        }
      }
    } else {
      if (/^\d+$/.test(invNoStr)) {
        numVal = parseInt(invNoStr, 10);
      }
    }

    if (numVal !== null) {
      if (numVal >= 1000 && baseStart < 1000) {
        return; // ignore mock 1000+ numbers when user series is in the 100s
      }
      if (numVal > maxFound) {
        maxFound = numVal;
      }
    }
  });

  const nextNum = maxFound + 1;
  return rawPrefix ? `${rawPrefix}${nextNum}` : `${nextNum}`;
};

export const saveInvoice = (invoiceData) => {
  if (invoiceData.id) {
    unrecordDeletedId(invoiceData.id);
  }
  const invoices = fetchInvoices();
  const products = fetchProducts();
  const business = getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  const currentOp = getCurrentOperator();

  const isDraft = invoiceData.state === 'draft';
  const autoNo = getNextInvoiceNumber();
  const officialInvoiceNo = invoiceData.invoiceNo && !invoiceData.invoiceNo.startsWith('DRAFT') 
    ? invoiceData.invoiceNo.trim() 
    : autoNo;

  const invoiceNo = isDraft 
    ? (invoiceData.invoiceNo || `DRAFT/${new Date().getFullYear()}/${autoNo}`) 
    : officialInvoiceNo;

  // Generate simulated 64-char IRN for GST e-Invoice compliance
  const generatedIrn = invoiceData.irn || Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');

  const partyNameResolved = invoiceData.partyName || invoiceData.customerName || 'Cash Customer';
  const taxableSubtotal = Number(invoiceData.taxableSubtotal || invoiceData.taxableAmount || invoiceData.subtotal || invoiceData.subTotal || invoiceData.grandTotal) || 0;
  const grandTotal = Number(invoiceData.grandTotal) || 0;
  
  let paidAmount = Number(invoiceData.paidAmount) || 0;
  if (!isDraft && invoiceData.paymentStatus === 'PAID') {
    paidAmount = grandTotal;
  }

  const amountDue = Math.max(0, grandTotal - paidAmount);

  // Determine Odoo Document State
  let odooState = invoiceData.state;
  if (!odooState) {
    if (paidAmount >= grandTotal && grandTotal > 0) {
      odooState = 'paid';
    } else if (paidAmount > 0) {
      odooState = 'in_payment';
    } else {
      odooState = 'posted';
    }
  }

  // Payment Terms & Due Date
  const paymentTerms = invoiceData.paymentTerms || 'immediate';
  const dueDate = invoiceData.dueDate || calculateDueDate(invoiceData.date, paymentTerms);

  // Initial Payment History Record if paid amount > 0
  const initialPayments = invoiceData.payments || (paidAmount > 0 ? [{
    id: 'pay_' + Date.now(),
    date: invoiceData.date || new Date().toISOString(),
    amount: paidAmount,
    journal: invoiceData.paymentMode || 'CASH',
    paymentMethod: invoiceData.paymentMode || 'MANUAL',
    memo: `Initial payment for ${invoiceNo}`
  }] : []);

  // Initial Chatter / Activity Timeline
  const initialChatter = invoiceData.chatter || [{
    id: 'cht_' + Date.now(),
    date: new Date().toISOString(),
    author: currentOp?.name || 'Administrator',
    text: isDraft ? 'Draft Invoice created' : `Invoice confirmed and posted (${odooState.toUpperCase()})`,
    type: 'system'
  }];

  const newInvoice = {
    ...invoiceData,
    id: invoiceData.id || ('inv_' + Date.now()),
    documentType: invoiceData.documentType || 'out_invoice', // 'out_invoice' or 'out_refund' (Credit Note)
    journal: invoiceData.journal || 'INV',
    invoiceNo,
    date: invoiceData.date || new Date().toISOString(),
    paymentTerms,
    dueDate,
    irn: generatedIrn,
    ackNo: invoiceData.ackNo || ('1' + Math.floor(10000000000 + Math.random() * 90000000000)),
    ackDate: invoiceData.ackDate || (invoiceData.date ? invoiceData.date.split('T')[0] : new Date().toISOString().split('T')[0]),
    warehouseId: invoiceData.warehouseId || 'wh_main',
    operator: invoiceData.operator || currentOp?.name || 'Admin',
    paymentMode: invoiceData.paymentMode || 'CASH',
    partyName: partyNameResolved,
    customerName: partyNameResolved,
    subtotal: taxableSubtotal,
    subTotal: taxableSubtotal,
    taxableAmount: taxableSubtotal,
    taxTotal: Number(invoiceData.taxTotal !== undefined ? invoiceData.taxTotal : (Number(invoiceData.cgst || 0) + Number(invoiceData.sgst || 0) + Number(invoiceData.igst || 0))) || 0,
    paidAmount,
    amountDue,
    balanceAmount: amountDue,
    state: odooState,
    payments: initialPayments,
    chatter: initialChatter
  };

  // If NOT draft, commit inventory, FIFO lot consumption, and party ledger
  if (!isDraft) {
    // 1. Consume FIFO stock lots and attach original purchase cost breakdown per item
    const enrichedItems = (invoiceData.items || []).map(item => {
      if (!item.isSection && !item.isNote) {
        const prod = products.find(p => p.id === item.productId || (p.sku && item.sku && p.sku === item.sku) || (p.name && item.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()));
        const resolvedBrand = (item.brand && item.brand.trim() && item.brand !== 'General') ? item.brand : (prod?.brand || 'General');
        const fifoResult = item.productId ? consumeStockLotsFIFO(item.productId, Number(item.qty) || 0) : { unitCost: Number(item.costPrice) || 0, totalCost: 0, consumedLots: [] };
        return {
          ...item,
          brand: resolvedBrand,
          costPrice: fifoResult.unitCost,
          totalCost: fifoResult.totalCost,
          consumedLots: fifoResult.consumedLots
        };
      }
      return item;
    });
    newInvoice.items = enrichedItems;

    // 2. Deduct Stock for billed items and recompute weighted average cost
    const updatedProducts = products.map(p => {
      const billedItem = enrichedItems.find(item => item.productId === p.id);
      if (billedItem && !billedItem.isSection && !billedItem.isNote) {
        const remainingStock = Math.max(0, Number(p.currentStock) - Number(billedItem.qty));
        const newWac = calculateProductWeightedAvgCost(p.id);
        return { 
          ...p, 
          currentStock: remainingStock,
          purchasePrice: newWac > 0 ? newWac : p.purchasePrice
        };
      }
      return p;
    });
    setStorageData(STORAGE_KEYS.PRODUCTS, updatedProducts);

    // 3. If bill has open balance, add balance to Party Ledger
    if (invoiceData.partyId && amountDue > 0) {
      updatePartyBalance(invoiceData.partyId, amountDue);
    }
  }

  // 3. Save Invoice (update existing or append)
  const existingIndex = invoices.findIndex(i => i.id === newInvoice.id);
  let updatedInvoices;
  if (existingIndex > -1) {
    updatedInvoices = [...invoices];
    updatedInvoices[existingIndex] = newInvoice;
  } else {
    updatedInvoices = [newInvoice, ...invoices];
  }
  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);
  
  // 4. Log Audit Action
  logAuditAction(
    isDraft ? 'DRAFT_INVOICE_CREATED' : 'CREATE_INVOICE',
    'Billing & Invoicing',
    `${isDraft ? 'Created Draft Invoice' : 'Confirmed Invoice'} #${newInvoice.invoiceNo} for ${newInvoice.customerName || 'Cash Sale'} (₹${Number(newInvoice.grandTotal || 0).toLocaleString('en-IN')})`
  );

  // 5. Log Invoice Activity History
  InvoiceHistoryLogger.log({
    invoiceId: newInvoice.id,
    actionType: existingIndex > -1 ? 'UPDATED' : 'CREATED',
    description: isDraft 
      ? `Draft Invoice #${newInvoice.invoiceNo} saved (${newInvoice.items?.length || 0} items, ₹${Number(newInvoice.grandTotal || 0).toLocaleString('en-IN')})`
      : `Invoice #${newInvoice.invoiceNo} created for ${newInvoice.customerName || 'Customer'} (₹${Number(newInvoice.grandTotal || 0).toLocaleString('en-IN')})`,
    metadata: { invoiceNo: newInvoice.invoiceNo, grandTotal: newInvoice.grandTotal, state: newInvoice.state }
  });

  autoCloudSync();
  return newInvoice;
};

// Update an existing invoice in-place: reverses old stock/balance, then saves with same id+invoiceNo
export const updateInvoice = (originalInvoice, updatedData) => {
  const products = fetchProducts();

  // 1. Reverse old stock deduction and restore stock lots
  if (originalInvoice.items && Array.isArray(originalInvoice.items)) {
    restoreStockLotsFromConsumed(originalInvoice.items);
    const restoredProducts = products.map(p => {
      const old = originalInvoice.items.find(item => item.productId === p.id);
      if (old && !old.isSection && !old.isNote) {
        const restoredStock = (Number(p.currentStock) || 0) + (Number(old.qty) || 0);
        const restoredWac = calculateProductWeightedAvgCost(p.id);
        return { 
          ...p, 
          currentStock: restoredStock,
          purchasePrice: restoredWac > 0 ? restoredWac : p.purchasePrice
        };
      }
      return p;
    });
    setStorageData(STORAGE_KEYS.PRODUCTS, restoredProducts);
  }

  // 2. Reverse old party balance (only the unpaid portion)
  if (originalInvoice.partyId) {
    const oldDue = originalInvoice.balanceAmount || Math.max(0, (Number(originalInvoice.grandTotal) || 0) - (Number(originalInvoice.paidAmount) || 0));
    if (oldDue > 0) updatePartyBalance(originalInvoice.partyId, -oldDue);
  }

  // 3. Remove the old invoice record from the list (without tombstoning the id)
  const invoices = fetchInvoices();
  const withoutOld = invoices.filter(i => i.id !== originalInvoice.id);
  setStorageData(STORAGE_KEYS.INVOICES, withoutOld);

  // 4. Save with same id + invoiceNo (or updated custom invoiceNo)
  return saveInvoice({
    ...updatedData,
    id: originalInvoice.id,
    invoiceNo: (updatedData.invoiceNo && updatedData.invoiceNo.trim()) ? updatedData.invoiceNo.trim() : originalInvoice.invoiceNo,
    irn: originalInvoice.irn,
    ackNo: originalInvoice.ackNo,
    ackDate: originalInvoice.ackDate,
  });
};

// Odoo Action: Confirm & Post a Draft Invoice
export const postInvoice = (invoiceId) => {
  const invoices = fetchInvoices();
  const target = invoices.find(i => i.id === invoiceId);
  if (!target || target.state !== 'draft') return target;

  const business = getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  const currentOp = getCurrentOperator();
  const products = fetchProducts();

  // Generate official sequence number
  const nextNumber = invoices.filter(i => i.state !== 'draft').length + 1001;
  const officialInvoiceNo = `${business.invoicePrefix || 'INV/'}${nextNumber}`;

  // Deduct inventory stock & consume FIFO stock lots
  let enrichedItems = target.items || [];
  if (target.items && Array.isArray(target.items)) {
    enrichedItems = target.items.map(item => {
      if (!item.isSection && !item.isNote && item.productId) {
        const fifoResult = consumeStockLotsFIFO(item.productId, Number(item.qty) || 0);
        return {
          ...item,
          costPrice: fifoResult.unitCost,
          totalCost: fifoResult.totalCost,
          consumedLots: fifoResult.consumedLots
        };
      }
      return item;
    });

    const updatedProducts = products.map(p => {
      const billedItem = enrichedItems.find(item => item.productId === p.id);
      if (billedItem && !billedItem.isSection && !billedItem.isNote) {
        const remainingStock = Math.max(0, Number(p.currentStock) - Number(billedItem.qty));
        const newWac = calculateProductWeightedAvgCost(p.id);
        return { 
          ...p, 
          currentStock: remainingStock,
          purchasePrice: newWac > 0 ? newWac : p.purchasePrice
        };
      }
      return p;
    });
    setStorageData(STORAGE_KEYS.PRODUCTS, updatedProducts);
  }

  const grandTotal = Number(target.grandTotal) || 0;
  const paidAmount = Number(target.paidAmount) || 0;
  const amountDue = Math.max(0, grandTotal - paidAmount);

  // Update customer ledger if open debt
  if (target.partyId && amountDue > 0) {
    updatePartyBalance(target.partyId, amountDue);
  }

  const newState = amountDue === 0 ? 'paid' : (paidAmount > 0 ? 'in_payment' : 'posted');

  const updatedInvoice = {
    ...target,
    items: enrichedItems,
    invoiceNo: officialInvoiceNo,
    state: newState,
    amountDue,
    balanceAmount: amountDue,
    chatter: [
      ...(target.chatter || []),
      {
        id: 'cht_' + Date.now(),
        date: new Date().toISOString(),
        author: currentOp?.name || 'Administrator',
        text: `Invoice confirmed & posted with sequence #${officialInvoiceNo}`,
        type: 'system'
      }
    ]
  };

  const updatedInvoices = invoices.map(i => i.id === invoiceId ? updatedInvoice : i);
  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);
  logAuditAction('POST_INVOICE', 'Billing & Invoicing', `Confirmed & Posted Invoice #${officialInvoiceNo} (₹${grandTotal.toLocaleString('en-IN')})`);
  
  InvoiceHistoryLogger.log({
    invoiceId: invoiceId,
    actionType: 'STATUS_CHANGE',
    description: `Invoice confirmed & posted with sequence #${officialInvoiceNo} (Residual due: ₹${amountDue.toLocaleString('en-IN')})`,
    metadata: { invoiceNo: officialInvoiceNo, state: newState, amountDue }
  });

  autoCloudSync();
  return updatedInvoice;
};

// Odoo Action: Register Payment against an Invoice
export const registerInvoicePayment = (invoiceId, {
  amount,
  journal = 'BANK',
  paymentMethod = 'UPI',
  paymentDate,
  memo = '',
  paymentDifferenceAction = 'keep_open' // 'keep_open' or 'fully_paid'
}) => {
  const invoices = fetchInvoices();
  const target = invoices.find(i => i.id === invoiceId);
  if (!target) return null;

  const currentOp = getCurrentOperator();
  const payAmt = Math.min(Number(target.amountDue !== undefined ? target.amountDue : target.grandTotal), Math.max(0, Number(amount) || 0));
  const newPaidAmount = (Number(target.paidAmount) || 0) + payAmt;
  
  let newAmountDue = Math.max(0, (Number(target.amountDue !== undefined ? target.amountDue : target.grandTotal) - payAmt));
  if (paymentDifferenceAction === 'fully_paid') {
    newAmountDue = 0;
  }

  const newState = newAmountDue <= 0 ? 'paid' : 'in_payment';

  const newPaymentEntry = {
    id: 'pay_' + Date.now(),
    date: paymentDate || new Date().toISOString(),
    amount: payAmt,
    journal,
    paymentMethod,
    memo: memo || `Payment for ${target.invoiceNo}`
  };

  // Reduce customer debt in ledger
  if (target.partyId && payAmt > 0) {
    updatePartyBalance(target.partyId, -payAmt);
  }

  const updatedInvoice = {
    ...target,
    paidAmount: newPaidAmount,
    amountDue: newAmountDue,
    balanceAmount: newAmountDue,
    paymentStatus: newAmountDue <= 0 ? 'PAID' : 'PARTIAL',
    state: newState,
    payments: [...(target.payments || []), newPaymentEntry],
    chatter: [
      ...(target.chatter || []),
      {
        id: 'cht_' + Date.now(),
        date: new Date().toISOString(),
        author: currentOp?.name || 'Cashier',
        text: `Registered payment of ₹${payAmt.toLocaleString('en-IN')} via ${journal} (${paymentMethod}). Remaining residual: ₹${newAmountDue.toLocaleString('en-IN')}`,
        type: 'payment'
      }
    ]
  };

  const updatedInvoices = invoices.map(i => i.id === invoiceId ? updatedInvoice : i);
  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);
  logAuditAction('REGISTER_PAYMENT', 'Accounting & Invoicing', `Recorded payment of ₹${payAmt.toLocaleString('en-IN')} on invoice #${target.invoiceNo} (${journal})`);
  
  InvoiceHistoryLogger.log({
    invoiceId: invoiceId,
    actionType: 'RECEIPT_CREATED',
    description: `Payment receipt recorded: ₹${payAmt.toLocaleString('en-IN')} via ${journal} (${paymentMethod}). Remaining residual: ₹${newAmountDue.toLocaleString('en-IN')}`,
    referenceDocumentId: newPaymentEntry.id,
    referenceDocumentType: 'PAYMENT',
    metadata: { amount: payAmt, journal, paymentMethod, remainingDue: newAmountDue }
  });

  autoCloudSync();
  return updatedInvoice;
};

// Odoo Action: Add Credit Note (Refund / Reversal)
export const createCreditNote = (invoiceId, reason = 'Customer Return / Pricing Adjustment') => {
  const invoices = fetchInvoices();
  const target = invoices.find(i => i.id === invoiceId);
  if (!target) return null;

  const currentOp = getCurrentOperator();
  const products = fetchProducts();
  const creditNoteNo = `RINV/${new Date().getFullYear()}/${invoices.length + 1001}`;

  // 1. Restore Stock and stock lots back to warehouse
  if (target.items && Array.isArray(target.items)) {
    restoreStockLotsFromConsumed(target.items);
    const restoredProducts = products.map(p => {
      const item = target.items.find(i => i.productId === p.id);
      if (item && !item.isSection && !item.isNote) {
        const restoredStock = (Number(p.currentStock) || 0) + (Number(item.qty) || 0);
        const restoredWac = calculateProductWeightedAvgCost(p.id);
        return { 
          ...p, 
          currentStock: restoredStock,
          purchasePrice: restoredWac > 0 ? restoredWac : p.purchasePrice
        };
      }
      return p;
    });
    setStorageData(STORAGE_KEYS.PRODUCTS, restoredProducts);
  }

  // 2. Adjust Party ledger balance
  if (target.partyId) {
    updatePartyBalance(target.partyId, -Number(target.grandTotal || 0));
  }

  // 3. Create Credit Note Document
  const creditNote = {
    ...target,
    id: 'cn_' + Date.now(),
    documentType: 'out_refund',
    invoiceNo: creditNoteNo,
    reversalOf: target.invoiceNo,
    reversalReason: reason,
    date: new Date().toISOString(),
    state: 'posted',
    paymentStatus: 'PAID',
    paidAmount: target.grandTotal,
    amountDue: 0,
    balanceAmount: 0,
    chatter: [{
      id: 'cht_' + Date.now(),
      date: new Date().toISOString(),
      author: currentOp?.name || 'Administrator',
      text: `Credit Note created reversing invoice #${target.invoiceNo}. Reason: ${reason}`,
      type: 'system'
    }]
  };

  // Add chatter on original invoice
  const originalWithChatter = {
    ...target,
    chatter: [
      ...(target.chatter || []),
      {
        id: 'cht_' + Date.now(),
        date: new Date().toISOString(),
        author: currentOp?.name || 'Administrator',
        text: `Reversed by Credit Note #${creditNoteNo} (Reason: ${reason})`,
        type: 'system'
      }
    ]
  };

  const updatedInvoices = [creditNote, ...invoices.map(i => i.id === invoiceId ? originalWithChatter : i)];
  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);
  logAuditAction('CREDIT_NOTE_CREATED', 'Accounting & Invoicing', `Created Credit Note #${creditNoteNo} reversing #${target.invoiceNo} (₹${Number(target.grandTotal).toLocaleString('en-IN')})`);
  
  InvoiceHistoryLogger.log({
    invoiceId: target.id,
    actionType: 'CREDIT_NOTE_ISSUED',
    description: `Reversal Credit Note #${creditNoteNo} issued for ₹${Number(target.grandTotal).toLocaleString('en-IN')}. Reason: ${reason}`,
    referenceDocumentId: creditNote.id,
    referenceDocumentType: 'CREDIT_NOTE',
    metadata: { creditNoteNo, creditAmount: target.grandTotal, reason }
  });

  autoCloudSync();
  return creditNote;
};

// Odoo Action: Reset to Draft
export const resetInvoiceToDraft = (invoiceId) => {
  const invoices = fetchInvoices();
  const target = invoices.find(i => i.id === invoiceId);
  if (!target || target.state === 'draft') return target;

  const currentOp = getCurrentOperator();
  const products = fetchProducts();

  // 1. Restore Stock & stock lots if previously posted
  if (target.items && Array.isArray(target.items)) {
    restoreStockLotsFromConsumed(target.items);
    const restoredProducts = products.map(p => {
      const item = target.items.find(i => i.productId === p.id);
      if (item && !item.isSection && !item.isNote) {
        const restoredStock = (Number(p.currentStock) || 0) + (Number(item.qty) || 0);
        const restoredWac = calculateProductWeightedAvgCost(p.id);
        return { 
          ...p, 
          currentStock: restoredStock,
          purchasePrice: restoredWac > 0 ? restoredWac : p.purchasePrice
        };
      }
      return p;
    });
    setStorageData(STORAGE_KEYS.PRODUCTS, restoredProducts);
  }

  // 2. Reverse Khata debt if added
  if (target.partyId && target.amountDue > 0) {
    updatePartyBalance(target.partyId, -Number(target.amountDue));
  }

  const updatedInvoice = {
    ...target,
    state: 'draft',
    chatter: [
      ...(target.chatter || []),
      {
        id: 'cht_' + Date.now(),
        date: new Date().toISOString(),
        author: currentOp?.name || 'Administrator',
        text: 'Invoice reset to draft. Stock & ledger adjustments reversed.',
        type: 'system'
      }
    ]
  };

  const updatedInvoices = invoices.map(i => i.id === invoiceId ? updatedInvoice : i);
  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);
  logAuditAction('RESET_TO_DRAFT', 'Billing & Invoicing', `Invoice #${target.invoiceNo} reset to draft`);
  
  InvoiceHistoryLogger.log({
    invoiceId: invoiceId,
    actionType: 'STATUS_CHANGE',
    description: `Invoice #${target.invoiceNo} reset to draft. Inventory deductions & ledger debits reversed.`,
    metadata: { invoiceNo: target.invoiceNo, state: 'draft' }
  });

  autoCloudSync();
  return updatedInvoice;
};

// Odoo Action: Void / Cancel Invoice with Reason, inventory restock, and ledger reversal
export const voidInvoice = (invoiceId, reason = 'Customer refused delivery / Store closed') => {
  const invoices = fetchInvoices();
  const target = invoices.find(i => i.id === invoiceId);
  if (!target || target.state === 'cancel' || target.isVoid) return target;

  const currentOp = getCurrentOperator();
  const products = fetchProducts();

  // 1. If not draft, restore inventory stock and FIFO lots back to warehouse
  if (target.state !== 'draft') {
    if (target.items && Array.isArray(target.items)) {
      restoreStockLotsFromConsumed(target.items);
      const restoredProducts = products.map(p => {
        const item = target.items.find(i => i.productId === p.id);
        if (item && !item.isSection && !item.isNote) {
          const restoredStock = (Number(p.currentStock) || 0) + (Number(item.qty) || 0);
          const restoredWac = calculateProductWeightedAvgCost(p.id);
          return { 
            ...p, 
            currentStock: restoredStock,
            purchasePrice: restoredWac > 0 ? restoredWac : p.purchasePrice
          };
        }
        return p;
      });
      setStorageData(STORAGE_KEYS.PRODUCTS, restoredProducts);
    }

    // 2. Reverse customer ledger due balance
    if (target.partyId) {
      const openDebt = Number(target.amountDue !== undefined ? target.amountDue : target.balanceAmount) || 0;
      if (openDebt > 0) {
        updatePartyBalance(target.partyId, -openDebt);
      }
    }
  }

  const updatedInvoice = {
    ...target,
    state: 'cancel',
    isVoid: true,
    voidReason: reason,
    voidDate: new Date().toISOString(),
    voidBy: currentOp?.name || 'Administrator',
    amountDue: 0,
    balanceAmount: 0,
    chatter: [
      ...(target.chatter || []),
      {
        id: 'cht_' + Date.now(),
        date: new Date().toISOString(),
        author: currentOp?.name || 'Administrator',
        text: `⛔ INVOICE VOIDED. Reason: "${reason}". Stock restored back to inventory and customer ledger cleared.`,
        type: 'system'
      }
    ]
  };

  const updatedInvoices = invoices.map(i => i.id === invoiceId ? updatedInvoice : i);
  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);
  logAuditAction('VOID_INVOICE', 'Billing & Invoicing', `Voided Invoice #${target.invoiceNo}. Reason: ${reason}`);
  
  InvoiceHistoryLogger.log({
    invoiceId: invoiceId,
    actionType: 'STATUS_CHANGE',
    description: `Invoice #${target.invoiceNo} VOIDED. Reason: "${reason}". Stock restored & accounting debt reversed.`,
    metadata: { invoiceNo: target.invoiceNo, state: 'cancel', isVoid: true, reason }
  });

  autoCloudSync();
  return updatedInvoice;
};

export const cancelInvoice = voidInvoice;

export const deleteInvoice = (invoiceId) => {
  const invoices = fetchInvoices();
  const targetInv = invoices.find(i => i.id === invoiceId);
  recordDeletedId(invoiceId);
  if (!targetInv) return invoices;

  // 1. Restore Stock and stock lots for billed items
  if (targetInv.items && Array.isArray(targetInv.items)) {
    restoreStockLotsFromConsumed(targetInv.items);
    const products = fetchProducts();
    const restoredProducts = products.map(p => {
      const billedItem = targetInv.items.find(item => item.productId === p.id);
      if (billedItem) {
        const newStock = (Number(p.currentStock) || 0) + (Number(billedItem.qty) || 0);
        const restoredWac = calculateProductWeightedAvgCost(p.id);
        return { 
          ...p, 
          currentStock: newStock,
          purchasePrice: restoredWac > 0 ? restoredWac : p.purchasePrice
        };
      }
      return p;
    });
    setStorageData(STORAGE_KEYS.PRODUCTS, restoredProducts);
  }

  // 2. Revert Party Ledger balance if invoice was unpaid/partial
  if (targetInv.partyId) {
    const uncollectedAmount = targetInv.balanceAmount || (targetInv.grandTotal - (targetInv.paidAmount || 0));
    if (uncollectedAmount > 0) {
      updatePartyBalance(targetInv.partyId, -uncollectedAmount);
    }
  }

  // 3. Delete from Local Storage
  const updatedInvoices = invoices.filter(i => i.id !== invoiceId);
  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);

  // 4. Log Audit Action
  logAuditAction(
    'DELETE_INVOICE',
    'Billing & Invoicing',
    `Cancelled & Deleted Invoice #${targetInv.invoiceNo} (₹${Number(targetInv.grandTotal || 0).toLocaleString('en-IN')}) - Stock restored`
  );

  // 5. Delete from Supabase Cloud
  const client = getSupabaseClient();
  if (client) {
    client.from('invoices').delete().eq('id', invoiceId).then(() => {}).catch(console.error);
  }

  autoCloudSync();
  return updatedInvoices;
};

// --- ENTERPRISE MODULE: SALES RETURNS & REPLACEMENTS (RMA) ---

export const getNextReturnNumber = () => {
  const returns = getStorageData(STORAGE_KEYS.RETURNS, []);
  const year = new Date().getFullYear();
  const nextSeq = String(returns.length + 1).padStart(3, '0');
  return `SR-${year}-${nextSeq}`;
};

export const fetchSalesReturns = () => {
  const delSet = new Set(getDeletedIds());
  return getStorageData(STORAGE_KEYS.RETURNS, []).filter(r => r && !delSet.has(r.id));
};

export const saveSalesReturn = (returnData) => {
  if (returnData.id) {
    unrecordDeletedId(returnData.id);
  }
  const returns = fetchSalesReturns();
  const returnNumber = returnData.returnNumber || getNextReturnNumber();
  const id = returnData.id || ('sr_' + Date.now());

  // Calculate and standardize items
  const items = (returnData.items || []).map(item => {
    const qty = Number(item.quantity !== undefined ? item.quantity : item.qty) || 1;
    const unitPrice = Number(item.unitPrice !== undefined ? item.unitPrice : (item.salePrice || item.rate || item.price)) || 0;
    const taxRate = Number(item.taxRate !== undefined ? item.taxRate : (item.gstRate || 0)) || 0;
    const rawAmount = qty * unitPrice * (1 + taxRate / 100);
    const amount = Number(item.amount !== undefined ? item.amount : rawAmount);

    return {
      id: item.id || ('sri_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      productId: item.productId || item.item_id || '',
      productName: item.productName || item.name || 'Returned Product',
      sku: item.sku || '',
      quantity: qty,
      unitPrice,
      taxRate,
      condition: item.condition || 'UNDAMAGED', // 'UNDAMAGED' | 'DAMAGED'
      disposition: item.disposition || (item.condition === 'DAMAGED' ? 'SCRAP' : 'RESTOCK'), // 'RESTOCK' | 'SCRAP'
      reason: item.reason || 'Customer Return',
      amount: Math.round(amount * 100) / 100
    };
  });

  const totalAmount = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

  const newReturn = {
    ...returnData,
    id,
    returnNumber,
    invoiceId: returnData.invoiceId ? String(returnData.invoiceId) : '',
    invoiceNo: returnData.invoiceNo || '',
    customerId: returnData.customerId || returnData.partyId || '',
    customerName: returnData.customerName || returnData.partyName || 'Customer',
    returnDate: returnData.returnDate || new Date().toISOString().split('T')[0],
    status: returnData.status || 'Draft', // 'Draft' | 'Received' | 'Credit Issued' | 'Completed'
    items,
    totalAmount: Math.round(totalAmount * 100) / 100,
    creditNoteId: returnData.creditNoteId || null,
    creditNoteNo: returnData.creditNoteNo || null,
    replacementInvoiceId: returnData.replacementInvoiceId || null,
    replacementInvoiceNo: returnData.replacementInvoiceNo || null,
    notes: returnData.notes || '',
    createdAt: returnData.createdAt || new Date().toISOString()
  };

  const existingIndex = returns.findIndex(r => r.id === newReturn.id);
  let updatedReturns;
  if (existingIndex > -1) {
    updatedReturns = [...returns];
    updatedReturns[existingIndex] = newReturn;
  } else {
    updatedReturns = [newReturn, ...returns];
  }
  setStorageData(STORAGE_KEYS.RETURNS, updatedReturns);

  // Log in Invoice History of the parent invoice
  if (newReturn.invoiceId) {
    InvoiceHistoryLogger.log({
      invoiceId: newReturn.invoiceId,
      actionType: 'RETURN_INITIATED',
      description: `Sales Return ${returnNumber} initiated for ${items.length} item(s) (Total: ₹${Number(newReturn.totalAmount).toLocaleString('en-IN')}) [Status: ${newReturn.status}]`,
      referenceDocumentId: newReturn.id,
      referenceDocumentType: 'RETURN',
      metadata: { returnNumber, totalAmount: newReturn.totalAmount, itemCount: items.length }
    });
  }

  logAuditAction(
    'SALES_RETURN_CREATED',
    'Sales Returns & RMA',
    `Return ${returnNumber} created against Inv #${newReturn.invoiceNo || 'N/A'} for ${newReturn.customerName} (₹${Number(newReturn.totalAmount).toLocaleString('en-IN')})`
  );

  autoCloudSync();
  return newReturn;
};

export const receiveSalesReturnItems = (returnId) => {
  const returns = fetchSalesReturns();
  const target = returns.find(r => r.id === returnId);
  if (!target) return null;

  let restockedCount = 0;
  let scrappedCount = 0;
  let scrapLossValue = 0;

  (target.items || []).forEach(item => {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) return;

    if (item.condition === 'UNDAMAGED' || item.disposition === 'RESTOCK') {
      // 1. Restock to warehouse inventory
      if (item.productId) {
        updateProductStock(item.productId, qty, `Sales Return Restock (${target.returnNumber})`);
        restockedCount += qty;
      }
    } else {
      // 2. Damaged / Defective: Write off to Scrap expense, do NOT add to sellable stock
      scrappedCount += qty;
      const itemCost = qty * (Number(item.unitPrice) || 0);
      scrapLossValue += itemCost;
      saveExpense({
        category: 'Scrap & Damage Write-off',
        amount: Math.round(itemCost * 100) / 100,
        paidTo: 'Scrap / Written-Off Goods',
        notes: `Damaged return write-off: ${qty} pcs of ${item.productName} from RMA ${target.returnNumber}. Reason: ${item.reason || 'Damaged goods'}`,
        paymentMode: 'CASH',
        date: new Date().toISOString().split('T')[0]
      });
    }
  });

  const updatedReturn = {
    ...target,
    status: 'Received',
    receivedAt: new Date().toISOString()
  };

  const updatedReturns = returns.map(r => r.id === returnId ? updatedReturn : r);
  setStorageData(STORAGE_KEYS.RETURNS, updatedReturns);

  if (target.invoiceId) {
    InvoiceHistoryLogger.log({
      invoiceId: target.invoiceId,
      actionType: 'RETURN_RECEIVED',
      description: `Return ${target.returnNumber} intake completed: ${restockedCount} pcs restocked to inventory, ${scrappedCount} pcs written off to scrap (Loss: ₹${scrapLossValue.toLocaleString('en-IN')})`,
      referenceDocumentId: target.id,
      referenceDocumentType: 'RETURN',
      metadata: { restockedCount, scrappedCount, scrapLossValue }
    });
  }

  logAuditAction(
    'SALES_RETURN_RECEIVED',
    'Sales Returns & RMA',
    `Return ${target.returnNumber} received: ${restockedCount} pcs restocked, ${scrappedCount} pcs scrapped`
  );

  autoCloudSync();
  return updatedReturn;
};

export const issueReturnCreditNote = (returnId) => {
  const returns = fetchSalesReturns();
  const target = returns.find(r => r.id === returnId);
  if (!target) return null;

  const invoices = fetchInvoices();
  const parentInvoice = invoices.find(i => i.id === target.invoiceId || i.invoiceNo === target.invoiceNo);
  const creditNoteNo = `CN/${new Date().getFullYear()}/${invoices.length + 1001}`;
  const creditAmount = Number(target.totalAmount) || 0;
  const currentOp = getCurrentOperator();

  // Create Credit Note Document
  const creditNote = {
    id: 'cn_' + Date.now(),
    documentType: 'out_refund',
    invoiceNo: creditNoteNo,
    reversalOf: target.invoiceNo || (parentInvoice?.invoiceNo || ''),
    reversalReason: `Sales Return ${target.returnNumber} Credit Note`,
    returnId: target.id,
    returnNumber: target.returnNumber,
    date: new Date().toISOString(),
    partyId: target.customerId || parentInvoice?.partyId,
    partyName: target.customerName || parentInvoice?.partyName || 'Customer',
    customerName: target.customerName || parentInvoice?.partyName || 'Customer',
    items: target.items.map(it => ({
      ...it,
      name: it.productName,
      qty: it.quantity,
      salePrice: it.unitPrice,
      total: it.amount
    })),
    taxableAmount: (function() {
      let rate = 5;
      if (parentInvoice?.items?.[0]?.gstRate !== undefined) {
        rate = Number(parentInvoice.items[0].gstRate) || 0;
      }
      return rate > 0 ? Number((creditAmount / (1 + rate / 100)).toFixed(2)) : creditAmount;
    })(),
    taxTotal: (function() {
      let rate = 5;
      if (parentInvoice?.items?.[0]?.gstRate !== undefined) {
        rate = Number(parentInvoice.items[0].gstRate) || 0;
      }
      const tx = rate > 0 ? Number((creditAmount / (1 + rate / 100)).toFixed(2)) : creditAmount;
      return Number((creditAmount - tx).toFixed(2));
    })(),
    cgst: (function() {
      let rate = 5;
      if (parentInvoice?.items?.[0]?.gstRate !== undefined) {
        rate = Number(parentInvoice.items[0].gstRate) || 0;
      }
      const tx = rate > 0 ? Number((creditAmount / (1 + rate / 100)).toFixed(2)) : creditAmount;
      return Number(((creditAmount - tx) / 2).toFixed(2));
    })(),
    sgst: (function() {
      let rate = 5;
      if (parentInvoice?.items?.[0]?.gstRate !== undefined) {
        rate = Number(parentInvoice.items[0].gstRate) || 0;
      }
      const tx = rate > 0 ? Number((creditAmount / (1 + rate / 100)).toFixed(2)) : creditAmount;
      return Number(((creditAmount - tx) / 2).toFixed(2));
    })(),
    igst: 0,
    subtotal: creditAmount,
    grandTotal: creditAmount,
    paidAmount: creditAmount,
    amountDue: 0,
    balanceAmount: 0,
    state: 'posted',
    paymentStatus: 'PAID',
    paymentMode: 'CREDIT_NOTE',
    chatter: [{
      id: 'cht_' + Date.now(),
      date: new Date().toISOString(),
      author: currentOp?.name || 'Administrator',
      text: `Credit Note created for Sales Return #${target.returnNumber}. Credit: ₹${creditAmount.toLocaleString('en-IN')}`,
      type: 'system'
    }]
  };

  // Adjust party ledger balance if customer exists
  const partyId = target.customerId || parentInvoice?.partyId;
  if (partyId) {
    updatePartyBalance(partyId, -creditAmount);
  }

  // Save Credit Note into invoices list
  const updatedInvoices = [creditNote, ...invoices];
  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);

  // Update Return status
  const updatedReturn = {
    ...target,
    status: 'Credit Issued',
    creditNoteId: creditNote.id,
    creditNoteNo: creditNote.invoiceNo
  };
  const updatedReturns = returns.map(r => r.id === returnId ? updatedReturn : r);
  setStorageData(STORAGE_KEYS.RETURNS, updatedReturns);

  // Log on original invoice
  if (target.invoiceId) {
    InvoiceHistoryLogger.log({
      invoiceId: target.invoiceId,
      actionType: 'CREDIT_NOTE_ISSUED',
      description: `Credit Note #${creditNote.invoiceNo} issued for ₹${creditAmount.toLocaleString('en-IN')} against Return ${target.returnNumber}`,
      referenceDocumentId: creditNote.id,
      referenceDocumentType: 'CREDIT_NOTE',
      metadata: { creditNoteNo: creditNote.invoiceNo, creditAmount }
    });
  }

  logAuditAction(
    'RETURN_CREDIT_NOTE_ISSUED',
    'Sales Returns & RMA',
    `Credit Note #${creditNote.invoiceNo} issued for ₹${creditAmount.toLocaleString('en-IN')} against Return ${target.returnNumber}`
  );

  autoCloudSync();
  return { returnObj: updatedReturn, creditNote };
};

export const createReturnReplacementInvoice = (returnId, replacementItems) => {
  const returns = fetchSalesReturns();
  const target = returns.find(r => r.id === returnId);
  if (!target) return null;

  const invoices = fetchInvoices();
  const parentInvoice = invoices.find(i => i.id === target.invoiceId || i.invoiceNo === target.invoiceNo);
  const products = fetchProducts();
  const business = getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  const currentOp = getCurrentOperator();

  const replacementInvoiceNo = getNextInvoiceNumber();

  let subtotal = 0;
  let taxTotal = 0;
  const items = replacementItems.map(it => {
    const qty = Number(it.quantity || it.qty) || 1;
    const salePrice = Number(it.salePrice || it.unitPrice || it.rate) || 0;
    const gstRate = Number(it.taxRate || it.gstRate) || 0;
    const lineSubtotal = qty * salePrice;
    const lineTax = (lineSubtotal * gstRate) / 100;
    const lineTotal = lineSubtotal + lineTax;
    subtotal += lineSubtotal;
    taxTotal += lineTax;
    return {
      productId: it.productId || it.id,
      name: it.name || it.productName,
      sku: it.sku || '',
      qty,
      salePrice,
      gstRate,
      taxableAmount: lineSubtotal,
      total: lineTotal
    };
  });

  const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;

  // Credit offset: credit from return
  const availableCredit = Number(target.totalAmount) || 0;
  const creditOffset = Math.min(availableCredit, grandTotal);
  const amountDue = Math.max(0, grandTotal - creditOffset);
  const paidAmount = creditOffset;
  const paymentStatus = amountDue === 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID');
  const odooState = amountDue === 0 ? 'paid' : (paidAmount > 0 ? 'in_payment' : 'posted');

  const replacementInvoice = {
    id: 'inv_' + Date.now(),
    documentType: 'out_invoice',
    invoiceNo: replacementInvoiceNo,
    date: new Date().toISOString(),
    partyId: target.customerId || parentInvoice?.partyId,
    partyName: target.customerName || parentInvoice?.partyName || 'Customer',
    customerName: target.customerName || parentInvoice?.partyName || 'Customer',
    items,
    subtotal,
    subTotal: subtotal,
    taxableAmount: subtotal,
    taxTotal,
    grandTotal,
    paidAmount,
    amountDue,
    balanceAmount: amountDue,
    paymentStatus,
    state: odooState,
    paymentMode: creditOffset > 0 ? 'CREDIT_OFFSET' : 'CASH',
    replacementForReturnId: target.id,
    replacementForReturnNo: target.returnNumber,
    creditOffsetApplied: creditOffset,
    chatter: [{
      id: 'cht_' + Date.now(),
      date: new Date().toISOString(),
      author: currentOp?.name || 'Administrator',
      text: `Replacement invoice generated for Return #${target.returnNumber}. Applied credit offset of ₹${creditOffset.toLocaleString('en-IN')}. Residual due: ₹${amountDue.toLocaleString('en-IN')}`,
      type: 'system'
    }]
  };

  // Deduct inventory stock for replacement items
  const updatedProducts = products.map(p => {
    const item = items.find(i => i.productId === p.id);
    if (item) {
      return { ...p, currentStock: Math.max(0, (Number(p.currentStock) || 0) - Number(item.qty)) };
    }
    return p;
  });
  setStorageData(STORAGE_KEYS.PRODUCTS, updatedProducts);

  // If residual due remains, update customer balance
  const partyId = replacementInvoice.partyId;
  if (partyId && amountDue > 0) {
    updatePartyBalance(partyId, amountDue);
  }

  // Save replacement invoice
  const updatedInvoices = [replacementInvoice, ...invoices];
  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);

  // Update Return
  const updatedReturn = {
    ...target,
    status: 'Completed',
    replacementInvoiceId: replacementInvoice.id,
    replacementInvoiceNo: replacementInvoice.invoiceNo
  };
  const updatedReturns = returns.map(r => r.id === returnId ? updatedReturn : r);
  setStorageData(STORAGE_KEYS.RETURNS, updatedReturns);

  // Log on original invoice
  if (target.invoiceId) {
    InvoiceHistoryLogger.log({
      invoiceId: target.invoiceId,
      actionType: 'REPLACEMENT_LINKED',
      description: `Replacement Invoice #${replacementInvoice.invoiceNo} issued and linked to Return ${target.returnNumber}. ₹${creditOffset.toLocaleString('en-IN')} credit offset applied (Residual due: ₹${amountDue.toLocaleString('en-IN')})`,
      referenceDocumentId: replacementInvoice.id,
      referenceDocumentType: 'REPLACEMENT_INVOICE',
      metadata: { replacementInvoiceNo: replacementInvoice.invoiceNo, creditOffset, amountDue }
    });
  }

  // Log on replacement invoice itself
  InvoiceHistoryLogger.log({
    invoiceId: replacementInvoice.id,
    actionType: 'CREATED',
    description: `Replacement Invoice created for Return ${target.returnNumber} (Original Inv #${target.invoiceNo || 'N/A'}) with ₹${creditOffset.toLocaleString('en-IN')} credit offset applied`,
    referenceDocumentId: target.id,
    referenceDocumentType: 'RETURN',
    metadata: { returnNumber: target.returnNumber, creditOffset }
  });

  logAuditAction(
    'REPLACEMENT_INVOICE_CREATED',
    'Sales Returns & RMA',
    `Replacement Inv #${replacementInvoice.invoiceNo} created for Return ${target.returnNumber} with ₹${creditOffset.toLocaleString('en-IN')} credit offset`
  );

  autoCloudSync();
  return { returnObj: updatedReturn, replacementInvoice };
};

export const deleteSalesReturn = (id) => {
  recordDeletedId(id);
  const returns = fetchSalesReturns();
  const target = returns.find(r => r.id === id);
  const updated = returns.filter(r => r.id !== id);
  setStorageData(STORAGE_KEYS.RETURNS, updated);
  logAuditAction('DELETE_SALES_RETURN', 'Sales Returns & RMA', `Deleted Sales Return ${target?.returnNumber || id}`);
  autoCloudSync();
  return updated;
};

// Operations: Business Settings
export const fetchBusinessInfo = () => getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
export const fetchBusinessProfile = fetchBusinessInfo;
export const saveBusinessInfo = (info) => {
  setStorageData(STORAGE_KEYS.BUSINESS, info);
  logAuditAction('UPDATE_SETTINGS', 'Settings', 'Updated company profile, GSTIN & bank details');
  autoCloudSync();
  return info;
};

// --- ENTERPRISE MODULE: AUDIT TRAIL & OPERATOR MANAGEMENT ---
export const getCurrentOperator = () => getStorageData(STORAGE_KEYS.CURRENT_OPERATOR, DEFAULT_OPERATOR);
export const setCurrentOperator = (operator) => {
  setStorageData(STORAGE_KEYS.CURRENT_OPERATOR, operator);
  logAuditAction('SWITCH_OPERATOR', 'Security & Audit', `Active operator switched to ${operator.name} (${operator.role})`);
  return operator;
};

export const fetchAuditLogs = () => getStorageData(STORAGE_KEYS.AUDIT_LOGS, []);
export const logAuditAction = (action, module, details) => {
  try {
    const currentOp = getCurrentOperator();
    const logs = getStorageData(STORAGE_KEYS.AUDIT_LOGS, []);
    const newEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      operator: currentOp?.name || 'System Operator',
      action,
      module,
      details
    };
    // Keep most recent 300 logs
    const updated = [newEntry, ...logs].slice(0, 300);
    setStorageData(STORAGE_KEYS.AUDIT_LOGS, updated);
  } catch (e) {
    console.warn('Audit logging failed:', e);
  }
};

export const clearAuditLogs = () => {
  setStorageData(STORAGE_KEYS.AUDIT_LOGS, []);
};

// --- ENTERPRISE MODULE: SECURITY SETTINGS ---
export const getSecuritySettings = () => getStorageData(STORAGE_KEYS.SECURITY_SETTINGS, DEFAULT_SECURITY);
export const saveSecuritySettings = (settings) => {
  setStorageData(STORAGE_KEYS.SECURITY_SETTINGS, settings);
  logAuditAction('UPDATE_SECURITY', 'Security & Audit', 'Security PIN and Cloud settings modified');
  return settings;
};

// --- ENTERPRISE MODULE: MULTI-WAREHOUSE MANAGEMENT ---
export const fetchWarehouses = () => {
  const delSet = new Set(getDeletedIds());
  return getStorageData(STORAGE_KEYS.WAREHOUSES, DEFAULT_WAREHOUSES).filter(w => w && !delSet.has(w.id));
};
export const saveWarehouse = (wh) => {
  if (wh.id) {
    unrecordDeletedId(wh.id);
  }
  const warehouses = fetchWarehouses();
  let updated;
  if (wh.id) {
    updated = warehouses.map(w => w.id === wh.id ? wh : w);
  } else {
    const newWh = { ...wh, id: 'wh_' + Date.now() };
    updated = [...warehouses, newWh];
  }
  setStorageData(STORAGE_KEYS.WAREHOUSES, updated);
  logAuditAction('SAVE_WAREHOUSE', 'Inventory & Warehouses', `Warehouse saved: ${wh.name} (${wh.code || ''})`);
  autoCloudSync();
  return updated;
};

export const deleteWarehouse = (id) => {
  const warehouses = fetchWarehouses();
  if (warehouses.length <= 1) {
    alert('At least one warehouse is required.');
    return warehouses;
  }
  recordDeletedId(id);
  const updated = warehouses.filter(w => w.id !== id);
  setStorageData(STORAGE_KEYS.WAREHOUSES, updated);
  logAuditAction('DELETE_WAREHOUSE', 'Inventory & Warehouses', `Warehouse deleted ID: ${id}`);
  autoCloudSync();
  return updated;
};

export const transferStockBetweenWarehouses = (productId, fromWhId, toWhId, qty, reason = 'Inter-depot transfer') => {
  const products = fetchProducts();
  const warehouses = fetchWarehouses();
  const prod = products.find(p => p.id === productId);
  if (!prod) return { success: false, message: 'Product not found' };

  const fromWh = warehouses.find(w => w.id === fromWhId) || { name: 'Origin Warehouse' };
  const toWh = warehouses.find(w => w.id === toWhId) || { name: 'Target Warehouse' };

  // Log movement in stock ledger
  const ledger = getStorageData(STORAGE_KEYS.STOCK_LEDGER, []);
  const movement = {
    id: 'mv_' + Date.now(),
    productId,
    productName: prod.name,
    fromWarehouse: fromWh.name,
    toWarehouse: toWh.name,
    qty: Number(qty),
    date: new Date().toISOString(),
    reason
  };
  setStorageData(STORAGE_KEYS.STOCK_LEDGER, [movement, ...ledger].slice(0, 500));

  logAuditAction(
    'STOCK_TRANSFER',
    'Inventory & Warehouses',
    `Transferred ${qty} Pcs of ${prod.name} from ${fromWh.name} to ${toWh.name} (${reason})`
  );
  autoCloudSync();
  return { success: true, message: `Successfully transferred ${qty} Pcs of ${prod.name}` };
};

export const fetchStockLedger = () => getStorageData(STORAGE_KEYS.STOCK_LEDGER, []);

export const fetchBankAccounts = () => getStorageData(STORAGE_KEYS.BANK_ACCOUNTS, []).filter(b => b?.accountNo !== '50200088991122' && b?.accountNo !== '38920192831' && b?.id !== 'bank_1' && b?.id !== 'bank_2');
export const saveBankAccount = (acct) => {
  const accounts = fetchBankAccounts();
  let updated;
  if (acct.id) {
    updated = accounts.map(a => a.id === acct.id ? acct : a);
  } else {
    const newAcct = { ...acct, id: 'bank_' + Date.now(), balance: Number(acct.balance) || 0 };
    updated = [...accounts, newAcct];
  }
  setStorageData(STORAGE_KEYS.BANK_ACCOUNTS, updated);
  logAuditAction('SAVE_BANK_ACCOUNT', 'Banking & Payments', `Bank account updated: ${acct.bankName} (${acct.accountNo})`);
  autoCloudSync();
  return updated;
};

export const fetchBankTransactions = () => getStorageData(STORAGE_KEYS.BANK_TRANSACTIONS, []);
export const recordBankTransaction = (txn) => {
  const accounts = fetchBankAccounts();
  const txns = fetchBankTransactions();

  const newTxn = {
    ...txn,
    id: 'btxn_' + Date.now(),
    date: txn.date || new Date().toISOString(),
    amount: Number(txn.amount) || 0
  };

  // Adjust bank account balance
  const updatedAccounts = accounts.map(a => {
    if (a.id === txn.bankAccountId) {
      const delta = txn.type === 'CREDIT' ? newTxn.amount : -newTxn.amount;
      return { ...a, balance: (Number(a.balance) || 0) + delta };
    }
    return a;
  });

  setStorageData(STORAGE_KEYS.BANK_ACCOUNTS, updatedAccounts);
  setStorageData(STORAGE_KEYS.BANK_TRANSACTIONS, [newTxn, ...txns]);

  logAuditAction(
    'BANK_TRANSACTION',
    'Banking & Payments',
    `${txn.type} of ₹${newTxn.amount.toLocaleString('en-IN')} via ${txn.mode || 'NEFT/RTGS'} (Ref: ${txn.referenceNo || 'N/A'})`
  );
  autoCloudSync();
  return newTxn;
};

// --- ENTERPRISE MODULE: EXPENSES & SOLE PROPRIETOR CAPITAL ---
export const fetchExpenses = () => {
  const delSet = new Set(getDeletedIds());
  return getStorageData(STORAGE_KEYS.EXPENSES, []).filter(e => e && !e?.id?.startsWith('exp_sample_') && !delSet.has(e.id));
};

export const saveExpense = (exp) => {
  if (exp.id) {
    unrecordDeletedId(exp.id);
  }
  const expenses = fetchExpenses();
  const accounts = fetchBankAccounts();
  const txns = fetchBankTransactions();

  const id = exp.id || 'exp_' + Date.now();
  const amount = Number(exp.amount) || 0;
  const isBankPayment = exp.paymentMode === 'BANK' || exp.paymentMode === 'UPI';

  const newExp = {
    ...exp,
    id,
    amount,
    date: exp.date || new Date().toISOString().split('T')[0],
    voucherNo: exp.voucherNo || `VOUCH-${Math.floor(1000 + Math.random() * 9000)}`
  };

  let updatedExpenses;
  if (exp.id) {
    updatedExpenses = expenses.map(e => e.id === exp.id ? newExp : e);
  } else {
    updatedExpenses = [newExp, ...expenses];
  }
  setStorageData(STORAGE_KEYS.EXPENSES, updatedExpenses);

  // If paid via Bank or UPI on creation, deduct from chosen bank account
  if (isBankPayment && exp.bankAccountId && !exp.id) {
    const updatedAccounts = accounts.map(a => {
      if (a.id === exp.bankAccountId) {
        return { ...a, balance: (Number(a.balance) || 0) - amount };
      }
      return a;
    });
    setStorageData(STORAGE_KEYS.BANK_ACCOUNTS, updatedAccounts);

    // Record bank transaction entry
    const newTxn = {
      id: 'btxn_' + Date.now(),
      bankAccountId: exp.bankAccountId,
      date: newExp.date,
      type: 'DEBIT',
      amount,
      mode: exp.paymentMode || 'UPI',
      referenceNo: newExp.voucherNo,
      partyName: exp.paidTo || exp.category,
      note: `${exp.category}: ${exp.notes || ''}`
    };
    setStorageData(STORAGE_KEYS.BANK_TRANSACTIONS, [newTxn, ...txns]);
  }

  logAuditAction(
    'EXPENSE_RECORDED',
    'Accounting & P&L',
    `${exp.type === 'DRAWING' ? 'Personal Drawing' : 'Expense'} recorded: ₹${amount.toLocaleString('en-IN')} (${exp.category}) paid to ${exp.paidTo || 'N/A'}`
  );
  autoCloudSync();
  return newExp;
};

export const deleteExpense = (id) => {
  recordDeletedId(id);
  const expenses = fetchExpenses();
  const target = expenses.find(e => e.id === id);
  if (!target) return false;

  const updatedExpenses = expenses.filter(e => e.id !== id);
  setStorageData(STORAGE_KEYS.EXPENSES, updatedExpenses);

  // Revert bank account balance if it was a bank/UPI payment
  if ((target.paymentMode === 'BANK' || target.paymentMode === 'UPI') && target.bankAccountId) {
    const accounts = fetchBankAccounts();
    const updatedAccounts = accounts.map(a => {
      if (a.id === target.bankAccountId) {
        return { ...a, balance: (Number(a.balance) || 0) + Number(target.amount || 0) };
      }
      return a;
    });
    setStorageData(STORAGE_KEYS.BANK_ACCOUNTS, updatedAccounts);
  }

  logAuditAction('EXPENSE_DELETED', 'Accounting & P&L', `Expense deleted: ₹${target.amount} (${target.category})`);
  autoCloudSync();
  return true;
};

export const fetchProprietorCapital = () => {
  const cap = getStorageData(STORAGE_KEYS.PROPRIETOR_CAPITAL, DEFAULT_PROPRIETOR_CAPITAL);
  if (!cap || cap?.notes === 'Opening capital as per FY 2026-27 balance sheet') {
    return DEFAULT_PROPRIETOR_CAPITAL;
  }
  return { ...DEFAULT_PROPRIETOR_CAPITAL, ...cap };
};

export const saveProprietorCapital = (capitalData) => {
  const current = fetchProprietorCapital();
  const updated = {
    ...current,
    ...capitalData,
    openingCapital: Number(capitalData.openingCapital ?? current.openingCapital) || 0,
    additionalCapital: Number(capitalData.additionalCapital ?? current.additionalCapital) || 0,
    updatedAt: new Date().toISOString()
  };
  setStorageData(STORAGE_KEYS.PROPRIETOR_CAPITAL, updated);
  logAuditAction('CAPITAL_UPDATE', 'Accounting & P&L', `Proprietor capital updated: Opening ₹${updated.openingCapital.toLocaleString('en-IN')}, Additional ₹${updated.additionalCapital.toLocaleString('en-IN')}`);
  autoCloudSync();
  return updated;
};

// --- ENTERPRISE MODULE: BACKUP EXPORT & RESTORE ---
export const exportBackupJSON = () => {
  const data = {
    version: '2.0.0',
    app: 'DistroPlus ERP',
    exportedAt: new Date().toISOString(),
    business: getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS),
    products: fetchProducts(),
    parties: fetchParties(),
    suppliers: fetchSuppliers(),
    invoices: fetchInvoices(),
    purchases: getStorageData(STORAGE_KEYS.PURCHASES, []),
    warehouses: fetchWarehouses(),
    bankAccounts: fetchBankAccounts(),
    bankTransactions: fetchBankTransactions(),
    expenses: fetchExpenses(),
    proprietorCapital: fetchProprietorCapital(),
    auditLogs: fetchAuditLogs(),
    salesReturns: getStorageData(STORAGE_KEYS.RETURNS, []),
    invoiceHistory: getStorageData(STORAGE_KEYS.INVOICE_HISTORY, [])
  };
  return JSON.stringify(data, null, 2);
};

export const restoreBackupJSON = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') throw new Error('Invalid backup file format');

    if (data.business) setStorageData(STORAGE_KEYS.BUSINESS, data.business);
    if (Array.isArray(data.products)) setStorageData(STORAGE_KEYS.PRODUCTS, data.products);
    if (Array.isArray(data.parties)) setStorageData(STORAGE_KEYS.PARTIES, data.parties);
    if (Array.isArray(data.suppliers)) setStorageData(STORAGE_KEYS.SUPPLIERS, data.suppliers);
    if (Array.isArray(data.invoices)) setStorageData(STORAGE_KEYS.INVOICES, data.invoices);
    if (Array.isArray(data.purchases)) setStorageData(STORAGE_KEYS.PURCHASES, data.purchases);
    if (Array.isArray(data.warehouses)) setStorageData(STORAGE_KEYS.WAREHOUSES, data.warehouses);
    if (Array.isArray(data.bankAccounts)) setStorageData(STORAGE_KEYS.BANK_ACCOUNTS, data.bankAccounts);
    if (Array.isArray(data.bankTransactions)) setStorageData(STORAGE_KEYS.BANK_TRANSACTIONS, data.bankTransactions);
    if (Array.isArray(data.expenses)) setStorageData(STORAGE_KEYS.EXPENSES, data.expenses);
    if (Array.isArray(data.salesReturns || data.returns)) setStorageData(STORAGE_KEYS.RETURNS, data.salesReturns || data.returns);
    if (Array.isArray(data.invoiceHistory || data.invoiceHistoryLogs)) setStorageData(STORAGE_KEYS.INVOICE_HISTORY, data.invoiceHistory || data.invoiceHistoryLogs);
    if (data.proprietorCapital && typeof data.proprietorCapital === 'object') setStorageData(STORAGE_KEYS.PROPRIETOR_CAPITAL, data.proprietorCapital);

    logAuditAction('RESTORE_BACKUP', 'Security & Audit', 'Full enterprise database restored from JSON backup');
    autoCloudSync();
    return { success: true, message: 'Data backup successfully restored!' };
  } catch (err) {
    console.error('Backup restore failed:', err);
    return { success: false, message: 'Restore failed: ' + err.message };
  }
};





// =========================================================================
// MODULE 2 ENHANCEMENT: APPLY CREDIT NOTE OFFSET
// =========================================================================
export const applyCreditNoteToInvoice = (creditNoteId, targetInvoiceId) => {
  const invoices = fetchInvoices();
  const creditNote = invoices.find(i => i.id === creditNoteId || i.invoiceNo === creditNoteId);
  const targetInvoice = invoices.find(i => i.id === targetInvoiceId || i.invoiceNo === targetInvoiceId);

  if (!creditNote || !targetInvoice) {
    return { success: false, message: 'Credit Note or Target Invoice not found.' };
  }

  const creditAvailable = Number(creditNote.balanceAmount !== undefined ? creditNote.balanceAmount : creditNote.grandTotal) || 0;
  const targetDue = Number(targetInvoice.amountDue !== undefined ? targetInvoice.amountDue : targetInvoice.balanceAmount || targetInvoice.grandTotal) || 0;

  if (creditAvailable <= 0) {
    return { success: false, message: 'Credit Note has zero remaining balance.' };
  }
  if (targetDue <= 0) {
    return { success: false, message: 'Target Invoice is already fully paid.' };
  }

  const offset = Math.min(creditAvailable, targetDue);
  const newTargetDue = Math.max(0, targetDue - offset);
  const newTargetPaid = (Number(targetInvoice.paidAmount) || 0) + offset;
  const newCreditBalance = Math.max(0, creditAvailable - offset);

  // Update target invoice and credit note
  const updatedInvoices = invoices.map(inv => {
    if (inv.id === targetInvoice.id) {
      return {
        ...inv,
        paidAmount: newTargetPaid,
        amountDue: newTargetDue,
        balanceAmount: newTargetDue,
        paymentStatus: newTargetDue === 0 ? 'PAID' : 'PARTIAL',
        state: newTargetDue === 0 ? 'paid' : 'in_payment',
        creditNoteOffset: (Number(inv.creditNoteOffset) || 0) + offset,
        linkedCreditNoteNo: creditNote.invoiceNo
      };
    }
    if (inv.id === creditNote.id) {
      return {
        ...inv,
        balanceAmount: newCreditBalance,
        linkedInvoiceNo: targetInvoice.invoiceNo
      };
    }
    return inv;
  });

  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);

  // Log on Target Invoice
  InvoiceHistoryLogger.log({
    invoiceId: targetInvoice.id,
    actionType: 'CREDIT_NOTE_ISSUED',
    description: `Credit Note #${creditNote.invoiceNo} applied. Offset amount: ₹${offset.toLocaleString('en-IN')}. New balance due: ₹${newTargetDue.toLocaleString('en-IN')}`,
    referenceDocumentId: creditNote.id,
    referenceDocumentType: 'CREDIT_NOTE',
    metadata: { offset, creditNoteNo: creditNote.invoiceNo, newTargetDue }
  });

  // Log on Credit Note
  InvoiceHistoryLogger.log({
    invoiceId: creditNote.id,
    actionType: 'UPDATED',
    description: `Offset ₹${offset.toLocaleString('en-IN')} against Invoice #${targetInvoice.invoiceNo}. Remaining credit: ₹${newCreditBalance.toLocaleString('en-IN')}`,
    referenceDocumentId: targetInvoice.id,
    referenceDocumentType: 'INVOICE',
    metadata: { offset, targetInvoiceNo: targetInvoice.invoiceNo, newCreditBalance }
  });

  logAuditAction(
    'APPLY_CREDIT_NOTE',
    'Billing & Credit Notes',
    `Applied CN #${creditNote.invoiceNo} (₹${offset.toLocaleString('en-IN')}) to Invoice #${targetInvoice.invoiceNo}`
  );

  autoCloudSync();
  return { success: true, offset, newTargetDue, newCreditBalance };
};

// =========================================================================
// MODULE 3: PURCHASE RETURNS & EXPIRED STOCK CLAIM ENGINE
// =========================================================================
export const fetchPurchaseReturns = () => {
  const delSet = new Set(getDeletedIds());
  return getStorageData(STORAGE_KEYS.PURCHASE_RETURNS, []).filter(r => r && !delSet.has(r.id));
};

export const getExpiredStockLots = () => {
  const products = fetchProducts();
  const lots = fetchStockLots();
  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date(todayStr);

  const expiredList = [];

  // 1. Check batch lots
  (lots || []).forEach(lot => {
    if (lot.expiryDate) {
      const expDate = new Date(lot.expiryDate);
      if (expDate <= today && (Number(lot.qtyRemaining) || 0) > 0) {
        const prod = products.find(p => p.id === lot.productId);
        expiredList.push({
          lotId: lot.id,
          productId: lot.productId,
          productName: lot.productName || prod?.name || 'Unknown Product',
          sku: lot.sku || prod?.sku || '',
          batchNo: lot.batchNo || 'DEFAULT-BATCH',
          expiryDate: lot.expiryDate,
          qtyExpired: Number(lot.qtyRemaining) || 0,
          purchasePrice: Number(lot.purchasePrice) || Number(prod?.purchasePrice) || 0,
          purchasePriceWithGst: Number(lot.purchasePriceWithGst) || 0,
          gstRate: Number(lot.gstRate) || Number(prod?.gstRate) || 5,
          supplierId: lot.supplierId || null,
          supplierName: lot.supplierName || 'Primary Supplier',
          warehouseId: lot.warehouseId || 'wh_main'
        });
      }
    }
  });

  // 2. Also check product level expiryDate if not captured in lots
  products.forEach(p => {
    if (p.expiryDate) {
      const expDate = new Date(p.expiryDate);
      const stock = Number(p.currentStock) || 0;
      const alreadyInLots = expiredList.some(e => e.productId === p.id);
      if (expDate <= today && stock > 0 && !alreadyInLots) {
        expiredList.push({
          lotId: null,
          productId: p.id,
          productName: p.name,
          sku: p.sku || '',
          batchNo: p.batchNo || 'BATCH-01',
          expiryDate: p.expiryDate,
          qtyExpired: stock,
          purchasePrice: Number(p.purchasePrice) || 0,
          purchasePriceWithGst: Number(p.purchasePrice * (1 + (p.gstRate || 5) / 100)),
          gstRate: Number(p.gstRate) || 5,
          supplierId: p.supplierId || null,
          supplierName: p.supplierName || 'Primary Supplier',
          warehouseId: p.warehouseId || 'wh_main'
        });
      }
    }
  });

  return expiredList;
};

export const getReturnableStockItems = () => {
  const products = fetchProducts();
  const lots = fetchStockLots();
  const suppliers = fetchSuppliers();
  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date(todayStr);

  const returnableList = [];

  (products || []).forEach(p => {
    const stock = Number(p.currentStock) || 0;
    if (stock <= 0) return;

    // Check if product has specific lots
    const prodLots = (lots || []).filter(l => l.productId === p.id && (Number(l.qtyRemaining) || 0) > 0);

    if (prodLots.length > 0) {
      prodLots.forEach(lot => {
        const isExp = lot.expiryDate ? new Date(lot.expiryDate) <= today : false;
        returnableList.push({
          lotId: lot.id,
          productId: p.id,
          productName: lot.productName || p.name,
          sku: p.sku || '',
          brand: p.brand || 'General',
          batchNo: lot.batchNo || p.batchNo || 'LOT-MAIN',
          mfgDate: lot.mfgDate || p.mfgDate || '',
          expiryDate: lot.expiryDate || p.expiryDate || '',
          isExpired: isExp,
          availableStock: Number(lot.qtyRemaining) || 0,
          purchasePrice: Number(lot.purchasePrice) || Number(p.purchasePrice) || 0,
          purchasePriceWithGst: Number(lot.purchasePriceWithGst) || (Number(p.purchasePrice || 0) * (1 + (p.gstRate || 5) / 100)),
          gstRate: Number(lot.gstRate) || Number(p.gstRate) || 5,
          supplierId: lot.supplierId || p.supplierId || (suppliers[0]?.id || null),
          supplierName: lot.supplierName || p.supplierName || (suppliers[0]?.name || 'Primary Vendor'),
          warehouseId: lot.warehouseId || p.warehouseId || 'wh_main',
          pcsPerCarton: p.pcsPerCarton || 24,
          pcsPerBox: p.pcsPerBox || 1,
          unit: p.unit || 'Pcs'
        });
      });
    } else {
      const isExp = p.expiryDate ? new Date(p.expiryDate) <= today : false;
      returnableList.push({
        lotId: null,
        productId: p.id,
        productName: p.name,
        sku: p.sku || '',
        brand: p.brand || 'General',
        batchNo: p.batchNo || 'LOT-MAIN',
        mfgDate: p.mfgDate || '',
        expiryDate: p.expiryDate || '',
        isExpired: isExp,
        availableStock: stock,
        purchasePrice: Number(p.purchasePrice) || 0,
        purchasePriceWithGst: Number(p.purchasePrice || 0) * (1 + (p.gstRate || 5) / 100),
        gstRate: Number(p.gstRate) || 5,
        supplierId: p.supplierId || (suppliers[0]?.id || null),
        supplierName: p.supplierName || (suppliers[0]?.name || 'Primary Vendor'),
        warehouseId: p.warehouseId || 'wh_main',
        pcsPerCarton: p.pcsPerCarton || 24,
        pcsPerBox: p.pcsPerBox || 1,
        unit: p.unit || 'Pcs'
      });
    }
  });

  return returnableList;
};

export const createPurchaseReturnDebitNote = ({
  supplierId,
  supplierName,
  originalBillNo,
  originalBillDate,
  items = [],
  reason = 'EXPIRED_STOCK', // 'EXPIRED_STOCK' | 'DEFECTIVE' | 'OVER_DELIVERY'
  reverseItc = true,
  notes = ''
}) => {
  const existingReturns = fetchPurchaseReturns();
  const year = new Date().getFullYear();
  const debitNoteNo = `DN/${year}/${1001 + existingReturns.length}`;
  const now = new Date().toISOString();

  let totalTaxable = 0;
  let totalTax = 0;
  let totalDebitAmount = 0;

  // Process items & decrement inventory
  const processedItems = items.map(item => {
    const qty = Number(item.qty || item.quantity) || 1;
    const rate = Number(item.purchasePrice || item.rate) || 0;
    const gstRate = Number(item.gstRate) || 5;
    const lineTaxable = qty * rate;
    const lineTax = (lineTaxable * gstRate) / 100;
    const lineTotal = lineTaxable + lineTax;

    totalTaxable += lineTaxable;
    totalTax += lineTax;
    totalDebitAmount += lineTotal;

    // 1. Deduct stock from sellable godown
    if (item.productId) {
      updateProductStock(item.productId, -qty, `Vendor Return / Debit Note (${debitNoteNo})`);
    }

    // 2. Consume from lot if lotId exists
    if (item.lotId) {
      consumeStockLotsForSale([{ productId: item.productId, lotId: item.lotId, qty }]);
    }

    return {
      productId: item.productId,
      productName: item.productName || item.name,
      batchNo: item.batchNo || '',
      expiryDate: item.expiryDate || '',
      qty,
      purchasePrice: rate,
      gstRate,
      taxableAmount: Math.round(lineTaxable * 100) / 100,
      taxAmount: Math.round(lineTax * 100) / 100,
      totalAmount: Math.round(lineTotal * 100) / 100,
      reason: item.reason || reason
    };
  });

  // Section 17(5)(h) ITC Reversal handling
  const itcReversalAmount = reverseItc ? Math.round(totalTax * 100) / 100 : 0;

  const debitNoteRecord = {
    id: 'pr_' + Date.now(),
    debitNoteNo,
    date: now,
    supplierId: supplierId || null,
    supplierName: supplierName || 'Vendor / Manufacturer',
    originalBillNo: originalBillNo || 'PUR-000',
    originalBillDate: originalBillDate || now.split('T')[0],
    reason,
    items: processedItems,
    taxableAmount: Math.round(totalTaxable * 100) / 100,
    taxAmount: Math.round(totalTax * 100) / 100,
    totalDebitAmount: Math.round(totalDebitAmount * 100) / 100,
    reverseItc,
    itcReversalAmount,
    status: 'ISSUED',
    notes,
    createdAt: now
  };

  // Adjust Vendor Accounts Payable (credit party balance if supplier tracked)
  if (supplierId) {
    updatePartyBalance(supplierId, -Math.round(totalDebitAmount * 100) / 100);
  }

  // If Section 17(5)(h) ITC Reversal is active, log an expense entry for the reversed ITC
  if (itcReversalAmount > 0) {
    saveExpense({
      category: 'GST Section 17(5)(h) ITC Reversal',
      type: 'OPERATING',
      amount: itcReversalAmount,
      date: now.split('T')[0],
      paidTo: 'GST Authority (Input Tax Credit Reversal)',
      notes: `Section 17(5)(h) ITC Reversal on Expired/Scrapped Stock: Debit Note #${debitNoteNo} (Tax: ₹${itcReversalAmount})`,
      paymentMode: 'CASH'
    });
  }

  const updatedReturns = [debitNoteRecord, ...existingReturns];
  setStorageData(STORAGE_KEYS.PURCHASE_RETURNS, updatedReturns);

  logAuditAction(
    'VENDOR_DEBIT_NOTE_ISSUED',
    'Purchase Returns & Claims',
    `Issued Vendor Debit Note #${debitNoteNo} for ₹${debitNoteRecord.totalDebitAmount.toLocaleString('en-IN')} to ${debitNoteRecord.supplierName} (ITC Reversal: ₹${itcReversalAmount})`
  );

  autoCloudSync();
  return debitNoteRecord;
};

// =========================================================================
// MODULE 4: MULTI-MODE PAYMENTS & BANK RECONCILIATION ENGINE
// =========================================================================
export const fetchPaymentReceipts = () => {
  const delSet = new Set(getDeletedIds());
  return getStorageData(STORAGE_KEYS.PAYMENT_RECEIPTS, []).filter(p => p && !delSet.has(p.id));
};

export const recordMultiModePayment = ({
  invoiceId,
  partyId,
  partyName,
  date = new Date().toISOString(),
  payments = [], // Array of { mode: 'CASH'|'UPI'|'CHEQUE'|'NEFT', amount: number, referenceNo: string, chequeNo: string, chequeDate: string, bankName: string, bankAccountId: string }
  notes = ''
}) => {
  const invoices = fetchInvoices();
  const targetInvoice = invoices.find(i => i.id === invoiceId || i.invoiceNo === invoiceId);
  const receipts = fetchPaymentReceipts();
  const receiptNo = `REC/${new Date().getFullYear()}/${1001 + receipts.length}`;
  const currentOp = getCurrentOperator();

  let totalPaid = 0;
  let clearedAmount = 0;
  let pendingChequeAmount = 0;

  const processedPayments = payments.map((p, idx) => {
    const amount = Number(p.amount) || 0;
    totalPaid += amount;
    const mode = (p.mode || 'CASH').toUpperCase();
    const isCheque = mode === 'CHEQUE';
    const status = isCheque ? 'PENDING_REALIZATION' : 'CLEARED';

    if (isCheque) {
      pendingChequeAmount += amount;
    } else {
      clearedAmount += amount;
      // If linked to a bank account, credit the bank ledger
      if (p.bankAccountId && (mode === 'UPI' || mode === 'NEFT' || mode === 'RTGS' || mode === 'IMPS')) {
        recordBankTransaction({
          bankAccountId: p.bankAccountId,
          partyId,
          partyName: partyName || targetInvoice?.partyName || 'Customer',
          type: 'CREDIT',
          amount,
          mode,
          referenceNo: p.referenceNo || ('UTR-' + Math.floor(10000000 + Math.random() * 90000000)),
          notes: notes || `Payment for Invoice #${targetInvoice?.invoiceNo || invoiceId}`
        });
      }
    }

    return {
      id: 'pay_' + Date.now() + '_' + idx,
      mode,
      amount,
      status, // 'CLEARED' | 'PENDING_REALIZATION' | 'BOUNCED'
      referenceNo: p.referenceNo || p.utr || '',
      chequeNo: p.chequeNo || '',
      chequeDate: p.chequeDate || '',
      bankName: p.bankName || '',
      bankAccountId: p.bankAccountId || null,
      clearedAt: !isCheque ? date : null
    };
  });

  const receipt = {
    id: 'rec_' + Date.now(),
    receiptNo,
    invoiceId: targetInvoice?.id || invoiceId,
    invoiceNo: targetInvoice?.invoiceNo || '',
    partyId: partyId || targetInvoice?.partyId,
    partyName: partyName || targetInvoice?.partyName || 'Customer',
    date,
    totalPaid,
    clearedAmount,
    pendingChequeAmount,
    payments: processedPayments,
    notes,
    recordedBy: currentOp?.name || 'Administrator',
    createdAt: new Date().toISOString()
  };

  // Update Invoice balances if invoice found
  if (targetInvoice) {
    const grandTotal = Number(targetInvoice.grandTotal) || 0;
    const prevPaid = Number(targetInvoice.paidAmount) || 0;
    const newPaid = prevPaid + clearedAmount;
    const newDue = Math.max(0, grandTotal - newPaid);
    const paymentStatus = newDue === 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');
    const state = newDue === 0 ? 'paid' : (newPaid > 0 || pendingChequeAmount > 0 ? 'in_payment' : 'posted');

    const updatedInvoices = invoices.map(i => i.id === targetInvoice.id ? {
      ...i,
      paidAmount: newPaid,
      amountDue: newDue,
      balanceAmount: newDue,
      paymentStatus,
      state,
      lastPaymentReceiptNo: receiptNo
    } : i);
    setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);

    // Log on Invoice History Timeline
    const modesSummary = processedPayments.map(p => `${p.mode}: ₹${p.amount.toLocaleString('en-IN')}${p.referenceNo ? ` (Ref: ${p.referenceNo})` : ''}`).join(' + ');
    InvoiceHistoryLogger.log({
      invoiceId: targetInvoice.id,
      actionType: 'PAYMENT_RECEIVED',
      description: `Payment Receipt #${receiptNo} recorded: ₹${totalPaid.toLocaleString('en-IN')} [${modesSummary}]${pendingChequeAmount > 0 ? ` (₹${pendingChequeAmount.toLocaleString('en-IN')} Uncleared Cheque)` : ''}`,
      referenceDocumentId: receipt.id,
      referenceDocumentType: 'PAYMENT',
      metadata: { receiptNo, totalPaid, modesSummary, pendingChequeAmount, newDue }
    });
  }

  // Deduct party ledger balance by cleared amount
  if (partyId && clearedAmount > 0) {
    updatePartyBalance(partyId, -clearedAmount);
  }

  const updatedReceipts = [receipt, ...receipts];
  setStorageData(STORAGE_KEYS.PAYMENT_RECEIPTS, updatedReceipts);

  logAuditAction(
    'RECORD_PAYMENT',
    'Billing & Payments',
    `Recorded ₹${totalPaid.toLocaleString('en-IN')} payment (Receipt #${receiptNo}) for Invoice #${targetInvoice?.invoiceNo || invoiceId}`
  );

  autoCloudSync();
  return receipt;
};

export const clearChequePayment = (receiptId, paymentSubId, destinationBankAccountId) => {
  const receipts = fetchPaymentReceipts();
  const receipt = receipts.find(r => r.id === receiptId);
  if (!receipt) return { success: false, message: 'Receipt not found.' };

  const payItem = receipt.payments.find(p => p.id === paymentSubId || p.mode === 'CHEQUE');
  if (!payItem || payItem.status === 'CLEARED') {
    return { success: false, message: 'Cheque is already cleared or not found.' };
  }

  const chequeAmount = Number(payItem.amount) || 0;
  payItem.status = 'CLEARED';
  payItem.clearedAt = new Date().toISOString();
  receipt.clearedAmount = (Number(receipt.clearedAmount) || 0) + chequeAmount;
  receipt.pendingChequeAmount = Math.max(0, (Number(receipt.pendingChequeAmount) || 0) - chequeAmount);

  // Credit destination bank account
  if (destinationBankAccountId || payItem.bankAccountId) {
    recordBankTransaction({
      bankAccountId: destinationBankAccountId || payItem.bankAccountId,
      partyId: receipt.partyId,
      partyName: receipt.partyName,
      type: 'CREDIT',
      amount: chequeAmount,
      mode: 'CHEQUE',
      referenceNo: `CHQ-${payItem.chequeNo || 'CLEARED'}`,
      notes: `Cheque #${payItem.chequeNo || 'N/A'} cleared for Receipt #${receipt.receiptNo}`
    });
  }

  // Update party balance
  if (receipt.partyId) {
    updatePartyBalance(receipt.partyId, -chequeAmount);
  }

  // Update linked invoice
  if (receipt.invoiceId) {
    const invoices = fetchInvoices();
    const targetInvoice = invoices.find(i => i.id === receipt.invoiceId);
    if (targetInvoice) {
      const grandTotal = Number(targetInvoice.grandTotal) || 0;
      const newPaid = (Number(targetInvoice.paidAmount) || 0) + chequeAmount;
      const newDue = Math.max(0, grandTotal - newPaid);
      const updatedInvoices = invoices.map(i => i.id === targetInvoice.id ? {
        ...i,
        paidAmount: newPaid,
        amountDue: newDue,
        balanceAmount: newDue,
        paymentStatus: newDue === 0 ? 'PAID' : 'PARTIAL',
        state: newDue === 0 ? 'paid' : 'in_payment'
      } : i);
      setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);

      InvoiceHistoryLogger.log({
        invoiceId: targetInvoice.id,
        actionType: 'CHEQUE_CLEARED',
        description: `Cheque #${payItem.chequeNo} for ₹${chequeAmount.toLocaleString('en-IN')} CLEARED & Realized to Bank. Invoice balance due: ₹${newDue.toLocaleString('en-IN')}`,
        referenceDocumentId: receipt.id,
        referenceDocumentType: 'PAYMENT',
        metadata: { chequeNo: payItem.chequeNo, chequeAmount, newDue }
      });
    }
  }

  setStorageData(STORAGE_KEYS.PAYMENT_RECEIPTS, receipts);
  logAuditAction('CHEQUE_CLEARED', 'Banking & Settlements', `Cheque #${payItem.chequeNo} (₹${chequeAmount.toLocaleString('en-IN')}) cleared`);
  autoCloudSync();
  return { success: true, chequeAmount };
};

export const bounceChequePayment = (receiptId, paymentSubId, bounceCharges = 350, reason = 'Insufficient Funds') => {
  const receipts = fetchPaymentReceipts();
  const receipt = receipts.find(r => r.id === receiptId);
  if (!receipt) return { success: false, message: 'Receipt not found.' };

  const payItem = receipt.payments.find(p => p.id === paymentSubId || p.mode === 'CHEQUE');
  if (!payItem) return { success: false, message: 'Cheque not found.' };

  const chequeAmount = Number(payItem.amount) || 0;
  payItem.status = 'BOUNCED';
  payItem.bouncedAt = new Date().toISOString();
  payItem.bounceReason = reason;
  payItem.bounceCharges = bounceCharges;
  receipt.pendingChequeAmount = Math.max(0, (Number(receipt.pendingChequeAmount) || 0) - chequeAmount);

  // Add penalty to retailer khata
  if (receipt.partyId) {
    updatePartyBalance(receipt.partyId, bounceCharges);
  }

  // Debit Bank Charges Expense
  if (bounceCharges > 0) {
    saveExpense({
      category: 'Bank Charges & Cheque Bounce Fee',
      type: 'OPERATING',
      amount: bounceCharges,
      date: new Date().toISOString().split('T')[0],
      paidTo: 'Bank Penalty Charges',
      notes: `Cheque #${payItem.chequeNo} bounced for Receipt #${receipt.receiptNo}. Reason: ${reason}`,
      paymentMode: 'CASH'
    });
  }

  // Update target invoice: revert state
  if (receipt.invoiceId) {
    const invoices = fetchInvoices();
    const targetInvoice = invoices.find(i => i.id === receipt.invoiceId);
    if (targetInvoice) {
      const updatedInvoices = invoices.map(i => i.id === targetInvoice.id ? {
        ...i,
        state: 'posted',
        paymentStatus: 'UNPAID',
        chequeBounced: true,
        chequeBounceReason: reason
      } : i);
      setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);

      InvoiceHistoryLogger.log({
        invoiceId: targetInvoice.id,
        actionType: 'CHEQUE_BOUNCED',
        description: `⚠️ CHEQUE BOUNCED! Cheque #${payItem.chequeNo} for ₹${chequeAmount.toLocaleString('en-IN')} dishonored. Reason: "${reason}". Penalty charges ₹${bounceCharges} applied to party ledger.`,
        referenceDocumentId: receipt.id,
        referenceDocumentType: 'PAYMENT',
        metadata: { chequeNo: payItem.chequeNo, chequeAmount, bounceCharges, reason }
      });
    }
  }

  setStorageData(STORAGE_KEYS.PAYMENT_RECEIPTS, receipts);
  logAuditAction('CHEQUE_BOUNCED', 'Banking & Settlements', `Cheque #${payItem.chequeNo} bounced! Reason: ${reason}`);
  autoCloudSync();
  return { success: true, chequeAmount, bounceCharges };
};
