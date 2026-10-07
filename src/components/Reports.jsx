import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  ArrowLeft,
  TrendingUp, 
  IndianRupee, 
  ShieldCheck, 
  Award, 
  Calendar, 
  Printer, 
  FileText, 
  Users, 
  Filter,
  ArrowDownToLine,
  PieChart,
  BookOpen,
  Package,
  CheckCircle2,
  AlertTriangle,
  Download,
  Building2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Plus,
  Trash2,
  Edit3,
  Receipt,
  Wallet,
  Briefcase,
  UserCheck,
  DollarSign,
  AlertCircle,
  X,
  Save,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Tag
} from 'lucide-react';
import { 
  fetchBankTransactions, 
  fetchWarehouses, 
  fetchExpenses, 
  saveExpense, 
  deleteExpense, 
  fetchProprietorCapital, 
  saveProprietorCapital, 
  fetchBankAccounts,
  getProductStockValuation 
} from '../utils/storage';


// Bulletproof Brand Normalizer & Canonicalizer for FMCG Products
const canonicalizeBrand = (brandStr) => {
  if (!brandStr) return 'General';
  const clean = brandStr.trim();
  const upper = clean.toUpperCase();

  if (upper.includes('PARKASH') || upper.includes('PRAKASH') || upper.includes('SIFI')) {
    return 'SIFI PARKASH';
  }
  if (upper.includes('RELIANCE') || upper.includes('RELIENCE') || upper.includes('RELINCE')) {
    return 'RELIANCE CONSUMER PRODUCTS';
  }
  if (upper.includes('BEYOND SNACK')) {
    return 'BEYOND SNACKS';
  }
  if (upper.includes('RAVALGAON') || upper.includes('PAN PASAND')) {
    return 'RAVALGAON';
  }
  if (upper.includes('TOFFEEMAN') || upper.includes('COFFEE BREAK')) {
    return 'TOFFEEMAN';
  }
  if (upper === 'GENERAL' || upper === 'STANDARD' || upper === 'DEFAULT') {
    return 'General';
  }
  return clean;
};

const KNOWN_PARKASH_KEYWORDS = [
  'KOOPA', 'FINGER', 'NOODLES', 'CLAP', 'NAVRATNA', 'MOONG DAL', 
  'SALTED PEANUTS', 'RAJASTHANI SEV', 'TASTY NUTS', 'AKHA CHANA', 
  'CHANA DAL', 'ALOO BHUJIA', 'BHUJIA', 'DITE LITE', 'SIFI', 'PARKASH', 'PRAKASH'
];

const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
};

const parseInvoiceDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  let d = new Date(dateVal);
  if (!isNaN(d.getTime())) return d;
  if (typeof dateVal === 'string') {
    const clean = dateVal.trim();
    const parts = clean.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else if (parts[2].length === 4) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2 = parseInt(parts[2], 10);
        if (p0 > 12) {
          d = new Date(p2, p1 - 1, p0);
        } else {
          d = new Date(p2, p0 - 1, p1);
        }
      }
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
};

export default function Reports({ invoices = [], products = [], parties = [], business, refreshAllData, t }) {
  const [reportTab, setReportTab] = useState('SALES');
  const [salesViewMode, setSalesViewMode] = useState('ALL'); // 'ALL', 'BRAND', 'PARTY', 'PRODUCT' // 'SALES', 'PNL', 'BALANCESHEET', 'EXPENSES', 'GST', 'DAYBOOK', 'STOCK'
  const [period, setPeriod] = useState('ALL'); // Default ALL so previous months (Aug/Sep) are never hidden
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [selectedBrandDetail, setSelectedBrandDetail] = useState(null);
  const [brandDetailTab, setBrandDetailTab] = useState('PRODUCTS'); // 'PRODUCTS' or 'INVOICES' // 'TODAY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM', 'ALL'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dayBookDate, setDayBookDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStockWarehouse, setSelectedStockWarehouse] = useState('ALL');

  // GSTR-1 Official Exporter State
  const [gstFpMonth, setGstFpMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
  const [gstValidationResult, setGstValidationResult] = useState(null);
  const [gstValidationModalOpen, setGstValidationModalOpen] = useState(false);

  const getFpSixDigit = () => {
    if (!gstFpMonth) {
      const d = new Date();
      return String(d.getMonth() + 1).padStart(2, '0') + d.getFullYear();
    }
    const [yyyy, mm] = gstFpMonth.split('-');
    return `${mm}${yyyy}`;
  };

  const getGstTargetInvoices = () => {
    if (!gstFpMonth) return filteredInvoices;
    const monthMatched = invoices.filter(inv => inv.date && inv.date.startsWith(gstFpMonth));
    return monthMatched.length > 0 ? monthMatched : filteredInvoices;
  };

  const handleValidateGstr1 = () => {
    const fp = getFpSixDigit();
    const salesReturns = fetchSalesReturns();
    const targetInvs = getGstTargetInvoices();
    const payload = generateGstr1Payload({
      invoices: targetInvs,
      creditNotes: salesReturns,
      businessGstin: business?.gstin || '07AAAAA0000A1Z5',
      filingPeriod: fp,
      grossTurnover: totalSales,
      curGrossTurnover: totalSales
    });
    const result = validateGstr1Payload(payload);
    setGstValidationResult({ ...result, payload, fp });
    setGstValidationModalOpen(true);
  };

  const handleExportGstr1OfficialJson = () => {
    const fp = getFpSixDigit();
    const salesReturns = fetchSalesReturns();
    const targetInvs = getGstTargetInvoices();
    const payload = generateGstr1Payload({
      invoices: targetInvs,
      creditNotes: salesReturns,
      businessGstin: business?.gstin || '07AAAAA0000A1Z5',
      filingPeriod: fp,
      grossTurnover: totalSales,
      curGrossTurnover: totalSales
    });
    
    const validation = validateGstr1Payload(payload);
    if (!validation.isValid) {
      alert(`⚠️ Cannot export GSTR-1 JSON due to validation errors:\n\n• ${validation.errors.join('\n• ')}`);
      setGstValidationResult({ ...validation, payload, fp });
      setGstValidationModalOpen(true);
      return;
    }

    const filename = downloadGstr1Json(payload, business?.gstin, fp);

    // Immutable audit timeline logging
    filteredInvoices.forEach(inv => {
      try {
        InvoiceHistoryLogger.log(inv.id, 'GSTR1_EXPORTED', {
          action: 'GSTR-1 JSON Exported',
          fp,
          gstin: business?.gstin,
          filename
        });
      } catch (e) {}
    });

    alert(`🎉 Official GSTR-1 JSON exported successfully as ${filename}!\n\nUpload directly to the GST Portal (gst.gov.in) under 'Returns Dashboard' ➔ 'GSTR-1' ➔ 'Prepare Offline' ➔ 'Upload'.`);
  };

  // Sole Proprietor Accounting State
  const [expenses, setExpenses] = useState(fetchExpenses());
  const [capital, setCapital] = useState(fetchProprietorCapital());
  const [bankAccounts, setBankAccounts] = useState(fetchBankAccounts());
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [capitalModalOpen, setCapitalModalOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [expenseFilterType, setExpenseFilterType] = useState('ALL'); // 'ALL', 'DIRECT', 'OPERATING', 'DRAWING'

  const warehouses = fetchWarehouses();
  const bankTransactions = fetchBankTransactions();

  // Expense Form State
  const initialExpenseState = {
    category: 'Shop / Godown Rent',
    type: 'OPERATING', // 'DIRECT', 'OPERATING', 'DRAWING'
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'CASH',
    bankAccountId: bankAccounts[0]?.id || '',
    paidTo: '',
    notes: ''
  };
  const [expenseFormData, setExpenseFormData] = useState(initialExpenseState);

  // Capital Form State
  const initialCapitalState = {
    openingCapital: capital.openingCapital || 0,
    additionalCapital: capital.additionalCapital || 0,
    fixedAssets: capital.fixedAssets || 0,
    openingCash: capital.openingCash || 0,
    asOfDate: capital.asOfDate || new Date().toISOString().split('T')[0],
    notes: capital.notes || ''
  };
  const [capitalFormData, setCapitalFormData] = useState(initialCapitalState);

  const handleOpenCapitalModal = () => {
    setCapitalFormData({
      openingCapital: capital.openingCapital || 0,
      additionalCapital: capital.additionalCapital || 0,
      fixedAssets: capital.fixedAssets || 0,
      openingCash: capital.openingCash || 0,
      asOfDate: capital.asOfDate || new Date().toISOString().split('T')[0],
      notes: capital.notes || ''
    });
    setCapitalModalOpen(true);
  };

  // Reload local state whenever parent data refreshes
  const reloadAccountingData = () => {
    setExpenses(fetchExpenses());
    setCapital(fetchProprietorCapital());
    setBankAccounts(fetchBankAccounts());
    if (refreshAllData) refreshAllData();
  };

    // Date Filtering Helper for Invoices (Robust parser handles all date formats)
  const filterInvoicesByPeriod = () => {
    const now = new Date();

    return invoices.filter(inv => {
      if (!inv || !inv.date) return false;
      if (period === 'ALL') return true;

      const invDate = parseInvoiceDate(inv.date);
      if (!invDate) return true; // If unparseable date, keep in report rather than dropping

      if (period === 'TODAY') {
        const todayStr = now.toISOString().split('T')[0];
        const dateStr = invDate.toISOString().split('T')[0];
        return dateStr === todayStr || (typeof inv.date === 'string' && inv.date.startsWith(todayStr));
      }

      if (period === 'WEEKLY') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return invDate >= weekAgo && invDate <= now;
      }

      if (period === 'MONTHLY') {
        const monthAgo = new Date();
        monthAgo.setDate(now.getDate() - 30);
        return invDate >= monthAgo && invDate <= now;
      }

      if (period === 'QUARTERLY') {
        const quarterAgo = new Date();
        quarterAgo.setDate(now.getDate() - 90);
        return invDate >= quarterAgo && invDate <= now;
      }

      if (period === 'YEARLY') {
        const yearAgo = new Date();
        yearAgo.setDate(now.getDate() - 365);
        return invDate >= yearAgo && invDate <= now;
      }

      if (period === 'CUSTOM') {
        let pass = true;
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          pass = pass && invDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          pass = pass && invDate <= end;
        }
        return pass;
      }

      return true;
    });
  };

  const filteredInvoices = useMemo(() => filterInvoicesByPeriod(), [invoices, period, startDate, endDate]);

  // Helper to identify Credit Notes / Sales Returns
  const isDocCreditNote = (inv) => {
    if (!inv) return false;
    return inv.documentType === 'out_refund' || 
           inv.isCreditNote === true || 
           (typeof inv.invoiceNo === 'string' && (inv.invoiceNo.startsWith('CN') || inv.invoiceNo.startsWith('RINV'))) ||
           inv.paymentMode === 'CREDIT_NOTE';
  };

  const regularInvoices = useMemo(() => filteredInvoices.filter(inv => !isDocCreditNote(inv)), [filteredInvoices]);
  const creditNotesInPeriod = useMemo(() => filteredInvoices.filter(inv => isDocCreditNote(inv)), [filteredInvoices]);

  // Aggregate Sales & Tax Metrics (Net of Credit Notes / Sales Returns)
  const grossSales = regularInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  const totalReturnsAmount = creditNotesInPeriod.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  const totalSales = Math.max(0, grossSales - totalReturnsAmount); // Net Sales Revenue
  const totalCollected = regularInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
  const totalUdhar = regularInvoices.reduce((sum, inv) => sum + (Number(inv.balanceAmount) || 0), 0);

  const regularCgst = regularInvoices.reduce((sum, inv) => sum + (Number(inv.cgst) || 0), 0);
  const regularSgst = regularInvoices.reduce((sum, inv) => sum + (Number(inv.sgst) || 0), 0);
  const regularIgst = regularInvoices.reduce((sum, inv) => sum + (Number(inv.igst) || 0), 0);

  const returnCgst = creditNotesInPeriod.reduce((sum, inv) => sum + (Number(inv.cgst) || 0), 0);
  const returnSgst = creditNotesInPeriod.reduce((sum, inv) => sum + (Number(inv.sgst) || 0), 0);
  const returnIgst = creditNotesInPeriod.reduce((sum, inv) => sum + (Number(inv.igst) || 0), 0);

  const totalCgst = Math.max(0, regularCgst - returnCgst);
  const totalSgst = Math.max(0, regularSgst - returnSgst);
  const totalIgst = Math.max(0, regularIgst - returnIgst);
  
  // Explicitly define totalTax
  const totalTax = totalCgst + totalSgst + totalIgst;

  const getInvTaxable = (inv) => Number(inv.taxableAmount || inv.taxableSubtotal || inv.subTotal || inv.subtotal || (Number(inv.grandTotal || 0) - (Number(inv.cgst || 0) + Number(inv.sgst || 0) + Number(inv.igst || 0)))) || 0;
  const grossTaxable = regularInvoices.reduce((sum, inv) => sum + getInvTaxable(inv), 0);
  const returnTaxable = creditNotesInPeriod.reduce((sum, inv) => sum + getInvTaxable(inv), 0);
  const netTaxableRevenue = Math.max(0, grossTaxable - returnTaxable);

  // Filter Expenses by selected Period
  const filteredExpenses = useMemo(() => {
    const now = new Date();

    return expenses.filter(exp => {
      if (!exp || !exp.date) return false;
      const expDate = new Date(exp.date);
      if (isNaN(expDate.getTime())) return false;

      if (period === 'ALL') return true;

      if (period === 'TODAY') {
        const todayStr = now.toISOString().split('T')[0];
        return exp.date.startsWith(todayStr);
      }

      if (period === 'WEEKLY') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return expDate >= weekAgo && expDate <= now;
      }

      if (period === 'MONTHLY') {
        const monthAgo = new Date();
        monthAgo.setDate(now.getDate() - 30);
        return expDate >= monthAgo && expDate <= now;
      }

      if (period === 'QUARTERLY') {
        const quarterAgo = new Date();
        quarterAgo.setDate(now.getDate() - 90);
        return expDate >= quarterAgo && expDate <= now;
      }

      if (period === 'YEARLY') {
        const yearAgo = new Date();
        yearAgo.setDate(now.getDate() - 365);
        return expDate >= yearAgo && expDate <= now;
      }

      if (period === 'CUSTOM') {
        let pass = true;
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          pass = pass && expDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          pass = pass && expDate <= end;
        }
        return pass;
      }

      return true;
    });
  }, [expenses, period, startDate, endDate]);

  // Expenses Breakdown by Type
  const directExpenses = filteredExpenses.filter(e => e.type === 'DIRECT');
  const operatingExpenses = filteredExpenses.filter(e => e.type === 'OPERATING');
  const personalDrawings = filteredExpenses.filter(e => e.type === 'DRAWING');

  const totalDirectExpenses = directExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalOperatingExpenses = operatingExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalPersonalDrawings = personalDrawings.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Profit & Loss (Trading A/c + Operating P&L) Calculations
  const pnlData = useMemo(() => {
    let totalCogsItems = 0;
    let totalDiscounts = 0;

    filteredInvoices.forEach(inv => {
      totalDiscounts += Number(inv.discount) || 0;
      (inv.items || []).forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        // Use exact lot-consumed original purchase rate, or fallback to current catalog rate
        const purchaseCost = (item.costPrice !== undefined && Number(item.costPrice) > 0)
          ? Number(item.costPrice)
          : (p ? Number(p.purchasePrice || 0) : (Number(item.price || 0) * 0.75));
        totalCogsItems += purchaseCost * (Number(item.qty) || 0);
      });
    });

    const grossRevenue = netTaxableRevenue;
    // Total COGS = Inward Purchase Cost of Items + Direct Expenses (Freight, Cartage, Loading)
    const totalCogs = totalCogsItems + totalDirectExpenses;
    const grossProfit = grossRevenue - totalCogs;
    const grossMarginPct = grossRevenue > 0 ? ((grossProfit / grossRevenue) * 100).toFixed(1) : '0.0';

    // Operating Profit & Loss
    const totalExpenses = totalOperatingExpenses;
    const netProfit = grossProfit - totalExpenses;
    const netMarginPct = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0.0';

    // Group operating expenses by category for itemized breakdown
    const expensesByCategory = {};
    operatingExpenses.forEach(exp => {
      const cat = exp.category || 'Other Operating Expense';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (Number(exp.amount) || 0);
    });

    return {
      grossSales: totalSales,
      discounts: totalDiscounts,
      netTaxableRevenue: grossRevenue,
      cogsItems: totalCogsItems,
      directExpenses: totalDirectExpenses,
      cogs: totalCogs,
      grossProfit,
      grossMarginPct,
      operatingExpenses: totalExpenses,
      expensesByCategory,
      netProfit,
      netMarginPct,
      isProfit: netProfit >= 0,
      netTaxCollected: totalTax,
      personalDrawings: totalPersonalDrawings
    };
  }, [filteredInvoices, products, netTaxableRevenue, totalSales, totalTax, totalDirectExpenses, totalOperatingExpenses, totalPersonalDrawings, operatingExpenses]);

  // Balance Sheet Calculations (Sole Proprietor Equity & Balance Check)
  const balanceSheetData = useMemo(() => {
    // 1. Stock Valuation @ Original Purchase Cost across all lots
    const totalClosingStockVal = getProductStockValuation().totalExGst;

    // 2. Sundry Debtors (Receivables / Market Udhar from Retailers)
    const sundryDebtors = parties.reduce((sum, p) => sum + Math.max(0, Number(p.balance) || 0), 0);

    // 3. Sundry Creditors (Suppliers / Vendors we owe money to)
    const sundryCreditors = parties.reduce((sum, p) => sum + Math.max(0, -(Number(p.balance) || 0)), 0);

    // 4. Live Bank Balances
    const totalBankBalances = bankAccounts.reduce((sum, b) => sum + (Number(b.balance) || 0), 0);

    // 5. Cash in Hand (Galla): Opening Cash + Cash Sales - Cash Expenses
    const cashCollected = invoices.filter(i => i.paymentMode === 'CASH' || !i.paymentMode).reduce((s, i) => s + (Number(i.paidAmount) || 0), 0);
    const cashExpensesPaid = expenses.filter(e => e.paymentMode === 'CASH').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const openingCash = Number(capital.openingCash ?? business?.openingCash) || 0;
    const cashInHand = Math.max(0, openingCash + cashCollected - cashExpensesPaid);

    // 6. Fixed Assets (Godown Racks, Vehicles, Computer & POS equipment)
    const fixedAssets = Number(capital.fixedAssets ?? business?.fixedAssets) || 0;

    // 7. Net GST Liability (Output tax payable to govt)
    const netGstPayable = Math.max(0, totalTax);

    // 8. Proprietor's Capital Account (Equity)
    const openingCap = Number(capital.openingCapital) || 0;
    const addCap = Number(capital.additionalCapital) || 0;
    const currentProfit = pnlData.netProfit;
    const drawings = totalPersonalDrawings;
    const closingCapital = openingCap + addCap + currentProfit - drawings;

    // Total Liabilities & Equity
    const totalLiabilities = closingCapital + sundryCreditors + netGstPayable;

    // Total Assets
    const totalCurrentAssets = totalClosingStockVal + sundryDebtors + cashInHand + totalBankBalances;
    const totalAssets = totalCurrentAssets + fixedAssets;

    const difference = Math.abs(totalAssets - totalLiabilities);

    return {
      openingCapital: openingCap,
      additionalCapital: addCap,
      currentProfit,
      drawings,
      closingCapital,
      sundryCreditors,
      netGstPayable,
      totalLiabilities,
      closingStock: totalClosingStockVal,
      sundryDebtors,
      cashInHand,
      bankBalances: totalBankBalances,
      fixedAssets,
      totalCurrentAssets,
      totalAssets,
      isBalanced: difference < 500, // Balanced within rounding tolerance
      difference
    };
  }, [products, parties, bankAccounts, invoices, expenses, business, totalTax, capital, pnlData.netProfit, totalPersonalDrawings]);

    // Multi-tier Intelligent Brand Resolver
  const resolveItemBrand = (item) => {
    // 1. Explicit valid brand on line item
    if (item.brand && item.brand.trim() && item.brand.trim().toLowerCase() !== 'general') {
      return canonicalizeBrand(item.brand);
    }
    // 2. Lookup by Product ID
    if (item.productId) {
      const matched = products.find(p => p.id === item.productId);
      if (matched && matched.brand && matched.brand.trim().toLowerCase() !== 'general') {
        return canonicalizeBrand(matched.brand);
      }
    }
    // 3. Lookup by SKU
    if (item.sku && item.sku.trim()) {
      const cleanSku = item.sku.trim().toLowerCase();
      const matched = products.find(p => p.sku && p.sku.trim().toLowerCase() === cleanSku);
      if (matched && matched.brand && matched.brand.trim().toLowerCase() !== 'general') {
        return canonicalizeBrand(matched.brand);
      }
    }
    // 4. Normalized Product Name match
    const itemNameNorm = normalizeText(item.name);
    if (itemNameNorm) {
      const matched = products.find(p => {
        const pNameNorm = normalizeText(p.name);
        return pNameNorm === itemNameNorm || (pNameNorm && (pNameNorm.includes(itemNameNorm) || itemNameNorm.includes(pNameNorm)));
      });
      if (matched && matched.brand && matched.brand.trim().toLowerCase() !== 'general') {
        return canonicalizeBrand(matched.brand);
      }
    }
    // 5. Keyword Heuristic for Parkash FMCG lineup
    const upperName = (item.name || '').toUpperCase();
    for (const kw of KNOWN_PARKASH_KEYWORDS) {
      if (upperName.includes(kw)) {
        return 'SIFI PARKASH';
      }
    }
    if (upperName.includes('RAVALGAON') || upperName.includes('PAN PASAND')) {
      return 'RAVALGAON';
    }
    if (upperName.includes('TOFFEEMAN') || upperName.includes('COFFEE BREAK')) {
      return 'TOFFEEMAN';
    }
    return 'General';
  };

  // Resolve item packaging unit & normalize loose pouch quantities for Chain Pouch products
  const resolveItemUnitInfo = (item) => {
    let matchedProd = null;
    if (item.productId && Array.isArray(products)) {
      matchedProd = products.find(p => p && p.id === item.productId);
    }
    if (!matchedProd && item.sku && item.sku.trim() && Array.isArray(products)) {
      matchedProd = products.find(p => p && p.sku && p.sku.trim().toLowerCase() === item.sku.trim().toLowerCase());
    }
    if (!matchedProd && item.name && Array.isArray(products)) {
      const n = normalizeText(item.name);
      matchedProd = products.find(p => {
        if (!p || !p.name) return false;
        const pn = normalizeText(p.name);
        return pn === n || (pn && (pn.includes(n) || n.includes(pn)));
      });
    }

    const prodUnit = matchedProd?.unit || '';
    const itemUnit = item.unit || '';
    const isChainPouch = prodUnit === 'Chain Pouch' || prodUnit === 'C. Pouch' || prodUnit === 'c. pouch' ||
                         itemUnit === 'Chain Pouch' || itemUnit === 'C. Pouch' || itemUnit === 'c. pouch';

    const rawUnit = isChainPouch ? 'C. Pouch' : (prodUnit || itemUnit || 'Pcs');
    const pouchesPerChain = Number(matchedProd?.pcsPerBox) > 1 
      ? Number(matchedProd.pcsPerBox) 
      : (matchedProd?.pcsPerCarton && matchedProd?.packsPerCarton && Number(matchedProd.packsPerCarton) > 0 
          ? Math.round(Number(matchedProd.pcsPerCarton) / Number(matchedProd.packsPerCarton)) 
          : 12);

    const rawQty = Number(item.qty) || 0;
    const rawAmt = Number(item.total) || (Number(item.price) * rawQty) || 0;
    const effectiveUnitPrice = rawQty > 0 ? (rawAmt / rawQty) : (Number(item.price) || 0);

    let normalizedQty = rawQty;
    if (isChainPouch) {
      // If effective unit price is < 40 and rawQty >= pouchesPerChain, it was stored in loose pouches!
      if (effectiveUnitPrice < 40 && rawQty >= pouchesPerChain) {
        normalizedQty = Math.round((rawQty / pouchesPerChain) * 10) / 10;
      }
    }

    return {
      isChainPouch,
      unit: isChainPouch ? 'C. Pouch' : rawUnit,
      qty: normalizedQty,
      amt: rawAmt,
      pouchesPerChain
    };
  };

  // 1. Brand Sales Breakdown with Complete Drill-Down
  const brandSalesMap = {};
  filteredInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      if (item.isSection || item.isNote) return;
      const bName = resolveItemBrand(item);
      const unitInfo = resolveItemUnitInfo(item);
      const qty = unitInfo.qty;
      const amt = unitInfo.amt;

      if (!brandSalesMap[bName]) {
        brandSalesMap[bName] = {
          name: bName,
          totalQty: 0,
          totalAmount: 0,
          productsMap: {},
          invoicesMap: {}
        };
      }
      brandSalesMap[bName].totalQty += qty;
      brandSalesMap[bName].totalAmount += amt;

      // Track item inside brand
      const prodKey = item.productId || item.name || 'item_' + Date.now();
      if (!brandSalesMap[bName].productsMap[prodKey]) {
        brandSalesMap[bName].productsMap[prodKey] = {
          id: item.productId,
          name: item.name || 'Unnamed Product',
          sku: item.sku || '-',
          qty: 0,
          amount: 0,
          rate: Number(item.price) || 0,
          unit: unitInfo.unit,
          isChainPouch: unitInfo.isChainPouch
        };
      }
      brandSalesMap[bName].productsMap[prodKey].qty += qty;
      brandSalesMap[bName].productsMap[prodKey].amount += amt;

      // Track invoice inside brand
      const invKey = inv.id || inv.invoiceNo || 'inv_' + Date.now();
      if (!brandSalesMap[bName].invoicesMap[invKey]) {
        brandSalesMap[bName].invoicesMap[invKey] = {
          id: inv.id,
          invoiceNo: inv.invoiceNo || '-',
          date: inv.date || '-',
          partyName: inv.partyName || inv.customerName || 'Cash Customer',
          grandTotal: Number(inv.grandTotal) || 0,
          state: inv.state || 'posted',
          paidAmount: Number(inv.paidAmount) || 0,
          balanceAmount: Number(inv.balanceAmount) || 0,
          brandQty: 0,
          brandAmount: 0,
          itemsCount: 0
        };
      }
      brandSalesMap[bName].invoicesMap[invKey].brandQty += qty;
      brandSalesMap[bName].invoicesMap[invKey].brandAmount += amt;
      brandSalesMap[bName].invoicesMap[invKey].itemsCount += 1;
    });
  });

  const totalBrandSales = Object.values(brandSalesMap).reduce((sum, b) => sum + b.totalAmount, 0);

  const brandBreakdown = Object.values(brandSalesMap).map(b => {
    const productsList = Object.values(b.productsMap).sort((p1, p2) => p2.amount - p1.amount);
    const invoicesList = Object.values(b.invoicesMap).sort((i1, i2) => {
      const d1 = parseInvoiceDate(i1.date)?.getTime() || 0;
      const d2 = parseInvoiceDate(i2.date)?.getTime() || 0;
      return d2 - d1;
    });
    return {
      name: b.name,
      productCount: productsList.length,
      ordersCount: invoicesList.length,
      totalQty: b.totalQty,
      totalAmount: b.totalAmount,
      sharePercent: totalBrandSales > 0 ? ((b.totalAmount / totalBrandSales) * 100).toFixed(1) : '0.0',
      productsList,
      invoicesList
    };
  }).sort((a, b) => b.totalAmount - a.totalAmount);

  // 2. Product Sales Breakdown (enhanced with Brand & packaging unit)
  const productSalesMap = {};
  filteredInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      if (item.isSection || item.isNote) return;
      const prodKey = item.productId || item.name;
      const unitInfo = resolveItemUnitInfo(item);
      if (!productSalesMap[prodKey]) {
        productSalesMap[prodKey] = {
          name: item.name,
          brand: resolveItemBrand(item),
          sku: item.sku || '-',
          totalQty: 0,
          totalAmount: 0,
          unit: unitInfo.unit,
          isChainPouch: unitInfo.isChainPouch
        };
      }
      productSalesMap[prodKey].totalQty += unitInfo.qty;
      productSalesMap[prodKey].totalAmount += unitInfo.amt;
    });
  });
  const topProducts = Object.values(productSalesMap).sort((a, b) => b.totalAmount - a.totalAmount);

  // 3. Party Sales Breakdown (enhanced with GSTIN, Paid amount, and Balance status)
  const partySalesMap = {};
  filteredInvoices.forEach(inv => {
    const key = (inv.partyName && inv.partyName.trim()) || 'Cash Customer';
    if (!partySalesMap[key]) {
      const matchedParty = parties.find(p => p.name && p.name.trim().toLowerCase() === key.toLowerCase());
      partySalesMap[key] = {
        name: key,
        phone: inv.partyPhone || matchedParty?.phone || '-',
        gstin: inv.partyGstin || matchedParty?.gstin || '-',
        billCount: 0,
        returnsCount: 0,
        grossSales: 0,
        returnsAmount: 0,
        totalSales: 0,
        totalBalance: 0
      };
    }
    const isCN = isDocCreditNote(inv);
    if (isCN) {
      partySalesMap[key].returnsCount += 1;
      partySalesMap[key].returnsAmount += Number(inv.grandTotal) || 0;
      partySalesMap[key].totalSales -= Number(inv.grandTotal) || 0;
    } else {
      partySalesMap[key].billCount += 1;
      partySalesMap[key].grossSales += Number(inv.grandTotal) || 0;
      partySalesMap[key].totalSales += Number(inv.grandTotal) || 0;
      partySalesMap[key].totalBalance += Number(inv.balanceAmount) || 0;
    }
  });
  const partyBreakdown = Object.values(partySalesMap).sort((a, b) => b.totalSales - a.totalSales);

  // CSV Exporters for Brand and Party Reports
  const handleExportBrandSalesCsv = () => {
    if (brandBreakdown.length === 0) {
      alert('No brand sales data to export for this period.');
      return;
    }
    const headers = ['#', 'Brand Name', 'Products Sold Count', 'Orders Count', 'Quantity Sold (Units)', 'Sales Revenue (INR)', 'Revenue Share (%)'];
    const rows = brandBreakdown.map((b, idx) => [
      idx + 1,
      `"${(b.name || '').replace(/"/g, '""')}"`,
      b.productCount,
      b.ordersCount,
      b.totalQty,
      b.totalAmount.toFixed(2),
      `${b.sharePercent}%`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Brand_Wise_Sales_Report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPartySalesCsv = () => {
    if (partyBreakdown.length === 0) {
      alert('No party sales data to export for this period.');
      return;
    }
    const headers = ['#', 'Party Name', 'Phone', 'GSTIN', 'Total Bills', 'Total Sales (INR)', 'Collected (INR)', 'Due Balance (INR)'];
    const rows = partyBreakdown.map((p, idx) => [
      idx + 1,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.phone || '-'}"`,
      `"${p.gstin || '-'}"`,
      p.billCount,
      p.totalSales.toFixed(2),
      (p.totalSales - p.totalBalance).toFixed(2),
      p.totalBalance.toFixed(2)
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Party_Wise_Sales_Report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // GSTR-1 & 3B Categorization (Regular Invoices only; Credit Notes go to Table 9B)
  const b2bInvoices = regularInvoices.filter(inv => inv.partyGstin && inv.partyGstin.trim().length >= 10 && inv.partyGstin.trim().toUpperCase() !== 'URP');
  const b2cInvoices = regularInvoices.filter(inv => !inv.partyGstin || inv.partyGstin.trim().length < 10 || inv.partyGstin.trim().toUpperCase() === 'URP');

  // HSN Summary Map
  const hsnMap = useMemo(() => {
    const map = {};
    regularInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const hsn = item.hsn || '1905';
        if (!map[hsn]) {
          map[hsn] = {
            hsn,
            description: item.name || 'General FMCG Item',
            uqc: item.unit || 'BOX',
            totalQty: 0,
            taxableValue: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0
          };
        }
        const qty = Number(item.qty) || 0;
        const taxVal = Number(item.total) || 0;
        const rate = item.gstRate !== undefined && item.gstRate !== null ? Number(item.gstRate) : 0;
        const itemTax = (taxVal * rate) / 100;

        map[hsn].totalQty += qty;
        map[hsn].taxableValue += taxVal;
        map[hsn].cgst += itemTax / 2;
        map[hsn].sgst += itemTax / 2;
        map[hsn].totalTax += itemTax;
      });
    });
    return Object.values(map);
  }, [filteredInvoices]);

  // Export GSTR-1 CSV (Table 4A B2B, Table 7 B2C Small, Table 12 HSN Summary)
  const handleExportGstr1Csv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += '--- GSTR-1 TABLE 4A: TAXABLE OUTWARD SUPPLIES TO REGISTERED PERSONS (B2B) ---\n';
    csvContent += 'Table,GSTIN of Recipient,Receiver Name,Invoice No,Invoice Date,Invoice Value,Place of Supply,Reverse Charge,Invoice Type,Rate (%),Taxable Value,CGST Amount,SGST Amount,IGST Amount,Cess Amount\n';

    // Table 4A: B2B Invoices
    b2bInvoices.forEach(inv => {
      const pos = inv.partyGstin ? inv.partyGstin.substring(0, 2) : '07';
      const taxable = getInvTaxable(inv);
      const rate = inv.items?.[0]?.gstRate !== undefined ? Number(inv.items[0].gstRate) : 0;
      csvContent += `4A,"${inv.partyGstin}","${inv.partyName || inv.customerName}","${inv.invoiceNo}","${inv.date?.split('T')[0]}",${Number(inv.grandTotal || 0).toFixed(2)},"${pos}-State",N,Regular,${rate},${taxable.toFixed(2)},${Number(inv.cgst || 0).toFixed(2)},${Number(inv.sgst || 0).toFixed(2)},${Number(inv.igst || 0).toFixed(2)},0.00\n`;
    });

    csvContent += '\n--- GSTR-1 TABLE 7: TAXABLE SUPPLIES TO UNREGISTERED PERSONS (B2C SMALL) ---\n';
    csvContent += 'Table,Type,Place of Supply,Rate (%),Taxable Value,CGST Amount,SGST Amount,IGST Amount,Cess Amount\n';

    // Table 7: B2C Small Invoices
    b2cInvoices.forEach(inv => {
      const taxable = getInvTaxable(inv);
      const rate = inv.items?.[0]?.gstRate !== undefined ? Number(inv.items[0].gstRate) : 0;
      csvContent += `7,OE,"07-Delhi",${rate},${taxable.toFixed(2)},${Number(inv.cgst || 0).toFixed(2)},${Number(inv.sgst || 0).toFixed(2)},${Number(inv.igst || 0).toFixed(2)},0.00\n`;
    });

    // Table 9B: Credit / Debit Notes (CDNR & CDNUR)
    csvContent += '\n--- GSTR-1 TABLE 9B: CREDIT / DEBIT NOTES (REGISTERED & UNREGISTERED) ---\n';
    csvContent += 'Table,Type,Note No,Note Date,Original Invoice No,Party Name,GSTIN,Note Value,Rate (%),Taxable Value,CGST Amount,SGST Amount,IGST Amount,Cess Amount\n';

    creditNotesInPeriod.forEach(cn => {
      const taxable = getInvTaxable(cn);
      const rate = cn.items?.[0]?.gstRate !== undefined ? Number(cn.items[0].gstRate) : 5;
      csvContent += `9B,C,"${cn.invoiceNo}","${cn.date?.split('T')[0]}","${cn.reversalOf || 'INV-000'}","${cn.partyName || cn.customerName}","${cn.partyGstin || 'URP'}",${Number(cn.grandTotal || 0).toFixed(2)},${rate},${taxable.toFixed(2)},${Number(cn.cgst || 0).toFixed(2)},${Number(cn.sgst || 0).toFixed(2)},${Number(cn.igst || 0).toFixed(2)},0.00\n`;
    });

    csvContent += '\n--- GSTR-1 TABLE 12: HSN SUMMARY OF OUTWARD SUPPLIES ---\n';
    csvContent += 'Table,HSN Code,Description,UQC,Total Quantity,Total Value,Taxable Value,Integrated Tax Amount,Central Tax Amount,State Tax Amount,Cess Amount\n';

    // Table 12: HSN Summary
    hsnMap.forEach(h => {
      csvContent += `12,"${h.hsn}","${h.description}","${h.uqc}",${h.totalQty},${(h.taxableValue + h.totalTax).toFixed(2)},${h.taxableValue.toFixed(2)},${h.igst.toFixed(2)},${h.cgst.toFixed(2)},${h.sgst.toFixed(2)},0.00\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GSTR1_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Day Book Data for Selected Date
  const dayBookData = useMemo(() => {
    const dayInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(dayBookDate));
    const dayBankTxs = bankTransactions.filter(tx => tx.date && tx.date.startsWith(dayBookDate));

    const dayCashSales = dayInvoices.filter(inv => inv.paymentMode === 'CASH' || !inv.paymentMode).reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
    const dayUpiSales = dayInvoices.filter(inv => inv.paymentMode === 'UPI').reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
    const dayBankSales = dayInvoices.filter(inv => inv.paymentMode === 'NEFT' || inv.paymentMode === 'CHEQUE').reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
    const dayCreditSales = dayInvoices.reduce((sum, inv) => sum + (Number(inv.balanceAmount) || 0), 0);
    const dayTotalTurnover = dayInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);

    return {
      dayInvoices,
      dayBankTxs,
      dayCashSales,
      dayUpiSales,
      dayBankSales,
      dayCreditSales,
      dayTotalTurnover
    };
  }, [invoices, bankTransactions, dayBookDate]);

  // Stock Valuation Data
  const stockValuationData = useMemo(() => {
    let filteredProducts = products;
    if (selectedStockWarehouse !== 'ALL') {
      filteredProducts = products.filter(p => (p.warehouseId || 'WH-MAIN') === selectedStockWarehouse);
    }

    let totalUnits = 0;
    let totalPurchaseVal = 0;
    let totalSaleVal = 0;

    const list = filteredProducts.map(p => {
      const stock = Number(p.currentStock) || 0;
      const prodVal = getProductStockValuation(p.id);
      const pPrice = prodVal.avgUnitCostExGst > 0 ? prodVal.avgUnitCostExGst : (Number(p.purchasePrice) || 0);
      const sPrice = Number(p.salePrice || p.price || 0);
      const costVal = prodVal.totalExGst > 0 ? prodVal.totalExGst : (stock * pPrice);
      const saleVal = stock * sPrice;
      const potentialProfit = saleVal - costVal;
      const marginPct = saleVal > 0 ? ((potentialProfit / saleVal) * 100).toFixed(1) : '0.0';

      totalUnits += stock;
      totalPurchaseVal += costVal;
      totalSaleVal += saleVal;

      return {
        ...p,
        stock,
        purchasePrice: pPrice,
        costVal,
        saleVal,
        potentialProfit,
        marginPct,
        activeLotsCount: prodVal.activeLotsCount
      };
    });

    const potentialGrossProfit = totalSaleVal - totalPurchaseVal;

    return {
      list: list.sort((a, b) => b.costVal - a.costVal),
      totalUnits,
      totalPurchaseVal,
      totalSaleVal,
      potentialGrossProfit
    };
  }, [products, selectedStockWarehouse]);

  // Handle Save Expense
  const handleSaveExpense = (e) => {
    e.preventDefault();
    if (!expenseFormData.amount || Number(expenseFormData.amount) <= 0) {
      alert('Please enter a valid expense amount!');
      return;
    }

    saveExpense(expenseFormData);
    reloadAccountingData();
    setExpenseModalOpen(false);
    setExpenseFormData(initialExpenseState);
  };

  // Handle Delete Expense
  const handleDeleteExpense = (id) => {
    if (window.confirm('Are you sure you want to delete this expense voucher?')) {
      deleteExpense(id);
      reloadAccountingData();
    }
  };

  // Handle Save Capital
  const handleSaveCapital = (e) => {
    e.preventDefault();
    saveProprietorCapital(capitalFormData);
    reloadAccountingData();
    setCapitalModalOpen(false);
  };

  // Period Text Header
  const getPeriodLabel = () => {
    switch (period) {
      case 'TODAY': return "Today's Report";
      case 'WEEKLY': return 'Weekly Report (Last 7 Days)';
      case 'MONTHLY': return 'Monthly Report (Last 30 Days)';
      case 'QUARTERLY': return 'Quarterly Report (Last 90 Days)';
      case 'YEARLY': return 'Yearly Report (Last 1 Year)';
      case 'CUSTOM': return `Custom Period (${startDate || 'Start'} to ${endDate || 'Today'})`;
      default: return 'All Time Report';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* MODULE REPORT TABS & ACTIONS (Dropdown Selector) */}
      <div className="glass-card no-print" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <TrendingUp size={17} color="var(--primary)" />
            <span>Select Report:</span>
          </label>
          <select 
            className="input-field select-field"
            value={
              reportTab === 'SALES' 
                ? (salesViewMode === 'BRAND' ? 'BRAND_SALES' : salesViewMode === 'PARTY' ? 'PARTY_SALES' : salesViewMode === 'PRODUCT' ? 'PRODUCT_SALES' : 'SALES')
                : reportTab
            } 
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'ACTION_EXPENSE') {
                setExpenseModalOpen(true);
              } else if (val === 'ACTION_CAPITAL') {
                handleOpenCapitalModal();
              } else if (val === 'BRAND_SALES') {
                setReportTab('SALES');
                setSalesViewMode('BRAND');
              } else if (val === 'PARTY_SALES') {
                setReportTab('SALES');
                setSalesViewMode('PARTY');
              } else if (val === 'PRODUCT_SALES') {
                setReportTab('SALES');
                setSalesViewMode('PRODUCT');
              } else if (val === 'SALES') {
                setReportTab('SALES');
                setSalesViewMode('ALL');
              } else {
                setReportTab(val);
              }
            }}
            style={{ 
              fontWeight: '700', 
              fontSize: '0.88rem', 
              minWidth: '260px', 
              maxWidth: '380px',
              flex: 1,
              padding: '8px 36px 8px 12px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <optgroup label="📊 Sales & Performance Reports">
              <option value="SALES">📈 All Sales Analytics</option>
              <option value="BRAND_SALES">🏷️ Brand-wise Sales Report</option>
              <option value="PARTY_SALES">👥 Party-wise Sales Report</option>
              <option value="PRODUCT_SALES">📦 Product-wise Sales Report</option>
            </optgroup>
            <optgroup label="💼 Financial & Accounting Reports">
              <option value="PNL">🥧 Trading & P&L</option>
              <option value="BALANCESHEET">⚖️ Balance Sheet</option>
              <option value="EXPENSES">🧾 Expenses & Drawings</option>
              <option value="GST">🛡️ GST Returns (GSTR-1 & 3B)</option>
              <option value="DAYBOOK">📖 Day Book</option>
              <option value="STOCK">📦 Stock Valuation</option>
            </optgroup>
            <optgroup label="⚡ Accounting Actions">
              <option value="ACTION_EXPENSE">➕ + Expense / Drawing</option>
              <option value="ACTION_CAPITAL">💼 Capital Account</option>
            </optgroup>
          </select>
        </div>

        {/* Action Controls: Actions Dropdown Menu */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
            className="btn btn-secondary btn-sm"
            style={{ gap: '6px', padding: '8px 14px', fontSize: '0.82rem', fontWeight: '700' }}
          >
            <Plus size={15} color="var(--primary)" />
            <span>Actions</span>
            <ChevronDown size={14} />
          </button>

          {actionsMenuOpen && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                onClick={() => setActionsMenuOpen(false)} 
              />
              <div 
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  background: '#fff',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  border: '1px solid var(--border-color)',
                  zIndex: 50,
                  minWidth: '220px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <button
                  type="button"
                  onClick={() => { setActionsMenuOpen(false); setExpenseModalOpen(true); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    color: 'var(--text-main)',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Plus size={15} color="#059669" />
                  <span>+ Expense / Drawing</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActionsMenuOpen(false); handleOpenCapitalModal(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'transparent',
                    borderTop: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    color: 'var(--text-main)',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Briefcase size={15} color="#2563eb" />
                  <span>Capital Account</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* PERIOD SELECTOR & ACTIONS (Hidden for DayBook & Stock) */}
      {(reportTab === 'SALES' || reportTab === 'PNL' || reportTab === 'BALANCESHEET' || reportTab === 'EXPENSES' || reportTab === 'GST') && (
        <div className="glass-card no-print" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', flex: 1 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '2px' }}>
              <Calendar size={15} />
              Period:
            </span>

            <button type="button" onClick={() => setPeriod('TODAY')} className={`btn btn-sm ${period === 'TODAY' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>Today</button>
            <button type="button" onClick={() => setPeriod('WEEKLY')} className={`btn btn-sm ${period === 'WEEKLY' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>Weekly</button>
            <button type="button" onClick={() => setPeriod('MONTHLY')} className={`btn btn-sm ${period === 'MONTHLY' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>Monthly</button>
            <button type="button" onClick={() => setPeriod('QUARTERLY')} className={`btn btn-sm ${period === 'QUARTERLY' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>Quarterly</button>
            <button type="button" onClick={() => setPeriod('YEARLY')} className={`btn btn-sm ${period === 'YEARLY' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>Yearly</button>
            <button type="button" onClick={() => setPeriod('ALL')} className={`btn btn-sm ${period === 'ALL' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>All</button>
            <button type="button" onClick={() => setPeriod('CUSTOM')} className={`btn btn-sm ${period === 'CUSTOM' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>Custom</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {reportTab === 'GST' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)' }}>Month:</span>
                <input 
                  type="month" 
                  value={gstFpMonth} 
                  onChange={(e) => setGstFpMonth(e.target.value)} 
                  className="input-field" 
                  style={{ padding: '4px 8px', fontSize: '0.8rem', fontWeight: '700', width: 'auto' }} 
                />
              </div>
            )}
            {reportTab === 'GST' && (
              <button 
                type="button" 
                onClick={handleExportGstr1Csv} 
                className="btn btn-secondary" 
                style={{ gap: '6px', padding: '6px 14px', fontWeight: '700', fontSize: '0.82rem', color: '#059669', borderColor: '#a7f3d0' }}
              >
                <Download size={15} />
                <span>GSTR-1 CSV Export</span>
              </button>
            )}

            <button 
              type="button" 
              onClick={() => window.print()} 
              className="btn btn-primary" 
              style={{ gap: '6px', padding: '6px 14px', fontWeight: '700', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
            >
              <Printer size={15} />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM DATE RANGE PICKER */}
      {period === 'CUSTOM' && (reportTab === 'SALES' || reportTab === 'PNL' || reportTab === 'BALANCESHEET' || reportTab === 'EXPENSES' || reportTab === 'GST') && (
        <div className="glass-card no-print" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Start Date:</label>
            <input type="date" className="input-field" style={{ width: 'auto' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>End Date:</label>
            <input type="date" className="input-field" style={{ width: 'auto' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      )}

      {/* PRINTABLE CANVAS */}
      <div className="print-area" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Printable Official Header */}
        <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                {business?.name || 'JAI MAA SHARDEY ENTERPRISES'}
              </h2>
              {business?.address && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  {business.address}
                </p>
              )}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '2px 0 0 0' }}>
                {business?.gstin ? `GSTIN: ${business.gstin} • ` : ''}
                {business?.phone ? `Phone: ${business.phone}` : ''}
                {business?.proprietor ? ` • Proprietor: ${business.proprietor}` : ''}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="badge badge-info" style={{ fontSize: '0.85rem', padding: '6px 12px', fontWeight: '800' }}>
                {reportTab === 'SALES' && (
                  salesViewMode === 'BRAND' ? `🏷️ Brand-Wise Sales Report • ${getPeriodLabel()}` :
                  salesViewMode === 'PARTY' ? `👥 Party-Wise Sales Report • ${getPeriodLabel()}` :
                  salesViewMode === 'PRODUCT' ? `📦 Product-Wise Sales Report • ${getPeriodLabel()}` :
                  `📊 Sales Analytics • ${getPeriodLabel()}`
                )}
                {reportTab === 'PNL' && `📈 Trading & P&L Statement • ${getPeriodLabel()}`}
                {reportTab === 'BALANCESHEET' && `⚖️ Balance Sheet • As on ${new Date().toLocaleDateString('en-IN')}`}
                {reportTab === 'EXPENSES' && `🧾 Expenses & Drawings Ledger • ${getPeriodLabel()}`}
                {reportTab === 'GST' && `🏛️ GST Returns • ${getPeriodLabel()}`}
                {reportTab === 'DAYBOOK' && `📖 Day Book • ${dayBookDate}`}
                {reportTab === 'STOCK' && `📦 Stock Valuation • ${new Date().toLocaleDateString('en-IN')}`}
              </span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Date: {new Date().toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: SALES & PRODUCT ANALYTICS */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'SALES' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Sales Revenue (With Tax)</span>
                  <TrendingUp size={20} color="#10b981" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                  ₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {filteredInvoices.length} Invoices Issued (Gross)
                </p>
              </div>

              <div className="glass-card" style={{ padding: '18px', border: '1px solid #38bdf8' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Sales Taxable Value</span>
                  <FileText size={20} color="#0284c7" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0284c7', margin: 0 }}>
                  ₹{netTaxableRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Without Tax (Base Value)
                </p>
              </div>

              <div className="glass-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Collected Cash</span>
                  <IndianRupee size={20} color="#34d399" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#34d399', margin: 0 }}>
                  ₹{totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Cash & Direct Receipts
                </p>
              </div>

              <div className="glass-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Market Outstanding Dues</span>
                  <IndianRupee size={20} color="#fbbf24" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fbbf24', margin: 0 }}>
                  ₹{totalUdhar.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Unpaid retailer credit balance
                </p>
              </div>

              <div className="glass-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>GST Tax Collection</span>
                  <ShieldCheck size={20} color="#818cf8" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#818cf8', margin: 0 }}>
                  ₹{totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  CGST: ₹{totalCgst.toFixed(2)} | SGST: ₹{totalSgst.toFixed(2)} | IGST: ₹{totalIgst.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Sub-Navigation Buttons for Sales Reports */}
            <div className="no-print" style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              gap: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                  Sales Report View:
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSalesViewMode('ALL')}
                  className={`btn btn-sm ${salesViewMode === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700', borderRadius: '6px' }}
                >
                  📊 All Sales Reports
                </button>
                <button
                  type="button"
                  onClick={() => setSalesViewMode('BRAND')}
                  className={`btn btn-sm ${salesViewMode === 'BRAND' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700', borderRadius: '6px' }}
                >
                  🏷️ Brand-Wise Sales ({brandBreakdown.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSalesViewMode('PARTY')}
                  className={`btn btn-sm ${salesViewMode === 'PARTY' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700', borderRadius: '6px' }}
                >
                  👥 Party-Wise Sales ({partyBreakdown.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSalesViewMode('PRODUCT')}
                  className={`btn btn-sm ${salesViewMode === 'PRODUCT' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700', borderRadius: '6px' }}
                >
                  📦 Product-Wise Sales ({topProducts.length})
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                            {/* 1. BRAND-WISE SALES REPORT TABLE & DRILL-DOWN */}
              {(salesViewMode === 'ALL' || salesViewMode === 'BRAND') && (
                <div className="glass-card" style={{ padding: '20px' }}>
                  
                  {/* Top Bar: Title & Stats */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Tag size={20} color="var(--primary)" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                          Brand-wise Sales Performance
                        </h3>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {period === 'ALL' ? 'Showing All Bills (No Cutoff)' : `Period: ${period}`} • {filteredInvoices.length} Bills Analyzed
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', background: 'var(--bg-secondary, #f8fafc)', padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        Total Brand Sales: <strong style={{ color: '#059669', fontSize: '0.92rem' }}>₹{totalBrandSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleExportBrandSalesCsv}
                        className="btn btn-secondary btn-sm no-print"
                        style={{ gap: '6px', padding: '5px 12px', fontSize: '0.78rem', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                        title="Download Brand Sales Summary CSV"
                      >
                        <Download size={14} />
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Bar & Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                      <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input 
                        type="text"
                        className="input-field"
                        placeholder="Search brand name or product (e.g. Parkash, Koopa, Finger, Clap)..."
                        value={brandSearchQuery}
                        onChange={(e) => setBrandSearchQuery(e.target.value)}
                        style={{ paddingLeft: '32px', fontSize: '0.84rem' }}
                      />
                    </div>
                    {brandSearchQuery && (
                      <button 
                        type="button" 
                        onClick={() => setBrandSearchQuery('')} 
                        className="btn btn-sm btn-secondary" 
                        style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                      >
                        Clear Search
                      </button>
                    )}
                  </div>

                  {/* DETAIL DRILL-DOWN MODAL / PANEL */}
                  {selectedBrandDetail ? (
                    <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '10px', padding: '16px', border: '1.5px solid var(--primary)', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedBrandDetail(null)}
                            className="btn btn-secondary btn-sm"
                            style={{ gap: '6px', padding: '5px 10px', fontSize: '0.8rem', fontWeight: '700' }}
                          >
                            <ArrowLeft size={14} />
                            <span>All Brands</span>
                          </button>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>🏷️ {selectedBrandDetail.name}</span>
                              <span style={{ fontSize: '0.75rem', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>
                                {selectedBrandDetail.sharePercent}% Share
                              </span>
                            </h4>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Total Sold: <strong>{selectedBrandDetail.totalQty} Units</strong> • Revenue: <strong style={{ color: '#059669' }}>₹{selectedBrandDetail.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Drill-down Sub-tabs */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setBrandDetailTab('PRODUCTS')}
                            className={`btn btn-sm ${brandDetailTab === 'PRODUCTS' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '5px 12px', fontSize: '0.8rem', fontWeight: '700' }}
                          >
                            📦 Products ({selectedBrandDetail.productsList.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setBrandDetailTab('INVOICES')}
                            className={`btn btn-sm ${brandDetailTab === 'INVOICES' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '5px 12px', fontSize: '0.8rem', fontWeight: '700' }}
                          >
                            📄 Bills & Invoices ({selectedBrandDetail.invoicesList.length})
                          </button>
                        </div>
                      </div>

                      {/* Tab 1: Products under Brand */}
                      {brandDetailTab === 'PRODUCTS' && (
                        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: '#475569' }}>
                                <th style={{ padding: '8px 10px' }}>#</th>
                                <th style={{ padding: '8px 10px' }}>Product Name</th>
                                <th style={{ padding: '8px 10px' }}>SKU</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Units Sold</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Avg Rate (₹)</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Revenue (₹)</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>% Share in Brand</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedBrandDetail.productsList.map((prod, pIdx) => {
                                const prodShare = selectedBrandDetail.totalAmount > 0 
                                  ? ((prod.amount / selectedBrandDetail.totalAmount) * 100).toFixed(1) 
                                  : '0.0';
                                return (
                                  <tr key={pIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: '700', color: 'var(--primary)' }}>{pIdx + 1}</td>
                                    <td style={{ padding: '8px 10px', fontWeight: '700', color: 'var(--text-main)' }}>{prod.name}</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{prod.sku}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700' }}>
                                      <span>{prod.qty}</span>
                                      {prod.unit && (
                                        <span style={{ 
                                          marginLeft: '6px', 
                                          fontSize: '0.72rem', 
                                          fontWeight: '700',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          background: prod.isChainPouch ? '#ecfdf5' : '#f1f5f9',
                                          color: prod.isChainPouch ? '#059669' : '#475569',
                                          border: prod.isChainPouch ? '1px solid #a7f3d0' : '1px solid #cbd5e1'
                                        }}>
                                          {prod.unit}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{(prod.qty > 0 ? (prod.amount / prod.qty) : prod.rate).toFixed(2)}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>₹{prod.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#2563eb' }}>{prodShare}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Tab 2: Invoices under Brand */}
                      {brandDetailTab === 'INVOICES' && (
                        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: '#475569' }}>
                                <th style={{ padding: '8px 10px' }}>Invoice #</th>
                                <th style={{ padding: '8px 10px' }}>Date</th>
                                <th style={{ padding: '8px 10px' }}>Customer / Party</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Brand Items</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Brand Qty Sold</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Brand Sales (₹)</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Full Bill Total (₹)</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedBrandDetail.invoicesList.map((bill, bIdx) => (
                                <tr key={bIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px 10px', fontWeight: '800', color: 'var(--primary)' }}>
                                    #{bill.invoiceNo}
                                  </td>
                                  <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                                    {bill.date ? bill.date.split('T')[0] : '-'}
                                  </td>
                                  <td style={{ padding: '8px 10px', fontWeight: '700', color: 'var(--text-main)' }}>
                                    {bill.partyName}
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600' }}>
                                    {bill.itemsCount} lines
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700' }}>
                                    {bill.brandQty} Pcs
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                                    ₹{bill.brandAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                                    ₹{bill.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                    <span style={{ 
                                      padding: '2px 8px', 
                                      borderRadius: '10px', 
                                      fontSize: '0.72rem', 
                                      fontWeight: '800',
                                      background: bill.balanceAmount <= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: bill.balanceAmount <= 0 ? '#059669' : '#dc2626'
                                    }}>
                                      {bill.balanceAmount <= 0 ? 'PAID' : 'DUE'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* MAIN BRANDS SUMMARY TABLE */}
                  {(() => {
                    const filteredBrands = brandBreakdown.filter(b => {
                      if (!brandSearchQuery) return true;
                      const q = brandSearchQuery.toLowerCase();
                      return b.name.toLowerCase().includes(q) || b.productsList.some(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
                    });

                    if (filteredBrands.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                          <p style={{ fontWeight: '600', marginBottom: '8px' }}>No brand sales records found for this criteria.</p>
                          <span style={{ fontSize: '0.8rem' }}>Try switching Period to <strong>"All"</strong> or clearing your search filter.</span>
                        </div>
                      );
                    }

                    return (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                              <th style={{ padding: '10px 8px' }}>#</th>
                              <th style={{ padding: '10px 8px' }}>Brand Name</th>
                              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Distinct Products</th>
                              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Orders Count</th>
                              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Quantity Sold (Units)</th>
                              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Total Sales (₹)</th>
                              <th style={{ padding: '10px 8px', width: '180px' }}>Revenue Share (%)</th>
                              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBrands.map((brand, idx) => (
                              <tr 
                                key={idx} 
                                style={{ 
                                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s'
                                }}
                                onClick={() => setSelectedBrandDetail(brand)}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <td style={{ padding: '10px 8px', fontWeight: '700', color: 'var(--primary)' }}>#{idx + 1}</td>
                                <td style={{ padding: '10px 8px', fontWeight: '700', color: 'var(--text-main)' }}>
                                  <span style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '6px',
                                    background: brand.name.includes('PARKASH') ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.05)',
                                    color: brand.name.includes('PARKASH') ? '#059669' : 'inherit',
                                    padding: '4px 10px', 
                                    borderRadius: '6px',
                                    border: brand.name.includes('PARKASH') ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                                    fontWeight: '800'
                                  }}>
                                    🏷️ {brand.name}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600' }}>{brand.productCount}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600' }}>{brand.ordersCount}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '700' }}>{brand.totalQty}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>
                                  ₹{brand.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '10px 8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ flex: 1, height: '7px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ 
                                        width: `${Math.min(100, Math.max(0, brand.sharePercent))}%`, 
                                        height: '100%', 
                                        background: brand.name.includes('PARKASH') ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #10b981)',
                                        borderRadius: '4px' 
                                      }} />
                                    </div>
                                    <span style={{ fontSize: '0.78rem', fontWeight: '700', minWidth: '44px', textAlign: 'right' }}>
                                      {brand.sharePercent}%
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBrandDetail(brand);
                                    }}
                                    className="btn btn-secondary btn-sm"
                                    style={{ gap: '4px', padding: '3px 8px', fontSize: '0.75rem', fontWeight: '700' }}
                                    title="View items and invoices in this brand"
                                  >
                                    <Eye size={13} color="var(--primary)" />
                                    <span>Details</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 2. PARTY-WISE SALES & UDHAR BREAKDOWN TABLE */}
              {(salesViewMode === 'ALL' || salesViewMode === 'PARTY') && (
                <div className="glass-card" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={20} color="var(--primary)" />
                      <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>
                        Party-wise Sales & Udhar Breakdown
                      </h3>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                        {partyBreakdown.length} Parties
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={handleExportPartySalesCsv}
                        className="btn btn-secondary btn-sm no-print"
                        style={{ gap: '5px', padding: '4px 10px', fontSize: '0.78rem', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                        title="Download Party Sales as Excel/CSV"
                      >
                        <Download size={13} />
                        <span>Party CSV</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '8px' }}>#</th>
                          <th style={{ padding: '8px' }}>Party / Customer Name</th>
                          <th style={{ padding: '8px' }}>Phone</th>
                          <th style={{ padding: '8px' }}>GSTIN</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Total Bills</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Total Sales (₹)</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Collected (₹)</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Due Balance (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partyBreakdown.map((party, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>#{idx + 1}</td>
                            <td style={{ padding: '8px', fontWeight: '700', color: 'var(--text-main)' }}>{party.name}</td>
                            <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{party.phone}</td>
                            <td style={{ padding: '8px', color: 'var(--text-dim)', fontSize: '0.78rem', fontFamily: 'monospace' }}>{party.gstin}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{party.billCount}</span>
                              {party.returnsCount > 0 && (
                                <div style={{ fontSize: '0.70rem', color: '#ef4444', fontWeight: '700', marginTop: '2px' }}>
                                  ({party.returnsCount} Return CN)
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <div style={{ fontWeight: '800', color: 'var(--text-main)' }}>
                                ₹{party.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </div>
                              {party.returnsCount > 0 && (
                                <div style={{ fontSize: '0.70rem', color: '#64748b', marginTop: '2px' }}>
                                  Gross: ₹{party.grossSales.toFixed(2)} | Ret: -₹{party.returnsAmount.toFixed(2)}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                              ₹{Math.max(0, party.totalSales - party.totalBalance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: party.totalBalance > 0 ? '#f59e0b' : '#10b981' }}>
                              ₹{party.totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. PRODUCT-WISE SALES PERFORMANCE TABLE */}
              {(salesViewMode === 'ALL' || salesViewMode === 'PRODUCT') && (
                <div className="glass-card" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Award size={20} color="var(--primary)" />
                      <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>
                        Product-wise Sales Performance
                      </h3>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                        {topProducts.length} Items
                      </span>
                    </div>
                  </div>

                  {topProducts.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No sales records found for this period.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '8px' }}>#</th>
                            <th style={{ padding: '8px' }}>Product Name</th>
                            <th style={{ padding: '8px' }}>Brand</th>
                            <th style={{ padding: '8px' }}>SKU</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>Quantity Sold (Units)</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Total Sales (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topProducts.map((prod, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>#{idx + 1}</td>
                              <td style={{ padding: '8px', fontWeight: '700', color: 'var(--text-main)' }}>{prod.name}</td>
                              <td style={{ padding: '8px' }}>
                                <span style={{ 
                                  display: 'inline-block',
                                  fontSize: '0.75rem',
                                  background: 'rgba(255,255,255,0.05)',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  color: 'var(--text-muted)'
                                }}>
                                  🏷️ {prod.brand || 'General'}
                                </span>
                              </td>
                              <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{prod.sku}</td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>
                                <span>{prod.totalQty}</span>
                                {prod.unit && (
                                  <span style={{ 
                                    marginLeft: '6px', 
                                    fontSize: '0.72rem', 
                                    fontWeight: '700',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    background: prod.isChainPouch ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                    color: prod.isChainPouch ? '#10b981' : 'var(--text-muted)',
                                    border: prod.isChainPouch ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
                                  }}>
                                    {prod.unit}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>
                                ₹{prod.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: SOLE PROPRIETOR TRADING & PROFIT-LOSS ACCOUNT */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'PNL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* P&L Metric Highlights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Net Taxable Sales</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)', margin: '6px 0 0 0' }}>
                  ₹{pnlData.netTaxableRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Discounts: ₹{pnlData.discounts.toLocaleString('en-IN')}</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #059669' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Gross Profit</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#059669', margin: '6px 0 0 0' }}>
                  ₹{pnlData.grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: '700' }}>Margin: {pnlData.grossMarginPct}%</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Operating Expenses</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#d97706', margin: '6px 0 0 0' }}>
                  ₹{pnlData.operatingExpenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Rent, Salaries, Logistics & Utilities</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: `4px solid ${pnlData.isProfit ? '#10b981' : '#ef4444'}` }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Net Profit / Loss</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: pnlData.isProfit ? '#10b981' : '#dc2626', margin: '6px 0 0 0' }}>
                  ₹{pnlData.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: pnlData.isProfit ? '#059669' : '#dc2626', fontWeight: '700' }}>
                  Net Margin: {pnlData.netMarginPct}% • {pnlData.isProfit ? 'PROFIT' : 'LOSS'}
                </span>
              </div>
            </div>

            {/* Comprehensive Trading & Profit & Loss Statement Table */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                    Sole Proprietor Trading & Profit-Loss Account
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    GAAP / Income Tax Compliant • For the period: {getPeriodLabel()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setExpenseModalOpen(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: '4px', fontSize: '0.78rem' }}
                  >
                    <Plus size={14} />
                    <span>Add Expense</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="btn btn-primary btn-sm"
                    style={{ gap: '4px', fontSize: '0.78rem' }}
                  >
                    <Printer size={14} />
                    <span>Print P&L</span>
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <tbody>
                    {/* --- PART 1: TRADING ACCOUNT --- */}
                    <tr style={{ background: '#f8fafc', fontWeight: '800', borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px' }} colSpan="2">PART I: TRADING ACCOUNT - DIRECT OPERATIONS</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>Amount (₹)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 24px' }}>1. Gross Invoice Revenue</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{filteredInvoices.length} Bills Issued</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 24px' }}>2. Less: Customer Discounts Allowed</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Direct Scheme/Bill Off</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>- ₹{pnlData.discounts.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', fontWeight: '700', background: '#f0fdf4' }}>
                      <td style={{ padding: '12px 24px', color: '#166534' }}>Net Taxable Turnover</td>
                      <td></td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#166534', fontSize: '1.05rem' }}>₹{pnlData.netTaxableRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 24px' }}>3. Less: Cost of Goods Sold (Inward Item Costs)</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Direct Wholesale Rate</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>- ₹{pnlData.cogsItems.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 24px' }}>4. Less: Direct Inward Expenses (Freight & Cartage)</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading, Transport & Packaging</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>- ₹{pnlData.directExpenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ background: '#ecfdf5', fontWeight: '800', borderBottom: '2px solid #059669' }}>
                      <td style={{ padding: '14px 24px', fontSize: '1.05rem', color: '#065f46' }}>
                        GROSS TRADING PROFIT (C/F)
                      </td>
                      <td style={{ padding: '14px', color: '#065f46', fontWeight: '700' }}>
                        Gross Margin: {pnlData.grossMarginPct}%
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right', fontSize: '1.2rem', color: '#065f46', fontWeight: '900' }}>
                        ₹{pnlData.grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* --- PART 2: PROFIT & LOSS ACCOUNT --- */}
                    <tr style={{ background: '#f8fafc', fontWeight: '800', borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', paddingTop: '20px' }} colSpan="2">PART II: OPERATING & INDIRECT EXPENSES</td>
                      <td style={{ padding: '12px', textAlign: 'right', paddingTop: '20px' }}>Amount (₹)</td>
                    </tr>

                    {Object.keys(pnlData.expensesByCategory).length === 0 ? (
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 24px', color: 'var(--text-muted)' }} colSpan="2">
                          No operating expenses recorded yet. Use "+ Expense / Drawing" button to record rent, power, or salaries.
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>₹0.00</td>
                      </tr>
                    ) : (
                      Object.entries(pnlData.expensesByCategory).map(([cat, amt], idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 24px' }}>• {cat}</td>
                          <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Operating Expense</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>
                            - ₹{amt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}

                    <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: '700', background: '#fef2f2' }}>
                      <td style={{ padding: '12px 24px', color: '#991b1b' }}>Total Indirect Operating Expenses</td>
                      <td></td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#991b1b', fontSize: '1.05rem' }}>
                        - ₹{pnlData.operatingExpenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* NET PROFIT ROW */}
                    <tr style={{ 
                      background: pnlData.isProfit ? '#ecfdf5' : '#fef2f2', 
                      fontWeight: '800', 
                      borderBottom: `3px solid ${pnlData.isProfit ? '#059669' : '#dc2626'}` 
                    }}>
                      <td style={{ padding: '16px 24px', fontSize: '1.15rem', color: pnlData.isProfit ? '#065f46' : '#991b1b' }}>
                        NET PROFIT / LOSS
                      </td>
                      <td style={{ padding: '16px', color: pnlData.isProfit ? '#065f46' : '#991b1b', fontWeight: '700' }}>
                        Net Margin: {pnlData.netMarginPct}% • {pnlData.isProfit ? 'PROFIT' : 'LOSS'}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontSize: '1.3rem', color: pnlData.isProfit ? '#065f46' : '#991b1b', fontWeight: '900' }}>
                        ₹{pnlData.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* --- PART 3: PROPRIETOR'S CAPITAL ACCRUAL --- */}
                    <tr style={{ background: '#f8fafc', fontWeight: '800', borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', paddingTop: '20px' }} colSpan="2">PART III: PROPRIETOR'S CAPITAL & DRAWINGS ALLOCATION</td>
                      <td style={{ padding: '12px', textAlign: 'right', paddingTop: '20px' }}>Amount (₹)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 24px' }}>1. Opening Proprietor Capital</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>As on {capital.asOfDate || '01/04/2026'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>₹{Number(capital.openingCapital || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 24px' }}>2. Add: Current Net Profit from P&L</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Accrued to Owner</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: pnlData.isProfit ? '#059669' : '#dc2626', fontWeight: '700' }}>
                        {pnlData.isProfit ? '+' : ''} ₹{pnlData.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 24px' }}>3. Less: Proprietor Personal Drawings</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Home Expenses / Family Medical</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626', fontWeight: '700' }}>
                        - ₹{totalPersonalDrawings.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr style={{ background: '#eff6ff', fontWeight: '800', borderBottom: '2px solid #3b82f6' }}>
                      <td style={{ padding: '14px 24px', fontSize: '1.05rem', color: '#1e40af' }}>
                        Closing Proprietor Capital (Net Worth)
                      </td>
                      <td style={{ padding: '14px', color: '#1e40af' }}>
                        Carried to Balance Sheet
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right', fontSize: '1.2rem', color: '#1e40af', fontWeight: '900' }}>
                        ₹{balanceSheetData.closingCapital.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: SOLE PROPRIETOR BALANCE SHEET */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'BALANCESHEET' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Balance Sheet Header & Reconciliation Status */}
            <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scale size={20} color="var(--primary)" />
                  <span>Sole Proprietorship Balance Sheet</span>
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  As on {new Date().toLocaleDateString('en-IN')} • T-Format / Indian GAAP & Income Tax Standard
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`badge ${balanceSheetData.isBalanced ? 'badge-success' : 'badge-warning'}`} style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: '800' }}>
                  {balanceSheetData.isBalanced ? '✓ Balanced' : `⚠️ Difference: ₹${balanceSheetData.difference.toFixed(2)}`}
                </span>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary btn-sm"
                  style={{ gap: '6px' }}
                >
                  <Printer size={14} />
                  <span>Print Sheet</span>
                </button>
              </div>
            </div>

            {/* 2-Column T-Account Balance Sheet */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* LEFT COLUMN: LIABILITIES & CAPITAL */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ paddingBottom: '10px', borderBottom: '2px solid #ef4444', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: '#991b1b' }}>
                    LIABILITIES & EQUITY
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Credit</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Capital Account */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        1. Proprietor Capital Account
                      </span>
                      <button 
                        onClick={handleOpenCapitalModal}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <Edit3 size={12} /> Edit
                      </button>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Opening Capital:</span>
                        <span>₹{balanceSheetData.openingCapital.toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: pnlData.isProfit ? '#059669' : '#dc2626' }}>
                        <span>• Net Profit (added):</span>
                        <span>{pnlData.isProfit ? '+' : ''}₹{balanceSheetData.currentProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                        <span>• Personal Drawings (deducted):</span>
                        <span>-₹{balanceSheetData.drawings.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', color: '#1e40af', borderTop: '1px solid #cbd5e1', paddingTop: '4px', marginTop: '2px' }}>
                        <span>Closing Capital (Net Worth):</span>
                        <span>₹{balanceSheetData.closingCapital.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Current Liabilities */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                      2. Current Liabilities
                    </span>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Sundry Creditors (Suppliers):</span>
                        <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>₹{balanceSheetData.sundryCreditors.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Net GST Output Liability:</span>
                        <span style={{ fontWeight: '700', color: '#7c3aed' }}>₹{balanceSheetData.netGstPayable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Liabilities Box */}
                  <div style={{ background: '#fef2f2', border: '2px solid #dc2626', padding: '14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '900', fontSize: '1rem', color: '#991b1b' }}>
                      TOTAL LIABILITIES & EQUITY:
                    </span>
                    <span style={{ fontWeight: '900', fontSize: '1.25rem', color: '#991b1b' }}>
                      ₹{balanceSheetData.totalLiabilities.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: ASSETS */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ paddingBottom: '10px', borderBottom: '2px solid #059669', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: '#065f46' }}>
                    ASSETS & INVESTMENTS
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Debit</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Current Assets */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                      1. Current Assets
                    </span>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Closing Stock Valuation (@ Cost):</span>
                        <span style={{ fontWeight: '700', color: '#dc2626' }}>₹{balanceSheetData.closingStock.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Sundry Debtors (Retailers Udhar):</span>
                        <span style={{ fontWeight: '700', color: '#d97706' }}>₹{balanceSheetData.sundryDebtors.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Cash in Hand (Cash Register):</span>
                        <span style={{ fontWeight: '700', color: '#059669' }}>₹{balanceSheetData.cashInHand.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Bank & UPI Balances:</span>
                        <span style={{ fontWeight: '700', color: '#2563eb' }}>₹{balanceSheetData.bankBalances.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fixed Assets */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                      2. Fixed Assets & Infrastructure
                    </span>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Equipment, Vehicles & Fixtures:</span>
                        <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>₹{balanceSheetData.fixedAssets.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Assets Box */}
                  <div style={{ background: '#ecfdf5', border: '2px solid #059669', padding: '14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '900', fontSize: '1rem', color: '#065f46' }}>
                      TOTAL ASSETS:
                    </span>
                    <span style={{ fontWeight: '900', fontSize: '1.25rem', color: '#065f46' }}>
                      ₹{balanceSheetData.totalAssets.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: EXPENSES & DRAWINGS LEDGER */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'EXPENSES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Operating Expenses</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#d97706', margin: '4px 0 0 0' }}>
                  ₹{totalOperatingExpenses.toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Rent, Salaries, Electric, Fuel</span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Direct Inward Freight</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#2563eb', margin: '4px 0 0 0' }}>
                  ₹{totalDirectExpenses.toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Cartage on Purchase Goods</span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #ec4899' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Proprietor Personal Drawings</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#db2777', margin: '4px 0 0 0' }}>
                  ₹{totalPersonalDrawings.toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Household / Medical (Deducted from Capital)</span>
              </div>
            </div>

            {/* Expenses List & Filter Table */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
                    Expense & Drawings Register
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button 
                    onClick={() => setExpenseFilterType('ALL')}
                    className={`btn btn-sm ${expenseFilterType === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setExpenseFilterType('OPERATING')}
                    className={`btn btn-sm ${expenseFilterType === 'OPERATING' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    Operating
                  </button>
                  <button 
                    onClick={() => setExpenseFilterType('DIRECT')}
                    className={`btn btn-sm ${expenseFilterType === 'DIRECT' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    Direct Freight
                  </button>
                  <button 
                    onClick={() => setExpenseFilterType('DRAWING')}
                    className={`btn btn-sm ${expenseFilterType === 'DRAWING' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    Drawings
                  </button>

                  <button
                    onClick={() => setExpenseModalOpen(true)}
                    className="btn btn-primary btn-sm"
                    style={{ gap: '4px', marginLeft: '6px', padding: '5px 10px', fontSize: '0.76rem', fontWeight: '700' }}
                  >
                    <Plus size={14} /> + New Expense
                  </button>
                </div>
              </div>

              {filteredExpenses.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No expenses recorded for this period.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Voucher #</th>
                        <th style={{ padding: '8px' }}>Date</th>
                        <th style={{ padding: '8px' }}>Expense Category</th>
                        <th style={{ padding: '8px' }}>Type</th>
                        <th style={{ padding: '8px' }}>Paid To</th>
                        <th style={{ padding: '8px' }}>Payment Mode</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Amount (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'center' }} className="no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses
                        .filter(e => expenseFilterType === 'ALL' || e.type === expenseFilterType)
                        .map((exp, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>{exp.voucherNo || `VOUCH-${idx+1}`}</td>
                            <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{exp.date}</td>
                            <td style={{ padding: '8px', fontWeight: '700', color: 'var(--text-main)' }}>{exp.category}</td>
                            <td style={{ padding: '8px' }}>
                              <span className={`badge ${exp.type === 'DRAWING' ? 'badge-danger' : exp.type === 'DIRECT' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                                {exp.type === 'DRAWING' ? 'Personal Drawing' : exp.type === 'DIRECT' ? 'Direct COGS' : 'Operating'}
                              </span>
                            </td>
                            <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{exp.paidTo || '-'}</td>
                            <td style={{ padding: '8px' }}>
                              <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                                {exp.paymentMode || 'CASH'}
                              </span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                              ₹{Number(exp.amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }} className="no-print">
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                title="Delete Expense Voucher"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: GST RETURN FILING (GSTR-1 & GSTR-3B) */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'GST' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* GST Official Portal Action Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: '0 8px 20px -4px rgba(6, 78, 59, 0.3)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={24} color="#34d399" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>
                    Official GSTN GSTR-1 Schema Engine (gst.gov.in)
                  </h3>
                  <span style={{ background: '#34d399', color: '#064e3b', fontWeight: '800', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px' }}>
                    Govt Compliant
                  </span>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#a7f3d0' }}>
                  Distributor GSTIN: <strong style={{ color: '#fff' }}>{business?.gstin || '07AAAAA0000A1Z5'}</strong> • 
                  Period: <strong style={{ color: '#fff' }}>{getFpSixDigit()} ({gstFpMonth})</strong> • 
                  Payload splits automatically below 5 MB portal upload limit.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Prominent Month Picker */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.18)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}>
                  <Calendar size={18} color="#34d399" />
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#ffffff', whiteSpace: 'nowrap' }}>
                    Filing Month:
                  </span>
                  <input 
                    type="month"
                    value={gstFpMonth}
                    onChange={(e) => setGstFpMonth(e.target.value)}
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: '800',
                      fontSize: '0.88rem',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      outline: 'none',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}
                    title="Choose GST Return Filing Month"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleValidateGstr1}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>Validate Schema</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportGstr1OfficialJson}
                  style={{
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  <Download size={16} />
                  <span>Download GSTR-1 JSON</span>
                </button>
              </div>
            </div>

            {/* GSTR-1 Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>B2B Invoices (Registered Buyers)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', margin: '4px 0 0 0' }}>
                  {b2bInvoices.length} Bills
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                  Val: ₹{b2bInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>B2C Small (Unregistered Consumers)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', margin: '4px 0 0 0' }}>
                  {b2cInvoices.length} Bills
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                  Val: ₹{b2cInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CGST Liability (Central Tax)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#d97706', margin: '4px 0 0 0' }}>
                  ₹{totalCgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Matched intra-state</span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #8b5cf6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SGST Liability (State Tax)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#7c3aed', margin: '4px 0 0 0' }}>
                  ₹{totalSgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Local state authority</span>
              </div>
            </div>

            {/* GSTR-3B Consolidated Table */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                  🏛️ GSTR-3B Table 3.1: Outward Tax Liability Summary
                </h3>
                <span className="badge badge-success">GSTR-3B Ready</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>Nature of Supply</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Taxable Value (₹)</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>IGST (₹)</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>CGST (₹)</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>SGST (₹)</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Total Tax (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: '700' }}>(a) Taxable Outward Supplies</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>₹{netTaxableRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalIgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalCgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalSgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>₹{totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ background: '#ecfdf5', fontWeight: '800' }}>
                      <td style={{ padding: '10px' }}>Total Net Output Tax Liability</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{netTaxableRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalIgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalCgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalSgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#059669' }}>₹{totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* GSTR-1 Table 4A: B2B Invoices */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                  🏢 GSTR-1 Table 4A: Supplies to Registered Buyers (B2B Invoices)
                </h3>
                <span className="badge badge-info" style={{ fontSize: '0.74rem' }}>{b2bInvoices.length} Registered Buyers</span>
              </div>

              {b2bInvoices.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  No B2B invoices found for this period.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>GSTIN</th>
                        <th style={{ padding: '8px' }}>Party Name</th>
                        <th style={{ padding: '8px' }}>Invoice No</th>
                        <th style={{ padding: '8px' }}>Date</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total Value (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Taxable (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>CGST (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>SGST (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>IGST (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b2bInvoices.map((inv, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>{inv.partyGstin}</td>
                          <td style={{ padding: '8px', fontWeight: '700' }}>{inv.partyName || inv.customerName}</td>
                          <td style={{ padding: '8px' }}>{inv.invoiceNo}</td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{inv.date?.split('T')[0]}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>₹{Number(inv.grandTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>₹{getInvTaxable(inv).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>₹{Number(inv.cgst || 0).toFixed(2)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>₹{Number(inv.sgst || 0).toFixed(2)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>₹{Number(inv.igst || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* GSTR-1 Table 7: B2C Small Invoices */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                  🛒 GSTR-1 Table 7: Supplies to Unregistered Consumers (B2C Small)
                </h3>
                <span className="badge badge-success" style={{ fontSize: '0.74rem' }}>{b2cInvoices.length} Consumer Bills</span>
              </div>

              {b2cInvoices.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  No B2C Small invoices found for this period.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Supply Type</th>
                        <th style={{ padding: '8px' }}>Place of Supply (POS)</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Bill Count</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total Invoice Value (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Taxable Value (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>CGST (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>SGST (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total Tax (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', fontWeight: '700' }}>OE (Other Intra/Inter)</td>
                        <td style={{ padding: '8px' }}>07-Delhi (Local)</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{b2cInvoices.length}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>
                          ₹{b2cInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>
                          ₹{b2cInvoices.reduce((s, i) => s + getInvTaxable(i), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          ₹{b2cInvoices.reduce((s, i) => s + (Number(i.cgst) || 0), 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          ₹{b2cInvoices.reduce((s, i) => s + (Number(i.sgst) || 0), 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                          ₹{b2cInvoices.reduce((s, i) => s + (Number(i.cgst || 0) + Number(i.sgst || 0) + Number(i.igst || 0)), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* GSTR-1 Table 9B: Credit / Debit Notes (CDNR & CDNUR) */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                  ↩️ GSTR-1 Table 9B: Credit Notes & Sales Returns (CDNR / CDNUR)
                </h3>
                <span className="badge badge-error" style={{ fontSize: '0.74rem', background: '#fee2e2', color: '#dc2626' }}>
                  {creditNotesInPeriod.length} Credit Notes (Tax Deducted)
                </span>
              </div>

              {creditNotesInPeriod.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  No credit notes or sales returns recorded for this period.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Credit Note No</th>
                        <th style={{ padding: '8px' }}>Original Bill Ref</th>
                        <th style={{ padding: '8px' }}>Party Name</th>
                        <th style={{ padding: '8px' }}>GSTIN</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Note Value (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Taxable Value (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>CGST Reversal (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>SGST Reversal (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Tax Deducted (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditNotesInPeriod.map((cn, idx) => {
                        const taxVal = getInvTaxable(cn);
                        const cgstVal = Number(cn.cgst || 0);
                        const sgstVal = Number(cn.sgst || 0);
                        const totTax = cgstVal + sgstVal + Number(cn.igst || 0);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px', fontWeight: '700', color: '#dc2626', fontFamily: 'monospace' }}>
                              {cn.invoiceNo}
                            </td>
                            <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                              {cn.reversalOf || 'Direct Return'}
                            </td>
                            <td style={{ padding: '8px', fontWeight: '700' }}>
                              {cn.partyName || cn.customerName}
                            </td>
                            <td style={{ padding: '8px', fontSize: '0.76rem', fontFamily: 'monospace' }}>
                              {cn.partyGstin || 'URP'}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                              -₹{Number(cn.grandTotal || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              -₹{taxVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>
                              -₹{cgstVal.toFixed(2)}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>
                              -₹{sgstVal.toFixed(2)}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                              -₹{totTax.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* HSN Summary */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                📑 GSTR-1 Table 12: HSN-wise Outward Summary
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>HSN Code</th>
                      <th style={{ padding: '8px' }}>Description</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>UQC</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Quantity</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Taxable Value (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>CGST (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>SGST (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Total Tax (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hsnMap.map((h, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>{h.hsn}</td>
                        <td style={{ padding: '8px' }}>{h.description}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{h.uqc}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{h.totalQty}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>₹{h.taxableValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>₹{h.cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>₹{h.sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>₹{h.totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 6: DAY BOOK / CASHBOOK REGISTER */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'DAYBOOK' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Date Selector for DayBook */}
            <div className="glass-card no-print" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={18} color="var(--primary)" />
                <label style={{ fontWeight: '700', fontSize: '0.88rem' }}>Select Day Book Date:</label>
                <input 
                  type="date" 
                  className="input-field" 
                  style={{ width: 'auto', padding: '6px 12px' }}
                  value={dayBookDate}
                  onChange={e => setDayBookDate(e.target.value)}
                />
              </div>

              <button 
                type="button" 
                onClick={() => window.print()} 
                className="btn btn-primary"
                style={{ gap: '6px', padding: '6px 14px', fontWeight: '700', fontSize: '0.82rem' }}
              >
                <Printer size={15} />
                <span>Print Day Book</span>
              </button>
            </div>

            {/* Daily Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Today's Total Turnover</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', margin: '4px 0 0 0' }}>
                  ₹{dayBookData.dayTotalTurnover.toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>{dayBookData.dayInvoices.length} Bills issued</span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #059669' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cash Inflow (Hand Cash)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#059669', margin: '4px 0 0 0' }}>
                  ₹{dayBookData.dayCashSales.toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Hand cash collection</span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Digital & Bank Collections</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#2563eb', margin: '4px 0 0 0' }}>
                  ₹{(dayBookData.dayUpiSales + dayBookData.dayBankSales).toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Direct account credits</span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Today's Credit Given (Udhar)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#d97706', margin: '4px 0 0 0' }}>
                  ₹{dayBookData.dayCreditSales.toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Credit allowed today</span>
              </div>
            </div>

            {/* Chronological Day Vouchers Table */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                📖 Daily Voucher & Transaction Chronology
              </h3>

              {dayBookData.dayInvoices.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No billing entries found for {dayBookDate}.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Time</th>
                        <th style={{ padding: '8px' }}>Bill / Voucher #</th>
                        <th style={{ padding: '8px' }}>Party Name</th>
                        <th style={{ padding: '8px' }}>Payment Mode</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total Bill (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Paid / Received (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Due Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayBookData.dayInvoices.map((inv, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                            {inv.date ? new Date(inv.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>{inv.invoiceNo}</td>
                          <td style={{ padding: '8px', fontWeight: '700' }}>{inv.partyName || 'Cash Sale'}</td>
                          <td style={{ padding: '8px' }}>
                            <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                              {inv.paymentMode || 'CASH'}
                            </span>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>
                            ₹{Number(inv.grandTotal || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                            ₹{Number(inv.paidAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: Number(inv.balanceAmount) > 0 ? '#d97706' : '#10b981' }}>
                            ₹{Number(inv.balanceAmount || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 7: STOCK VALUATION REPORT */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'STOCK' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Warehouse Filter */}
            <div className="glass-card no-print" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={18} color="var(--primary)" />
                <label style={{ fontWeight: '700', fontSize: '0.88rem' }}>Select Warehouse:</label>
                <select 
                  className="input-field select-field" 
                  style={{ width: 'auto', padding: '6px 14px' }}
                  value={selectedStockWarehouse}
                  onChange={e => setSelectedStockWarehouse(e.target.value)}
                >
                  <option value="ALL">All Depots & Warehouses</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                  ))}
                </select>
              </div>

              <button 
                type="button" 
                onClick={() => window.print()} 
                className="btn btn-primary"
                style={{ gap: '6px', padding: '6px 14px', fontWeight: '700', fontSize: '0.82rem' }}
              >
                <Printer size={15} />
                <span>Print Stock Valuation</span>
              </button>
            </div>

            {/* Valuation Metric Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Available Stock</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', margin: '4px 0 0 0' }}>
                  {stockValuationData.totalUnits.toLocaleString('en-IN')} Pcs / Units
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Across {stockValuationData.list.length} catalog items</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #ef4444' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Valuation @ Cost (Purchase Price)</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#dc2626', margin: '4px 0 0 0' }}>
                  ₹{stockValuationData.totalPurchaseVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Total capital tied up in stock</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Valuation @ Retail (Sale Price)</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#059669', margin: '4px 0 0 0' }}>
                  ₹{stockValuationData.totalSaleVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Expected market realization</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Potential Gross Margin</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#d97706', margin: '4px 0 0 0' }}>
                  ₹{stockValuationData.potentialGrossProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#d97706', fontWeight: '700' }}>
                  Overall {stockValuationData.totalSaleVal > 0 ? ((stockValuationData.potentialGrossProfit / stockValuationData.totalSaleVal) * 100).toFixed(1) : '0.0'}% Margin
                </span>
              </div>
            </div>

            {/* Product Valuation Table */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
                  📦 Item-wise Stock Valuation Ledger
                </h3>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>#</th>
                      <th style={{ padding: '8px' }}>Product Name</th>
                      <th style={{ padding: '8px' }}>Brand / SKU</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Stock Qty</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Purchase Rate (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Sale Rate (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Cost Valuation (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Retail Valuation (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Potential Profit (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockValuationData.list.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>#{idx + 1}</td>
                        <td style={{ padding: '8px', fontWeight: '700' }}>{item.name}</td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{item.brand || '-'} / {item.sku || '-'}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{item.stock} {item.unit || 'Pcs'}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>₹{Number(item.purchasePrice || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>₹{Number(item.price || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                          ₹{item.costVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>
                          ₹{item.saleVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#d97706' }}>
                          ₹{item.potentialProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ({item.marginPct}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL: RECORD EXPENSE / PERSONAL DRAWING */}
      {expenseModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={20} color="var(--primary)" />
                <span>Record Expense / Personal Drawing</span>
              </h3>
              <button
                type="button"
                onClick={() => setExpenseModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Expense Type Selector */}
                <div className="form-group">
                  <label className="form-label">Expense Classification *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setExpenseFormData({ ...expenseFormData, type: 'OPERATING', category: 'Shop / Godown Rent' })}
                      className={`btn btn-sm ${expenseFormData.type === 'OPERATING' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.74rem', padding: '6px 4px' }}
                    >
                      Operating
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseFormData({ ...expenseFormData, type: 'DIRECT', category: 'Freight & Cartage Inward' })}
                      className={`btn btn-sm ${expenseFormData.type === 'DIRECT' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.74rem', padding: '6px 4px' }}
                    >
                      Direct Inward
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseFormData({ ...expenseFormData, type: 'DRAWING', category: 'Proprietor Personal Drawings' })}
                      className={`btn btn-sm ${expenseFormData.type === 'DRAWING' ? 'btn-danger' : 'btn-secondary'}`}
                      style={{ fontSize: '0.74rem', padding: '6px 4px' }}
                    >
                      Drawings
                    </button>
                  </div>
                </div>

                {/* Category Preset Dropdown */}
                <div className="form-group">
                  <label className="form-label">Expense Category *</label>
                  <select
                    className="input-field select-field"
                    value={expenseFormData.category}
                    onChange={e => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                  >
                    {expenseFormData.type === 'DIRECT' && (
                      <>
                        <option value="Freight & Cartage Inward">Freight & Cartage Inward</option>
                        <option value="Loading & Labour Inward">Loading & Labour Inward</option>
                        <option value="Packaging & Box Strapping">Packaging & Box Strapping</option>
                        <option value="Direct Fuel & Transit">Direct Fuel & Transit</option>
                      </>
                    )}

                    {expenseFormData.type === 'OPERATING' && (
                      <>
                        <option value="Shop / Godown Rent">Shop / Godown Rent</option>
                        <option value="Staff Salaries & Wages">Staff Salaries & Wages</option>
                        <option value="Electricity & Utilities">Electricity & Utilities</option>
                        <option value="Vehicle Fuel & Transport">Vehicle Fuel & Transport</option>
                        <option value="Office & Stationery">Office & Stationery</option>
                        <option value="Tea & Refreshment">Tea & Refreshment</option>
                        <option value="Bank Charges & Gateway Fees">Bank Charges & Gateway Fees</option>
                        <option value="Repair & Maintenance">Repair & Maintenance</option>
                        <option value="Marketing & Promotion">Marketing & Promotion</option>
                        <option value="Miscellaneous Operating">Miscellaneous Operating</option>
                      </>
                    )}

                    {expenseFormData.type === 'DRAWING' && (
                      <>
                        <option value="Proprietor Personal Drawings">Proprietor Personal Drawings</option>
                        <option value="Family Medical & Insurance">Family Medical & Insurance</option>
                        <option value="Children Education & Tuition">Children Education & Tuition</option>
                        <option value="Personal Income Tax Advance">Personal Income Tax Advance</option>
                      </>
                    )}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      className="input-field"
                      placeholder="e.g. 3500"
                      value={expenseFormData.amount}
                      onChange={e => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      required
                      className="input-field"
                      value={expenseFormData.date}
                      onChange={e => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select
                      className="input-field select-field"
                      value={expenseFormData.paymentMode}
                      onChange={e => setExpenseFormData({ ...expenseFormData, paymentMode: e.target.value })}
                    >
                      <option value="CASH">Cash (Cash in Hand)</option>
                      <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI">UPI (GooglePay / PhonePe)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Paid To</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Landlord / Fuel Station"
                      value={expenseFormData.paidTo}
                      onChange={e => setExpenseFormData({ ...expenseFormData, paidTo: e.target.value })}
                    />
                  </div>
                </div>

                {expenseFormData.paymentMode !== 'CASH' && (
                  <div className="form-group">
                    <label className="form-label">Deduct from Bank Account</label>
                    <select
                      className="input-field select-field"
                      value={expenseFormData.bankAccountId}
                      onChange={e => setExpenseFormData({ ...expenseFormData, bankAccountId: e.target.value })}
                    >
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - A/c {b.accountNo} (Bal: ₹{Number(b.balance || 0).toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Notes / Voucher Remarks</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Bill #459 / Cheque #002144"
                    value={expenseFormData.notes}
                    onChange={e => setExpenseFormData({ ...expenseFormData, notes: e.target.value })}
                  />
                </div>

              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ gap: '6px' }}
                >
                  <Save size={16} />
                  <span>Save Voucher</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROPRIETOR CAPITAL SETUP */}
      {capitalModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Briefcase size={20} color="var(--primary)" />
                <span>Proprietor Capital Setup</span>
              </h3>
              <button
                type="button"
                onClick={() => setCapitalModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCapital}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  In a Sole Proprietorship, invested capital forms the core foundation of the business balance sheet.
                </p>

                <div className="form-group">
                  <label className="form-label">Opening Capital (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="input-field"
                    value={capitalFormData.openingCapital}
                    onChange={e => setCapitalFormData({ ...capitalFormData, openingCapital: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Additional Capital Added (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={capitalFormData.additionalCapital}
                    onChange={e => setCapitalFormData({ ...capitalFormData, additionalCapital: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fixed Assets & Infrastructure (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    placeholder="0"
                    value={capitalFormData.fixedAssets}
                    onChange={e => setCapitalFormData({ ...capitalFormData, fixedAssets: e.target.value })}
                  />
                  <small style={{ color: 'var(--text-dim)', fontSize: '0.74rem' }}>Godown racks, furniture, vehicles, computers (default 0)</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Opening Cash in Hand (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    placeholder="0"
                    value={capitalFormData.openingCash}
                    onChange={e => setCapitalFormData({ ...capitalFormData, openingCash: e.target.value })}
                  />
                  <small style={{ color: 'var(--text-dim)', fontSize: '0.74rem' }}>Opening cash register / galla balance (default 0)</small>
                </div>

                <div className="form-group">
                  <label className="form-label">As on Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={capitalFormData.asOfDate}
                    onChange={e => setCapitalFormData({ ...capitalFormData, asOfDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Remarks / Notes</label>
                  <input
                    type="text"
                    className="input-field"
                    value={capitalFormData.notes}
                    onChange={e => setCapitalFormData({ ...capitalFormData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setCapitalModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ gap: '6px' }}
                >
                  <Save size={16} />
                  <span>Update Capital</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
