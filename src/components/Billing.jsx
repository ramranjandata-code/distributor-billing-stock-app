import React, { useState, useEffect, useRef } from 'react';
import { saveInvoice, saveParty, formatCartonStock, fetchWarehouses, getCurrentOperator, calculateDueDate } from '../utils/storage';
import { generateUpiQrDataUrl, buildInvoiceShareText, buildWhatsAppUrl } from '../utils/qrUtils';
import { calculateBillTotals, detectSupplyType } from '../utils/taxUtils';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Receipt, 
  User, 
  UserPlus, 
  X, 
  Save, 
  CheckCircle, 
  IndianRupee, 
  ShoppingBag, 
  CreditCard, 
  Building, 
  Printer, 
  Percent, 
  Tag, 
  Barcode, 
  Truck, 
  QrCode, 
  Send, 
  Zap, 
  LayoutGrid, 
  Layers, 
  Sparkles,
  Calculator,
  ShieldCheck,
  FileText
} from 'lucide-react';

export default function Billing({ products, parties, business, refreshAllData, handlePrintInvoice, setActiveTab }) {
  const [cart, setCart] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pricingType, setPricingType] = useState('EXCLUSIVE'); // 'EXCLUSIVE' (Rate + GST Extra) or 'INCLUSIVE' (MRP)
  const [taxMode, setTaxMode] = useState('INTRA'); // 'INTRA' (CGST + SGST), 'INTER' (IGST), 'NONE' (0%)
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);

  // Enterprise POS & Barcode State
  const [posMode, setPosMode] = useState('STANDARD'); // 'STANDARD' or 'FAST_TOUCH'
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeScanAlert, setBarcodeScanAlert] = useState(null);
  const barcodeInputRef = useRef(null);

  // Multi-Warehouse Source
  const warehouses = fetchWarehouses();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(warehouses[0]?.id || 'wh_main');

  // Odoo Payment Terms & Due Date
  const [paymentTerms, setPaymentTerms] = useState('immediate');
  const invoiceDate = new Date().toISOString().split('T')[0];
  const computedDueDate = calculateDueDate(invoiceDate, paymentTerms);

  // e-Way Bill & Transport State
  const [ewayBillOpen, setEwayBillOpen] = useState(false);
  const [ewayBillData, setEwayBillData] = useState({
    transporterName: '',
    vehicleNo: '',
    distanceKm: '',
    ewayBillNo: ''
  });

  // Digital Payments & Instant Share Modal
  const [checkoutModal, setCheckoutModal] = useState(null); // holds { invoice, upiQrUrl }
  
  // Party Search & Add Party Modal State
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);
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

  // Overall Bill Discount
  const [discountType, setDiscountType] = useState('AMOUNT'); // 'AMOUNT' (₹) or 'PERCENT' (%)
  const [discountValue, setDiscountValue] = useState(0);

  const [paymentStatus, setPaymentStatus] = useState('PAID'); // PAID, UNPAID, PARTIAL
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH'); // CASH, UPI, NEFT, CHEQUE
  const [notes, setNotes] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  // Selected party object
  const selectedParty = parties.find(p => p.id === selectedPartyId);

  // Auto-detect supply type (Intra vs Inter) based on Seller and Buyer GSTIN state codes
  useEffect(() => {
    if (selectedParty && selectedParty.gstin && business?.gstin) {
      const autoSupply = detectSupplyType(business.gstin, selectedParty.gstin);
      setTaxMode(autoSupply);
    }
  }, [selectedPartyId, business]);

  // Auto-focus barcode input when switching to Fast POS mode
  useEffect(() => {
    if (posMode === 'FAST_TOUCH' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [posMode]);

  // Quick Barcode Scanning Handler
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
      setBarcodeScanAlert(`❌ No item found for code: "${code}"`);
      setTimeout(() => setBarcodeScanAlert(null), 2500);
      setBarcodeInput('');
    }
  };

  // 1-Click Walk-in Counter Sale filler
  const handleWalkInCounterSale = () => {
    setSelectedPartyId('');
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setPartySearchTerm('');
    setPaymentStatus('PAID');
    setPaymentMode('CASH');
  };

  // Filter parties for live search suggestions inside Customer Name input
  const filteredParties = parties.filter(p => {
    const term = (partySearchTerm || customerName).toLowerCase();
    if (!term) return true;
    return (
      p.name.toLowerCase().includes(term) ||
      (p.phone && p.phone.includes(term)) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(term)) ||
      (p.address && p.address.toLowerCase().includes(term)) ||
      (p.city && p.city.toLowerCase().includes(term))
    );
  });

  const handleSelectPartyFromList = (p) => {
    if (p) {
      setSelectedPartyId(p.id);
      setCustomerName(p.name);
      setCustomerPhone(p.phone);
      setPartySearchTerm(p.name);
    } else {
      setSelectedPartyId('');
      setCustomerName('');
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
    refreshAllData();

    if (savedParty && savedParty.id) {
      handleSelectPartyFromList(savedParty);
    }

    setPartyModalOpen(false);
    setNewPartyData(initialNewPartyState);
  };

  // Filter products for quick search
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddToCart = (product) => {
    if (product.currentStock <= 0) {
      alert(`⚠️ '${product.name}' का स्टॉक ख़त्म (Out of stock) है!`);
      return;
    }

    const pcsPerCtn = Number(product.pcsPerCarton) || 24;
    const existingIndex = cart.findIndex(item => item.productId === product.id);

    if (existingIndex > -1) {
      const existing = cart[existingIndex];
      const newQty = existing.qty + 1;
      if (newQty > product.currentStock) {
        alert(`⚠️ स्टॉक की अधिकतम सीमा (${formatCartonStock(product.currentStock, pcsPerCtn)}) तक पहुंच चुके हैं!`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].qty = newQty;
      updated[existingIndex].cartonQty = Math.floor(newQty / pcsPerCtn);
      updated[existingIndex].looseQty = newQty % pcsPerCtn;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          hsn: product.hsn,
          pcsPerCarton: pcsPerCtn,
          cartonQty: 0,
          looseQty: 1,
          qty: 1,
          unit: product.unit,
          price: product.salePrice,
          mrp: product.mrp,
          gstRate: product.gstRate,
          maxStock: product.currentStock,
          itemDiscountType: 'AMOUNT', // 'AMOUNT' (₹ per item) or 'PERCENT' (%)
          itemDiscountVal: 0
        }
      ]);
    }
  };

  const handleUpdateQty = (index, delta) => {
    const updated = [...cart];
    const item = updated[index];
    const pcsPerCtn = Number(item.pcsPerCarton) || 24;
    const newQty = item.qty + delta;

    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    if (newQty > item.maxStock) {
      alert(`⚠️ अधिकतम उपलब्ध स्टॉक ${formatCartonStock(item.maxStock, pcsPerCtn)} (${item.maxStock} Pcs) है!`);
      return;
    }

    item.qty = newQty;
    item.cartonQty = Math.floor(newQty / pcsPerCtn);
    item.looseQty = newQty % pcsPerCtn;
    setCart(updated);
  };

  const handleCartonQtyChange = (index, cartonVal) => {
    const updated = [...cart];
    const item = updated[index];
    const ctn = Math.max(0, parseInt(cartonVal) || 0);
    const pcsPerCtn = Number(item.pcsPerCarton) || 24;
    const loose = Number(item.looseQty) || 0;
    const newTotal = (ctn * pcsPerCtn) + loose;

    if (newTotal > item.maxStock) {
      alert(`⚠️ अधिकतम उपलब्ध स्टॉक ${formatCartonStock(item.maxStock, pcsPerCtn)} (${item.maxStock} Pcs) है!`);
      return;
    }

    item.cartonQty = ctn;
    item.qty = newTotal;
    setCart(updated);
  };

  const handleLooseQtyChange = (index, looseVal) => {
    const updated = [...cart];
    const item = updated[index];
    const loose = Math.max(0, parseInt(looseVal) || 0);
    const pcsPerCtn = Number(item.pcsPerCarton) || 24;
    const ctn = Number(item.cartonQty) || 0;
    const newTotal = (ctn * pcsPerCtn) + loose;

    if (newTotal > item.maxStock) {
      alert(`⚠️ अधिकतम उपलब्ध स्टॉक ${formatCartonStock(item.maxStock, pcsPerCtn)} (${item.maxStock} Pcs) है!`);
      return;
    }

    item.looseQty = loose;
    item.qty = newTotal;
    setCart(updated);
  };

  const handleItemPriceChange = (index, newPrice) => {
    const updated = [...cart];
    updated[index].price = Number(newPrice) || 0;
    setCart(updated);
  };

  const handleItemDiscountChange = (index, newDiscountVal) => {
    const updated = [...cart];
    updated[index].itemDiscountVal = Number(newDiscountVal) || 0;
    setCart(updated);
  };

  const handleToggleItemDiscountType = (index) => {
    const updated = [...cart];
    updated[index].itemDiscountType = updated[index].itemDiscountType === 'AMOUNT' ? 'PERCENT' : 'AMOUNT';
    setCart(updated);
  };

  const handleRemoveItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Centralized GST & Billing Calculations Engine
  const billCalc = calculateBillTotals({
    cartItems: cart,
    taxType: pricingType, // 'EXCLUSIVE' (Wholesale: Rate + GST on top) or 'INCLUSIVE' (MRP includes GST)
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

  // Compatibility helper for rendering individual row totals
  const getItemDetails = (item) => {
    const found = processedCartItems.find(p => p.productId === item.productId);
    if (found) {
      return {
        grossTotal: found.grossTotal,
        itemDiscAmount: found.discAmount,
        netInclusiveTotal: found.total,
        netTaxable: found.taxableAmount,
        gstVal: found.itemGstAmount,
        finalItemTotal: found.total
      };
    }
    return {
      grossTotal: 0,
      itemDiscAmount: 0,
      netInclusiveTotal: 0,
      netTaxable: 0,
      gstVal: 0,
      finalItemTotal: 0
    };
  };

  const handlePartySelect = (e) => {
    const pId = e.target.value;
    setSelectedPartyId(pId);
    if (pId) {
      const p = parties.find(pt => pt.id === pId);
      if (p) {
        setCustomerName(p.name);
        setCustomerPhone(p.phone);
      }
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  const handleSaveAndPrintBill = (asDraft = false) => {
    if (cart.length === 0) {
      alert('⚠️ बिल में कम से कम 1 प्रोडक्ट जोड़ना आवश्यक है!');
      return;
    }

    const partyNameFinal = selectedParty ? selectedParty.name : (customerName || 'Cash Customer');
    const partyPhoneFinal = selectedParty ? selectedParty.phone : customerPhone;
    const partyGstinFinal = selectedParty ? selectedParty.gstin : '';
    const partyAddressFinal = selectedParty ? (selectedParty.address || selectedParty.city || '') : '';

    let actualPaid = grandTotal;
    let balanceAmt = 0;

    if (asDraft) {
      actualPaid = 0;
      balanceAmt = grandTotal;
    } else if (paymentStatus === 'UNPAID') {
      actualPaid = 0;
      balanceAmt = grandTotal;
    } else if (paymentStatus === 'PARTIAL') {
      actualPaid = Number(paidAmount) || 0;
      balanceAmt = Math.max(0, grandTotal - actualPaid);
    }

    const totalDiscountCombined = itemDiscountsTotal + overallDiscountAmt;

    const invoicePayload = {
      partyId: selectedPartyId || null,
      partyName: partyNameFinal,
      partyPhone: partyPhoneFinal,
      partyGstin: partyGstinFinal,
      partyAddress: partyAddressFinal,
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
      discount: totalDiscountCombined,
      roundOff,
      grandTotal,
      paymentStatus: asDraft ? 'UNPAID' : paymentStatus,
      paidAmount: actualPaid,
      balanceAmount: balanceAmt,
      paymentMode,
      paymentTerms,
      dueDate: computedDueDate,
      state: asDraft ? 'draft' : 'posted',
      warehouseId: selectedWarehouseId,
      ewayBill: ewayBillOpen ? ewayBillData : null,
      notes
    };

    const savedInv = saveInvoice(invoicePayload);
    refreshAllData();

    if (asDraft) {
      alert(`📝 Odoo Draft Invoice #${savedInv.invoiceNo} saved successfully! Stock has NOT been deducted yet. You can confirm or edit it anytime from Invoices history.`);
      // Clear bill state
      setCart([]);
      setSelectedPartyId('');
      setCustomerName('');
      setCustomerPhone('');
      setDiscountValue(0);
      setPaymentStatus('PAID');
      setPaidAmount('');
      setNotes('');
      setEwayBillOpen(false);
      return;
    }

    // Generate dynamic UPI QR code for instant payment
    generateUpiQrDataUrl(business?.upiId, business?.name, grandTotal, savedInv.invoiceNo).then(qrUrl => {
      setCheckoutModal({
        invoice: savedInv,
        upiQrUrl: qrUrl
      });
    });
    
    // Clear bill state
    setCart([]);
    setSelectedPartyId('');
    setCustomerName('');
    setCustomerPhone('');
    setDiscountValue(0);
    setPaymentStatus('PAID');
    setPaidAmount('');
    setNotes('');
    setEwayBillOpen(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(440px, 1.4fr)', gap: '20px' }}>
      
      {/* LEFT COLUMN: Product Catalog & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={18} color="var(--primary)" />
              <span>{posMode === 'FAST_TOUCH' ? '⚡ Fast POS Touch Counter' : 'प्रोडक्ट्स खोजें & जोड़ें'}</span>
            </h3>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                type="button"
                onClick={() => setPosMode('STANDARD')}
                className={`btn ${posMode === 'STANDARD' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: '700' }}
              >
                Standard
              </button>
              <button 
                type="button"
                onClick={() => setPosMode('FAST_TOUCH')}
                className={`btn ${posMode === 'FAST_TOUCH' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: '700', gap: '4px' }}
              >
                <Zap size={12} />
                <span>Fast POS</span>
              </button>
            </div>
          </div>

          {/* Barcode Scanner Input Row */}
          <form onSubmit={handleBarcodeScan} style={{ marginBottom: '10px' }}>
            <div style={{ position: 'relative', display: 'flex', gap: '6px' }}>
              <Barcode size={18} color="var(--primary)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                ref={barcodeInputRef}
                type="text"
                className="input-field"
                placeholder="Scan Barcode / Enter SKU (Auto-Add on Enter)..."
                style={{ paddingLeft: '36px', fontSize: '0.84rem', borderColor: 'var(--primary)' }}
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
              />
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ padding: '0 12px', fontSize: '0.78rem', whiteSpace: 'nowrap', fontWeight: '700' }}
              >
                Scan Add
              </button>
            </div>
            {barcodeScanAlert && (
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: barcodeScanAlert.startsWith('✅') ? '#059669' : '#dc2626', marginTop: '4px' }}>
                {barcodeScanAlert}
              </div>
            )}
          </form>

          {/* Standard Text Search */}
          <div style={{ position: 'relative' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text"
              className="input-field"
              placeholder="नाम, SKU या ब्रांड से खोजें..."
              style={{ paddingLeft: '38px', fontSize: '0.84rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Product Quick Add List (Horizontal Row or Fast Touch Tiles) */}
        <div style={{ 
          display: posMode === 'FAST_TOUCH' ? 'grid' : 'flex',
          gridTemplateColumns: posMode === 'FAST_TOUCH' ? 'repeat(auto-fill, minmax(130px, 1fr))' : undefined,
          flexDirection: posMode === 'FAST_TOUCH' ? undefined : 'column',
          gap: '8px', 
          maxHeight: '600px', 
          overflowY: 'auto',
          paddingRight: '4px' 
        }}>
          {filteredProducts.map(product => {
            const isOutOfStock = product.currentStock <= 0;
            return (
              <div 
                key={product.id}
                onClick={() => !isOutOfStock && handleAddToCart(product)}
                className="glass-card glass-card-interactive"
                style={{ 
                  padding: '10px 14px', 
                  cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                  opacity: isOutOfStock ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  borderRadius: '10px'
                }}
              >
                {/* Left Info: Product Name & SKU / Pack Size */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {product.name}
                  </h4>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Pack: {product.pcsPerCarton || 24} Pcs/Ctn • SKU: {product.sku}
                  </div>
                </div>

                {/* Right Info: Price */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--primary)' }}>
                    ₹{product.salePrice}
                  </span>
                  {product.mrp > product.salePrice && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textDecoration: 'line-through', marginLeft: '6px' }}>
                      ₹{product.mrp}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* RIGHT COLUMN: Active Cart & GST Billing Summary */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        <div>
          {/* Header & Party Selector */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>वर्तमान बिल (Current Invoice)</h3>
              </div>

              <select 
                className="input-field select-field" 
                style={{ width: 'auto', fontSize: '0.8rem', padding: '6px 28px 6px 10px' }}
                value={taxMode}
                onChange={e => setTaxMode(e.target.value)}
              >
                <option value="INTRA">राज्य के भीतर (CGST + SGST)</option>
                <option value="INTER">राज्य के बाहर (IGST)</option>
                <option value="NONE">बिना GST (Non-GST / Estimate)</option>
              </select>
            </div>

            {/* Retailer/Party Selection Header & Add Retailer Button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  रिटेलर / ग्राहक चुनें (Select Party)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button"
                    onClick={handleWalkInCounterSale}
                    className="btn btn-sm btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '0.74rem', gap: '4px', background: '#ecfdf5', color: '#059669', borderColor: '#10b981' }}
                    title="1-Click Walk-in Cash Customer"
                  >
                    <Zap size={12} />
                    <span>⚡ Walk-in Cash Sale</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setNewPartyData(initialNewPartyState);
                      setPartyModalOpen(true);
                    }}
                    className="btn btn-sm btn-primary"
                    style={{ padding: '3px 10px', fontSize: '0.78rem', gap: '4px' }}
                  >
                    <UserPlus size={14} />
                    <span>+ नया रिटेलर</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                
                {/* LEFT: Select Dropdown */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <select 
                    className="input-field select-field"
                    value={selectedPartyId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      if (pId) {
                        const p = parties.find(pt => pt.id === pId);
                        handleSelectPartyFromList(p);
                      } else {
                        handleSelectPartyFromList(null);
                      }
                    }}
                  >
                    <option value="">-- नकद ग्राहक (Cash Sale) --</option>
                    {parties.map(party => (
                      <option key={party.id} value={party.id}>
                        {party.name} {party.phone ? `(${party.phone})` : ''} {party.balance > 0 ? `[उधार: ₹${party.balance}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* RIGHT: Customer Name & Live Search Bar */}
                {!selectedPartyId ? (
                  <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} color="var(--primary)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input 
                        type="text"
                        className="input-field"
                        placeholder="उदा. नकद वाक-इन कस्टमर (या नाम/नंबर से खोजें...)"
                        style={{ paddingLeft: '32px' }}
                        value={customerName}
                        onFocus={() => setShowPartySuggestions(true)}
                        onChange={e => {
                          const val = e.target.value;
                          setCustomerName(val);
                          setPartySearchTerm(val);
                          setShowPartySuggestions(true);
                        }}
                      />
                    </div>

                    {/* Live Search Suggestions Dropdown Popup */}
                    {showPartySuggestions && customerName.trim().length > 0 && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 999,
                          background: '#ffffff',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                          border: '1px solid var(--border-color)',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          marginTop: '4px'
                        }}
                      >
                        <div style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>🔍 रिटेलर खोज परिणाम ({filteredParties.length})</span>
                          <span onClick={() => setShowPartySuggestions(false)} style={{ cursor: 'pointer', color: '#c2410c' }}>✕ बंद करें</span>
                        </div>

                        {filteredParties.length === 0 ? (
                          <div style={{ padding: '12px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                            कोई रिटेलर नहीं मिला ('{customerName}' को नकद ग्राहक माना जाएगा)
                          </div>
                        ) : (
                          filteredParties.map(p => (
                            <div 
                              key={p.id}
                              onClick={() => handleSelectPartyFromList(p)}
                              style={{
                                padding: '10px 12px',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{p.name}</strong>
                                {p.balance > 0 && (
                                  <span style={{ fontSize: '0.75rem', color: '#c2410c', background: '#fff7ed', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                    उधार: ₹{p.balance}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#c2410c', fontWeight: '600', flexShrink: 0 }}>📍 पता:</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.address || p.city || 'पता दर्ज नहीं है (No Address)'}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Selected Party Summary Card with Reset Button */
                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: '800', color: 'var(--primary)', marginBottom: '2px' }}>
                        {selectedParty?.name}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        📍 पता: {selectedParty?.address || selectedParty?.city || 'N/A'} {selectedParty?.phone ? `| 📞 ${selectedParty.phone}` : ''}
                      </p>
                      <p style={{ fontSize: '0.8rem', fontWeight: '800', color: selectedParty?.balance > 0 ? '#c2410c' : '#10b981', marginTop: '2px' }}>
                        मौजूदा बकाया उधार: ₹{selectedParty?.balance || 0}
                      </p>
                    </div>

                    <button 
                      type="button"
                      onClick={() => handleSelectPartyFromList(null)}
                      className="btn btn-sm btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#c2410c' }}
                      title="पार्टी सेलेक्ट रिसेट करें"
                    >
                      ✕ बदलें
                    </button>
                  </div>
                )}

              </div>

            </div>

          </div>

          {/* Cart Items Table */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                <ShoppingBag size={40} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
                <p style={{ fontWeight: '600' }}>बिल कार्ट खाली है!</p>
                <p style={{ fontSize: '0.8rem' }}>बाएं तरफ से प्रोडक्ट्स पर क्लिक करके बिल में जोड़ें।</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 4px' }}>आइटम</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>मात्रा</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>दर (₹)</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>छूट (Disc)</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>कुल (₹)</th>
                    <th style={{ padding: '8px 2px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => {
                    const calc = getItemDetails(item);

                    return (
                      <tr key={item.productId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 4px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.84rem' }}>{item.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            Pack: {item.pcsPerCarton || 24} Pcs/Ctn • GST: {item.gstRate}%
                          </div>
                        </td>
                        
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              
                              {/* Carton input */}
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <input 
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  title="कार्टन (Cartons)"
                                  style={{ width: '56px', padding: '5px 6px', textAlign: 'center', fontSize: '0.88rem', fontWeight: '800', borderRadius: '6px' }}
                                  className="input-field"
                                  value={item.cartonQty !== undefined ? item.cartonQty : Math.floor(item.qty / (item.pcsPerCarton || 24))}
                                  onChange={e => handleCartonQtyChange(index, e.target.value)}
                                />
                                <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '800' }}>Ctn</span>
                              </div>

                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>+</span>

                              {/* Loose Pcs input */}
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <input 
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  title="खुले पीस (Loose Pcs)"
                                  style={{ width: '56px', padding: '5px 6px', textAlign: 'center', fontSize: '0.88rem', fontWeight: '800', borderRadius: '6px' }}
                                  className="input-field"
                                  value={item.looseQty !== undefined ? item.looseQty : item.qty % (item.pcsPerCarton || 24)}
                                  onChange={e => handleLooseQtyChange(index, e.target.value)}
                                />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>Pcs</span>
                              </div>

                            </div>

                            {/* Total base pcs text */}
                            <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: '800' }}>
                              = {item.qty} Pcs Total
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          <input 
                            type="number"
                            step="0.01"
                            style={{ width: '72px', padding: '5px 6px', textAlign: 'right', fontSize: '0.86rem', fontWeight: '700' }}
                            className="input-field"
                            value={item.price}
                            onChange={e => handleItemPriceChange(index, e.target.value)}
                          />
                        </td>

                        {/* Item-wise Discount (% / ₹ Toggle) */}
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <input 
                              type="number"
                              step="0.01"
                              style={{ width: '60px', padding: '5px 6px', textAlign: 'right', fontSize: '0.86rem', fontWeight: '700' }}
                              className="input-field"
                              placeholder="0"
                              value={item.itemDiscountVal || ''}
                              onChange={e => handleItemDiscountChange(index, e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => handleToggleItemDiscountType(index)}
                              title={item.itemDiscountType === 'PERCENT' ? 'Percentage (%) Discount' : 'Rupees (₹) Discount per unit'}
                              style={{ 
                                padding: '2px 5px', 
                                fontSize: '0.72rem', 
                                fontWeight: '700',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                background: item.itemDiscountType === 'PERCENT' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                                color: item.itemDiscountType === 'PERCENT' ? '#818cf8' : '#34d399',
                                cursor: 'pointer'
                              }}
                            >
                              {item.itemDiscountType === 'PERCENT' ? '%' : '₹'}
                            </button>
                          </div>
                        </td>

                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                          ₹{calc.netInclusiveTotal.toFixed(2)}
                        </td>

                        <td style={{ padding: '8px 2px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleRemoveItem(index)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Calculation Summary Footer */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          
          {/* Taxation & Pricing Controls */}
          <div style={{ background: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)' }}>
                मूल्य निर्धारण (Pricing Mode):
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setPricingType('EXCLUSIVE')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: pricingType === 'EXCLUSIVE' ? 'var(--primary)' : '#fff',
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
                    padding: '4px 8px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: pricingType === 'INCLUSIVE' ? 'var(--primary)' : '#fff',
                    color: pricingType === 'INCLUSIVE' ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  MRP / कर सहित (Tax Incl.)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                टैक्स क्षेत्र (Supply Region):
                {selectedParty?.gstin && (
                  <span style={{ fontSize: '0.68rem', color: '#059669', background: '#d1fae5', padding: '1px 5px', borderRadius: '4px' }}>
                    Auto GSTIN
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setTaxMode('INTRA')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.74rem',
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
                    padding: '4px 8px',
                    fontSize: '0.74rem',
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
                    padding: '4px 8px',
                    fontSize: '0.74rem',
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
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', marginBottom: '12px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
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

            {/* Overall Bill Discount (% vs ₹) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>कुल बिल छूट (Overall Bill Discount):</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="number"
                  step="0.01"
                  style={{ width: '75px', padding: '3px 6px', textAlign: 'right' }}
                  className="input-field"
                  placeholder="0"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setDiscountType(discountType === 'PERCENT' ? 'AMOUNT' : 'PERCENT')}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '0.8rem', 
                    fontWeight: '800',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: discountType === 'PERCENT' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: discountType === 'PERCENT' ? '#4f46e5' : '#059669',
                    cursor: 'pointer'
                  }}
                  title="Toggle overall discount between % and ₹"
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

            {taxMode === 'NONE' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: '700' }}>
                <span>GST टैक्स:</span>
                <span>बिना GST (Non-GST / Exempt 0%)</span>
              </div>
            ) : taxMode === 'INTRA' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <span>CGST {pricingType === 'EXCLUSIVE' ? '(दर पर अतिरिक्त)' : '(दर में शामिल)'}:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{cgst.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <span>SGST {pricingType === 'EXCLUSIVE' ? '(दर पर अतिरिक्त)' : '(दर में शामिल)'}:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{sgst.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <span>IGST {pricingType === 'EXCLUSIVE' ? '(दर पर अतिरिक्त)' : '(दर में शामिल)'}:</span>
                <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{igst.toFixed(2)}</span>
              </div>
            )}

            {/* Round Off Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>कुल देय राशि (Grand Total):</span>
            <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)' }}>
              ₹{grandTotal.toFixed(2)}
            </span>
          </div>

          {/* Payment Status Switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <button 
              type="button"
              onClick={() => setPaymentStatus('PAID')}
              className={`btn btn-sm ${paymentStatus === 'PAID' ? 'btn-primary' : 'btn-secondary'}`}
            >
              नकद / चुकता (PAID)
            </button>
            <button 
              type="button"
              onClick={() => setPaymentStatus('UNPAID')}
              className={`btn btn-sm ${paymentStatus === 'UNPAID' ? 'btn-danger' : 'btn-secondary'}`}
            >
              उधार (CREDIT)
            </button>
            <button 
              type="button"
              onClick={() => setPaymentStatus('PARTIAL')}
              className={`btn btn-sm ${paymentStatus === 'PARTIAL' ? 'badge-warning' : 'btn-secondary'}`}
            >
              आंशिक (PARTIAL)
            </button>
          </div>

          {/* Payment Mode Selector */}
          <div style={{ marginBottom: '12px' }}>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
              भुगतान माध्यम (Payment Method):
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
              {['CASH', 'UPI', 'NEFT', 'CHEQUE'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  style={{
                    padding: '6px 4px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: paymentMode === mode ? '#ecfdf5' : '#ffffff',
                    color: paymentMode === mode ? '#059669' : 'var(--text-main)',
                    fontWeight: '800',
                    fontSize: '0.74rem',
                    cursor: 'pointer'
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Warehouse Source & e-Way Bill Accordion */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)' }}>Warehouse / Depot:</span>
              <select 
                className="input-field select-field" 
                style={{ fontSize: '0.76rem', padding: '4px 20px 4px 8px', width: 'auto' }}
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            {/* e-Way Bill Toggle */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', background: '#ffffff' }}>
              <div 
                onClick={() => setEwayBillOpen(!ewayBillOpen)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', color: '#2563eb' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={14} />
                  <span>e-Way Bill & Transport Details {ewayBillOpen ? '▲' : '▼'}</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {ewayBillOpen ? 'Hide' : '(Optional for Interstate / >₹50k)'}
                </span>
              </div>

              {ewayBillOpen && (
                <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem' }}>
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="Transporter Name"
                    style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                    value={ewayBillData.transporterName}
                    onChange={e => setEwayBillData({ ...ewayBillData, transporterName: e.target.value })}
                  />
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="Vehicle No (e.g. DL01AA1234)"
                    style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                    value={ewayBillData.vehicleNo}
                    onChange={e => setEwayBillData({ ...ewayBillData, vehicleNo: e.target.value })}
                  />
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="Distance (KM)"
                    style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                    value={ewayBillData.distanceKm}
                    onChange={e => setEwayBillData({ ...ewayBillData, distanceKm: e.target.value })}
                  />
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="e-Way Bill No. (if generated)"
                    style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                    value={ewayBillData.ewayBillNo}
                    onChange={e => setEwayBillData({ ...ewayBillData, ewayBillNo: e.target.value })}
                  />
                </div>
              )}
            </div>

            {/* Odoo Payment Terms & Due Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Payment Terms (शर्तें):
                </label>
                <select 
                  className="input-field select-field" 
                  style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                >
                  <option value="immediate">Immediate Payment</option>
                  <option value="15_days">15 Days</option>
                  <option value="30_days">30 Days</option>
                  <option value="45_days">45 Days</option>
                  <option value="end_of_month">End of Following Month</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Due Date (अंतिम तिथि):
                </label>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b', padding: '5px 8px', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  📅 {computedDueDate}
                </div>
              </div>
            </div>

          </div>

          {/* Action Buttons: Confirm & Post vs Save as Draft */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
              <button 
                onClick={() => handleSaveAndPrintBill(false)}
                disabled={cart.length === 0}
                className="btn btn-primary"
                style={{ padding: '12px', gap: '8px', opacity: cart.length === 0 ? 0.5 : 1, fontWeight: '800', fontSize: '0.9rem' }}
              >
                <Zap size={18} />
                <span>Confirm & Post (बिल बनाएं)</span>
              </button>
              <button 
                onClick={() => handleSaveAndPrintBill(true)}
                disabled={cart.length === 0}
                className="btn btn-secondary"
                style={{ padding: '12px', gap: '6px', opacity: cart.length === 0 ? 0.5 : 1, fontWeight: '700', fontSize: '0.82rem', background: '#f1f5f9' }}
                title="Save as Draft without deducting stock or updating ledger yet"
              >
                <FileText size={16} />
                <span>Save Draft (ड्राफ्ट)</span>
              </button>
            </div>

            {setActiveTab && (
              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                style={{
                  background: 'none',
                  border: '1px dashed var(--primary)',
                  color: 'var(--primary)',
                  borderRadius: '8px',
                  padding: '8px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Sparkles size={14} />
                <span>Switch to Odoo Invoice Studio & History ➔</span>
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Add New Retailer Modal inside Billing */}
      {partyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="var(--primary)" />
                <span>👥 नया रिटेलर / ग्राहक जोड़ें</span>
              </h3>
              <button 
                type="button"
                onClick={() => setPartyModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewParty}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">दुकान / रिटेलर का नाम (Shop Name) *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="उदा. गुप्ता किराना & जनरल स्टोर"
                    value={newPartyData.name}
                    onChange={e => setNewPartyData({...newPartyData, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">दुकानदार / संपर्क व्यक्ति (Contact Person)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. रमाकांत गुप्ता"
                    value={newPartyData.contactPerson}
                    onChange={e => setNewPartyData({...newPartyData, contactPerson: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">फ़ोन नंबर (Mobile No) *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="उदा. 9811223344"
                    value={newPartyData.phone}
                    onChange={e => setNewPartyData({...newPartyData, phone: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">शहर / क्षेत्र (City / Area)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. रोहिणी, दिल्ली"
                    value={newPartyData.city}
                    onChange={e => setNewPartyData({...newPartyData, city: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GSTIN नंबर (यदि उपलब्ध हो)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. 07BAPPG4321A1Z2"
                    value={newPartyData.gstin}
                    onChange={e => setNewPartyData({...newPartyData, gstin: e.target.value})}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">दुकान का पूरा पता (Address)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. शॉप नं 4, मेन मार्केट, रोहिणी सेक्टर 7"
                    value={newPartyData.address}
                    onChange={e => setNewPartyData({...newPartyData, address: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">क्रेडिट लिमिट (Credit Limit ₹)</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={newPartyData.creditLimit}
                    onChange={e => setNewPartyData({...newPartyData, creditLimit: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">प्रारंभिक बकाया / उधार (Opening Balance ₹)</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={newPartyData.balance}
                    onChange={e => setNewPartyData({...newPartyData, balance: e.target.value})}
                  />
                </div>

              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setPartyModalOpen(false)}
                  className="btn btn-secondary"
                >
                  रद्द करें
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '6px' }}>
                  <Save size={16} />
                  <span>खाता सेव करें (Save Party)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic UPI Checkout & Instant Sharing Modal */}
      {checkoutModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '24px', textAlign: 'center' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <CheckCircle size={30} />
            </div>

            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
              Invoice #{checkoutModal.invoice.invoiceNo} Generated!
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 16px 0' }}>
              Billed to: <strong>{checkoutModal.invoice.customerName || 'Cash Customer'}</strong>
            </p>

            {/* Dynamic UPI QR Code Card */}
            <div style={{
              background: '#f8fafc',
              border: '2px dashed #059669',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: '800', color: '#059669' }}>
                <QrCode size={16} />
                <span>SCAN TO PAY VIA ANY UPI APP (MargPay)</span>
              </div>

              {checkoutModal.upiQrUrl ? (
                <img 
                  src={checkoutModal.upiQrUrl} 
                  alt="UPI QR" 
                  style={{ width: '180px', height: '180px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '4px' }}
                />
              ) : (
                <div style={{ width: '180px', height: '180px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Generating QR...
                </div>
              )}

              <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#059669' }}>
                ₹{Number(checkoutModal.invoice.grandTotal || 0).toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                VPA: <strong>{business?.upiId || 'shreeganesh@upi'}</strong> • {business?.name}
              </span>
            </div>

            {/* Instant Sharing Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => {
                  const shareText = buildInvoiceShareText(checkoutModal.invoice, business);
                  const waUrl = buildWhatsAppUrl(checkoutModal.invoice.customerPhone, shareText);
                  window.open(waUrl, '_blank');
                }}
                className="btn"
                style={{ 
                  background: '#25D366', 
                  color: '#ffffff', 
                  border: 'none', 
                  padding: '11px', 
                  fontWeight: '700', 
                  fontSize: '0.9rem',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px' 
                }}
              >
                <Send size={18} />
                <span>Instant Share on WhatsApp</span>
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button 
                  onClick={() => {
                    handlePrintInvoice(checkoutModal.invoice);
                    setCheckoutModal(null);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '10px', fontWeight: '700', fontSize: '0.85rem', gap: '6px' }}
                >
                  <Printer size={16} />
                  <span>Print Bill (A4/A5/Thermal)</span>
                </button>

                <button 
                  onClick={() => setCheckoutModal(null)}
                  className="btn btn-secondary"
                  style={{ padding: '10px', fontWeight: '700', fontSize: '0.85rem' }}
                >
                  Done / Next Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
