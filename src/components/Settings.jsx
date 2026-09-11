import React, { useState } from 'react';
import { saveBusinessInfo, saveProduct, deleteProduct, setStorageData, formatCartonStock, pushLocalDataToCloud, fetchCloudData, clearAllSampleData, performFullSync } from '../utils/storage';
import { getSupabaseConfig, updateSupabaseCredentials, isSupabaseConnected, testSupabaseConnection } from '../utils/supabaseClient';
import { 
  Store, 
  Plus, 
  Save, 
  Trash2, 
  Boxes, 
  Edit3, 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  RefreshCw,
  PackageCheck,
  Cloud,
  UploadCloud,
  Database,
  Key,
  Globe
} from 'lucide-react';

export default function Settings({ business, products, refreshAllData, lang, changeLanguage, t }) {
  const [activeSubTab, setActiveSubTab] = useState('profile'); // 'profile', 'items', 'cloud', 'language'

  // Supabase State
  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseConfig());
  const [cloudSyncStatus, setCloudSyncStatus] = useState({ loading: false, msg: '' });

  // Settings Form State
  const [formData, setFormData] = useState(business || {});

  // Add/Edit Product Modal State
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState(null);

  const initialProdState = {
    name: '',
    category: 'Snacks & Wafers',
    brand: '',
    sku: '',
    hsn: '19059040',
    mrp: '',
    salePrice: '',
    purchasePrice: '',
    gstRate: 5,
    pcsPerCarton: 24,
    cartonsStock: '',
    loosePcsStock: '',
    currentStock: 0,
    unit: 'Pcs',
    minStockLimit: 10
  };

  const [prodFormData, setProdFormData] = useState(initialProdState);

  const handleSaveFirmProfile = (e) => {
    e.preventDefault();
    saveBusinessInfo(formData);
    refreshAllData();
    alert('✅ Distributor firm details saved successfully!');
  };

  const handleOpenAddProduct = () => {
    setEditingProd(null);
    setProdFormData({
      ...initialProdState,
      cartonsStock: 0,
      loosePcsStock: 0,
      currentStock: 0
    });
    setItemModalOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    setEditingProd(prod);
    const pcsPerCtn = Number(prod.pcsPerCarton) || 24;
    const stock = Number(prod.currentStock) || 0;
    const ctn = Math.floor(stock / pcsPerCtn);
    const loose = stock % pcsPerCtn;

    setProdFormData({
      ...prod,
      pcsPerCarton: pcsPerCtn,
      cartonsStock: ctn,
      loosePcsStock: loose,
      currentStock: stock
    });
    setItemModalOpen(true);
  };

  const handleSaveProductForm = (e) => {
    e.preventDefault();
    const pcsPerCtn = Number(prodFormData.pcsPerCarton) || 24;
    const ctn = Number(prodFormData.cartonsStock) || 0;
    const loose = Number(prodFormData.loosePcsStock) || 0;
    const calculatedTotalStock = (ctn * pcsPerCtn) + loose;

    const payload = {
      ...prodFormData,
      mrp: Number(prodFormData.mrp) || 0,
      salePrice: Number(prodFormData.salePrice) || 0,
      purchasePrice: Number(prodFormData.purchasePrice) || 0,
      gstRate: Number(prodFormData.gstRate) || 0,
      pcsPerCarton: pcsPerCtn,
      currentStock: calculatedTotalStock > 0 ? calculatedTotalStock : (Number(prodFormData.currentStock) || 0),
      minStockLimit: Number(prodFormData.minStockLimit) || 5,
      sku: prodFormData.sku || `SKU-${Date.now().toString().slice(-6)}`
    };

    saveProduct(payload);
    refreshAllData();
    setItemModalOpen(false);
    setEditingProd(null);
    setProdFormData({
      ...initialProdState,
      cartonsStock: 0,
      loosePcsStock: 0,
      currentStock: 0
    });
  };

  const handleDeleteItem = (id, name) => {
    if (window.confirm(`Are you sure you want to delete '${name}' from inventory?`)) {
      deleteProduct(id);
      refreshAllData();
    }
  };

  const handleClearSampleProducts = () => {
    if (window.confirm('⚠️ Are you sure you want to clear all demo data (Products, Retailers, Invoices) and start fresh?')) {
      clearAllSampleData();
      refreshAllData();
      alert('🗑️ All demo products, retailers, and invoice data have been cleared successfully!');
    }
  };

  const handleTestConnection = async () => {
    setCloudSyncStatus({ loading: true, msg: 'Testing Supabase Cloud DB Connection...' });
    const res = await testSupabaseConnection();
    setCloudSyncStatus({ loading: false, msg: res.message });
    if (res.success) {
      alert('🎉 ' + res.message);
    } else {
      alert('⚠️ ' + res.message);
    }
  };

  const handleSaveSupabaseConfig = async (e) => {
    e.preventDefault();
    updateSupabaseCredentials(supabaseConfig.url, supabaseConfig.key);
    setCloudSyncStatus({ loading: true, msg: 'Saving & Syncing Cloud Database...' });
    const syncRes = await performFullSync();
    refreshAllData();
    setCloudSyncStatus({ loading: false, msg: syncRes.message });
    alert('✅ Supabase Cloud DB credentials updated and synced successfully!');
  };

  const handlePushToCloud = async () => {
    setCloudSyncStatus({ loading: true, msg: 'Syncing local data to Supabase Cloud Database...' });
    const res = await pushLocalDataToCloud();
    setCloudSyncStatus({ loading: false, msg: res.message });
    if (res.success) {
      alert('🎉 ' + res.message);
      refreshAllData();
    } else {
      alert('⚠️ ' + res.message);
    }
  };

  const handlePullFromCloud = async () => {
    setCloudSyncStatus({ loading: true, msg: 'Pulling latest data from Supabase Cloud Database...' });
    const ok = await fetchCloudData();
    setCloudSyncStatus({ loading: false, msg: ok ? 'Successfully pulled Cloud DB data!' : 'Failed to pull Cloud DB data.' });
    if (ok) {
      alert('✅ All data synced from cloud database successfully!');
      refreshAllData();
    } else {
      alert('⚠️ Cloud sync failed. Please check your Supabase URL & Key.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
      
      {/* Sub Navigation Bar inside Settings */}
      <div className="glass-card" style={{ padding: '8px 12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveSubTab('profile')}
          className={`btn btn-sm ${activeSubTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          <Store size={16} />
          <span>Firm Profile</span>
        </button>

        <button 
          onClick={() => setActiveSubTab('items')}
          className={`btn btn-sm ${activeSubTab === 'items' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          <Boxes size={16} />
          <span>Manage Items</span>
        </button>

      </div>

      {/* SUB-TAB 1: Firm Settings */}
      {activeSubTab === 'profile' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Store size={24} color="var(--primary)" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Distributor Firm Profile</h2>
            </div>
          </div>

          <form onSubmit={handleSaveFirmProfile}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Distributor / Firm Name *</label>
                <input 
                  type="text" 
                  className="input-field"
                  required
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Owner / Proprietor Name</label>
                <input 
                  type="text" 
                  className="input-field"
                  value={formData.proprietor || ''} 
                  onChange={e => setFormData({...formData, proprietor: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">GSTIN Number *</label>
                <input 
                  type="text" 
                  className="input-field"
                  required
                  value={formData.gstin || ''} 
                  onChange={e => setFormData({...formData, gstin: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile / Phone Number *</label>
                <input 
                  type="text" 
                  className="input-field"
                  required
                  value={formData.phone || ''} 
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Firm Email ID</label>
                <input 
                  type="email" 
                  className="input-field"
                  placeholder="sales@distributor.com"
                  value={formData.email || ''} 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Distributor Address</label>
                <textarea 
                  rows={2}
                  className="input-field"
                  value={formData.address || ''} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <input 
                  type="text" 
                  className="input-field"
                  value={formData.bankName || ''} 
                  onChange={e => setFormData({...formData, bankName: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input 
                  type="text" 
                  className="input-field"
                  value={formData.accountNo || ''} 
                  onChange={e => setFormData({...formData, accountNo: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">IFSC Code</label>
                <input 
                  type="text" 
                  className="input-field"
                  value={formData.ifsc || ''} 
                  onChange={e => setFormData({...formData, ifsc: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Invoice Prefix</label>
                <input 
                  type="text" 
                  className="input-field"
                  value={formData.invoicePrefix || ''} 
                  onChange={e => setFormData({...formData, invoicePrefix: e.target.value})}
                />
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ gap: '8px' }}>
                <Save size={18} />
                <span>Save Profile</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-TAB 2: Add Custom Items */}
      {activeSubTab === 'items' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>
                📦 Manage Products
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Manage and update FMCG products, pricing, and carton packing.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleOpenAddProduct}
                className="btn btn-primary"
                style={{ gap: '6px' }}
              >
                <Plus size={18} />
                <span>Add Item (+)</span>
              </button>
            </div>
          </div>

          {/* Current Products Table */}
          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
              <PackageCheck size={48} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '6px' }}>Your Inventory List is Empty</h3>
              <p style={{ fontSize: '0.86rem', marginBottom: '16px' }}>
                Click the <strong>'Add Item (+)'</strong> button above to add products.
              </p>
              <button onClick={handleOpenAddProduct} className="btn btn-primary">
                Add First Product (+)
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px' }}>Product Name</th>
                    <th style={{ padding: '10px' }}>Category</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>MRP (₹)</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Sale Price (₹)</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Current Stock</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(prod => (
                    <tr key={prod.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                        {prod.name}
                        {prod.sku && <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>SKU: {prod.sku}</div>}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{prod.category || 'General'}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{prod.mrp}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                        ₹{prod.salePrice}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span className={`badge ${prod.currentStock <= prod.minStockLimit ? 'badge-danger' : 'badge-success'}`}>
                          {formatCartonStock(prod.currentStock, prod.pcsPerCarton)}
                        </span>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          ({prod.currentStock} Pcs • {prod.pcsPerCarton || 24} Pcs/Ctn)
                        </div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button 
                            onClick={() => handleOpenEditProduct(prod)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px' }}
                            title="Edit Product"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteItem(prod.id, prod.name)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', color: '#f87171' }}
                            title="Delete Product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB 3: Cloud Database (Supabase) */}
      {activeSubTab === 'cloud' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={24} color="var(--primary)" />
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>☁️ Cloud Database Settings (Supabase Cloud DB)</h2>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Keep your stock, invoices, and retailer balances synchronized 24x7 on cloud database.
                </p>
              </div>
            </div>

            <span className={`badge ${isSupabaseConnected() ? 'badge-success' : 'badge-warning'}`} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
              {isSupabaseConnected() ? '✅ Online Cloud DB Connected' : '⚡ Offline Mode (Local DB Active)'}
            </span>
          </div>

          {/* Realtime Sync Status Banner */}
          <div style={{ marginBottom: '20px', padding: '14px 18px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ fontSize: '0.96rem', fontWeight: '700', color: '#047857' }}>
                ⚡ Real-Time Auto-Sync Active
              </h4>
              <p style={{ fontSize: '0.82rem', color: '#065f46', marginTop: '2px' }}>
                Whenever you create an invoice, update stock, or add a retailer, data automatically syncs with Supabase Cloud DB.
              </p>
            </div>
            
            <button 
              onClick={handleClearSampleProducts}
              className="btn btn-secondary btn-sm"
              style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', gap: '6px' }}
            >
              <Trash2 size={15} />
              <span>🗑️ Clear All Demo Data</span>
            </button>
          </div>

          {/* Sync Actions Bar (Backup / Restore) */}
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ fontSize: '0.96rem', fontWeight: '700', color: 'var(--text-main)' }}>
                🔄 1-Click Manual Backup & Restore
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                In addition to auto-sync, you can push or pull a complete backup of your data to the cloud at any time.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handlePushToCloud}
                className="btn btn-primary btn-sm"
                style={{ gap: '6px' }}
                disabled={cloudSyncStatus.loading}
              >
                <UploadCloud size={16} />
                <span>Upload Local Data to Cloud DB</span>
              </button>

              <button 
                onClick={handlePullFromCloud}
                className="btn btn-secondary btn-sm"
                style={{ gap: '6px' }}
                disabled={cloudSyncStatus.loading}
              >
                <RefreshCw size={16} className={cloudSyncStatus.loading ? 'spin' : ''} />
                <span>Download Cloud DB Data</span>
              </button>
            </div>
          </div>

          {cloudSyncStatus.msg && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#e0f2fe', color: '#0369a1', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
              {cloudSyncStatus.msg}
            </div>
          )}

          {/* Supabase Credentials Form */}
          <form onSubmit={handleSaveSupabaseConfig}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={16} color="var(--primary)" />
                  <span>Supabase Project URL</span>
                </label>
                <input 
                  type="url" 
                  className="input-field"
                  placeholder="e.g. https://your-project-id.supabase.co"
                  value={supabaseConfig.url} 
                  onChange={e => setSupabaseConfig({...supabaseConfig, url: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={16} color="#c2410c" />
                  <span>Supabase Anon / Public API Key</span>
                </label>
                <input 
                  type="password" 
                  className="input-field"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseConfig.key} 
                  onChange={e => setSupabaseConfig({...supabaseConfig, key: e.target.value})}
                />
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={handleTestConnection}
                className="btn btn-secondary" 
                style={{ gap: '8px' }}
                disabled={cloudSyncStatus.loading}
              >
                <RefreshCw size={16} className={cloudSyncStatus.loading ? 'spin' : ''} />
                <span>Test Connection</span>
              </button>
              <button type="submit" className="btn btn-primary" style={{ gap: '8px' }} disabled={cloudSyncStatus.loading}>
                <Save size={18} />
                <span>Save Credentials</span>
              </button>
            </div>
          </form>

          {/* Supabase SQL Instructions */}
          <div style={{ marginTop: '24px', padding: '16px', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#c2410c', marginBottom: '6px' }}>
              📖 Supabase Setup Instructions (2-Min Setup)
            </h4>
            <ol style={{ fontSize: '0.84rem', color: 'var(--text-muted)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Create a free project at [supabase.com](https://supabase.com).</li>
              <li>Copy <strong>Project URL</strong> and <strong>anon key</strong> from Project Settings → API and paste above.</li>
              <li>Run the SQL script from <code>supabase_schema.sql</code> in the Supabase SQL Editor.</li>
            </ol>
          </div>

        </div>
      )}

      {/* Add / Edit Product Modal */}
      {itemModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>
                {editingProd ? '✏️ Edit Product Details' : '📦 Add New Product'}
              </h3>
              <button 
                onClick={() => setItemModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProductForm}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Product Name *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="e.g. Lays Wafers / Dairy Milk Chocolate / Good Day Biscuit"
                    value={prodFormData.name}
                    onChange={e => setProdFormData({...prodFormData, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select 
                    className="input-field select-field"
                    value={prodFormData.category}
                    onChange={e => setProdFormData({...prodFormData, category: e.target.value})}
                  >
                    <option value="Snacks & Wafers">Snacks & Wafers</option>
                    <option value="Chocolates & Confectionery">Chocolates & Confectionery</option>
                    <option value="Biscuits & Bakery">Biscuits & Bakery</option>
                    <option value="Cold Drinks & Beverages">Cold Drinks & Beverages</option>
                    <option value="Personal Care & Soaps">Personal Care & Soaps</option>
                    <option value="General FMCG Grocery">General FMCG Grocery</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Brand / Company Name</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. PepsiCo / Cadbury / Parle / Britannia"
                    value={prodFormData.brand}
                    onChange={e => setProdFormData({...prodFormData, brand: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SKU / Item Code (Optional)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. WAF-LAY-20G"
                    value={prodFormData.sku}
                    onChange={e => setProdFormData({...prodFormData, sku: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">HSN Code</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. 19059040"
                    value={prodFormData.hsn}
                    onChange={e => setProdFormData({...prodFormData, hsn: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">MRP (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    required
                    placeholder="e.g. 20"
                    value={prodFormData.mrp}
                    onChange={e => setProdFormData({...prodFormData, mrp: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sale Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    required
                    placeholder="e.g. 17.5"
                    value={prodFormData.salePrice}
                    onChange={e => setProdFormData({...prodFormData, salePrice: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Purchase Price (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    placeholder="e.g. 15.0"
                    value={prodFormData.purchasePrice}
                    onChange={e => setProdFormData({...prodFormData, purchasePrice: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GST Rate (%)</label>
                  <select 
                    className="input-field select-field"
                    value={prodFormData.gstRate}
                    onChange={e => setProdFormData({...prodFormData, gstRate: e.target.value})}
                  >
                    <option value="0">0% (GST Exempt)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Pieces Per Carton / Case *</label>
                  <input 
                    type="number" 
                    min="1"
                    className="input-field"
                    required
                    placeholder="e.g. 24"
                    value={prodFormData.pcsPerCarton}
                    onChange={e => {
                      const val = e.target.value;
                      const pcs = val === '' ? '' : val;
                      const pcsNum = Number(val) || 0;
                      const ctn = Number(prodFormData.cartonsStock) || 0;
                      const loose = Number(prodFormData.loosePcsStock) || 0;
                      setProdFormData({
                        ...prodFormData,
                        pcsPerCarton: pcs,
                        currentStock: (ctn * pcsNum) + loose
                      });
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <select 
                    className="input-field select-field"
                    value={prodFormData.unit}
                    onChange={e => setProdFormData({...prodFormData, unit: e.target.value})}
                  >
                    <option value="Pcs">Pcs (Pieces)</option>
                    <option value="Box">Box</option>
                    <option value="Pack">Pack</option>
                    <option value="Carton">Carton / Case</option>
                    <option value="Kg">Kg (Kilograms)</option>
                  </select>
                </div>

                {/* Carton & Loose Pieces Input Section */}
                <div className="form-group" style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label className="form-label" style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                    📦 Initial Stock Entry (Cartons & Loose Pieces)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cartons / Cases</label>
                      <input 
                        type="number" 
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={prodFormData.cartonsStock}
                        onChange={e => {
                          const val = e.target.value;
                          const ctn = val === '' ? '' : val;
                          const ctnNum = Number(val) || 0;
                          const pcsPerCtn = Number(prodFormData.pcsPerCarton) || 24;
                          const loose = Number(prodFormData.loosePcsStock) || 0;
                          setProdFormData({
                            ...prodFormData,
                            cartonsStock: ctn,
                            currentStock: (ctnNum * pcsPerCtn) + loose
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loose Pieces</label>
                      <input 
                        type="number" 
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={prodFormData.loosePcsStock}
                        onChange={e => {
                          const val = e.target.value;
                          const loose = val === '' ? '' : val;
                          const looseNum = Number(val) || 0;
                          const pcsPerCtn = Number(prodFormData.pcsPerCarton) || 24;
                          const ctn = Number(prodFormData.cartonsStock) || 0;
                          setProdFormData({
                            ...prodFormData,
                            loosePcsStock: loose,
                            currentStock: (ctn * pcsPerCtn) + looseNum
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total Stock (Units)</label>
                      <input 
                        type="number" 
                        className="input-field"
                        readOnly
                        style={{ background: 'rgba(255,255,255,0.06)', fontWeight: '800', color: 'var(--primary)' }}
                        value={prodFormData.currentStock}
                      />
                    </div>
                  </div>
                </div>

              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setItemModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '6px' }}>
                  <Save size={16} />
                  <span>Save Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
