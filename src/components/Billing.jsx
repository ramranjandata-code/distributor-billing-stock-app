import React, { useState } from 'react';
import { saveInvoice, formatCartonStock } from '../utils/storage';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Receipt, 
  User, 
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
  const [taxMode, setTaxMode] = useState('INTRA'); // INTRA (CGST+SGST) or INTER (IGST)
  
  // Overall Bill Discount
  const [discountType, setDiscountType] = useState('AMOUNT'); // 'AMOUNT' (₹) or 'PERCENT' (%)
  const [discountValue, setDiscountValue] = useState(0);

  const [paymentStatus, setPaymentStatus] = useState('PAID'); // PAID, UNPAID, PARTIAL
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  // Selected party object
  const selectedParty = parties.find(p => p.id === selectedPartyId);

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

  // Billing Math Calculations per item
  const getItemDetails = (item) => {
    const grossTotal = (Number(item.price) || 0) * (Number(item.qty) || 1);
    let itemDiscAmount = 0;
    const dVal = Number(item.itemDiscountVal) || 0;

    if (item.itemDiscountType === 'PERCENT') {
      itemDiscAmount = (grossTotal * dVal) / 100;
    } else {
      itemDiscAmount = dVal * (Number(item.qty) || 1); // ₹ dVal per unit
    }

    const netTaxable = Math.max(0, grossTotal - itemDiscAmount);
    const gstVal = (netTaxable * (Number(item.gstRate) || 0)) / 100;

    return {
      grossTotal,
      itemDiscAmount,
      netTaxable,
      gstVal,
      finalItemTotal: netTaxable + gstVal
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
      total: calc.netTaxable, // Taxable subtotal for this item
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

  const finalTaxableTotal = Math.max(0, netSubTotal - overallDiscountAmt);
  const grandTotal = finalTaxableTotal + taxTotal;

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
                <option value="INTRA">राज्य के भीतर (CGST + SGST)</option>
                <option value="INTER">राज्य के बाहर (IGST)</option>
                <option value="NONE">बिना GST (Non-GST / Estimate)</option>
              </select>
            </div>

            {/* Retailer/Party Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">रिटेलर / ग्राहक चुनें (Select Party)</label>
                <select 
                  className="input-field select-field"
                  value={selectedPartyId}
                  onChange={handlePartySelect}
                >
                  <option value="">-- नकद ग्राहक (Cash Sale) --</option>
                  {parties.map(party => (
                    <option key={party.id} value={party.id}>
                      {party.name} {party.balance > 0 ? `(उधार: ₹${party.balance})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedPartyId ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">ग्राहक का नाम (Customer Name)</label>
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="उदा. नकद वाक-इन कस्टमर"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                  />
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>GSTIN: {selectedParty?.gstin || 'Unregistered'}</p>
                  <p style={{ fontSize: '0.82rem', fontWeight: '700', color: selectedParty?.balance > 0 ? '#fbbf24' : '#34d399' }}>
                    मौजूदा उधार (Bal): ₹{selectedParty?.balance || 0}
                  </p>
                </div>
              )}

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
                          ₹{calc.netTaxable.toFixed(2)}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>CGST टैक्स:</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>SGST टैक्स:</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>IGST टैक्स:</span>
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

    </div>
  );
}
