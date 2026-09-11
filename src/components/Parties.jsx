import React, { useState, useMemo } from 'react';
import { 
  saveParty, 
  updatePartyBalance, 
  deleteParty, 
  fetchBusinessProfile, 
  fetchBankAccounts, 
  recordBankTransaction, 
  logAuditAction 
} from '../utils/storage';
import { buildWhatsAppUrl } from '../utils/qrUtils';
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
  LayoutGrid,
  Trash2,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  Send,
  Building2,
  Calendar,
  CreditCard
} from 'lucide-react';

export default function Parties({ parties, invoices, refreshAllData, setActiveTab }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('horizontal'); // 'horizontal' or 'grid'
  const [agingFilter, setAgingFilter] = useState('ALL'); // 'ALL', 'CURRENT', 'DUE_SOON', 'CRITICAL', 'ZERO', 'WITH_BALANCE'
  
  // Modals
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPartyForPayment, setSelectedPartyForPayment] = useState(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('Payment Received');
  const [autoSendWhatsAppReceipt, setAutoSendWhatsAppReceipt] = useState(true);

  // Udhar / Credit Entry Modal State
  const [udharModalOpen, setUdharModalOpen] = useState(false);
  const [selectedPartyForUdhar, setSelectedPartyForUdhar] = useState(null);
  const [udharAmount, setUdharAmount] = useState('');
  const [udharNotes, setUdharNotes] = useState('Manual Credit / Outstanding Balance');

  const business = fetchBusinessProfile();
  const bankAccounts = fetchBankAccounts();

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

  // Compute aging details for each party
  const partyAgingMap = useMemo(() => {
    const now = Date.now();
    const map = {};

    parties.forEach(p => {
      const partyInvs = (invoices || []).filter(inv => inv.partyId === p.id && Number(inv.balanceAmount) > 0);
      let oldestDays = 0;
      let bucket = 'CURRENT'; // 0-15

      if (partyInvs.length > 0) {
        partyInvs.forEach(inv => {
          const invDate = new Date(inv.date).getTime();
          const diffDays = Math.max(0, Math.floor((now - invDate) / (1000 * 60 * 60 * 24)));
          if (diffDays > oldestDays) oldestDays = diffDays;
        });
      } else if ((p.balance || 0) > 0) {
        oldestDays = 12;
      }

      if (oldestDays > 30) {
        bucket = 'CRITICAL';
      } else if (oldestDays > 15) {
        bucket = 'DUE_SOON';
      } else {
        bucket = 'CURRENT';
      }

      map[p.id] = {
        oldestDays,
        bucket,
        unpaidCount: partyInvs.length
      };
    });

    return map;
  }, [parties, invoices]);

  // Aging Summary Totals
  const agingStats = useMemo(() => {
    let currentTotal = 0;
    let currentCount = 0;
    let dueSoonTotal = 0;
    let dueSoonCount = 0;
    let criticalTotal = 0;
    let criticalCount = 0;

    parties.forEach(p => {
      const bal = Number(p.balance) || 0;
      if (bal <= 0) return;
      const info = partyAgingMap[p.id] || { bucket: 'CURRENT' };
      if (info.bucket === 'CRITICAL') {
        criticalTotal += bal;
        criticalCount++;
      } else if (info.bucket === 'DUE_SOON') {
        dueSoonTotal += bal;
        dueSoonCount++;
      } else {
        currentTotal += bal;
        currentCount++;
      }
    });

    return {
      currentTotal,
      currentCount,
      dueSoonTotal,
      dueSoonCount,
      criticalTotal,
      criticalCount
    };
  }, [parties, partyAgingMap]);

  const filteredParties = parties.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    const aging = partyAgingMap[p.id] || { bucket: 'CURRENT' };
    if (agingFilter === 'WITH_BALANCE') return (p.balance || 0) > 0;
    if (agingFilter === 'CURRENT') return (p.balance || 0) > 0 && aging.bucket === 'CURRENT';
    if (agingFilter === 'DUE_SOON') return (p.balance || 0) > 0 && aging.bucket === 'DUE_SOON';
    if (agingFilter === 'CRITICAL') return (p.balance || 0) > 0 && aging.bucket === 'CRITICAL';
    if (agingFilter === 'ZERO') return (p.balance || 0) <= 0;

    return true;
  });

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
    setReceivedAmount(p.balance ? String(p.balance) : '');
    setSelectedBankId(bankAccounts[0]?.id || '');
    setPaymentMode('Cash');
    setPaymentNotes('Full/Partial Collection');
    setPaymentModalOpen(true);
  };

  const handleSavePayment = (e) => {
    e.preventDefault();
    const amt = Number(receivedAmount);
    if (!selectedPartyForPayment || !amt || amt <= 0) return;

    updatePartyBalance(selectedPartyForPayment.id, -amt);

    if ((paymentMode === 'Bank' || paymentMode === 'UPI') && selectedBankId) {
      recordBankTransaction({
        bankAccountId: selectedBankId,
        partyId: selectedPartyForPayment.id,
        partyName: selectedPartyForPayment.name,
        type: 'CREDIT',
        amount: amt,
        referenceNo: paymentNotes || `${paymentMode} Collection`,
        notes: `Received from ${selectedPartyForPayment.name}`
      });
    }

    logAuditAction('PAYMENT_RECEIVED', `Collected ₹${amt} from ${selectedPartyForPayment.name} via ${paymentMode}`);
    refreshAllData();
    setPaymentModalOpen(false);

    if (autoSendWhatsAppReceipt && selectedPartyForPayment.phone) {
      const remainingBal = Math.max(0, (selectedPartyForPayment.balance || 0) - amt);
      const receiptMsg = `*PAYMENT RECEIPT*\n\n` +
        `Dear *${selectedPartyForPayment.name}*,\n` +
        `We have received your payment of *₹${amt.toLocaleString('en-IN')}* via ${paymentMode}.\n\n` +
        `• Remaining Outstanding Balance: *₹${remainingBal.toLocaleString('en-IN')}*\n` +
        `• Notes / Remarks: ${paymentNotes || 'Collection'}\n\n` +
        `Thank you for your business!\n*${business?.name || 'DistroPulse Agency'}*`;

      const url = buildWhatsAppUrl(selectedPartyForPayment.phone, receiptMsg);
      window.open(url, '_blank');
    }

    alert(`Payment entry of ₹${amt} recorded successfully!`);
  };

  const handleSendWhatsAppReminder = (party) => {
    const bal = party.balance || 0;
    if (bal <= 0) return;

    const aging = partyAgingMap[party.id];
    const daysText = aging?.oldestDays > 0 ? ` (overdue for ${aging.oldestDays} days)` : '';
    const bizName = business?.name || 'DistroPulse Distributor';
    const upi = business?.upiId || 'distropulse@icici';

    const msg = `*PAYMENT REMINDER*\n\n` +
      `Dear *${party.name}*,\n` +
      `Greetings from *${bizName}*.\n\n` +
      `Your current outstanding balance is: *₹${bal.toLocaleString('en-IN')}*${daysText}.\n\n` +
      `Kindly arrange payment to the account details below at your earliest convenience:\n` +
      `📲 *UPI ID:* ${upi}\n` +
      (business?.bankName ? `🏦 *Bank:* ${business.bankName} | A/c: ${business.accountNo || ''}\n` : '') +
      `\nPlease share a payment screenshot once paid to update your account ledger immediately.\n\n` +
      `Thank you!\n*${bizName}*`;

    logAuditAction('WHATSAPP_REMINDER_SENT', `Sent ₹${bal} payment reminder to ${party.name} (${party.phone})`);
    const url = buildWhatsAppUrl(party.phone, msg);
    window.open(url, '_blank');
  };

  const handleOpenAddUdhar = (p) => {
    setSelectedPartyForUdhar(p);
    setUdharAmount('');
    setUdharModalOpen(true);
  };

  const handleSaveUdhar = (e) => {
    e.preventDefault();
    if (!selectedPartyForUdhar || !udharAmount || Number(udharAmount) <= 0) return;

    updatePartyBalance(selectedPartyForUdhar.id, Math.abs(Number(udharAmount)));
    refreshAllData();
    setUdharModalOpen(false);
    alert(`New credit of ₹${udharAmount} recorded for ${selectedPartyForUdhar.name}!`);
  };

  const handleDeleteRetailer = (party) => {
    if (window.confirm(`Are you sure you want to delete retailer "${party.name}" from the system?`)) {
      deleteParty(party.id);
      refreshAllData();
      alert(`Retailer "${party.name}" deleted successfully!`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Header Card */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>
              👥 Customer & Retailer Accounts (Khata)
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Total Market Outstanding: <strong style={{ color: '#c2410c', fontWeight: '800' }}>₹{totalOutstanding.toLocaleString('en-IN')}</strong>
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
                placeholder="Search by store, name, or phone..."
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
              <span>Add Retailer (+)</span>
            </button>
          </div>

        </div>
      </div>

      {/* Pending Payment Aging Tracker Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #c2410c' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
            <span>Total Market Dues</span>
            <IndianRupee size={16} color="#c2410c" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#c2410c' }}>
            ₹{totalOutstanding.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Across {parties.filter(p => (p.balance || 0) > 0).length} active accounts
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
            <span>0 - 15 Days (Current Normal)</span>
            <Clock size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>
            ₹{agingStats.currentTotal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {agingStats.currentCount} parties in regular cycle
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
            <span>16 - 30 Days (Due Soon)</span>
            <AlertTriangle size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f59e0b' }}>
            ₹{agingStats.dueSoonTotal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {agingStats.dueSoonCount} parties need follow-up
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #dc2626' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dc2626', fontSize: '0.8rem', marginBottom: '4px', fontWeight: '700' }}>
            <span>30+ Days Critical Overdue</span>
            <AlertTriangle size={16} color="#dc2626" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#dc2626' }}>
            ₹{agingStats.criticalTotal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '4px', fontWeight: '600' }}>
            ⚠️ {agingStats.criticalCount} accounts urgent recovery
          </div>
        </div>
      </div>

      {/* Quick Aging Filter Bar */}
      <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', marginRight: '4px' }}>Due Filter:</span>
        <button 
          onClick={() => setAgingFilter('ALL')}
          className={`btn btn-sm ${agingFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
        >
          All ({parties.length})
        </button>
        <button 
          onClick={() => setAgingFilter('WITH_BALANCE')}
          className={`btn btn-sm ${agingFilter === 'WITH_BALANCE' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
        >
          Total Dues ({parties.filter(p => (p.balance || 0) > 0).length})
        </button>
        <button 
          onClick={() => setAgingFilter('CURRENT')}
          className={`btn btn-sm ${agingFilter === 'CURRENT' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '4px 10px', fontSize: '0.78rem', background: agingFilter === 'CURRENT' ? '#10b981' : undefined }}
        >
          0-15 Days ({agingStats.currentCount})
        </button>
        <button 
          onClick={() => setAgingFilter('DUE_SOON')}
          className={`btn btn-sm ${agingFilter === 'DUE_SOON' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '4px 10px', fontSize: '0.78rem', background: agingFilter === 'DUE_SOON' ? '#f59e0b' : undefined }}
        >
          16-30 Days ({agingStats.dueSoonCount})
        </button>
        <button 
          onClick={() => setAgingFilter('CRITICAL')}
          className={`btn btn-sm ${agingFilter === 'CRITICAL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '4px 10px', fontSize: '0.78rem', background: agingFilter === 'CRITICAL' ? '#dc2626' : undefined, color: agingFilter === 'CRITICAL' ? '#fff' : undefined }}
        >
          ⚠️ 30+ Days Overdue ({agingStats.criticalCount})
        </button>
        <button 
          onClick={() => setAgingFilter('ZERO')}
          className={`btn btn-sm ${agingFilter === 'ZERO' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
        >
          Zero Balance ({parties.filter(p => !p.balance || p.balance <= 0).length})
        </button>
      </div>

      {/* Retailer Items Container */}
      {viewMode === 'horizontal' ? (
        /* HORIZONTAL LIST LAYOUT */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredParties.map(party => {
            const hasDebt = (party.balance || 0) > 0;
            const partyInvoicesCount = invoices.filter(inv => inv.partyId === party.id).length;
            const agingInfo = partyAgingMap[party.id] || { oldestDays: 0, bucket: 'CURRENT' };

            return (
              <div 
                key={party.id} 
                className="glass-card glass-card-interactive" 
                style={{ 
                  padding: '16px 20px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  borderLeft: hasDebt ? (agingInfo.bucket === 'CRITICAL' ? '4px solid #dc2626' : agingInfo.bucket === 'DUE_SOON' ? '4px solid #f59e0b' : '4px solid #10b981') : '4px solid #cbd5e1'
                }}
              >
                {/* Left: Shop Name & Contact Person */}
                <div style={{ minWidth: '240px', flex: '1 1 240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '1.08rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                      {party.name}
                    </h4>
                    {hasDebt && agingInfo.bucket === 'CRITICAL' && (
                      <span className="badge badge-danger" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                        ⚠️ 30+d Overdue
                      </span>
                    )}
                    {hasDebt && agingInfo.bucket === 'DUE_SOON' && (
                      <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                        16-30d Due
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    <span>Contact: <strong style={{ color: 'var(--text-main)' }}>{party.contactPerson || 'N/A'}</strong></span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${hasDebt ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                      {hasDebt ? `Due: ₹${party.balance.toLocaleString('en-IN')}` : 'No Debt'}
                    </span>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Total Bills: {partyInvoicesCount} {hasDebt && agingInfo.oldestDays > 0 ? `• ${agingInfo.oldestDays} days` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* 1-Click WhatsApp Payment Recovery Reminder */}
                    {hasDebt && (
                      <button 
                        onClick={() => handleSendWhatsAppReminder(party)}
                        className="btn btn-sm"
                        style={{ background: '#25d366', color: '#ffffff', border: 'none', gap: '5px', fontWeight: '700', padding: '6px 10px', boxShadow: '0 2px 6px rgba(37, 211, 102, 0.3)' }}
                        title="1-Click WhatsApp Payment Reminder"
                      >
                        <Send size={13} />
                        <span>Reminder</span>
                      </button>
                    )}

                    {/* Add Udhar / Credit Entry Button */}
                    <button 
                      onClick={() => handleOpenAddUdhar(party)}
                      className="btn btn-secondary btn-sm"
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', gap: '4px', fontWeight: '700' }}
                      title="Add Manual Credit / Outstanding"
                    >
                      <ArrowUpRight size={14} />
                      <span>+ Credit</span>
                    </button>

                    {hasDebt && (
                      <button 
                        onClick={() => handleOpenCollectPayment(party)}
                        className="btn btn-secondary btn-sm"
                        style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', gap: '4px', fontWeight: '700' }}
                      >
                        <ArrowDownRight size={14} />
                        <span>Collect Pay</span>
                      </button>
                    )}

                    <button 
                      onClick={() => handleOpenEdit(party)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '7px 10px' }}
                      title="Edit Party"
                    >
                      <Edit3 size={14} />
                    </button>

                    <button 
                      onClick={() => handleDeleteRetailer(party)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '7px 10px', background: '#fff1f2', color: '#e11d48', borderColor: '#fecdd3' }}
                      title="Delete Retailer"
                    >
                      <Trash2 size={14} />
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
            const hasDebt = (party.balance || 0) > 0;
            const partyInvoicesCount = invoices.filter(inv => inv.partyId === party.id).length;
            const agingInfo = partyAgingMap[party.id] || { oldestDays: 0, bucket: 'CURRENT' };

            return (
              <div 
                key={party.id} 
                className="glass-card glass-card-interactive" 
                style={{ 
                  padding: '18px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  borderTop: hasDebt ? (agingInfo.bucket === 'CRITICAL' ? '4px solid #dc2626' : agingInfo.bucket === 'DUE_SOON' ? '4px solid #f59e0b' : '4px solid #10b981') : '4px solid #cbd5e1'
                }}
              >
                <div>
                  {/* Shop Name & Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: 1.3 }}>
                        {party.name}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Contact: {party.contactPerson || 'N/A'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span className={`badge ${hasDebt ? 'badge-warning' : 'badge-success'}`}>
                        {hasDebt ? `Due: ₹${party.balance}` : 'No Debt'}
                      </span>
                      {hasDebt && agingInfo.bucket === 'CRITICAL' && (
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                          ⚠️ 30+d Overdue
                        </span>
                      )}
                    </div>
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
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Total Bills: {partyInvoicesCount}
                  </span>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {/* 1-Click WhatsApp Payment Reminder */}
                    {hasDebt && (
                      <button 
                        onClick={() => handleSendWhatsAppReminder(party)}
                        className="btn btn-sm"
                        style={{ background: '#25d366', color: '#ffffff', border: 'none', gap: '4px', fontWeight: '700', padding: '5px 8px', fontSize: '0.74rem' }}
                        title="1-Click WhatsApp Payment Reminder"
                      >
                        <Send size={12} />
                        <span>Reminder</span>
                      </button>
                    )}

                    <button 
                      onClick={() => handleOpenAddUdhar(party)}
                      className="btn btn-secondary btn-sm"
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', gap: '4px', fontWeight: '700', padding: '5px 8px', fontSize: '0.75rem' }}
                      title="Add Manual Credit / Outstanding"
                    >
                      <ArrowUpRight size={13} />
                      <span>+ Credit</span>
                    </button>

                    {hasDebt && (
                      <button 
                        onClick={() => handleOpenCollectPayment(party)}
                        className="btn btn-secondary btn-sm"
                        style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', gap: '4px', fontWeight: '700', padding: '5px 8px', fontSize: '0.75rem' }}
                      >
                        <ArrowDownRight size={13} />
                        <span>Collect Pay</span>
                      </button>
                    )}

                    <button 
                      onClick={() => handleOpenEdit(party)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '5px 8px' }}
                      title="Edit Party"
                    >
                      <Edit3 size={13} />
                    </button>

                    <button 
                      onClick={() => handleDeleteRetailer(party)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '5px 8px', background: '#fff1f2', color: '#e11d48', borderColor: '#fecdd3' }}
                      title="Delete Retailer"
                    >
                      <Trash2 size={13} />
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
                {editingParty ? '✏️ Edit Retailer Account' : '👥 Add New Retailer / Customer'}
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
                  <label className="form-label">Shop / Retailer Name *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="e.g. Gupta Kirana & General Store"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Person / Owner</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. Ramakant Gupta"
                    value={formData.contactPerson}
                    onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number (Mobile) *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="e.g. 9811223344"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City / Area</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. Rohini, Delhi"
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GSTIN (If Available)</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. 07BAPPG4321A1Z2"
                    value={formData.gstin}
                    onChange={e => setFormData({...formData, gstin: e.target.value})}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Full Address</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. Shop No 4, Main Market, Sector 7"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Credit Limit (₹)</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={formData.creditLimit}
                    onChange={e => setFormData({...formData, creditLimit: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Opening Balance / Due (₹)</label>
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
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '6px' }}>
                  <Save size={16} />
                  <span>Save Party</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Udhar / Credit Entry Modal */}
      {udharModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowUpRight size={20} color="#dc2626" />
                <span>📝 Add Credit / Outstanding Balance</span>
              </h3>
              <button 
                onClick={() => setUdharModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUdhar}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px', padding: '14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <p style={{ fontWeight: '700', color: '#1e293b' }}>{selectedPartyForUdhar?.name}</p>
                  <p style={{ fontSize: '0.88rem', color: '#dc2626', marginTop: '2px', fontWeight: '600' }}>
                    Current Outstanding Due: <strong>₹{selectedPartyForUdhar?.balance?.toLocaleString('en-IN')}</strong>
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">New Credit / Due Amount (₹) *</label>
                  <input 
                    type="number" 
                    className="input-field"
                    required
                    min="1"
                    placeholder="e.g. 2500"
                    value={udharAmount}
                    onChange={e => setUdharAmount(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Remarks / Notes</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. Pending bill dues / goods on credit"
                    value={udharNotes}
                    onChange={e => setUdharNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setUdharModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                >
                  Add Credit (+ ₹{udharAmount || 0})
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
                💵 Record Payment Receipt
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
                    Current Total Outstanding Due: <strong>₹{selectedPartyForPayment?.balance}</strong>
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Received Amount (₹) *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    required
                    min="1"
                    max={selectedPartyForPayment?.balance}
                    placeholder="e.g. 5000"
                    value={receivedAmount}
                    onChange={e => setReceivedAmount(e.target.value)}
                  />
                </div>

                {/* Quick Preset Buttons */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Quick Amounts:</span>
                  {[500, 1000, 2000, 5000].filter(a => a <= (selectedPartyForPayment?.balance || 0)).map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setReceivedAmount(String(amt))}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                    >
                      ₹{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setReceivedAmount(String(selectedPartyForPayment?.balance || 0))}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', fontSize: '0.74rem', fontWeight: '700', color: '#059669', borderColor: '#a7f3d0' }}
                  >
                    Full Balance (₹{selectedPartyForPayment?.balance})
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select 
                    className="input-field select-field"
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe / QR</option>
                    <option value="Bank">Bank Transfer / NEFT / RTGS / Cheque</option>
                  </select>
                </div>

                {/* Connected Bank Account Selection for Non-Cash */}
                {(paymentMode === 'Bank' || paymentMode === 'UPI') && bankAccounts.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Deposit Bank Account</label>
                    <select 
                      className="input-field select-field"
                      value={selectedBankId}
                      onChange={e => setSelectedBankId(e.target.value)}
                    >
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - A/c: {b.accountNo} ({b.accountType})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Remarks / Notes</label>
                  <input 
                    type="text" 
                    className="input-field"
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                  />
                </div>

                {/* WhatsApp Receipt Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', marginTop: '10px' }}>
                  <input 
                    type="checkbox" 
                    id="autoSendWhatsApp" 
                    checked={autoSendWhatsAppReceipt} 
                    onChange={e => setAutoSendWhatsAppReceipt(e.target.checked)} 
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="autoSendWhatsApp" style={{ fontSize: '0.82rem', color: '#166534', cursor: 'pointer', fontWeight: '600', margin: 0 }}>
                    Send Receipt on WhatsApp Instantly
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setPaymentModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '6px' }}>
                  <CheckCircle2 size={16} />
                  <span>Record Payment (₹{receivedAmount || 0})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

