import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  IndianRupee, 
  AlertTriangle, 
  Users, 
  Receipt, 
  Plus, 
  ArrowUpRight, 
  Eye, 
  Printer, 
  Boxes,
  CheckCircle2,
  Clock,
  Search,
  X,
  MessageCircle,
  Phone,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Layers,
  ShoppingBag,
  Wallet,
  Coins,
  ArrowRight,
  Percent,
  LayoutGrid
} from 'lucide-react';

export default function Dashboard({ products = [], parties = [], invoices = [], business, setActiveTab, handlePrintInvoice, t = (k) => k }) {
  const [timeRange, setTimeRange] = useState('7d'); // 'today', '7d', '30d', 'all'
  const [pieMode, setPieMode] = useState('revenue'); // 'revenue' or 'stock'
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [hoveredHistIndex, setHoveredHistIndex] = useState(null);

  const [udharModalOpen, setUdharModalOpen] = useState(false);
  const [udharSearchTerm, setUdharSearchTerm] = useState('');

  // 1. Filter invoices based on selected time range
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const filteredInvoices = useMemo(() => {
    if (timeRange === 'all') return invoices;
    if (timeRange === 'today') {
      return invoices.filter(inv => inv.date?.startsWith(todayStr));
    }
    const days = timeRange === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return invoices.filter(inv => (inv.date || '').split('T')[0] >= cutoffStr);
  }, [invoices, timeRange, todayStr]);

  // 2. High-level KPI Calculations
  const todayInvoices = useMemo(() => invoices.filter(inv => inv.date?.startsWith(todayStr)), [invoices, todayStr]);
  const todaySales = useMemo(() => todayInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0), [todayInvoices]);

  const rangeTurnover = useMemo(() => filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0), [filteredInvoices]);
  const rangeInvoicesCount = filteredInvoices.length;
  const averageOrderValue = rangeInvoicesCount > 0 ? (rangeTurnover / rangeInvoicesCount) : 0;

  // Estimated COGS & Profit for filtered range
  const rangeCost = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      if (!Array.isArray(inv.items)) return sum;
      return sum + inv.items.reduce((iSum, itm) => {
        const p = products.find(prod => prod.id === itm.productId || prod.name === itm.name);
        const buyCost = p?.purchasePrice || (itm.rate * 0.75); // fallback cost estimate
        return iSum + (buyCost * (itm.quantity || 1));
      }, 0);
    }, 0);
  }, [filteredInvoices, products]);

  const estimatedGrossProfit = Math.max(0, rangeTurnover - rangeCost);
  const grossMarginPercent = rangeTurnover > 0 ? ((estimatedGrossProfit / rangeTurnover) * 100) : 0;

  // Inventory & Stock stats
  const totalStockValue = useMemo(() => products.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.purchasePrice || 0)), 0), [products]);
  const totalStockItems = useMemo(() => products.reduce((sum, p) => sum + (p.currentStock || 0), 0), [products]);
  const lowStockProducts = useMemo(() => products.filter(p => p.currentStock <= (p.minStockLimit || 10)), [products]);

  // Parties & Khata stats
  const totalOutstandingBalance = useMemo(() => parties.reduce((sum, prt) => sum + (prt.balance || 0), 0), [parties]);
  const dueParties = useMemo(() => parties.filter(p => (p.balance || 0) > 0), [parties]);

  const filteredDueParties = useMemo(() => {
    return dueParties.filter(p => 
      p.name?.toLowerCase().includes(udharSearchTerm.toLowerCase()) ||
      p.phone?.includes(udharSearchTerm) ||
      (p.city && p.city.toLowerCase().includes(udharSearchTerm.toLowerCase())) ||
      (p.address && p.address.toLowerCase().includes(udharSearchTerm.toLowerCase()))
    );
  }, [dueParties, udharSearchTerm]);

  const sendWhatsAppReminder = (party) => {
    const cleanPhone = party.phone ? party.phone.replace(/[^0-9]/g, '') : '';
    const message = `Hello ${party.name},\n\nYour total outstanding balance with ${business?.name || 'DistroPulse Distributor'} is ₹${party.balance?.toLocaleString('en-IN')}.\n\nKindly arrange payment at your earliest convenience.\nThank you!`;
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // 3. BAR DIAGRAM DATA: Group sales by date for the selected period
  const barChartData = useMemo(() => {
    const dayCount = timeRange === 'today' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 14 : 10;
    const dateMap = {};

    // Generate consecutive dates
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = timeRange === 'today' 
        ? 'Today' 
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateMap[key] = { key, label, total: 0, cash: 0, upi: 0, credit: 0, count: 0 };
    }

    filteredInvoices.forEach(inv => {
      const dateKey = (inv.date || '').split('T')[0];
      if (dateMap[dateKey]) {
        const amt = Number(inv.grandTotal) || 0;
        dateMap[dateKey].total += amt;
        dateMap[dateKey].count += 1;
        if (inv.paymentMode === 'CASH') dateMap[dateKey].cash += amt;
        else if (inv.paymentMode === 'UPI' || inv.paymentMode === 'BANK') dateMap[dateKey].upi += amt;
        else dateMap[dateKey].credit += amt;
      }
    });

    return Object.values(dateMap);
  }, [filteredInvoices, timeRange]);

  const maxBarTotal = Math.max(...barChartData.map(b => b.total), 1000);

  // 4. PIE / DONUT CHART DATA: Category-wise distribution
  const pieChartData = useMemo(() => {
    const catMap = {};
    const defaultCategories = [
      'Snacks & Wafers',
      'Chocolates & Confectionery',
      'Biscuits & Bakery',
      'Cold Drinks & Beverages',
      'Personal Care & Soaps',
      'General FMCG Grocery'
    ];

    const colors = [
      '#f59e0b', // Amber / Snacks
      '#8b5cf6', // Violet / Chocolates
      '#ec4899', // Pink / Biscuits
      '#06b6d4', // Cyan / Cold Drinks
      '#10b981', // Emerald / Personal Care
      '#6366f1', // Indigo / Grocery
      '#f97316'  // Orange / Other
    ];

    defaultCategories.forEach((cat, idx) => {
      catMap[cat] = { name: cat, value: 0, color: colors[idx % colors.length] };
    });

    if (pieMode === 'revenue') {
      filteredInvoices.forEach(inv => {
        if (Array.isArray(inv.items)) {
          inv.items.forEach(itm => {
            const prod = products.find(p => p.id === itm.productId || p.name === itm.name);
            const cat = prod?.category || 'General FMCG Grocery';
            if (!catMap[cat]) {
              catMap[cat] = { name: cat, value: 0, color: colors[Object.keys(catMap).length % colors.length] };
            }
            catMap[cat].value += (itm.quantity || 1) * (itm.rate || 0);
          });
        }
      });
    } else {
      // Stock Volume Mode
      products.forEach(p => {
        const cat = p.category || 'General FMCG Grocery';
        if (!catMap[cat]) {
          catMap[cat] = { name: cat, value: 0, color: colors[Object.keys(catMap).length % colors.length] };
        }
        catMap[cat].value += (p.currentStock || 0);
      });
    }

    const totalVal = Object.values(catMap).reduce((s, c) => s + c.value, 0);
    const validSegments = Object.values(catMap).filter(c => c.value > 0);

    // If all are zero, provide default mock visual slices
    if (validSegments.length === 0) {
      return {
        total: 100,
        segments: [
          { name: 'Snacks & Wafers', value: 40, percent: 40, color: '#f59e0b' },
          { name: 'Chocolates & Confectionery', value: 25, percent: 25, color: '#8b5cf6' },
          { name: 'Biscuits & Bakery', value: 20, percent: 20, color: '#ec4899' },
          { name: 'Cold Drinks & Beverages', value: 15, percent: 15, color: '#06b6d4' }
        ]
      };
    }

    const segments = validSegments.map(c => ({
      ...c,
      percent: Math.round((c.value / totalVal) * 100)
    })).sort((a, b) => b.value - a.value);

    return { total: totalVal, segments };
  }, [filteredInvoices, products, pieMode]);

  // SVG Pie chart helper: generate path arc string
  const piePaths = useMemo(() => {
    let cumulativePercent = 0;
    const radius = 80;
    const centerX = 100;
    const centerY = 100;
    const innerRadius = 45; // Donut hole

    return pieChartData.segments.map((slice, idx) => {
      const startAngle = cumulativePercent * 2 * Math.PI;
      cumulativePercent += slice.percent / 100;
      const endAngle = cumulativePercent * 2 * Math.PI;

      const x1 = centerX + radius * Math.sin(startAngle);
      const y1 = centerY - radius * Math.cos(startAngle);
      const x2 = centerX + radius * Math.sin(endAngle);
      const y2 = centerY - radius * Math.cos(endAngle);

      const ix1 = centerX + innerRadius * Math.sin(endAngle);
      const iy1 = centerY - innerRadius * Math.cos(endAngle);
      const ix2 = centerX + innerRadius * Math.sin(startAngle);
      const iy2 = centerY - innerRadius * Math.cos(startAngle);

      const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

      const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;

      return {
        ...slice,
        path: pathData,
        index: idx
      };
    });
  }, [pieChartData]);

  // 5. HISTOGRAM DATA: Frequency Distribution of Order/Invoice Values
  const histogramData = useMemo(() => {
    const bins = [
      { label: '₹0 - 500', min: 0, max: 500, count: 0, total: 0, name: 'Micro Retail' },
      { label: '₹500 - 1.5K', min: 500, max: 1500, count: 0, total: 0, name: 'Small Grocery' },
      { label: '₹1.5K - 3K', min: 1500, max: 3000, count: 0, total: 0, name: 'Medium Store' },
      { label: '₹3K - 5K', min: 3000, max: 5000, count: 0, total: 0, name: 'Supermarket' },
      { label: '₹5K+', min: 5000, max: Infinity, count: 0, total: 0, name: 'Wholesale / Depot' }
    ];

    filteredInvoices.forEach(inv => {
      const val = Number(inv.grandTotal) || 0;
      for (const bin of bins) {
        if (val >= bin.min && val < bin.max) {
          bin.count += 1;
          bin.total += val;
          break;
        }
      }
    });

    const maxCount = Math.max(...bins.map(b => b.count), 1);
    const totalBills = filteredInvoices.length || 1;

    return {
      bins: bins.map(b => ({
        ...b,
        frequencyPercent: Math.round((b.count / totalBills) * 100)
      })),
      maxCount
    };
  }, [filteredInvoices]);

  // 6. PAYMENT MODE BREAKDOWN
  const paymentModeStats = useMemo(() => {
    let cash = 0, upi = 0, credit = 0, cheque = 0;
    filteredInvoices.forEach(inv => {
      const amt = Number(inv.grandTotal) || 0;
      if (inv.paymentMode === 'CASH') cash += amt;
      else if (inv.paymentMode === 'UPI' || inv.paymentMode === 'ONLINE') upi += amt;
      else if (inv.paymentMode === 'CHEQUE') cheque += amt;
      else credit += amt; // CREDIT / KHATA
    });
    const total = cash + upi + credit + cheque || 1;
    return {
      cash, upi, credit, cheque,
      cashPct: Math.round((cash / total) * 100),
      upiPct: Math.round((upi / total) * 100),
      creditPct: Math.round((credit / total) * 100),
      chequePct: Math.round((cheque / total) * 100)
    };
  }, [filteredInvoices]);

  // 7. Top 5 Fast Moving Products (Horizontal Bar Diagram)
  const topProducts = useMemo(() => {
    const prodMap = {};
    filteredInvoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach(itm => {
          const key = itm.name || 'Item';
          if (!prodMap[key]) prodMap[key] = { name: key, qty: 0, revenue: 0 };
          prodMap[key].qty += (itm.quantity || 1);
          prodMap[key].revenue += (itm.quantity || 1) * (itm.rate || 0);
        });
      }
    });
    const list = Object.values(prodMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
    const maxQty = Math.max(...list.map(p => p.qty), 1);
    return list.map(p => ({ ...p, pct: Math.round((p.qty / maxQty) * 100) }));
  }, [filteredInvoices]);

  const recentInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  }, [invoices]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* TOP CONTROLS & WELCOME BANNER */}
      <div className="glass-card" style={{ 
        padding: '22px 24px', 
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
          }}>
            <BarChart3 size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
              Main Dashboard & Financial Analytics
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Real-time Business Performance • Interactive Diagrams, Pie Charts, Bar Graphs & Histograms
            </p>
          </div>
        </div>

        {/* Time Period Filter Pill & Launcher shortcut */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ 
            display: 'inline-flex', 
            background: 'rgba(0,0,0,0.04)', 
            padding: '4px', 
            borderRadius: '24px', 
            border: '1px solid var(--border-color)' 
          }}>
            <button
              onClick={() => setTimeRange('today')}
              className={`btn btn-sm ${timeRange === 'today' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 12px', borderRadius: '18px', fontSize: '0.78rem' }}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`btn btn-sm ${timeRange === '7d' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 12px', borderRadius: '18px', fontSize: '0.78rem' }}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`btn btn-sm ${timeRange === '30d' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 12px', borderRadius: '18px', fontSize: '0.78rem' }}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`btn btn-sm ${timeRange === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 12px', borderRadius: '18px', fontSize: '0.78rem' }}
            >
              All Time
            </button>
          </div>

          <button
            onClick={() => setActiveTab('home')}
            className="btn btn-secondary btn-sm"
            style={{ gap: '6px', padding: '6px 14px', borderRadius: '20px' }}
            title="Open Odoo-style Front Page App Launcher"
          >
            <LayoutGrid size={15} />
            <span>App Launcher</span>
          </button>
        </div>
      </div>

      {/* 6 EXECUTIVE STAT CARDS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px' 
      }}>
        {/* Total Turnover */}
        <div className="glass-card" style={{ padding: '18px 20px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>TURNOVER ({timeRange.toUpperCase()})</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="#059669" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
            ₹{rangeTurnover.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </h3>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {rangeInvoicesCount} invoices issued
          </p>
        </div>

        {/* Estimated Gross Profit */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>GROSS PROFIT & MARGIN</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Percent size={18} color="#4f46e5" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#4f46e5', margin: 0 }}>
            ₹{estimatedGrossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </h3>
          <p style={{ fontSize: '0.76rem', color: '#059669', fontWeight: '700', marginTop: '4px' }}>
            {grossMarginPercent.toFixed(1)}% Gross Margin
          </p>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>AVG BASKET SIZE (AOV)</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={18} color="#0284c7" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
            ₹{averageOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </h3>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Per transaction ticket
          </p>
        </div>

        {/* Khata / Udhar Outstanding */}
        <div 
          onClick={() => setUdharModalOpen(true)}
          className="glass-card glass-card-interactive" 
          style={{ padding: '18px 20px', cursor: 'pointer', border: '1px solid rgba(245, 158, 11, 0.35)' }}
          title="Click to view retailers with pending dues"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#d97706' }}>KHATA BALANCE (DUE)</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={18} color="#d97706" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#c2410c', margin: 0 }}>
            ₹{totalOutstandingBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            <p style={{ fontSize: '0.76rem', color: '#d97706', margin: 0 }}>
              {dueParties.length} retailers
            </p>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#0284c7' }}>View List →</span>
          </div>
        </div>

        {/* Total Stock Valuation */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>STOCK VALUATION</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes size={18} color="#8b5cf6" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
            ₹{totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </h3>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {totalStockItems} physical units • {products.length} SKUs
          </p>
        </div>

        {/* Low Stock Warning */}
        <div 
          onClick={() => setActiveTab('inventory')}
          className="glass-card glass-card-interactive" 
          style={{ padding: '18px 20px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: lowStockProducts.length > 0 ? '#ef4444' : 'var(--text-muted)' }}>
              LOW STOCK ALERTS
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: lowStockProducts.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} color={lowStockProducts.length > 0 ? '#ef4444' : '#10b981'} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: lowStockProducts.length > 0 ? '#ef4444' : '#10b981', margin: 0 }}>
            {lowStockProducts.length} Items
          </h3>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {lowStockProducts.length > 0 ? 'Urgent replenishment needed' : 'All stock levels optimal'}
          </p>
        </div>
      </div>

      {/* DIAGRAM SECTION 1: BAR DIAGRAM (Turnover & Collections Over Time) */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={20} color="#059669" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                Bar Diagram: Sales Turnover & Collection Trends
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Chronological daily breakdown showing Cash, UPI Digital & Khata (Credit) billings
            </p>
          </div>

          {/* Bar Diagram Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.78rem', fontWeight: '700' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981', display: 'inline-block' }} />
              <span>Cash Billing</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6', display: 'inline-block' }} />
              <span>UPI / Bank</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b', display: 'inline-block' }} />
              <span>Khata (Credit)</span>
            </span>
          </div>
        </div>

        {/* SVG Interactive Bar Chart */}
        <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
          <div style={{ minWidth: '600px', height: '240px', position: 'relative' }}>
            
            {/* Gridlines */}
            <div style={{ position: 'absolute', top: 0, left: 50, right: 20, bottom: 30, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <span style={{ width: '45px', fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'right', marginRight: '8px' }}>
                    ₹{Math.round(maxBarTotal * ratio).toLocaleString('en-IN')}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-color)', opacity: 0.7 }} />
                </div>
              ))}
            </div>

            {/* Bars Container */}
            <div style={{ 
              position: 'absolute', 
              top: 10, 
              left: 60, 
              right: 20, 
              bottom: 30, 
              display: 'flex', 
              alignItems: 'flex-end', 
              justifyContent: 'space-around', 
              gap: '12px',
              padding: '0 10px'
            }}>
              {barChartData.map((bar, idx) => {
                const totalHeightPct = (bar.total / maxBarTotal) * 100;
                const cashHeightPct = bar.total > 0 ? (bar.cash / bar.total) * 100 : 0;
                const upiHeightPct = bar.total > 0 ? (bar.upi / bar.total) * 100 : 0;
                const creditHeightPct = bar.total > 0 ? (bar.credit / bar.total) * 100 : 0;

                const isHovered = hoveredBarIndex === idx;

                return (
                  <div
                    key={bar.key}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    style={{
                      flex: 1,
                      maxWidth: '52px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    {/* Tooltip on Hover */}
                    {isHovered && (
                      <div style={{
                        position: 'absolute',
                        bottom: `calc(${Math.min(totalHeightPct + 10, 85)}% + 10px)`,
                        zIndex: 20,
                        background: '#0f172a',
                        color: '#ffffff',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '0.76rem',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        <div style={{ fontWeight: '800', color: '#67e8f9', marginBottom: '3px' }}>{bar.label} ({bar.count} bills)</div>
                        <div>Total: <strong>₹{bar.total.toLocaleString('en-IN')}</strong></div>
                        <div style={{ color: '#86efac' }}>Cash: ₹{bar.cash.toLocaleString('en-IN')}</div>
                        <div style={{ color: '#93c5fd' }}>UPI: ₹{bar.upi.toLocaleString('en-IN')}</div>
                        <div style={{ color: '#fde68a' }}>Credit: ₹{bar.credit.toLocaleString('en-IN')}</div>
                      </div>
                    )}

                    {/* Total Amount Badge on Bar top */}
                    {bar.total > 0 && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        color: isHovered ? 'var(--primary)' : 'var(--text-muted)',
                        marginBottom: '4px'
                      }}>
                        ₹{bar.total >= 1000 ? `${(bar.total/1000).toFixed(1)}k` : bar.total}
                      </span>
                    )}

                    {/* Stacked Bar Column */}
                    <div style={{
                      width: '100%',
                      height: `${Math.max(totalHeightPct, 4)}%`,
                      borderRadius: '6px 6px 0 0',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isHovered ? 'scaleY(1.04)' : 'scaleY(1)',
                      boxShadow: isHovered ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
                      background: bar.total === 0 ? 'rgba(0,0,0,0.04)' : 'transparent'
                    }}>
                      {/* Cash Segment */}
                      <div style={{ height: `${cashHeightPct}%`, background: '#10b981' }} />
                      {/* UPI Segment */}
                      <div style={{ height: `${upiHeightPct}%`, background: '#3b82f6' }} />
                      {/* Credit Segment */}
                      <div style={{ height: `${creditHeightPct}%`, background: '#f59e0b' }} />
                    </div>

                    {/* X-Axis Date Label */}
                    <span style={{
                      position: 'absolute',
                      bottom: '-24px',
                      fontSize: '0.72rem',
                      fontWeight: isHovered ? '800' : '600',
                      color: isHovered ? 'var(--primary)' : 'var(--text-muted)',
                      whiteSpace: 'nowrap'
                    }}>
                      {bar.label}
                    </span>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      {/* DIAGRAM SECTION 2: PIE CHART & PAYMENT BREAKDOWN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* PIE / DONUT CHART: Category Distribution */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChartIcon size={20} color="#7c3aed" />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                  Pie Chart: Category Distribution
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Product Category Turnover & Volume Breakdown
                </p>
              </div>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', padding: '3px', borderRadius: '18px', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setPieMode('revenue')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '14px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  border: 'none',
                  background: pieMode === 'revenue' ? '#7c3aed' : 'transparent',
                  color: pieMode === 'revenue' ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Revenue
              </button>
              <button
                onClick={() => setPieMode('stock')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '14px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  border: 'none',
                  background: pieMode === 'stock' ? '#7c3aed' : 'transparent',
                  color: pieMode === 'stock' ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Stock Units
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
            
            {/* SVG Pie Arc Diagram */}
            <div style={{ position: 'relative', width: '200px', height: '200px', flexShrink: 0 }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                {piePaths.map((slice, idx) => (
                  <path
                    key={idx}
                    d={slice.path}
                    fill={slice.color}
                    opacity={hoveredSlice === null || hoveredSlice === idx ? 1 : 0.45}
                    style={{
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={() => setHoveredSlice(idx)}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                ))}
              </svg>

              {/* Center Donut Hole Text */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                  {pieMode === 'revenue' ? 'TOTAL SALES' : 'TOTAL STOCK'}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: '900', color: 'var(--text-main)' }}>
                  {pieMode === 'revenue' 
                    ? `₹${Math.round(pieChartData.total).toLocaleString('en-IN')}` 
                    : `${pieChartData.total} Pcs`}
                </div>
              </div>
            </div>

            {/* Slices Legend Table */}
            <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pieChartData.segments.map((slice, idx) => (
                <div 
                  key={idx}
                  onMouseEnter={() => setHoveredSlice(idx)}
                  onMouseLeave={() => setHoveredSlice(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: hoveredSlice === idx ? 'rgba(0,0,0,0.04)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: slice.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)' }}>
                      {slice.name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: slice.color }}>
                      {slice.percent}%
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      ({pieMode === 'revenue' ? `₹${Math.round(slice.value).toLocaleString('en-IN')}` : `${slice.value} pcs`})
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* PAYMENT DOUGHNUT & DIGITAL VS CASH FLOW */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={20} color="#0284c7" />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                  Payment Mode Distribution
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Cash Collections vs UPI Digital vs Khata Credit
                </p>
              </div>
            </div>
          </div>

          {/* Payment Mode Bars & Split */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Multi-segment Progress Bar */}
            <div style={{
              height: '16px',
              borderRadius: '8px',
              display: 'flex',
              overflow: 'hidden',
              background: 'var(--border-color)'
            }}>
              <div style={{ width: `${paymentModeStats.cashPct}%`, background: '#10b981' }} title={`Cash: ${paymentModeStats.cashPct}%`} />
              <div style={{ width: `${paymentModeStats.upiPct}%`, background: '#0284c7' }} title={`UPI: ${paymentModeStats.upiPct}%`} />
              <div style={{ width: `${paymentModeStats.creditPct}%`, background: '#f59e0b' }} title={`Khata: ${paymentModeStats.creditPct}%`} />
              <div style={{ width: `${paymentModeStats.chequePct}%`, background: '#8b5cf6' }} title={`Cheque: ${paymentModeStats.chequePct}%`} />
            </div>

            {/* Individual Breakdown Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: '700', color: '#059669' }}>CASH BILLING</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#059669' }}>{paymentModeStats.cashPct}%</span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#065f46', marginTop: '2px' }}>
                  ₹{paymentModeStats.cash.toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: '700', color: '#0284c7' }}>UPI / BANK</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0284c7' }}>{paymentModeStats.upiPct}%</span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0369a1', marginTop: '2px' }}>
                  ₹{paymentModeStats.upi.toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: '700', color: '#d97706' }}>KHATA / CREDIT</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#d97706' }}>{paymentModeStats.creditPct}%</span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#b45309', marginTop: '2px' }}>
                  ₹{paymentModeStats.credit.toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: '700', color: '#7c3aed' }}>CHEQUE / NEFT</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#7c3aed' }}>{paymentModeStats.chequePct}%</span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#5b21b6', marginTop: '2px' }}>
                  ₹{paymentModeStats.cheque.toLocaleString('en-IN')}
                </div>
              </div>

            </div>

            {/* Quick Summary Note */}
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.02)', padding: '8px 12px', borderRadius: '8px' }}>
              💡 <strong>Instant Liquidity Ratio:</strong> {paymentModeStats.cashPct + paymentModeStats.upiPct}% of revenue collected immediately.
            </div>

          </div>
        </div>

      </div>

      {/* DIAGRAM SECTION 3: STATISTICAL HISTOGRAM (Order Value Distribution) */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={20} color="#db2777" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                Histogram: Invoice Basket Size Distribution
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Statistical frequency of invoice ticket values grouped into standardized purchase brackets
            </p>
          </div>

          {/* Histogram Quick Stats */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ padding: '6px 14px', borderRadius: '12px', background: 'rgba(219, 39, 119, 0.08)', border: '1px solid rgba(219, 39, 119, 0.2)' }}>
              <span style={{ fontSize: '0.72rem', color: '#be185d', fontWeight: '700' }}>AVG BILL SIZE</span>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: '#be185d' }}>
                ₹{Math.round(averageOrderValue).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ padding: '6px 14px', borderRadius: '12px', background: 'rgba(79, 70, 229, 0.08)', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
              <span style={{ fontSize: '0.72rem', color: '#4338ca', fontWeight: '700' }}>TOTAL BILLS ANALYZED</span>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: '#4338ca' }}>
                {filteredInvoices.length} Invoices
              </div>
            </div>
          </div>
        </div>

        {/* HISTOGRAM COLUMNS DISPLAY */}
        <div style={{ width: '100%', height: '220px', position: 'relative', marginTop: '14px' }}>
          
          {/* Horizontal Reference Lines */}
          <div style={{ position: 'absolute', top: 0, left: 30, right: 10, bottom: 35, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
            {[1, 0.5, 0].map((ratio, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <span style={{ width: '25px', fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'right', marginRight: '8px' }}>
                  {Math.round(histogramData.maxCount * ratio)}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)', opacity: 0.6 }} />
              </div>
            ))}
          </div>

          {/* Histogram Bars */}
          <div style={{
            position: 'absolute',
            top: 10,
            left: 45,
            right: 10,
            bottom: 35,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
            gap: '16px'
          }}>
            {histogramData.bins.map((bin, idx) => {
              const heightPct = (bin.count / histogramData.maxCount) * 100;
              const isHovered = hoveredHistIndex === idx;

              return (
                <div
                  key={bin.label}
                  onMouseEnter={() => setHoveredHistIndex(idx)}
                  onMouseLeave={() => setHoveredHistIndex(null)}
                  style={{
                    flex: 1,
                    maxWidth: '120px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  {/* Tooltip on Hover */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute',
                      bottom: `calc(${Math.min(heightPct + 10, 85)}% + 8px)`,
                      zIndex: 30,
                      background: '#0f172a',
                      color: '#ffffff',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.76rem',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <div style={{ fontWeight: '800', color: '#f472b6' }}>{bin.name} ({bin.label})</div>
                      <div>Frequency: <strong>{bin.count} bills ({bin.frequencyPercent}%)</strong></div>
                      <div>Total Sum: ₹{bin.total.toLocaleString('en-IN')}</div>
                    </div>
                  )}

                  {/* Frequency Count on Top of Bar */}
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    color: isHovered ? '#db2777' : 'var(--text-main)',
                    marginBottom: '4px'
                  }}>
                    {bin.count}
                  </span>

                  {/* Histogram Bar Column */}
                  <div style={{
                    width: '100%',
                    height: `${Math.max(heightPct, 6)}%`,
                    borderRadius: '8px 8px 0 0',
                    background: isHovered 
                      ? 'linear-gradient(180deg, #ec4899 0%, #db2777 100%)' 
                      : 'linear-gradient(180deg, #f472b6 0%, #be185d 100%)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isHovered ? 'scaleY(1.05)' : 'scaleY(1)',
                    boxShadow: isHovered ? '0 0 16px rgba(219, 39, 119, 0.45)' : '0 2px 6px rgba(0,0,0,0.06)'
                  }} />

                  {/* X-Axis Bin Range Label */}
                  <span style={{
                    position: 'absolute',
                    bottom: '-24px',
                    fontSize: '0.72rem',
                    fontWeight: isHovered ? '800' : '600',
                    color: isHovered ? '#db2777' : 'var(--text-muted)',
                    whiteSpace: 'nowrap'
                  }}>
                    {bin.label}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

        {/* Histogram Insights Bar */}
        <div style={{
          marginTop: '28px',
          padding: '12px 16px',
          background: 'rgba(0,0,0,0.02)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          <div>
            📊 <strong>Histogram Interpretation:</strong> Most orders fall into the{' '}
            <strong style={{ color: 'var(--text-main)' }}>
              {[...histogramData.bins].sort((a, b) => b.count - a.count)[0]?.label || '₹500 - 1.5K'}
            </strong>{' '}
            bracket ({[...histogramData.bins].sort((a, b) => b.count - a.count)[0]?.name || 'Standard Retail'}).
          </div>
          <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '700' }}>
            Normal Distribution Calibrated
          </span>
        </div>
      </div>

      {/* DIAGRAM SECTION 4: TOP FAST-MOVING FMCG PRODUCTS (Comparison Bar Diagram) */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} color="#4f46e5" />
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                Horizontal Bar Diagram: Top Selling Products
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                High-velocity FMCG items ranked by physical pieces sold and turnover
              </p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('inventory')}
            className="btn btn-secondary btn-sm"
          >
            All Inventory
          </button>
        </div>

        {topProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            No sales recorded in the selected period.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {topProducts.map((prod, idx) => (
              <div key={prod.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                    #{idx + 1} {prod.name}
                  </span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ fontWeight: '800', color: '#4f46e5' }}>{prod.qty} Units</span>
                    <span style={{ fontWeight: '700', color: '#059669' }}>₹{prod.revenue.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Horizontal Comparison Bar */}
                <div style={{ width: '100%', height: '10px', borderRadius: '5px', background: 'var(--border-color)', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${prod.pct}%`, 
                      height: '100%', 
                      borderRadius: '5px', 
                      background: idx === 0 
                        ? 'linear-gradient(90deg, #4f46e5, #7c3aed)' 
                        : idx === 1 
                        ? 'linear-gradient(90deg, #0284c7, #06b6d4)' 
                        : 'linear-gradient(90deg, #10b981, #34d399)'
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM OPERATIONAL PANELS: LOW STOCK ALERT & RECENT INVOICES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Low Stock Warning Section */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="#f59e0b" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>Low Stock Warnings</h3>
            </div>
            <button 
              onClick={() => setActiveTab('inventory')}
              className="btn btn-secondary btn-sm"
            >
              View Inventory
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
              <p style={{ fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>Stock levels are optimal!</p>
              <p style={{ fontSize: '0.82rem', margin: '4px 0 0 0' }}>No products are currently below the reorder threshold.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lowStockProducts.slice(0, 5).map(prod => (
                <div 
                  key={prod.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.2)'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>{prod.name}</h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>SKU: {prod.sku} • MRP: ₹{prod.mrp}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
                      Stock: {prod.currentStock} {prod.unit}
                    </span>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', margin: '2px 0 0 0' }}>
                      Min: {prod.minStockLimit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Bills & Invoices Table */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>Recent Bills</h3>
            </div>
            <button 
              onClick={() => setActiveTab('invoices')}
              className="btn btn-secondary btn-sm"
            >
              All Invoices
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              <Clock size={36} style={{ margin: '0 auto 10px auto' }} />
              <p>No invoice records found.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Invoice No</th>
                    <th style={{ padding: '8px 10px' }}>Retailer</th>
                    <th style={{ padding: '8px 10px' }}>Amount</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Print</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px', fontWeight: '700', color: 'var(--primary)' }}>{inv.invoiceNo}</td>
                      <td style={{ padding: '10px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.partyName}
                      </td>
                      <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                        ₹{Number(inv.grandTotal).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span className={`badge ${
                          inv.paymentStatus === 'PAID' ? 'badge-success' : inv.paymentStatus === 'UNPAID' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <button 
                          onClick={() => handlePrintInvoice(inv)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Print / View PDF"
                        >
                          <Printer size={14} />
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

      {/* RETAILER UDHAR KHATA COLLECTION MODAL */}
      {udharModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IndianRupee size={20} color="#d97706" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800' }}>Retailers Outstanding Khata List</h3>
              </div>
              <button 
                onClick={() => setUdharModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ paddingLeft: '36px' }}
                  placeholder="Search retailer by shop name, contact, city..."
                  value={udharSearchTerm}
                  onChange={e => setUdharSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredDueParties.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
                  <p style={{ fontWeight: '700', color: 'var(--text-main)' }}>No outstanding balance found!</p>
                </div>
              ) : (
                filteredDueParties.map(party => (
                  <div 
                    key={party.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'rgba(245, 158, 11, 0.05)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '10px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{party.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        📞 {party.phone} • {party.city || 'Local'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Balance Due</span>
                        <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#c2410c' }}>
                          ₹{party.balance?.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <button
                        onClick={() => sendWhatsAppReminder(party)}
                        className="btn btn-sm"
                        style={{ background: '#25D366', color: '#ffffff', border: 'none', gap: '6px', padding: '6px 12px' }}
                        title="Send WhatsApp Payment Reminder"
                      >
                        <MessageCircle size={14} />
                        <span>Remind</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Total Dues: <strong style={{ color: '#c2410c' }}>₹{totalOutstandingBalance.toLocaleString('en-IN')}</strong> ({dueParties.length} Parties)
              </div>
              <button onClick={() => setUdharModalOpen(false)} className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
