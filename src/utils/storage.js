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

const DEFAULT_PRODUCTS = [
  {
    id: 'prod_1',
    name: 'Parle-G Gold Biscuit (100g Box of 24 Pcs)',
    category: 'Biscuits & Confectionery',
    brand: 'Parle',
    sku: 'PRL-G-100G-BOX',
    hsn: '19053100',
    mrp: 360,
    salePrice: 310,
    purchasePrice: 280,
    gstRate: 18,
    pcsPerCarton: 24,
    currentStock: 48,
    unit: 'Box',
    minStockLimit: 15
  },
  {
    id: 'prod_2',
    name: 'Britannia Good Day Butter (600g Family Pack)',
    category: 'Biscuits & Confectionery',
    brand: 'Britannia',
    sku: 'BRT-GD-600G',
    hsn: '19053100',
    mrp: 120,
    salePrice: 102,
    purchasePrice: 90,
    gstRate: 18,
    pcsPerCarton: 24,
    currentStock: 117,
    unit: 'Pcs',
    minStockLimit: 20
  },
  {
    id: 'prod_3',
    name: 'Tata Salt Vacuum Evaporated (1kg Pouch)',
    category: 'Staples & Grocery',
    brand: 'Tata Consumer',
    sku: 'TATA-SALT-1KG',
    hsn: '25010090',
    mrp: 28,
    salePrice: 24.5,
    purchasePrice: 21.5,
    gstRate: 5,
    pcsPerCarton: 50,
    currentStock: 250,
    unit: 'Pcs',
    minStockLimit: 50
  },
  {
    id: 'prod_4',
    name: 'Fortune Sunlite Refined Sunflower Oil (1L Pouch)',
    category: 'Edible Oils',
    brand: 'Fortune Adani Wilmar',
    sku: 'FRT-SUN-1L',
    hsn: '15121910',
    mrp: 155,
    salePrice: 138,
    purchasePrice: 126,
    gstRate: 5,
    pcsPerCarton: 12,
    currentStock: 8,
    unit: 'Pcs',
    minStockLimit: 25
  },
  {
    id: 'prod_5',
    name: 'Surf Excel Easy Wash Detergent Powder (1kg)',
    category: 'Home Care',
    brand: 'HUL',
    sku: 'SURF-EW-1KG',
    hsn: '34022090',
    mrp: 145,
    salePrice: 128,
    purchasePrice: 112,
    gstRate: 18,
    pcsPerCarton: 20,
    currentStock: 62,
    unit: 'Pcs',
    minStockLimit: 15
  },
  {
    id: 'prod_6',
    name: 'Dettol Original Bathing Soap (125g Pack of 4)',
    category: 'Personal Care',
    brand: 'Reckitt Benckiser',
    sku: 'DTL-SOP-4P',
    hsn: '34011110',
    mrp: 210,
    salePrice: 184,
    purchasePrice: 162,
    gstRate: 18,
    pcsPerCarton: 24,
    currentStock: 16,
    unit: 'Pack',
    minStockLimit: 10
  },
  {
    id: 'prod_7',
    name: 'Amul Taaza Toned Milk (1L Tetra Pack)',
    category: 'Dairy & Beverages',
    brand: 'Amul',
    sku: 'AML-TZ-1L',
    hsn: '04012000',
    mrp: 72,
    salePrice: 66,
    purchasePrice: 60,
    gstRate: 0,
    pcsPerCarton: 12,
    currentStock: 90,
    unit: 'Pcs',
    minStockLimit: 30
  },
  {
    id: 'prod_8',
    name: 'Cadbury Dairy Milk Silk Chocolate (150g)',
    category: 'Biscuits & Confectionery',
    brand: 'Mondelez',
    sku: 'CDB-SILK-150G',
    hsn: '18069020',
    mrp: 180,
    salePrice: 160,
    purchasePrice: 140,
    gstRate: 18,
    pcsPerCarton: 24,
    currentStock: 35,
    unit: 'Pcs',
    minStockLimit: 10
  }
];

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

const DEFAULT_PARTIES = [
  {
    id: 'party_1',
    name: 'Gupta Kirana & General Store',
    contactPerson: 'Ramakant Gupta',
    phone: '9811223344',
    city: 'Rohini, Sector 7',
    address: 'Shop No. 4, Main Market, Rohini Sector 7, Delhi',
    gstin: '07BAPPG4321A1Z2',
    creditLimit: 50000,
    balance: 14200 // Positive = Customer owes us money (Udhar)
  },
  {
    id: 'party_2',
    name: 'Sharma Supermarket & Departmental Store',
    contactPerson: 'Suresh Sharma',
    phone: '9877112233',
    city: 'Pitampura',
    address: 'Plot 45, FD Block, Near Metro Station, Pitampura, Delhi',
    gstin: '07AAPPS9988C1Z5',
    creditLimit: 100000,
    balance: 28500
  },
  {
    id: 'party_3',
    name: 'Verma Daily Needs & Provision Store',
    contactPerson: 'Vikas Verma',
    phone: '9866554433',
    city: 'Shalimar Bagh',
    address: '12-B Central Market, Shalimar Bagh, Delhi',
    gstin: '07CCPVV8877B1Z4',
    creditLimit: 30000,
    balance: 0 // Settled
  },
  {
    id: 'party_4',
    name: 'Aggarwal Traders (Wholesale & Retail)',
    contactPerson: 'Sunil Aggarwal',
    phone: '9910022334',
    city: 'Kamla Nagar',
    address: '88-A Spark Mall Lane, Kamla Nagar, Delhi',
    gstin: '07AAAPA1122D1Z9',
    creditLimit: 150000,
    balance: 42000
  }
];

const DEFAULT_INVOICES = [
  {
    id: 'inv_1001',
    invoiceNo: 'SGA/26-27/1001',
    date: '2026-08-23T10:30:00.000Z',
    partyId: 'party_1',
    partyName: 'Gupta Kirana & General Store',
    partyPhone: '9811223344',
    partyGstin: '07BAPPG4321A1Z2',
    partyAddress: 'Shop No. 4, Main Market, Rohini Sector 7, Delhi',
    items: [
      {
        productId: 'prod_1',
        name: 'Parle-G Gold Biscuit (100g Box of 24 Pcs)',
        sku: 'PRL-G-100G-BOX',
        hsn: '19053100',
        qty: 10,
        unit: 'Box',
        price: 310,
        mrp: 360,
        gstRate: 18,
        total: 3100
      },
      {
        productId: 'prod_3',
        name: 'Tata Salt Vacuum Evaporated (1kg Pouch)',
        sku: 'TATA-SALT-1KG',
        hsn: '25010090',
        qty: 50,
        unit: 'Pcs',
        price: 24.5,
        mrp: 28,
        gstRate: 5,
        total: 1225
      }
    ],
    subTotal: 4325,
    taxTotal: 619.25,
    cgst: 309.63,
    sgst: 309.63,
    igst: 0,
    discount: 100,
    grandTotal: 4844.25,
    paymentStatus: 'UNPAID', // UNPAID, PAID, PARTIAL
    paidAmount: 0,
    balanceAmount: 4844.25,
    notes: 'Standard 14 days credit invoice.'
  },
  {
    id: 'inv_1002',
    invoiceNo: 'SGA/26-27/1002',
    date: '2026-08-24T04:15:00.000Z',
    partyId: 'party_2',
    partyName: 'Sharma Supermarket & Departmental Store',
    partyPhone: '9877112233',
    partyGstin: '07AAPPS9988C1Z5',
    partyAddress: 'Plot 45, FD Block, Near Metro Station, Pitampura, Delhi',
    items: [
      {
        productId: 'prod_2',
        name: 'Britannia Good Day Butter (600g Family Pack)',
        sku: 'BRT-GD-600G',
        hsn: '19053100',
        qty: 20,
        unit: 'Pcs',
        price: 102,
        mrp: 120,
        gstRate: 18,
        total: 2040
      },
      {
        productId: 'prod_5',
        name: 'Surf Excel Easy Wash Detergent Powder (1kg)',
        sku: 'SURF-EW-1KG',
        hsn: '34022090',
        qty: 15,
        unit: 'Pcs',
        price: 128,
        mrp: 145,
        gstRate: 18,
        total: 1920
      }
    ],
    subTotal: 3960,
    taxTotal: 712.80,
    cgst: 356.40,
    sgst: 356.40,
    igst: 0,
    discount: 0,
    grandTotal: 4672.80,
    paymentStatus: 'PAID',
    paidAmount: 4672.80,
    balanceAmount: 0,
    notes: 'Paid via UPI Transfer.'
  }
];

const DEFAULT_PURCHASES = [
  {
    id: 'pur_1',
    purchaseNo: 'PUR-2026-089',
    date: '2026-08-20T09:00:00.000Z',
    supplierName: 'Parle Products Pvt Ltd Depot',
    items: [
      {
        productId: 'prod_1',
        name: 'Parle-G Gold Biscuit (100g Box of 24 Pcs)',
        qty: 50,
        purchasePrice: 280,
        total: 14000
      }
    ],
    grandTotal: 14000,
    notes: 'Direct Factory Depot stock receipt.'
  }
];

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
  if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
    setStorageData(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.PARTIES)) {
    setStorageData(STORAGE_KEYS.PARTIES, DEFAULT_PARTIES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.INVOICES)) {
    setStorageData(STORAGE_KEYS.INVOICES, DEFAULT_INVOICES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.PURCHASES)) {
    setStorageData(STORAGE_KEYS.PURCHASES, DEFAULT_PURCHASES);
  }
};

// Operations: Products
export const fetchProducts = () => getStorageData(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
export const saveProduct = (product) => {
  const products = fetchProducts();
  let updated;
  if (product.id) {
    updated = products.map(p => p.id === product.id ? product : p);
  } else {
    const newProd = {
      ...product,
      id: 'prod_' + Date.now()
    };
    updated = [newProd, ...products];
  }
  setStorageData(STORAGE_KEYS.PRODUCTS, updated);
  return updated;
};

export const deleteProduct = (id) => {
  const products = fetchProducts().filter(p => p.id !== id);
  setStorageData(STORAGE_KEYS.PRODUCTS, products);
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
  return newInvoice;
};

// Operations: Business Settings
export const fetchBusinessInfo = () => getStorageData(STORAGE_KEYS.BUSINESS, DEFAULT_BUSINESS);
export const saveBusinessInfo = (info) => {
  setStorageData(STORAGE_KEYS.BUSINESS, info);
  
  // Async push to Supabase if connected
  const client = getSupabaseClient();
  if (client) {
    client.from('business_info').upsert({ id: 'default_business', ...info }).catch(console.error);
  }
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

