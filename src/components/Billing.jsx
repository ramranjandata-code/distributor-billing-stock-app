import React, { useState } from 'react';
import { saveInvoice, saveParty, formatCartonStock } from '../utils/storage';
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
  Tag
} from 'lucide-react';

export default function Billing({ products, parties, business, refreshAllData, handlePrintInvoice, setActiveTab }) {
  const [cart, setCart] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [taxMode, setTaxMode] = useState('NONE'); // Default: NONE (Non-GST / Estimate)
  
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
  const [notes, setNotes] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  // Selected party object
  const selectedParty = parties.find(p => p.id === selectedPartyId);

  // Filter parties for live search suggestions inside Customer Name input
  const filteredParties = parties.filter(p => {
    const term = (partySearchTerm || customerName).toLowerCase();
    if (!term) return true;
    return (
      p.name.toLowerCase().includes(term) ||
      (p.phone && p.phone.includes(term)) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(term))
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

  // Billing Math Calculations per item (Rates entered are GST INCLUSIVE / Added GST)
  const getItemDetails = (item) => {
    const grossTotal = (Number(item.price) || 0) * (Number(item.qty) || 1);
    let itemDiscAmount = 0;
    const dVal = Number(item.itemDiscountVal) || 0;

    if (item.itemDiscountType === 'PERCENT') {
      itemDiscAmount = (grossTotal * dVal) / 100;
    } else {
      itemDiscAmount = dVal * (Number(item.qty) || 1); // ₹ dVal per unit
    }

    const netInclusiveTotal = Math.max(0, grossTotal - itemDiscAmount);
    const gstRate = Number(item.gstRate) || 0;
    
    // Back-calculate taxable base and GST portion included in the rate
    const netTaxable = taxMode === 'NONE' ? netInclusiveTotal : (netInclusiveTotal / (1 + gstRate / 100));
    const gstVal = taxMode === 'NONE' ? 0 : (netInclusiveTotal - netTaxable);

    return {
      grossTotal,
      itemDiscAmount,
      netInclusiveTotal,
      netTaxable,
      gstVal,
      finalItemTotal: netInclusiveTotal
    };
  };

  // Aggregate Totals
  let grossSubTotal = 0;
  let itemDiscountsTotal = 0;
  let taxTotal = 0;

  const processedCartItems = cart.map(item => {
    const calc = getItemDetails(item);
    const itemGst = taxMode === 'NONE' ? 0 : calc.gstVal;
    grossSubTotal += calc.grossTotal;
    itemDiscountsTotal += calc.itemDiscAmount;
    taxTotal += itemGst;

    return {
      ...item,
      total: calc.netInclusiveTotal, // Inclusive total for this item
      taxableAmount: calc.netTaxable,
      discAmount: calc.itemDiscAmount,
      itemGstAmount: itemGst
    };
  });

  const netSubTotal = Math.max(0, grossSubTotal - itemDiscountsTotal);

  // Overall Bill Discount Calculation
  let overallDiscountAmt = 0;
  const overallDVal = Number(discountValue) || 0;
  if (discountType === 'PERCENT') {
    overallDiscountAmt = (netSubTotal * overallDVal) / 100;
  } else {
    overallDiscountAmt = overallDVal;
  }

  // Grand Total is GST Inclusive (no extra GST added on top)
  const grandTotal = Math.max(0, netSubTotal - overallDiscountAmt);

  let cgst = 0, sgst = 0, igst = 0;
  if (taxMode === 'INTRA') {
    cgst = taxTotal / 2;
    sgst = taxTotal / 2;
  } else if (taxMode === 'INTER') {
    igst = taxTotal;
  }

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

  const handleSaveAndPrintBill = () => {
    if (cart.length === 0) {
      alert('⚠️ बिल में कम से कम 1 प्रोडक्ट जोड़ना आवश्यक है!');
      return;
    }

    const partyNameFinal = selectedParty ? selectedParty.name : (customerName || 'Cash Customer');
    const partyPhoneFinal = selectedParty ? selectedParty.phone : customerPhone;
    const partyGstinFinal = selectedParty ? selectedParty.gstin : '';
    const partyAddressFinal = selectedParty ? selectedParty.address : '';

    let actualPaid = grandTotal;
    let balanceAmt = 0;

    if (paymentStatus === 'UNPAID') {
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
      taxMode,
      subTotal: grossSubTotal,
      taxTotal,
      cgst,
      sgst,
      igst,
      discount: totalDiscountCombined,
      grandTotal,
      paymentStatus,
      paidAmount: actualPaid,
      balanceAmount: balanceAmt,
      notes
    };

    const savedInv = saveInvoice(invoicePayload);
    refreshAllData();
    
    // Clear bill state
    setCart([]);
    setSelectedPartyId('');
    setCustomerName('');
    setCustomerPhone('');
    setDiscountValue(0);
    setPaymentStatus('PAID');
    setPaidAmount('');
    setNotes('');

    // Print Modal open
    handlePrintInvoice(savedInv);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(440px, 1.4fr)', gap: '20px' }}>
      
      {/* LEFT COLUMN: Product Catalog & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div className="glass-card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={18} color="var(--primary)" />
            <span>प्रोडक्ट्स खोजें & जोड़ें (Search Products)</span>
          </h3>

          <div style={{ position: 'relative' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text"
              className="input-field"
              placeholder="नाम, SKU या ब्रांड से खोजें..."
              style={{ paddingLeft: '38px' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Product Quick Add List (Horizontal Row Layout) */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
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
                <option value="NONE">बिना GST (Non-GST / Estimate)</option>
                <option value="INTRA">राज्य के भीतर (CGST + SGST)</option>
                <option value="INTER">राज्य के बाहर (IGST)</option>
              </select>
            </div>

            {/* Retailer/Party Selection Header & Add Retailer Button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  रिटेलर / ग्राहक चुनें (Select Party)
                </label>
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
                  <span>+ नया रिटेलर (Add Retailer)</span>
                </button>
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
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '12px' }}>
                                <span>संपर्क: {p.contactPerson || 'N/A'}</span>
                                <span>फ़ोन: {p.phone || 'N/A'}</span>
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
                        संपर्क: {selectedParty?.contactPerson || 'N/A'} | GSTIN: {selectedParty?.gstin || 'Unregistered'}
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
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', marginBottom: '12px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>सकल सब-टोटल (Gross Subtotal):</span>
              <span>₹{grossSubTotal.toFixed(2)}</span>
            </div>

            {itemDiscountsTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399' }}>
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
                    background: discountType === 'PERCENT' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                    color: discountType === 'PERCENT' ? '#818cf8' : '#34d399',
                    cursor: 'pointer'
                  }}
                  title="Toggle overall discount between % and ₹"
                >
                  {discountType === 'PERCENT' ? '%' : '₹'}
                </button>
              </div>
            </div>

            {taxMode === 'NONE' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: '700' }}>
                <span>GST टैक्स:</span>
                <span>बिना GST (Non-GST Bill)</span>
              </div>
            ) : taxMode === 'INTRA' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <span>CGST (दर में शामिल / Included):</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <span>SGST (दर में शामिल / Included):</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                <span>IGST (दर में शामिल / Included):</span>
                <span>₹{igst.toFixed(2)}</span>
              </div>
            )}
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

          {paymentStatus === 'PARTIAL' && (
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">प्राप्त हुई राशि (Paid Amount ₹)</label>
              <input 
                type="number"
                className="input-field"
                placeholder="उदा. 1000"
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
              />
            </div>
          )}

          <button 
            onClick={handleSaveAndPrintBill}
            disabled={cart.length === 0}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', gap: '8px', opacity: cart.length === 0 ? 0.5 : 1 }}
          >
            <Printer size={20} />
            <span>बिल सेव करें & प्रिंट निकालें (Save & Print)</span>
          </button>

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

    </div>
  );
}
