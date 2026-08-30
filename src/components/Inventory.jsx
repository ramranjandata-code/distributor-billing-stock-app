import React, { useState } from 'react';
import { saveProduct, deleteProduct, updateProductStock, formatCartonStock } from '../utils/storage';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  ArrowDownCircle, 
  Filter, 
  AlertTriangle,
  Boxes,
  X,
  Save,
  Tag
} from 'lucide-react';

export default function Inventory({ products, refreshAllData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const [stockInModalOpen, setStockInModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState(null);
  const [stockInCartons, setStockInCartons] = useState('');
  const [stockInLoosePcs, setStockInLoosePcs] = useState('');
  const [stockInReason, setStockInReason] = useState('Purchase Receipt');

  // Product Form Initial State
  const initialForm = {
    name: '',
    category: 'Staples & Grocery',
    brand: '',
    sku: '',
    hsn: '19053100',
    mrp: '',
    salePrice: '',
    purchasePrice: '',
    gstRate: 5,
    pcsPerCarton: 24,
    cartonsStock: '',
    loosePcsStock: '',
    currentStock: 0,
    unit: 'Pcs',
    minStockLimit: 15
  };
  const [formData, setFormData] = useState(initialForm);

  // Categories extraction
  const categories = ['ALL', ...new Set(products.map(p => p.category))];

  // Filtering
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesLowStock = !showLowStockOnly || p.currentStock <= (p.minStockLimit || 10);

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      ...initialForm,
      cartonsStock: 0,
      loosePcsStock: 0,
      currentStock: 0
    });
    setProductModalOpen(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    const pcsPerCtn = Number(prod.pcsPerCarton) || 24;
    const stock = Number(prod.currentStock) || 0;
    const ctn = Math.floor(stock / pcsPerCtn);
    const loose = stock % pcsPerCtn;

    setFormData({
      ...prod,
      pcsPerCarton: pcsPerCtn,
      cartonsStock: ctn,
      loosePcsStock: loose,
      currentStock: stock
    });
    setProductModalOpen(true);
  };

  const handleSaveProductForm = (e) => {
    e.preventDefault();
    const pcsPerCtn = Number(formData.pcsPerCarton) || 24;
    const ctn = Number(formData.cartonsStock) || 0;
    const loose = Number(formData.loosePcsStock) || 0;
    const calculatedTotalStock = (ctn * pcsPerCtn) + loose;

    const payload = {
      ...formData,
      mrp: Number(formData.mrp) || 0,
      salePrice: Number(formData.salePrice) || 0,
      purchasePrice: Number(formData.purchasePrice) || 0,
      gstRate: Number(formData.gstRate) || 0,
      pcsPerCarton: pcsPerCtn,
      currentStock: calculatedTotalStock > 0 ? calculatedTotalStock : (Number(formData.currentStock) || 0),
      minStockLimit: Number(formData.minStockLimit) || 10
    };

    saveProduct(payload);
    refreshAllData();
    setProductModalOpen(false);
    setEditingProduct(null);
    setFormData({
      ...initialForm,
      cartonsStock: 0,
      loosePcsStock: 0,
      currentStock: 0
    });
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`क्या आप '${name}' को डिलीट करना चाहते हैं?`)) {
      deleteProduct(id);
      refreshAllData();
    }
  };

  const handleOpenStockIn = (prod) => {
    setSelectedProductForStock(prod);
    setStockInCartons('');
    setStockInLoosePcs('');
    setStockInModalOpen(true);
  };

  const handleSaveStockIn = (e) => {
    e.preventDefault();
    if (!selectedProductForStock) return;
    const pcsPerCtn = Number(selectedProductForStock.pcsPerCarton) || 24;
    const ctnToAdd = Number(stockInCartons) || 0;
    const looseToAdd = Number(stockInLoosePcs) || 0;
    const totalPcsToAdd = (ctnToAdd * pcsPerCtn) + looseToAdd;

    if (totalPcsToAdd <= 0) return;

    updateProductStock(selectedProductForStock.id, totalPcsToAdd, stockInReason);
    refreshAllData();
    setStockInModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Filter & Action Bar */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text"
                className="input-field"
                placeholder="प्रोडक्ट का नाम, SKU या ब्रांड सर्च करें..."
                style={{ paddingLeft: '38px' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <select 
              className="input-field select-field" 
              style={{ width: 'auto' }}
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'सभी कैटेगरी (All Categories)' : cat}
                </option>
              ))}
            </select>

            <button 
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`btn ${showLowStockOnly ? 'btn-danger' : 'btn-secondary'}`}
              style={{ gap: '6px' }}
            >
              <AlertTriangle size={16} />
              <span>{showLowStockOnly ? 'सभी दिखाएँ' : 'केवल कम स्टॉक'}</span>
            </button>

            <button 
              onClick={handleOpenAddModal}
              className="btn btn-primary"
              style={{ gap: '6px' }}
            >
              <Plus size={18} />
              <span>नया प्रोडक्ट जोड़ें (+)</span>
            </button>
          </div>

        </div>
      </div>

      {/* Inventory Table Card */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>
            स्टॉक सूची ({filteredProducts.length} आइटम्स)
          </h3>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            कुल स्टॉक वैल्युएशन (Purchase Cost): ₹
            {filteredProducts.reduce((sum, p) => sum + (p.currentStock * p.purchasePrice), 0).toLocaleString('en-IN')}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 10px' }}>प्रोडक्ट विवरण</th>
                <th style={{ padding: '12px 10px' }}>कैटेगरी / HSN</th>
                <th style={{ padding: '12px 10px' }}>MRP</th>
                <th style={{ padding: '12px 10px' }}>बिक्री दर (Sale)</th>
                <th style={{ padding: '12px 10px' }}>खरीद दर (Cost)</th>
                <th style={{ padding: '12px 10px' }}>GST %</th>
                <th style={{ padding: '12px 10px' }}>वर्तमान स्टॉक</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>एक्शन</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    कोई प्रोडक्ट नहीं मिला।
                  </td>
                </tr>
              ) : (
                filteredProducts.map(prod => {
                  const isLow = prod.currentStock <= (prod.minStockLimit || 10);
                  return (
                    <tr key={prod.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{prod.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          ब्रांड: {prod.brand || 'N/A'} • SKU: <span style={{ color: 'var(--primary)' }}>{prod.sku}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div>{prod.category}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>HSN: {prod.hsn}</div>
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: '600' }}>₹{prod.mrp}</td>
                      <td style={{ padding: '12px 10px', fontWeight: '700', color: 'var(--primary)' }}>₹{prod.salePrice}</td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>₹{prod.purchasePrice}</td>
                      <td style={{ padding: '12px 10px' }}>{prod.gstRate}%</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                          {formatCartonStock(prod.currentStock, prod.pcsPerCarton)}
                        </span>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          कुल: {prod.currentStock} {prod.unit || 'Pcs'} ({prod.pcsPerCarton || 24} Pcs/Ctn)
                        </div>
                        {isLow && (
                          <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '2px', fontWeight: '700' }}>Low Warning</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button 
                            onClick={() => handleOpenStockIn(prod)}
                            className="btn btn-secondary btn-sm"
                            title="स्टॉक बढ़ाएं (Stock In)"
                            style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
                          >
                            <ArrowDownCircle size={15} />
                            <span>+ स्टॉक</span>
                          </button>

                          <button 
                            onClick={() => handleOpenEditModal(prod)}
                            className="btn btn-secondary btn-sm"
                            title="एडिट करें"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button 
                            onClick={() => handleDelete(prod.id, prod.name)}
                            className="btn btn-danger btn-sm"
                            title="डिलीट करें"
                          >
                            <Trash2 size={15} />
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

      {/* Add / Edit Product Modal */}
      {productModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>
                {editingProduct ? '✏️ प्रोडक्ट एडिट करें' : '📦 नया प्रोडक्ट जोड़ें'}
              </h3>
              <button 
                onClick={() => setProductModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProductForm}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">प्रोडक्ट का नाम (Product Name) *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="उदा. Parle-G Biscuit 100g Box"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">ब्रांड का नाम (Brand Name)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. Parle, Britannia, Tata"
                    value={formData.brand}
                    onChange={e => setFormData({...formData, brand: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">कैटेगरी (Category) *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="उदा. Biscuits, Edible Oils, Grocery"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SKU / बारकोड कोड *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="उदा. PRL-G-100G"
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">HSN कोड *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="उदा. 19053100"
                    value={formData.hsn}
                    onChange={e => setFormData({...formData, hsn: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">MRP (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    required
                    value={formData.mrp}
                    onChange={e => setFormData({...formData, mrp: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">बिक्री दर / Wholesaler Sale Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    required
                    value={formData.salePrice}
                    onChange={e => setFormData({...formData, salePrice: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">खरीद दर / Cost Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    required
                    value={formData.purchasePrice}
                    onChange={e => setFormData({...formData, purchasePrice: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GST दर (%) *</label>
                  <select 
                    className="input-field select-field"
                    value={formData.gstRate}
                    onChange={e => setFormData({...formData, gstRate: e.target.value})}
                  >
                    <option value={0}>0% (Tax Free)</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">1 कार्टन/बॉक्स में पीस (Pcs Per Carton) *</label>
                  <input 
                    type="number" 
                    min="1"
                    className="input-field"
                    required
                    placeholder="उदा. 24"
                    value={formData.pcsPerCarton}
                    onChange={e => {
                      const pcs = Math.max(1, Number(e.target.value) || 1);
                      const ctn = Number(formData.cartonsStock) || 0;
                      const loose = Number(formData.loosePcsStock) || 0;
                      setFormData({
                        ...formData,
                        pcsPerCarton: pcs,
                        currentStock: (ctn * pcs) + loose
                      });
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">स्टॉक इकाई (Unit) *</label>
                  <select 
                    className="input-field select-field"
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  >
                    <option value="Pcs">Pcs (नग)</option>
                    <option value="Box">Box (बॉक्स)</option>
                    <option value="Carton">Carton (कार्टन)</option>
                    <option value="Pack">Pack (पैकेट)</option>
                    <option value="Kg">Kg (किलो)</option>
                    <option value="Litre">Litre (लीटर)</option>
                  </select>
                </div>

                {/* Carton & Loose Pieces Stock Input Section */}
                <div className="form-group" style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label className="form-label" style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                    📦 शुरुआती स्टॉक विवरण (Carton & Loose Pieces Stock)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>कार्टन संख्या (Cartons)</label>
                      <input 
                        type="number" 
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={formData.cartonsStock}
                        onChange={e => {
                          const ctn = Number(e.target.value) || 0;
                          const pcsPerCtn = Number(formData.pcsPerCarton) || 24;
                          const loose = Number(formData.loosePcsStock) || 0;
                          setFormData({
                            ...formData,
                            cartonsStock: ctn,
                            currentStock: (ctn * pcsPerCtn) + loose
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>खुले पीस (Loose Pcs)</label>
                      <input 
                        type="number" 
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={formData.loosePcsStock}
                        onChange={e => {
                          const loose = Number(e.target.value) || 0;
                          const pcsPerCtn = Number(formData.pcsPerCarton) || 24;
                          const ctn = Number(formData.cartonsStock) || 0;
                          setFormData({
                            ...formData,
                            loosePcsStock: loose,
                            currentStock: (ctn * pcsPerCtn) + loose
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>कुल नग (Total Base Pcs)</label>
                      <input 
                        type="number" 
                        className="input-field"
                        readOnly
                        style={{ background: 'rgba(255,255,255,0.06)', fontWeight: '800', color: 'var(--primary)' }}
                        value={formData.currentStock}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">न्यूनतम लो-स्टॉक वार्निंग सीमा (Min Limit)</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={formData.minStockLimit}
                    onChange={e => setFormData({...formData, minStockLimit: e.target.value})}
                  />
                </div>

              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setProductModalOpen(false)}
                  className="btn btn-secondary"
                >
                  रद्द करें
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '6px' }}>
                  <Save size={16} />
                  <span>सेव करें (Save Product)</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Stock In / Purchase Receipt Entry Modal */}
      {stockInModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                📥 स्टॉक इन करें (Stock Entry)
              </h3>
              <button 
                onClick={() => setStockInModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStockIn}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                  <p style={{ fontWeight: '700', color: 'var(--text-main)' }}>{selectedProductForStock?.name}</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--primary)', marginTop: '4px', fontWeight: '600' }}>
                    मौजूदा स्टॉक: {formatCartonStock(selectedProductForStock?.currentStock, selectedProductForStock?.pcsPerCarton)} ({selectedProductForStock?.currentStock} Pcs)
                  </p>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Pack Size: {selectedProductForStock?.pcsPerCarton || 24} Pcs/Carton
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">कार्टन संख्या (Cartons Add)</label>
                    <input 
                      type="number" 
                      min="0"
                      className="input-field"
                      placeholder="उदा. 5 कार्टन"
                      value={stockInCartons}
                      onChange={e => setStockInCartons(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">खुले पीस (Loose Pcs Add)</label>
                    <input 
                      type="number" 
                      min="0"
                      className="input-field"
                      placeholder="उदा. 6 पीस"
                      value={stockInLoosePcs}
                      onChange={e => setStockInLoosePcs(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">विवरण / खरीद रसीद (Stock Notes)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. Factory Depot Supply Bill #889"
                    value={stockInReason}
                    onChange={e => setStockInReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setStockInModalOpen(false)}
                  className="btn btn-secondary"
                >
                  रद्द करें
                </button>
                <button type="submit" className="btn btn-primary">
                  स्टॉक अपडेट करें (+{((Number(stockInCartons) || 0) * (Number(selectedProductForStock?.pcsPerCarton) || 24)) + (Number(stockInLoosePcs) || 0)} Pcs)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
