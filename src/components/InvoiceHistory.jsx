import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Printer, 
  Calendar, 
  Filter, 
  User, 
  Trash2, 
  Download, 
  Plus, 
  DollarSign, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Eye, 
  ArrowRight,
  Send,
  Layers
} from 'lucide-react';
import { deleteInvoice } from '../utils/storage';
import OdooInvoiceForm from './OdooInvoiceForm';

export default function InvoiceHistory({ 
  invoices = [], 
  parties = [], 
  products = [], 
  business, 
  setActiveTab, 
  handlePrintInvoice, 
  refreshAllData 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [odooStatusFilter, setOdooStatusFilter] = useState('ALL'); // 'ALL', 'draft', 'posted', 'in_payment', 'paid', 'credit_note', 'cancel'
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState(null); // holds invoice object or {} for new

  // Normalize state for legacy invoices
  const normalizedInvoices = invoices.map(inv => {
    let state = inv.state;
    if (!state) {
      if (inv.paymentStatus === 'PAID') state = 'paid';
      else if (inv.paymentStatus === 'PARTIAL') state = 'in_payment';
      else state = 'posted';
    }
    const grandTotal = Number(inv.grandTotal) || 0;
    const paid = Number(inv.paidAmount) || (state === 'paid' ? grandTotal : 0);
    const amountDue = Number(inv.amountDue !== undefined ? inv.amountDue : Math.max(0, grandTotal - paid));

    return {
      ...inv,
      state,
      amountDue
    };
  });

  // Filter invoices
  const filteredInvoices = normalizedInvoices.filter(inv => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(term)) ||
                          (inv.partyName && inv.partyName.toLowerCase().includes(term)) ||
                          (inv.customerName && inv.customerName.toLowerCase().includes(term)) ||
                          (inv.partyGstin && inv.partyGstin.toLowerCase().includes(term));

    let matchesStatus = true;
    if (odooStatusFilter === 'ALL') {
      matchesStatus = true;
    } else if (odooStatusFilter === 'credit_note') {
      matchesStatus = inv.documentType === 'out_refund' || (inv.invoiceNo && inv.invoiceNo.startsWith('RINV'));
    } else {
      matchesStatus = inv.state === odooStatusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Compute Odoo KPI Summaries
  const draftCount = normalizedInvoices.filter(i => i.state === 'draft').length;
  const draftTotal = normalizedInvoices.filter(i => i.state === 'draft').reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);

  const postedCount = normalizedInvoices.filter(i => i.state === 'posted').length;
  const postedDueTotal = normalizedInvoices.filter(i => i.state === 'posted').reduce((sum, i) => sum + (Number(i.amountDue) || 0), 0);

  const inPaymentCount = normalizedInvoices.filter(i => i.state === 'in_payment').length;
  const inPaymentTotal = normalizedInvoices.filter(i => i.state === 'in_payment').reduce((sum, i) => sum + (Number(i.amountDue) || 0), 0);

  const paidCount = normalizedInvoices.filter(i => i.state === 'paid').length;
  const paidTotal = normalizedInvoices.filter(i => i.state === 'paid').reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);

  const handleDelete = (e, inv) => {
    e.stopPropagation();
    if (window.confirm(`⚠️ Are you sure you want to delete Invoice #${inv.invoiceNo} (${inv.partyName || inv.customerName})?\n\n• Stock will be automatically restored to the warehouse.\n• Retailer balance ledger will be adjusted.`)) {
      deleteInvoice(inv.id);
      if (refreshAllData) refreshAllData();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. Odoo Invoicing Top Control Banner */}
      <div style={{ 
        background: '#ffffff', 
        borderRadius: '14px', 
        padding: '16px 22px', 
        border: '1px solid #e2e8f0', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#714B67', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#1e293b' }}>
              Customer Invoices & Billing (Odoo Invoicing Suite)
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Document lifecycle, partial/full payment reconciliation, credit notes & double-entry preview
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => setSelectedInvoiceForEdit({})}
            className="btn btn-primary"
            style={{ 
              background: '#714B67', 
              borderColor: '#714B67', 
              fontWeight: '800', 
              padding: '8px 16px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}
          >
            <Plus size={16} />
            <span>+ New Invoice (Odoo Studio)</span>
          </button>

          {setActiveTab && (
            <button 
              onClick={() => setActiveTab('billing')}
              className="btn btn-secondary"
              style={{ fontWeight: '700', padding: '8px 14px', fontSize: '0.85rem' }}
            >
              POS Quick Counter
            </button>
          )}
        </div>
      </div>

      {/* 2. Odoo KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        
        {/* Drafts */}
        <div 
          onClick={() => setOdooStatusFilter('draft')}
          style={{ 
            background: '#ffffff', 
            borderRadius: '12px', 
            padding: '16px', 
            border: odooStatusFilter === 'draft' ? '2px solid #714B67' : '1px solid #e2e8f0', 
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.82rem', fontWeight: '700' }}>
            <span>Draft Invoices</span>
            <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontSize: '0.74rem' }}>{draftCount}</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#1e293b', marginTop: '6px' }}>
            ₹{draftTotal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#714B67', fontWeight: '700', marginTop: '4px' }}>
            Awaiting Confirmation / Pro-forma
          </div>
        </div>

        {/* Posted / To Pay */}
        <div 
          onClick={() => setOdooStatusFilter('posted')}
          style={{ 
            background: '#ffffff', 
            borderRadius: '12px', 
            padding: '16px', 
            border: odooStatusFilter === 'posted' ? '2px solid #2563eb' : '1px solid #e2e8f0', 
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.82rem', fontWeight: '700' }}>
            <span>Posted / Unpaid</span>
            <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontSize: '0.74rem' }}>{postedCount}</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#2563eb', marginTop: '6px' }}>
            ₹{postedDueTotal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: '700', marginTop: '4px' }}>
            Open Receivables
          </div>
        </div>

        {/* In Payment */}
        <div 
          onClick={() => setOdooStatusFilter('in_payment')}
          style={{ 
            background: '#ffffff', 
            borderRadius: '12px', 
            padding: '16px', 
            border: odooStatusFilter === 'in_payment' ? '2px solid #d97706' : '1px solid #e2e8f0', 
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.82rem', fontWeight: '700' }}>
            <span>In Payment</span>
            <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '12px', fontSize: '0.74rem' }}>{inPaymentCount}</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#d97706', marginTop: '6px' }}>
            ₹{inPaymentTotal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: '700', marginTop: '4px' }}>
            Partially Reconciled
          </div>
        </div>

        {/* Paid */}
        <div 
          onClick={() => setOdooStatusFilter('paid')}
          style={{ 
            background: '#ffffff', 
            borderRadius: '12px', 
            padding: '16px', 
            border: odooStatusFilter === 'paid' ? '2px solid #059669' : '1px solid #e2e8f0', 
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.82rem', fontWeight: '700' }}>
            <span>Fully Paid</span>
            <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '12px', fontSize: '0.74rem' }}>{paidCount}</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#059669', marginTop: '6px' }}>
            ₹{paidTotal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '700', marginTop: '4px' }}>
            Zero Residual Balance
          </div>
        </div>

      </div>

      {/* 3. Search & Odoo Status Tab Navigation */}
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '14px 20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Odoo Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Invoices' },
              { id: 'draft', label: 'Draft' },
              { id: 'posted', label: 'Posted / Unpaid' },
              { id: 'in_payment', label: 'In Payment' },
              { id: 'paid', label: 'Paid' },
              { id: 'credit_note', label: 'Credit Notes' },
              { id: 'cancel', label: 'Cancelled' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setOdooStatusFilter(tab.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: odooStatusFilter === tab.id ? '#714B67' : '#e2e8f0',
                  background: odooStatusFilter === tab.id ? '#714B67' : '#ffffff',
                  color: odooStatusFilter === tab.id ? '#ffffff' : '#475569',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text"
              className="form-control"
              placeholder="Search invoice #, customer, GSTIN..."
              style={{ paddingLeft: '32px', fontSize: '0.84rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

        </div>
      </div>

      {/* 4. Odoo Invoice Table */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#1e293b' }}>
            Invoices & Credit Notes ({sortedInvoices.length} Documents)
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Click any row to open full Odoo Form Studio
          </span>
        </div>

        {sortedInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
            <FileText size={40} style={{ margin: '0 auto 10px auto', opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700' }}>No invoices found matching criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 14px' }}>Number</th>
                  <th style={{ padding: '10px 14px' }}>Customer / Partner</th>
                  <th style={{ padding: '10px 14px' }}>Invoice Date</th>
                  <th style={{ padding: '10px 14px' }}>Due Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Tax Excluded (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount Due (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map(inv => {
                  const isCreditNote = inv.documentType === 'out_refund' || (inv.invoiceNo && inv.invoiceNo.startsWith('RINV'));
                  const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.amountDue > 0;

                  return (
                    <tr 
                      key={inv.id} 
                      onClick={() => setSelectedInvoiceForEdit(inv)}
                      style={{ 
                        borderBottom: '1px solid #f1f5f9', 
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                    >
                      {/* Invoice Number */}
                      <td style={{ padding: '10px 14px', fontWeight: '800', color: isCreditNote ? '#dc2626' : '#714B67' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isCreditNote ? <RotateCcw size={14} color="#dc2626" /> : <FileText size={14} color="#714B67" />}
                          <span>{inv.invoiceNo}</span>
                        </div>
                      </td>

                      {/* Partner Name & GSTIN */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: '700', color: '#1e293b' }}>{inv.partyName || inv.customerName}</div>
                        {inv.partyGstin && <div style={{ fontSize: '0.72rem', color: '#2563eb' }}>{inv.partyGstin}</div>}
                      </td>

                      {/* Invoice Date */}
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '0.82rem' }}>
                        {inv.date ? inv.date.split('T')[0] : 'N/A'}
                      </td>

                      {/* Due Date */}
                      <td style={{ padding: '10px 14px', fontSize: '0.82rem' }}>
                        <span style={{ color: isOverdue ? '#dc2626' : '#64748b', fontWeight: isOverdue ? '800' : '500' }}>
                          {inv.dueDate ? inv.dueDate.split('T')[0] : (inv.date ? inv.date.split('T')[0] : '-')}
                          {isOverdue && ' ⚠️'}
                        </span>
                      </td>

                      {/* Tax Excluded Subtotal */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b' }}>
                        ₹{Number(inv.taxableSubtotal || inv.taxableAmount || inv.subTotal || inv.subtotal || 0).toFixed(2)}
                      </td>

                      {/* Total */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800', color: '#1e293b' }}>
                        ₹{Number(inv.grandTotal || 0).toFixed(2)}
                      </td>

                      {/* Residual Amount Due */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800', color: inv.amountDue > 0 ? '#dc2626' : '#059669' }}>
                        ₹{Number(inv.amountDue || 0).toFixed(2)}
                      </td>

                      {/* Odoo State Badge */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.74rem',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          background: inv.state === 'paid' ? '#ecfdf5' :
                                      inv.state === 'in_payment' ? '#fef3c7' :
                                      inv.state === 'posted' ? '#eff6ff' :
                                      inv.state === 'cancel' ? '#fef2f2' : '#f1f5f9',
                          color: inv.state === 'paid' ? '#059669' :
                                 inv.state === 'in_payment' ? '#d97706' :
                                 inv.state === 'posted' ? '#2563eb' :
                                 inv.state === 'cancel' ? '#dc2626' : '#64748b'
                        }}>
                          {inv.state}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => setSelectedInvoiceForEdit(inv)}
                            className="btn btn-secondary btn-sm"
                            title="Open in Odoo Form Studio"
                            style={{ padding: '4px 8px', fontSize: '0.74rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Eye size={12} />
                            <span>Open</span>
                          </button>

                          <button 
                            onClick={() => handlePrintInvoice && handlePrintInvoice(inv)}
                            className="btn btn-secondary btn-sm"
                            title="Print Invoice"
                            style={{ padding: '4px 8px' }}
                          >
                            <Printer size={13} />
                          </button>

                          <button 
                            onClick={(e) => handleDelete(e, inv)}
                            className="btn btn-sm"
                            title="Delete Invoice"
                            style={{ padding: '4px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Full Odoo Invoice Studio Modal */}
      {selectedInvoiceForEdit !== null && (
        <div className="modal-overlay" style={{ zIndex: 1100, padding: '20px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1240px', width: '100%', margin: '0 auto' }}>
            <OdooInvoiceForm 
              invoice={selectedInvoiceForEdit.id ? selectedInvoiceForEdit : null}
              parties={parties}
              products={products}
              business={business}
              onClose={() => setSelectedInvoiceForEdit(null)}
              onSave={(saved) => {
                setSelectedInvoiceForEdit(null);
                if (refreshAllData) refreshAllData();
              }}
              refreshAllData={refreshAllData}
              handlePrintInvoice={handlePrintInvoice}
            />
          </div>
        </div>
      )}

    </div>
  );
}
