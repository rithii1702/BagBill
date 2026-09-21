import React from 'react';
import { Invoice, BusinessSettings } from '../../types';
import { formatINR, formatDate } from '../../utils/formatters';
import { numberToWordsINR } from '../../utils/numberToWords';
import { StatusBadge } from '../common/StatusBadge';
import { CheckCircle2, ShieldCheck, Receipt } from 'lucide-react';

interface InvoicePreviewProps {
  invoice: Invoice;
  settings: BusinessSettings;
  className?: string;
  isCompact?: boolean;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  invoice,
  settings,
  className = '',
  isCompact = false,
}) => {
  const words = numberToWordsINR(invoice.grandTotal || 0);

  // Resolve business details from historical invoice snapshot, falling back to active settings
  const business: BusinessSettings = {
    ...settings,
    ...(invoice.businessSnapshot || {}),
  };

  // Resolve bank details snapshot from invoice, falling back to business snapshot or settings
  const bankDetails = invoice.bankDetails;
  const showBank = bankDetails?.showBankDetails ?? business.showBankDetailsOnInvoice ?? true;
  const bankName = bankDetails?.bankName || business.bankName;
  const accountHolder = bankDetails?.accountHolderName || business.accountHolderName || business.businessName;
  const accountNumber = bankDetails?.bankAccountNumber || bankDetails?.accountNumber || business.bankAccountNumber;
  const ifscCode = bankDetails?.bankIfsc || bankDetails?.ifscCode || business.bankIfsc;
  const upiId = bankDetails?.upiId || business.upiId;

  // Payment math
  const grandTotal = invoice.grandTotal || 0;
  const paidAmount = invoice.paidAmount !== undefined
    ? invoice.paidAmount
    : (invoice.paymentStatus === 'Paid' ? grandTotal : 0);
  const balanceDue = invoice.balanceAmount !== undefined
    ? invoice.balanceAmount
    : (invoice.paymentStatus === 'Paid' ? 0 : Math.max(0, grandTotal - paidAmount));

  return (
    <div 
      className={`relative bg-[#FFFDF8] border-2 border-[#E4D7C8] rounded-2xl p-5 sm:p-8 shadow-sm text-[#2C211B] font-sans paper-texture ${className}`}
      id="printable-invoice"
    >
      {/* Decorative top ledger binding strip */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-[#8B5E3C]/25 rounded-t-2xl border-b border-[#E4D7C8]" />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-[#3B2921]">
        {/* Left: Supplier Info */}
        <div className="flex items-start gap-3">
          {business.showBusinessLogo !== false && (
            business.logoUrl ? (
              <img 
                src={business.logoUrl} 
                alt={business.businessName} 
                className="w-12 h-12 rounded-xl object-contain shadow-xs shrink-0 border border-[#8B5E3C] bg-white p-0.5" 
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#3B2921] text-[#C99563] flex items-center justify-center font-black text-xl shadow-xs shrink-0 border border-[#8B5E3C]">
                {business.logoText || 'BB'}
              </div>
            )
          )}
          <div>
            <h2 className="text-lg md:text-xl font-black text-[#3B2921] uppercase tracking-tight leading-tight">
              {business.businessName}
            </h2>
            {business.tagline && (
              <p className="text-xs text-[#8B5E3C] font-semibold mt-0.5">
                {business.tagline}
              </p>
            )}
            <p className="text-xs text-[#2C211B]/80 mt-1 leading-relaxed">
              {business.address}, {business.city}, {business.state} - {business.pincode}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#2C211B]/90 mt-1">
              <span><strong>Phone:</strong> {business.phone}</span>
              <span><strong>Email:</strong> {business.email}</span>
              {business.website && <span><strong>Web:</strong> {business.website}</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 text-xs font-bold text-[#3B2921] mt-1 bg-[#F7F3EA] px-2 py-0.5 rounded-md inline-block border border-[#E4D7C8]">
              <span>GSTIN: <span className="font-mono">{business.gstin}</span></span>
              {business.panNumber && <span>PAN: <span className="font-mono">{business.panNumber}</span></span>}
            </div>
          </div>
        </div>

        {/* Right: Tax Invoice Badge & Metadata */}
        <div className="text-left sm:text-right shrink-0 w-full sm:w-auto bg-[#F7F3EA]/70 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-[#E4D7C8]">
          <div className="inline-block bg-[#3B2921] text-[#FFFDF8] px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider mb-1">
            TAX INVOICE
          </div>
          <p className="text-[10px] text-[#8B5E3C] font-bold uppercase tracking-widest">
            Original for Recipient
          </p>

          <div className="mt-3 text-xs space-y-1">
            <div className="flex sm:justify-end gap-2">
              <span className="text-[#8B5E3C] font-semibold">Invoice No:</span>
              <span className="font-bold font-mono text-[#3B2921]">{invoice.invoiceNumber || 'INV-00000'}</span>
            </div>
            <div className="flex sm:justify-end gap-2">
              <span className="text-[#8B5E3C] font-semibold">Date:</span>
              <span className="font-bold text-[#3B2921]">{formatDate(invoice.date)}</span>
            </div>
            <div className="flex sm:justify-end gap-2">
              <span className="text-[#8B5E3C] font-semibold">Place of Supply:</span>
              <span className="font-semibold text-[#3B2921]">{business.state}</span>
            </div>
            <div className="flex sm:justify-end gap-2 items-center pt-1">
              <span className="text-[#8B5E3C] font-semibold">Status:</span>
              <StatusBadge status={invoice.paymentStatus} size="sm" />
            </div>
            {invoice.paymentMode && (
              <div className="flex sm:justify-end gap-2">
                <span className="text-[#8B5E3C] font-semibold">Mode:</span>
                <span className="font-semibold text-[#3B2921]">{invoice.paymentMode}</span>
              </div>
            )}
            {invoice.isRcm && (
              <div className="flex sm:justify-end gap-2">
                <span className="text-[#C98232] font-semibold">RCM:</span>
                <span className="font-bold text-[#C98232]">Applicable</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill To Section */}
      <div className="my-5 p-4 rounded-xl bg-[#F7F3EA]/70 border border-[#E4D7C8] flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-black tracking-wider text-[#8B5E3C]">
            BILL TO / BUYER DETAILS
          </span>
          <h3 className="text-base font-bold text-[#3B2921] mt-0.5">
            {invoice.partyName || 'Cash / Counter Customer'}
          </h3>
          <p className="text-xs text-[#2C211B]/80 mt-0.5 leading-relaxed">
            {invoice.partyAddress || 'Local Market'}
          </p>
          <p className="text-xs text-[#2C211B]/80 mt-0.5">
            <strong>Contact:</strong> {invoice.partyPhone || 'N/A'}
          </p>
        </div>

        {invoice.partyGstin && (
          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase font-black tracking-wider text-[#8B5E3C]">
              Party GSTIN
            </span>
            <p className="font-mono text-xs font-bold text-[#3B2921] mt-0.5">
              {invoice.partyGstin}
            </p>
            {invoice.vehicleNumber && (
              <p className="text-xs text-[#8B5E3C] mt-2">
                <strong>Vehicle:</strong> {invoice.vehicleNumber}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Line Items Table */}
      <div className="overflow-x-auto my-4 border border-[#E4D7C8] rounded-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#8B5E3C] text-[#FFFDF8] font-bold">
              <th className="py-2.5 px-3 w-8 text-center">#</th>
              <th className="py-2.5 px-3">Bag Description</th>
              <th className="py-2.5 px-3 text-center">HSN/SAC</th>
              <th className="py-2.5 px-3 text-right">Qty</th>
              <th className="py-2.5 px-3 text-right">Rate (₹)</th>
              <th className="py-2.5 px-3 text-right">Disc %</th>
              <th className="py-2.5 px-3 text-right">GST %</th>
              <th className="py-2.5 px-3 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4D7C8]">
            {invoice.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-6 text-[#8B5E3C] italic">
                  No bag items added yet. Add bags from the order form.
                </td>
              </tr>
            ) : (
              invoice.items.map((item, index) => (
                <tr 
                  key={item.id || index} 
                  className={index % 2 === 0 ? 'bg-[#FFFDF8]' : 'bg-[#F7F3EA]/40'}
                >
                  <td className="py-2.5 px-3 text-center text-[#8B5E3C] font-mono">{index + 1}</td>
                  <td className="py-2.5 px-3 font-semibold text-[#3B2921]">
                    <div>{item.bagType}</div>
                    {item.description && (
                      <div className="text-[10px] text-[#8B5E3C] font-normal">{item.description}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[#8B5E3C]">{item.hsnCode || '6305'}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    {item.quantity.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-[#8B5E3C]">{item.unit || 'pcs'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{item.pricePerBag.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#8B5E3C]">{item.discountPercent || 0}%</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#8B5E3C]">{item.gstRate}%</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#3B2921]">
                    {formatINR(item.totalAmount, false)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary & Tax Split Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-4 pt-2">
        {/* Left Col: Amount in Words & Bank Info */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-4">
          {/* Amount in words */}
          <div className="p-3.5 rounded-xl bg-[#F7F3EA]/70 border border-[#E4D7C8]">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#8B5E3C]">
              TOTAL AMOUNT IN WORDS
            </span>
            <p className="text-xs font-bold text-[#3B2921] mt-1 leading-snug">
              {words}
            </p>
          </div>

          {/* Bank Payment Details */}
          {showBank && (
            <div className="p-3.5 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#8B5E3C] mb-1.5">
                <ShieldCheck size={14} className="text-[#4F7D5A]" />
                <span className="text-[11px] uppercase tracking-wider">Bank Details for Direct Payment</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[#2C211B]/90">
                <div><span className="text-[#8B5E3C]">Bank:</span> <span className="font-semibold">{bankName}</span></div>
                {accountHolder && (
                  <div><span className="text-[#8B5E3C]">A/C Holder:</span> <span className="font-semibold">{accountHolder}</span></div>
                )}
                <div><span className="text-[#8B5E3C]">A/C No:</span> <span className="font-mono font-bold">{accountNumber}</span></div>
                <div><span className="text-[#8B5E3C]">IFSC:</span> <span className="font-mono">{ifscCode}</span></div>
                {upiId && (
                  <div className="sm:col-span-2"><span className="text-[#8B5E3C]">UPI ID:</span> <span className="font-mono font-bold text-[#3B2921]">{upiId}</span></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Calculations & Totals */}
        <div className="md:col-span-5 bg-[#F7F3EA] rounded-xl p-4 border border-[#E4D7C8] space-y-2 text-xs">
          <div className="flex justify-between text-[#2C211B]">
            <span className="text-[#8B5E3C]">Items Subtotal:</span>
            <span className="font-mono font-semibold">{formatINR(invoice.subtotal)}</span>
          </div>

          {invoice.totalDiscount > 0 && (
            <div className="flex justify-between text-[#B94A48]">
              <span>Total Discount:</span>
              <span className="font-mono font-semibold">-{formatINR(invoice.totalDiscount)}</span>
            </div>
          )}

          <div className="flex justify-between text-[#2C211B] pt-1 border-t border-[#E4D7C8]/70">
            <span className="text-[#8B5E3C] font-semibold">Taxable Amount:</span>
            <span className="font-mono font-bold text-[#3B2921]">{formatINR(invoice.taxableAmount)}</span>
          </div>

          {/* Tax Breakdown */}
          {invoice.taxMode === 'IGST' ? (
            <div className="flex justify-between text-[#2C211B]">
              <span className="text-[#8B5E3C]">IGST:</span>
              <span className="font-mono font-semibold">{formatINR(invoice.igstTotal)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-[#2C211B]">
                <span className="text-[#8B5E3C]">CGST:</span>
                <span className="font-mono font-semibold">{formatINR(invoice.cgstTotal)}</span>
              </div>
              <div className="flex justify-between text-[#2C211B]">
                <span className="text-[#8B5E3C]">SGST:</span>
                <span className="font-mono font-semibold">{formatINR(invoice.sgstTotal)}</span>
              </div>
            </>
          )}

          {invoice.roundOff !== 0 && (
            <div className="flex justify-between text-[#8B5E3C]">
              <span>Round Off:</span>
              <span className="font-mono">{invoice.roundOff > 0 ? `+${invoice.roundOff.toFixed(2)}` : invoice.roundOff.toFixed(2)}</span>
            </div>
          )}

          {/* Grand Total Highlight */}
          <div className="flex justify-between items-baseline pt-2 border-t-2 border-[#3B2921] text-[#3B2921]">
            <span className="font-black text-sm uppercase tracking-wider">Grand Total:</span>
            <span className="font-black text-xl font-mono text-[#3B2921]">
              {formatINR(invoice.grandTotal)}
            </span>
          </div>

          {/* Payment breakdown - Positive values, zero negative signs */}
          {invoice.paymentStatus === 'Partial' && (
            <div className="pt-1.5 mt-1 border-t border-dashed border-[#E4D7C8] space-y-1">
              <div className="flex justify-between text-[#4F7D5A] font-semibold">
                <span>Total Paid:</span>
                <span className="font-mono">{formatINR(paidAmount)}</span>
              </div>
              <div className="flex justify-between text-[#B94A48] font-bold">
                <span>Balance Due:</span>
                <span className="font-mono">{formatINR(balanceDue)}</span>
              </div>
            </div>
          )}

          {invoice.paymentStatus === 'Paid' && (
            <div className="pt-1.5 mt-1 border-t border-dashed border-[#E4D7C8] space-y-1">
              <div className="flex justify-between text-[#4F7D5A] font-semibold">
                <span>Total Paid:</span>
                <span className="font-mono">{formatINR(paidAmount || grandTotal)}</span>
              </div>
              <div className="flex justify-between text-[#4F7D5A] font-bold">
                <span>Balance Due:</span>
                <span className="font-mono">{formatINR(0)}</span>
              </div>
            </div>
          )}

          {invoice.paymentStatus === 'Pending' && (
            <div className="pt-1.5 mt-1 border-t border-dashed border-[#E4D7C8] space-y-1">
              <div className="flex justify-between text-[#8B5E3C]">
                <span>Total Paid:</span>
                <span className="font-mono">{formatINR(0)}</span>
              </div>
              <div className="flex justify-between text-[#B94A48] font-bold">
                <span>Balance Due:</span>
                <span className="font-mono">{formatINR(balanceDue || grandTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment History & Receipts Section */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="my-6 p-4 rounded-xl bg-[#F7F3EA]/70 border border-[#E4D7C8] text-xs" data-testid="payment-history-section">
          <div className="flex items-center justify-between font-bold text-[#8B5E3C] mb-2 pb-1 border-b border-[#E4D7C8]/70">
            <div className="flex items-center gap-1.5">
              <Receipt size={14} className="text-[#8B5E3C]" />
              <span className="uppercase tracking-wider text-[11px]">Payment History & Receipts</span>
            </div>
            <span className="text-[11px] font-semibold text-[#3B2921]">
              {invoice.payments.length} {invoice.payments.length === 1 ? 'Entry' : 'Entries'} Recorded
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-[#8B5E3C] border-b border-[#E4D7C8]/60">
                  <th className="py-1.5 px-2">#</th>
                  <th className="py-1.5 px-2">Date</th>
                  <th className="py-1.5 px-2">Mode</th>
                  <th className="py-1.5 px-2">Reference / Notes</th>
                  <th className="py-1.5 px-2 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4D7C8]/40">
                {invoice.payments.map((p, idx) => (
                  <tr key={p.id || p._id || idx} className="hover:bg-[#FFFDF8]/60 transition-colors">
                    <td className="py-2 px-2 font-mono text-[#8B5E3C]">{idx + 1}</td>
                    <td className="py-2 px-2 font-medium">{formatDate(p.date)}</td>
                    <td className="py-2 px-2 font-bold text-[#3B2921]">{p.method || 'Cash'}</td>
                    <td className="py-2 px-2 text-[#8B5E3C]">
                      {p.reference ? <span className="font-mono font-semibold">{p.reference}</span> : ''}
                      {p.reference && p.notes ? ' • ' : ''}
                      {p.notes || (!p.reference ? '—' : '')}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-[#2E7D32]">
                      +{formatINR(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#3B2921] font-bold text-[#3B2921]">
                  <td colSpan={4} className="py-2 px-2 text-right uppercase text-[10px] tracking-wider">
                    Total Payments Received:
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-sm text-[#2E7D32]">
                    {formatINR(paidAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Footer Notes & Signatures */}
      <div className="mt-8 pt-4 border-t border-[#E4D7C8] flex flex-col sm:flex-row justify-between items-end gap-6 text-xs">
        {business.showTermsAndConditions !== false && (
          <div className="max-w-md text-[11px] text-[#8B5E3C]">
            <p className="font-bold uppercase tracking-wider text-[#3B2921] mb-0.5">Terms & Conditions:</p>
            <p className="whitespace-pre-line leading-relaxed">
              {invoice.notes || business.termsAndConditions}
            </p>
          </div>
        )}

        {/* Authorized Signatory Box */}
        {business.showSignatureSection !== false && (
          <div className="text-center shrink-0 min-w-[180px] pt-4 ml-auto">
            <div className="h-10 border-b border-dashed border-[#8B5E3C]/60 flex items-end justify-center pb-1">
              <span className="font-serif italic text-xs text-[#8B5E3C]/70">Signature & Seal</span>
            </div>
            <p className="text-[10px] font-bold text-[#3B2921] mt-1.5 uppercase">
              For {business.businessName}
            </p>
            <p className="text-[9px] text-[#8B5E3C]">
              {business.authorizedSignatoryName ? `${business.authorizedSignatoryName} (${business.authorizedSignatoryDesignation || 'Proprietor'})` : business.authorizedSignatoryText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
