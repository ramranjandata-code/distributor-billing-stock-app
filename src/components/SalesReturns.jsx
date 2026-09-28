import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Plus,
  Search,
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

    for (const row of selectedRows) {
      if (row.quantity > row.billedQty) {
        alert(`Return quantity for ${row.productName} cannot exceed original billed quantity (${row.billedQty}).`);
        return;
      }
    }

    saveSalesReturn({
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

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Draft':
        return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
      case 'Received':
        return { background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' };
      case 'Credit Issued':
        return { background: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff' };
      case 'Completed':
        return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
      default:
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Header Control Banner */}
      <div style={{ 
        background: '#ffffff', 
        borderRadius: '14px', 
        padding: '16px 22px', 
        border: '1px solid #e2e8f0', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '10px', 
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', 
            color: '#ffffff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
          }}>
            <RotateCcw size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
              Sales Returns & Replacements (RMA)
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Zoho-grade RMA: Resalable restocks, damaged scrap write-offs, credit notes & replacement billing
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsCreateModalOpen(true);
            if (invoices.length > 0) {
              handleInvoiceSelect(invoices[0].id);
            }
          }}
          className="btn btn-primary"
          style={{ 
            fontWeight: '700', 
            padding: '8px 18px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
          }}
        >
          <Plus size={16} />
          <span>+ Create Return (RMA)</span>
        </button>
      </div>

      {/* 2. Executive KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        
        {/* Card 1: Total Returns */}
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '12px', 
          padding: '16px', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Returns
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginTop: '4px' }}>
              {totalReturnsCount}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
              Value: ₹{totalReturnValue.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: '#f5f3ff', 
            color: '#7c3aed', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: '1px solid #ddd6fe'
          }}>
            <RotateCcw size={20} />
          </div>
        </div>

        {/* Card 2: Restocked to Godown */}
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '12px', 
          padding: '16px', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Restocked to Godown
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#059669', marginTop: '4px' }}>
              {totalRestockedPcs} <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b' }}>Pcs</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '700', marginTop: '2px' }}>
              Resalable inventory
            </div>
          </div>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: '#ecfdf5', 
            color: '#059669', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: '1px solid #a7f3d0'
          }}>
            <PackageCheck size={20} />
          </div>
        </div>

        {/* Card 3: Scrap & Damage Loss */}
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '12px', 
          padding: '16px', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Scrap & Damage Loss
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#dc2626', marginTop: '4px' }}>
              {totalScrappedPcs} <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b' }}>Pcs</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: '700', marginTop: '2px' }}>
              ₹{totalScrapValue.toLocaleString('en-IN')} written-off
            </div>
          </div>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: '#fef2f2', 
            color: '#dc2626', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: '1px solid #fecaca'
          }}>
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Card 4: Credit Notes Issued */}
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '12px', 
          padding: '16px', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Credit Notes Issued
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#7c3aed', marginTop: '4px' }}>
              {totalCreditIssuedCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '700', marginTop: '2px' }}>
              Khata ledgers adjusted
            </div>
          </div>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: '#faf5ff', 
            color: '#7c3aed', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: '1px solid #e9d5ff'
          }}>
            <CreditCard size={20} />
          </div>
        </div>
      </div>

      {/* 3. Filter Tabs & Search Bar Card */}
      <div style={{ 
        background: '#ffffff', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '12px 18px', 
          borderBottom: '1px solid #e2e8f0', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '12px',
          background: '#f8fafc'
        }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto' }}>
            {['ALL', 'Draft', 'Received', 'Credit Issued', 'Completed'].map((tab) => {
              const isSelected = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid #7c3aed' : '1px solid #cbd5e1',
                    background: isSelected ? '#7c3aed' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#475569',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? '800' : '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {tab === 'ALL' ? 'All Returns' : tab}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search RMA, Customer, Inv#..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '32px', fontSize: '0.85rem', padding: '7px 10px 7px 32px' }}
            />
          </div>
        </div>

        {/* 4. Returns Data Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: '700' }}>
                <th style={{ padding: '10px 14px' }}>Return #</th>
                <th style={{ padding: '10px 14px' }}>Date</th>
                <th style={{ padding: '10px 14px' }}>Original Inv #</th>
                <th style={{ padding: '10px 14px' }}>Customer / Retailer</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Items</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Value (₹)</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Linked Documents</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px 14px', color: '#94a3b8' }}>
                    <RotateCcw size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: '600' }}>No sales return records found.</p>
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => {
                  const badgeStyle = getStatusBadgeStyle(ret.status);
                  return (
                    <tr 
                      key={ret.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                    >
                      {/* Return # */}
                      <td style={{ padding: '10px 14px', fontWeight: '800', color: '#7c3aed', fontFamily: 'monospace' }}>
                        {ret.returnNumber}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>
                        {ret.returnDate}
                      </td>

                      {/* Original Invoice # */}
                      <td style={{ padding: '10px 14px' }}>
                        {ret.invoiceNo ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToInvoice && onNavigateToInvoice(ret.invoiceId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#2563eb',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontFamily: 'monospace'
                            }}
                          >
                            <span>{ret.invoiceNo}</span>
                            <ArrowUpRight size={12} />
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Direct Return</span>
                        )}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '10px 14px', fontWeight: '700', color: '#1e293b' }}>
                        {ret.customerName}
                      </td>

                      {/* Items Count */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ 
                          background: '#f1f5f9', 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          fontSize: '0.74rem', 
                          fontWeight: '700',
                          color: '#475569'
                        }}>
                          {ret.items?.length || 0} item{ret.items?.length !== 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Total Value */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800', color: '#1e293b' }}>
                        ₹{Number(ret.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.74rem',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          ...badgeStyle
                        }}>
                          {ret.status}
                        </span>
                      </td>

                      {/* Linked Documents */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.76rem' }}>
                          {ret.creditNoteNo && (
                            <span style={{ color: '#7e22ce', fontWeight: '700', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CreditCard size={12} />
                              {ret.creditNoteNo}
                            </span>
                          )}
                          {ret.replacementInvoiceNo && (
                            <span style={{ color: '#0d9488', fontWeight: '700', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ArrowRightLeft size={12} />
                              {ret.replacementInvoiceNo}
                            </span>
                          )}
                          {!ret.creditNoteNo && !ret.replacementInvoiceNo && (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>None</span>
                          )}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            title="Inspect Details"
                            onClick={() => {
                              setSelectedReturn(ret);
                              setIsDetailModalOpen(true);
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.74rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>

                          {ret.status === 'Draft' && (
                            <button
                              type="button"
                              title="Receive & Inspect Items"
                              onClick={() => handleReceive(ret.id)}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem', fontWeight: '700', background: '#4f46e5' }}
                            >
                              <PackageCheck size={12} />
                              <span>Receive</span>
                            </button>
                          )}

                          {ret.status === 'Received' && (
                            <button
                              type="button"
                              title="Issue Credit Note"
                              onClick={() => handleIssueCreditNote(ret.id)}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem', fontWeight: '700', background: '#7c3aed' }}
                            >
                              <CreditCard size={12} />
                              <span>Credit Note</span>
                            </button>
                          )}

                          {(ret.status === 'Received' || ret.status === 'Credit Issued') && !ret.replacementInvoiceId && (
                            <button
                              type="button"
                              title="Create Replacement Invoice"
                              onClick={() => handleOpenReplacement(ret)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem', fontWeight: '700', color: '#0d9488', borderColor: '#99f6e4', background: '#f0fdfa' }}
                            >
                              <ArrowRightLeft size={12} />
                              <span>Replace</span>
                            </button>
                          )}

                          <button
                            type="button"
                            title="Delete Return"
                            onClick={() => handleDelete(ret.id)}
                            className="btn btn-sm"
                            style={{ padding: '4px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. CREATE RETURN (RMA) MODAL */}
      {isCreateModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200, padding: '20px', overflowY: 'auto' }}>
          <div style={{ 
            maxWidth: '920px', 
            width: '100%', 
            margin: '0 auto', 
            background: '#ffffff', 
            borderRadius: '14px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ 
              padding: '16px 22px', 
              borderBottom: '1px solid #e2e8f0', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <RotateCcw size={16} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Create Sales Return (RMA)
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Row 1: Invoice Picker & Return Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '0.82rem' }}>
                    Select Original Sales Invoice *
                  </label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                    className="select-field input-field"
                    style={{ fontSize: '0.85rem' }}
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
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '0.82rem' }}>
                    Return Date
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '0.82rem', marginBottom: '8px', display: 'block' }}>
                  Select Return Items & Condition Inspection
                </label>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '8px 10px', width: '40px', textAlign: 'center' }}>Return</th>
                        <th style={{ padding: '8px 10px' }}>Product</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>Billed</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '90px' }}>Return Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Rate (₹)</th>
                        <th style={{ padding: '8px 10px', width: '180px' }}>Condition / Scrap</th>
                        <th style={{ padding: '8px 10px' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                            Please select an invoice above to populate billed items.
                          </td>
                        </tr>
                      ) : (
                        returnItems.map((item, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', background: item.selected ? '#f5f3ff' : '#ffffff' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={(e) => {
                                  const updated = [...returnItems];
                                  updated[index].selected = e.target.checked;
                                  setReturnItems(updated);
                                }}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: '700', color: '#1e293b' }}>
                              {item.productName}
                              {item.sku && <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>{item.sku}</div>}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#64748b' }}>
                              {item.billedQty}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
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
                                style={{ width: '70px', textAlign: 'center', padding: '4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#1e293b' }}>
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
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
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  fontSize: '0.78rem',
                                  fontWeight: '700',
                                  borderRadius: '6px',
                                  border: item.condition === 'UNDAMAGED' ? '1px solid #a7f3d0' : '1px solid #fecaca',
                                  background: item.condition === 'UNDAMAGED' ? '#ecfdf5' : '#fef2f2',
                                  color: item.condition === 'UNDAMAGED' ? '#059669' : '#dc2626'
                                }}
                              >
                                <option value="UNDAMAGED">Undamaged (Restock)</option>
                                <option value="DAMAGED">Damaged (Scrap Write-Off)</option>
                              </select>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
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
                                style={{ width: '100%', padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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
                <label className="form-label" style={{ fontWeight: '700', fontSize: '0.82rem' }}>
                  Internal Notes / Transporter Details
                </label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Additional return notes, transporter details or remarks..."
                  className="input-field"
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ fontWeight: '700', padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: '800', padding: '8px 20px', background: '#7c3aed' }}
                >
                  Create Return (Draft)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. DETAIL / INSPECTION MODAL */}
      {isDetailModalOpen && selectedReturn && (
        <div className="modal-overlay" style={{ zIndex: 1200, padding: '20px', overflowY: 'auto' }}>
          <div style={{ 
            maxWidth: '820px', 
            width: '100%', 
            margin: '0 auto', 
            background: '#ffffff', 
            borderRadius: '14px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ 
              padding: '16px 22px', 
              borderBottom: '1px solid #e2e8f0', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '8px', 
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: '800',
                  fontSize: '0.85rem'
                }}>
                  RMA
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    Sales Return: {selectedReturn.returnNumber}
                  </h3>
                  <span style={{
                    display: 'inline-block',
                    marginTop: '2px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    ...getStatusBadgeStyle(selectedReturn.status)
                  }}>
                    Status: {selectedReturn.status}
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsDetailModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Meta Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
                gap: '12px', 
                padding: '14px', 
                background: '#f8fafc', 
                borderRadius: '10px', 
                border: '1px solid #e2e8f0', 
                fontSize: '0.82rem' 
              }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: '700', display: 'block' }}>Original Invoice</span>
                  <span style={{ fontWeight: '800', color: '#1e293b', fontFamily: 'monospace' }}>{selectedReturn.invoiceNo || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: '700', display: 'block' }}>Customer</span>
                  <span style={{ fontWeight: '800', color: '#1e293b' }}>{selectedReturn.customerName}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: '700', display: 'block' }}>Return Date</span>
                  <span style={{ fontWeight: '800', color: '#1e293b' }}>{selectedReturn.returnDate}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: '700', display: 'block' }}>Total Value</span>
                  <span style={{ fontWeight: '900', color: '#7c3aed' }}>₹{Number(selectedReturn.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 style={{ fontSize: '0.84rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '8px' }}>
                  Returned Items Breakdown
                </h4>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '8px 12px' }}>Item Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Condition</th>
                        <th style={{ padding: '8px 12px' }}>Disposition Handling</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedReturn.items || []).map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: '700', color: '#1e293b' }}>
                            {it.productName}
                            {it.reason && <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>{it.reason}</div>}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '800', color: '#1e293b' }}>
                            {it.quantity}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                            ₹{Number(it.unitPrice).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: '800',
                              background: it.condition === 'UNDAMAGED' ? '#ecfdf5' : '#fef2f2',
                              color: it.condition === 'UNDAMAGED' ? '#059669' : '#dc2626'
                            }}>
                              {it.condition}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#475569', fontWeight: '600' }}>
                            {it.condition === 'UNDAMAGED' ? (
                              <span style={{ color: '#059669' }}>Restocked to Godown</span>
                            ) : (
                              <span style={{ color: '#dc2626' }}>Written off as Scrap Loss</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#1e293b' }}>
                            ₹{Number(it.amount || (it.quantity * it.unitPrice)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Linked Documents Box */}
              {(selectedReturn.creditNoteNo || selectedReturn.replacementInvoiceNo) && (
                <div style={{ padding: '14px', background: '#faf5ff', borderRadius: '10px', border: '1px solid #e9d5ff', fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: '800', color: '#7e22ce', display: 'block', marginBottom: '4px' }}>
                    Linked Accounting Documents:
                  </span>
                  <div style={{ display: 'flex', gap: '16px', fontFamily: 'monospace' }}>
                    {selectedReturn.creditNoteNo && (
                      <span style={{ color: '#7c3aed', fontWeight: '800' }}>Credit Note: {selectedReturn.creditNoteNo}</span>
                    )}
                    {selectedReturn.replacementInvoiceNo && (
                      <span style={{ color: '#0d9488', fontWeight: '800' }}>Replacement Invoice: {selectedReturn.replacementInvoiceNo}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedReturn.status === 'Draft' && (
                    <button
                      type="button"
                      onClick={() => handleReceive(selectedReturn.id)}
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700', background: '#4f46e5' }}
                    >
                      <PackageCheck size={14} />
                      <span>Receive & Inspect Items</span>
                    </button>
                  )}

                  {selectedReturn.status === 'Received' && (
                    <button
                      type="button"
                      onClick={() => handleIssueCreditNote(selectedReturn.id)}
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700', background: '#7c3aed' }}
                    >
                      <CreditCard size={14} />
                      <span>Issue Credit Note</span>
                    </button>
                  )}

                  {(selectedReturn.status === 'Received' || selectedReturn.status === 'Credit Issued') && !selectedReturn.replacementInvoiceId && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleOpenReplacement(selectedReturn);
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: '700', color: '#0d9488', borderColor: '#99f6e4', background: '#f0fdfa' }}
                    >
                      <ArrowRightLeft size={14} />
                      <span>Create Replacement Invoice</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 16px', fontSize: '0.82rem', fontWeight: '700' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. REPLACEMENT INVOICE MODAL */}
      {isReplacementModalOpen && selectedReturn && (
        <div className="modal-overlay" style={{ zIndex: 1200, padding: '20px', overflowY: 'auto' }}>
          <div style={{ 
            maxWidth: '820px', 
            width: '100%', 
            margin: '0 auto', 
            background: '#ffffff', 
            borderRadius: '14px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ 
              padding: '16px 22px', 
              borderBottom: '1px solid #e2e8f0', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  background: 'linear-gradient(135deg, #0d9488, #059669)', 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <ArrowRightLeft size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    Create Product Replacement Invoice
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
                    Applying credit of ₹{Number(selectedReturn.totalAmount).toLocaleString('en-IN')} from Return {selectedReturn.returnNumber}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsReplacementModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleReplacementSubmit} style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '0.82rem', margin: 0 }}>
                    Replacement Products to Dispatch
                  </label>
                  <button
                    type="button"
                    onClick={handleAddReplacementRow}
                    style={{ background: 'none', border: 'none', color: '#0d9488', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} />
                    <span>+ Add Product</span>
                  </button>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '8px 12px' }}>Product</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', width: '90px' }}>Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', width: '110px' }}>Rate (₹)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', width: '110px' }}>Total (₹)</th>
                        <th style={{ padding: '8px 12px', width: '40px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {replacementItems.map((item, index) => {
                        const lineTotal = (Number(item.qty) || 1) * (Number(item.salePrice) || 0);
                        return (
                          <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <select
                                value={item.productId}
                                onChange={(e) => handleReplacementRowChange(index, 'productId', e.target.value)}
                                className="select-field input-field"
                                style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                              >
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} (Stock: {p.currentStock || 0} Pcs)
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) => handleReplacementRowChange(index, 'qty', Math.max(1, Number(e.target.value) || 1))}
                                style={{ width: '70px', textAlign: 'center', padding: '4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.salePrice}
                                onChange={(e) => handleReplacementRowChange(index, 'salePrice', Number(e.target.value) || 0)}
                                style={{ width: '90px', textAlign: 'right', padding: '4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#1e293b' }}>
                              ₹{lineTotal.toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {replacementItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReplacementRow(index)}
                                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                                >
                                  <Trash2 size={14} />
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
                  <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Replacement Invoice Subtotal:</span>
                      <span style={{ fontWeight: '700', color: '#1e293b' }}>₹{repTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                      <span>Credit Note Offset Applied ({selectedReturn.creditNoteNo || 'Return Credit'}):</span>
                      <span style={{ fontWeight: '800' }}>-₹{creditOffset.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #e2e8f0', fontWeight: '800', fontSize: '0.92rem', color: '#1e293b' }}>
                      <span>Net Balance Due by Customer:</span>
                      <span style={{ color: residualDue === 0 ? '#059669' : '#d97706' }}>
                        {residualDue === 0 ? '₹0.00 (Fully Paid by Credit)' : `₹${residualDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setIsReplacementModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ fontWeight: '700', padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: '800', padding: '8px 20px', background: '#0d9488' }}
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
