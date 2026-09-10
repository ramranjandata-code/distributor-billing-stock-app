import React, { useState } from 'react';
import { 
  saveProduct, 
  deleteProduct, 
  updateProductStock, 
  formatCartonStock, 
  fetchWarehouses, 
  transferStockBetweenWarehouses, 
  logAuditAction 
} from '../utils/storage';
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
  Tag,
  ArrowLeftRight,
  FileSpreadsheet,
  Calendar,
  Building2,
  Clock,
  ShieldAlert,
  UploadCloud,
  CheckCircle,
  Sparkles,
  Layers
} from 'lucide-react';

export default function Inventory({ products, refreshAllData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [expiryFilter, setExpiryFilter] = useState('ALL'); // 'ALL', 'EXPIRING_SOON', 'EXPIRED'
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Warehouses
  const warehouses = fetchWarehouses();

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const [stockInModalOpen, setStockInModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState(null);
  const [stockInCartons, setStockInCartons] = useState('');
  const [stockInLoosePcs, setStockInLoosePcs] = useState('');
  const [stockInReason, setStockInReason] = useState('Purchase Receipt');

  // Inter-Warehouse Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    productId: '',
    fromWarehouseId: warehouses[0]?.id || 'wh_main',
    toWarehouseId: warehouses[1]?.id || 'wh_store',
    qty: '',
    reason: 'Stock Replenishment'
  });

  // Photo-to-Purchase & Excel/CSV Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [parsedImportItems, setParsedImportItems] = useState([]);
  const [importFileName, setImportFileName] = useState('');

  // Product Form Initial State
  const initialForm = {
    name: '',
    category: 'Staples & Grocery',
    brand: '',
    sku: '',
    hsn: '19053100',
    batchNo: '',
    expiryDate: '',
    mfgDate: '',
    warehouseId: warehouses[0]?.id || 'wh_main',
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

  // Helper: check expiry status
  const getExpiryStatus = (expDate) => {
    if (!expDate) return { status: 'HEALTHY', daysLeft: 999 };
    const exp = new Date(expDate);
    if (isNaN(exp.getTime())) return { status: 'HEALTHY', daysLeft: 999 };
    const now = new Date();
    const diffTime = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'EXPIRED', daysLeft: diffDays };
    if (diffDays <= 45) return { status: 'EXPIRING_SOON', daysLeft: diffDays };
    return { status: 'HEALTHY', daysLeft: diffDays };
  };

  // Filtering
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.batchNo && p.batchNo.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesWarehouse = warehouseFilter === 'ALL' || (p.warehouseId || 'wh_main') === warehouseFilter;
    const matchesLowStock = !showLowStockOnly || p.currentStock <= (p.minStockLimit || 10);
    
    const expInfo = getExpiryStatus(p.expiryDate);
    let matchesExpiry = true;
    if (expiryFilter === 'EXPIRING_SOON') matchesExpiry = expInfo.status === 'EXPIRING_SOON';
    if (expiryFilter === 'EXPIRED') matchesExpiry = expInfo.status === 'EXPIRED';

    return matchesSearch && matchesCategory && matchesWarehouse && matchesLowStock && matchesExpiry;
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

  // Inter-Warehouse Transfer Handler
  const handleTransferStock = (e) => {
    e.preventDefault();
    if (!transferForm.productId || !transferForm.qty || Number(transferForm.qty) <= 0) {
      alert('Please select a product and enter a valid quantity.');
      return;
    }
    if (transferForm.fromWarehouseId === transferForm.toWarehouseId) {
      alert('Origin and destination warehouses must be different.');
      return;
    }
    const res = transferStockBetweenWarehouses(
      transferForm.productId,
      transferForm.fromWarehouseId,
      transferForm.toWarehouseId,
      Number(transferForm.qty),
      transferForm.reason
    );
    alert(res.message);
    if (res.success) {
      refreshAllData();
      setTransferModalOpen(false);
      setTransferForm({
        productId: '',
        fromWarehouseId: warehouses[0]?.id || 'wh_main',
        toWarehouseId: warehouses[1]?.id || 'wh_store',
        qty: '',
        reason: 'Stock Replenishment'
      });
    }
  };

  // Photo-to-Purchase & Excel/CSV Parsing Handler
  const handleParseImport = () => {
    if (!importRawText.trim()) {
      alert('Please enter or paste CSV/spreadsheet lines.');
      return;
    }

    const lines = importRawText.trim().split('\n');
    const parsed = [];

    lines.forEach((line, idx) => {
      if (!line.trim()) return;
      const parts = line.includes(',') ? line.split(',') : line.split('\t');
      if (parts.length >= 2) {
        const name = parts[0]?.trim();
        // Skip header row
        if (idx === 0 && (name.toLowerCase().includes('item') || name.toLowerCase().includes('name') || name.toLowerCase().includes('product'))) {
          return;
        }
        const qty = parseInt(parts[1]) || 12;
        const rate = parseFloat(parts[2]) || 120;
        const mrp = parseFloat(parts[3]) || (rate * 1.25);
        const batch = parts[4]?.trim() || ('LOT-' + Math.floor(1000 + Math.random() * 9000));
        const exp = parts[5]?.trim() || '';

        parsed.push({
          id: 'imp_' + idx + '_' + Date.now(),
          name,
          qty,
          purchasePrice: rate,
          salePrice: Math.round(rate * 1.15),
          mrp: Math.round(mrp),
          batchNo: batch,
          expiryDate: exp,
          gstRate: 5,
          pcsPerCarton: 24
        });
      }
    });

    if (parsed.length === 0) {
      alert('Could not detect product rows. Expected format: Item Name, Quantity, Purchase Rate, MRP, Batch, Expiry');
      return;
    }

    setParsedImportItems(parsed);
  };

  // Sample CSV generator for testing
  const loadSampleCsvData = () => {
    const sample = `Item Name, Quantity, Purchase Rate, MRP, Batch, Expiry
Britannia Good Day Butter 100g, 48, 22.50, 30.00, LOT-GD-2026, 2027-02-28
Parle-G Gold Biscuits 200g, 60, 18.00, 25.00, LOT-PG-2026, 2026-11-30
Tata Salt Vacuum Evaporated 1kg, 30, 20.00, 28.00, LOT-TS-2026, 2028-06-30
Fortune Sunlite Refined Oil 1L, 24, 115.00, 140.00, LOT-FO-2026, 2027-05-15`;
    setImportRawText(sample);
  };

  const handleCommitImport = () => {
    if (parsedImportItems.length === 0) return;

    parsedImportItems.forEach(item => {
      const existing = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
      if (existing) {
        updateProductStock(existing.id, item.qty, 'Bulk Purchase Bill Import');
      } else {
        saveProduct({
          ...initialForm,
          name: item.name,
          sku: 'SKU-' + item.name.substring(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900),
          brand: 'Standard',
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          mrp: item.mrp,
          currentStock: item.qty,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          gstRate: item.gstRate || 5
        });
      }
    });

    logAuditAction('PURCHASE_BILL_IMPORT', 'Inventory & Stock', `Bulk imported ${parsedImportItems.length} products from purchase bill / spreadsheet`);
    refreshAllData();
    alert(`✅ Successfully imported ${parsedImportItems.length} items into inventory!`);
    setImportModalOpen(false);
    setParsedImportItems([]);
    setImportRawText('');
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

            {/* Warehouse Filter */}
            <select 
              className="input-field select-field" 
              style={{ width: 'auto' }}
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
            >
              <option value="ALL">सभी गोदाम (All Warehouses)</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>

            {/* Expiry Filter */}
            <select 
              className="input-field select-field" 
              style={{ width: 'auto' }}
              value={expiryFilter}
              onChange={e => setExpiryFilter(e.target.value)}
            >
              <option value="ALL">सभी एक्सपायरी (All Expiry)</option>
              <option value="EXPIRING_SOON">⚠️ Expiring Soon (≤ 45 Days)</option>
              <option value="EXPIRED">❌ Expired Stock Only</option>
            </select>

            <button 
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`btn ${showLowStockOnly ? 'btn-danger' : 'btn-secondary'}`}
              style={{ gap: '6px' }}
            >
              <AlertTriangle size={16} />
              <span>{showLowStockOnly ? 'सभी दिखाएँ' : 'कम स्टॉक'}</span>
            </button>

            <button 
              onClick={() => setTransferModalOpen(true)}
              className="btn btn-secondary"
              style={{ gap: '6px', fontWeight: '700' }}
            >
              <ArrowLeftRight size={16} color="#2563eb" />
              <span>Stock Transfer</span>
            </button>

            <button 
              onClick={() => setImportModalOpen(true)}
              className="btn btn-secondary"
              style={{ gap: '6px', fontWeight: '700', borderColor: '#059669', color: '#059669' }}
            >
              <FileSpreadsheet size={16} />
              <span>Import Bill (Excel/CSV/Photo)</span>
            </button>

            <button 
              onClick={handleOpenAddModal}
              className="btn btn-primary"
              style={{ gap: '6px', fontWeight: '700' }}
            >
              <Plus size={18} />
              <span>नया प्रोडक्ट (+)</span>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 10px' }}>प्रोडक्ट विवरण</th>
                <th style={{ padding: '12px 10px' }}>बैच & एक्सपायरी</th>
                <th style={{ padding: '12px 10px' }}>गोदाम (Location)</th>
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
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    कोई प्रोडक्ट नहीं मिला।
                  </td>
                </tr>
              ) : (
                filteredProducts.map(prod => {
                  const isLow = prod.currentStock <= (prod.minStockLimit || 10);
                  const expInfo = getExpiryStatus(prod.expiryDate);
                  const whObj = warehouses.find(w => w.id === prod.warehouseId) || warehouses[0];

                  return (
                    <tr key={prod.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{prod.name}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          ब्रांड: {prod.brand || 'N/A'} • SKU: <span style={{ color: 'var(--primary)' }}>{prod.sku}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.78rem' }}>{prod.batchNo || 'LOT-MAIN'}</div>
                        {prod.expiryDate ? (
                          <div style={{ marginTop: '3px' }}>
                            <span className={`badge ${expInfo.status === 'EXPIRED' ? 'badge-danger' : expInfo.status === 'EXPIRING_SOON' ? 'badge-warning' : 'badge-secondary'}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                              {expInfo.status === 'EXPIRED' ? `Expired (${prod.expiryDate})` : expInfo.status === 'EXPIRING_SOON' ? `Exp in ${expInfo.daysLeft}d` : `Exp: ${prod.expiryDate}`}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>N/A</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                          {whObj?.name || 'Main Godown'}
                        </span>
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
                            style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontWeight: '700' }}
                          >
                            <ArrowDownCircle size={14} />
                            <span>+ स्टॉक</span>
                          </button>

                          <button 
                            onClick={() => handleOpenEditModal(prod)}
                            className="btn btn-secondary btn-sm"
                            title="एडिट करें"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button 
                            onClick={() => handleDelete(prod.id, prod.name)}
                            className="btn btn-danger btn-sm"
                            title="डिलीट करें"
                          >
                            <Trash2 size={14} />
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
                      const val = e.target.value;
                      const pcs = val === '' ? '' : val;
                      const pcsNum = Number(val) || 0;
                      const ctn = Number(formData.cartonsStock) || 0;
                      const loose = Number(formData.loosePcsStock) || 0;
                      setFormData({
                        ...formData,
                        pcsPerCarton: pcs,
                        currentStock: (ctn * pcsNum) + loose
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
                          const val = e.target.value;
                          const ctn = val === '' ? '' : val;
                          const ctnNum = Number(val) || 0;
                          const pcsPerCtn = Number(formData.pcsPerCarton) || 24;
                          const loose = Number(formData.loosePcsStock) || 0;
                          setFormData({
                            ...formData,
                            cartonsStock: ctn,
                            currentStock: (ctnNum * pcsPerCtn) + loose
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
                          const val = e.target.value;
                          const loose = val === '' ? '' : val;
                          const looseNum = Number(val) || 0;
                          const pcsPerCtn = Number(formData.pcsPerCarton) || 24;
                          const ctn = Number(formData.cartonsStock) || 0;
                          setFormData({
                            ...formData,
                            loosePcsStock: loose,
                            currentStock: (ctn * pcsPerCtn) + looseNum
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

                {/* Batch No & Expiry Management */}
                <div className="form-group">
                  <label className="form-label">बैच नंबर (Batch / Lot No.)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. LOT-2026-B1"
                    value={formData.batchNo}
                    onChange={e => setFormData({...formData, batchNo: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">गोदाम / शाखा (Warehouse Location)</label>
                  <select 
                    className="input-field select-field"
                    value={formData.warehouseId}
                    onChange={e => setFormData({...formData, warehouseId: e.target.value})}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">निर्माण तिथि (Mfg Date)</label>
                  <input 
                    type="date" 
                    className="input-field"
                    value={formData.mfgDate}
                    onChange={e => setFormData({...formData, mfgDate: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">एक्सपायरी तिथि (Expiry Date)</label>
                  <input 
                    type="date" 
                    className="input-field"
                    value={formData.expiryDate}
                    onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">न्यूनतम लो-स्टॉक वार्निंग सीमा (Reorder / Min Stock Limit)</label>
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

      {/* MODAL: Inter-Warehouse Stock Transfer */}
      {transferModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '520px', padding: '24px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowLeftRight size={20} color="#2563eb" />
                <span>Inter-Warehouse Depot Stock Transfer</span>
              </h3>
              <button 
                onClick={() => setTransferModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleTransferStock} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              <div className="form-group">
                <label className="form-label">Select Product to Transfer *</label>
                <select 
                  className="input-field select-field"
                  value={transferForm.productId}
                  onChange={e => setTransferForm({ ...transferForm, productId: e.target.value })}
                  required
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Total Stock: {p.currentStock} {p.unit || 'Pcs'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">From Origin Warehouse *</label>
                  <select 
                    className="input-field select-field"
                    value={transferForm.fromWarehouseId}
                    onChange={e => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
                    required
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">To Destination Warehouse *</label>
                  <select 
                    className="input-field select-field"
                    value={transferForm.toWarehouseId}
                    onChange={e => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                    required
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Transfer Qty (Pcs) *</label>
                  <input 
                    type="number"
                    min="1"
                    className="input-field"
                    placeholder="e.g. 50"
                    value={transferForm.qty}
                    onChange={e => setTransferForm({ ...transferForm, qty: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Transfer Reason / Gate Pass Ref</label>
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="e.g. Counter demand / Gate Pass #102"
                    value={transferForm.reason}
                    onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setTransferModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: '700' }}>
                  Execute Stock Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Photo-to-Purchase & Excel/CSV Importer */}
      {importModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '780px', padding: '24px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <FileSpreadsheet size={22} color="#059669" />
                  <span>Photo-to-Purchase & Excel/CSV Bill Importer</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Eliminate manual typing: Paste invoice text, drop CSV/Excel files, or load invoice scan lines.
                </p>
              </div>
              <button 
                onClick={() => setImportModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>Input Purchase Invoice Lines or CSV:</span>
                <button 
                  type="button" 
                  onClick={loadSampleCsvData}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '0.74rem', padding: '4px 8px', color: '#059669', borderColor: '#10b981' }}
                >
                  Load Sample FMCG Bill
                </button>
              </div>

              <textarea 
                className="input-field"
                rows={5}
                placeholder="Paste CSV lines: Item Name, Quantity, Purchase Rate, MRP, Batch, Expiry&#10;e.g. Britannia 50-50 Biscuits, 48, 22.50, 30.00, LOT-5050, 2027-01-31"
                value={importRawText}
                onChange={e => setImportRawText(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Accepted format: comma or tab separated (Item, Qty, Rate, MRP, Batch, Exp)
                </div>
                <button 
                  onClick={handleParseImport}
                  className="btn btn-primary"
                  style={{ padding: '6px 16px', fontWeight: '700', fontSize: '0.84rem' }}
                >
                  Parse & Preview Items
                </button>
              </div>

              {/* Parsed Items Preview Table */}
              {parsedImportItems.length > 0 && (
                <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.88rem', color: '#059669' }}>
                      ✅ Ready to Import: {parsedImportItems.length} Products
                    </span>
                    <button 
                      onClick={handleCommitImport}
                      className="btn btn-primary"
                      style={{ padding: '6px 16px', fontWeight: '800', fontSize: '0.86rem', gap: '6px' }}
                    >
                      <CheckCircle size={16} />
                      <span>Commit & Add to Inventory</span>
                    </button>
                  </div>

                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '6px' }}>Item Name</th>
                          <th style={{ padding: '6px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Cost</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>MRP</th>
                          <th style={{ padding: '6px' }}>Batch</th>
                          <th style={{ padding: '6px' }}>Expiry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedImportItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px', fontWeight: '700' }}>{item.name}</td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>{item.qty} Pcs</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>₹{item.purchasePrice}</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>₹{item.mrp}</td>
                            <td style={{ padding: '6px' }}>{item.batchNo}</td>
                            <td style={{ padding: '6px' }}>{item.expiryDate || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button 
                type="button" 
                onClick={() => setImportModalOpen(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
