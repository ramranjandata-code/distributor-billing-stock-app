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
  ArrowRight,
  Eye,
  Check,
  X,
  CreditCard,
  Ban,
  Receipt,
  Clock,
  Sparkles
} from 'lucide-react';
import { 
  fetchVendorCredits, 
  saveVendorCredit, 
  applyVendorCreditToBills, 
  voidVendorCredit, 
  getUnpaidPurchaseBillsForVendor,
  getNextDebitNoteNumber,
  getExpiredStockLots, 
  getReturnableStockItems,
  fetchSuppliers, 
  fetchProducts, 
  fetchPurchases,
  fetchBusinessInfo
} from '../utils/storage';
import DebitNoteModal from './DebitNoteModal';

export default function PurchaseReturns({ initialPurchaseBill, refreshAllData }) {
  const [activeTab, setActiveTab] = useState('DEBIT_NOTES'); // 'DEBIT_NOTES' | 'ALL_RETURNABLE' | 'EXPIRED_CLAIMS'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'CLOSED' | 'DRAFT' | 'VOID'
  const [searchTerm, setSearchTerm] = useState('');

  // Data states
  const [debitNotes, setDebitNotes] = useState([]);
  const [returnableItems, setReturnableItems] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [business, setBusiness] = useState(null);

  // Modals
  const [selectedNoteForView, setSelectedNoteForView] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // New Debit Note Form Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formVendorId, setFormVendorId] = useState('');
  const [formVendorName, setFormVendorName] = useState('');
  const [formPurchaseBillId, setFormPurchaseBillId] = useState('');
  const [formOriginalBillNo, setFormOriginalBillNo] = useState('');
  const [formOriginalBillDate, setFormOriginalBillDate] = useState('');
  const [formReturnDate, setFormReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [formReason, setFormReason] = useState('Expired Stock');
  const [formNotes, setFormNotes] = useState('');
  const [formReverseItc, setFormReverseItc] = useState(true);
  const [formAutoApply, setFormAutoApply] = useState(false);
  const [formItems, setFormItems] = useState([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('');

  // Apply to Bills Modal State
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [creditToApply, setCreditToApply] = useState(null);
  const [vendorUnpaidBills, setVendorUnpaidBills] = useState([]);
  const [billAllocations, setBillAllocations] = useState({}); // { [billId]: number }

  // Void confirmation state
  const [voidConfirmModalOpen, setVoidConfirmModalOpen] = useState(false);
  const [creditToVoid, setCreditToVoid] = useState(null);
  const [voidReason, setVoidReason] = useState('Damaged goods claim cancelled / vendor replaced');

  const loadAllData = () => {
    const credits = fetchVendorCredits();
    setDebitNotes(credits);
    setReturnableItems(getReturnableStockItems());
    setExpiredItems(getExpiredStockLots());
    setSuppliers(fetchSuppliers());
    setProducts(fetchProducts());
    setPurchases(fetchPurchases());
    setBusiness(fetchBusinessInfo());
  };

  useEffect(() => {
    loadAllData();
    const handleStorageChange = () => loadAllData();
    window.addEventListener('distro_data_changed', handleStorageChange);

    // Support external event from Purchase Bills view to open return creator
    const handleCreateFromBill = (e) => {
      const bill = e.detail;
      if (bill) {
        initCreateFromPurchaseBill(bill);
      }
    };
    window.addEventListener('distro_create_vendor_return', handleCreateFromBill);

    return () => {
      window.removeEventListener('distro_data_changed', handleStorageChange);
      window.removeEventListener('distro_create_vendor_return', handleCreateFromBill);
    };
  }, []);

  // Handle initialPurchaseBill prop if passed on mount
  useEffect(() => {
    if (initialPurchaseBill) {
      initCreateFromPurchaseBill(initialPurchaseBill);
    }
  }, [initialPurchaseBill]);

  // Pre-fill Debit Note Form from a Purchase Bill
  const initCreateFromPurchaseBill = (bill) => {
    const sups = fetchSuppliers();
    const matchingSup = sups.find(s => s.id === bill.supplierId || s.name.trim().toLowerCase() === (bill.partyName || '').trim().toLowerCase());
    
    setFormVendorId(matchingSup ? matchingSup.id : (bill.supplierId || ''));
    setFormVendorName(bill.partyName || (matchingSup ? matchingSup.name : 'Supplier'));
    setFormPurchaseBillId(bill.id || '');
    setFormOriginalBillNo(bill.billNo || bill.id || '');
    setFormOriginalBillDate(bill.date || new Date().toISOString().split('T')[0]);
    setFormReturnDate(new Date().toISOString().split('T')[0]);
    setFormReason('Damaged Goods');
    setFormNotes(`Return against Purchase Inward Bill #${bill.billNo || bill.id}`);
    setFormReverseItc(true);
    setFormAutoApply(true);

    const prods = fetchProducts();
    const billItems = (bill.items || []).map((it, idx) => {
      const p = prods.find(pr => pr.id === it.productId || pr.name.trim().toLowerCase() === (it.name || '').trim().toLowerCase());
      const availableGodown = p ? Number(p.currentStock || 0) : Number(it.qty || 1);
      const billQty = Number(it.qty || 1);
      const returnQty = Math.min(billQty, Math.max(1, availableGodown));

      return {
        id: `it_${idx}`,
        productId: p ? p.id : (it.productId || `prod_${idx}`),
        productName: it.name || p?.name || 'Item',
        hsn: it.hsn || p?.hsn || '21069099',
        batchNo: it.batchNo || p?.batchNo || '',
        expiryDate: it.expiryDate || p?.expiryDate || '',
        purchasedQty: billQty,
        availableStock: availableGodown,
        returnQty,
        purchasePrice: Number(it.purchasePrice || it.rate || p?.purchasePrice || 0),
        taxRate: Number(it.gstRate !== undefined ? it.gstRate : (p?.gstRate || 5))
      };
    });

    setFormItems(billItems);
    setCreateModalOpen(true);
  };

  // Open standalone New Debit Note builder
  const handleOpenNewDebitNote = () => {
    const sups = suppliers.length > 0 ? suppliers : fetchSuppliers();
    const defaultSup = sups[0] || null;

    setFormVendorId(defaultSup?.id || '');
    setFormVendorName(defaultSup?.name || '');
    setFormPurchaseBillId('');
    setFormOriginalBillNo('');
    setFormOriginalBillDate('');
    setFormReturnDate(new Date().toISOString().split('T')[0]);
    setFormReason('Expired Stock');
    setFormNotes('');
    setFormReverseItc(true);
    setFormAutoApply(false);
    setFormItems([]);
    setSelectedProductToAdd('');
    setCreateModalOpen(true);
  };

  // Add Item to Form
  const handleAddItemToForm = (prodId) => {
    if (!prodId) return;
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    if (formItems.some(i => i.productId === prod.id)) {
      alert(`${prod.name} is already in the return list.`);
      return;
    }

    const available = Number(prod.currentStock) || 0;
    if (available <= 0) {
      alert(`Warning: ${prod.name} currently has 0 stock in warehouse. You cannot return items that are not in stock.`);
      return;
    }

    const newItem = {
      id: `it_${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      hsn: prod.hsn || '21069099',
      batchNo: prod.batchNo || 'LOT-MAIN',
      expiryDate: prod.expiryDate || '',
      availableStock: available,
      purchasedQty: 99999,
      returnQty: 1,
      purchasePrice: Number(prod.latestPurchasePrice || prod.purchasePrice || 0),
      taxRate: Number(prod.gstRate !== undefined ? prod.gstRate : 5)
    };

    setFormItems([...formItems, newItem]);
    setSelectedProductToAdd('');
  };

  // Quick claim from Returnable Stock or Expired Stock tab
  const handleClaimSingleItem = (item, isExpiredTab = false) => {
    const sups = suppliers.length > 0 ? suppliers : fetchSuppliers();
    const matchingSup = sups.find(s => s.id === item.supplierId || s.name === item.supplierName) || sups[0];
    
    setFormVendorId(matchingSup?.id || '');
    setFormVendorName(matchingSup?.name || item.supplierName || 'Primary Vendor');
    setFormPurchaseBillId('');
    setFormOriginalBillNo('');
    setFormOriginalBillDate('');
    setFormReturnDate(new Date().toISOString().split('T')[0]);
    setFormReason(isExpiredTab || item.isExpired ? 'Expired Stock' : 'Overstock / Slow Moving');
    setFormNotes(isExpiredTab ? 'Batch expired in godown. Claiming credit from supplier.' : 'Returning warehouse overstock.');
    setFormReverseItc(true);
    setFormAutoApply(false);

    const initQty = item.availableStock !== undefined ? item.availableStock : (item.qtyExpired || 1);
    setFormItems([{
      id: `it_${Date.now()}`,
      productId: item.productId,
      productName: item.productName,
      hsn: item.hsn || '21069099',
      batchNo: item.batchNo || '',
      expiryDate: item.expiryDate || '',
      availableStock: initQty,
      purchasedQty: 99999,
      returnQty: initQty,
      purchasePrice: Number(item.purchasePrice || 0),
      taxRate: Number(item.gstRate || 5)
    }]);

    setCreateModalOpen(true);
  };

  // Submit Debit Note
  const handleSaveDebitNote = (statusToSave = 'Open') => {
    if (formItems.length === 0) {
      alert('Please add at least one product item to return.');
      return;
    }

    if (!formVendorName && !formVendorId) {
      alert('Please select or specify a Supplier / Vendor.');
      return;
    }

    // Validation: Check return quantity vs stock on hand
    for (const it of formItems) {
      const q = Number(it.returnQty);
      if (q <= 0) {
        alert(`Return quantity for ${it.productName} must be greater than 0.`);
        return;
      }
      if (q > it.availableStock) {
        alert(`Validation Error: Return quantity (${q}) for ${it.productName} cannot exceed available warehouse stock (${it.availableStock}).`);
        return;
      }
      if (it.purchasedQty && q > it.purchasedQty) {
        alert(`Validation Error: Return quantity (${q}) for ${it.productName} cannot exceed original billed quantity (${it.purchasedQty}).`);
        return;
      }
    }

    const payload = {
      vendor_id: formVendorId || null,
      vendor_name: formVendorName,
      purchase_bill_id: formPurchaseBillId || null,
      originalBillNo: formOriginalBillNo || 'Direct',
      originalBillDate: formOriginalBillDate || formReturnDate,
      return_date: formReturnDate,
      reason: formReason,
      notes: formNotes,
      reverseItc: formReverseItc,
      status: statusToSave,
      autoApplyToBill: formAutoApply && Boolean(formPurchaseBillId),
      items: formItems.map(it => ({
        productId: it.productId,
        productName: it.productName,
        hsn_code: it.hsn,
        batch_number: it.batchNo,
        expiry_date: it.expiryDate,
        return_quantity: Number(it.returnQty),
        unit_purchase_price: Number(it.purchasePrice),
        tax_rate: Number(it.taxRate),
        reason: formReason
      }))
    };

    const saved = saveVendorCredit(payload);
    setCreateModalOpen(false);
    loadAllData();
    if (refreshAllData) refreshAllData();

    alert(`🎉 Vendor Debit Note #${saved.debit_note_number} ${statusToSave === 'Draft' ? 'Saved as Draft' : 'Issued Successfully'}!\n\nTotal Credit Claimed: ₹${saved.total_credit_amount.toLocaleString('en-IN')}\n${statusToSave === 'Open' ? `• Warehouse stock reduced.\n• Vendor Accounts Payable credited.\n• Section 17(5)(h) ITC reversal logged.` : ''}`);
    
    // Auto open view modal
    setSelectedNoteForView(saved);
    setIsViewModalOpen(true);
  };

  // Open "Apply to Bills" modal
  const handleOpenApplyModal = (credit) => {
    setCreditToApply(credit);
    const unpaid = getUnpaidPurchaseBillsForVendor(credit.vendor_id, credit.vendor_name);
    setVendorUnpaidBills(unpaid);

    // Initial allocations map
    const initialMap = {};
    let remaining = Number(credit.remaining_credit_balance) || 0;

    unpaid.forEach(bill => {
      if (bill.id === credit.purchase_bill_id && remaining > 0) {
        const canApply = Math.min(remaining, bill.balanceAmount);
        initialMap[bill.id] = canApply;
        remaining -= canApply;
      } else {
        initialMap[bill.id] = 0;
      }
    });

    setBillAllocations(initialMap);
    setApplyModalOpen(true);
  };

  // Confirm Apply Credit to Bills
  const handleConfirmApply = () => {
    if (!creditToApply) return;
    const allocArray = Object.entries(billAllocations)
      .filter(([_, amt]) => Number(amt) > 0)
      .map(([billId, amt]) => ({
        purchaseBillId: billId,
        amountApplied: Number(amt)
      }));

    if (allocArray.length === 0) {
      alert('Please enter an amount to apply against at least one bill.');
      return;
    }

    const res = applyVendorCreditToBills(creditToApply.id, allocArray);
    if (!res.success) {
      alert(`Error applying credit: ${res.message}`);
      return;
    }

    alert(`🎉 Success! Applied ₹${res.totalApplied.toLocaleString('en-IN')} credit to ${res.allocations.length} purchase bill(s)!\n\nRemaining Unused Credit: ₹${res.remainingBalance.toLocaleString('en-IN')}\nDebit Note Status: ${res.status}`);
    setApplyModalOpen(false);
    loadAllData();
    if (refreshAllData) refreshAllData();
  };

  // Handle Void
  const handleOpenVoidModal = (credit) => {
    setCreditToVoid(credit);
    setVoidReason('Damaged goods claim cancelled / vendor replaced');
    setVoidConfirmModalOpen(true);
  };

  const handleExecuteVoid = () => {
    if (!creditToVoid) return;
    const res = voidVendorCredit(creditToVoid.id, voidReason);
    if (!res.success) {
      alert(`Error voiding Debit Note: ${res.message}`);
      return;
    }

    alert(`⚠️ Debit Note #${creditToVoid.debit_note_number} has been marked as VOID.\n\n• Sequential number preserved.\n• Returned stock restored into warehouse.\n• Vendor accounts payable ledger restored.\n• Linked bill allocations reversed.`);
    setVoidConfirmModalOpen(false);
    loadAllData();
    if (refreshAllData) refreshAllData();
  };

  // Filter debit notes
  const filteredDebitNotes = debitNotes.filter(dn => {
    // Status filter
    if (statusFilter !== 'ALL') {
      if ((dn.status || 'OPEN').toUpperCase() !== statusFilter) return false;
    }
    // Search filter
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (dn.debit_note_number && dn.debit_note_number.toLowerCase().includes(term)) ||
           (dn.vendor_name && dn.vendor_name.toLowerCase().includes(term)) ||
           (dn.originalBillNo && dn.originalBillNo.toLowerCase().includes(term)) ||
           (dn.reason && dn.reason.toLowerCase().includes(term));
  });

  // Filter returnable godown stock
  const filteredReturnable = returnableItems.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (item.productName && item.productName.toLowerCase().includes(term)) ||
           (item.batchNo && item.batchNo.toLowerCase().includes(term)) ||
           (item.supplierName && item.supplierName.toLowerCase().includes(term));
  });

  // Filter expired items
  const filteredExpired = expiredItems.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (item.productName && item.productName.toLowerCase().includes(term)) ||
           (item.batchNo && item.batchNo.toLowerCase().includes(term)) ||
           (item.supplierName && item.supplierName.toLowerCase().includes(term));
  });

  // Calculations for KPI Cards
  const totalReturnableStockVal = returnableItems.reduce((sum, it) => sum + ((it.availableStock || 0) * (it.purchasePrice || 0)), 0);
  const totalExpiredStockLoss = expiredItems.reduce((sum, it) => sum + ((it.qtyExpired || 0) * (it.purchasePrice || 0)), 0);
  const totalDebitNotesAmount = debitNotes.reduce((sum, dn) => sum + (dn.status !== 'Void' ? (Number(dn.total_credit_amount) || 0) : 0), 0);
  const totalUnusedCreditBalance = debitNotes.reduce((sum, dn) => sum + (dn.status === 'Open' ? (Number(dn.remaining_credit_balance) || 0) : 0), 0);
  const totalItcReversed = debitNotes.reduce((sum, dn) => sum + (dn.status !== 'Void' ? (Number(dn.itcReversalAmount) || 0) : 0), 0);

  // Form total calculations
  const formSubtotal = formItems.reduce((sum, it) => sum + (Number(it.returnQty || 0) * Number(it.purchasePrice || 0)), 0);
  const formTax = formItems.reduce((sum, it) => {
    const lineTaxable = Number(it.returnQty || 0) * Number(it.purchasePrice || 0);
    return sum + ((lineTaxable * Number(it.taxRate || 0)) / 100);
  }, 0);
  const formTotal = formSubtotal + formTax;

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
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
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f87171'
          }}>
            <RotateCcw size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', letterSpacing: '0.2px' }}>
                Vendor Returns & Debit Notes
              </h2>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', padding: '3px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', color: '#38bdf8' }}>
                Zoho Books Grade
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Issue statutory GST Debit Notes on supplier returns, deduct stock, reverse Section 17(5)(h) ITC, and settle unpaid purchase bills.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {expiredItems.length > 0 && (
            <button
              onClick={() => {
                setActiveTab('EXPIRED_CLAIMS');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                fontWeight: '700',
                fontSize: '0.86rem',
                cursor: 'pointer'
              }}
            >
              <AlertTriangle size={16} />
              <span>Expired Batches ({expiredItems.length})</span>
            </button>
          )}

          <button
            onClick={handleOpenNewDebitNote}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              background: '#2563eb',
              border: 'none',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
            }}
          >
            <Plus size={18} />
            <span>+ New Debit Note</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* Unused Credit Balance */}
        <div style={{ padding: '16px 18px', background: '#ffffff', border: '1.5px solid #dcfce7', borderRadius: '14px', borderLeft: '5px solid #16a34a', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Unused Credit Balance</div>
          <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#15803d', margin: '4px 0' }}>
            ₹{totalUnusedCreditBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: '600' }}>
            Available to Apply to Bills
          </div>
        </div>

        {/* Total Debit Notes Issued */}
        <div style={{ padding: '16px 18px', background: '#ffffff', border: '1.5px solid #e0e7ff', borderRadius: '14px', borderLeft: '5px solid #6366f1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Total Debit Notes</div>
          <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#4338ca', margin: '4px 0' }}>
            ₹{totalDebitNotesAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: '600' }}>
            {debitNotes.filter(d => d.status !== 'Void').length} Notes Issued
          </div>
        </div>

        {/* Section 17(5)(h) ITC Reversal */}
        <div style={{ padding: '16px 18px', background: '#ffffff', border: '1.5px solid #fef3c7', borderRadius: '14px', borderLeft: '5px solid #f59e0b', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>GST ITC Reversed</div>
          <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#b45309', margin: '4px 0' }}>
            ₹{totalItcReversed.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: '600' }}>
            Section 17(5)(h) Compliance
          </div>
        </div>

        {/* Godown Returnable Stock */}
        <div style={{ padding: '16px 18px', background: '#ffffff', border: '1.5px solid #dbeafe', borderRadius: '14px', borderLeft: '5px solid #2563eb', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Godown Stock Valuation</div>
          <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#1e40af', margin: '4px 0' }}>
            ₹{totalReturnableStockVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: '600' }}>
            {returnableItems.length} Products Returnable
          </div>
        </div>

        {/* Expired Stock Loss */}
        <div style={{ padding: '16px 18px', background: '#ffffff', border: '1.5px solid #fee2e2', borderRadius: '14px', borderLeft: '5px solid #ef4444', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Expired Stock Loss</div>
          <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#dc2626', margin: '4px 0' }}>
            ₹{totalExpiredStockLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: '600' }}>
            {expiredItems.length} Batches Expired
          </div>
        </div>

      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '4px', gap: '4px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('DEBIT_NOTES')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'DEBIT_NOTES' ? '#ffffff' : 'transparent',
              color: activeTab === 'DEBIT_NOTES' ? '#0f172a' : '#64748b',
              fontWeight: '700',
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'DEBIT_NOTES' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            📑 Vendor Debit Notes ({debitNotes.length})
          </button>

          <button
            onClick={() => setActiveTab('ALL_RETURNABLE')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'ALL_RETURNABLE' ? '#ffffff' : 'transparent',
              color: activeTab === 'ALL_RETURNABLE' ? '#0f172a' : '#64748b',
              fontWeight: '700',
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'ALL_RETURNABLE' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            📦 Warehouse Returnable Stock ({returnableItems.length})
          </button>

          <button
            onClick={() => setActiveTab('EXPIRED_CLAIMS')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'EXPIRED_CLAIMS' ? '#ffffff' : 'transparent',
              color: activeTab === 'EXPIRED_CLAIMS' ? '#0f172a' : '#64748b',
              fontWeight: '700',
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'EXPIRED_CLAIMS' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            ⚠️ Expired Stock Batches ({expiredItems.length})
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search DN#, Vendor, Bill Ref..."
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

      {/* TAB 1: VENDOR DEBIT NOTES LIST */}
      {activeTab === 'DEBIT_NOTES' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
          
          {/* Status Sub-Filters */}
          <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginRight: '6px' }}>
              Filter by Status:
            </span>
            {['ALL', 'OPEN', 'CLOSED', 'DRAFT', 'VOID'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: statusFilter === st ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  background: statusFilter === st ? '#eff6ff' : '#ffffff',
                  color: statusFilter === st ? '#1d4ed8' : '#475569',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {st}
              </button>
            ))}
          </div>

          {filteredDebitNotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <FileText size={48} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#0f172a' }}>No Vendor Debit Notes Found</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.86rem' }}>
                {searchTerm || statusFilter !== 'ALL' 
                  ? 'No debit notes match your current filters. Try resetting the filters.'
                  : 'Return overstock or expired goods to suppliers to generate GST Debit Notes and reduce accounts payable.'}
              </p>
              <button
                onClick={handleOpenNewDebitNote}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} /> Create First Debit Note
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px' }}>Date & DN #</th>
                    <th style={{ padding: '12px 14px' }}>Vendor / Supplier</th>
                    <th style={{ padding: '12px 14px' }}>Bill Ref</th>
                    <th style={{ padding: '12px 14px' }}>Reason</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Credit (₹)</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Unused Balance (₹)</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDebitNotes.map((dn) => {
                    const status = dn.status || 'Open';
                    const unused = Number(dn.remaining_credit_balance !== undefined ? dn.remaining_credit_balance : dn.total_credit_amount || 0);

                    return (
                      <tr 
                        key={dn.id} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          opacity: status === 'Void' ? 0.65 : 1,
                          background: status === 'Void' ? '#fafafa' : '#ffffff'
                        }}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: '800', color: status === 'Void' ? '#64748b' : '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={15} />
                            <span>{dn.debit_note_number}</span>
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                            {dn.return_date || dn.date?.split('T')[0]}
                          </div>
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>
                            {dn.vendor_name || dn.supplierName || 'Primary Vendor'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            {dn.items?.length || 0} line item(s)
                          </div>
                        </td>

                        <td style={{ padding: '12px 14px', fontSize: '0.82rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#334155' }}>
                            {dn.originalBillNo || 'Direct'}
                          </span>
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            background: dn.reason === 'Expired Stock' ? '#fee2e2' : '#f1f5f9',
                            color: dn.reason === 'Expired Stock' ? '#b91c1c' : '#334155'
                          }}>
                            {dn.reason || 'General Return'}
                          </span>
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                          ₹{Number(dn.total_credit_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {status === 'Open' ? (
                            <span style={{ fontWeight: '800', color: '#16a34a' }}>
                              ₹{unused.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>₹0.00</span>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {status === 'Open' && (
                            <span style={{ padding: '3px 9px', borderRadius: '12px', background: '#dbeafe', color: '#1e40af', fontSize: '0.75rem', fontWeight: '800' }}>
                              OPEN
                            </span>
                          )}
                          {status === 'Closed' && (
                            <span style={{ padding: '3px 9px', borderRadius: '12px', background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: '800' }}>
                              CLOSED
                            </span>
                          )}
                          {status === 'Draft' && (
                            <span style={{ padding: '3px 9px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', fontWeight: '700' }}>
                              DRAFT
                            </span>
                          )}
                          {status === 'Void' && (
                            <span style={{ padding: '3px 9px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', fontSize: '0.75rem', fontWeight: '800' }}>
                              VOID
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setSelectedNoteForView(dn);
                                setIsViewModalOpen(true);
                              }}
                              title="View & Print Debit Note PDF"
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                fontSize: '0.78rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>

                            {status === 'Open' && unused > 0 && (
                              <button
                                onClick={() => handleOpenApplyModal(dn)}
                                title="Apply credit to unpaid purchase bills"
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  background: '#ecfdf5',
                                  border: '1px solid #a7f3d0',
                                  color: '#047857',
                                  fontSize: '0.78rem',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <CreditCard size={13} />
                                <span>Apply to Bills</span>
                              </button>
                            )}

                            {status !== 'Void' && (
                              <button
                                onClick={() => handleOpenVoidModal(dn)}
                                title="Void Debit Note (restores stock & vendor ledger)"
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  fontSize: '0.78rem',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                <Ban size={13} />
                              </button>
                            )}
                          </div>
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

      {/* TAB 2: ALL RETURNABLE GODOWN STOCK TABLE */}
      {activeTab === 'ALL_RETURNABLE' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
          {filteredReturnable.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
              <Package size={44} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
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
                    <th style={{ padding: '12px 14px' }}>Batch / Expiry</th>
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
                          <div style={{ fontSize: '0.74rem', color: it.isExpired ? '#dc2626' : '#64748b', fontWeight: it.isExpired ? '700' : 'normal' }}>
                            {it.expiryDate ? `EXP: ${it.expiryDate}` : 'No Expiry Set'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                          {it.availableStock} {it.unit || 'Pcs'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '0.82rem' }}>
                          <div>₹{Number(it.purchasePrice || 0).toFixed(2)}</div>
                          <div style={{ fontSize: '0.72rem', color: '#059669' }}>inc. GST</div>
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
                            onClick={() => handleClaimSingleItem(it, false)}
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

      {/* TAB 3: EXPIRED STOCK BATCHES TABLE */}
      {activeTab === 'EXPIRED_CLAIMS' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
          {filteredExpired.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
              <CheckCircle2 size={44} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
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
                            onClick={() => handleClaimSingleItem(it, true)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: '#ef4444',
                              border: 'none',
                              color: '#ffffff',
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

      {/* MODAL 1: NEW VENDOR DEBIT NOTE BUILDER (ZOHO BOOKS STYLE) */}
      {createModalOpen && (
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
            maxWidth: '820px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.3rem', fontWeight: '800', color: '#0f172a' }}>
                  Create Vendor Debit Note (Vendor Credit)
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                  Reduces warehouse stock, debits vendor payable ledger, and accounts for Section 17(5)(h) ITC Reversal.
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={e => { e.preventDefault(); handleSaveDebitNote('Open'); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Header Fields: Vendor, Bill Ref, Date, Reason */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                    Select Vendor / Supplier *
                  </label>
                  <select
                    value={formVendorId}
                    onChange={e => {
                      const id = e.target.value;
                      setFormVendorId(id);
                      const s = suppliers.find(sup => sup.id === id);
                      if (s) setFormVendorName(s.name || s.tradeName);
                    }}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.86rem' }}
                    required
                  >
                    <option value="">-- Choose Vendor --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name || s.tradeName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                    Original Purchase Bill Ref
                  </label>
                  <select
                    value={formPurchaseBillId}
                    onChange={e => {
                      const bId = e.target.value;
                      setFormPurchaseBillId(bId);
                      const b = purchases.find(p => p.id === bId);
                      if (b) {
                        setFormOriginalBillNo(b.billNo || b.id);
                        setFormOriginalBillDate(b.date || '');
                      } else {
                        setFormOriginalBillNo('');
                        setFormOriginalBillDate('');
                      }
                    }}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.86rem' }}
                  >
                    <option value="">-- Standalone Return (No Bill Ref) --</option>
                    {purchases.filter(p => !formVendorId || p.supplierId === formVendorId || p.partyName?.trim().toLowerCase() === formVendorName?.trim().toLowerCase()).map(b => (
                      <option key={b.id} value={b.id}>
                        Bill #{b.billNo || b.id.substring(0, 8)} ({b.date}) - ₹{Number(b.grandTotal || 0).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                    Return Date *
                  </label>
                  <input
                    type="date"
                    value={formReturnDate}
                    onChange={e => setFormReturnDate(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                    Return Reason *
                  </label>
                  <select
                    value={formReason}
                    onChange={e => setFormReason(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.86rem' }}
                  >
                    <option value="Expired Stock">Expired Stock / Outdated Goods</option>
                    <option value="Damaged Goods">Damaged Goods / Leakage / Breakage</option>
                    <option value="Defective Item">Defective Item / Quality Rejection</option>
                    <option value="Quality Issue">Quality Issue / Vendor Recall</option>
                    <option value="Overstock Return">Overstock / Slow Moving Stock Return</option>
                    <option value="Rate Difference">Rate Difference / Billing Correction</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Items Selector */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0f172a' }}>
                    Returned Line Items ({formItems.length})
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={selectedProductToAdd}
                      onChange={e => {
                        const val = e.target.value;
                        if (val) handleAddItemToForm(val);
                      }}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    >
                      <option value="">+ Add Product to Return...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.currentStock})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formItems.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', border: '1.5px dashed #cbd5e1', borderRadius: '10px', color: '#64748b', fontSize: '0.85rem' }}>
                    Select a product from the dropdown above to add items to this debit note.
                  </div>
                ) : (
                  <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                          <th style={{ padding: '8px 10px' }}>Product</th>
                          <th style={{ padding: '8px 10px', width: '110px' }}>Batch / Exp</th>
                          <th style={{ padding: '8px 10px', width: '90px', textAlign: 'right' }}>Warehouse</th>
                          <th style={{ padding: '8px 10px', width: '95px', textAlign: 'center' }}>Return Qty</th>
                          <th style={{ padding: '8px 10px', width: '100px', textAlign: 'right' }}>Rate (₹)</th>
                          <th style={{ padding: '8px 10px', width: '80px', textAlign: 'center' }}>GST %</th>
                          <th style={{ padding: '8px 10px', width: '100px', textAlign: 'right' }}>Total (₹)</th>
                          <th style={{ padding: '8px 10px', width: '40px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formItems.map((it, idx) => {
                          const lineTaxable = Number(it.returnQty || 0) * Number(it.purchasePrice || 0);
                          const lineTotal = lineTaxable * (1 + Number(it.taxRate || 0) / 100);

                          return (
                            <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontWeight: '700', color: '#0f172a' }}>{it.productName}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>HSN: {it.hsn}</div>
                              </td>

                              <td style={{ padding: '8px 10px' }}>
                                <input
                                  type="text"
                                  value={it.batchNo || ''}
                                  placeholder="Batch"
                                  onChange={e => {
                                    const updated = [...formItems];
                                    updated[idx].batchNo = e.target.value;
                                    setFormItems(updated);
                                  }}
                                  style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.78rem', boxSizing: 'border-box' }}
                                />
                              </td>

                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#64748b' }}>
                                {it.availableStock}
                              </td>

                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="1"
                                  max={it.availableStock}
                                  value={it.returnQty}
                                  onChange={e => {
                                    const val = Math.max(1, Math.min(it.availableStock, Number(e.target.value) || 1));
                                    const updated = [...formItems];
                                    updated[idx].returnQty = val;
                                    setFormItems(updated);
                                  }}
                                  style={{ width: '70px', padding: '5px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '700' }}
                                />
                              </td>

                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.purchasePrice}
                                  onChange={e => {
                                    const updated = [...formItems];
                                    updated[idx].purchasePrice = Number(e.target.value) || 0;
                                    setFormItems(updated);
                                  }}
                                  style={{ width: '80px', padding: '5px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '600' }}
                                />
                              </td>

                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <select
                                  value={it.taxRate}
                                  onChange={e => {
                                    const updated = [...formItems];
                                    updated[idx].taxRate = Number(e.target.value) || 0;
                                    setFormItems(updated);
                                  }}
                                  style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                                >
                                  <option value="0">0%</option>
                                  <option value="5">5%</option>
                                  <option value="12">12%</option>
                                  <option value="18">18%</option>
                                  <option value="28">28%</option>
                                </select>
                              </td>

                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                                ₹{lineTotal.toFixed(2)}
                              </td>

                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormItems(formItems.filter((_, i) => i !== idx));
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                >
                                  <Trash2 size={15} />
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

              {/* Totals Summary */}
              {formItems.length > 0 && (
                <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '24px', fontSize: '0.88rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Subtotal: </span>
                    <strong>₹{formSubtotal.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>GST (Reversed ITC): </span>
                    <strong style={{ color: '#b45309' }}>₹{formTax.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#0f172a', fontWeight: '800' }}>Total Debit Note Amount: </span>
                    <strong style={{ fontSize: '1.1rem', color: '#16a34a' }}>₹{formTotal.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              {/* Checkboxes & Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="checkReverseItc"
                    checked={formReverseItc}
                    onChange={e => setFormReverseItc(e.target.checked)}
                  />
                  <label htmlFor="checkReverseItc" style={{ fontSize: '0.82rem', color: '#92400e', cursor: 'pointer' }}>
                    <strong>Apply Section 17(5)(h) ITC Reversal:</strong> Statutorily reverses Input Tax Credit claimed on returned or scrapped stock.
                  </label>
                </div>

                {formPurchaseBillId && (
                  <div style={{ padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id="checkAutoApply"
                      checked={formAutoApply}
                      onChange={e => setFormAutoApply(e.target.checked)}
                    />
                    <label htmlFor="checkAutoApply" style={{ fontSize: '0.82rem', color: '#065f46', cursor: 'pointer' }}>
                      <strong>Auto-apply credit to Purchase Bill #{formOriginalBillNo}:</strong> Immediately offsets this debit amount against the bill's outstanding balance.
                    </label>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                    Notes / Instructions for Supplier
                  </label>
                  <textarea
                    rows="2"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="e.g. Return handed over to vendor delivery representative; credit note to be adjusted in next ledger statement."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveDebitNote('Draft')}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#334155', fontWeight: '700', cursor: 'pointer' }}
                >
                  Save as Draft
                </button>

                <button
                  type="submit"
                  style={{ padding: '9px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: '700', cursor: 'pointer' }}
                >
                  Issue & Confirm Debit Note (Open)
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: APPLY CREDIT TO UNPAID BILLS (SETTLEMENT MODAL) */}
      {applyModalOpen && creditToApply && (
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
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
                  Apply Credit to Purchase Bills
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
                  Allocate available credit balance from Debit Note #{creditToApply.debit_note_number} against unpaid vendor bills.
                </p>
              </div>
              <button
                onClick={() => setApplyModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Credit Info Box */}
            <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>Vendor</div>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#14532d' }}>{creditToApply.vendor_name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>Available Credit</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#15803d' }}>
                  ₹{Number(creditToApply.remaining_credit_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Bills List */}
            {vendorUnpaidBills.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1.5px dashed #cbd5e1' }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.96rem' }}>No Unpaid Bills Found</div>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                  All purchase bills for {creditToApply.vendor_name} are currently settled. This credit balance remains active for upcoming purchase bills.
                </p>
              </div>
            ) : (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '10px 12px' }}>Bill # & Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Bill Total</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Balance Due</th>
                      <th style={{ padding: '10px 12px', width: '150px', textAlign: 'right' }}>Amount to Apply (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorUnpaidBills.map(bill => {
                      const curVal = billAllocations[bill.id] || 0;
                      return (
                        <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{bill.billNo || bill.id.substring(0, 8)}</div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{bill.date}</div>
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>
                            ₹{Number(bill.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                            ₹{Number(bill.balanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <input
                                type="number"
                                min="0"
                                max={Math.min(bill.balanceAmount, Number(creditToApply.remaining_credit_balance || 0))}
                                value={curVal}
                                onChange={e => {
                                  const val = Math.max(0, Math.min(bill.balanceAmount, Number(e.target.value) || 0));
                                  setBillAllocations({
                                    ...billAllocations,
                                    [bill.id]: val
                                  });
                                }}
                                style={{ width: '90px', padding: '5px 8px', borderRadius: '6px', border: '1.5px solid #cbd5e1', textAlign: 'right', fontWeight: '700' }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const maxCanApply = Math.min(bill.balanceAmount, Number(creditToApply.remaining_credit_balance || 0));
                                  setBillAllocations({
                                    ...billAllocations,
                                    [bill.id]: maxCanApply
                                  });
                                }}
                                style={{ padding: '4px 6px', borderRadius: '4px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}
                              >
                                Full
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Allocation Summary */}
                {(() => {
                  const totalAlloc = Object.values(billAllocations).reduce((s, a) => s + (Number(a) || 0), 0);
                  const remAfter = Math.max(0, Number(creditToApply.remaining_credit_balance) - totalAlloc);
                  return (
                    <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Total Credit Applied:</div>
                        <strong style={{ fontSize: '1.1rem', color: '#2563eb' }}>₹{totalAlloc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Remaining Unused Credit:</div>
                        <strong style={{ fontSize: '1.1rem', color: remAfter === 0 ? '#16a34a' : '#0f172a' }}>
                          ₹{remAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
                  <button
                    type="button"
                    onClick={() => setApplyModalOpen(false)}
                    style={{ padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmApply}
                    style={{ padding: '9px 24px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#ffffff', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Confirm & Apply Credit
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL 3: VOID CONFIRMATION MODAL */}
      {voidConfirmModalOpen && creditToVoid && (
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
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <Ban size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>
                  Void Debit Note #{creditToVoid.debit_note_number}?
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Non-deletable statutory action
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, margin: '0 0 14px 0' }}>
              Voiding preserves the sequential <strong>{creditToVoid.debit_note_number}</strong> numbering for audit compliance, but restores warehouse inventory and credits back the vendor's ledger balance.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', marginBottom: '6px', color: '#334155' }}>
                Reason for Voiding:
              </label>
              <input
                type="text"
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setVoidConfirmModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '700', cursor: 'pointer' }}
              >
                Go Back
              </button>

              <button
                type="button"
                onClick={handleExecuteVoid}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#ffffff', fontWeight: '700', cursor: 'pointer' }}
              >
                Confirm & Void Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUTORY DEBIT NOTE VIEW / PDF MODAL */}
      {isViewModalOpen && selectedNoteForView && (
        <DebitNoteModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          debitNote={selectedNoteForView}
          business={business}
        />
      )}

    </div>
  );
}
