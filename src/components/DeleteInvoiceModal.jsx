import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  HardDrive, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldAlert,
  Package,
  BookOpen
} from 'lucide-react';
import { getGoogleDriveConfig } from '../utils/googleDriveService';

export default function DeleteInvoiceModal({
  isOpen,
  invoice,
  onClose,
  onConfirm
}) {
  const [step, setStep] = useState(1); // 1 = Review & Options, 2 = Final Confirmation
  const [deleteFromDrive, setDeleteFromDrive] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const driveConfig = getGoogleDriveConfig();
  const hasDriveConfig = Boolean(driveConfig?.webhookUrl && driveConfig.webhookUrl.trim().length > 10);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setDeleteFromDrive(hasDriveConfig);
      setIsProcessing(false);
    }
  }, [isOpen, hasDriveConfig]);

  if (!isOpen || !invoice) return null;

  const partyName = invoice.partyName || invoice.customerName || 'Customer';
  const amount = Number(invoice.grandTotal || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const dateFormatted = invoice.date ? invoice.date.split('T')[0] : 'Today';

  const handleProceedToStep2 = () => {
    setStep(2);
  };

  const handleBackToStep1 = () => {
    setStep(1);
  };

  const handleFinalConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm({ deleteFromDrive: hasDriveConfig && deleteFromDrive });
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isProcessing) onClose(); }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalSlideUp 0.15s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: step === 1 ? '#f8fafc' : '#fef2f2',
          borderBottom: step === 1 ? '1px solid #e2e8f0' : '1px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: step === 1 ? '#fee2e2' : '#dc2626',
              color: step === 1 ? '#dc2626' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {step === 1 ? <Trash2 size={18} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: step === 1 ? '#0f172a' : '#991b1b' }}>
                {step === 1 ? `Delete Invoice #${invoice.invoiceNo}` : 'Final Confirmation'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                Confirmation Step {step} of 2
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '800',
              padding: '3px 8px',
              borderRadius: '12px',
              background: step === 1 ? '#e2e8f0' : '#fee2e2',
              color: step === 1 ? '#475569' : '#dc2626',
              letterSpacing: '0.5px'
            }}>
              STEP {step}/2
            </span>
            <button 
              type="button" 
              onClick={onClose}
              disabled={isProcessing}
              style={{
                background: 'none',
                border: 'none',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                color: '#64748b',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {step === 1 ? (
            /* STEP 1: Details & Drive Option */
            <>
              {/* Invoice Summary Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.86rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Customer / Party:</span>
                  <strong style={{ color: '#0f172a' }}>{partyName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Bill Amount:</span>
                  <strong style={{ color: '#dc2626', fontSize: '0.96rem' }}>₹{amount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Date:</span>
                  <span style={{ color: '#475569', fontWeight: '600' }}>{dateFormatted}</span>
                </div>
              </div>

              {/* What will happen automatically */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '0.8rem',
                color: '#166534',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={14} />
                  <span>Stock & Khata Restoration:</span>
                </div>
                <div style={{ paddingLeft: '20px', color: '#15803d', lineHeight: 1.4 }}>
                  • Warehouse stock automatically restore ho jayega.<br />
                  • Customer khata ledger balance reverse ho jayega.
                </div>
              </div>

              {/* Google Drive Option */}
              {hasDriveConfig ? (
                <div 
                  onClick={() => setDeleteFromDrive(!deleteFromDrive)}
                  style={{
                    border: deleteFromDrive ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: deleteFromDrive ? '#eff6ff' : '#ffffff',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input 
                    type="checkbox" 
                    id="chk-delete-drive"
                    checked={deleteFromDrive} 
                    onChange={(e) => setDeleteFromDrive(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <label 
                      htmlFor="chk-delete-drive"
                      style={{ fontWeight: '700', fontSize: '0.88rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      <HardDrive size={16} color="#2563eb" />
                      <span>Google Drive se bhi delete karein?</span>
                    </label>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px', lineHeight: 1.4 }}>
                      Agar tick karenge toh Google Drive ke <strong>"{driveConfig.folderName || 'DistroPlus Invoices & Bills'}"</strong> folder se bhi is bill ka PDF automatically <strong>Trash</strong> mein move ho jayega.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px' }}>
                  ℹ️ Google Drive webhook connected nahi hai (ye bill sirf app se delete hoga).
                </div>
              )}
            </>
          ) : (
            /* STEP 2: Final Warning & Confirmation */
            <>
              <div style={{
                background: '#fef2f2',
                border: '1.5px solid #f87171',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: '800', fontSize: '0.94rem' }}>
                  <ShieldAlert size={18} />
                  <span>Dhyan Dein: Ye action permanent hai!</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#7f1d1d', lineHeight: 1.5 }}>
                  Invoice <strong>#{invoice.invoiceNo}</strong> (₹{amount}) aapke system se hamesha ke liye delete ho jayega.
                </div>
              </div>

              {/* Status Breakdown for Step 2 */}
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#dc2626', fontWeight: '700' }}>✓ App & Database:</span>
                  <span style={{ color: '#334155' }}>Permanently deleted & stock restored</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: deleteFromDrive && hasDriveConfig ? '#dc2626' : '#059669', fontWeight: '700' }}>
                    {deleteFromDrive && hasDriveConfig ? '✓ Google Drive:' : '🛡️ Google Drive:'}
                  </span>
                  <span style={{ color: '#334155' }}>
                    {deleteFromDrive && hasDriveConfig ? (
                      <strong style={{ color: '#dc2626' }}>PDF will be removed / moved to Trash in Drive</strong>
                    ) : (
                      <strong style={{ color: '#059669' }}>PDF copy will be preserved safely in Drive</strong>
                    )}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
                Neeche diye gaye red button par click karke deletion confirm karein.
              </div>
            </>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div style={{
          padding: '14px 20px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}>
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                style={{ padding: '9px 18px', fontSize: '0.86rem', fontWeight: '600' }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleProceedToStep2}
                style={{
                  padding: '9px 20px',
                  fontSize: '0.86rem',
                  fontWeight: '800',
                  color: '#ffffff',
                  background: '#dc2626',
                  border: '1px solid #b91c1c',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                }}
              >
                <span style={{ color: '#ffffff', fontWeight: '800' }}>Next: Confirm Deletion (1/2)</span>
                <ArrowRight size={15} color="#ffffff" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleBackToStep1}
                disabled={isProcessing}
                className="btn btn-secondary"
                style={{
                  padding: '9px 18px',
                  fontSize: '0.86rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={15} />
                <span>Go Back (Peeche Jayein)</span>
              </button>

              <button
                type="button"
                onClick={handleFinalConfirm}
                disabled={isProcessing}
                style={{
                  padding: '9px 22px',
                  fontSize: '0.86rem',
                  fontWeight: '900',
                  color: '#ffffff',
                  background: '#dc2626',
                  border: '1px solid #991b1b',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.45)',
                  cursor: isProcessing ? 'wait' : 'pointer'
                }}
              >
                <Trash2 size={16} color="#ffffff" />
                <span style={{ color: '#ffffff', fontWeight: '900', letterSpacing: '0.3px' }}>
                  {isProcessing ? 'Deleting Bill...' : 'Delete Permanently (2/2)'}
                </span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
