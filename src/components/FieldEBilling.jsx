import React, { useState } from 'react';
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
  Zap
} from 'lucide-react';
import { 
  saveInvoice, 
  updatePartyBalance, 
  formatCartonStock, 
  logAuditAction, 
  getCurrentOperator 
} from '../utils/storage';
import { buildWhatsAppUrl, buildInvoiceShareText } from '../utils/qrUtils';

export default function FieldEBilling({ products = [], parties = [], business, refreshAllData, handlePrintInvoice }) {
  const [activeSubTab, setActiveSubTab] = useState('ORDER_BOOKING'); // 'ORDER_BOOKING', 'LIVE_STOCK', 'COLLECTION'
  
  // Order Booking State
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [orderCart, setOrderCart] = useState([]);
  const [paymentMode, setPaymentMode] = useState('CREDIT'); // CREDIT (Unpaid), CASH, UPI
  const [orderSuccessModal, setOrderSuccessModal] = useState(null);

  // Field Collection State
  const [collectionPartyId, setCollectionPartyId] = useState('');
  const [collectionAmount, setCollectionAmount] = useState('');
  const [collectionMode, setCollectionMode] = useState('CASH'); // CASH, UPI
  const [collectionNote, setCollectionNote] = useState('');

  const currentOp = getCurrentOperator();

  // Filter products for live stock lookup
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchProduct.toLowerCase())) ||
    (p.sku && p.sku.toLowerCase().includes(searchProduct.toLowerCase()))
  );

  const selectedParty = parties.find(p => p.id === selectedPartyId);

  // Add item to field order
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
        alert(`Stock limit reached (${product.currentStock} Pcs max)`);
        return;
      }
      const updated = [...orderCart];
      updated[existingIndex].qty = newQty;
      updated[existingIndex].cartonQty = Math.floor(newQty / pcsPerCtn);
      updated[existingIndex].looseQty = newQty % pcsPerCtn;
      updated[existingIndex].total = newQty * Number(product.salePrice || product.mrp);
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
          total: rate
        }
      ]);
    }
  };

  const updateCartQty = (productId, delta) => {
    const updated = orderCart.map(item => {
      if (item.productId === productId) {
        const product = products.find(p => p.id === productId);
        const max = product ? product.currentStock : 9999;
        const newQty = item.qty + delta;
        if (newQty <= 0) return null;
        if (newQty > max) {
          alert(`Maximum available stock is ${max} Pcs`);
          return item;
        }
        const pcsPerCtn = item.pcsPerCarton || 24;
        return {
          ...item,
          qty: newQty,
          cartonQty: Math.floor(newQty / pcsPerCtn),
          looseQty: newQty % pcsPerCtn,
          total: newQty * item.price
        };
      }
      return item;
    }).filter(Boolean);

    setOrderCart(updated);
  };

  const grandTotal = orderCart.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  // Submit Field Order / Invoice
  const handleSubmitOrder = () => {
    if (!selectedPartyId) {
      alert('Please select a Retailer/Shop first!');
      return;
    }
    if (orderCart.length === 0) {
      alert('Cart is empty. Add at least one product!');
      return;
    }

    const party = parties.find(p => p.id === selectedPartyId);
    const isPaid = paymentMode === 'CASH' || paymentMode === 'UPI';

    const invoiceData = {
      partyId: selectedPartyId,
      customerName: party.name,
      customerPhone: party.phone,
      partyAddress: party.address || party.city,
      partyGstin: party.gstin || 'URP',
      items: orderCart,
      subTotal: grandTotal,
      taxTotal: 0,
      discountAmount: 0,
      grandTotal: grandTotal,
      taxMode: 'INTRA',
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      paidAmount: isPaid ? grandTotal : 0,
      balanceAmount: isPaid ? 0 : grandTotal,
      paymentMode: paymentMode,
      operator: currentOp?.name || 'Field Representative',
      notes: `Booked on-the-go via eBilling Mobile App by ${currentOp?.name || 'Field Agent'}`
    };

    const newInvoice = saveInvoice(invoiceData);
    logAuditAction('FIELD_ORDER_BOOKED', 'Field eBilling', `Field order #${newInvoice.invoiceNo} booked for ${party.name} (₹${grandTotal.toLocaleString('en-IN')})`);
    
    if (refreshAllData) refreshAllData();

    setOrderSuccessModal(newInvoice);
    setOrderCart([]);
    setSelectedPartyId('');
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

      {/* VIEW 1: ORDER BOOKING */}
      {activeSubTab === 'ORDER_BOOKING' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          
          {/* Left Column: Retailer & Product Catalog */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Retailer Selector Card */}
            <div className="card" style={{ padding: '16px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800' }}>
                <UserCheck size={16} color="#059669" />
                <span>Select Retailer / Customer *</span>
              </label>
              <select 
                className="form-control"
                value={selectedPartyId}
                onChange={e => setSelectedPartyId(e.target.value)}
                style={{ fontSize: '0.92rem', padding: '10px' }}
              >
                <option value="">-- Choose Retailer Shop --</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.city || 'Local'}) {Number(p.balance) > 0 ? `• Due: ₹${Number(p.balance).toLocaleString('en-IN')}` : ''}
                  </option>
                ))}
              </select>

              {selectedParty && (
                <div style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
                  <div><strong>Phone:</strong> {selectedParty.phone || 'N/A'}</div>
                  <div><strong>Location:</strong> {selectedParty.address || selectedParty.city || 'Local Market'}</div>
                  <div style={{ marginTop: '4px', color: Number(selectedParty.balance) > 0 ? '#dc2626' : '#059669', fontWeight: '700' }}>
                    Current Due Balance: ₹{Number(selectedParty.balance || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>

            {/* Product Quick Search & Catalog */}
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  className="form-control"
                  placeholder="Quick search product name, brand, or SKU..."
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                />
              </div>

              <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No products found</div>
                ) : (
                  filteredProducts.map(p => (
                    <div 
                      key={p.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: p.currentStock <= 0 ? '#fef2f2' : '#ffffff',
                        opacity: p.currentStock <= 0 ? 0.7 : 1
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-main)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Rate: <strong>₹{Number(p.salePrice || p.mrp).toLocaleString('en-IN')}</strong> • Stock: {formatCartonStock(p.currentStock, p.pcsPerCarton)}
                        </div>
                      </div>

                      <button 
                        onClick={() => handleAddToCart(p)}
                        disabled={p.currentStock <= 0}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: '700', gap: '4px' }}
                      >
                        <Plus size={14} />
                        <span>Add</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Active Order Cart & Fast Checkout */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={18} color="#059669" />
                <span>Field Cart ({orderCart.length} Items)</span>
              </h3>
              {orderCart.length > 0 && (
                <button 
                  onClick={() => setOrderCart([])}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700' }}
                >
                  Clear All
                </button>
              )}
            </div>

            {orderCart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 12px', color: 'var(--text-muted)' }}>
                <ShoppingCart size={36} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.88rem' }}>No items in field order yet.</p>
                <p style={{ fontSize: '0.76rem', marginTop: '4px' }}>Click "Add" on any product from the catalog.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {orderCart.map(item => (
                    <div 
                      key={item.productId}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ maxWidth: '60%' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.84rem' }}>{item.name}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          ₹{item.price} × {item.qty} {item.unit}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <button 
                            onClick={() => updateCartQty(item.productId, -1)}
                            style={{ padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer' }}
                          >
                            <Minus size={12} />
                          </button>
                          <span style={{ fontSize: '0.82rem', fontWeight: '800', minWidth: '22px', textAlign: 'center' }}>
                            {item.qty}
                          </span>
                          <button 
                            onClick={() => updateCartQty(item.productId, 1)}
                            style={{ padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer' }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', minWidth: '60px', textAlign: 'right' }}>
                          ₹{item.total.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bill Summary & Payment Option */}
                <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '800' }}>
                    <span>Order Grand Total:</span>
                    <span style={{ color: '#059669' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="form-group" style={{ marginTop: '6px' }}>
                    <label className="form-label">Payment Terms for this Order:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                      <button 
                        type="button"
                        onClick={() => setPaymentMode('CREDIT')}
                        style={{
                          padding: '8px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          background: paymentMode === 'CREDIT' ? '#fef3c7' : '#ffffff',
                          color: paymentMode === 'CREDIT' ? '#b45309' : 'var(--text-main)',
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        Credit (Udhar)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentMode('CASH')}
                        style={{
                          padding: '8px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          background: paymentMode === 'CASH' ? '#ecfdf5' : '#ffffff',
                          color: paymentMode === 'CASH' ? '#059669' : 'var(--text-main)',
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cash Collected
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentMode('UPI')}
                        style={{
                          padding: '8px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          background: paymentMode === 'UPI' ? '#eff6ff' : '#ffffff',
                          color: paymentMode === 'UPI' ? '#2563eb' : 'var(--text-main)',
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        UPI Paid
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={handleSubmitOrder}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: '800', gap: '8px', marginTop: '6px' }}
                  >
                    <CheckCircle size={18} />
                    <span>Submit & Generate Bill</span>
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

      {/* Order Success Modal with 1-Click WhatsApp Sharing */}
      {orderSuccessModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: '24px', textAlign: 'center' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
              <CheckCircle size={32} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>Order Booked Successfully!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
              Invoice <strong>#{orderSuccessModal.invoiceNo}</strong> has been generated and stock deducted.
            </p>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', margin: '16px 0', textAlign: 'left', fontSize: '0.85rem' }}>
              <div><strong>Retailer:</strong> {orderSuccessModal.customerName}</div>
              <div><strong>Amount:</strong> ₹{Number(orderSuccessModal.grandTotal).toLocaleString('en-IN')}</div>
              <div><strong>Payment:</strong> {orderSuccessModal.paymentStatus}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => {
                  const shareText = buildInvoiceShareText(orderSuccessModal, business);
                  const waUrl = buildWhatsAppUrl(orderSuccessModal.customerPhone, shareText);
                  window.open(waUrl, '_blank');
                }}
                className="btn"
                style={{ background: '#25D366', color: '#ffffff', border: 'none', padding: '10px', fontWeight: '700', gap: '8px' }}
              >
                <Send size={16} />
                <span>Send Bill on WhatsApp</span>
              </button>

              <button 
                onClick={() => {
                  if (handlePrintInvoice) handlePrintInvoice(orderSuccessModal);
                  setOrderSuccessModal(null);
                }}
                className="btn btn-secondary"
                style={{ padding: '10px', fontWeight: '700' }}
              >
                View / Print Full Invoice
              </button>

              <button 
                onClick={() => setOrderSuccessModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem', marginTop: '4px' }}
              >
                Close & Book Next Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
