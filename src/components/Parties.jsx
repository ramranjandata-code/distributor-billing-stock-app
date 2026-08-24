import React, { useState } from 'react';
import { saveParty, updatePartyBalance } from '../utils/storage';
import { 
  Users, 
  Plus, 
  Search, 
  IndianRupee, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Edit3, 
  ArrowDownRight, 
  X, 
  Save, 
  FileText,
  CheckCircle2,
  List,
  LayoutGrid
} from 'lucide-react';

export default function Parties({ parties, invoices, refreshAllData, setActiveTab }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('horizontal'); // 'horizontal' or 'grid'
  
  // Modals
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPartyForPayment, setSelectedPartyForPayment] = useState(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('Payment Received');

  const initialForm = {
    name: '',
    contactPerson: '',
    phone: '',
    city: '',
    address: '',
    gstin: '',
    creditLimit: 50000,
    balance: 0
  };
  const [formData, setFormData] = useState(initialForm);

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm) ||
    (p.contactPerson && p.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalOutstanding = parties.reduce((sum, p) => sum + (p.balance || 0), 0);

  const handleOpenAdd = () => {
    setEditingParty(null);
    setFormData(initialForm);
    setPartyModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingParty(p);
    setFormData(p);
    setPartyModalOpen(true);
  };

  const handleSavePartyForm = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      creditLimit: Number(formData.creditLimit) || 0,
      balance: Number(formData.balance) || 0
    };
    saveParty(payload);
    refreshAllData();
    setPartyModalOpen(false);
  };

  const handleOpenCollectPayment = (p) => {
    setSelectedPartyForPayment(p);
    setReceivedAmount('');
    setPaymentModalOpen(true);
  };

  const handleSavePayment = (e) => {
    e.preventDefault();
    if (!selectedPartyForPayment || !receivedAmount || Number(receivedAmount) <= 0) return;

    // Deduct amount from balance (negative delta)
    updatePartyBalance(selectedPartyForPayment.id, -Math.abs(Number(receivedAmount)));
    refreshAllData();
    setPaymentModalOpen(false);
    alert(`₹${receivedAmount} की भुगतान प्रविष्टि सफलतापूर्वक दर्ज कर ली गई है!`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Header Card */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>
              👥 ग्राहक व रिटेलर खाता (Parties & Khata)
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              कुल बाज़ार बकाया (Total Market Outstanding): <strong style={{ color: '#c2410c', fontWeight: '800' }}>₹{totalOutstanding.toLocaleString('en-IN')}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* View Layout Toggle */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setViewMode('horizontal')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'horizontal' ? '#ffffff' : 'transparent',
                  color: viewMode === 'horizontal' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: viewMode === 'horizontal' ? '700' : '500',
                  boxShadow: viewMode === 'horizontal' ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.82rem'
                }}
                title="Horizontal List Layout"
              >
                <List size={16} />
                <span>Horizontal List</span>
              </button>

              <button 
                onClick={() => setViewMode('grid')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: viewMode === 'grid' ? '700' : '500',
                  boxShadow: viewMode === 'grid' ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.82rem'
                }}
                title="Grid Layout"
              >
                <LayoutGrid size={16} />
                <span>Grid</span>
              </button>
            </div>

            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text"
                className="input-field"
                placeholder="दुकान/नाम या फ़ोन नंबर से खोजें..."
                style={{ paddingLeft: '38px' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <button 
              onClick={handleOpenAdd}
              className="btn btn-primary"
              style={{ gap: '6px' }}
            >
              <Plus size={18} />
              <span>नया रिटेलर जोड़ें (+)</span>
            </button>
          </div>

        </div>
      </div>

      {/* Retailer Items Container */}
      {viewMode === 'horizontal' ? (
        /* HORIZONTAL LIST LAYOUT */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredParties.map(party => {
            const hasDebt = party.balance > 0;
            const partyInvoicesCount = invoices.filter(inv => inv.partyId === party.id).length;

            return (
              <div 
                key={party.id} 
                className="glass-card glass-card-interactive" 
                style={{ 
                  padding: '16px 20px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justify: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px' 
                }}
              >
                {/* Left: Shop Name & Contact Person */}
                <div style={{ minWidth: '240px', flex: '1 1 240px' }}>
                  <h4 style={{ fontSize: '1.08rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>
                    {party.name}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    <span>संपर्क: <strong style={{ color: 'var(--text-main)' }}>{party.contactPerson || 'N/A'}</strong></span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: '600' }}>
                      <Phone size={14} />
                      <span>{party.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Center: Address & GSTIN */}
                <div style={{ minWidth: '220px', flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {party.address && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} color="#c2410c" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                        {party.address}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                    <span>GSTIN: {party.gstin || 'Unregistered Retailer'}</span>
                  </div>
                </div>

                {/* Right: Balance Badge, Bills count & Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${hasDebt ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                      {hasDebt ? `बकाया: ₹${party.balance.toLocaleString('en-IN')}` : 'चुका दिया (No Debt)'}
                    </span>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                      कुल बिल: {partyInvoicesCount}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {hasDebt && (
                      <button 
                        onClick={() => handleOpenCollectPayment(party)}
                        className="btn btn-secondary btn-sm"
                        style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', gap: '4px', fontWeight: '700' }}
                      >
                        <ArrowDownRight size={14} />
                        <span>पेमेंट लें</span>
                      </button>
                    )}

                    <button 
                      onClick={() => handleOpenEdit(party)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '7px 10px' }}
                      title="एडिट करें"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* GRID LAYOUT */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredParties.map(party => {
            const hasDebt = party.balance > 0;
            const partyInvoicesCount = invoices.filter(inv => inv.partyId === party.id).length;

            return (
              <div 
                key={party.id} 
                className="glass-card glass-card-interactive" 
                style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  {/* Shop Name & Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: 1.3 }}>
                        {party.name}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        संपर्क: {party.contactPerson || 'N/A'}
                      </p>
                    </div>

                    <span className={`badge ${hasDebt ? 'badge-warning' : 'badge-success'}`}>
                      {hasDebt ? `बकाया: ₹${party.balance}` : 'चुका दिया (No Debt)'}
                    </span>
                  </div>

                  {/* Info List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', background: '#f8fafc', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={14} color="var(--primary)" />
                      <span>{party.phone || 'Phone missing'}</span>
                    </div>

                    {party.address && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={14} color="#c2410c" />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{party.address}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={14} color="var(--accent-cyan)" />
                      <span>GSTIN: {party.gstin || 'Unregistered Retailer'}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    कुल बिल: {partyInvoicesCount}
                  </span>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {hasDebt && (
                      <button 
                        onClick={() => handleOpenCollectPayment(party)}
                        className="btn btn-secondary btn-sm"
                        style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', gap: '4px', fontWeight: '700' }}
                      >
                        <ArrowDownRight size={14} />
                        <span>पेमेंट लें</span>
                      </button>
                    )}

                    <button 
                      onClick={() => handleOpenEdit(party)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 8px' }}
                      title="एडिट करें"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Retailer Modal */}
      {partyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>
                {editingParty ? '✏️ रिटेलर खाता अपडेट करें' : '👥 नया रिटेलर / ग्राहक जोड़ें'}
              </h3>
              <button 
                onClick={() => setPartyModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePartyForm}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">दुकान / रिटेलर का नाम (Shop Name) *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="उदा. गुप्ता किराना & जनरल स्टोर"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">दुकानदार / संपर्क व्यक्ति (Contact Person)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. रमाकांत गुप्ता"
                    value={formData.contactPerson}
                    onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">फ़ोन नंबर (Mobile No) *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="उदा. 9811223344"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">शहर / क्षेत्र (City / Area)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. रोहिणी, दिल्ली"
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GSTIN नंबर (यदि उपलब्ध हो)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. 07BAPPG4321A1Z2"
                    value={formData.gstin}
                    onChange={e => setFormData({...formData, gstin: e.target.value})}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">दुकान का पूरा पता (Address)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="उदा. शॉप नं 4, मेन मार्केट, रोहिणी सेक्टर 7"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">क्रेडिट लिमिट (Credit Limit ₹)</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={formData.creditLimit}
                    onChange={e => setFormData({...formData, creditLimit: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">प्रारंभिक बकाया / उधार (Opening Balance ₹)</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={formData.balance}
                    onChange={e => setFormData({...formData, balance: e.target.value})}
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

      {/* Payment Collection Entry Modal */}
      {paymentModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                💵 बकाया पेमेंट जमा करें (Payment Receipt)
              </h3>
              <button 
                onClick={() => setPaymentModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePayment}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px', padding: '14px', background: '#fff7ed', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                  <p style={{ fontWeight: '700', color: 'var(--text-main)' }}>{selectedPartyForPayment?.name}</p>
                  <p style={{ fontSize: '0.88rem', color: '#c2410c', marginTop: '2px', fontWeight: '600' }}>
                    वर्तमान कुल बकाया उधार: <strong>₹{selectedPartyForPayment?.balance}</strong>
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">प्राप्त हुई रकम (Received Amount ₹) *</label>
                  <input 
                    type="number" 
                    className="input-field"
                    required
                    min="1"
                    max={selectedPartyForPayment?.balance}
                    placeholder="उदा. 5000"
                    value={receivedAmount}
                    onChange={e => setReceivedAmount(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">भुगतान का माध्यम (Payment Mode)</label>
                  <select 
                    className="input-field select-field"
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                  >
                    <option value="Cash">नकद (Cash)</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Bank">बैंक ट्रांसफर / Cheque</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">विवरण (Remarks / Notes)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setPaymentModalOpen(false)}
                  className="btn btn-secondary"
                >
                  रद्द करें
                </button>
                <button type="submit" className="btn btn-primary">
                  भुगतान दर्ज करें (₹{receivedAmount || 0})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
