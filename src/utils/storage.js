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

// Initialize Storage with Defaults if missing
export const initDataStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.BUSINESS)) {
    setStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
  }

  // Force Hard Clean of all sample data
  const isHardCleaned = localStorage.getItem('distro_v3_hard_cleaned');
  if (!isHardCleaned) {
    setStorageData(STORAGE_KEYS.PRODUCTS, []);
    setStorageData(STORAGE_KEYS.PARTIES, []);
    setStorageData(STORAGE_KEYS.INVOICES, []);
    setStorageData(STORAGE_KEYS.PURCHASES, []);
    localStorage.setItem('distro_v3_hard_cleaned', 'true');
    localStorage.setItem('distro_sample_cleaned_v2', 'true');

    // Wipe Cloud DB as well
    const client = getSupabaseClient();
    if (client) {
      client.from('products').delete().neq('id', 'xyz_dummy_keep').then(() => {}).catch(console.error);
      client.from('parties').delete().neq('id', 'xyz_dummy_keep').then(() => {}).catch(console.error);
      client.from('invoices').delete().neq('id', 'xyz_dummy_keep').then(() => {}).catch(console.error);
    }
  } else {
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) setStorageData(STORAGE_KEYS.PRODUCTS, []);
    if (!localStorage.getItem(STORAGE_KEYS.PARTIES)) setStorageData(STORAGE_KEYS.PARTIES, []);
    if (!localStorage.getItem(STORAGE_KEYS.INVOICES)) setStorageData(STORAGE_KEYS.INVOICES, []);
    if (!localStorage.getItem(STORAGE_KEYS.PURCHASES)) setStorageData(STORAGE_KEYS.PURCHASES, []);
  }
};

export const clearAllSampleData = () => {
  setStorageData(STORAGE_KEYS.PRODUCTS, []);
  setStorageData(STORAGE_KEYS.PARTIES, []);
  setStorageData(STORAGE_KEYS.INVOICES, []);
  setStorageData(STORAGE_KEYS.PURCHASES, []);
  const client = getSupabaseClient();
  if (client) {
    client.from('products').delete().neq('id', '0').catch(console.error);
    client.from('parties').delete().neq('id', '0').catch(console.error);
    client.from('invoices').delete().neq('id', '0').catch(console.error);
  }
};

// Helper for automatic real-time Cloud DB syncing
const autoCloudSync = async () => {
  try {
    const client = getSupabaseClient();
    if (client) {
      pushLocalDataToCloud().catch(err => console.warn('Auto cloud sync warning:', err));
    }
  } catch (e) {
    console.warn('Auto cloud sync caught:', e);
  }
};

// Operations: Products
export const fetchProducts = () => getStorageData(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
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
  const products = fetchProducts().filter(p => p.id !== id);
  setStorageData(STORAGE_KEYS.PRODUCTS, products);
  
  const client = getSupabaseClient();
  if (client) {
    client.from('products').delete().eq('id', id).catch(console.error);
  }
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
export const fetchParties = () => getStorageData(STORAGE_KEYS.PARTIES, DEFAULT_PARTIES);
export const saveParty = (party) => {
  const parties = fetchParties();
  let updated;
  if (party.id) {
    updated = parties.map(p => p.id === party.id ? party : p);
  } else {
    const newParty = {
      ...party,
      id: 'party_' + Date.now(),
      balance: Number(party.balance) || 0
    };
    updated = [newParty, ...parties];
  }
  setStorageData(STORAGE_KEYS.PARTIES, updated);
  autoCloudSync();
  return updated;
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

// Operations: Invoices
export const fetchInvoices = () => getStorageData(STORAGE_KEYS.INVOICES, DEFAULT_INVOICES);

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

// Operations: Business Settings
export const fetchBusinessInfo = () => getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
export const saveBusinessInfo = (info) => {
  setStorageData(STORAGE_KEYS.BUSINESS, info);
  autoCloudSync();
  return info;
};

// --- SUPABASE CLOUD SYNC HELPERS ---
export const fetchCloudData = async () => {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data: prodData } = await client.from('products').select('*');
    if (prodData && prodData.length > 0) {
      setStorageData(STORAGE_KEYS.PRODUCTS, prodData);
    }

    const { data: partyData } = await client.from('parties').select('*');
    if (partyData && partyData.length > 0) {
      setStorageData(STORAGE_KEYS.PARTIES, partyData);
    }

    const { data: invData } = await client.from('invoices').select('*');
    if (invData && invData.length > 0) {
      setStorageData(STORAGE_KEYS.INVOICES, invData);
    }

    const { data: bizData } = await client.from('business_info').select('*').single();
    if (bizData) {
      setStorageData(STORAGE_KEYS.BUSINESS, bizData);
    }

    return true;
  } catch (err) {
    console.error('Error fetching cloud data from Supabase:', err);
    return false;
  }
};

export const pushLocalDataToCloud = async () => {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Supabase URL/Key is missing.' };

  try {
    const products = fetchProducts();
    const parties = fetchParties();
    const invoices = fetchInvoices();
    const business = fetchBusinessInfo();

    if (products.length > 0) {
      await client.from('products').upsert(products);
    }
    if (parties.length > 0) {
      await client.from('parties').upsert(parties);
    }
    if (invoices.length > 0) {
      await client.from('invoices').upsert(invoices);
    }
    if (business) {
      await client.from('business_info').upsert({ id: 'default_business', ...business });
    }

    return { success: true, message: 'All products, parties, invoices & business settings synced to Cloud Database!' };
  } catch (err) {
    console.error('Error pushing data to Supabase:', err);
    return { success: false, message: err.message || 'Cloud sync failed.' };
  }
};

