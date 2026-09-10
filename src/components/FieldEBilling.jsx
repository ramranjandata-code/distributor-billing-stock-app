import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  CheckCircle, 
  Eye, 
  DollarSign, 
  UserCheck, 
  ArrowRight,
  Boxes,
  MapPin,
  FileText,
  BadgeAlert,
  Send,
  Zap,
  Trash2,
  Barcode,
  Truck,
  QrCode,
  UserPlus,
  Percent,
  Tag,
  X,
  Printer,
  Calculator,
  ShieldCheck,
  Building,
  RotateCcw
} from 'lucide-react';
import { 
  saveInvoice, 
  saveParty, 
  updatePartyBalance, 
  formatCartonStock, 
  fetchWarehouses, 
  logAuditAction, 
  getCurrentOperator 
} from '../utils/storage';
import { 
  generateUpiQrDataUrl, 
  buildWhatsAppUrl, 
  buildInvoiceShareText 
} from '../utils/qrUtils';
import { 
  calculateBillTotals, 
  detectSupplyType 
} from '../utils/taxUtils';

export default function FieldEBilling({ products = [], parties = [], business, refreshAllData, handlePrintInvoice }) {
  const [activeSubTab, setActiveSubTab] = useState('ORDER_BOOKING'); // 'ORDER_BOOKING', 'LIVE_STOCK', 'COLLECTION'
  
  // Party / Retailer Selection State
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);

  // Quick Add Retailer Modal
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const initialNewPartyState = {
    name: '',
    contactPerson: '',
    phone: '',
    city: '',
    address: '',
    gstin: '',
    creditLimit: 50000,
    balance: 0
  };
  const [newPartyData, setNewPartyData] = useState(initialNewPartyState);

  // Multi-Warehouse Source
  const warehouses = fetchWarehouses();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(warehouses[0]?.id || 'wh_main');

  // Barcode Scanning State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeScanAlert, setBarcodeScanAlert] = useState(null);
  const barcodeInputRef = useRef(null);

  // Order Cart & Search
  const [searchProduct, setSearchProduct] = useState('');
  const [orderCart, setOrderCart] = useState([]);

  // Pricing & Taxation Configuration
  const [pricingType, setPricingType] = useState('EXCLUSIVE'); // 'EXCLUSIVE' (Wholesale: Rate + GST Extra) or 'INCLUSIVE' (MRP)
  const [taxMode, setTaxMode] = useState('INTRA'); // 'INTRA' (CGST + SGST), 'INTER' (IGST), 'NONE' (0%)
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);

  // Discounts
  const [discountType, setDiscountType] = useState('AMOUNT'); // 'AMOUNT' (₹) or 'PERCENT' (%)
  const [discountValue, setDiscountValue] = useState(0);

  // Payment Status & Terms
  const [paymentStatus, setPaymentStatus] = useState('PAID'); // PAID, UNPAID, PARTIAL
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH'); // CASH, UPI, NEFT, CHEQUE
  const [notes, setNotes] = useState('');

  // Transport & e-Way Bill State
  const [ewayBillOpen, setEwayBillOpen] = useState(false);
  const [ewayBillData, setEwayBillData] = useState({
    transporterName: '',
    vehicleNo: '',
    distanceKm: '',
    ewayBillNo: ''
  });

  // Post-Billing Checkout Modal
  const [orderSuccessModal, setOrderSuccessModal] = useState(null); // { invoice, upiQrUrl }

  // Field Collection State
  const [collectionPartyId, setCollectionPartyId] = useState('');
  const [collectionAmount, setCollectionAmount] = useState('');
  const [collectionMode, setCollectionMode] = useState('CASH'); // CASH, UPI
  const [collectionNote, setCollectionNote] = useState('');

  const currentOp = getCurrentOperator();

  // Selected party object
  const selectedParty = parties.find(p => p.id === selectedPartyId);

  // Auto-detect supply type (Intra vs Inter) based on Seller and Buyer GSTIN state codes
  useEffect(() => {
    if (selectedParty && selectedParty.gstin && business?.gstin) {
      const autoSupply = detectSupplyType(business.gstin, selectedParty.gstin);
      setTaxMode(autoSupply);
    }
  }, [selectedPartyId, business]);

  // Filter parties for quick suggestions
  const filteredPartySuggestions = parties.filter(p => {
    if (!partySearchTerm.trim()) return true;
    const term = partySearchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.phone && p.phone.includes(term)) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(term)) ||
      (p.address && p.address.toLowerCase().includes(term)) ||
      (p.city && p.city.toLowerCase().includes(term)) ||
      (p.gstin && p.gstin.toLowerCase().includes(term))
    );
  });

  const handleSelectParty = (party) => {
    if (party) {
      setSelectedPartyId(party.id);
      setCustomerName(party.name);
      setCustomerPhone(party.phone);
      setPartySearchTerm(party.name);
    } else {
      setSelectedPartyId('');
      setCustomerName('Walk-in / Cash Retailer');
      setCustomerPhone('');
      setPartySearchTerm('');
    }
    setShowPartySuggestions(false);
  };

  const handleSaveNewParty = (e) => {
    e.preventDefault();
    if (!newPartyData.name || !newPartyData.phone) {
      alert('⚠️ कृपया दुकान/रिटेलर का नाम और फ़ोन नंबर दर्ज करें!');
      return;
    }

    const payload = {
      ...newPartyData,
      creditLimit: Number(newPartyData.creditLimit) || 0,
      balance: Number(newPartyData.balance) || 0
    };

    const savedParty = saveParty(payload);
    if (refreshAllData) refreshAllData();

    if (savedParty && savedParty.id) {
      handleSelectParty(savedParty);
    }

    setPartyModalOpen(false);
    setNewPartyData(initialNewPartyState);
  };

  // Filter products for catalog
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchProduct.toLowerCase())) ||
    (p.sku && p.sku.toLowerCase().includes(searchProduct.toLowerCase()))
  );

  // Barcode Scanner Handler
  const handleBarcodeScan = (e) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const matchedProduct = products.find(p => 
      (p.sku && p.sku.toLowerCase() === code.toLowerCase()) ||
      (p.id && p.id.toLowerCase() === code.toLowerCase()) ||
      (p.name && p.name.toLowerCase() === code.toLowerCase())
    );

    if (matchedProduct) {
      handleAddToCart(matchedProduct);
      setBarcodeScanAlert(`✅ Added: ${matchedProduct.name}`);
      setTimeout(() => setBarcodeScanAlert(null), 2000);
      setBarcodeInput('');
    } else {
      setBarcodeScanAlert(`❌ Item not found for code: "${code}"`);
      setTimeout(() => setBarcodeScanAlert(null), 2500);
    }
  };

  // Add Item to Field Order Cart
  const handleAddToCart = (product) => {
    if (product.currentStock <= 0) {
      alert(`⚠️ '${product.name}' is out of stock!`);
      return;
    }

    const pcsPerCtn = Number(product.pcsPerCarton) || 24;
    const existingIndex = orderCart.findIndex(item => item.productId === product.id);

    if (existingIndex > -1) {
      const existing = orderCart[existingIndex];
      const newQty = existing.qty + 1;
      if (newQty > product.currentStock) {
        alert(`Stock limit reached (${formatCartonStock(product.currentStock, pcsPerCtn)})`);
        return;
      }
      const updated = [...orderCart];
      updated[existingIndex].qty = newQty;
      updated[existingIndex].cartonQty = Math.floor(newQty / pcsPerCtn);
      updated[existingIndex].looseQty = newQty % pcsPerCtn;
      setOrderCart(updated);
    } else {
      const rate = Number(product.salePrice || product.mrp);
      setOrderCart([
        ...orderCart,
        {
          productId: product.id,
          name: product.name,
          brand: product.brand,
          sku: product.sku,
          hsn: product.hsn,
          price: rate,
          mrp: Number(product.mrp) || rate,
          qty: 1,
          pcsPerCarton: pcsPerCtn,
          cartonQty: 0,
          looseQty: 1,
          unit: product.unit || 'Pcs',
          gstRate: product.gstRate || 0,
          maxStock: product.currentStock,
          itemDiscountType: 'AMOUNT',
          itemDiscountVal: 0
        }
      ]);
    }
  };

  // Quantity and Unit modifications
  const handleUpdateQty = (index, delta) => {
    const updated = [...orderCart];
    const item = updated[index];
    const pcsPerCtn = Number(item.pcsPerCarton) || 24;
    const newQty = item.qty + delta;

    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    if (newQty > item.maxStock) {
      alert(`⚠️ Available stock is ${formatCartonStock(item.maxStock, pcsPerCtn)} (${item.maxStock} Pcs)!`);
      return;
    }

    item.qty = newQty;
    item.cartonQty = Math.floor(newQty / pcsPerCtn);
    item.looseQty = newQty % pcsPerCtn;
    setOrderCart(updated);
  };

  const handleCartonQtyChange = (index, cartonVal) => {
    const updated = [...orderCart];
    const item = updated[index];
    const ctn = Math.max(0, parseInt(cartonVal) || 0);
    const pcsPerCtn = Number(item.pcsPerCarton) || 24;
    const loose = Number(item.looseQty) || 0;
    const newTotal = (ctn * pcsPerCtn) + loose;

    if (newTotal > item.maxStock) {
      alert(`⚠️ Available stock is ${formatCartonStock(item.maxStock, pcsPerCtn)} (${item.maxStock} Pcs)!`);
      return;
    }

    item.cartonQty = ctn;
    item.qty = newTotal;
    setOrderCart(updated);
  };

  const handleLooseQtyChange = (index, looseVal) => {
    const updated = [...orderCart];
    const item = updated[index];
    const loose = Math.max(0, parseInt(looseVal) || 0);
    const pcsPerCtn = Number(item.pcsPerCarton) || 24;
    const ctn = Number(item.cartonQty) || 0;
    const newTotal = (ctn * pcsPerCtn) + loose;

    if (newTotal > item.maxStock) {
      alert(`⚠️ Available stock is ${formatCartonStock(item.maxStock, pcsPerCtn)} (${item.maxStock} Pcs)!`);
      return;
    }

    item.looseQty = loose;
    item.qty = newTotal;
    setOrderCart(updated);
  };

  const handleItemPriceChange = (index, newPrice) => {
    const updated = [...orderCart];
    updated[index].price = Number(newPrice) || 0;
    setOrderCart(updated);
  };

  const handleItemDiscountChange = (index, newDiscountVal) => {
    const updated = [...orderCart];
    updated[index].itemDiscountVal = Number(newDiscountVal) || 0;
    setOrderCart(updated);
  };

  const handleToggleItemDiscountType = (index) => {
    const updated = [...orderCart];
    updated[index].itemDiscountType = updated[index].itemDiscountType === 'AMOUNT' ? 'PERCENT' : 'AMOUNT';
    setOrderCart(updated);
  };

  const handleRemoveItem = (index) => {
    setOrderCart(orderCart.filter((_, i) => i !== index));
  };

  // Centralized GST & Billing Math Engine
  const billCalc = calculateBillTotals({
    cartItems: orderCart,
    taxType: pricingType, // 'EXCLUSIVE' (Wholesale: Rate + GST Extra) or 'INCLUSIVE' (MRP)
    supplyType: taxMode === 'NONE' ? 'EXEMPT' : taxMode,
    overallDiscountVal: discountValue,
    overallDiscountType: discountType,
    roundOffEnabled: roundOffEnabled
  });

  const processedCartItems = billCalc.processedItems;
  const grossSubTotal = billCalc.grossSubtotal;
  const itemDiscountsTotal = billCalc.itemDiscountsTotal;
  const overallDiscountAmt = billCalc.billDiscountAmount;
  const taxableSubtotal = billCalc.taxableSubtotal;
  const taxTotal = billCalc.taxTotal;
  const cgst = billCalc.cgst;
  const sgst = billCalc.sgst;
  const igst = billCalc.igst;
  const roundOff = billCalc.roundOff;
  const grandTotal = billCalc.grandTotal;

  // Submit Field Order / GST Bill
  const handleSubmitOrder = () => {
    if (orderCart.length === 0) {
      alert('Cart is empty. Add at least one product!');
      return;
    }

    const partyNameFinal = selectedParty ? selectedParty.name : (customerName || 'Walk-in Retailer');
    const partyPhoneFinal = selectedParty ? selectedParty.phone : customerPhone;
    const partyGstinFinal = selectedParty ? selectedParty.gstin : 'URP';
    const partyAddressFinal = selectedParty ? (selectedParty.address || selectedParty.city || '') : '';

    let actualPaid = grandTotal;
    let balanceAmt = 0;

    if (paymentStatus === 'UNPAID') {
      actualPaid = 0;
      balanceAmt = grandTotal;
    } else if (paymentStatus === 'PARTIAL') {
      actualPaid = Number(paidAmount) || 0;
      balanceAmt = Math.max(0, grandTotal - actualPaid);
    }

    const invoiceData = {
      partyId: selectedPartyId || null,
      partyName: partyNameFinal,
      customerName: partyNameFinal,
      partyPhone: partyPhoneFinal,
      customerPhone: partyPhoneFinal,
      partyAddress: partyAddressFinal,
      partyGstin: partyGstinFinal,
      items: processedCartItems,
      pricingType,
      taxMode,
      supplyType: taxMode === 'NONE' ? 'EXEMPT' : taxMode,
      subTotal: grossSubTotal,
      subtotal: grossSubTotal,
      taxableAmount: taxableSubtotal,
      taxableSubtotal: taxableSubtotal,
      taxTotal,
      cgst,
      sgst,
      igst,
      discount: billCalc.totalDiscounts,
      discountAmount: billCalc.totalDiscounts,
      roundOff,
      grandTotal,
      paymentStatus,
      paidAmount: actualPaid,
      balanceAmount: balanceAmt,
      paymentMode,
      warehouseId: selectedWarehouseId,
      ewayBill: ewayBillOpen ? ewayBillData : null,
      operator: currentOp?.name || 'Field Representative',
      notes: notes || `Booked on-the-go via eBilling Mobile App by ${currentOp?.name || 'Field Agent'}`
    };

    const newInvoice = saveInvoice(invoiceData);
    logAuditAction('FIELD_ORDER_BOOKED', 'Field eBilling', `Field invoice #${newInvoice.invoiceNo} booked for ${partyNameFinal} (₹${grandTotal.toLocaleString('en-IN')})`);
    
    if (refreshAllData) refreshAllData();

    // Generate dynamic UPI QR Code for instant scan-and-pay
    generateUpiQrDataUrl(business?.upiId, business?.name, grandTotal, newInvoice.invoiceNo).then(qrUrl => {
      setOrderSuccessModal({
        invoice: newInvoice,
        upiQrUrl: qrUrl
      });
    });

    // Reset bill state
    setOrderCart([]);
    setSelectedPartyId('');
    setCustomerName('');
    setCustomerPhone('');
    setPartySearchTerm('');
    setDiscountValue(0);
    setPaymentStatus('PAID');
    setPaidAmount('');
    setNotes('');
    setEwayBillOpen(false);
  };

  // Submit Field Payment Collection
  const handleSubmitCollection = (e) => {
    e.preventDefault();
    const amt = Number(collectionAmount);
    if (!collectionPartyId || amt <= 0) {
      alert('Please select a party and enter a valid collection amount.');
      return;
    }

    const targetParty = parties.find(p => p.id === collectionPartyId);
    updatePartyBalance(collectionPartyId, -amt);

    logAuditAction(
      'FIELD_COLLECTION',
      'Field eBilling',
      `Field collection of ₹${amt.toLocaleString('en-IN')} received in ${collectionMode} from ${targetParty?.name} by ${currentOp?.name || 'Sales Agent'}`
    );

    if (refreshAllData) refreshAllData();

    alert(`✅ Recorded field collection of ₹${amt.toLocaleString('en-IN')} from ${targetParty?.name}! Ledger updated.`);
    setCollectionPartyId('');
    setCollectionAmount('');
    setCollectionNote('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Mobile Top Bar */}
      <div style={{ 
        background: 'linear-gradient(135deg, #059669, #047857)', 
        borderRadius: '16px', 
        padding: '18px 20px', 
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '44px', 
            height: '44px', 
            borderRadius: '12px', 
            background: 'rgba(255, 255, 255, 0.2)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Smartphone size={24} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>eBilling Mobile Sales Suite</h2>
            <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: '2px 0 0 0' }}>
              Salesman: <strong>{currentOp?.name || 'Field Agent'}</strong> • Live Stock & Remote Booking
            </p>
          </div>
        </div>

        {/* Sub-tab switcher */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '4px' }}>
          <button 
            onClick={() => setActiveSubTab('ORDER_BOOKING')}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: '8px',
              background: activeSubTab === 'ORDER_BOOKING' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'ORDER_BOOKING' ? '#047857' : '#ffffff',
              fontWeight: '700',
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Order Booking
          </button>
          <button 
            onClick={() => setActiveSubTab('LIVE_STOCK')}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: '8px',
              background: activeSubTab === 'LIVE_STOCK' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'LIVE_STOCK' ? '#047857' : '#ffffff',
              fontWeight: '700',
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Live Stock & Rates
          </button>
          <button 
            onClick={() => setActiveSubTab('COLLECTION')}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: '8px',
              background: activeSubTab === 'COLLECTION' ? '#ffffff' : 'transparent',
              color: activeSubTab === 'COLLECTION' ? '#047857' : '#ffffff',
              fontWeight: '700',
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Payment Collection
          </button>
        </div>
      </div>

      {/* VIEW 1: ORDER BOOKING & FULL GST INVOICING */}
      {activeSubTab === 'ORDER_BOOKING' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(420px, 1.35fr)', gap: '16px' }}>
          
          {/* LEFT COLUMN: Retailer, Barcode & Product Catalog */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* 1. Retailer Selection Card */}
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', margin: 0 }}>
                  <UserCheck size={16} color="#059669" />
                  <span>दुकानदार / रिटेलर (Retailer Shop) *</span>
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    type="button"
                    onClick={() => handleSelectParty(null)}
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    नकद / Walk-in
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPartyModalOpen(true)}
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: '0.72rem', padding: '3px 8px', gap: '3px' }}
                  >
                    <UserPlus size={12} />
                    <span>+ New Retailer</span>
                  </button>
                </div>
              </div>

              {/* Live search input for party */}
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  className="form-control"
                  placeholder="दुकानदार का नाम, फ़ोन या GSTIN खोजें..."
                  value={partySearchTerm}
                  onFocus={() => setShowPartySuggestions(true)}
                  onChange={e => {
                    setPartySearchTerm(e.target.value);
                    setShowPartySuggestions(true);
                  }}
                  style={{ paddingLeft: '32px', fontSize: '0.88rem' }}
                />

                {showPartySuggestions && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 50,
                    marginTop: '4px'
                  }}>
                    {filteredPartySuggestions.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        कोई व्यापारी नहीं मिला
                      </div>
                    ) : (
                      filteredPartySuggestions.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => handleSelectParty(p)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.84rem'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{p.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {p.phone} • {p.city || 'Local'} {p.gstin ? `• GST: ${p.gstin}` : ''}
                            </div>
                          </div>
                          {Number(p.balance) > 0 ? (
                            <span style={{ fontSize: '0.76rem', color: '#dc2626', fontWeight: '800' }}>
                              Due: ₹{Number(p.balance).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: '700' }}>
                              No Due
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Party Info & Khata Status */}
              {selectedParty ? (
                <div style={{ marginTop: '10px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{selectedParty.name}</strong>
                    <button 
                      onClick={() => handleSelectParty(null)}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '2px' }}>
                    📞 {selectedParty.phone || 'N/A'} • 📍 {selectedParty.address || selectedParty.city || 'Local'}
                  </div>
                  {selectedParty.gstin && (
                    <div style={{ color: '#2563eb', fontSize: '0.74rem', fontWeight: '700', marginTop: '2px' }}>
                      GSTIN: {selectedParty.gstin}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
                    <span style={{ color: Number(selectedParty.balance) > 0 ? '#dc2626' : '#059669', fontWeight: '700' }}>
                      खाता बकाया (Balance): ₹{Number(selectedParty.balance || 0).toLocaleString('en-IN')}
                    </span>
                    {Number(selectedParty.creditLimit) > 0 && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        लिमिट: ₹{Number(selectedParty.creditLimit).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  {Number(selectedParty.balance) > Number(selectedParty.creditLimit) && Number(selectedParty.creditLimit) > 0 && (
                    <div style={{ marginTop: '4px', color: '#b45309', background: '#fef3c7', padding: '3px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BadgeAlert size={12} />
                      <span>उधार लिमिट पार हो चुकी है! सतर्क रहें।</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: '6px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  काउंटर नकद ग्राहक (Walk-in Cash Sale)
                </div>
              )}
            </div>

            {/* 2. Multi-Warehouse & Barcode Scanner Card */}
            <div className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '700' }}>
                  <Building size={16} color="var(--primary)" />
                  <span>वेयरहाउस (Source Stock):</span>
                </div>
                <select 
                  className="form-control"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                  value={selectedWarehouseId}
                  onChange={e => setSelectedWarehouseId(e.target.value)}
                >
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>{wh.name} ({wh.city})</option>
                  ))}
                </select>
              </div>

              {/* Barcode Quick Scan Input */}
              <form onSubmit={handleBarcodeScan} style={{ position: 'relative' }}>
                <Barcode size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
                <input 
                  ref={barcodeInputRef}
                  type="text"
                  className="form-control"
                  placeholder="बारकोड स्कैन करें या SKU दर्ज करें [Enter]..."
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  style={{ paddingLeft: '34px', fontSize: '0.86rem', fontWeight: '600' }}
                />
              </form>

              {barcodeScanAlert && (
                <div style={{ 
                  padding: '4px 8px', 
                  borderRadius: '6px', 
                  fontSize: '0.76rem', 
                  fontWeight: '700',
                  background: barcodeScanAlert.startsWith('✅') ? '#ecfdf5' : '#fef2f2',
                  color: barcodeScanAlert.startsWith('✅') ? '#059669' : '#dc2626'
                }}>
                  {barcodeScanAlert}
                </div>
              )}
            </div>

            {/* 3. Product Catalog & Search Card */}
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  प्रोडक्ट कैटलॉग (Products)
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {filteredProducts.length} उपलब्ध
                </span>
              </div>

              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  className="form-control"
                  placeholder="आइटम का नाम, ब्रांड, SKU खोजें..."
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    कोई प्रोडक्ट नहीं मिला
                  </div>
                ) : (
                  filteredProducts.map(p => {
                    const inCartItem = orderCart.find(c => c.productId === p.id);
                    return (
                      <div 
                        key={p.id}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: p.currentStock <= 0 ? '#fef2f2' : inCartItem ? '#ecfdf5' : '#ffffff',
                          opacity: p.currentStock <= 0 ? 0.65 : 1
                        }}
                      >
                        <div style={{ maxWidth: '65%' }}>
                          <div style={{ fontWeight: '700', fontSize: '0.84rem', color: 'var(--text-main)' }}>{p.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            दर: <strong>₹{Number(p.salePrice || p.mrp).toLocaleString('en-IN')}</strong> • GST: {p.gstRate}% • स्टॉक: {formatCartonStock(p.currentStock, p.pcsPerCarton)}
                          </div>
                        </div>

                        <button 
                          onClick={() => handleAddToCart(p)}
                          disabled={p.currentStock <= 0}
                          className="btn btn-sm btn-primary"
                          style={{ padding: '5px 10px', fontSize: '0.78rem', fontWeight: '700', gap: '3px' }}
                        >
                          <Plus size={13} />
                          <span>{inCartItem ? `Add (${inCartItem.qty})` : 'Add'}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Field Cart, GST Math Engine & Checkout */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={18} color="#059669" />
                <span>ई-बिलिंग कार्ट ({orderCart.length} Items)</span>
              </h3>
              {orderCart.length > 0 && (
                <button 
                  onClick={() => setOrderCart([])}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700' }}
                >
                  Clear Cart
                </button>
              )}
            </div>

            {orderCart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 12px', color: 'var(--text-muted)' }}>
                <ShoppingCart size={36} style={{ margin: '0 auto 8px auto', opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700' }}>कार्ट अभी खाली है</p>
                <p style={{ fontSize: '0.76rem', marginTop: '4px' }}>कैटलॉग से प्रोडक्ट चुनें या बारकोड स्कैन करें।</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                {/* Cart Items List */}
                <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {orderCart.map((item, index) => {
                    const pcsPerCtn = Number(item.pcsPerCarton) || 24;
                    const ctnVal = item.cartonQty !== undefined ? item.cartonQty : Math.floor(item.qty / pcsPerCtn);
                    const looseVal = item.looseQty !== undefined ? item.looseQty : item.qty % pcsPerCtn;
                    const lineCalc = processedCartItems[index] || item;

                    return (
                      <div 
                        key={item.productId}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        {/* Item Name & Delete */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)' }}>{item.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Pack: {pcsPerCtn} Pcs/Ctn • GST: {item.gstRate}%
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRemoveItem(index)}
                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Dual-Unit Carton + Loose Inputs & Price & Discount */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          
                          {/* Carton & Loose */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <input 
                                type="number"
                                min="0"
                                placeholder="0"
                                title="Cartons"
                                style={{ width: '48px', padding: '3px 4px', textAlign: 'center', fontSize: '0.82rem', fontWeight: '800' }}
                                className="input-field"
                                value={ctnVal}
                                onChange={e => handleCartonQtyChange(index, e.target.value)}
                              />
                              <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: '800' }}>Ctn</span>
                            </div>

                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>+</span>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <input 
                                type="number"
                                min="0"
                                placeholder="0"
                                title="Loose Pcs"
                                style={{ width: '48px', padding: '3px 4px', textAlign: 'center', fontSize: '0.82rem', fontWeight: '800' }}
                                className="input-field"
                                value={looseVal}
                                onChange={e => handleLooseQtyChange(index, e.target.value)}
                              />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>Pcs</span>
                            </div>

                            {/* Stepper buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: '4px', border: '1px solid var(--border-color)', marginLeft: '4px' }}>
                              <button 
                                onClick={() => handleUpdateQty(index, -1)}
                                style={{ padding: '2px 5px', border: 'none', background: 'none', cursor: 'pointer' }}
                              >
                                <Minus size={10} />
                              </button>
                              <span style={{ fontSize: '0.76rem', fontWeight: '800', minWidth: '18px', textAlign: 'center' }}>
                                {item.qty}
                              </span>
                              <button 
                                onClick={() => handleUpdateQty(index, 1)}
                                style={{ padding: '2px 5px', border: 'none', background: 'none', cursor: 'pointer' }}
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>

                          {/* Editable Price */}
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>दर: ₹</span>
                            <input 
                              type="number"
                              step="0.01"
                              style={{ width: '64px', padding: '3px 4px', textAlign: 'right', fontSize: '0.82rem', fontWeight: '700' }}
                              className="input-field"
                              value={item.price}
                              onChange={e => handleItemPriceChange(index, e.target.value)}
                            />
                          </div>

                          {/* Item Discount Toggle */}
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <input 
                              type="number"
                              step="0.01"
                              placeholder="Disc"
                              style={{ width: '50px', padding: '3px 4px', textAlign: 'right', fontSize: '0.8rem', fontWeight: '700' }}
                              className="input-field"
                              value={item.itemDiscountVal || ''}
                              onChange={e => handleItemDiscountChange(index, e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => handleToggleItemDiscountType(index)}
                              style={{
                                padding: '2px 5px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                background: item.itemDiscountType === 'PERCENT' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: item.itemDiscountType === 'PERCENT' ? '#4f46e5' : '#059669',
                                cursor: 'pointer'
                              }}
                            >
                              {item.itemDiscountType === 'PERCENT' ? '%' : '₹'}
                            </button>
                          </div>

                          {/* Line Total */}
                          <div style={{ fontWeight: '800', fontSize: '0.86rem', color: 'var(--text-main)', textAlign: 'right', minWidth: '65px' }}>
                            ₹{Number(lineCalc.total || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Calculation Summary Footer & GST Controls */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* Pricing Mode & Supply Region Controls */}
                  <div style={{ background: '#f1f5f9', padding: '8px 10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        मूल्य निर्धारण (Pricing):
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setPricingType('EXCLUSIVE')}
                          style={{
                            padding: '3px 7px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: pricingType === 'EXCLUSIVE' ? '#059669' : '#fff',
                            color: pricingType === 'EXCLUSIVE' ? '#fff' : 'var(--text-main)',
                            cursor: 'pointer'
                          }}
                        >
                          थोक (Rate + GST Extra)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPricingType('INCLUSIVE')}
                          style={{
                            padding: '3px 7px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: pricingType === 'INCLUSIVE' ? '#059669' : '#fff',
                            color: pricingType === 'INCLUSIVE' ? '#fff' : 'var(--text-main)',
                            cursor: 'pointer'
                          }}
                        >
                          MRP / कर सहित
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        टैक्स क्षेत्र (Supply Region):
                        {selectedParty?.gstin && (
                          <span style={{ fontSize: '0.64rem', color: '#059669', background: '#d1fae5', padding: '1px 4px', borderRadius: '4px' }}>
                            Auto GSTIN
                          </span>
                        )}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setTaxMode('INTRA')}
                          style={{
                            padding: '3px 7px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: taxMode === 'INTRA' ? '#2563eb' : '#fff',
                            color: taxMode === 'INTRA' ? '#fff' : 'var(--text-main)',
                            cursor: 'pointer'
                          }}
                        >
                          Intra (CGST+SGST)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaxMode('INTER')}
                          style={{
                            padding: '3px 7px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: taxMode === 'INTER' ? '#7c3aed' : '#fff',
                            color: taxMode === 'INTER' ? '#fff' : 'var(--text-main)',
                            cursor: 'pointer'
                          }}
                        >
                          Inter (IGST)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaxMode('NONE')}
                          style={{
                            padding: '3px 7px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: taxMode === 'NONE' ? '#475569' : '#fff',
                            color: taxMode === 'NONE' ? '#fff' : 'var(--text-main)',
                            cursor: 'pointer'
                          }}
                        >
                          Non-GST (0%)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Math Breakdown Lines */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.82rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span>सकल सब-टोटल (Gross Subtotal):</span>
                      <span>₹{grossSubTotal.toFixed(2)}</span>
                    </div>

                    {itemDiscountsTotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                        <span>आइटम छूट (Item Discounts):</span>
                        <span>- ₹{itemDiscountsTotal.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Overall Bill Discount */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>कुल बिल छूट (Overall Bill Discount):</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <input 
                          type="number"
                          step="0.01"
                          style={{ width: '65px', padding: '2px 5px', textAlign: 'right' }}
                          className="input-field"
                          placeholder="0"
                          value={discountValue}
                          onChange={e => setDiscountValue(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setDiscountType(discountType === 'PERCENT' ? 'AMOUNT' : 'PERCENT')}
                          style={{
                            padding: '3px 6px',
                            fontSize: '0.74rem',
                            fontWeight: '800',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: discountType === 'PERCENT' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: discountType === 'PERCENT' ? '#4f46e5' : '#059669',
                            cursor: 'pointer'
                          }}
                        >
                          {discountType === 'PERCENT' ? '%' : '₹'}
                        </button>
                      </div>
                    </div>

                    {/* Taxable Amount */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontWeight: '600' }}>
                      <span>कर योग्य मूल्य (Taxable Amount):</span>
                      <span>₹{taxableSubtotal.toFixed(2)}</span>
                    </div>

                    {/* GST Breakdown */}
                    {taxMode === 'NONE' ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: '700' }}>
                        <span>GST टैक्स:</span>
                        <span>Non-GST Bill (0%)</span>
                      </div>
                    ) : taxMode === 'INTRA' ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          <span>CGST {pricingType === 'EXCLUSIVE' ? '(दर पर अतिरिक्त)' : '(दर में शामिल)'}:</span>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{cgst.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          <span>SGST {pricingType === 'EXCLUSIVE' ? '(दर पर अतिरिक्त)' : '(दर में शामिल)'}:</span>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{sgst.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        <span>IGST {pricingType === 'EXCLUSIVE' ? '(दर पर अतिरिक्त)' : '(दर में शामिल)'}:</span>
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{igst.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Round Off */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={roundOffEnabled} 
                          onChange={e => setRoundOffEnabled(e.target.checked)} 
                        />
                        <span>राउंड ऑफ (Auto Round Off):</span>
                      </label>
                      <span>{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
                    </div>
                  </div>

                  {/* Grand Total Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>
                      कुल देय राशि (Grand Total):
                    </span>
                    <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#059669' }}>
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* e-Way Bill & Transport Collapsible Toggle */}
                  <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                    <button 
                      type="button"
                      onClick={() => setEwayBillOpen(!ewayBillOpen)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                    >
                      <Truck size={14} />
                      <span>{ewayBillOpen ? '▼ Hide Transport & e-Way Bill Details' : '▶ Add Transport & e-Way Bill Details (गाड़ी व ट्रांसपोर्ट)'}</span>
                    </button>

                    {ewayBillOpen && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
                        <input 
                          type="text"
                          placeholder="Transporter Name"
                          className="form-control"
                          style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                          value={ewayBillData.transporterName}
                          onChange={e => setEwayBillData({ ...ewayBillData, transporterName: e.target.value })}
                        />
                        <input 
                          type="text"
                          placeholder="Vehicle No (e.g. DL 01 AB 1234)"
                          className="form-control"
                          style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                          value={ewayBillData.vehicleNo}
                          onChange={e => setEwayBillData({ ...ewayBillData, vehicleNo: e.target.value })}
                        />
                        <input 
                          type="number"
                          placeholder="Distance (KM)"
                          className="form-control"
                          style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                          value={ewayBillData.distanceKm}
                          onChange={e => setEwayBillData({ ...ewayBillData, distanceKm: e.target.value })}
                        />
                        <input 
                          type="text"
                          placeholder="e-Way Bill Number"
                          className="form-control"
                          style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                          value={ewayBillData.ewayBillNo}
                          onChange={e => setEwayBillData({ ...ewayBillData, ewayBillNo: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Payment Status Switcher */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    <button 
                      type="button"
                      onClick={() => setPaymentStatus('PAID')}
                      style={{
                        padding: '6px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        background: paymentStatus === 'PAID' ? '#059669' : '#fff',
                        color: paymentStatus === 'PAID' ? '#fff' : 'var(--text-main)',
                        fontWeight: '700',
                        fontSize: '0.76rem',
                        cursor: 'pointer'
                      }}
                    >
                      नकद / चुकता (PAID)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPaymentStatus('UNPAID')}
                      style={{
                        padding: '6px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        background: paymentStatus === 'UNPAID' ? '#dc2626' : '#fff',
                        color: paymentStatus === 'UNPAID' ? '#fff' : 'var(--text-main)',
                        fontWeight: '700',
                        fontSize: '0.76rem',
                        cursor: 'pointer'
                      }}
                    >
                      उधार (CREDIT)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPaymentStatus('PARTIAL')}
                      style={{
                        padding: '6px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        background: paymentStatus === 'PARTIAL' ? '#d97706' : '#fff',
                        color: paymentStatus === 'PARTIAL' ? '#fff' : 'var(--text-main)',
                        fontWeight: '700',
                        fontSize: '0.76rem',
                        cursor: 'pointer'
                      }}
                    >
                      आंशिक (PARTIAL)
                    </button>
                  </div>

                  {/* Partial Paid Amount Input */}
                  {paymentStatus === 'PARTIAL' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="number"
                        placeholder="जमा राशि (Paid ₹)"
                        className="form-control"
                        value={paidAmount}
                        onChange={e => setPaidAmount(e.target.value)}
                        style={{ fontSize: '0.82rem' }}
                      />
                      <span style={{ fontSize: '0.76rem', color: '#dc2626', fontWeight: '700' }}>
                        बकाया: ₹{Math.max(0, grandTotal - (Number(paidAmount) || 0)).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Payment Mode Selector */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>
                    {['CASH', 'UPI', 'NEFT', 'CHEQUE'].map(mode => (
                      <button 
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        style={{
                          padding: '5px 2px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          background: paymentMode === mode ? '#2563eb' : '#ffffff',
                          color: paymentMode === mode ? '#ffffff' : 'var(--text-main)',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {/* Remarks / Memo Input */}
                  <input 
                    type="text"
                    placeholder="रिमार्क्स / नोट (e.g. Order Delivery Memo)"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '5px 8px' }}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />

                  {/* Submit Order & Bill Button */}
                  <button 
                    onClick={handleSubmitOrder}
                    className="btn btn-primary"
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      fontSize: '0.96rem', 
                      fontWeight: '800', 
                      gap: '8px', 
                      marginTop: '4px',
                      background: 'linear-gradient(135deg, #059669, #047857)',
                      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
                    }}
                  >
                    <CheckCircle size={18} />
                    <span>ऑर्डर व GST ई-बिल जारी करें (Book & Generate Bill)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: LIVE STOCK VISIBILITY & PRICE INQUIRY */}
      {activeSubTab === 'LIVE_STOCK' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Boxes size={20} color="var(--primary)" />
                <span>Real-Time Warehouse Stock & Price Inquiry</span>
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Accurate inventory figures synchronized with main distributor database
              </p>
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                className="form-control"
                placeholder="Search product..."
                value={searchProduct}
                onChange={e => setSearchProduct(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Product & Brand</th>
                  <th style={{ padding: '10px' }}>Batch / Expiry</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Wholesale Rate</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>MRP</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Available Stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{p.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.brand || 'General'} • SKU: {p.sku || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{p.batchNo || 'LOT-DEFAULT'}</span>
                      {p.expiryDate && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Exp: {p.expiryDate}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                      ₹{Number(p.salePrice || p.mrp).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      ₹{Number(p.mrp || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <span className={`badge ${p.currentStock > (p.minStockLimit || 10) ? 'badge-success' : p.currentStock > 0 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.76rem' }}>
                        {formatCartonStock(p.currentStock, p.pcsPerCarton)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: PAYMENT COLLECTION ENTRY */}
      {activeSubTab === 'COLLECTION' && (
        <div className="card" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={22} color="#059669" />
            <span>On-Field Payment Collection Receipt</span>
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
            Instantly record market collections from retailers and settle outstanding balance on the spot.
          </p>

          <form onSubmit={handleSubmitCollection} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Select Retailer Shop *</label>
              <select 
                className="form-control"
                value={collectionPartyId}
                onChange={e => setCollectionPartyId(e.target.value)}
                required
              >
                <option value="">-- Choose Retailer --</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Outstanding Due: ₹{Number(p.balance || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Amount Collected (₹) *</label>
                <input 
                  type="number"
                  className="form-control"
                  placeholder="e.g. 5000"
                  value={collectionAmount}
                  onChange={e => setCollectionAmount(e.target.value)}
                  required
                  min="1"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
                <select 
                  className="form-control"
                  value={collectionMode}
                  onChange={e => setCollectionMode(e.target.value)}
                >
                  <option value="CASH">Cash in Hand</option>
                  <option value="UPI">UPI / QR Scan</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Remarks / Note</label>
              <input 
                type="text"
                className="form-control"
                placeholder="e.g. Cleared bill SGA/1002"
                value={collectionNote}
                onChange={e => setCollectionNote(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '12px', fontWeight: '800', fontSize: '0.95rem', marginTop: '10px' }}
            >
              Record Collection & Settle Ledger
            </button>
          </form>
        </div>
      )}

      {/* QUICK ADD RETAILER MODAL */}
      {partyModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} color="#059669" />
                <span>+ नया व्यापारी / दुकानदार जोड़ें</span>
              </h3>
              <button onClick={() => setPartyModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNewParty} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>दुकान / पार्टी का नाम *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required 
                  placeholder="e.g. Sharma Kirana Store"
                  value={newPartyData.name}
                  onChange={e => setNewPartyData({ ...newPartyData, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>संपर्क व्यक्ति (Owner)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Ramesh Sharma"
                    value={newPartyData.contactPerson}
                    onChange={e => setNewPartyData({ ...newPartyData, contactPerson: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>मोबाइल नंबर *</label>
                  <input 
                    type="tel" 
                    className="form-control" 
                    required 
                    placeholder="e.g. 9876543210"
                    value={newPartyData.phone}
                    onChange={e => setNewPartyData({ ...newPartyData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>शहर / कस्बा (City)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Chandni Chowk"
                    value={newPartyData.city}
                    onChange={e => setNewPartyData({ ...newPartyData, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>GSTIN नंबर (वैकल्पिक)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="15-digit GSTIN"
                    value={newPartyData.gstin}
                    onChange={e => setNewPartyData({ ...newPartyData, gstin: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>पूरा पता (Address)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="दुकान नंबर, सड़क, लैंडमार्क..."
                  value={newPartyData.address}
                  onChange={e => setNewPartyData({ ...newPartyData, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>उधार लिमिट (Credit Limit ₹)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={newPartyData.creditLimit}
                    onChange={e => setNewPartyData({ ...newPartyData, creditLimit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>प्रारंभिक बकाया (Balance ₹)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={newPartyData.balance}
                    onChange={e => setNewPartyData({ ...newPartyData, balance: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setPartyModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  रद्द करें
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', fontWeight: '700' }}
                >
                  व्यापारी सहेजें (Save Retailer)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POST-BILLING CHECKOUT & DYNAMIC UPI QR MODAL */}
      {orderSuccessModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: '22px', textAlign: 'center' }}>
            
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px auto' }}>
              <CheckCircle size={32} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>ई-बिल सफलतापूर्वक जारी हुआ!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
              Invoice <strong>#{orderSuccessModal.invoice.invoiceNo}</strong> • स्टॉक तुरंत अपडेट हुआ
            </p>

            {/* Bill Summary Strip */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', margin: '14px 0', textAlign: 'left', fontSize: '0.84rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>व्यापारी:</strong></span>
                <span>{orderSuccessModal.invoice.customerName || orderSuccessModal.invoice.partyName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span><strong>बिल राशि (Grand Total):</strong></span>
                <span style={{ fontWeight: '800', color: '#059669', fontSize: '1.05rem' }}>
                  ₹{Number(orderSuccessModal.invoice.grandTotal).toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span><strong>भुगतान स्थिति:</strong></span>
                <span style={{ fontWeight: '700' }}>{orderSuccessModal.invoice.paymentStatus} ({orderSuccessModal.invoice.paymentMode})</span>
              </div>
            </div>

            {/* Dynamic UPI Payment QR Code */}
            {orderSuccessModal.upiQrUrl && (
              <div style={{ background: '#ffffff', border: '2px dashed #059669', borderRadius: '12px', padding: '12px', marginBottom: '16px', display: 'inline-block' }}>
                <img 
                  src={orderSuccessModal.upiQrUrl} 
                  alt="UPI QR Code" 
                  style={{ width: '180px', height: '180px', display: 'block', margin: '0 auto' }} 
                />
                <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: '800', marginTop: '6px' }}>
                  Scan to Pay ₹{Number(orderSuccessModal.invoice.grandTotal).toFixed(2)} via UPI
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  GPay • PhonePe • Paytm • BHIM
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={() => {
                  const shareText = buildInvoiceShareText(orderSuccessModal.invoice, business);
                  const waUrl = buildWhatsAppUrl(orderSuccessModal.invoice.customerPhone || orderSuccessModal.invoice.partyPhone, shareText);
                  window.open(waUrl, '_blank');
                }}
                className="btn"
                style={{ background: '#25D366', color: '#ffffff', border: 'none', padding: '10px', fontWeight: '700', gap: '8px', borderRadius: '8px' }}
              >
                <Send size={16} />
                <span>WhatsApp पर बिल व रसीद भेजें</span>
              </button>

              <button 
                onClick={() => {
                  if (handlePrintInvoice) handlePrintInvoice(orderSuccessModal.invoice);
                  setOrderSuccessModal(null);
                }}
                className="btn btn-secondary"
                style={{ padding: '10px', fontWeight: '700', gap: '6px', borderRadius: '8px' }}
              >
                <Printer size={16} />
                <span>बिल प्रिंट / PDF डाउनलोड करें</span>
              </button>

              <button 
                onClick={() => setOrderSuccessModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem', marginTop: '4px' }}
              >
                बंद करें और अगला ऑर्डर लें (Next Order)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
