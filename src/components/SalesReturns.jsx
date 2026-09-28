import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ArrowRightLeft,
  Trash2,
  Eye,
  FileText,
  Warehouse,
  IndianRupee,
  Layers,
  Calendar,
  User,
  ArrowUpRight,
  ShieldCheck,
  X,
  PackageCheck
} from 'lucide-react';
import {
  fetchSalesReturns,
  saveSalesReturn,
  receiveSalesReturnItems,
  issueReturnCreditNote,
  createReturnReplacementInvoice,
  deleteSalesReturn,
  fetchInvoices,
  fetchProducts,
  fetchParties,
  getNextReturnNumber
} from '../utils/storage';

export default function SalesReturns({ onNavigateToInvoice }) {
  const [returns, setReturns] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [parties, setParties] = useState([]);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'Draft', 'Received', 'Credit Issued', 'Completed'
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);

  // New Return Form State
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnItems, setReturnItems] = useState([]);

  // Replacement Form State
  const [replacementItems, setReplacementItems] = useState([]);

  const loadData = () => {
    setReturns(fetchSalesReturns());
    setInvoices(fetchInvoices());
    setProducts(fetchProducts());
    setParties(fetchParties());
  };

  useEffect(() => {
    loadData();

    const handleStorageChange = () => {
      loadData();
    };

    window.addEventListener('distro_data_changed', handleStorageChange);
    return () => window.removeEventListener('distro_data_changed', handleStorageChange);
  }, []);

  // When invoice selection changes in Create Modal
  const handleInvoiceSelect = (invId) => {
    setSelectedInvoiceId(invId);
    const inv = invoices.find(i => i.id === invId);
    if (!inv || !inv.items) {
      setReturnItems([]);
      return;
    }

    // Populate selectable items from invoice
    const initialItems = (inv.items || [])
      .filter(item => !item.isSection && !item.isNote && (item.productId || item.name))
      .map(item => ({
        selected: false,
        productId: item.productId || '',
        productName: item.name || 'Product',
        sku: item.sku || '',
        billedQty: Number(item.qty || item.quantity) || 1,
        quantity: 1,
        unitPrice: Number(item.salePrice || item.rate || item.price) || 0,
        taxRate: Number(item.gstRate || item.taxRate) || 0,
        condition: 'UNDAMAGED', // 'UNDAMAGED' | 'DAMAGED'
        disposition: 'RESTOCK', // 'RESTOCK' | 'SCRAP'
        reason: 'Customer Return'
      }));

    setReturnItems(initialItems);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const inv = invoices.find(i => i.id === selectedInvoiceId);
    if (!inv) {
      alert('Please select a valid original invoice.');
      return;
    }

    const selectedRows = returnItems.filter(item => item.selected && Number(item.quantity) > 0);
    if (selectedRows.length === 0) {
      alert('Please select at least one item and quantity to return.');
      return;
    }

    // Verify quantity does not exceed billed quantity
    for (const row of selectedRows) {
      if (row.quantity > row.billedQty) {
        alert(`Return quantity for ${row.productName} cannot exceed original billed quantity (${row.billedQty}).`);
        return;
      }
    }

    const newReturn = saveSalesReturn({
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      customerId: inv.partyId,
      customerName: inv.customerName || inv.partyName,
      returnDate,
      notes: returnNotes,
      status: 'Draft',
      items: selectedRows
    });

    setIsCreateModalOpen(false);
    setSelectedInvoiceId('');
    setReturnItems([]);
    setReturnNotes('');
    loadData();
  };

  const handleReceive = (returnId) => {
    if (window.confirm('Receive and inspect returned items? Undamaged items will be restocked to inventory. Damaged items will be written off as scrap.')) {
      receiveSalesReturnItems(returnId);
      loadData();
      if (selectedReturn && selectedReturn.id === returnId) {
        setSelectedReturn(fetchSalesReturns().find(r => r.id === returnId));
      }
    }
  };

  const handleIssueCreditNote = (returnId) => {
    if (window.confirm('Issue official Credit Note reversing invoice amount and adjusting customer balance?')) {
      const res = issueReturnCreditNote(returnId);
      loadData();
      if (selectedReturn && selectedReturn.id === returnId) {
        setSelectedReturn(res?.returnObj);
      }
    }
  };

  const handleOpenReplacement = (ret) => {
    setSelectedReturn(ret);
    setReplacementItems([
      {
        productId: products[0]?.id || '',
        name: products[0]?.name || '',
        sku: products[0]?.sku || '',
        qty: 1,
        salePrice: products[0]?.salePrice || 0,
        taxRate: products[0]?.gstRate || 0
      }
    ]);
    setIsReplacementModalOpen(true);
  };

  const handleAddReplacementRow = () => {
    const firstProd = products[0];
    setReplacementItems([
      ...replacementItems,
      {
        productId: firstProd?.id || '',
        name: firstProd?.name || '',
        sku: firstProd?.sku || '',
        qty: 1,
        salePrice: firstProd?.salePrice || 0,
        taxRate: firstProd?.gstRate || 0
      }
    ]);
  };

  const handleRemoveReplacementRow = (index) => {
    setReplacementItems(replacementItems.filter((_, i) => i !== index));
  };

  const handleReplacementRowChange = (index, field, value) => {
    const updated = [...replacementItems];
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        updated[index] = {
          ...updated[index],
          productId: prod.id,
          name: prod.name,
          sku: prod.sku || '',
          salePrice: Number(prod.salePrice) || 0,
          taxRate: Number(prod.gstRate) || 0
        };
      }
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value
      };
    }
    setReplacementItems(updated);
  };

  const handleReplacementSubmit = (e) => {
    e.preventDefault();
    if (!selectedReturn) return;
    if (replacementItems.length === 0) {
      alert('Please add at least one replacement item.');
      return;
    }

    createReturnReplacementInvoice(selectedReturn.id, replacementItems);
    setIsReplacementModalOpen(false);
    setSelectedReturn(null);
    loadData();
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this Sales Return record?')) {
      deleteSalesReturn(id);
      loadData();
    }
  };

  // KPI Calculations
  const totalReturnsCount = returns.length;
  const totalReturnValue = returns.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0);
  
  let totalRestockedPcs = 0;
  let totalScrappedPcs = 0;
  let totalScrapValue = 0;

  returns.forEach(r => {
    (r.items || []).forEach(it => {
      const qty = Number(it.quantity) || 0;
      if (r.status !== 'Draft') {
        if (it.condition === 'UNDAMAGED' || it.disposition === 'RESTOCK') {
          totalRestockedPcs += qty;
        } else {
          totalScrappedPcs += qty;
          totalScrapValue += qty * (Number(it.unitPrice) || 0);
        }
      }
    });
  });

  const totalCreditIssuedCount = returns.filter(r => r.creditNoteId || r.status === 'Credit Issued' || r.status === 'Completed').length;

  // Filtered returns
  const filteredReturns = returns.filter(ret => {
    if (activeTab !== 'ALL' && ret.status !== activeTab) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchNo = ret.returnNumber?.toLowerCase().includes(term);
      const matchCust = ret.customerName?.toLowerCase().includes(term);
      const matchInv = ret.invoiceNo?.toLowerCase().includes(term);
      return matchNo || matchCust || matchInv;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Draft':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Received':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Credit Issued':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Sales Returns & Replacements (RMA)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Modeled after Zoho Books & Inventory: Manage resalable restocks, damaged scrap write-offs, credit notes, and replacement billing.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreateModalOpen(true);
            if (invoices.length > 0) {
              handleInvoiceSelect(invoices[0].id);
            }
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Return (RMA)
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Returns */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Total Returns
            </span>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {totalReturnsCount}
            </div>
            <span className="text-xs text-slate-400">
              Value: ₹{totalReturnValue.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Restocked */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Restocked to Godown
            </span>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {totalRestockedPcs} <span className="text-xs font-medium text-slate-500">Pcs</span>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
              Resalable inventory
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Scrapped / Damaged */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Scrap & Damage Loss
            </span>
            <div className="text-xl font-bold text-rose-600 mt-1">
              {totalScrappedPcs} <span className="text-xs font-medium text-slate-500">Pcs</span>
            </div>
            <span className="text-xs text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-medium">
              ₹{totalScrapValue.toLocaleString('en-IN')} written-off
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Credit Notes Issued */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Credit Notes Issued
            </span>
            <div className="text-xl font-bold text-purple-600 mt-1">
              {totalCreditIssuedCount}
            </div>
            <span className="text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-medium">
              Khata ledgers adjusted
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'Draft', 'Received', 'Credit Issued', 'Completed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab === 'ALL' ? 'All Returns' : tab}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by RMA, Customer, Inv#..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Returns Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Return #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Original Inv #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Total (₹)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Linked Documents</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-medium">No sales return records found.</p>
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      {ret.returnNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {ret.returnDate}
                    </td>
                    <td className="py-3 px-4">
                      {ret.invoiceNo ? (
                        <button
                          type="button"
                          onClick={() => onNavigateToInvoice && onNavigateToInvoice(ret.invoiceId)}
                          className="font-mono text-slate-700 hover:text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          {ret.invoiceNo}
                          <ArrowUpRight className="w-3 h-3 opacity-60" />
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">Direct Return</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {ret.customerName}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-medium text-[11px]">
                        {ret.items?.length || 0} item{ret.items?.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">
                      ₹{Number(ret.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(ret.status)}`}>
                        {ret.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 text-[11px]">
                        {ret.creditNoteNo && (
                          <span className="inline-flex items-center gap-1 text-purple-700 font-mono">
                            <CreditCard className="w-3 h-3" />
                            {ret.creditNoteNo}
                          </span>
                        )}
                        {ret.replacementInvoiceNo && (
                          <span className="inline-flex items-center gap-1 text-teal-700 font-mono">
                            <ArrowRightLeft className="w-3 h-3" />
                            {ret.replacementInvoiceNo}
                          </span>
                        )}
                        {!ret.creditNoteNo && !ret.replacementInvoiceNo && (
                          <span className="text-slate-400 italic text-[11px]">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          title="View Details"
                          onClick={() => {
                            setSelectedReturn(ret);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1 hover:bg-slate-100 text-slate-600 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {ret.status === 'Draft' && (
                          <button
                            type="button"
                            title="Receive & Inspect Items"
                            onClick={() => handleReceive(ret.id)}
                            className="p-1 hover:bg-indigo-50 text-indigo-600 rounded transition-colors"
                          >
                            <PackageCheck className="w-4 h-4" />
                          </button>
                        )}

                        {ret.status === 'Received' && (
                          <button
                            type="button"
                            title="Issue Credit Note"
                            onClick={() => handleIssueCreditNote(ret.id)}
                            className="p-1 hover:bg-purple-50 text-purple-600 rounded transition-colors"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}

                        {(ret.status === 'Received' || ret.status === 'Credit Issued') && !ret.replacementInvoiceId && (
                          <button
                            type="button"
                            title="Create Replacement Invoice"
                            onClick={() => handleOpenReplacement(ret)}
                            className="p-1 hover:bg-teal-50 text-teal-600 rounded transition-colors"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          title="Delete Return"
                          onClick={() => handleDelete(ret.id)}
                          className="p-1 hover:bg-rose-50 text-rose-500 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE RETURN MODAL WIZARD */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-800">
                  Create Sales Return (RMA)
                </h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Row 1: Invoice Picker & Return Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Original Sales Invoice *
                  </label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  >
                    <option value="">-- Choose Invoice --</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNo} - {inv.customerName || inv.partyName} (₹{Number(inv.grandTotal || 0).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Return Date
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Items Selection Table */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Return Items & Condition Inspection
                </label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                        <th className="py-2.5 px-3 w-10 text-center">Return</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3 w-20 text-center">Billed</th>
                        <th className="py-2.5 px-3 w-24 text-center">Return Qty</th>
                        <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                        <th className="py-2.5 px-3 w-36">Condition / Scrap</th>
                        <th className="py-2.5 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {returnItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">
                            Please select an invoice above to load billed items.
                          </td>
                        </tr>
                      ) : (
                        returnItems.map((item, index) => (
                          <tr key={index} className={item.selected ? 'bg-indigo-50/30' : ''}>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={(e) => {
                                  const updated = [...returnItems];
                                  updated[index].selected = e.target.checked;
                                  setReturnItems(updated);
                                }}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {item.productName}
                              {item.sku && <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>}
                            </td>
                            <td className="py-2 px-3 text-center font-semibold text-slate-600">
                              {item.billedQty}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                max={item.billedQty}
                                value={item.quantity}
                                disabled={!item.selected}
                                onChange={(e) => {
                                  const updated = [...returnItems];
                                  updated[index].quantity = Math.max(1, Math.min(item.billedQty, Number(e.target.value) || 1));
                                  setReturnItems(updated);
                                }}
                                className="w-20 text-center py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-slate-700">
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={item.condition}
                                disabled={!item.selected}
                                onChange={(e) => {
                                  const updated = [...returnItems];
                                  const cond = e.target.value;
                                  updated[index].condition = cond;
                                  updated[index].disposition = cond === 'DAMAGED' ? 'SCRAP' : 'RESTOCK';
                                  setReturnItems(updated);
                                }}
                                className={`w-full py-1 px-2 text-xs border rounded font-semibold focus:outline-none ${
                                  item.condition === 'UNDAMAGED'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-rose-50 text-rose-800 border-rose-300'
                                }`}
                              >
                                <option value="UNDAMAGED">Undamaged (Restock)</option>
                                <option value="DAMAGED">Damaged (Scrap / Write-off)</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                placeholder="Reason for return..."
                                value={item.reason}
                                disabled={!item.selected}
                                onChange={(e) => {
                                  const updated = [...returnItems];
                                  updated[index].reason = e.target.value;
                                  setReturnItems(updated);
                                }}
                                className="w-full py-1 px-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Internal Notes / Customer Comments
                </label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Additional return notes, transporter details or remarks..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                  Create Return (Draft)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL / INSPECTION MODAL */}
      {isDetailModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                  RMA
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Sales Return Details: {selectedReturn.returnNumber}
                  </h2>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border mt-1 ${getStatusBadge(selectedReturn.status)}`}>
                    Status: {selectedReturn.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">Original Invoice</span>
                  <span className="font-semibold text-slate-800 font-mono">{selectedReturn.invoiceNo || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Customer</span>
                  <span className="font-semibold text-slate-800">{selectedReturn.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Return Date</span>
                  <span className="font-semibold text-slate-800">{selectedReturn.returnDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Total Value</span>
                  <span className="font-bold text-indigo-600">₹{Number(selectedReturn.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Returned Items Breakdown
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-center">Condition</th>
                        <th className="py-2.5 px-3">Disposition Handling</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedReturn.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-medium text-slate-800">
                            {it.productName}
                            {it.reason && <div className="text-[10px] text-slate-400 italic">{it.reason}</div>}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-700">
                            {it.quantity}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            ₹{Number(it.unitPrice).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              it.condition === 'UNDAMAGED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {it.condition}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {it.condition === 'UNDAMAGED' ? (
                              <span className="text-emerald-700 font-medium">Restocked to Warehouse</span>
                            ) : (
                              <span className="text-rose-700 font-medium">Written off as Scrap Loss</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-800">
                            ₹{Number(it.amount || (it.quantity * it.unitPrice)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Linked Records */}
              {(selectedReturn.creditNoteNo || selectedReturn.replacementInvoiceNo) && (
                <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-indigo-900 block mb-1">Linked Accounting Documents:</span>
                    <div className="flex gap-4">
                      {selectedReturn.creditNoteNo && (
                        <span className="font-mono text-purple-700 font-bold">Credit Note: {selectedReturn.creditNoteNo}</span>
                      )}
                      {selectedReturn.replacementInvoiceNo && (
                        <span className="font-mono text-teal-700 font-bold">Replacement: {selectedReturn.replacementInvoiceNo}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="flex gap-2">
                  {selectedReturn.status === 'Draft' && (
                    <button
                      type="button"
                      onClick={() => handleReceive(selectedReturn.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      Receive & Inspect Items
                    </button>
                  )}

                  {selectedReturn.status === 'Received' && (
                    <button
                      type="button"
                      onClick={() => handleIssueCreditNote(selectedReturn.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold shadow-sm"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Issue Credit Note
                    </button>
                  )}

                  {(selectedReturn.status === 'Received' || selectedReturn.status === 'Credit Issued') && !selectedReturn.replacementInvoiceId && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleOpenReplacement(selectedReturn);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-semibold shadow-sm"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Create Replacement Invoice
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded border border-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPLACEMENT INVOICE MODAL */}
      {isReplacementModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-teal-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Create Product Replacement Invoice
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Applying credit of ₹{Number(selectedReturn.totalAmount).toLocaleString('en-IN')} from Return {selectedReturn.returnNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReplacementModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleReplacementSubmit} className="p-6 space-y-5">
              {/* Product rows */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Replacement Products to Dispatch
                  </label>
                  <button
                    type="button"
                    onClick={handleAddReplacementRow}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Product
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                        <th className="py-2.5 px-3">Select Product</th>
                        <th className="py-2.5 px-3 w-24 text-center">Qty</th>
                        <th className="py-2.5 px-3 w-28 text-right">Sale Price (₹)</th>
                        <th className="py-2.5 px-3 w-28 text-right">Line Total (₹)</th>
                        <th className="py-2.5 px-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {replacementItems.map((item, index) => {
                        const lineTotal = (Number(item.qty) || 1) * (Number(item.salePrice) || 0);
                        return (
                          <tr key={index}>
                            <td className="py-2 px-3">
                              <select
                                value={item.productId}
                                onChange={(e) => handleReplacementRowChange(index, 'productId', e.target.value)}
                                className="w-full py-1 px-2 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} (Stock: {p.currentStock || 0} Pcs)
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) => handleReplacementRowChange(index, 'qty', Math.max(1, Number(e.target.value) || 1))}
                                className="w-20 text-center py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.salePrice}
                                onChange={(e) => handleReplacementRowChange(index, 'salePrice', Number(e.target.value) || 0)}
                                className="w-24 text-right py-1 px-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-800">
                              ₹{lineTotal.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {replacementItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReplacementRow(index)}
                                  className="text-rose-500 hover:text-rose-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Offset calculation breakdown */}
              {(() => {
                const repTotal = replacementItems.reduce((acc, it) => acc + ((Number(it.qty) || 1) * (Number(it.salePrice) || 0)), 0);
                const availableCredit = Number(selectedReturn.totalAmount) || 0;
                const creditOffset = Math.min(availableCredit, repTotal);
                const residualDue = Math.max(0, repTotal - creditOffset);

                return (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Replacement Invoice Subtotal:</span>
                      <span className="font-semibold text-slate-800">₹{repTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span>Credit Note Offset Applied ({selectedReturn.creditNoteNo || 'Return Credit'}):</span>
                      <span className="font-bold">-₹{creditOffset.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                      <span>Net Balance Due by Customer:</span>
                      <span className={residualDue === 0 ? 'text-emerald-600' : 'text-amber-600'}>
                        {residualDue === 0 ? '₹0.00 (Fully Paid by Credit)' : `₹${residualDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsReplacementModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors"
                >
                  Confirm & Generate Replacement Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
