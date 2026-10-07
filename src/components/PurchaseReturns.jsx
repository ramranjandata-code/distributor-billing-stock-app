import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  RotateCcw, 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  Building2, 
  Trash2, 
  Calendar, 
  IndianRupee, 
  ShieldAlert, 
  Package, 
  ExternalLink,
  Filter,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  fetchPurchaseReturns, 
  getExpiredStockLots, 
  getReturnableStockItems,
  createPurchaseReturnDebitNote, 
  fetchSuppliers, 
  fetchProducts, 
  fetchPurchases 
} from '../utils/storage';

export default function PurchaseReturns({ refreshAllData }) {
  const [activeTab, setActiveTab] = useState('ALL_RETURNABLE'); // 'ALL_RETURNABLE' | 'EXPIRED_CLAIMS' | 'DEBIT_NOTES'
  const [returnableItems, setReturnableItems] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  const [debitNotes, setDebitNotes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Claim Modal State
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [selectedItemsForClaim, setSelectedItemsForClaim] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [originalBillNo, setOriginalBillNo] = useState('');
  const [reverseItc, setReverseItc] = useState(true);
  const [claimReason, setClaimReason] = useState('OVERSTOCK_RETURN');
  const [claimNotes, setClaimNotes] = useState('');

  const loadData = () => {
    setReturnableItems(getReturnableStockItems());
    setExpiredItems(getExpiredStockLots());
    setDebitNotes(fetchPurchaseReturns());
    setSuppliers(fetchSuppliers());
  };

  useEffect(() => {
    loadData();
    const handleStorageChange = () => loadData();
    window.addEventListener('distro_data_changed', handleStorageChange);
    return () => window.removeEventListener('distro_data_changed', handleStorageChange);
  }, []);

  // Filter returnable godown stock
  const filteredReturnable = returnableItems.filter(item => {
    const term = searchTerm.toLowerCase();
    return (item.productName && item.productName.toLowerCase().includes(term)) ||
           (item.batchNo && item.batchNo.toLowerCase().includes(term)) ||
           (item.supplierName && item.supplierName.toLowerCase().includes(term)) ||
           (item.brand && item.brand.toLowerCase().includes(term)) ||
           (item.sku && item.sku.toLowerCase().includes(term));
  });

  // Filter expired items
  const filteredExpired = expiredItems.filter(item => {
    const term = searchTerm.toLowerCase();
    return (item.productName && item.productName.toLowerCase().includes(term)) ||
           (item.batchNo && item.batchNo.toLowerCase().includes(term)) ||
           (item.supplierName && item.supplierName.toLowerCase().includes(term));
  });

  // Filter debit notes
  const filteredDebitNotes = debitNotes.filter(dn => {
    const term = searchTerm.toLowerCase();
    return (dn.debitNoteNo && dn.debitNoteNo.toLowerCase().includes(term)) ||
           (dn.supplierName && dn.supplierName.toLowerCase().includes(term)) ||
           (dn.originalBillNo && dn.originalBillNo.toLowerCase().includes(term));
  });

  const totalReturnableStockVal = returnableItems.reduce((sum, it) => sum + ((it.availableStock || 0) * (it.purchasePrice || 0)), 0);
  const totalExpiredStockLoss = expiredItems.reduce((sum, it) => sum + ((it.qtyExpired || 0) * (it.purchasePrice || 0)), 0);
  const totalDebitNotesAmount = debitNotes.reduce((sum, dn) => sum + (Number(dn.totalDebitAmount) || 0), 0);
  const totalItcReversed = debitNotes.reduce((sum, dn) => sum + (Number(dn.itcReversalAmount) || 0), 0);

  const handleOpenClaimModal = (item = null) => {
    if (item) {
      const initQty = item.availableStock !== undefined ? item.availableStock : (item.qtyExpired || 1);
      setSelectedItemsForClaim([{ 
        ...item, 
        returnQty: initQty,
        maxStock: initQty 
      }]);
      setSelectedSupplierId(item.supplierId || suppliers[0]?.id || '');
      setClaimReason(item.isExpired ? 'EXPIRED_STOCK' : 'OVERSTOCK_RETURN');
    } else if (activeTab === 'EXPIRED_CLAIMS' && expiredItems.length > 0) {
      setSelectedItemsForClaim(expiredItems.map(it => ({ 
        ...it, 
        returnQty: it.qtyExpired || 1, 
        maxStock: it.qtyExpired || 1 
      })));
      setSelectedSupplierId(suppliers[0]?.id || '');
      setClaimReason('EXPIRED_STOCK');
    } else {
      setSelectedItemsForClaim([]);
      setSelectedSupplierId(suppliers[0]?.id || '');
      setClaimReason('OVERSTOCK_RETURN');
    }
    setClaimModalOpen(true);
  };

  const handleExecuteDebitNote = (e) => {
    e.preventDefault();
    if (selectedItemsForClaim.length === 0) {
      alert('Please select at least one item to return.');
      return;
    }

    const supplier = suppliers.find(s => s.id === selectedSupplierId);

    const itemsToSubmit = selectedItemsForClaim.map(it => ({
      lotId: it.lotId,
      productId: it.productId,
      productName: it.productName,
      batchNo: it.batchNo,
      expiryDate: it.expiryDate,
      qty: Number(it.returnQty) || 1,
      purchasePrice: Number(it.purchasePrice) || 0,
      gstRate: Number(it.gstRate) || 5,
      reason: claimReason
    }));

    const result = createPurchaseReturnDebitNote({
      supplierId: selectedSupplierId,
      supplierName: supplier ? (supplier.name || supplier.tradeName) : 'Primary Vendor',
      originalBillNo,
      items: itemsToSubmit,
      reason: claimReason,
      reverseItc,
      notes: claimNotes
    });

    alert(`🎉 Vendor Debit Note #${result.debitNoteNo} Created Successfully!\n\nTotal Amount Claimed: ₹${result.totalDebitAmount.toLocaleString('en-IN')}\n${reverseItc ? `• Section 17(5)(h) ITC Reversed: ₹${result.itcReversalAmount.toLocaleString('en-IN')}\n` : ''}• Stock deducted from inventory.\n• Vendor Accounts Payable credited.`);
    
    setClaimModalOpen(false);
    loadData();
    if (refreshAllData) refreshAllData();
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f87171'
          }}>
            <ShieldAlert size={30} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800' }}>
              Purchase Returns & Vendor Claims Engine
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Create Vendor Debit Notes on Godown Stock, Expired Batches, and Section 17(5)(h) ITC Reversals
            </p>
          </div>
        </div>

        {expiredItems.length > 0 && (
          <button
            onClick={() => {
              setActiveTab('EXPIRED_CLAIMS');
              handleOpenClaimModal();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              background: '#ef4444',
              border: 'none',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)'
            }}
          >
            <RotateCcw size={16} />
            <span>Claim Expired Stock ({expiredItems.length})</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '18px', background: '#ffffff', border: '1.5px solid #dbeafe', borderRadius: '12px', borderLeft: '5px solid #2563eb' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Godown Returnable Stock</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e40af', margin: '4px 0' }}>
            {returnableItems.length} Products
          </div>
          <div style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: '600' }}>
            Valuation: ₹{totalReturnableStockVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '18px', background: '#ffffff', border: '1.5px solid #fee2e2', borderRadius: '12px', borderLeft: '5px solid #ef4444' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Expired Stock in Godown</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#dc2626', margin: '4px 0' }}>
            {expiredItems.length} Batches
          </div>
          <div style={{ fontSize: '0.82rem', color: '#991b1b', fontWeight: '600' }}>
            Loss Value: ₹{totalExpiredStockLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '18px', background: '#ffffff', border: '1.5px solid #e0e7ff', borderRadius: '12px', borderLeft: '5px solid #6366f1' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Vendor Debit Notes Issued</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#4338ca', margin: '4px 0' }}>
            {debitNotes.length} Notes
          </div>
          <div style={{ fontSize: '0.82rem', color: '#4f46e5', fontWeight: '600' }}>
            Total Claimed: ₹{totalDebitNotesAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '18px', background: '#ffffff', border: '1.5px solid #fef3c7', borderRadius: '12px', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Section 17(5)(h) ITC Reversed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#d97706', margin: '4px 0' }}>
            ₹{totalItcReversed.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: '600' }}>
            Reversed on Scrapped Goods
          </div>
        </div>
      </div>

      {/* Tabs & Search Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '10px', padding: '4px', gap: '4px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('ALL_RETURNABLE')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'ALL_RETURNABLE' ? '#ffffff' : 'transparent',
              color: activeTab === 'ALL_RETURNABLE' ? '#0f172a' : '#64748b',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            📦 All Returnable Godown Stock ({returnableItems.length})
          </button>

          <button
            onClick={() => setActiveTab('EXPIRED_CLAIMS')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'EXPIRED_CLAIMS' ? '#ffffff' : 'transparent',
              color: activeTab === 'EXPIRED_CLAIMS' ? '#0f172a' : '#64748b',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            ⚠️ Expired Stock Batches ({expiredItems.length})
          </button>

          <button
            onClick={() => setActiveTab('DEBIT_NOTES')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'DEBIT_NOTES' ? '#ffffff' : 'transparent',
              color: activeTab === 'DEBIT_NOTES' ? '#0f172a' : '#64748b',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            📑 Vendor Debit Notes ({debitNotes.length})
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search product, batch, vendor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '0.85rem',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Tab 1: All Returnable Godown Stock Table */}
      {activeTab === 'ALL_RETURNABLE' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
          {filteredReturnable.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <Package size={40} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#0f172a' }}>No Godown Stock Found</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Add purchase bills or inventory products to return items to suppliers.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px', width: '40px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '12px 14px' }}>Product Details</th>
                    <th style={{ padding: '12px 14px' }}>Batch / Dates</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Godown Stock</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Purchase Rate</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Stock Valuation</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturnable.map((it, idx) => {
                    const valuation = (it.availableStock || 0) * (it.purchasePrice || 0);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.80rem' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a' }}>
                          {it.productName}
                          <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '500' }}>
                            {it.brand ? `${it.brand} • ` : ''}SKU: {it.sku || 'N/A'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1e293b' }}>
                            {it.batchNo || 'LOT-DEFAULT'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            {it.mfgDate ? `MFG: ${it.mfgDate} ` : ''}
                            {it.expiryDate ? <span style={{ color: it.isExpired ? '#dc2626' : '#64748b', fontWeight: it.isExpired ? '700' : 'normal' }}>EXP: {it.expiryDate}</span> : <span style={{ color: '#94a3b8' }}>No Expiry Set</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                          {it.availableStock} {it.unit || 'Pcs'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '0.82rem' }}>
                          <div>₹{Number(it.purchasePrice || 0).toFixed(2)} <span style={{ fontSize: '0.72rem', color: '#64748b' }}>ex. GST</span></div>
                          <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: '600' }}>₹{Number(it.purchasePriceWithGst || 0).toFixed(2)} inc. GST</div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#2563eb' }}>
                          ₹{valuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {it.isExpired ? (
                            <span style={{ padding: '3px 8px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', fontSize: '0.75rem', fontWeight: '800' }}>
                              ⚠️ EXPIRED
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem', fontWeight: '700' }}>
                              AVAILABLE
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleOpenClaimModal(it)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#2563eb',
                              fontSize: '0.78rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <RotateCcw size={13} />
                            <span>Return to Vendor</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Expired Stock Batches Table */}
      {activeTab === 'EXPIRED_CLAIMS' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
          {filteredExpired.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#0f172a' }}>No Expired Stock Found</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>All warehouse inventory batches are within their validity dates.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px' }}>Product</th>
                    <th style={{ padding: '12px 14px' }}>Batch No</th>
                    <th style={{ padding: '12px 14px' }}>Expiry Date</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Expired Qty</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Purchase Rate</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Loss Value</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpired.map((it, idx) => {
                    const lossVal = (it.qtyExpired || 0) * (it.purchasePrice || 0);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a' }}>
                          {it.productName}
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>SKU: {it.sku || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '700', color: '#dc2626' }}>
                          {it.batchNo}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#dc2626', fontWeight: '700' }}>
                          {it.expiryDate}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800' }}>
                          {it.qtyExpired} Pcs
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          ₹{Number(it.purchasePrice || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                          ₹{lossVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleOpenClaimModal(it)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#2563eb',
                              fontSize: '0.78rem',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Issue Debit Note
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Vendor Debit Notes Table */}
      {activeTab === 'DEBIT_NOTES' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
          {filteredDebitNotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <FileText size={40} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#0f172a' }}>No Debit Notes Issued</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Vendor claim debit notes will appear here once generated.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px' }}>Debit Note No</th>
                    <th style={{ padding: '12px 14px' }}>Date</th>
                    <th style={{ padding: '12px 14px' }}>Vendor / Supplier</th>
                    <th style={{ padding: '12px 14px' }}>Items Claimed</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Debit (₹)</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>ITC Reversed</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDebitNotes.map((dn, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '800', color: '#2563eb' }}>
                        {dn.debitNoteNo}
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Bill Ref: {dn.originalBillNo || 'Direct'}</div>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b' }}>
                        {dn.date?.split('T')[0]}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a' }}>
                        {dn.supplierName}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {dn.items?.length || 0} items
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        ₹{Number(dn.taxableAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                        ₹{Number(dn.totalDebitAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: dn.itcReversalAmount > 0 ? '#d97706' : '#94a3b8' }}>
                        {dn.itcReversalAmount > 0 ? `₹${Number(dn.itcReversalAmount).toFixed(2)}` : 'None'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem', fontWeight: '800' }}>
                          {dn.status || 'ISSUED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Claim / Debit Note Modal */}
      {claimModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
              Create Vendor Debit Note (Stock Return)
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.84rem', color: '#64748b' }}>
              Deducts godown inventory, debits vendor account payable, and calculates GST Section 17(5)(h) ITC Reversal.
            </p>

            <form onSubmit={handleExecuteDebitNote} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                    Select Vendor / Supplier
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name || s.tradeName}</option>
                    ))}
                    {suppliers.length === 0 && <option value="">Primary Manufacturer / Supplier</option>}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                    Original Purchase Bill Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PUR/2026/102"
                    value={originalBillNo}
                    onChange={e => setOriginalBillNo(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                  Return Reason / Claim Type
                </label>
                <select
                  value={claimReason}
                  onChange={e => setClaimReason(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                >
                  <option value="OVERSTOCK_RETURN">Overstock / Slow Moving Stock Return</option>
                  <option value="EXPIRED_STOCK">Expired Stock / Outdated Product</option>
                  <option value="DAMAGED_LEAKAGE">Damaged / Breakage / Leakage</option>
                  <option value="QUALITY_RECALL">Quality Issue / Vendor Product Recall</option>
                  <option value="BILLING_CORRECTION">Billing / Invoice Rate Correction</option>
                </select>
              </div>

              {/* Items List */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                  Items Being Returned ({selectedItemsForClaim.length})
                </label>
                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {selectedItemsForClaim.map((it, idx) => {
                    const maxVal = it.maxStock || it.availableStock || it.qtyExpired || 99999;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '0.84rem' }}>
                        <div>
                          <strong>{it.productName}</strong> (Batch: {it.batchNo || 'LOT-DEFAULT'})
                          <div style={{ fontSize: '0.74rem', color: it.isExpired ? '#dc2626' : '#64748b' }}>
                            {it.expiryDate ? `Exp: ${it.expiryDate}` : 'No Expiry Set'} • In-Stock: {maxVal}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>Qty:</span>
                          <input
                            type="number"
                            min="1"
                            max={maxVal}
                            value={it.returnQty}
                            onChange={e => {
                              const val = Math.min(maxVal, Math.max(1, Number(e.target.value)));
                              const updated = [...selectedItemsForClaim];
                              updated[idx].returnQty = val;
                              setSelectedItemsForClaim(updated);
                            }}
                            style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '700' }}
                          />
                          <span style={{ fontWeight: '700' }}>₹{((Number(it.returnQty) || 0) * (Number(it.purchasePrice) || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 17(5)(h) ITC Reversal Checkbox */}
              <div style={{ padding: '12px 16px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="reverseItcCheck"
                  checked={reverseItc}
                  onChange={e => setReverseItc(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <label htmlFor="reverseItcCheck" style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: 1.4 }}>
                  <strong>Apply Section 17(5)(h) ITC Reversal:</strong> Reverses input tax credit claimed on written-off/expired goods according to statutory GST law.
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                  Notes / Vendor Return Instructions
                </label>
                <textarea
                  rows="2"
                  value={claimNotes}
                  onChange={e => setClaimNotes(e.target.value)}
                  placeholder="e.g. Returned to vendor representative / credit note adjustment against future invoice..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(false)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: '700', cursor: 'pointer' }}
                >
                  Generate & Confirm Debit Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
