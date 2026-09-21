import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  BookOpenText, 
  Search, 
  Eye, 
  FileEdit, 
  Copy, 
  Download, 
  Trash2, 
  Plus, 
  TrendingUp, 
  Receipt, 
  Clock, 
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  IndianRupee
} from 'lucide-react';
import { useBagBill } from '../context/BagBillContext';
import { formatINR, formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { InvoicePreview } from '../components/invoice/InvoicePreview';
import { RecordPaymentModal } from '../components/invoice/RecordPaymentModal';
import { downloadInvoicePDF, printInvoice } from '../utils/pdfGenerator';
import { Invoice, PaymentStatus } from '../types';
import api from '../services/api';

export const BillBook: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { invoices, settings, deleteInvoice, duplicateInvoice, refreshFromBackend } = useBagBill();

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const initialStatus = (location.state as { statusFilter?: PaymentStatus })?.statusFilter || 'All';
  const [statusFilter, setStatusFilter] = useState<'All' | PaymentStatus>(initialStatus);
  const [partyFilter, setPartyFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<'All' | 'Today' | 'ThisMonth'>('All');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<Invoice | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Always refresh latest bills from MongoDB when Bill Book mounts
  useEffect(() => {
    refreshFromBackend().catch(err => {
      console.warn('Background bill refresh:', err.message);
    });
  }, [refreshFromBackend]);

  // View saved bill with fresh backend data
  const handleViewInvoice = async (inv: Invoice) => {
    setSelectedInvoice(inv);
    const targetId = inv.id || (inv as any)._id || inv.invoiceNumber;
    if (targetId) {
      try {
        setIsLoadingDetail(true);
        const fresh = await api.bills.getById(targetId);
        if (fresh) {
          setSelectedInvoice(fresh);
        }
      } catch (err) {
        console.warn('Backend fetch for invoice failed, displaying cached invoice', err);
      } finally {
        setIsLoadingDetail(false);
      }
    }
  };

  // Sync statusFilter if location.state changes
  useEffect(() => {
    if (location.state && (location.state as any).statusFilter) {
      setStatusFilter((location.state as any).statusFilter);
    }
  }, [location.state]);

  // Extract unique parties for the party filter dropdown
  const uniqueParties = useMemo(() => {
    const list = Array.from(new Set(invoices.map(i => i.partyName))).filter(Boolean);
    return list.sort();
  }, [invoices]);

  // Compute KPI totals from invoices
  const { totalBills, totalSales, totalPending } = useMemo(() => {
    let sales = 0;
    let pending = 0;
    invoices.forEach(inv => {
      sales += inv.grandTotal;
      if (inv.paymentStatus === 'Pending') {
        pending += (inv.balanceAmount !== undefined ? inv.balanceAmount : inv.grandTotal);
      } else if (inv.paymentStatus === 'Partial') {
        pending += (inv.balanceAmount !== undefined ? inv.balanceAmount : Math.max(0, inv.grandTotal - (inv.paidAmount || 0)));
      }
    });
    return {
      totalBills: invoices.length,
      totalSales: sales,
      totalPending: pending,
    };
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Search term
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.partyName.toLowerCase().includes(q) ||
        (inv.partyPhone && inv.partyPhone.toLowerCase().includes(q)) ||
        (inv.phone && inv.phone.toLowerCase().includes(q)) ||
        (inv.partyGstin && inv.partyGstin.toLowerCase().includes(q)) ||
        inv.items.some(it => it.bagType.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter !== 'All' && inv.paymentStatus !== statusFilter) {
        return false;
      }

      // Party filter
      if (partyFilter !== 'All' && inv.partyName !== partyFilter) {
        return false;
      }

      // Date filter
      if (dateRange === 'Today') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (inv.date !== todayStr) return false;
      } else if (dateRange === 'ThisMonth') {
        const currMonth = new Date().toISOString().slice(0, 7);
        if (!inv.date.startsWith(currMonth)) return false;
      }

      return true;
    });
  }, [invoices, searchTerm, statusFilter, partyFilter, dateRange]);

  // Sorting State
  type SortField = 'date' | 'party' | 'amount';
  type SortOrder = 'asc' | 'desc';

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField === field) {
      return sortOrder === 'asc' ? (
        <span className="inline-flex items-center text-[#3B2921] font-bold text-[11px] bg-[#3B2921]/10 px-1 py-0.5 rounded shadow-2xs" title="Ascending">
          <ArrowUp size={12} className="stroke-[2.5]" />
        </span>
      ) : (
        <span className="inline-flex items-center text-[#3B2921] font-bold text-[11px] bg-[#3B2921]/10 px-1 py-0.5 rounded shadow-2xs" title="Descending">
          <ArrowDown size={12} className="stroke-[2.5]" />
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[#8B5E3C]/40 group-hover:text-[#8B5E3C] transition-colors">
        <ArrowUpDown size={11} />
      </span>
    );
  };

  // Sorted and filtered invoices
  const sortedAndFilteredInvoices = useMemo(() => {
    const list = [...filteredInvoices];

    if (!sortField) {
      // Default sort: newest invoices first by createdAt / date
      list.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.date).getTime() || 0;
        const timeB = new Date(b.createdAt || b.date).getTime() || 0;
        return timeB - timeA;
      });
      return list;
    }

    list.sort((a, b) => {
      if (sortField === 'date') {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        if (timeA !== timeB) {
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
        const secA = new Date(a.createdAt || a.date).getTime() || 0;
        const secB = new Date(b.createdAt || b.date).getTime() || 0;
        return sortOrder === 'asc' ? secA - secB : secB - secA;
      }

      if (sortField === 'party') {
        const nameA = (a.partyName || '').trim();
        const nameB = (b.partyName || '').trim();
        const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      if (sortField === 'amount') {
        const amtA = typeof a.grandTotal === 'number' ? a.grandTotal : parseFloat(String(a.grandTotal) || '0') || 0;
        const amtB = typeof b.grandTotal === 'number' ? b.grandTotal : parseFloat(String(b.grandTotal) || '0') || 0;
        return sortOrder === 'asc' ? amtA - amtB : amtB - amtA;
      }

      return 0;
    });

    return list;
  }, [filteredInvoices, sortField, sortOrder]);

  const handleDelete = (id: string, invoiceNum: string) => {
    if (window.confirm(`Are you sure you want to delete ${invoiceNum}? This cannot be undone.`)) {
      deleteInvoice(id);
    }
  };

  const handleDuplicate = (id: string) => {
    const dup = duplicateInvoice(id);
    if (dup) {
      setSelectedInvoice(dup);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#3B2921] text-[#C99563]">
              <BookOpenText size={20} />
            </span>
            <div>
              <h2 className="text-xl font-black text-[#3B2921]">Digital Bill Book</h2>
              <p className="text-xs text-[#8B5E3C]">
                Your permanent digital replacement for physical calculation books and handwritten bills
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/create-bill')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs md:text-sm shadow-sm transition-all active:scale-95"
        >
          <Plus size={16} className="text-[#C99563]" />
          <span>+ Create New Bill</span>
        </button>
      </div>

      {/* KPI Cards: Total Bills, Total Sales, Pending Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E4D7C8] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B5E3C] uppercase tracking-wider">Total Bills</span>
            <Receipt size={18} className="text-[#8B5E3C]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#3B2921] mt-2">
            {totalBills}
          </div>
          <p className="text-[11px] text-[#8B5E3C] mt-0.5">Invoices recorded in digital ledger</p>
        </div>

        <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E4D7C8] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B5E3C] uppercase tracking-wider">Total Sales</span>
            <TrendingUp size={18} className="text-[#4F7D5A]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#3B2921] mt-2">
            {formatINR(totalSales)}
          </div>
          <p className="text-[11px] text-[#4F7D5A] font-semibold mt-0.5">Cumulative billings</p>
        </div>

        <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E4D7C8] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8B5E3C] uppercase tracking-wider">Pending Amount</span>
            <Clock size={18} className="text-[#B94A48]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#B94A48] mt-2">
            {formatINR(totalPending)}
          </div>
          <p className="text-[11px] text-[#B94A48] font-semibold mt-0.5">Awaiting settlement from parties</p>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Bar */}
          <div className="sm:col-span-5 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B5E3C]" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search party, invoice number or phone number..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] focus:border-[#3B2921] text-xs font-medium text-[#2C211B] outline-none"
            />
          </div>

          {/* Payment Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs font-bold text-[#3B2921] outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid Only</option>
              <option value="Pending">Pending Only</option>
              <option value="Partial">Partial Only</option>
            </select>
          </div>

          {/* Party Filter */}
          <div className="sm:col-span-2">
            <select
              value={partyFilter}
              onChange={e => setPartyFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs font-bold text-[#3B2921] outline-none"
            >
              <option value="All">All Parties</option>
              {uniqueParties.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="sm:col-span-2">
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs font-bold text-[#3B2921] outline-none"
            >
              <option value="All">All Dates</option>
              <option value="Today">Today Only</option>
              <option value="ThisMonth">This Month</option>
            </select>
          </div>
        </div>

        {/* Filter Badges Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8B5E3C] pt-1 border-t border-[#E4D7C8]/60">
          <div className="flex flex-wrap items-center gap-2">
            <span>Showing {sortedAndFilteredInvoices.length} of {invoices.length} bills in ledger</span>
            {sortField && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#3B2921]/10 text-[#3B2921] border border-[#3B2921]/20">
                <span>
                  Sorted by {sortField === 'date' ? 'Date' : sortField === 'party' ? 'Party' : 'Amount'}{' '}
                  {sortOrder === 'asc' 
                    ? (sortField === 'date' ? '(Oldest → Newest)' : sortField === 'party' ? '(A → Z)' : '(Lowest → Highest)')
                    : (sortField === 'date' ? '(Newest → Oldest)' : sortField === 'party' ? '(Z → A)' : '(Highest → Lowest)')}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSortField(null); setSortOrder('asc'); }}
                  className="hover:text-[#B94A48] text-[11px] font-black"
                  title="Reset sort to default"
                  data-testid="reset-sort-button"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          {(searchTerm || statusFilter !== 'All' || partyFilter !== 'All' || dateRange !== 'All' || sortField !== null) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setPartyFilter('All');
                setDateRange('All');
                setSortField(null);
                setSortOrder('asc');
              }}
              className="text-[#B94A48] font-bold hover:underline"
              data-testid="clear-filters-button"
            >
              Clear Filters & Sort
            </button>
          )}
        </div>
      </div>

      {/* Bill Book Table */}
      <div className="bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F7F3EA] border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider select-none">
                <th className="py-3.5 px-4">Invoice No.</th>
                
                {/* Date Sort Header */}
                <th 
                  onClick={() => handleSort('date')}
                  data-testid="sort-date-header"
                  className="py-3.5 px-4 cursor-pointer hover:text-[#3B2921] transition-colors group"
                  title="Click to sort chronologically (First: Oldest → Newest, Second: Newest → Oldest)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Date</span>
                    {renderSortIcon('date')}
                  </div>
                </th>

                {/* Party Sort Header */}
                <th 
                  onClick={() => handleSort('party')}
                  data-testid="sort-party-header"
                  className="py-3.5 px-4 cursor-pointer hover:text-[#3B2921] transition-colors group"
                  title="Click to sort alphabetically (First: A → Z, Second: Z → A)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Party</span>
                    {renderSortIcon('party')}
                  </div>
                </th>

                <th className="py-3.5 px-4">Items / Bags</th>

                {/* Amount Sort Header */}
                <th 
                  onClick={() => handleSort('amount')}
                  data-testid="sort-amount-header"
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-[#3B2921] transition-colors group"
                  title="Click to sort numerically (First: Lowest → Highest, Second: Highest → Lowest)"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Amount</span>
                    {renderSortIcon('amount')}
                  </div>
                </th>

                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4D7C8]">
              {sortedAndFilteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#8B5E3C]">
                    <Receipt size={32} className="opacity-30 mx-auto mb-2" />
                    <p className="font-bold">No bills found</p>
                    <p className="text-[11px] opacity-80">Try adjusting your search or create a new bill.</p>
                  </td>
                </tr>
              ) : (
                sortedAndFilteredInvoices.map(inv => {
                  const bagSummary = inv.items.map(i => `${i.quantity} ${i.bagType}`).join(', ');
                  const totalQty = inv.items.reduce((s, it) => s + (it.quantity || 0), 0);

                  return (
                    <tr key={inv.id} className="hover:bg-[#F7F3EA]/50 transition-colors group">
                      {/* Invoice No */}
                      <td 
                        onClick={() => handleViewInvoice(inv)}
                        className="py-3.5 px-4 font-mono font-bold text-sm text-[#3B2921] cursor-pointer hover:underline hover:text-[#8B5E3C]"
                        title="Click to view full bill details"
                        data-testid={`invoice-cell-${inv.invoiceNumber}`}
                      >
                        {inv.invoiceNumber}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-[#8B5E3C]">
                        {formatDate(inv.date)}
                      </td>

                      {/* Party */}
                      <td className="py-3.5 px-4 font-bold text-[#3B2921]">
                        <div>{inv.partyName}</div>
                        {inv.partyPhone && (
                          <div className="text-[10px] text-[#8B5E3C] font-normal">{inv.partyPhone}</div>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="truncate text-[#2C211B] font-medium" title={bagSummary}>
                          {bagSummary}
                        </div>
                        <div className="text-[10px] text-[#8B5E3C]">
                          Total: {totalQty.toLocaleString('en-IN')} bags
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-[#3B2921]">
                        {formatINR(inv.grandTotal)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={inv.paymentStatus} size="sm" />
                        {inv.paymentStatus !== 'Paid' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentTargetInvoice(inv);
                            }}
                            className="mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#2E7D32]/10 hover:bg-[#2E7D32]/20 text-[#2E7D32] border border-[#2E7D32]/30 flex items-center justify-center gap-0.5 mx-auto transition-colors"
                            title="Record Payment for this bill"
                            data-testid={`record-payment-${inv.invoiceNumber}`}
                          >
                            <IndianRupee size={10} />
                            <span>Record Pay</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {inv.paymentStatus !== 'Paid' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentTargetInvoice(inv);
                              }}
                              className="p-1.5 text-[#2E7D32] hover:text-[#1B5E20] hover:bg-[#E8F5E9] rounded-lg transition-colors"
                              title="Record Payment"
                              data-testid={`action-record-payment-${inv.invoiceNumber}`}
                            >
                              <IndianRupee size={16} />
                            </button>
                          ) : (
                            <button
                              disabled
                              className="p-1.5 text-[#A0938A]/30 cursor-not-allowed rounded-lg"
                              title="Invoice is fully settled"
                              data-testid={`action-paid-${inv.invoiceNumber}`}
                            >
                              <IndianRupee size={16} />
                            </button>
                          )}

                          <button
                            onClick={() => handleViewInvoice(inv)}
                            className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                            title="View Full Invoice"
                            data-testid={`view-invoice-${inv.invoiceNumber}`}
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            onClick={() => navigate('/create-bill', { state: { editInvoice: inv } })}
                            className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                            title="Edit Invoice"
                          >
                            <FileEdit size={16} />
                          </button>

                          <button
                            onClick={() => handleDuplicate(inv.id)}
                            className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                            title="Duplicate Bill"
                          >
                            <Copy size={16} />
                          </button>

                          <button
                            onClick={() => downloadInvoicePDF(inv, settings)}
                            className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                            title="Download PDF"
                          >
                            <Download size={16} />
                          </button>

                          <button
                            onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                            className="p-1.5 text-[#8B5E3C] hover:text-[#B94A48] hover:bg-[#B94A48]/10 rounded-lg transition-colors"
                            title="Delete Bill"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Invoice Modal Dialog */}
      {selectedInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInvoice(null)}
          title={`Digital Ledger — ${selectedInvoice.invoiceNumber}`}
          subtitle={`Issued to ${selectedInvoice.partyName} on ${formatDate(selectedInvoice.date)}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2.5 no-print">
              {isLoadingDetail && (
                <span className="text-xs text-[#8A7561] animate-pulse mr-auto font-medium">
                  Refreshing latest details...
                </span>
              )}
              {selectedInvoice.paymentStatus !== 'Paid' && (
                <button
                  onClick={() => setPaymentTargetInvoice(selectedInvoice)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2E7D32] text-white font-bold text-xs hover:bg-[#1B5E20] transition-colors shadow-xs"
                  data-testid="modal-record-payment-btn"
                >
                  <IndianRupee size={14} />
                  <span>Record Payment</span>
                </button>
              )}
              <button
                onClick={() => printInvoice()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F7F3EA] text-[#3B2921] border border-[#E4D7C8] font-bold text-xs hover:bg-[#EAE2D2] transition-colors"
              >
                <Printer size={14} />
                <span>Print</span>
              </button>
              <button
                onClick={() => downloadInvoicePDF(selectedInvoice, settings)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3B2921] text-[#FFFDF8] font-bold text-xs hover:bg-[#4E372C] transition-colors"
              >
                <Download size={14} />
                <span>Download PDF</span>
              </button>
            </div>

            <InvoicePreview 
              invoice={selectedInvoice} 
              settings={settings} 
            />
          </div>
        </Modal>
      )}

      {/* Record Payment Modal Dialog */}
      <RecordPaymentModal
        isOpen={!!paymentTargetInvoice}
        onClose={() => setPaymentTargetInvoice(null)}
        invoice={paymentTargetInvoice}
        onPaymentSuccess={(updated) => {
          if (selectedInvoice && (selectedInvoice.id === updated.id || (selectedInvoice as any)._id === updated.id || selectedInvoice.invoiceNumber === updated.invoiceNumber)) {
            setSelectedInvoice(updated);
          }
        }}
      />
    </div>
  );
};
