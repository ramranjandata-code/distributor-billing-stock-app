import React, { useState } from 'react';
import { 
  Building2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  Plus, 
  CheckCircle2, 
  Search, 
  ShieldCheck, 
  RefreshCw,
  Wallet,
  Zap,
  FileCheck,
  Building
} from 'lucide-react';
import { 
  fetchBankAccounts, 
  saveBankAccount, 
  fetchBankTransactions, 
  recordBankTransaction, 
  updatePartyBalance, 
  logAuditAction 
} from '../utils/storage';

export default function ConnectedBanking({ parties = [], invoices = [], refreshAllData, t }) {
  const [bankAccounts, setBankAccounts] = useState(fetchBankAccounts());
  const [transactions, setTransactions] = useState(fetchBankTransactions());
  
  // Modals
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);

  // Deposit / NEFT Transfer Form
  const [depositForm, setDepositForm] = useState({
    bankAccountId: bankAccounts[0]?.id || '',
    partyId: '',
    amount: '',
    mode: 'NEFT', // NEFT, RTGS, IMPS, CHEQUE, UPI
    referenceNo: '',
    notes: ''
  });

  // New Bank Account Form
  const [newAccountForm, setNewAccountForm] = useState({
    bankName: 'ICICI Bank',
    accountNo: '',
    ifsc: '',
    branch: '',
    upiId: '',
    balance: 0
  });

  // Reconcile State
  const [reconcileSelectedInv, setReconcileSelectedInv] = useState(null);
  const [reconcileUtr, setReconcileUtr] = useState('');

  const refreshBankingData = () => {
    setBankAccounts(fetchBankAccounts());
    setTransactions(fetchBankTransactions());
    if (refreshAllData) refreshAllData();
  };

  const totalBankBalance = bankAccounts.reduce((sum, b) => sum + (Number(b.balance) || 0), 0);

  const handleSaveDeposit = (e) => {
    e.preventDefault();
    const amount = Number(depositForm.amount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid transfer amount.');
      return;
    }
    if (!depositForm.bankAccountId) {
      alert('Please select a destination bank account.');
      return;
    }

    const selectedParty = parties.find(p => p.id === depositForm.partyId);

    // 1. Record Bank Transaction
    recordBankTransaction({
      bankAccountId: depositForm.bankAccountId,
      partyId: depositForm.partyId || null,
      partyName: selectedParty ? selectedParty.name : 'Counter Deposit',
      type: 'CREDIT',
      amount,
      mode: depositForm.mode,
      referenceNo: depositForm.referenceNo || ('UTR-' + Math.floor(10000000 + Math.random() * 90000000)),
      notes: depositForm.notes || `Received from ${selectedParty ? selectedParty.name : 'Retailer'}`
    });

    // 2. Deduct Outstanding Balance from Party Ledger if linked to party
    if (depositForm.partyId) {
      updatePartyBalance(depositForm.partyId, -amount);
    }

    alert(`✅ Recorded ₹${amount.toLocaleString('en-IN')} payment via ${depositForm.mode} successfully!`);
    setDepositModalOpen(false);
    setDepositForm({
      bankAccountId: bankAccounts[0]?.id || '',
      partyId: '',
      amount: '',
      mode: 'NEFT',
      referenceNo: '',
      notes: ''
    });
    refreshBankingData();
  };

  const handleCreateAccount = (e) => {
    e.preventDefault();
    if (!newAccountForm.accountNo || !newAccountForm.ifsc) {
      alert('Please provide Account Number and IFSC Code.');
      return;
    }
    saveBankAccount(newAccountForm);
    alert('Bank account added successfully!');
    setAddAccountModalOpen(false);
    setNewAccountForm({
      bankName: 'ICICI Bank',
      accountNo: '',
      ifsc: '',
      branch: '',
      upiId: '',
      balance: 0
    });
    refreshBankingData();
  };

  const unpaidInvoices = invoices.filter(i => (i.paymentStatus === 'UNPAID' || i.paymentStatus === 'PARTIAL') && Number(i.balanceAmount) > 0);

  const handleReconcileInvoice = (inv) => {
    const utr = prompt(`Enter Bank NEFT/RTGS UTR Reference for Invoice #${inv.invoiceNo}:`, 'UTR' + Math.floor(100000000 + Math.random() * 900000000));
    if (!utr) return;

    const dueAmount = Number(inv.balanceAmount) || (inv.grandTotal - (inv.paidAmount || 0));
    const targetBank = bankAccounts[0];

    if (targetBank) {
      recordBankTransaction({
        bankAccountId: targetBank.id,
        partyId: inv.partyId,
        partyName: inv.customerName,
        type: 'CREDIT',
        amount: dueAmount,
        mode: 'NEFT',
        referenceNo: utr,
        notes: `Reconciled against Invoice #${inv.invoiceNo}`
      });
    }

    if (inv.partyId) {
      updatePartyBalance(inv.partyId, -dueAmount);
    }

    logAuditAction('RECONCILE_INVOICE', 'Banking & Reconciliation', `Reconciled Invoice #${inv.invoiceNo} (₹${dueAmount.toLocaleString('en-IN')}) via UTR ${utr}`);
    alert(`✅ Invoice #${inv.invoiceNo} reconciled and marked as settled!`);
    refreshBankingData();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        borderRadius: '16px',
        padding: '24px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{
              background: '#059669',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: '800',
              padding: '3px 10px',
              borderRadius: '20px',
              letterSpacing: '0.05em'
            }}>
              DIRECT BANKING INTEGRATION
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Supported: SBI, HDFC, ICICI, Axis</span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>Connected Banking & MargPay</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '6px', maxWidth: '600px' }}>
            Direct digital payment reconciliation, automated NEFT/RTGS transaction recording, and instant bank settlement for distributor sales.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setDepositModalOpen(true)}
            className="btn btn-primary"
            style={{ padding: '10px 18px', fontWeight: '700', gap: '8px' }}
          >
            <ArrowDownLeft size={18} />
            <span>Record Bank Deposit</span>
          </button>
          <button 
            onClick={() => setAddAccountModalOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', gap: '8px' }}
          >
            <Plus size={18} />
            <span>Link Bank Account</span>
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Total Bank Holdings</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={20} color="#059669" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '12px', color: '#059669' }}>
            ₹{totalBankBalance.toLocaleString('en-IN')}
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Across {bankAccounts.length} Linked Accounts</span>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Auto-Reconciled Today</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} color="#2563eb" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '12px', color: '#2563eb' }}>
            {transactions.length} Txns
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Real-time payment matching</span>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Pending NEFT Verification</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={20} color="#d97706" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '12px', color: '#d97706' }}>
            {unpaidInvoices.length} Invoices
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Awaiting bank clearance</span>
        </div>
      </div>

      {/* Linked Bank Accounts Grid */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={20} color="var(--primary)" />
          <span>Active Bank Accounts ({bankAccounts.length})</span>
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {bankAccounts.map(account => (
            <div 
              key={account.id} 
              className="card" 
              style={{ 
                padding: '20px',
                background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                border: '1px solid var(--border-color)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>{account.bankName}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{account.branch || 'Main Commercial Branch'}</p>
                </div>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                  <ShieldCheck size={12} style={{ display: 'inline', marginRight: '3px' }} />
                  Connected
                </span>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>A/C Number:</span>
                  <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>{account.accountNo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>IFSC Code:</span>
                  <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>{account.ifsc}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>UPI VPA:</span>
                  <span style={{ fontWeight: '700', color: '#2563eb' }}>{account.upiId || 'Not Configured'}</span>
                </div>
              </div>

              <div style={{ 
                marginTop: '16px', 
                paddingTop: '12px', 
                borderTop: '1px dashed var(--border-color)', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center' 
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Book Balance</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#059669' }}>
                  ₹{Number(account.balance || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Section: Recent Bank Transactions & Outstanding Invoices Reconcile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        
        {/* Bank Ledger Transactions */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color="var(--primary)" />
              <span>Bank Statement & NEFT Entries</span>
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{transactions.length} Records</span>
          </div>

          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No bank transactions recorded yet.</p>
              <button 
                onClick={() => setDepositModalOpen(true)}
                className="btn btn-secondary" 
                style={{ marginTop: '12px', fontSize: '0.8rem' }}
              >
                Record First Bank Deposit
              </button>
            </div>
          ) : (
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>Date</th>
                    <th style={{ padding: '8px 10px' }}>Party / Description</th>
                    <th style={{ padding: '8px 10px' }}>Mode & Ref</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(txn => (
                    <tr key={txn.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{txn.partyName || 'Counter Deposit'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{txn.notes || 'Bank Transfer'}</div>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>{txn.mode}</span>
                        <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {txn.referenceNo}
                        </div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: txn.type === 'CREDIT' ? '#059669' : '#dc2626' }}>
                        {txn.type === 'CREDIT' ? '+' : '-'}₹{Number(txn.amount || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Invoice Settlement / Reconciliation */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCheck size={18} color="#2563eb" />
              <span>Pending Invoices for Bank Settlement</span>
            </h3>
            <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>
              {unpaidInvoices.length} Due
            </span>
          </div>

          {unpaidInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
              <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)' }}>All Invoices Reconciled!</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>No pending invoices awaiting bank settlement.</p>
            </div>
          ) : (
            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {unpaidInvoices.slice(0, 10).map(inv => {
                const dueAmt = Number(inv.balanceAmount) || (inv.grandTotal - (inv.paidAmount || 0));
                return (
                  <div 
                    key={inv.id}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                        {inv.invoiceNo} • {inv.customerName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Date: {new Date(inv.date).toLocaleDateString('en-IN')} • Total: ₹{Number(inv.grandTotal).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#dc2626' }}>
                        ₹{dueAmt.toLocaleString('en-IN')}
                      </div>
                      <button 
                        onClick={() => handleReconcileInvoice(inv)}
                        className="btn btn-primary"
                        style={{ padding: '4px 10px', fontSize: '0.74rem', marginTop: '4px', fontWeight: '700' }}
                      >
                        Reconcile Bank UTR
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Record Bank Deposit / Transfer */}
      {depositModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '520px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowDownLeft size={22} color="#059669" />
              <span>Record Bank Deposit / NEFT Receipt</span>
            </h3>

            <form onSubmit={handleSaveDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Destination Bank Account *</label>
                <select 
                  className="form-control"
                  value={depositForm.bankAccountId}
                  onChange={e => setDepositForm({ ...depositForm, bankAccountId: e.target.value })}
                  required
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.bankName} - {b.accountNo} (Bal: ₹{Number(b.balance).toLocaleString('en-IN')})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Received From Retailer / Party</label>
                <select 
                  className="form-control"
                  value={depositForm.partyId}
                  onChange={e => setDepositForm({ ...depositForm, partyId: e.target.value })}
                >
                  <option value="">-- Direct / Counter Bank Deposit --</option>
                  {parties.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Due: ₹{Number(p.balance || 0).toLocaleString('en-IN')})</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Selecting a party will automatically deduct their outstanding debt ledger!
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Payment Amount (₹) *</label>
                  <input 
                    type="number"
                    className="form-control"
                    placeholder="e.g. 25000"
                    value={depositForm.amount}
                    onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
                    required
                    min="1"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Transfer Mode *</label>
                  <select 
                    className="form-control"
                    value={depositForm.mode}
                    onChange={e => setDepositForm({ ...depositForm, mode: e.target.value })}
                  >
                    <option value="NEFT">NEFT Transfer</option>
                    <option value="RTGS">RTGS Transfer</option>
                    <option value="IMPS">IMPS Instant</option>
                    <option value="UPI">UPI / MargPay</option>
                    <option value="CHEQUE">Bank Cheque</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Bank UTR / Cheque Reference Number</label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="e.g. UTR1029384756"
                  value={depositForm.referenceNo}
                  onChange={e => setDepositForm({ ...depositForm, referenceNo: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Remarks / Note</label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="Optional payment notes"
                  value={depositForm.notes}
                  onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setDepositModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: '700' }}>
                  Save & Update Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Link New Bank Account */}
      {addAccountModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={22} color="var(--primary)" />
              <span>Link Commercial Bank Account</span>
            </h3>

            <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Bank Name *</label>
                <select 
                  className="form-control"
                  value={newAccountForm.bankName}
                  onChange={e => setNewAccountForm({ ...newAccountForm, bankName: e.target.value })}
                >
                  <option value="State Bank of India">State Bank of India (SBI)</option>
                  <option value="HDFC Bank Ltd">HDFC Bank Ltd</option>
                  <option value="ICICI Bank">ICICI Bank</option>
                  <option value="Axis Bank">Axis Bank</option>
                  <option value="Punjab National Bank">Punjab National Bank</option>
                  <option value="Bank of Baroda">Bank of Baroda</option>
                  <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Account Number *</label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="e.g. 50200088991122"
                  value={newAccountForm.accountNo}
                  onChange={e => setNewAccountForm({ ...newAccountForm, accountNo: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">IFSC Code *</label>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="e.g. HDFC0001234"
                    value={newAccountForm.ifsc}
                    onChange={e => setNewAccountForm({ ...newAccountForm, ifsc: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Balance (₹)</label>
                  <input 
                    type="number"
                    className="form-control"
                    placeholder="0"
                    value={newAccountForm.balance}
                    onChange={e => setNewAccountForm({ ...newAccountForm, balance: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">UPI ID / VPA</label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="e.g. distributor@icici"
                  value={newAccountForm.upiId}
                  onChange={e => setNewAccountForm({ ...newAccountForm, upiId: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setAddAccountModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: '700' }}>
                  Link Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
