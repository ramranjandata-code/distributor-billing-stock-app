import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  User, 
  FileText, 
  RotateCcw, 
  Receipt, 
  CreditCard, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { InvoiceHistoryLogger, getCurrentOperator } from '../utils/storage';

export default function InvoiceHistoryTimeline({ 
  invoiceId, 
  onNavigateToDocument,
  compact = false 
}) {
  const [logs, setLogs] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadLogs = () => {
    if (!invoiceId) {
      setLogs([]);
      return;
    }
    const history = InvoiceHistoryLogger.getLogs(invoiceId);
    setLogs(history);
  };

  useEffect(() => {
    loadLogs();

    const handleStorageChange = () => {
      loadLogs();
    };

    window.addEventListener('distro_data_changed', handleStorageChange);
    return () => window.removeEventListener('distro_data_changed', handleStorageChange);
  }, [invoiceId]);

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.trim() || !invoiceId) return;

    setIsSubmitting(true);
    const op = getCurrentOperator();
    InvoiceHistoryLogger.log({
      invoiceId,
      actionType: 'UPDATED',
      description: `Note added by ${op?.name || 'User'}: "${newNote.trim()}"`,
      referenceDocumentType: 'NOTE',
      userId: op?.name || 'Administrator'
    });

    setNewNote('');
    setIsSubmitting(false);
    loadLogs();
  };

  const getActionBadge = (actionType) => {
    switch (actionType) {
      case 'CREATED':
        return {
          label: 'Invoice Created',
          style: { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' },
          dot: '#059669',
          icon: FileText
        };
      case 'UPDATED':
        return {
          label: 'Invoice Updated',
          style: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
          dot: '#2563eb',
          icon: FileText
        };
      case 'RECEIPT_CREATED':
        return {
          label: 'Payment Received',
          style: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
          dot: '#16a34a',
          icon: Receipt
        };
      case 'RETURN_INITIATED':
        return {
          label: 'Return Initiated',
          style: { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' },
          dot: '#d97706',
          icon: RotateCcw
        };
      case 'RETURN_RECEIVED':
        return {
          label: 'Return Received & Inspected',
          style: { background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' },
          dot: '#4f46e5',
          icon: CheckCircle2
        };
      case 'CREDIT_NOTE_ISSUED':
        return {
          label: 'Credit Note Issued',
          style: { background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' },
          dot: '#e11d48',
          icon: CreditCard
        };
      case 'REPLACEMENT_LINKED':
        return {
          label: 'Replacement Generated',
          style: { background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4' },
          dot: '#0d9488',
          icon: ArrowRightLeft
        };
      case 'STATUS_CHANGE':
        return {
          label: 'Status Changed',
          style: { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' },
          dot: '#64748b',
          icon: AlertCircle
        };
      default:
        return {
          label: actionType || 'Activity',
          style: { background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' },
          dot: '#94a3b8',
          icon: Clock
        };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  };

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      padding: '18px 22px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '12px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="#4f46e5" />
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: '#1e293b' }}>
            Invoice History & Activity Audit Trail
          </h3>
        </div>
        <span style={{
          background: '#f1f5f9',
          color: '#475569',
          padding: '2px 10px',
          borderRadius: '12px',
          fontSize: '0.74rem',
          fontWeight: '700'
        }}>
          {logs.length} event{logs.length !== 1 ? 's' : ''} logged
        </span>
      </div>

      {/* Add Quick Audit Note */}
      <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <MessageSquare size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input
            type="text"
            placeholder="Add internal audit note or comment for this invoice..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '32px', fontSize: '0.82rem', padding: '7px 10px 7px 32px' }}
          />
        </div>
        <button
          type="submit"
          disabled={!newNote.trim() || isSubmitting}
          className="btn btn-primary"
          style={{
            padding: '7px 14px',
            fontSize: '0.82rem',
            fontWeight: '700',
            background: '#4f46e5',
            opacity: (!newNote.trim() || isSubmitting) ? 0.6 : 1
          }}
        >
          <Plus size={14} />
          <span>Post Note</span>
        </button>
      </form>

      {/* Timeline Stream */}
      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
          <Clock size={28} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: '600' }}>
            No activity history recorded yet for this invoice.
          </p>
        </div>
      ) : (
        <div style={{
          position: 'relative',
          paddingLeft: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Vertical Connecting Line */}
          <div style={{
            position: 'absolute',
            left: '9px',
            top: '8px',
            bottom: '8px',
            width: '2px',
            background: '#e2e8f0'
          }} />

          {logs.map((log) => {
            const badge = getActionBadge(log.actionType);
            const Icon = badge.icon;

            return (
              <div key={log.id} style={{ position: 'relative' }}>
                {/* Node Dot */}
                <div style={{
                  position: 'absolute',
                  left: '-24px',
                  top: '6px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: badge.dot,
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 0 2px #f1f5f9'
                }} />

                <div style={{
                  background: '#f8fafc',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {/* Top Line */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: '800',
                        ...badge.style
                      }}>
                        <Icon size={12} />
                        <span>{badge.label}</span>
                      </span>

                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.78rem',
                        color: '#475569',
                        fontWeight: '600'
                      }}>
                        <User size={12} color="#94a3b8" />
                        <span>{log.userId || 'Administrator'}</span>
                      </span>
                    </div>

                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                      {formatDate(log.createdAt)}
                    </span>
                  </div>

                  {/* Description */}
                  <p style={{
                    margin: '2px 0 0 0',
                    fontSize: '0.82rem',
                    color: '#334155',
                    lineHeight: '1.45',
                    fontWeight: '500'
                  }}>
                    {log.description}
                  </p>

                  {/* Linked Record Deep Links */}
                  {(log.referenceDocumentId || log.referenceDocumentType) && (
                    <div style={{
                      marginTop: '4px',
                      paddingTop: '6px',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.75rem'
                    }}>
                      <span style={{ fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        Linked Record:
                      </span>
                      {log.referenceDocumentType === 'RETURN' && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDocument && onNavigateToDocument('return', log.referenceDocumentId)}
                          style={{
                            background: '#fef3c7',
                            border: '1px solid #fde68a',
                            color: '#b45309',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: '700',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <RotateCcw size={12} />
                          <span>View Return (RMA)</span>
                          <ExternalLink size={10} />
                        </button>
                      )}
                      {log.referenceDocumentType === 'CREDIT_NOTE' && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDocument && onNavigateToDocument('invoice', log.referenceDocumentId)}
                          style={{
                            background: '#fff1f2',
                            border: '1px solid #fecdd3',
                            color: '#e11d48',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: '700',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <CreditCard size={12} />
                          <span>View Credit Note</span>
                          <ExternalLink size={10} />
                        </button>
                      )}
                      {log.referenceDocumentType === 'REPLACEMENT_INVOICE' && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDocument && onNavigateToDocument('invoice', log.referenceDocumentId)}
                          style={{
                            background: '#f0fdfa',
                            border: '1px solid #99f6e4',
                            color: '#0d9488',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: '700',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <ArrowRightLeft size={12} />
                          <span>View Replacement Invoice</span>
                          <ExternalLink size={10} />
                        </button>
                      )}
                      {log.referenceDocumentType === 'PAYMENT' && (
                        <span style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          color: '#16a34a',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: '700',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Receipt size={12} />
                          <span>Receipt Voucher</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
