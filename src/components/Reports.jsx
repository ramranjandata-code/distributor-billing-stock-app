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
  ArrowDownRight
} from 'lucide-react';
import { fetchBankTransactions, fetchWarehouses } from '../utils/storage';

export default function Reports({ invoices = [], products = [], parties = [], business }) {
  const [reportTab, setReportTab] = useState('SALES'); // 'SALES', 'PNL', 'GST', 'DAYBOOK', 'STOCK'
  const [period, setPeriod] = useState('MONTHLY'); // 'TODAY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM', 'ALL'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dayBookDate, setDayBookDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStockWarehouse, setSelectedStockWarehouse] = useState('ALL');

  const warehouses = fetchWarehouses();
  const bankTransactions = fetchBankTransactions();

  // Date Filtering Helper
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
  const getInvTaxable = (inv) => Number(inv.taxableAmount || inv.taxableSubtotal || inv.subTotal || inv.subtotal || (Number(inv.grandTotal || 0) - (Number(inv.cgst || 0) + Number(inv.sgst || 0) + Number(inv.igst || 0)))) || 0;
  const netTaxableRevenue = filteredInvoices.reduce((sum, inv) => sum + getInvTaxable(inv), 0);

  // Profit & Loss (COGS & Margins) Calculations
  const pnlData = useMemo(() => {
    let totalCogs = 0;
    let totalDiscounts = 0;

    filteredInvoices.forEach(inv => {
      totalDiscounts += Number(inv.discount) || 0;
      (inv.items || []).forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        const purchaseCost = p ? Number(p.purchasePrice || 0) : (Number(item.price || 0) * 0.75);
        totalCogs += purchaseCost * (Number(item.qty) || 0);
      });
    });

    const grossRevenue = netTaxableRevenue;
    const grossProfit = Math.max(0, grossRevenue - totalCogs);
    const grossMarginPct = grossRevenue > 0 ? ((grossProfit / grossRevenue) * 100).toFixed(1) : '0.0';

    return {
      grossSales: totalSales,
      discounts: totalDiscounts,
      netTaxableRevenue: grossRevenue,
      cogs: totalCogs,
      grossProfit,
      grossMarginPct,
      netTaxCollected: totalTax
    };
  }, [filteredInvoices, products, netTaxableRevenue, totalSales, totalTax]);

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

  // Export GSTR-1 CSV
  const handleExportGstr1Csv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Section,Invoice No,Date,Customer Name,GSTIN,Taxable Value,CGST,SGST,IGST,Total Amount\n';

    // B2B Section
    b2bInvoices.forEach(inv => {
      csvContent += `B2B,"${inv.invoiceNo}","${inv.date?.split('T')[0]}","${inv.partyName || inv.customerName}","${inv.partyGstin}",${getInvTaxable(inv).toFixed(2)},${Number(inv.cgst || 0).toFixed(2)},${Number(inv.sgst || 0).toFixed(2)},${Number(inv.igst || 0).toFixed(2)},${Number(inv.grandTotal || 0).toFixed(2)}\n`;
    });

    // B2C Section
    b2cInvoices.forEach(inv => {
      csvContent += `B2C_SMALL,"${inv.invoiceNo}","${inv.date?.split('T')[0]}","${inv.partyName || inv.customerName || 'Cash Consumer'}","URP",${getInvTaxable(inv).toFixed(2)},${Number(inv.cgst || 0).toFixed(2)},${Number(inv.sgst || 0).toFixed(2)},${Number(inv.igst || 0).toFixed(2)},${Number(inv.grandTotal || 0).toFixed(2)}\n`;
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

  // Period Text Header
  const getPeriodLabel = () => {
    switch (period) {
      case 'TODAY': return 'आज की रिपोर्ट (Today)';
      case 'WEEKLY': return 'साप्ताहिक रिपोर्ट (Weekly - Last 7 Days)';
      case 'MONTHLY': return 'मासिक रिपोर्ट (Monthly - Last 30 Days)';
      case 'QUARTERLY': return 'तिमाही रिपोर्ट (Quarterly - Last 90 Days)';
      case 'YEARLY': return 'वार्षिक रिपोर्ट (Yearly - Last 1 Year)';
      case 'CUSTOM': return `कस्टम अवधि (${startDate || 'प्रारंभ'} से ${endDate || 'आज'})`;
      default: return 'कुल सर्वकालिक रिपोर्ट (All Time)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* MODULE REPORT TABS (Hidden on Print) */}
      <div className="glass-card no-print" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setReportTab('SALES')}
          className={`btn btn-sm ${reportTab === 'SALES' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700' }}
        >
          <TrendingUp size={15} />
          <span>बिक्री व परफॉरमेंस (Sales Analytics)</span>
        </button>

        <button 
          onClick={() => setReportTab('PNL')}
          className={`btn btn-sm ${reportTab === 'PNL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700' }}
        >
          <PieChart size={15} />
          <span>लाभ-हानि खाता (Profit & Loss)</span>
        </button>

        <button 
          onClick={() => setReportTab('GST')}
          className={`btn btn-sm ${reportTab === 'GST' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700' }}
        >
          <ShieldCheck size={15} />
          <span>GST रिटर्न फाइलिंग (GSTR-1 & 3B)</span>
        </button>

        <button 
          onClick={() => setReportTab('DAYBOOK')}
          className={`btn btn-sm ${reportTab === 'DAYBOOK' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700' }}
        >
          <BookOpen size={15} />
          <span>दैनिक रोकड़ बही (Day Book / Cashbook)</span>
        </button>

        <button 
          onClick={() => setReportTab('STOCK')}
          className={`btn btn-sm ${reportTab === 'STOCK' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700' }}
        >
          <Package size={15} />
          <span>स्टॉक वैल्यूएशन (Stock Valuation)</span>
        </button>
      </div>

      {/* PERIOD SELECTOR & ACTIONS (Hidden for DayBook & Stock) */}
      {(reportTab === 'SALES' || reportTab === 'PNL' || reportTab === 'GST') && (
        <div className="glass-card no-print" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', flex: 1 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '2px' }}>
              <Calendar size={15} />
              अवधि:
            </span>

            <button type="button" onClick={() => setPeriod('TODAY')} className={`btn btn-sm ${period === 'TODAY' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>आज (Today)</button>
            <button type="button" onClick={() => setPeriod('WEEKLY')} className={`btn btn-sm ${period === 'WEEKLY' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>साप्ताहिक</button>
            <button type="button" onClick={() => setPeriod('MONTHLY')} className={`btn btn-sm ${period === 'MONTHLY' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>मासिक</button>
            <button type="button" onClick={() => setPeriod('QUARTERLY')} className={`btn btn-sm ${period === 'QUARTERLY' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>तिमाही</button>
            <button type="button" onClick={() => setPeriod('YEARLY')} className={`btn btn-sm ${period === 'YEARLY' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>वार्षिक</button>
            <button type="button" onClick={() => setPeriod('ALL')} className={`btn btn-sm ${period === 'ALL' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>सभी</button>
            <button type="button" onClick={() => setPeriod('CUSTOM')} className={`btn btn-sm ${period === 'CUSTOM' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>कस्टम</button>
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
      {period === 'CUSTOM' && (reportTab === 'SALES' || reportTab === 'PNL' || reportTab === 'GST') && (
        <div className="glass-card no-print" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>प्रारंभ तिथि:</label>
            <input type="date" className="input-field" style={{ width: 'auto' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>अंतिम तिथि:</label>
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
                GSTIN: {business?.gstin || 'N/A'} • Phone: {business?.phone || 'N/A'}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="badge badge-info" style={{ fontSize: '0.85rem', padding: '6px 12px', fontWeight: '800' }}>
                {reportTab === 'SALES' && `📊 Sales Report • ${getPeriodLabel()}`}
                {reportTab === 'PNL' && `📈 P&L Statement • ${getPeriodLabel()}`}
                {reportTab === 'GST' && `🏛️ GST Returns • ${getPeriodLabel()}`}
                {reportTab === 'DAYBOOK' && `📖 Day Book • ${dayBookDate}`}
                {reportTab === 'STOCK' && `📦 Stock Valuation • ${new Date().toLocaleDateString('en-IN')}`}
              </span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                तारीख: {new Date().toLocaleDateString('en-IN')}
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
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>कुल कारोबार (Total Revenue)</span>
                  <TrendingUp size={20} color="#10b981" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                  ₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {filteredInvoices.length} इनवॉइस बिल जारी
                </p>
              </div>

              <div className="glass-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>प्राप्त नकद (Collected Cash)</span>
                  <IndianRupee size={20} color="#34d399" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#34d399', margin: 0 }}>
                  ₹{totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  जमा व नकद भुगतान
                </p>
              </div>

              <div className="glass-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>बकाया बाजार उधार (Market Udhar)</span>
                  <IndianRupee size={20} color="#fbbf24" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fbbf24', margin: 0 }}>
                  ₹{totalUdhar.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  रिटेलर्स पर बकाया अनपेड राशि
                </p>
              </div>

              <div className="glass-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>GST टैक्स कलेक्शन</span>
                  <ShieldCheck size={20} color="#818cf8" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#818cf8', margin: 0 }}>
                  ₹{totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  CGST: ₹{totalCgst.toFixed(2)} | SGST: ₹{totalSgst.toFixed(2)}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              {/* Top Products Table */}
              <div className="glass-card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <Award size={20} color="var(--primary)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>
                    प्रोडक्ट बिक्री रिपोर्ट (Product-wise Sales Performance)
                  </h3>
                </div>

                {topProducts.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    इस अवधि में कोई बिक्री रिकॉर्ड नहीं पाया गया।
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '8px' }}>#</th>
                          <th style={{ padding: '8px' }}>प्रोडक्ट नाम</th>
                          <th style={{ padding: '8px' }}>SKU</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>बिकी मात्रा (Units)</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>कुल बिक्री रकम (₹)</th>
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
                    रिटेलर / पार्टी बिक्री रिपोर्ट (Party-wise Sales & Udhar Breakdown)
                  </h3>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px' }}>#</th>
                        <th style={{ padding: '8px' }}>पार्टी / ग्राहक नाम</th>
                        <th style={{ padding: '8px' }}>फोन</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>कुल बिल</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>कुल बिक्री रकम (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>बकाया उधार (₹)</th>
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
        {/* TAB 2: PROFIT & LOSS STATEMENT */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'PNL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* P&L Metric Highlights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>शुद्ध बिक्री (Net Taxable Sales)</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)', margin: '6px 0 0 0' }}>
                  ₹{pnlData.netTaxableRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Discounts: ₹{pnlData.discounts.toLocaleString('en-IN')}</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #ef4444' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>सामान की लागत (Cost of Goods Sold - COGS)</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#dc2626', margin: '6px 0 0 0' }}>
                  ₹{pnlData.cogs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Based on actual purchase rates</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>सकल मुनाफा (Gross Profit)</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#059669', margin: '6px 0 0 0' }}>
                  ₹{pnlData.grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: '700' }}>Margin: {pnlData.grossMarginPct}%</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #8b5cf6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>कुल एकत्रित GST (Tax Output)</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#7c3aed', margin: '6px 0 0 0' }}>
                  ₹{pnlData.netTaxCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Payable to Government</span>
              </div>
            </div>

            {/* Detailed Statement Table */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                वित्तीय लाभ-हानि विवरण (Comprehensive Profit & Loss Statement)
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <tbody>
                    <tr style={{ background: '#f8fafc', fontWeight: '800', borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px' }} colSpan="2">A. राजस्व (REVENUE FROM OPERATIONS)</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>रकम (₹)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 24px' }}>1. सकल इनवॉइस बिक्री (Gross Invoices Issued)</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{filteredInvoices.length} Bills</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 24px' }}>2. घटाएं: व्यापार छूट (Less: Customer Discounts Allowed)</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Direct Scheme/Bill Off</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>- ₹{pnlData.discounts.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: '700', background: '#f0fdf4' }}>
                      <td style={{ padding: '12px 24px', color: '#166534' }}>शुद्ध कर-योग्य बिक्री राजस्व (Net Taxable Turnover)</td>
                      <td></td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#166534', fontSize: '1.05rem' }}>₹{pnlData.netTaxableRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>

                    <tr style={{ background: '#f8fafc', fontWeight: '800', borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', paddingTop: '20px' }} colSpan="2">B. प्रत्यक्ष लागत (COST OF GOODS SOLD - COGS)</td>
                      <td style={{ padding: '12px', textAlign: 'right', paddingTop: '20px' }}>रकम (₹)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 24px' }}>1. बेचे गए माल की खरीद लागत (Purchase Cost of Items Sold)</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Wholesale Inward Cost</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>₹{pnlData.cogs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: '700', background: '#fef2f2' }}>
                      <td style={{ padding: '12px 24px', color: '#991b1b' }}>कुल प्रत्यक्ष सामान लागत (Total COGS)</td>
                      <td></td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#991b1b', fontSize: '1.05rem' }}>₹{pnlData.cogs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>

                    <tr style={{ background: '#ecfdf5', fontWeight: '800', borderBottom: '2px solid #059669' }}>
                      <td style={{ padding: '16px 24px', fontSize: '1.1rem', color: '#065f46' }}>
                        C. कुल सकल व्यापार लाभ (GROSS PROFIT)
                      </td>
                      <td style={{ padding: '16px', color: '#065f46', fontWeight: '700' }}>
                        मार्जिन दर: {pnlData.grossMarginPct}%
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', fontSize: '1.25rem', color: '#065f46', fontWeight: '900' }}>
                        ₹{pnlData.grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: GST RETURN FILING (GSTR-1 & GSTR-3B) */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'GST' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* GSTR-1 Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>B2B इनवॉइस (Registered Buyers)</span>
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
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CGST देयता (Central Tax)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#d97706', margin: '4px 0 0 0' }}>
                  ₹{totalCgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Matched intra-state</span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #8b5cf6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SGST देयता (State Tax)</span>
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
                  🏛️ GSTR-3B तालिका 3.1: बाह्य आपूर्ति और कर देयता सारांश (Outward Tax Liability)
                </h3>
                <span className="badge badge-success">GSTR-3B Ready</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>विवरण (Nature of Supplies)</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>कुल कर-योग्य मूल्य (Taxable Value ₹)</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>IGST (₹)</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>CGST (₹)</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>SGST (₹)</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>कुल कर देयता (Total Tax ₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: '600' }}>(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>₹{netTaxableRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalIgst.toFixed(2)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalCgst.toFixed(2)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalSgst.toFixed(2)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>₹{totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ background: '#f8fafc', fontWeight: '800' }}>
                      <td style={{ padding: '10px' }}>कुल शुद्ध देय राशि (Net Tax Liability to be Paid)</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{netTaxableRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalIgst.toFixed(2)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalCgst.toFixed(2)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{totalSgst.toFixed(2)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#059669' }}>₹{totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* HSN Summary Table (GSTR-1 Table 12) */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                  📦 GSTR-1 तालिका 12: HSN कोड सारांश (HSN-wise Summary of Outward Supplies)
                </h3>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>HSN कोड</th>
                      <th style={{ padding: '8px' }}>विवरण</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>इकाई (UQC)</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>कुल मात्रा</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>कर-योग्य मूल्य (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>CGST (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>SGST (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>कुल कर (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hsnMap.map((h, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', fontWeight: '800', color: 'var(--primary)' }}>{h.hsn}</td>
                        <td style={{ padding: '8px', fontWeight: '600' }}>{h.description}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{h.uqc}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{h.totalQty}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>₹{h.taxableValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>₹{h.cgst.toFixed(2)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>₹{h.sgst.toFixed(2)}</td>
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
        {/* TAB 4: DAY BOOK / CASHBOOK REGISTER */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'DAYBOOK' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Date Selector for DayBook */}
            <div className="glass-card no-print" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={18} color="var(--primary)" />
                <label style={{ fontWeight: '700', fontSize: '0.88rem' }}>दैनिक रोकड़ तिथि (Select Date):</label>
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
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>आज की कुल बिक्री (Day Turnover)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', margin: '4px 0 0 0' }}>
                  ₹{dayBookData.dayTotalTurnover.toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>{dayBookData.dayInvoices.length} Bills issued</span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #059669' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>नकद प्राप्ति (Cash Inflow)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#059669', margin: '4px 0 0 0' }}>
                  ₹{dayBookData.dayCashSales.toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Hand cash collection</span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>UPI / बैंक संग्रह (Digital / Bank)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#2563eb', margin: '4px 0 0 0' }}>
                  ₹{(dayBookData.dayUpiSales + dayBookData.dayBankSales).toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Direct account credits</span>
              </div>

              <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>आज का नया उधार (Day Udhar Given)</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#d97706', margin: '4px 0 0 0' }}>
                  ₹{dayBookData.dayCreditSales.toLocaleString('en-IN')}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Credit allowed today</span>
              </div>
            </div>

            {/* Chronological Day Vouchers Table */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                📖 दैनिक वाउचर व रसीद सूची (Daily Transaction Chronology)
              </h3>

              {dayBookData.dayInvoices.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  तिथि {dayBookDate} के लिए कोई बिलिंग प्रविष्टि नहीं पाई गई।
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>समय</th>
                        <th style={{ padding: '8px' }}>बिल / वाउचर नं.</th>
                        <th style={{ padding: '8px' }}>पार्टी का नाम</th>
                        <th style={{ padding: '8px' }}>भुगतान माध्यम</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>कुल बिल राशि (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>नकद जमा (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>उधार शेष (₹)</th>
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
        {/* TAB 5: STOCK VALUATION REPORT */}
        {/* ------------------------------------------------------------- */}
        {reportTab === 'STOCK' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Warehouse Filter */}
            <div className="glass-card no-print" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={18} color="var(--primary)" />
                <label style={{ fontWeight: '700', fontSize: '0.88rem' }}>वेयरहाउस चुनें (Select Warehouse):</label>
                <select 
                  className="input-field select-field"
                  style={{ width: 'auto', padding: '6px 14px' }}
                  value={selectedStockWarehouse}
                  onChange={e => setSelectedStockWarehouse(e.target.value)}
                >
                  <option value="ALL">सभी वेयरहाउस (All Depots & Warehouses)</option>
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
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>कुल उपलब्ध स्टॉक (Total Units)</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', margin: '4px 0 0 0' }}>
                  {stockValuationData.totalUnits.toLocaleString('en-IN')} Pcs / Units
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Across {stockValuationData.list.length} catalog items</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #ef4444' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>खरीद मूल्य मूल्यांकन (Valuation @ Cost)</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#dc2626', margin: '4px 0 0 0' }}>
                  ₹{stockValuationData.totalPurchaseVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Total capital tied up in stock</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>बिक्री मूल्य मूल्यांकन (Valuation @ Retail)</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#059669', margin: '4px 0 0 0' }}>
                  ₹{stockValuationData.totalSaleVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Expected market realization</span>
              </div>

              <div className="glass-card" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>संभावित सकल मुनाफा (Potential Margin)</span>
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
                  📦 स्टॉक मूल्यांकन व संभावित लाभ सूची (Item-wise Valuation Ledger)
                </h3>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>#</th>
                      <th style={{ padding: '8px' }}>प्रोडक्ट नाम</th>
                      <th style={{ padding: '8px' }}>ब्रांड / SKU</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>स्टॉक मात्रा</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>खरीद दर (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>बिक्री दर (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>लागत मूल्य (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>बिक्री मूल्य (₹)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>संभावित लाभ (₹)</th>
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

    </div>
  );
}
