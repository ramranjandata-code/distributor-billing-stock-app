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
    gstRate: 18,
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
    alert('✅ डिस्ट्रीब्यूटर फर्म डिटेल्स सफलतापूर्वक सेव हो गई हैं!');
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
    alert(`✅ '${payload.name}' सफलता से इन्वेंट्री में जुड़ गया!`);
  };

  const handleDeleteItem = (id, name) => {
    if (window.confirm(`क्या आप '${name}' को इन्वेंट्री से हटाना चाहते हैं?`)) {
      deleteProduct(id);
      refreshAllData();
    }
  };

  const handleClearSampleProducts = () => {
    if (window.confirm('⚠️ क्या आप सभी टेस्ट/सैंपल डेटा (Products, Retailers, Bills) को हटाकर बिल्कुल नया और साफ ऐप शुरू करना चाहते हैं?')) {
      clearAllSampleData();
      refreshAllData();
      alert('🗑️ सभी सैंपल प्रोडक्ट्स, रिटेलर्स एवं बिल डेटा पूरी तरह से डिलीट कर दिया गया है!');
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
    alert('✅ Supabase Cloud DB क्रेडेंशियल्स सफलतापूर्वक अपडेट और सिंक हो गए हैं!');
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
      alert('✅ ऑनलाइन क्लाउड डेटाबेस से सारा डेटा सिंक हो गया है!');
      refreshAllData();
    } else {
      alert('⚠️ क्लाउड सिंक नहीं हो सका। कृपया Supabase URL & Key की जांच करें।');
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
          <span>फर्म डिटेल्स (Firm Profile)</span>
        </button>

        <button 
          onClick={() => setActiveSubTab('items')}
          className={`btn btn-sm ${activeSubTab === 'items' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          <Boxes size={16} />
          <span>आइटम्स जोड़ें & प्रबंधित करें (Add Items)</span>
        </button>

        <button 
          onClick={() => setActiveSubTab('cloud')}
          className={`btn btn-sm ${activeSubTab === 'cloud' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          <Cloud size={16} />
          <span>☁️ {t('cloud_db_settings')}</span>
        </button>

        <button 
          onClick={() => setActiveSubTab('language')}
          className={`btn btn-sm ${activeSubTab === 'language' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          <Globe size={16} />
          <span>🌐 {t('app_language')}</span>
        </button>
      </div>

      {/* SUB-TAB 0: Language Selection */}
      {activeSubTab === 'language' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
            <Globe size={24} color="var(--primary)" />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>🌐 {t('app_language')}</h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                {t('select_language')}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div 
              onClick={() => changeLanguage('en')}
              style={{
                padding: '18px',
                borderRadius: '12px',
                border: lang === 'en' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                background: lang === 'en' ? '#ecfdf5' : '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>🇬🇧 English</h3>
                {lang === 'en' && <CheckCircle2 size={20} color="var(--primary-color)" />}
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                Default professional business language (Clean & Clear).
              </p>
            </div>

            <div 
              onClick={() => changeLanguage('hinglish')}
              style={{
                padding: '18px',
                borderRadius: '12px',
                border: lang === 'hinglish' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                background: lang === 'hinglish' ? '#ecfdf5' : '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>🇮🇳 Hinglish</h3>
                {lang === 'hinglish' && <CheckCircle2 size={20} color="var(--primary-color)" />}
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                Easy mix of Hindi & English words (Sabse simple aur aasan).
              </p>
            </div>

            <div 
              onClick={() => changeLanguage('hi')}
              style={{
                padding: '18px',
                borderRadius: '12px',
                border: lang === 'hi' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                background: lang === 'hi' ? '#ecfdf5' : '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>🇮🇳 हिंदी (Hindi)</h3>
                {lang === 'hi' && <CheckCircle2 size={20} color="var(--primary-color)" />}
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                शुद्ध हिंदी भाषा में सभी विवरण व रिपोर्ट।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 1: Firm Settings */}
      {activeSubTab === 'profile' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Store size={24} color="var(--primary)" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>डिस्ट्रीब्यूटर फर्म प्रोफ़ाइल (Firm Info)</h2>
            </div>
          </div>

          <form onSubmit={handleSaveFirmProfile}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">फर्म का नाम (Distributor Name) *</label>
                <input 
                  type="text" 
                  className="input-field"
                  required
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">प्रोप्राइटर का नाम (Owner Name)</label>
                <input 
                  type="text" 
                  className="input-field"
                  value={formData.proprietor || ''} 
                  onChange={e => setFormData({...formData, proprietor: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">GSTIN नंबर *</label>
                <input 
                  type="text" 
                  className="input-field"
                  required
                  value={formData.gstin || ''} 
                  onChange={e => setFormData({...formData, gstin: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">मोबाइल / फ़ोन नंबर *</label>
                <input 
                  type="text" 
                  className="input-field"
                  required
                  value={formData.phone || ''} 
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">पूरा पता (Distributor Address)</label>
                <textarea 
                  rows={2}
                  className="input-field"
                  value={formData.address || ''} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">बैंक का नाम (Bank Name)</label>
                <input 
                  type="text" 
                  className="input-field"
                  value={formData.bankName || ''} 
                  onChange={e => setFormData({...formData, bankName: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">खाता संख्या (Account Number)</label>
                <input 
                  type="text" 
                  className="input-field"
                  value={formData.accountNo || ''} 
                  onChange={e => setFormData({...formData, accountNo: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">IFSC कोड</label>
                <input 
                  type="text" 
                  className="input-field"
                  value={formData.ifsc || ''} 
                  onChange={e => setFormData({...formData, ifsc: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">इनवॉइस प्रिफिक्स (Invoice Prefix)</label>
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
                <span>प्रोफाइल सेव करें (Save Profile)</span>
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
                📦 अपने प्रोडक्ट्स जोड़ें (Add Your FMCG Items)
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                अपने बिकने वाले सामान (Wafers, Chocolates, Biscuits) यहाँ प्रबंधन व एडिट करें।
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleOpenAddProduct}
                className="btn btn-primary"
                style={{ gap: '6px' }}
              >
                <Plus size={18} />
                <span>नया आइटम जोड़ें (+ Add Item)</span>
              </button>
            </div>
          </div>

          {/* Current Products Table */}
          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
              <PackageCheck size={48} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '6px' }}>आपकी इन्वेंट्री लिस्ट खाली है</h3>
              <p style={{ fontSize: '0.86rem', marginBottom: '16px' }}>
                ऊपर दिए गए <strong>'नया आइटम जोड़ें (+ Add Item)'</strong> बटन पर क्लिक करके Wafers, Chocolate, Cold Drinks आदि जोड़ें।
              </p>
              <button onClick={handleOpenAddProduct} className="btn btn-primary">
                पहला प्रोडक्ट जोड़ें (+)
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px' }}>प्रोडक्ट का नाम</th>
                    <th style={{ padding: '10px' }}>कैटेगरी</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>MRP (₹)</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>बिक्री दर (₹)</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>वर्तमान स्टॉक</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>एक्शन</th>
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
                            title="एडिट करें"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteItem(prod.id, prod.name)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', color: '#f87171' }}
                            title="हटाएं"
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
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>☁️ क्लाउड डेटाबेस सेटिंग्स (Supabase Cloud DB)</h2>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  अपने स्टॉक, बिल और रिटेलर बकाया का डेटा 24x7 ऑनलाइन क्लाउड डेटाबेस पर रखें।
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
                ⚡ ऑटोमैटिक रीअल-टाइम सिंक एक्टिवेट है (Real-Time Auto-Sync Active)
              </h4>
              <p style={{ fontSize: '0.82rem', color: '#065f46', marginTop: '2px' }}>
                आप जब भी नया बिल बनाएंगे, स्टॉक अपडेट करेंगे या नया रिटेलर जोड़ेंगे, डेटा अपने-आप तुरंत Supabase Cloud DB में सेव हो जाएगा।
              </p>
            </div>
            
            <button 
              onClick={handleClearSampleProducts}
              className="btn btn-secondary btn-sm"
              style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', gap: '6px' }}
            >
              <Trash2 size={15} />
              <span>🗑️ डिलीट ऑल सैंपल डेटा (Clear All Demo Data)</span>
            </button>
          </div>

          {/* Sync Actions Bar (Backup / Restore) */}
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ fontSize: '0.96rem', fontWeight: '700', color: 'var(--text-main)' }}>
                🔄 1-क्लिक मैनुअल बैकअप व रिस्टोर (Manual Backup & Restore)
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                ऑटो-सिंक के अलावा यदि आप चाहें तो किसी भी समय 1-क्लिक में क्लाउड पर पूरा बैकअप भेज या डाउनलोड कर सकते हैं।
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
                  placeholder="उदा. https://your-project-id.supabase.co"
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
                <span>टेस्ट कनेक्शन (Test Connection)</span>
              </button>
              <button type="submit" className="btn btn-primary" style={{ gap: '8px' }} disabled={cloudSyncStatus.loading}>
                <Save size={18} />
                <span>क्रेडेंशियल्स सेव करें (Save Credentials)</span>
              </button>
            </div>
          </form>

          {/* Supabase SQL Instructions */}
          <div style={{ marginTop: '24px', padding: '16px', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#c2410c', marginBottom: '6px' }}>
              📖 Supabase Setup Instructions (2-Min Setup)
            </h4>
            <ol style={{ fontSize: '0.84rem', color: 'var(--text-muted)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>[supabase.com](https://supabase.com) पर मुफ़्त अकाउंट बनाकर New Project तैयार करें।</li>
              <li>Project Settings → API से <strong>Project URL</strong> और <strong>anon key</strong> कॉपी करके ऊपर पेस्ट करें।</li>
              <li>प्रोजेक्ट रूट में बनी फाइल <code>supabase_schema.sql</code> के कोड को Supabase SQL Editor में Run कर दें।</li>
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
                {editingProd ? '✏️ प्रोडक्ट की जानकारी एडिट करें' : '📦 नया प्रोडक्ट जोड़ें (Add New FMCG Item)'}
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
                  <label className="form-label">प्रोडक्ट का पूरा नाम (Item Name) *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="उदा. Lays Wafers / Dairy Milk Chocolate / Good Day Biscuit"
                    value={prodFormData.name}
                    onChange={e => setProdFormData({...prodFormData, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">कैटेगरी (Category)</label>
                  <select 
                    className="input-field select-field"
                    value={prodFormData.category}
                    onChange={e => setProdFormData({...prodFormData, category: e.target.value})}
                  >
                    <option value="Snacks & Wafers">Snacks & Wafers (वेफर्स व चिप्स)</option>
                    <option value="Chocolates & Confectionery">Chocolates & Confectionery (चॉकलेट व टॉफी)</option>
                    <option value="Biscuits & Bakery">Biscuits & Bakery (बिस्कुट व नमकीन)</option>
                    <option value="Cold Drinks & Beverages">Cold Drinks & Beverages (कोल्ड ड्रिंक्स व जूस)</option>
                    <option value="Personal Care & Soaps">Personal Care & Soaps (साबुन व शैम्पू)</option>
                    <option value="General FMCG Grocery">General FMCG Grocery (सामान्य किराना)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">ब्रांड / कंपनी नाम (Brand)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. PepsiCo / Cadbury / Parle / Britannia"
                    value={prodFormData.brand}
                    onChange={e => setProdFormData({...prodFormData, brand: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SKU / आइटम कोड (Optional)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. WAF-LAY-20G"
                    value={prodFormData.sku}
                    onChange={e => setProdFormData({...prodFormData, sku: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">HSN कोड</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. 19059040"
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
                    placeholder="उदा. 20"
                    value={prodFormData.mrp}
                    onChange={e => setProdFormData({...prodFormData, mrp: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">बिक्री दर (Sale Price ₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    required
                    placeholder="उदा. 17.5"
                    value={prodFormData.salePrice}
                    onChange={e => setProdFormData({...prodFormData, salePrice: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">खरीद दर (Purchase Price ₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    placeholder="उदा. 15.0"
                    value={prodFormData.purchasePrice}
                    onChange={e => setProdFormData({...prodFormData, purchasePrice: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GST दर (%)</label>
                  <select 
                    className="input-field select-field"
                    value={prodFormData.gstRate}
                    onChange={e => setProdFormData({...prodFormData, gstRate: e.target.value})}
                  >
                    <option value="0">0% (GST मुक्त)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">1 कार्टन/पेटी में पीस (Pcs Per Carton) *</label>
                  <input 
                    type="number" 
                    min="1"
                    className="input-field"
                    required
                    placeholder="उदा. 24"
                    value={prodFormData.pcsPerCarton}
                    onChange={e => {
                      const pcs = Math.max(1, Number(e.target.value) || 1);
                      const ctn = Number(prodFormData.cartonsStock) || 0;
                      const loose = Number(prodFormData.loosePcsStock) || 0;
                      setProdFormData({
                        ...prodFormData,
                        pcsPerCarton: pcs,
                        currentStock: (ctn * pcs) + loose
                      });
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">स्टॉक की इकाई (Unit)</label>
                  <select 
                    className="input-field select-field"
                    value={prodFormData.unit}
                    onChange={e => setProdFormData({...prodFormData, unit: e.target.value})}
                  >
                    <option value="Pcs">Pcs (पीस)</option>
                    <option value="Box">Box (बॉक्स / डिब्बा)</option>
                    <option value="Pack">Pack (पैकेट)</option>
                    <option value="Carton">Carton (पेटी / कार्टन)</option>
                    <option value="Kg">Kg (किग्रा)</option>
                  </select>
                </div>

                {/* Carton & Loose Pieces Input Section */}
                <div className="form-group" style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label className="form-label" style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                    📦 शुरुआती स्टॉक प्रविष्टि (Cartons & Loose Pcs Entry)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>कार्टन / पेटी (Cartons)</label>
                      <input 
                        type="number" 
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={prodFormData.cartonsStock}
                        onChange={e => {
                          const ctn = Number(e.target.value) || 0;
                          const pcsPerCtn = Number(prodFormData.pcsPerCarton) || 24;
                          const loose = Number(prodFormData.loosePcsStock) || 0;
                          setProdFormData({
                            ...prodFormData,
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
                        value={prodFormData.loosePcsStock}
                        onChange={e => {
                          const loose = Number(e.target.value) || 0;
                          const pcsPerCtn = Number(prodFormData.pcsPerCarton) || 24;
                          const ctn = Number(prodFormData.cartonsStock) || 0;
                          setProdFormData({
                            ...prodFormData,
                            loosePcsStock: loose,
                            currentStock: (ctn * pcsPerCtn) + loose
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>कुल नग (Total Stock)</label>
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
                  रद्द करें
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '6px' }}>
                  <Save size={16} />
                  <span>प्रोडक्ट सेव करें (Save Item)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
