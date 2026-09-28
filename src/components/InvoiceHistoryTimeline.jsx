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
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          icon: FileText
        };
      case 'UPDATED':
        return {
          label: 'Invoice Updated',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
          icon: FileText
        };
      case 'RECEIPT_CREATED':
        return {
          label: 'Payment Received',
          bg: 'bg-green-50 text-green-700 border-green-200',
          dot: 'bg-green-600',
          icon: Receipt
        };
      case 'RETURN_INITIATED':
        return {
          label: 'Return Initiated',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          icon: RotateCcw
        };
      case 'RETURN_RECEIVED':
        return {
          label: 'Return Received & Inspected',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dot: 'bg-indigo-600',
          icon: CheckCircle2
        };
      case 'CREDIT_NOTE_ISSUED':
        return {
          label: 'Credit Note Issued',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500',
          icon: CreditCard
        };
      case 'REPLACEMENT_LINKED':
        return {
          label: 'Replacement Generated',
          bg: 'bg-teal-50 text-teal-700 border-teal-200',
          dot: 'bg-teal-500',
          icon: ArrowRightLeft
        };
      case 'STATUS_CHANGE':
        return {
          label: 'Status Changed',
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-500',
          icon: AlertCircle
        };
      default:
        return {
          label: actionType || 'Activity',
          bg: 'bg-gray-100 text-gray-700 border-gray-200',
          dot: 'bg-gray-400',
          icon: Clock
        };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    // Format: DD-MM-YYYY HH:MM:SS
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-semibold text-slate-800">
            Invoice History & Activity Audit Trail
          </h3>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {logs.length} event{logs.length !== 1 ? 's' : ''} recorded
        </span>
      </div>

      {/* Add Quick Audit Note */}
      <form onSubmit={handleAddNote} className="mb-5 flex gap-2">
        <div className="relative flex-1">
          <MessageSquare className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Add internal audit note or comment for this invoice..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={!newNote.trim() || isSubmitting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Post Note
        </button>
      </form>

      {/* Timeline Stream */}
      {logs.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs font-medium">No activity history recorded yet for this invoice.</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {logs.map((log) => {
            const badge = getActionBadge(log.actionType);
            const Icon = badge.icon;

            return (
              <div key={log.id} className="relative group">
                {/* Timeline node dot */}
                <div className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${badge.dot} shadow-sm ring-2 ring-slate-100`} />

                <div className="bg-slate-50/70 hover:bg-slate-50 rounded-lg p-3 border border-slate-200/80 transition-colors">
                  {/* Top Bar: Action badge, user, timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.bg}`}>
                        <Icon className="w-3 h-3" />
                        {badge.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                        <User className="w-3 h-3 text-slate-400" />
                        {log.userId || 'Administrator'}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-700 leading-relaxed font-normal">
                    {log.description}
                  </p>

                  {/* Document Deep Link Pills (SR-..., CN-..., INV-...) */}
                  {(log.referenceDocumentId || log.referenceDocumentType) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Linked Record:
                      </span>
                      {log.referenceDocumentType === 'RETURN' && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDocument && onNavigateToDocument('return', log.referenceDocumentId)}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-medium transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          View Return (RMA)
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {log.referenceDocumentType === 'CREDIT_NOTE' && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDocument && onNavigateToDocument('invoice', log.referenceDocumentId)}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-medium transition-colors"
                        >
                          <CreditCard className="w-3 h-3" />
                          View Credit Note
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {log.referenceDocumentType === 'REPLACEMENT_INVOICE' && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDocument && onNavigateToDocument('invoice', log.referenceDocumentId)}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded font-medium transition-colors"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          View Replacement Invoice
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {log.referenceDocumentType === 'PAYMENT' && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">
                          <Receipt className="w-3 h-3" />
                          Receipt Voucher
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
