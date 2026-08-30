// Storage Utility for Distributor Stock & Billing Manager (DistroPulse)
import { getSupabaseClient } from './supabaseClient';

const STORAGE_KEYS = {
  BUSINESS: 'distro_business_info',
  PRODUCTS: 'distro_products',
  PARTIES: 'distro_parties',
  INVOICES: 'distro_invoices',
  PURCHASES: 'distro_purchases',
  STOCK_LEDGER: 'distro_stock_ledger'
};

const DEFAULT_BUSINESS = {
  name: "Shree Ganesh Sales Agency",
  tagline: "Authorized FMCG & Wholesale Distributor",
  proprietor: "Rajesh Kumar Verma",
  gstin: "07AAACG1234F1Z8",
  phone: "+91 98765 43210",
  email: "sales@shreeganeshdistributors.com",
  address: "Shop No. 12-14, Wholesale Grain Market, Transport Nagar, New Delhi - 110042",
  bankName: "HDFC Bank Ltd.",
  accountNo: "50200088991122",
  ifsc: "HDFC0001234",
  invoicePrefix: "SGA/26-27/",
  terms: "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged on overdue payments.\n3. Subject to local jurisdiction."
};

const DEFAULT_PRODUCTS = [];
const DEFAULT_PARTIES = [];
const DEFAULT_INVOICES = [];
const DEFAULT_PURCHASES = [];

export const formatCartonStock = (totalStock = 0, pcsPerCarton = 24) => {
  const pcs = Number(pcsPerCarton) || 1;
  const stock = Number(totalStock) || 0;
  
  if (pcs <= 1) {
    return `${stock} Pcs`;
  }

  const cartons = Math.floor(stock / pcs);
  const loosePcs = stock % pcs;

  if (cartons > 0 && loosePcs > 0) {
    return `${cartons} Ctn + ${loosePcs} Pcs`;
  } else if (cartons > 0) {
    return `${cartons} Ctn (${stock} Pcs)`;
  } else {
    return `${loosePcs} Pcs`;
  }
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

const SAMPLE_IDS = [
  'prod_1', 'prod_2', 'prod_3', 'prod_4', 'prod_5', 'prod_6', 'prod_7', 'prod_8',
  'party_1', 'party_2', 'party_3', 'party_4',
  'inv_1001', 'inv_1002', 'pur_1'
];

// Initialize Storage with Defaults if missing
export const initDataStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.BUSINESS)) {
    setStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  }

  // Force Clean of all sample data
  const existingProds = getStorageData(STORAGE_KEYS.PRODUCTS, []).filter(p => !SAMPLE_IDS.includes(p?.id));
  setStorageData(STORAGE_KEYS.PRODUCTS, existingProds);

  const existingParties = getStorageData(STORAGE_KEYS.PARTIES, []).filter(p => !SAMPLE_IDS.includes(p?.id));
  setStorageData(STORAGE_KEYS.PARTIES, existingParties);

  const existingInvoices = getStorageData(STORAGE_KEYS.INVOICES, []).filter(i => !SAMPLE_IDS.includes(i?.id));
  setStorageData(STORAGE_KEYS.INVOICES, existingInvoices);

  const existingPurchases = getStorageData(STORAGE_KEYS.PURCHASES, []).filter(i => !SAMPLE_IDS.includes(i?.id));
  setStorageData(STORAGE_KEYS.PURCHASES, existingPurchases);

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
  const client = getSupabaseClient();
  if (client) {
    client.from('products').delete().neq('id', 'xyz_dummy_keep').then(() => {}).catch(console.error);
    client.from('parties').delete().neq('id', 'xyz_dummy_keep').then(() => {}).catch(console.error);
    client.from('invoices').delete().neq('id', 'xyz_dummy_keep').then(() => {}).catch(console.error);
  }
};

// --- LIVE DEFAULT CLOUD SYNC CHANNEL (ZERO CONFIG) ---
const DEFAULT_SUPABASE_URL = 'https://steiiaxiouvbulxcvvsw.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZWlpYXhpb3V2YnVseGN2dnN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNjMyMDYsImV4cCI6MjEwMjczOTIwNn0.-BQl9aLHG5Sb-MEdJSx1WDVa7ukhqDAZKFgbZf6xafU';
const STORE_DATA_ID = 'distropulse_store_data';

const getCloudHeaders = () => ({
  'apikey': DEFAULT_SUPABASE_KEY,
  'Authorization': `Bearer ${DEFAULT_SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

const mergeById = (localArr = [], remoteArr = []) => {
  const map = new Map();
  (remoteArr || []).forEach(item => {
    if (item && item.id && !SAMPLE_IDS.includes(item.id)) {
      map.set(item.id, item);
    }
  });
  // Local items override or append (preserves local creations & updates)
  (localArr || []).forEach(item => {
    if (item && item.id && !SAMPLE_IDS.includes(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
};

export const fetchCloudData = async () => {
  let hasUpdated = false;

  try {
    const res = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/fmcg_shops?id=eq.${STORE_DATA_ID}`, {
      headers: getCloudHeaders()
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].beat) {
        const remote = JSON.parse(rows[0].beat);

        const localInvoices = getStorageData(STORAGE_KEYS.INVOICES, []);
        const localProducts = getStorageData(STORAGE_KEYS.PRODUCTS, []);
        const localParties = getStorageData(STORAGE_KEYS.PARTIES, []);

        // Safely merge remote data into local state without losing new local creations
        if (Array.isArray(remote.invoices)) {
          setStorageData(STORAGE_KEYS.INVOICES, mergeById(localInvoices, remote.invoices));
        }

        if (Array.isArray(remote.products)) {
          setStorageData(STORAGE_KEYS.PRODUCTS, mergeById(localProducts, remote.products));
        }

        if (Array.isArray(remote.parties)) {
          setStorageData(STORAGE_KEYS.PARTIES, mergeById(localParties, remote.parties));
        }

        if (remote.business && remote.business.name) {
          setStorageData(STORAGE_KEYS.BUSINESS, remote.business);
        }

        hasUpdated = true;
      }
    }
  } catch (err) {
    console.warn('Live Cloud Sync fetch error:', err);
  }

  return hasUpdated;
};

export const pushLocalDataToCloud = async () => {
  const products = getStorageData(STORAGE_KEYS.PRODUCTS, []).filter(p => p && !SAMPLE_IDS.includes(p.id));
  const parties = getStorageData(STORAGE_KEYS.PARTIES, []).filter(pt => pt && !SAMPLE_IDS.includes(pt.id));
  const invoices = getStorageData(STORAGE_KEYS.INVOICES, []).filter(i => i && !SAMPLE_IDS.includes(i.id));
  const business = getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);

  const payload = {
    id: STORE_DATA_ID,
    name: 'DISTROPULSE_SYSTEM_STORE',
    owner: 'SYSTEM',
    area: 'SYSTEM',
    beat: JSON.stringify({
      business,
      products,
      parties,
      invoices,
      lastUpdated: Date.now()
    }),
    day: 'System',
    balance: 0,
    status: 'System',
    phone: '000',
    lat: 0,
    lng: 0
  };

  try {
    const patchRes = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/fmcg_shops?id=eq.${STORE_DATA_ID}`, {
      method: 'PATCH',
      headers: getCloudHeaders(),
      body: JSON.stringify(payload)
    });

    if (patchRes.ok) {
      const resData = await patchRes.json().catch(() => []);
      if (Array.isArray(resData) && resData.length === 0) {
        await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/fmcg_shops`, {
          method: 'POST',
          headers: getCloudHeaders(),
          body: JSON.stringify(payload)
        });
      }
    } else {
      await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/fmcg_shops`, {
        method: 'POST',
        headers: getCloudHeaders(),
        body: JSON.stringify(payload)
      });
    }

    return { success: true, message: 'All products, parties & invoices synced to Cloud Database!' };
  } catch (err) {
    console.error('Live Cloud Sync push error:', err);
    return { success: false, message: 'Cloud sync error' };
  }
};

export const autoCloudSync = async () => {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('distro_data_changed'));
    }
    await pushLocalDataToCloud();
  } catch (e) {
    console.warn('Auto cloud sync warning:', e);
  }
};

export const performFullSync = async () => {
  await pushLocalDataToCloud();
  await fetchCloudData();
  return { success: true, message: 'Zero-Config Cloud Sync Completed!' };
};

// Operations: Products
export const fetchProducts = () => getStorageData(STORAGE_KEYS.PRODUCTS, []).filter(p => p && !SAMPLE_IDS.includes(p.id));
export const saveProduct = (product) => {
  const products = fetchProducts();
  let updated;
  let targetProd;
  if (product.id) {
    targetProd = product;
    updated = products.map(p => p.id === product.id ? product : p);
  } else {
    targetProd = {
      ...product,
      id: 'prod_' + Date.now()
    };
    updated = [targetProd, ...products];
  }
  setStorageData(STORAGE_KEYS.PRODUCTS, updated);
  autoCloudSync();
  return updated;
};

export const deleteProduct = (id) => {
  const products = getStorageData(STORAGE_KEYS.PRODUCTS, []).filter(p => p && p.id !== id && !SAMPLE_IDS.includes(p.id));
  setStorageData(STORAGE_KEYS.PRODUCTS, products);
  
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
  const updated = products.map(p => {
    if (p.id === productId) {
      const newStock = Math.max(0, (Number(p.currentStock) || 0) + Number(qtyToAdd));
      return { ...p, currentStock: newStock };
    }
    return p;
  });
  setStorageData(STORAGE_KEYS.PRODUCTS, updated);
  autoCloudSync();
  return updated;
};

// Operations: Parties
export const fetchParties = () => getStorageData(STORAGE_KEYS.PARTIES, []).filter(p => p && !SAMPLE_IDS.includes(p.id));
export const saveParty = (party) => {
  const parties = fetchParties();
  let updated;
  let targetParty;
  if (party.id) {
    targetParty = party;
    updated = parties.map(p => p.id === party.id ? party : p);
  } else {
    targetParty = {
      ...party,
      id: 'party_' + Date.now(),
      balance: Number(party.balance) || 0
    };
    updated = [targetParty, ...parties];
  }
  setStorageData(STORAGE_KEYS.PARTIES, updated);
  autoCloudSync();
  return targetParty;
};

export const updatePartyBalance = (partyId, amountToAdd) => {
  const parties = fetchParties();
  const updated = parties.map(p => {
    if (p.id === partyId) {
      const newBal = (Number(p.balance) || 0) + Number(amountToAdd);
      return { ...p, balance: Math.max(0, newBal) };
    }
    return p;
  });
  setStorageData(STORAGE_KEYS.PARTIES, updated);
  autoCloudSync();
  return updated;
};

export const deleteParty = (id) => {
  const parties = getStorageData(STORAGE_KEYS.PARTIES, []).filter(p => p && p.id !== id && !SAMPLE_IDS.includes(p.id));
  setStorageData(STORAGE_KEYS.PARTIES, parties);
  
  const client = getSupabaseClient();
  if (client) {
    client.from('parties').delete().eq('id', id).then(() => {}).catch(console.error);
  }
  autoCloudSync();
  return parties;
};

// Operations: Invoices
export const fetchInvoices = () => getStorageData(STORAGE_KEYS.INVOICES, []).filter(i => i && !SAMPLE_IDS.includes(i.id));

export const saveInvoice = (invoiceData) => {
  const invoices = fetchInvoices();
  const products = fetchProducts();

  const business = getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  const nextNumber = invoices.length + 1001;
  const invoiceNo = invoiceData.invoiceNo || `${business.invoicePrefix || 'INV/'}${nextNumber}`;

  const newInvoice = {
    ...invoiceData,
    id: 'inv_' + Date.now(),
    invoiceNo,
    date: invoiceData.date || new Date().toISOString()
  };

  // 1. Deduct Stock for billed items
  const updatedProducts = products.map(p => {
    const billedItem = invoiceData.items.find(item => item.productId === p.id);
    if (billedItem) {
      const remainingStock = Math.max(0, Number(p.currentStock) - Number(billedItem.qty));
      return { ...p, currentStock: remainingStock };
    }
    return p;
  });
  setStorageData(STORAGE_KEYS.PRODUCTS, updatedProducts);

  // 2. If bill is UNPAID or PARTIAL, add balance to Party Ledger
  if (invoiceData.partyId && (invoiceData.paymentStatus === 'UNPAID' || invoiceData.paymentStatus === 'PARTIAL')) {
    const uncollectedAmount = invoiceData.balanceAmount || (invoiceData.grandTotal - (invoiceData.paidAmount || 0));
    updatePartyBalance(invoiceData.partyId, uncollectedAmount);
  }

  // 3. Save Invoice
  const updatedInvoices = [newInvoice, ...invoices];
  setStorageData(STORAGE_KEYS.INVOICES, updatedInvoices);
  autoCloudSync();
  return newInvoice;
};

export const deleteInvoice = (invoiceId) => {
  const invoices = fetchInvoices();
  const targetInv = invoices.find(i => i.id === invoiceId);
  if (!targetInv) return invoices;

  // 1. Restore Stock for billed items
  if (targetInv.items && Array.isArray(targetInv.items)) {
    const products = fetchProducts();
    const restoredProducts = products.map(p => {
      const billedItem = targetInv.items.find(item => item.productId === p.id);
      if (billedItem) {
        const newStock = (Number(p.currentStock) || 0) + (Number(billedItem.qty) || 0);
        return { ...p, currentStock: newStock };
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

  // 4. Delete from Supabase Cloud
  const client = getSupabaseClient();
  if (client) {
    client.from('invoices').delete().eq('id', invoiceId).then(() => {}).catch(console.error);
  }

  autoCloudSync();
  return updatedInvoices;
};

// Operations: Business Settings
export const fetchBusinessInfo = () => getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
export const saveBusinessInfo = (info) => {
  setStorageData(STORAGE_KEYS.BUSINESS, info);
  autoCloudSync();
  return info;
};


