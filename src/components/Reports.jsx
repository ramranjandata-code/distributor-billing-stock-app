import React, { useState, useMemo } from 'react';
import { 
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
  RefreshCw
} from 'lucide-react';
import { 
  fetchBankTransactions, 
  fetchWarehouses, 
  fetchExpenses, 
  saveExpense, 
  deleteExpense, 
  fetchProprietorCapital, 
  saveProprietorCapital, 
  fetchBankAccounts 
} from '../utils/storage';

export default function Reports({ invoices = [], products = [], parties = [], business, refreshAllData, t }) {
  const [reportTab, setReportTab] = useState('SALES'); // 'SALES', 'PNL', 'BALANCESHEET', 'EXPENSES', 'GST', 'DAYBOOK', 'STOCK'
  const [period, setPeriod] = useState('MONTHLY'); // 'TODAY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM', 'ALL'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dayBookDate, setDayBookDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStockWarehouse, setSelectedStockWarehouse] = useState('ALL');

  // Sole Proprietor Accounting State
  const [expenses, setExpenses] = useState(fetchExpenses());
  const [capital, setCapital] = useState(fetchProprietorCapital());
  const [bankAccounts, setBankAccounts] = useState(fetchBankAccounts());
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [capitalModalOpen, setCapitalModalOpen] = useState(false);
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
    bankAccountId: bankAccounts[0]?.id || 'bank_1',
    paidTo: '',
    notes: ''
  };
  const [expenseFormData, setExpenseFormData] = useState(initialExpenseState);

  // Capital Form State
  const initialCapitalState = {
    openingCapital: capital.openingCapital || 500000,
    additionalCapital: capital.additionalCapital || 0,
    asOfDate: capital.asOfDate || '2026-04-01',
    notes: capital.notes || 'Opening capital as per books'
  };
  const [capitalFormData, setCapitalFormData] = useState(initialCapitalState);

  // Reload local state whenever parent data refreshes
  const reloadAccountingData = () => {
    setExpenses(fetchExpenses());
    setCapital(fetchProprietorCapital());
    setBankAccounts(fetchBankAccounts());
    if (refreshAllData) refreshAllData();
  };

  // Date Filtering Helper for Invoices
  const filterInvoicesByPeriod = () => {
    const now = new Date();

    return invoices.filter(inv => {
      if (!inv || !inv.date) return false;
      const invDate = new Date(inv.date);
      if (isNaN(invDate.getTime())) return false;

      if (period === 'ALL') return true;

      if (period === 'TODAY') {
        const todayStr = now.toISOString().split('T')[0];
        return inv.date.startsWith(todayStr);
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

  // Aggregate Sales & Tax Metrics
  const totalSales = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  const totalCollected = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
  const totalUdhar = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.balanceAmount) || 0), 0);

  const totalCgst = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.cgst) || 0), 0);
  const totalSgst = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.sgst) || 0), 0);
  const totalIgst = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.igst) || 0), 0);
  
  // FIX: Explicitly define totalTax to resolve ReferenceError!
  const totalTax = totalCgst + totalSgst + totalIgst;

  const getInvTaxable = (inv) => Number(inv.taxableAmount || inv.taxableSubtotal || inv.subTotal || inv.subtotal || (Number(inv.grandTotal || 0) - (Number(inv.cgst || 0) + Number(inv.sgst || 0) + Number(inv.igst || 0)))) || 0;
  const netTaxableRevenue = filteredInvoices.reduce((sum, inv) => sum + getInvTaxable(inv), 0);

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
        const purchaseCost = p ? Number(p.purchasePrice || 0) : (Number(item.price || 0) * 0.75);
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
    // 1. Stock Valuation @ Purchase Cost
    const totalClosingStockVal = products.reduce((sum, p) => sum + ((Number(p.currentStock) || 0) * (Number(p.purchasePrice) || 0)), 0);

    // 2. Sundry Debtors (Receivables / Market Udhar from Retailers)
    const sundryDebtors = parties.reduce((sum, p) => sum + Math.max(0, Number(p.balance) || 0), 0);

    // 3. Sundry Creditors (Suppliers / Vendors we owe money to)
    const sundryCreditors = parties.reduce((sum, p) => sum + Math.max(0, -(Number(p.balance) || 0)), 0);

    // 4. Live Bank Balances
    const totalBankBalances = bankAccounts.reduce((sum, b) => sum + (Number(b.balance) || 0), 0);

    // 5. Cash in Hand (Galla): Opening Cash + Cash Sales - Cash Expenses
    const cashCollected = invoices.filter(i => i.paymentMode === 'CASH' || !i.paymentMode).reduce((s, i) => s + (Number(i.paidAmount) || 0), 0);
    const cashExpensesPaid = expenses.filter(e => e.paymentMode === 'CASH').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const cashInHand = Math.max(0, (business?.openingCash || 25000) + cashCollected - cashExpensesPaid);

    // 6. Fixed Assets (Godown Racks, Vehicles, Computer & POS equipment)
    const fixedAssets = Number(business?.fixedAssets) || 125000;

    // 7. Net GST Liability (Output tax payable to govt)
    const netGstPayable = Math.max(0, totalTax);

    // 8. Proprietor's Capital Account (Equity)
    const openingCap = Number(capital.openingCapital) || 500000;
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

  // Product Sales Breakdown
  const productSalesMap = {};
  filteredInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = {
          name: item.name,
          sku: item.sku || '-',
          totalQty: 0,
          totalAmount: 0
        };
      }
      productSalesMap[item.productId].totalQty += Number(item.qty) || 0;
      productSalesMap[item.productId].totalAmount += Number(item.total) || (Number(item.price) * Number(item.qty)) || 0;
    });
  });
  const topProducts = Object.values(productSalesMap).sort((a, b) => b.totalAmount - a.totalAmount);

  // Party Sales Breakdown
  const partySalesMap = {};
  filteredInvoices.forEach(inv => {
    const key = inv.partyName || 'Cash Customer';
    if (!partySalesMap[key]) {
      partySalesMap[key] = {
        name: key,
        phone: inv.partyPhone || '-',
        billCount: 0,
        totalSales: 0,
        totalBalance: 0
      };
    }
    partySalesMap[key].billCount += 1;
    partySalesMap[key].totalSales += Number(inv.grandTotal) || 0;
    partySalesMap[key].totalBalance += Number(inv.balanceAmount) || 0;
  });
  const partyBreakdown = Object.values(partySalesMap).sort((a, b) => b.totalSales - a.totalSales);

  // GSTR-1 & 3B Categorization
  const b2bInvoices = filteredInvoices.filter(inv => inv.partyGstin && inv.partyGstin.trim().length >= 10 && inv.partyGstin.trim().toUpperCase() !== 'URP');
  const b2cInvoices = filteredInvoices.filter(inv => !inv.partyGstin || inv.partyGstin.trim().length < 10 || inv.partyGstin.trim().toUpperCase() === 'URP');

  // HSN Summary Map
  const hsnMap = useMemo(() => {
    const map = {};
    filteredInvoices.forEach(inv => {
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
        const rate = Number(item.gstRate) || 18;
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
      const rate = inv.items?.[0]?.gstRate || 18;
      csvContent += `4A,"${inv.partyGstin}","${inv.partyName || inv.customerName}","${inv.invoiceNo}","${inv.date?.split('T')[0]}",${Number(inv.grandTotal || 0).toFixed(2)},"${pos}-State",N,Regular,${rate},${taxable.toFixed(2)},${Number(inv.cgst || 0).toFixed(2)},${Number(inv.sgst || 0).toFixed(2)},${Number(inv.igst || 0).toFixed(2)},0.00\n`;
    });

    csvContent += '\n--- GSTR-1 TABLE 7: TAXABLE SUPPLIES TO UNREGISTERED PERSONS (B2C SMALL) ---\n';
    csvContent += 'Table,Type,Place of Supply,Rate (%),Taxable Value,CGST Amount,SGST Amount,IGST Amount,Cess Amount\n';

    // Table 7: B2C Small Invoices
    b2cInvoices.forEach(inv => {
      const taxable = getInvTaxable(inv);
      const rate = inv.items?.[0]?.gstRate || 18;
      csvContent += `7,OE,"07-Delhi",${rate},${taxable.toFixed(2)},${Number(inv.cgst || 0).toFixed(2)},${Number(inv.sgst || 0).toFixed(2)},${Number(inv.igst || 0).toFixed(2)},0.00\n`;
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
      const pPrice = Number(p.purchasePrice) || 0;
      const sPrice = Number(p.price) || 0;
      const costVal = stock * pPrice;
      const saleVal = stock * sPrice;
      const potentialProfit = saleVal - costVal;
      const marginPct = saleVal > 0 ? ((potentialProfit / saleVal) * 100).toFixed(1) : '0.0';

      totalUnits += stock;
      totalPurchaseVal += costVal;
      totalSaleVal += saleVal;

      return {
        ...p,
        stock,
        costVal,
        saleVal,
        potentialProfit,
        marginPct
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
      
      {/* MODULE REPORT TABS (Hidden on Print) */}
      <div className="glass-card no-print" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setReportTab('SALES')}
            className={`btn btn-sm ${reportTab === 'SALES' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700' }}
          >
            <TrendingUp size={15} />
            <span>Sales Analytics</span>
          </button>

          <button 
            onClick={() => setReportTab('PNL')}
            className={`btn btn-sm ${reportTab === 'PNL' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700' }}
          >
            <PieChart size={15} />
            <span>Trading & P&L</span>
          </button>

          <button 
            onClick={() => setReportTab('BALANCESHEET')}
            className={`btn btn-sm ${reportTab === 'BALANCESHEET' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700' }}
          >
            <Scale size={15} />
            <span>Balance Sheet</span>
          </button>

          <button 
            onClick={() => setReportTab('EXPENSES')}
            className={`btn btn-sm ${reportTab === 'EXPENSES' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700' }}
          >
            <Receipt size={15} />
            <span>Expenses & Drawings</span>
          </button>

          <button 
            onClick={() => setReportTab('GST')}
            className={`btn btn-sm ${reportTab === 'GST' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700' }}
          >
            <ShieldCheck size={15} />
            <span>GST Returns (GSTR-1 & 3B)</span>
          </button>

          <button 
            onClick={() => setReportTab('DAYBOOK')}
            className={`btn btn-sm ${reportTab === 'DAYBOOK' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700' }}
          >
            <BookOpen size={15} />
            <span>Day Book</span>
          </button>

          <button 
            onClick={() => setReportTab('STOCK')}
            className={`btn btn-sm ${reportTab === 'STOCK' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700' }}
          >
            <Package size={15} />
            <span>Stock Valuation</span>
          </button>
        </div>

        {/* Action Controls: Add Expense & Capital setup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setExpenseModalOpen(true)}
            className="btn btn-primary btn-sm"
            style={{ gap: '5px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: '700' }}
          >
            <Plus size={14} />
            <span>+ Expense / Drawing</span>
          </button>

          <button
            type="button"
            onClick={() => setCapitalModalOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ gap: '5px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: '700' }}
            title="Configure Sole Proprietor Opening Capital"
          >
            <Briefcase size={14} />
            <span>Capital Account</span>
          </button>
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
                {business?.name || 'SHREE GANESH SALES AGENCY'}
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {business?.address || 'Authorized FMCG & Wholesale Distributor'}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '2px 0 0 0' }}>
                GSTIN: {business?.gstin || 'N/A'} • Phone: {business?.phone || 'N/A'} • Proprietor: <strong>{business?.proprietor || capital.notes || 'Rajesh Verma'}</strong>
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="badge badge-info" style={{ fontSize: '0.85rem', padding: '6px 12px', fontWeight: '800' }}>
                {reportTab === 'SALES' && `📊 Sales Analytics • ${getPeriodLabel()}`}
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
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Sales Revenue</span>
                  <TrendingUp size={20} color="#10b981" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                  ₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {filteredInvoices.length} Invoices Issued
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              {/* Top Products Table */}
              <div className="glass-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <Award size={20} color="var(--primary)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>
                    Product-wise Sales Performance
                  </h3>
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
                            <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{prod.sku}</td>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{prod.totalQty}</td>
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

              {/* Party Sales Breakdown */}
              <div className="glass-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <Users size={20} color="var(--primary)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>
                    Party-wise Sales & Udhar Breakdown
                  </h3>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px' }}>#</th>
                        <th style={{ padding: '8px' }}>Party / Customer Name</th>
                        <th style={{ padding: '8px' }}>Phone</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Total Bills</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total Sales (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Due Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partyBreakdown.map((party, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>#{idx + 1}</td>
                          <td style={{ padding: '8px', fontWeight: '700', color: 'var(--text-main)' }}>{party.name}</td>
                          <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{party.phone}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{party.billCount}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>
                            ₹{party.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: party.totalBalance > 0 ? '#fbbf24' : '#34d399' }}>
                            ₹{party.totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>₹{Number(capital.openingCapital || 500000).toLocaleString('en-IN')}</td>
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
                        onClick={() => setCapitalModalOpen(true)}
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
