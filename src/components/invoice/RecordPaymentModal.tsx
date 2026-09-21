import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Invoice, PaymentMode } from '../../types';
import { formatINR, formatDate } from '../../utils/formatters';
import { useBagBill } from '../../context/BagBillContext';
import { IndianRupee, Calendar, CreditCard, Hash, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onPaymentSuccess?: (updatedInvoice: Invoice) => void;
}

const PAYMENT_METHODS: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onPaymentSuccess,
}) => {
  const { recordPayment } = useBagBill();

  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<PaymentMode>('Cash');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Compute live amounts
  const grandTotal = invoice ? (invoice.grandTotal || 0) : 0;
  const currentPaid = invoice ? (invoice.paidAmount || 0) : 0;
  const currentBalance = invoice 
    ? (invoice.balanceAmount !== undefined ? invoice.balanceAmount : Math.max(0, grandTotal - currentPaid))
    : 0;

  // Reset form when modal opens or invoice changes
  useEffect(() => {
    if (isOpen && invoice) {
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setMethod('Cash');
      setReference('');
      setNotes('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, invoice]);

  if (!invoice) return null;

  const numAmount = parseFloat(amount);
  const isValidNumber = !isNaN(numAmount) && numAmount > 0;
  const isOverpayment = isValidNumber && numAmount > (currentBalance + 0.001);
  const isFullyPaid = currentBalance <= 0;

  const previewNewPaid = isValidNumber ? Math.min(grandTotal, currentPaid + numAmount) : currentPaid;
  const previewNewBalance = isValidNumber ? Math.max(0, currentBalance - numAmount) : currentBalance;
  const previewStatus = isFullyPaid 
    ? 'Paid' 
    : (previewNewBalance <= 0.001 ? 'Paid' : 'Partially Paid');

  const handlePayFullBalance = () => {
    if (currentBalance > 0) {
      setAmount(String(currentBalance));
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isFullyPaid) {
      setError('This invoice is already fully paid. No further payments can be recorded.');
      return;
    }

    if (!isValidNumber) {
      setError('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    if (isOverpayment) {
      setError(`Payment amount cannot exceed the remaining balance of ${formatINR(currentBalance)}.`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const targetId = invoice.id || (invoice as any)._id || invoice.invoiceNumber;
      const updated = await recordPayment(targetId, {
        amount: numAmount,
        date,
        method,
        reference: reference.trim(),
        notes: notes.trim(),
      });

      if (onPaymentSuccess && updated) {
        onPaymentSuccess(updated);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment. Please check inputs and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment Receipt"
      subtitle={`Invoice ${invoice.invoiceNumber} • ${invoice.partyName}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Invoice Financial Snapshot Banner */}
        <div className="p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] space-y-2 text-xs">
          <div className="flex justify-between items-center text-[#8B5E3C]">
            <span>Invoice Date: <strong className="text-[#3B2921]">{formatDate(invoice.date)}</strong></span>
            <span className="font-mono uppercase font-bold text-[11px] px-2 py-0.5 rounded bg-[#FFFDF8] border border-[#E4D7C8]">
              {invoice.paymentStatus}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E4D7C8]/70 text-center">
            <div className="p-2 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8]/60">
              <span className="text-[10px] uppercase font-semibold text-[#8B5E3C] block">Total Amount</span>
              <span className="font-mono font-bold text-sm text-[#3B2921]">{formatINR(grandTotal)}</span>
            </div>
            <div className="p-2 rounded-lg bg-[#E8F5E9]/60 border border-[#A5D6A7]/60">
              <span className="text-[10px] uppercase font-semibold text-[#2E7D32] block">Already Paid</span>
              <span className="font-mono font-bold text-sm text-[#2E7D32]">{formatINR(currentPaid)}</span>
            </div>
            <div className="p-2 rounded-lg bg-[#FFF0F0] border border-[#FFCDD2]">
              <span className="text-[10px] uppercase font-semibold text-[#C62828] block">Balance Due</span>
              <span className="font-mono font-black text-sm text-[#C62828]" data-testid="modal-balance-due">
                {formatINR(currentBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Fully Paid Notice */}
        {isFullyPaid && (
          <div className="p-3 rounded-xl bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32] text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="font-bold">This invoice is fully settled (Balance: ₹0). No additional payment required.</span>
          </div>
        )}

        {!isFullyPaid && (
          <>
            {/* Payment Amount Input with Shortcut */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-[#3B2921] flex items-center gap-1">
                  <IndianRupee size={13} className="text-[#8B5E3C]" />
                  <span>Payment Amount (₹) *</span>
                </label>
                <button
                  type="button"
                  onClick={handlePayFullBalance}
                  className="text-[11px] font-bold text-[#2E7D32] hover:underline"
                  data-testid="pay-full-balance-btn"
                >
                  Pay Full Balance ({formatINR(currentBalance)})
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={currentBalance}
                value={amount}
                onChange={e => {
                  setAmount(e.target.value);
                  if (error) setError('');
                }}
                placeholder={`Max: ${currentBalance}`}
                required
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold bg-[#FFFDF8] text-[#3B2921] outline-none transition-colors ${
                  isOverpayment 
                    ? 'border-[#C62828] ring-2 ring-[#FFCDD2]' 
                    : 'border-[#E4D7C8] focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C]'
                }`}
                data-testid="payment-amount-input"
                autoFocus
              />
            </div>

            {/* Payment Date & Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#3B2921] mb-1 flex items-center gap-1">
                  <Calendar size={13} className="text-[#8B5E3C]" />
                  <span>Payment Date *</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4D7C8] text-xs bg-[#FFFDF8] text-[#3B2921] focus:border-[#8B5E3C] outline-none"
                  data-testid="payment-date-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3B2921] mb-1 flex items-center gap-1">
                  <CreditCard size={13} className="text-[#8B5E3C]" />
                  <span>Payment Method *</span>
                </label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value as PaymentMode)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4D7C8] text-xs bg-[#FFFDF8] text-[#3B2921] font-semibold focus:border-[#8B5E3C] outline-none"
                  data-testid="payment-method-select"
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-xs font-bold text-[#3B2921] mb-1 flex items-center gap-1">
                <Hash size={13} className="text-[#8B5E3C]" />
                <span>Reference / Transaction ID</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g., UPI Ref, Cheque No., NEFT UTR"
                disabled={isSubmitting}
                className="w-full px-3 py-2 rounded-xl border border-[#E4D7C8] text-xs bg-[#FFFDF8] text-[#3B2921] focus:border-[#8B5E3C] outline-none"
                data-testid="payment-reference-input"
              />
            </div>

            {/* Notes / Remarks */}
            <div>
              <label className="block text-xs font-bold text-[#3B2921] mb-1 flex items-center gap-1">
                <FileText size={13} className="text-[#8B5E3C]" />
                <span>Notes / Remarks</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g., Received at counter, 2nd installment"
                disabled={isSubmitting}
                className="w-full px-3 py-2 rounded-xl border border-[#E4D7C8] text-xs bg-[#FFFDF8] text-[#3B2921] focus:border-[#8B5E3C] outline-none"
                data-testid="payment-notes-input"
              />
            </div>

            {/* Live Calculation Preview */}
            {isValidNumber && !isOverpayment && (
              <div className="p-3 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#8B5E3C] block">After this payment:</span>
                <div className="flex justify-between text-[#2C211B]">
                  <span>Total Paid:</span>
                  <span className="font-mono font-bold text-[#2E7D32]" data-testid="preview-total-paid">
                    {formatINR(previewNewPaid)}
                  </span>
                </div>
                <div className="flex justify-between text-[#2C211B]">
                  <span>Remaining Balance:</span>
                  <span className="font-mono font-bold text-[#C62828]" data-testid="preview-balance-due">
                    {formatINR(previewNewBalance)}
                  </span>
                </div>
                <div className="flex justify-between text-[#2C211B] pt-1 border-t border-[#E4D7C8]/70">
                  <span>Updated Status:</span>
                  <span className={`font-bold ${previewNewBalance === 0 ? 'text-[#2E7D32]' : 'text-[#8B5E3C]'}`} data-testid="preview-status">
                    {previewStatus}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Validation / Error Message */}
        {error && (
          <div className="p-3 rounded-xl bg-[#FFF0F0] border border-[#FFCDD2] text-[#C62828] text-xs flex items-center gap-2" data-testid="payment-error-msg">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E4D7C8]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-[#E4D7C8] text-xs font-bold text-[#3B2921] hover:bg-[#F7F3EA] transition-colors"
          >
            Cancel
          </button>
          
          {!isFullyPaid && (
            <button
              type="submit"
              disabled={isSubmitting || !isValidNumber || isOverpayment}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-colors"
              data-testid="save-payment-button"
            >
              <IndianRupee size={14} />
              <span>{isSubmitting ? 'Recording Payment...' : 'Save Payment'}</span>
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
};
