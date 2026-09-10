import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckCircle, 
  DollarSign, 
  CreditCard, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Send, 
  Printer, 
  AlertCircle, 
  RotateCcw, 
  X, 
  Layers, 
  Calendar, 
  User, 
  Building, 
  QrCode, 
  Clock, 
  Tag, 
  Percent, 
  Truck, 
  BookOpen, 
  MessageSquare, 
  Check, 
  FileSpreadsheet,
  Zap,
  Info
} from 'lucide-react';
import { 
  saveInvoice, 
  postInvoice, 
  registerInvoicePayment, 
  createCreditNote, 
  resetInvoiceToDraft, 
  cancelInvoice, 
  calculateDueDate,
  formatCartonStock, 
  fetchWarehouses, 
  getCurrentOperator 
} from '../utils/storage';
import { calculateBillTotals, detectSupplyType } from '../utils/taxUtils';
import { generateUpiQrDataUrl, buildInvoiceShareText, buildWhatsAppUrl } from '../utils/qrUtils';

export default function OdooInvoiceForm({ 
  invoice: initialInvoice, 
  parties = [], 
  products = [], 
  business, 
  onClose, 
  onSave, 
  refreshAllData, 
  handlePrintInvoice 
}) {
  const currentOp = getCurrentOperator();
  const warehouses = fetchWarehouses();

  // Invoice Header State
  const isNew = !initialInvoice || !initialInvoice.id;
  const [invoice, setInvoice] = useState(initialInvoice || {
    state: 'draft',
    documentType: 'out_invoice',
    partyId: '',
    partyName: '',
    customerName: '',
    partyGstin: '',
    partyAddress: '',
    partyPhone: '',
    date: new Date().toISOString().split('T')[0],
    paymentTerms: 'immediate',
    dueDate: new Date().toISOString().split('T')[0],
    journal: 'INV',
    warehouseId: warehouses[0]?.id || 'wh_main',
    pricingType: 'EXCLUSIVE',
    taxMode: 'INTRA',
    roundOffEnabled: true,
    discountType: 'AMOUNT',
    discountValue: 0,
    items: [],
    notes: '',
    customerReference: '',
    salesperson: currentOp?.name || 'Administrator',
    ewayBill: null,
    payments: [],
    chatter: []
  });

  const [activeNotebookTab, setActiveNotebookTab] = useState('lines'); // 'lines', 'other_info', 'accounting', 'chatter'
  
  // Modals state
  const [registerPaymentModalOpen, setRegisterPaymentModalOpen] = useState(false);
  const [creditNoteModalOpen, setCreditNoteModalOpen] = useState(false);
  const [newChatterNote, setNewChatterNote] = useState('');
  
  // Payment Wizard State
  const [paymentForm, setPaymentForm] = useState({
    journal: 'BANK',
    paymentMethod: 'UPI',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    memo: '',
    paymentDifferenceAction: 'keep_open'
  });
  const [upiQrPreviewUrl, setUpiQrPreviewUrl] = useState(null);

  // Credit Note Wizard State
  const [creditNoteReason, setCreditNoteReason] = useState('Customer Return / Pricing Adjustment');

  // Selected party object
  const selectedParty = parties.find(p => p.id === invoice.partyId);

  // Auto-detect supply type (Intra vs Inter) based on Seller and Buyer GSTIN
  useEffect(() => {
    if (selectedParty && selectedParty.gstin && business?.gstin) {
      const detected = detectSupplyType(business.gstin, selectedParty.gstin);
      setInvoice(prev => ({ ...prev, taxMode: detected }));
    }
  }, [selectedParty, business]);

  // Update Due Date when Payment Terms or Invoice Date changes
  const handlePaymentTermsChange = (newTerms) => {
    const computedDue = calculateDueDate(invoice.date, newTerms);
    setInvoice(prev => ({
      ...prev,
      paymentTerms: newTerms,
      dueDate: computedDue
    }));
  };

  const handleInvoiceDateChange = (newDate) => {
    const computedDue = calculateDueDate(newDate, invoice.paymentTerms);
    setInvoice(prev => ({
      ...prev,
      date: newDate,
      dueDate: computedDue
    }));
  };

  const handlePartySelect = (partyId) => {
    const p = parties.find(party => party.id === partyId);
    if (p) {
      setInvoice(prev => ({
        ...prev,
        partyId: p.id,
        partyName: p.name,
        customerName: p.name,
        partyPhone: p.phone,
        partyGstin: p.gstin || '',
        partyAddress: p.address || p.city || ''
      }));
    } else {
      setInvoice(prev => ({
        ...prev,
        partyId: '',
        partyName: 'Cash Customer',
        customerName: 'Cash Customer',
        partyPhone: '',
        partyGstin: '',
        partyAddress: ''
      }));
    }
  };

  // Line Items Operations (Standard Odoo invoice_line_ids)
  const handleAddLine = () => {
    const firstProd = products[0];
    const pcsPerCtn = Number(firstProd?.pcsPerCarton) || 24;
    const rate = Number(firstProd?.salePrice || firstProd?.mrp || 100);

    const newLine = {
      lineId: 'line_' + Date.now(),
      productId: firstProd?.id || 'prod_1',
      name: firstProd?.name || 'Product',
      sku: firstProd?.sku || '',
      hsn: firstProd?.hsn || '1905',
      qty: 1,
      pcsPerCarton: pcsPerCtn,
      cartonQty: 0,
      looseQty: 1,
      unit: firstProd?.unit || 'Pcs',
      price: rate,
      gstRate: firstProd?.gstRate || 18,
      itemDiscountType: 'PERCENT',
      itemDiscountVal: 0,
      isSection: false,
      isNote: false
    };

    setInvoice(prev => ({
      ...prev,
      items: [...prev.items, newLine]
    }));
  };

  const handleAddSection = () => {
    const newSection = {
      lineId: 'sec_' + Date.now(),
      name: 'New Section (e.g. Beverages)',
      isSection: true,
      isNote: false,
      qty: 0,
      price: 0,
      total: 0
    };
    setInvoice(prev => ({
      ...prev,
      items: [...prev.items, newSection]
    }));
  };

  const handleAddNote = () => {
    const newNote = {
      lineId: 'not_' + Date.now(),
      name: 'Note: Special handling instructions or batch details...',
      isSection: false,
      isNote: true,
      qty: 0,
      price: 0,
      total: 0
    };
    setInvoice(prev => ({
      ...prev,
      items: [...prev.items, newNote]
    }));
  };

  const handleUpdateLine = (index, field, value) => {
    const updated = [...invoice.items];
    const item = { ...updated[index], [field]: value };

    // If product changed, update defaults
    if (field === 'productId') {
      const p = products.find(prod => prod.id === value);
      if (p) {
        item.name = p.name;
        item.sku = p.sku;
        item.hsn = p.hsn;
        item.price = Number(p.salePrice || p.mrp);
        item.gstRate = p.gstRate || 0;
        item.pcsPerCarton = Number(p.pcsPerCarton) || 24;
      }
    }

    // Recalculate dual-unit quantities if carton or loose changes
    if (field === 'cartonQty' || field === 'looseQty') {
      const pcsPerCtn = Number(item.pcsPerCarton) || 24;
      const ctn = field === 'cartonQty' ? Math.max(0, parseInt(value) || 0) : Number(item.cartonQty || 0);
      const loose = field === 'looseQty' ? Math.max(0, parseInt(value) || 0) : Number(item.looseQty || 0);
      item.qty = (ctn * pcsPerCtn) + loose;
    }

    updated[index] = item;
    setInvoice(prev => ({ ...prev, items: updated }));
  };

  const handleRemoveLine = (index) => {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Centralized GST Math calculations (excluding section/note dummy lines)
  const taxableItems = (invoice.items || []).filter(item => !item.isSection && !item.isNote);
  const billCalc = calculateBillTotals({
    cartItems: taxableItems,
    taxType: invoice.pricingType || 'EXCLUSIVE',
    supplyType: invoice.taxMode === 'NONE' ? 'EXEMPT' : (invoice.taxMode || 'INTRA'),
    overallDiscountVal: invoice.discountValue || 0,
    overallDiscountType: invoice.discountType || 'AMOUNT',
    roundOffEnabled: invoice.roundOffEnabled !== false
  });

  const grossSubTotal = billCalc.grossSubtotal;
  const itemDiscountsTotal = billCalc.itemDiscountsTotal;
  const taxableSubtotal = billCalc.taxableSubtotal;
  const totalGstAmount = billCalc.taxTotal;
  const cgst = billCalc.cgst;
  const sgst = billCalc.sgst;
  const igst = billCalc.igst;
  const roundOff = billCalc.roundOff;
  const grandTotal = billCalc.grandTotal;

  // Payments & Residual calculation
  const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), Number(invoice.paidAmount || 0));
  const amountDue = Math.max(0, grandTotal - totalPaid);

  // Odoo Lifecycle Action Handlers
  const handleSaveDraft = () => {
    const payload = {
      ...invoice,
      items: invoice.items,
      subTotal: grossSubTotal,
      subtotal: grossSubTotal,
      taxableAmount: taxableSubtotal,
      taxableSubtotal: taxableSubtotal,
      taxTotal: totalGstAmount,
      cgst,
      sgst,
      igst,
      roundOff,
      grandTotal,
      paidAmount: totalPaid,
      amountDue,
      state: 'draft'
    };

    const saved = saveInvoice(payload);
    setInvoice(saved);
    if (refreshAllData) refreshAllData();
    alert('✅ Draft Invoice saved successfully!');
    if (onSave) onSave(saved);
  };

  const handleConfirmPost = () => {
    if (invoice.items.length === 0) {
      alert('⚠️ Invoice must have at least one product line!');
      return;
    }

    let currentInv = invoice;
    if (!currentInv.id || currentInv.state === 'draft') {
      const payload = {
        ...invoice,
        items: invoice.items,
        subTotal: grossSubTotal,
        subtotal: grossSubTotal,
        taxableAmount: taxableSubtotal,
        taxableSubtotal: taxableSubtotal,
        taxTotal: totalGstAmount,
        cgst,
        sgst,
        igst,
        roundOff,
        grandTotal,
        paidAmount: totalPaid,
        amountDue,
        state: 'draft'
      };
      currentInv = saveInvoice(payload);
    }

    const posted = postInvoice(currentInv.id);
    setInvoice(posted);
    if (refreshAllData) refreshAllData();
    alert(`🎉 Invoice #${posted.invoiceNo} confirmed and posted! Stock committed and ledger updated.`);
    if (onSave) onSave(posted);
  };

  const handleOpenRegisterPayment = () => {
    setPaymentForm({
      journal: 'BANK',
      paymentMethod: 'UPI',
      amount: amountDue.toFixed(2),
      paymentDate: new Date().toISOString().split('T')[0],
      memo: `Payment for ${invoice.invoiceNo}`,
      paymentDifferenceAction: 'keep_open'
    });

    // Generate dynamic UPI QR Code preview for instant payment
    generateUpiQrDataUrl(business?.upiId, business?.name, amountDue, invoice.invoiceNo).then(url => {
      setUpiQrPreviewUrl(url);
    });

    setRegisterPaymentModalOpen(true);
  };

  const handleExecutePayment = (e) => {
    e.preventDefault();
    const payAmt = Number(paymentForm.amount);
    if (payAmt <= 0) {
      alert('⚠️ Please enter a valid payment amount!');
      return;
    }

    const updated = registerInvoicePayment(invoice.id, {
      amount: payAmt,
      journal: paymentForm.journal,
      paymentMethod: paymentForm.paymentMethod,
      paymentDate: paymentForm.paymentDate,
      memo: paymentForm.memo,
      paymentDifferenceAction: paymentForm.paymentDifferenceAction
    });

    setInvoice(updated);
    setRegisterPaymentModalOpen(false);
    if (refreshAllData) refreshAllData();
    alert(`✅ Recorded payment of ₹${payAmt.toLocaleString('en-IN')}. Current state: ${updated.state.toUpperCase()}`);
    if (onSave) onSave(updated);
  };

  const handleExecuteCreditNote = (e) => {
    e.preventDefault();
    const creditNote = createCreditNote(invoice.id, creditNoteReason);
    setCreditNoteModalOpen(false);
    if (refreshAllData) refreshAllData();
    alert(`✅ Created Credit Note #${creditNote.invoiceNo} reversing invoice. Stock restored & customer credited.`);
    if (onClose) onClose();
  };

  const handleResetDraft = () => {
    if (window.confirm('⚠️ Are you sure you want to reset this invoice to Draft? Stock deductions and customer ledger debt will be reversed.')) {
      const reset = resetInvoiceToDraft(invoice.id);
      setInvoice(reset);
      if (refreshAllData) refreshAllData();
      alert('Invoice reset to Draft.');
    }
  };

  const handleCancel = () => {
    if (window.confirm('⚠️ Cancel this invoice?')) {
      const cancelled = cancelInvoice(invoice.id);
      setInvoice(cancelled);
      if (refreshAllData) refreshAllData();
    }
  };

  const handleAddChatterNote = (e) => {
    e.preventDefault();
    if (!newChatterNote.trim()) return;

    const newLog = {
      id: 'cht_' + Date.now(),
      date: new Date().toISOString(),
      author: currentOp?.name || 'User',
      text: newChatterNote.trim(),
      type: 'user'
    };

    const updatedChatter = [...(invoice.chatter || []), newLog];
    const updated = { ...invoice, chatter: updatedChatter };
    setInvoice(updated);
    saveInvoice(updated);
    setNewChatterNote('');
    if (refreshAllData) refreshAllData();
  };

  return (
    <div className="odoo-invoice-studio" style={{ background: '#f8fafc', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* 1. Odoo Top Control Panel & Action Bar */}
      <div style={{ 
        background: '#ffffff', 
        borderBottom: '1px solid #e2e8f0', 
        padding: '12px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left Side: Back navigation & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {onClose && (
            <button 
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} />
              <span>Invoices</span>
            </button>
          )}

          {/* Odoo Status-based Action Buttons */}
          {invoice.state === 'draft' && (
            <>
              <button 
                onClick={handleConfirmPost}
                className="btn btn-primary btn-sm"
                style={{ background: '#714B67', borderColor: '#714B67', color: '#fff', fontWeight: '800', padding: '7px 14px' }}
              >
                Confirm (पुष्ट करें)
              </button>
              <button 
                onClick={handleSaveDraft}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: '700' }}
              >
                Save as Draft
              </button>
              <button 
                onClick={handleCancel}
                className="btn btn-sm"
                style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
              >
                Cancel
              </button>
            </>
          )}

          {(invoice.state === 'posted' || invoice.state === 'in_payment') && (
            <>
              {amountDue > 0 && (
                <button 
                  onClick={handleOpenRegisterPayment}
                  className="btn btn-primary btn-sm"
                  style={{ background: '#059669', borderColor: '#059669', color: '#fff', fontWeight: '800', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <DollarSign size={16} />
                  <span>Register Payment (भुगतान दर्ज करें)</span>
                </button>
              )}
              <button 
                onClick={() => setCreditNoteModalOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={14} />
                <span>Credit Note (Refund)</span>
              </button>
              <button 
                onClick={handleResetDraft}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.8rem' }}
              >
                Reset to Draft
              </button>
            </>
          )}

          {invoice.state === 'paid' && (
            <button 
              onClick={() => setCreditNoteModalOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} />
              <span>Credit Note (Refund)</span>
            </button>
          )}

          {/* Universal Print & WhatsApp Share */}
          <button 
            onClick={() => handlePrintInvoice && handlePrintInvoice(invoice)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={15} />
            <span>Print</span>
          </button>

          <button 
            onClick={() => {
              const text = buildInvoiceShareText(invoice, business);
              const url = buildWhatsAppUrl(invoice.partyPhone, text);
              window.open(url, '_blank');
            }}
            className="btn btn-sm"
            style={{ background: '#25D366', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Send size={14} />
            <span>WhatsApp</span>
          </button>
        </div>

        {/* Right Side: Odoo Classic Breadcrumb Status Pipeline */}
        <div className="odoo-statusbar-pipeline" style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
          {invoice.state === 'cancel' ? (
            <>
              <div style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: '700', color: '#64748b' }}>Draft</div>
              <div style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: '800', background: '#ef4444', color: '#ffffff' }}>Cancelled</div>
            </>
          ) : (
            <>
              <div style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: '800',
                background: invoice.state === 'draft' ? '#714B67' : 'transparent',
                color: invoice.state === 'draft' ? '#ffffff' : '#64748b',
                transition: 'all 0.2s'
              }}>
                Draft
              </div>
              <div style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: '800',
                background: invoice.state === 'posted' ? '#2563eb' : 'transparent',
                color: invoice.state === 'posted' ? '#ffffff' : '#64748b',
                transition: 'all 0.2s'
              }}>
                Posted
              </div>
              <div style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: '800',
                background: invoice.state === 'in_payment' ? '#d97706' : 'transparent',
                color: invoice.state === 'in_payment' ? '#ffffff' : '#64748b',
                transition: 'all 0.2s'
              }}>
                In Payment
              </div>
              <div style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: '800',
                background: invoice.state === 'paid' ? '#059669' : 'transparent',
                color: invoice.state === 'paid' ? '#ffffff' : '#64748b',
                transition: 'all 0.2s'
              }}>
                Paid
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Odoo Form Sheet (`o_form_sheet`) */}
      <div style={{ 
        maxWidth: '1200px', 
        width: '100%', 
        margin: '0 auto', 
        background: '#ffffff', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0', 
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        position: 'relative',
        overflow: 'hidden'
      }}>

        {/* Diagonal Odoo Ribbon Stamp (PAID / IN PAYMENT) */}
        {invoice.state === 'paid' && (
          <div style={{
            position: 'absolute',
            top: '26px',
            right: '-36px',
            transform: 'rotate(45deg)',
            background: '#059669',
            color: '#ffffff',
            fontWeight: '900',
            fontSize: '0.84rem',
            padding: '4px 44px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            letterSpacing: '1px',
            zIndex: 10
          }}>
            PAID
          </div>
        )}
        {invoice.state === 'in_payment' && (
          <div style={{
            position: 'absolute',
            top: '26px',
            right: '-36px',
            transform: 'rotate(45deg)',
            background: '#d97706',
            color: '#ffffff',
            fontWeight: '900',
            fontSize: '0.8rem',
            padding: '4px 34px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            letterSpacing: '1px',
            zIndex: 10
          }}>
            IN PAYMENT
          </div>
        )}
        {invoice.state === 'cancel' && (
          <div style={{
            position: 'absolute',
            top: '26px',
            right: '-36px',
            transform: 'rotate(45deg)',
            background: '#ef4444',
            color: '#ffffff',
            fontWeight: '900',
            fontSize: '0.8rem',
            padding: '4px 34px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            letterSpacing: '1px',
            zIndex: 10
          }}>
            CANCELLED
          </div>
        )}

        <div style={{ padding: '30px' }}>
          
          {/* Document Title / Number */}
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
              {invoice.documentType === 'out_refund' ? 'Credit Note / Reversal' : 'Customer Invoice'}
            </span>
            <h1 style={{ fontSize: '1.85rem', fontWeight: '900', color: '#1e293b', margin: '4px 0 0 0' }}>
              {invoice.state === 'draft' ? (invoice.invoiceNo || 'Draft Invoice') : invoice.invoiceNo}
            </h1>
            {invoice.reversalOf && (
              <div style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: '700', marginTop: '4px' }}>
                Reversal of Invoice: {invoice.reversalOf} ({invoice.reversalReason})
              </div>
            )}
          </div>

          {/* Partner & Metadata 2-Column Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
            
            {/* Left Column: Customer Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: '800', color: '#475569' }}>
                  Customer (पार्टी / ग्राहक) *
                </label>
                <select 
                  className="form-control"
                  style={{ fontSize: '0.92rem', padding: '8px 12px' }}
                  value={invoice.partyId}
                  onChange={e => handlePartySelect(e.target.value)}
                  disabled={invoice.state !== 'draft'}
                >
                  <option value="">Cash Customer (नकद काउंटर ग्राहक)</option>
                  {parties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.city ? `(${p.city})` : ''} {Number(p.balance) > 0 ? `• Due: ₹${Number(p.balance).toLocaleString('en-IN')}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Partner Address & GSTIN Info Box */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#334155' }}>
                <div><strong>Address:</strong> {invoice.partyAddress || 'Local Market'}</div>
                <div><strong>Phone:</strong> {invoice.partyPhone || 'N/A'}</div>
                <div><strong>GSTIN / Tax ID:</strong> <span style={{ color: '#2563eb', fontWeight: '700' }}>{invoice.partyGstin || 'Unregistered (B2C)'}</span></div>
                {selectedParty && (
                  <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #cbd5e1', color: Number(selectedParty.balance) > 0 ? '#dc2626' : '#059669', fontWeight: '800' }}>
                    Outstanding Khata Balance: ₹{Number(selectedParty.balance || 0).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Invoice Dates, Payment Terms & Warehouse */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>
                  Invoice Date (बिल दिनांक)
                </label>
                <input 
                  type="date"
                  className="form-control"
                  style={{ fontSize: '0.85rem' }}
                  value={invoice.date ? invoice.date.split('T')[0] : ''}
                  onChange={e => handleInvoiceDateChange(e.target.value)}
                  disabled={invoice.state !== 'draft'}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>
                  Payment Terms (भुगतान शर्तें)
                </label>
                <select 
                  className="form-control"
                  style={{ fontSize: '0.85rem' }}
                  value={invoice.paymentTerms}
                  onChange={e => handlePaymentTermsChange(e.target.value)}
                  disabled={invoice.state !== 'draft'}
                >
                  <option value="immediate">Immediate Payment</option>
                  <option value="15_days">15 Days</option>
                  <option value="30_days">30 Days</option>
                  <option value="45_days">45 Days</option>
                  <option value="end_of_month">End of Month</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>
                  Due Date (अंतिम तिथि)
                </label>
                <input 
                  type="date"
                  className="form-control"
                  style={{ fontSize: '0.85rem', fontWeight: '700', color: '#dc2626' }}
                  value={invoice.dueDate ? invoice.dueDate.split('T')[0] : ''}
                  onChange={e => setInvoice({ ...invoice, dueDate: e.target.value })}
                  disabled={invoice.state !== 'draft'}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>
                  Journal (खाता बही)
                </label>
                <select 
                  className="form-control"
                  style={{ fontSize: '0.85rem' }}
                  value={invoice.journal}
                  onChange={e => setInvoice({ ...invoice, journal: e.target.value })}
                  disabled={invoice.state !== 'draft'}
                >
                  <option value="INV">Customer Invoices (INV)</option>
                  <option value="CSH">Cash Counter Sales (CSH)</option>
                  <option value="BNK">Bank / Digital Invoices (BNK)</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>
                  Warehouse / Stock Location
                </label>
                <select 
                  className="form-control"
                  style={{ fontSize: '0.85rem' }}
                  value={invoice.warehouseId}
                  onChange={e => setInvoice({ ...invoice, warehouseId: e.target.value })}
                  disabled={invoice.state !== 'draft'}
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. Odoo Notebook Tabs */}
          <div style={{ borderBottom: '1px solid #cbd5e1', display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setActiveNotebookTab('lines')}
              style={{
                padding: '10px 18px',
                border: 'none',
                borderBottom: activeNotebookTab === 'lines' ? '3px solid #714B67' : '3px solid transparent',
                background: 'none',
                fontWeight: activeNotebookTab === 'lines' ? '800' : '600',
                color: activeNotebookTab === 'lines' ? '#714B67' : '#64748b',
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileSpreadsheet size={16} />
              <span>Invoice Lines ({invoice.items?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNotebookTab('other_info')}
              style={{
                padding: '10px 18px',
                border: 'none',
                borderBottom: activeNotebookTab === 'other_info' ? '3px solid #714B67' : '3px solid transparent',
                background: 'none',
                fontWeight: activeNotebookTab === 'other_info' ? '800' : '600',
                color: activeNotebookTab === 'other_info' ? '#714B67' : '#64748b',
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Info size={16} />
              <span>Other Info</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNotebookTab('accounting')}
              style={{
                padding: '10px 18px',
                border: 'none',
                borderBottom: activeNotebookTab === 'accounting' ? '3px solid #714B67' : '3px solid transparent',
                background: 'none',
                fontWeight: activeNotebookTab === 'accounting' ? '800' : '600',
                color: activeNotebookTab === 'accounting' ? '#714B67' : '#64748b',
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Layers size={16} />
              <span>Journal Items (Double-Entry)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNotebookTab('chatter')}
              style={{
                padding: '10px 18px',
                border: 'none',
                borderBottom: activeNotebookTab === 'chatter' ? '3px solid #714B67' : '3px solid transparent',
                background: 'none',
                fontWeight: activeNotebookTab === 'chatter' ? '800' : '600',
                color: activeNotebookTab === 'chatter' ? '#714B67' : '#64748b',
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MessageSquare size={16} />
              <span>Chatter & History ({(invoice.chatter || []).length})</span>
            </button>
          </div>

          {/* TAB 1: INVOICE LINES */}
          {activeNotebookTab === 'lines' && (
            <div>
              {/* Lines Table */}
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '8px 10px', width: '30%' }}>Product</th>
                      <th style={{ padding: '8px 10px', width: '10%' }}>HSN/SAC</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '18%' }}>Quantity (Ctn + Pcs)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '12%' }}>Unit Price (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '10%' }}>Taxes</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '12%' }}>Subtotal (₹)</th>
                      {invoice.state === 'draft' && <th style={{ padding: '8px 6px', width: '4%' }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items?.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                          No invoice lines yet. Click <strong>+ Add a line</strong> below to add products.
                        </td>
                      </tr>
                    ) : (
                      invoice.items.map((item, index) => {
                        // Section Header Row
                        if (item.isSection) {
                          return (
                            <tr key={item.lineId || index} style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                              <td colSpan={invoice.state === 'draft' ? 6 : 7} style={{ padding: '8px 10px', fontWeight: '800', color: '#1e293b' }}>
                                {invoice.state === 'draft' ? (
                                  <input 
                                    type="text"
                                    className="form-control"
                                    style={{ fontWeight: '800', fontSize: '0.88rem', background: '#fff' }}
                                    value={item.name}
                                    onChange={e => handleUpdateLine(index, 'name', e.target.value)}
                                  />
                                ) : (
                                  <span>{item.name}</span>
                                )}
                              </td>
                              {invoice.state === 'draft' && (
                                <td style={{ textAlign: 'right', padding: '8px' }}>
                                  <button onClick={() => handleRemoveLine(index)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        }

                        // Note Row
                        if (item.isNote) {
                          return (
                            <tr key={item.lineId || index} style={{ background: '#fffbeb', borderBottom: '1px dashed #fef3c7' }}>
                              <td colSpan={invoice.state === 'draft' ? 6 : 7} style={{ padding: '6px 10px', fontStyle: 'italic', color: '#b45309' }}>
                                {invoice.state === 'draft' ? (
                                  <input 
                                    type="text"
                                    className="form-control"
                                    style={{ fontSize: '0.82rem', fontStyle: 'italic' }}
                                    value={item.name}
                                    onChange={e => handleUpdateLine(index, 'name', e.target.value)}
                                  />
                                ) : (
                                  <span>{item.name}</span>
                                )}
                              </td>
                              {invoice.state === 'draft' && (
                                <td style={{ textAlign: 'right', padding: '6px' }}>
                                  <button onClick={() => handleRemoveLine(index)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        }

                        // Standard Product Line
                        const lineSubtotal = (Number(item.price) || 0) * (Number(item.qty) || 1);

                        return (
                          <tr key={item.lineId || index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px' }}>
                              {invoice.state === 'draft' ? (
                                <select 
                                  className="form-control"
                                  style={{ fontSize: '0.84rem' }}
                                  value={item.productId}
                                  onChange={e => handleUpdateLine(index, 'productId', e.target.value)}
                                >
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <div>
                                  <div style={{ fontWeight: '700', color: '#1e293b' }}>{item.name}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>SKU: {item.sku || 'N/A'}</div>
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '8px 10px', color: '#64748b' }}>
                              {item.hsn || '1905'}
                            </td>

                            {/* Dual-Unit Qty (Carton + Loose) */}
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {invoice.state === 'draft' ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <input 
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    title="Cartons"
                                    style={{ width: '48px', padding: '3px 4px', textAlign: 'center', fontSize: '0.82rem', fontWeight: '800' }}
                                    className="form-control"
                                    value={item.cartonQty !== undefined ? item.cartonQty : Math.floor((item.qty || 1) / (item.pcsPerCarton || 24))}
                                    onChange={e => handleUpdateLine(index, 'cartonQty', e.target.value)}
                                  />
                                  <span style={{ fontSize: '0.72rem', color: '#714B67', fontWeight: '800' }}>Ctn</span>
                                  <span>+</span>
                                  <input 
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    title="Loose Pcs"
                                    style={{ width: '48px', padding: '3px 4px', textAlign: 'center', fontSize: '0.82rem', fontWeight: '800' }}
                                    className="form-control"
                                    value={item.looseQty !== undefined ? item.looseQty : (item.qty || 1) % (item.pcsPerCarton || 24)}
                                    onChange={e => handleUpdateLine(index, 'looseQty', e.target.value)}
                                  />
                                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Pcs</span>
                                </div>
                              ) : (
                                <div style={{ fontWeight: '700' }}>
                                  {formatCartonStock(item.qty, item.pcsPerCarton)} ({item.qty} {item.unit || 'Pcs'})
                                </div>
                              )}
                            </td>

                            {/* Unit Price */}
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              {invoice.state === 'draft' ? (
                                <input 
                                  type="number"
                                  step="0.01"
                                  style={{ width: '75px', padding: '3px 6px', textAlign: 'right', fontSize: '0.82rem', fontWeight: '700' }}
                                  className="form-control"
                                  value={item.price}
                                  onChange={e => handleUpdateLine(index, 'price', e.target.value)}
                                />
                              ) : (
                                <span style={{ fontWeight: '700' }}>₹{Number(item.price || 0).toFixed(2)}</span>
                              )}
                            </td>

                            {/* Taxes Tag Badge */}
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{ 
                                background: '#ede9fe', 
                                color: '#6d28d9', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontSize: '0.74rem', 
                                fontWeight: '800' 
                              }}>
                                GST {item.gstRate || 0}%
                              </span>
                            </td>

                            {/* Line Subtotal */}
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#1e293b' }}>
                              ₹{lineSubtotal.toFixed(2)}
                            </td>

                            {invoice.state === 'draft' && (
                              <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                                <button onClick={() => handleRemoveLine(index)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Odoo Style "Add a line" / "Add a section" / "Add a note" Buttons */}
              {invoice.state === 'draft' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                  <button 
                    type="button" 
                    onClick={handleAddLine}
                    className="btn btn-secondary btn-sm"
                    style={{ fontWeight: '700', fontSize: '0.82rem', color: '#714B67' }}
                  >
                    + Add a line
                  </button>
                  <button 
                    type="button" 
                    onClick={handleAddSection}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.8rem' }}
                  >
                    + Add a section
                  </button>
                  <button 
                    type="button" 
                    onClick={handleAddNote}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.8rem' }}
                  >
                    + Add a note
                  </button>
                </div>
              )}

              {/* Odoo Bottom Totals Box & Reconciliation Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <div style={{ width: '380px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', color: '#64748b' }}>
                    <span>Untaxed Amount (कर पूर्व सबटोटल):</span>
                    <span style={{ fontWeight: '700', color: '#1e293b' }}>₹{taxableSubtotal.toFixed(2)}</span>
                  </div>

                  {itemDiscountsTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: '#059669' }}>
                      <span>Item Discounts:</span>
                      <span>- ₹{itemDiscountsTotal.toFixed(2)}</span>
                    </div>
                  )}

                  {invoice.taxMode === 'NONE' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#059669' }}>
                      <span>Taxes:</span>
                      <span>Exempt (0%)</span>
                    </div>
                  ) : invoice.taxMode === 'INTRA' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
                        <span>CGST:</span>
                        <span>₹{cgst.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
                        <span>SGST:</span>
                        <span>₹{sgst.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
                      <span>IGST:</span>
                      <span>₹{igst.toFixed(2)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
                    <span>Rounding (राउंड ऑफ):</span>
                    <span>{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', borderTop: '2px solid #cbd5e1', paddingTop: '8px' }}>
                    <span>Total:</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>

                  {/* Reconciled Payments Listing widget (Odoo Style) */}
                  {(invoice.payments || []).length > 0 && (
                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: '800', color: '#059669' }}>
                        PAID / RECONCILED PAYMENTS:
                      </div>
                      {(invoice.payments || []).map((pay, pIdx) => (
                        <div key={pay.id || pIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569' }}>
                          <span>Paid on {pay.date ? pay.date.split('T')[0] : 'today'} ({pay.journal}):</span>
                          <span style={{ fontWeight: '700', color: '#059669' }}>- ₹{Number(pay.amount || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Residual / Amount Due */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: '900', color: amountDue > 0 ? '#dc2626' : '#059669', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                    <span>Amount Due (बकाया राशि):</span>
                    <span>₹{amountDue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OTHER INFO */}
          {activeNotebookTab === 'other_info' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '12px' }}>Invoice Tracking & Logistics</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label className="form-label">Customer Reference / PO #</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. PO-8849"
                      value={invoice.customerReference || ''}
                      onChange={e => setInvoice({ ...invoice, customerReference: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Salesperson / Field Rep</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={invoice.salesperson || currentOp?.name || 'Admin'}
                      onChange={e => setInvoice({ ...invoice, salesperson: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Pricing Type (Wholesale vs Retail)</label>
                    <select 
                      className="form-control"
                      value={invoice.pricingType}
                      onChange={e => setInvoice({ ...invoice, pricingType: e.target.value })}
                    >
                      <option value="EXCLUSIVE">Wholesale: Rate + GST Extra (Exclusive)</option>
                      <option value="INCLUSIVE">Retail: MRP Inclusive of GST (Inclusive)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '12px' }}>Transport & e-Way Bill</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label className="form-label">Transporter Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. VRL Logistics"
                      value={invoice.ewayBill?.transporterName || ''}
                      onChange={e => setInvoice({ ...invoice, ewayBill: { ...(invoice.ewayBill || {}), transporterName: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Vehicle Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. DL 01 AB 1234"
                      value={invoice.ewayBill?.vehicleNo || ''}
                      onChange={e => setInvoice({ ...invoice, ewayBill: { ...(invoice.ewayBill || {}), vehicleNo: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="form-label">e-Way Bill Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="12-digit e-Way Bill"
                      value={invoice.ewayBill?.ewayBillNo || ''}
                      onChange={e => setInvoice({ ...invoice, ewayBill: { ...(invoice.ewayBill || {}), ewayBillNo: e.target.value } })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JOURNAL ITEMS (ACCOUNTING PREVIEW) */}
          {activeNotebookTab === 'accounting' && (
            <div>
              <div style={{ marginBottom: '10px', fontSize: '0.84rem', color: '#64748b' }}>
                Automated Double-Entry Bookkeeping representation for this invoice:
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '8px 12px' }}>Account</th>
                      <th style={{ padding: '8px 12px' }}>Partner</th>
                      <th style={{ padding: '8px 12px' }}>Label</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Debit (₹)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Line 1: Accounts Receivable */}
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '700', color: '#1e293b' }}>110000 Trade Debtors / Accounts Receivable</td>
                      <td style={{ padding: '8px 12px' }}>{invoice.partyName || 'Customer'}</td>
                      <td style={{ padding: '8px 12px' }}>Invoice #{invoice.invoiceNo}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#2563eb' }}>₹{grandTotal.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹0.00</td>
                    </tr>
                    {/* Line 2: Sales Revenue */}
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '700', color: '#1e293b' }}>400000 Product Sales Revenue</td>
                      <td style={{ padding: '8px 12px' }}>{invoice.partyName || 'Customer'}</td>
                      <td style={{ padding: '8px 12px' }}>Taxable Sales Turnover</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹0.00</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>₹{taxableSubtotal.toFixed(2)}</td>
                    </tr>
                    {/* Line 3 & 4: Output Taxes */}
                    {invoice.taxMode === 'INTRA' ? (
                      <>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: '700', color: '#1e293b' }}>220010 Output CGST Payable</td>
                          <td style={{ padding: '8px 12px' }}>Govt Tax Authority</td>
                          <td style={{ padding: '8px 12px' }}>Central GST Output</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹0.00</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700' }}>₹{cgst.toFixed(2)}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: '700', color: '#1e293b' }}>220020 Output SGST Payable</td>
                          <td style={{ padding: '8px 12px' }}>State Tax Authority</td>
                          <td style={{ padding: '8px 12px' }}>State GST Output</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹0.00</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700' }}>₹{sgst.toFixed(2)}</td>
                        </tr>
                      </>
                    ) : invoice.taxMode === 'INTER' ? (
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: '700', color: '#1e293b' }}>220030 Output IGST Payable</td>
                        <td style={{ padding: '8px 12px' }}>Integrated GST Authority</td>
                        <td style={{ padding: '8px 12px' }}>Integrated GST Output</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹0.00</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700' }}>₹{igst.toFixed(2)}</td>
                      </tr>
                    ) : null}

                    {/* Rounding Line */}
                    {roundOff !== 0 && (
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: '700', color: '#1e293b' }}>599000 Auto Rounding Adjustment</td>
                        <td style={{ padding: '8px 12px' }}>System</td>
                        <td style={{ padding: '8px 12px' }}>Decimal Rounding</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{roundOff < 0 ? `₹${Math.abs(roundOff).toFixed(2)}` : '₹0.00'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{roundOff > 0 ? `₹${roundOff.toFixed(2)}` : '₹0.00'}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: '900', borderTop: '2px solid #cbd5e1' }}>
                      <td colSpan={3} style={{ padding: '8px 12px' }}>Balanced Double-Entry Total:</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#2563eb' }}>₹{grandTotal.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#059669' }}>₹{grandTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: CHATTER & AUDIT LOG */}
          {activeNotebookTab === 'chatter' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Add Note Form */}
              <form onSubmit={handleAddChatterNote} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="Log an internal note or communicate with your team..."
                  value={newChatterNote}
                  onChange={e => setNewChatterNote(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontWeight: '700' }}>
                  Log Note
                </button>
              </form>

              {/* Activity Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(invoice.chatter || []).length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>No activity logged yet.</div>
                ) : (
                  (invoice.chatter || []).map((c, i) => (
                    <div key={c.id || i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#714B67', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>
                        {c.author ? c.author.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{c.author || 'User'}</strong>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {new Date(c.date).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div style={{ marginTop: '2px', color: '#334155' }}>
                          {c.text}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 4. Odoo Register Payment Wizard Modal */}
      {registerPaymentModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={20} color="#059669" />
                <span>Register Payment (भुगतान दर्ज करें)</span>
              </h3>
              <button onClick={() => setRegisterPaymentModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecutePayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Journal (खाता बही) *</label>
                  <select 
                    className="form-control"
                    value={paymentForm.journal}
                    onChange={e => setPaymentForm({ ...paymentForm, journal: e.target.value })}
                  >
                    <option value="BANK">Bank (ICICI/HDFC)</option>
                    <option value="CASH">Cash Drawer</option>
                    <option value="UPI">UPI / MargPay</option>
                    <option value="CHEQUE">Cheque Collection</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Payment Method *</label>
                  <select 
                    className="form-control"
                    value={paymentForm.paymentMethod}
                    onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  >
                    <option value="UPI">Instant UPI QR</option>
                    <option value="MANUAL">Cash in Hand</option>
                    <option value="NEFT">NEFT / RTGS</option>
                    <option value="CHEQUE">Cheque Deposit</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Amount (राशि ₹) *</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="form-control"
                    required
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Payment Date *</label>
                  <input 
                    type="date"
                    className="form-control"
                    required
                    value={paymentForm.paymentDate}
                    onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Memo / Communication</label>
                <input 
                  type="text"
                  className="form-control"
                  value={paymentForm.memo}
                  onChange={e => setPaymentForm({ ...paymentForm, memo: e.target.value })}
                />
              </div>

              {/* Dynamic QR Code in Wizard if UPI is selected */}
              {paymentForm.paymentMethod === 'UPI' && upiQrPreviewUrl && (
                <div style={{ textAlign: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px dashed #059669' }}>
                  <img src={upiQrPreviewUrl} alt="UPI QR" style={{ width: '140px', height: '140px', margin: '0 auto', display: 'block' }} />
                  <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: '800', marginTop: '4px' }}>
                    Scan & Pay ₹{Number(paymentForm.amount || 0).toFixed(2)} via UPI
                  </div>
                </div>
              )}

              {/* Payment Difference Option */}
              {Number(paymentForm.amount) < amountDue && (
                <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '6px', fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: '800', color: '#b45309' }}>Payment Difference:</div>
                  <div style={{ marginTop: '4px', display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="diff" 
                        checked={paymentForm.paymentDifferenceAction === 'keep_open'}
                        onChange={() => setPaymentForm({ ...paymentForm, paymentDifferenceAction: 'keep_open' })}
                      />
                      <span>Keep Open (उधार शेष रखें)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="diff" 
                        checked={paymentForm.paymentDifferenceAction === 'fully_paid'}
                        onChange={() => setPaymentForm({ ...paymentForm, paymentDifferenceAction: 'fully_paid' })}
                      />
                      <span>Mark Fully Paid (Write-off)</span>
                    </label>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button 
                  type="button" 
                  onClick={() => setRegisterPaymentModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ background: '#059669', borderColor: '#059669', fontWeight: '800' }}
                >
                  Create Payment (भुगतान दर्ज करें)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Odoo Credit Note (Refund) Wizard Modal */}
      {creditNoteModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: '22px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCcw size={18} color="#dc2626" />
              <span>Credit Note / Reverse Invoice</span>
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 16px 0' }}>
              This will create a Credit Note reversing Invoice <strong>#{invoice.invoiceNo}</strong>, returning goods to inventory, and crediting the customer's ledger.
            </p>

            <form onSubmit={handleExecuteCreditNote} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">Reason for Credit Note *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required 
                  value={creditNoteReason}
                  onChange={e => setCreditNoteReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setCreditNoteModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" style={{ fontWeight: '800' }}>
                  Reverse & Generate Credit Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
