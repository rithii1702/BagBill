import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  FileText, 
  Receipt,
  FilePlus2,
  Trash2,
  Edit2,
  Eye,
  Download,
  Printer,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  Building2,
  ShieldAlert
} from 'lucide-react';
import { useBagBill } from '../context/BagBillContext';
import { Party, Invoice } from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { InvoicePreview } from '../components/invoice/InvoicePreview';
import { downloadInvoicePDF, printInvoice } from '../utils/pdfGenerator';

interface PartyComputedStats {
  totalBills: number;
  totalPurchases: number;
  paidAmount: number;
  outstanding: number;
  lastTransactionDate: string;
  bills: Invoice[];
}

export const PartiesPage: React.FC = () => {
  const navigate = useNavigate();
  const { parties, invoices, settings, addParty, updateParty, deleteParty, archiveParty } = useBagBill();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'all'>('active');

  // Ledger Drawer / Modal State
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<Party | null>(null);

  // Invoice Preview Modal inside Ledger State
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Add / Edit Modal State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // Delete Warning Modal State (for parties with existing transaction records)
  const [deleteWarningParty, setDeleteWarningParty] = useState<{ party: Party; billCount: number } | null>(null);

  // Form Fields State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formState, setFormState] = useState('Tamil Nadu');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // 1. CALCULATE FINANCIAL SUMMARY DYNAMICALLY FROM ACTUAL SAVED BILLS
  const partyStatsMap = useMemo(() => {
    const map = new Map<string, PartyComputedStats>();

    parties.forEach(party => {
      const normPartyName = party.name ? party.name.trim().toLowerCase() : '';
      const cleanPartyPhone = party.phone ? party.phone.replace(/\D/g, '') : '';

      // Match invoices belonging to this party
      const matchingBills = invoices.filter(inv => {
        const normInvName = inv.partyName ? inv.partyName.trim().toLowerCase() : '';
        if (normInvName && normInvName === normPartyName) return true;
        if (cleanPartyPhone && inv.partyPhone) {
          const cleanInvPhone = inv.partyPhone.replace(/\D/g, '');
          if (cleanInvPhone && cleanInvPhone === cleanPartyPhone) return true;
        }
        return false;
      });

      let purchases = 0;
      let paid = 0;
      let latestDate = '';

      matchingBills.forEach(inv => {
        const grand = inv.grandTotal || 0;
        purchases += grand;

        if (inv.paymentStatus === 'Paid') {
          paid += grand;
        } else if (inv.paymentStatus === 'Pending') {
          paid += 0;
        } else if (inv.paymentStatus === 'Partial') {
          const bal = inv.balanceAmount !== undefined ? inv.balanceAmount : Math.max(0, grand - (inv.paidAmount || 0));
          const cleared = inv.paidAmount !== undefined ? inv.paidAmount : (grand - bal);
          paid += cleared;
        }

        if (inv.date && (!latestDate || inv.date > latestDate)) {
          latestDate = inv.date;
        }
      });

      const outstanding = Math.max(0, purchases - paid);

      map.set(party.id, {
        totalBills: matchingBills.length,
        totalPurchases: purchases,
        paidAmount: paid,
        outstanding,
        lastTransactionDate: latestDate || party.lastTransactionDate || '',
        bills: matchingBills.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      });
    });

    return map;
  }, [parties, invoices]);

  // Overall Financial Totals derived from all active parties' actual bills
  const aggregateTotals = useMemo(() => {
    let totalPurchases = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalBills = 0;

    parties.forEach(p => {
      if (!p.isArchived) {
        const stats = partyStatsMap.get(p.id);
        if (stats) {
          totalPurchases += stats.totalPurchases;
          totalPaid += stats.paidAmount;
          totalOutstanding += stats.outstanding;
          totalBills += stats.totalBills;
        }
      }
    });

    return { totalPurchases, totalPaid, totalOutstanding, totalBills };
  }, [parties, partyStatsMap]);

  // Filter parties based on search query and active tab
  const filteredParties = useMemo(() => {
    return parties.filter(p => {
      // Tab filter
      if (activeTab === 'active' && p.isArchived) return false;
      if (activeTab === 'archived' && !p.isArchived) return false;

      // Dynamic search
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;

      const matchesName = p.name.toLowerCase().includes(q);
      const matchesPhone = p.phone && p.phone.toLowerCase().includes(q);
      const matchesGstin = p.gstin && p.gstin.toLowerCase().includes(q);
      const matchesEmail = p.email && p.email.toLowerCase().includes(q);
      const matchesAddress = p.address && p.address.toLowerCase().includes(q);

      return matchesName || matchesPhone || matchesGstin || matchesEmail || matchesAddress;
    });
  }, [parties, searchTerm, activeTab]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingParty(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormGstin('');
    setFormState(settings.state || 'Tamil Nadu');
    setFormNotes('');
    setFormError('');
    setIsPartyModalOpen(true);
  };

  const handleOpenEditModal = (party: Party) => {
    setEditingParty(party);
    setFormName(party.name);
    setFormPhone(party.phone || '');
    setFormEmail(party.email || '');
    setFormAddress(party.address || '');
    setFormGstin(party.gstin || '');
    setFormState(party.state || settings.state || 'Tamil Nadu');
    setFormNotes(party.notes || '');
    setFormError('');
    setIsPartyModalOpen(true);
  };

  const handleSavePartySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Party / Business name is required');
      return;
    }

    const duplicate = parties.find(p => 
      p.name.toLowerCase().trim() === cleanName.toLowerCase() && 
      p.id !== editingParty?.id &&
      !p.isArchived
    );
    if (duplicate) {
      setFormError(`An active party named "${cleanName}" already exists.`);
      return;
    }

    if (formPhone.trim()) {
      const cleanPhone = formPhone.trim().replace(/[\s\-()]/g, '');
      if (!/^(\+91|91|0)?[6-9]\d{9}$/.test(cleanPhone)) {
        setFormError('Please enter a valid Indian phone number (10 digits)');
        return;
      }
    }

    if (formEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      setFormError('Please enter a valid email address');
      return;
    }

    if (formGstin.trim()) {
      const gstinVal = formGstin.trim().toUpperCase();
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinVal)) {
        setFormError('GSTIN must be a valid 15-character alphanumeric format (e.g. 33AABCS1429B1Z8)');
        return;
      }
    }

    const payload = {
      name: cleanName,
      phone: formPhone.trim(),
      email: formEmail.trim(),
      address: formAddress.trim(),
      gstin: formGstin.trim().toUpperCase(),
      state: formState.trim(),
      notes: formNotes.trim(),
    };

    if (editingParty) {
      updateParty(editingParty.id, payload);
    } else {
      addParty(payload);
    }

    setIsPartyModalOpen(false);
  };

  const handleDeleteClick = (party: Party) => {
    const stats = partyStatsMap.get(party.id);
    const billCount = stats?.totalBills || 0;

    if (billCount > 0) {
      // Party has historical transaction records
      setDeleteWarningParty({ party, billCount });
    } else {
      if (window.confirm(`Are you sure you want to delete ${party.name}? This cannot be undone.`)) {
        deleteParty(party.id);
      }
    }
  };

  // Open Create Bill pre-filled with this party
  const handleCreateBillForParty = (party: Party) => {
    setSelectedPartyForLedger(null);
    navigate('/create-bill', {
      state: {
        editInvoice: {
          partyName: party.name,
          partyPhone: party.phone,
          partyAddress: party.address,
          partyGstin: party.gstin,
          items: [],
        }
      }
    });
  };

  // Currently viewed party ledger stats
  const activeLedgerStats = selectedPartyForLedger 
    ? partyStatsMap.get(selectedPartyForLedger.id) || {
        totalBills: 0,
        totalPurchases: 0,
        paidAmount: 0,
        outstanding: 0,
        lastTransactionDate: '',
        bills: [],
      }
    : null;

  return (
    <div className="space-y-6">
      {/* 1. HEADER BAR */}
      <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-xl bg-[#3B2921] text-[#C99563] shadow-xs">
              <Users size={22} />
            </span>
            <div>
              <h2 className="text-xl font-black text-[#3B2921]">Parties</h2>
              <p className="text-xs text-[#8B5E3C]">
                Manage customers and view their complete transaction history.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleOpenAddModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs md:text-sm shadow-sm transition-all active:scale-95 border border-[#3B2921]"
          >
            <Plus size={16} className="text-[#C99563]" />
            <span>+ Add New Party</span>
          </button>
        </div>
      </div>

      {/* 2. AGGREGATE FINANCIAL CARDS (From actual bills) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#FFFDF8] p-4.5 rounded-2xl border border-[#E4D7C8] shadow-xs">
          <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider">
            Total Customer Ledger
          </span>
          <div className="text-2xl font-black font-mono text-[#3B2921] mt-1.5">
            {formatINR(aggregateTotals.totalPurchases)}
          </div>
          <p className="text-[11px] text-[#8B5E3C] mt-0.5">
            Cumulative wholesale bag purchases
          </p>
        </div>

        <div className="bg-[#FFFDF8] p-4.5 rounded-2xl border border-[#E4D7C8] shadow-xs">
          <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider">
            Collected Payments
          </span>
          <div className="text-2xl font-black font-mono text-[#4F7D5A] mt-1.5">
            {formatINR(aggregateTotals.totalPaid)}
          </div>
          <p className="text-[11px] text-[#4F7D5A] font-semibold mt-0.5">
            Cleared cash & online receipts
          </p>
        </div>

        <div className="bg-[#FFFDF8] p-4.5 rounded-2xl border border-[#E4D7C8] shadow-xs">
          <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider">
            Total Outstanding
          </span>
          <div className="text-2xl font-black font-mono text-[#B94A48] mt-1.5">
            {formatINR(aggregateTotals.totalOutstanding)}
          </div>
          <p className="text-[11px] text-[#B94A48] font-semibold mt-0.5">
            Awaiting party settlements
          </p>
        </div>

        <div className="bg-[#FFFDF8] p-4.5 rounded-2xl border border-[#E4D7C8] shadow-xs">
          <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider">
            Active Accounts
          </span>
          <div className="text-2xl font-black font-mono text-[#3B2921] mt-1.5">
            {parties.filter(p => !p.isArchived).length}
          </div>
          <p className="text-[11px] text-[#8B5E3C] mt-0.5">
            {aggregateTotals.totalBills} total bills recorded
          </p>
        </div>
      </div>

      {/* 3. SEARCH & TAB BAR */}
      <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Dynamic Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B5E3C]" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search party, phone number or GSTIN..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] focus:border-[#3B2921] text-xs font-medium text-[#2C211B] outline-none"
            />
          </div>

          {/* Tab Filter: Active / Archived / All */}
          <div className="flex rounded-xl bg-[#F7F3EA] p-1 border border-[#E4D7C8] shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'active' ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs' : 'text-[#8B5E3C]'
              }`}
            >
              Active ({parties.filter(p => !p.isArchived).length})
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'archived' ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs' : 'text-[#8B5E3C]'
              }`}
            >
              Archived ({parties.filter(p => p.isArchived).length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'all' ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs' : 'text-[#8B5E3C]'
              }`}
            >
              All ({parties.length})
            </button>
          </div>
        </div>

        {searchTerm && (
          <div className="flex items-center justify-between text-xs text-[#8B5E3C] pt-2 border-t border-[#E4D7C8]/60">
            <span>Found {filteredParties.length} parties matching "{searchTerm}"</span>
            <button
              onClick={() => setSearchTerm('')}
              className="text-[#B94A48] font-bold hover:underline"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>

      {/* 4. PARTY LIST: TABLE (DESKTOP) & COMPACT CARDS (MOBILE) */}
      {filteredParties.length === 0 ? (
        /* Empty State */
        <div className="bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] p-12 text-center shadow-xs">
          <Building2 size={40} className="mx-auto text-[#8B5E3C]/40 mb-3" />
          <h3 className="text-base font-black text-[#3B2921]">
            {searchTerm ? 'No parties found' : 'No parties yet'}
          </h3>
          <p className="text-xs text-[#8B5E3C] max-w-sm mx-auto mt-1 mb-4">
            {searchTerm
              ? `No parties match "${searchTerm}". Check the phone number or GSTIN and try again.`
              : 'Add your first customer to start managing business transactions.'}
          </p>
          {!searchTerm ? (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs shadow-sm transition-all"
            >
              <Plus size={15} className="text-[#C99563]" />
              <span>+ Add New Party</span>
            </button>
          ) : (
            <button
              onClick={() => setSearchTerm('')}
              className="px-4 py-2 rounded-xl bg-[#F7F3EA] text-[#3B2921] font-bold text-xs border border-[#E4D7C8]"
            >
              Reset Search
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (hidden on small mobile) */}
          <div className="hidden lg:block bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F3EA] border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Party Name</th>
                    <th className="py-3.5 px-4">Phone</th>
                    <th className="py-3.5 px-4">GSTIN</th>
                    <th className="py-3.5 px-4 text-center">Total Bills</th>
                    <th className="py-3.5 px-4 text-right">Total Purchases</th>
                    <th className="py-3.5 px-4 text-right">Paid</th>
                    <th className="py-3.5 px-4 text-right">Outstanding</th>
                    <th className="py-3.5 px-4 text-center">Last Transaction</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4D7C8]">
                  {filteredParties.map(party => {
                    const stats = partyStatsMap.get(party.id) || {
                      totalBills: 0,
                      totalPurchases: 0,
                      paidAmount: 0,
                      outstanding: 0,
                      lastTransactionDate: '',
                      bills: [],
                    };

                    return (
                      <tr
                        key={party.id}
                        className="hover:bg-[#F7F3EA]/50 transition-colors group cursor-pointer"
                        onClick={() => setSelectedPartyForLedger(party)}
                      >
                        {/* Party Name */}
                        <td className="py-3.5 px-4 font-bold text-[#3B2921]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black hover:text-[#8B5E3C] transition-colors">
                              {party.name}
                            </span>
                            {party.isArchived && (
                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[#E4D7C8] text-[#8B5E3C] font-bold">
                                Archived
                              </span>
                            )}
                          </div>
                          {party.address && (
                            <div className="text-[10px] text-[#8B5E3C] truncate max-w-xs font-normal mt-0.5">
                              {party.address}
                            </div>
                          )}
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4 text-[#3B2921] font-mono">
                          {party.phone || <span className="text-[#8B5E3C]/60 italic">—</span>}
                        </td>

                        {/* GSTIN */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-[#8B5E3C]">
                          {party.gstin ? (
                            <span className="text-[#3B2921]">{party.gstin}</span>
                          ) : (
                            <span className="text-[10px] text-[#8B5E3C]/60 italic">Unregistered</span>
                          )}
                        </td>

                        {/* Total Bills */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-[#F7F3EA] border border-[#E4D7C8] font-bold font-mono text-[#3B2921]">
                            {stats.totalBills} {stats.totalBills === 1 ? 'Bill' : 'Bills'}
                          </span>
                        </td>

                        {/* Total Purchases */}
                        <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-[#3B2921]">
                          {formatINR(stats.totalPurchases)}
                        </td>

                        {/* Paid */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-[#4F7D5A]">
                          {formatINR(stats.paidAmount)}
                        </td>

                        {/* Outstanding */}
                        <td className="py-3.5 px-4 text-right font-mono font-black text-sm">
                          <span className={stats.outstanding > 0 ? 'text-[#B94A48]' : 'text-[#4F7D5A]'}>
                            {formatINR(stats.outstanding)}
                          </span>
                        </td>

                        {/* Last Transaction */}
                        <td className="py-3.5 px-4 text-center text-[#8B5E3C] font-medium">
                          {stats.lastTransactionDate ? (
                            formatDate(stats.lastTransactionDate)
                          ) : (
                            <span className="text-[10px] italic text-[#8B5E3C]/60">No transactions</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedPartyForLedger(party)}
                              className="px-2 py-1 rounded-lg bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] font-bold text-[11px] transition-colors flex items-center gap-1 border border-[#E4D7C8]"
                              title="View Party Ledger Statement"
                            >
                              <FileText size={12} className="text-[#8B5E3C]" />
                              <span>Ledger</span>
                            </button>

                            <button
                              onClick={() => handleCreateBillForParty(party)}
                              className="p-1.5 rounded-lg bg-[#3B2921] text-[#FFFDF8] hover:bg-[#4E372C] transition-colors"
                              title="Create Bill for this party"
                            >
                              <FilePlus2 size={13} className="text-[#C99563]" />
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(party)}
                              className="p-1.5 rounded-lg text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 transition-colors"
                              title="Edit Party"
                            >
                              <Edit2 size={13} />
                            </button>

                            {party.isArchived ? (
                              <button
                                onClick={() => archiveParty(party.id, false)}
                                className="p-1.5 rounded-lg text-[#4F7D5A] hover:bg-[#4F7D5A]/10 transition-colors"
                                title="Restore Party from Archive"
                              >
                                <ArchiveRestore size={13} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDeleteClick(party)}
                                className="p-1.5 rounded-lg text-[#8B5E3C] hover:text-[#B94A48] hover:bg-[#B94A48]/10 transition-colors"
                                title="Archive or Delete Party"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Responsive Cards View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
            {filteredParties.map(party => {
              const stats = partyStatsMap.get(party.id) || {
                totalBills: 0,
                totalPurchases: 0,
                paidAmount: 0,
                outstanding: 0,
                lastTransactionDate: '',
                bills: [],
              };

              return (
                <div
                  key={party.id}
                  className="bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] p-4 shadow-xs hover:border-[#C99563] transition-all space-y-3 flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Name, Phone & Quick Actions */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#E4D7C8]/70">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 
                            onClick={() => setSelectedPartyForLedger(party)}
                            className="font-black text-base text-[#3B2921] hover:text-[#8B5E3C] cursor-pointer"
                          >
                            {party.name}
                          </h3>
                          {party.isArchived && (
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[#E4D7C8] text-[#8B5E3C] font-bold">
                              Archived
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[#8B5E3C] font-mono mt-0.5">
                          <Phone size={11} />
                          <span>{party.phone || 'No phone'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(party)}
                          className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                          title="Edit Party"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(party)}
                          className="p-1.5 text-[#8B5E3C] hover:text-[#B94A48] hover:bg-[#B94A48]/10 rounded-lg transition-colors"
                          title="Archive/Delete Party"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Metadata: GSTIN, Address, Last Transaction */}
                    <div className="py-2 text-xs space-y-1 text-[#2C211B]/80">
                      {party.gstin && (
                        <div className="text-[11px] font-mono font-semibold text-[#8B5E3C]">
                          GSTIN: <span className="text-[#3B2921] font-bold">{party.gstin}</span>
                        </div>
                      )}
                      {party.address && (
                        <div className="flex items-start gap-1 text-[11px] text-[#8B5E3C]">
                          <MapPin size={12} className="shrink-0 mt-0.5" />
                          <span className="truncate">{party.address}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-[#8B5E3C]">
                        Last activity:{' '}
                        <strong>{stats.lastTransactionDate ? formatDate(stats.lastTransactionDate) : 'No transactions'}</strong>
                      </div>
                    </div>

                    {/* Financial 4-Block Grid */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs">
                      <div>
                        <span className="text-[10px] text-[#8B5E3C] font-bold uppercase block">Total Purchases</span>
                        <span className="font-mono font-bold text-[#3B2921]">{formatINR(stats.totalPurchases)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8B5E3C] font-bold uppercase block">Paid</span>
                        <span className="font-mono font-bold text-[#4F7D5A]">{formatINR(stats.paidAmount)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8B5E3C] font-bold uppercase block">Outstanding</span>
                        <span className={`font-mono font-black ${stats.outstanding > 0 ? 'text-[#B94A48]' : 'text-[#4F7D5A]'}`}>
                          {formatINR(stats.outstanding)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8B5E3C] font-bold uppercase block">Total Bills</span>
                        <span className="font-mono font-bold text-[#3B2921]">{stats.totalBills} Bills</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedPartyForLedger(party)}
                      className="flex-1 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] font-bold text-xs border border-[#E4D7C8] flex items-center justify-center gap-1 transition-colors"
                    >
                      <FileText size={13} className="text-[#8B5E3C]" />
                      <span>View Ledger</span>
                    </button>

                    <button
                      onClick={() => handleCreateBillForParty(party)}
                      className="py-2 px-3.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs flex items-center gap-1 transition-all active:scale-95"
                    >
                      <FilePlus2 size={13} className="text-[#C99563]" />
                      <span>+ Bill</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 5. PARTY PROFILE / PARTY LEDGER MODAL (Statement of Account) */}
      {selectedPartyForLedger && activeLedgerStats && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPartyForLedger(null)}
          title={`Party Ledger — ${selectedPartyForLedger.name}`}
          subtitle={`Customer account statement & transaction history`}
          maxWidth="4xl"
        >
          <div className="space-y-5 text-[#2C211B]">
            {/* Party Profile Header Box */}
            <div className="p-4 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-[#3B2921]">
                    {selectedPartyForLedger.name}
                  </h3>
                  {selectedPartyForLedger.isArchived && (
                    <span className="text-[10px] uppercase font-bold bg-[#E4D7C8] text-[#8B5E3C] px-2 py-0.5 rounded">
                      Archived
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-[#2C211B]/80 mt-1.5">
                  <div>
                    <strong className="text-[#8B5E3C]">Contact:</strong> {selectedPartyForLedger.phone || 'N/A'}
                  </div>
                  {selectedPartyForLedger.email && (
                    <div>
                      <strong className="text-[#8B5E3C]">Email:</strong> {selectedPartyForLedger.email}
                    </div>
                  )}
                  <div>
                    <strong className="text-[#8B5E3C]">GSTIN:</strong>{' '}
                    <span className="font-mono font-bold text-[#3B2921]">
                      {selectedPartyForLedger.gstin || 'Unregistered / Consumer'}
                    </span>
                  </div>
                  <div>
                    <strong className="text-[#8B5E3C]">Address:</strong>{' '}
                    {selectedPartyForLedger.address ? `${selectedPartyForLedger.address}, ${selectedPartyForLedger.state || 'Tamil Nadu'}` : 'Local Market'}
                  </div>
                </div>

                {selectedPartyForLedger.notes && (
                  <p className="text-[11px] text-[#8B5E3C] mt-2 italic bg-[#FFFDF8] p-2 rounded-lg border border-[#E4D7C8]">
                    <strong>Note:</strong> {selectedPartyForLedger.notes}
                  </p>
                )}
              </div>

              {/* Action: Create Bill */}
              <button
                onClick={() => handleCreateBillForParty(selectedPartyForLedger)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
              >
                <FilePlus2 size={15} className="text-[#C99563]" />
                <span>+ Create Bill</span>
              </button>
            </div>

            {/* Financial Summary Cards */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B5E3C] mb-2">
                Financial Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] shadow-2xs">
                  <span className="text-[10px] font-bold text-[#8B5E3C] uppercase block">Total Purchases</span>
                  <div className="text-lg font-black font-mono text-[#3B2921] mt-0.5">
                    {formatINR(activeLedgerStats.totalPurchases)}
                  </div>
                  <span className="text-[10px] text-[#8B5E3C] block">Cumulative orders</span>
                </div>

                <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] shadow-2xs">
                  <span className="text-[10px] font-bold text-[#4F7D5A] uppercase block">Amount Paid</span>
                  <div className="text-lg font-black font-mono text-[#4F7D5A] mt-0.5">
                    {formatINR(activeLedgerStats.paidAmount)}
                  </div>
                  <span className="text-[10px] text-[#4F7D5A] block">Cleared balance</span>
                </div>

                <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] shadow-2xs">
                  <span className="text-[10px] font-bold text-[#B94A48] uppercase block">Outstanding</span>
                  <div className={`text-lg font-black font-mono mt-0.5 ${activeLedgerStats.outstanding > 0 ? 'text-[#B94A48]' : 'text-[#4F7D5A]'}`}>
                    {formatINR(activeLedgerStats.outstanding)}
                  </div>
                  <span className="text-[10px] text-[#8B5E3C] block">Current balance due</span>
                </div>

                <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] shadow-2xs">
                  <span className="text-[10px] font-bold text-[#8B5E3C] uppercase block">Total Bills</span>
                  <div className="text-lg font-black font-mono text-[#3B2921] mt-0.5">
                    {activeLedgerStats.totalBills}
                  </div>
                  <span className="text-[10px] text-[#8B5E3C] block">Recorded invoices</span>
                </div>
              </div>
            </div>

            {/* Transaction History Section */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B5E3C]">
                  Transaction History ({activeLedgerStats.bills.length})
                </h4>
                <span className="text-[11px] text-[#8B5E3C]">
                  All invoices linked from Bill Book
                </span>
              </div>

              {activeLedgerStats.bills.length === 0 ? (
                <div className="bg-[#F7F3EA]/50 rounded-xl border border-dashed border-[#E4D7C8] p-8 text-center text-xs">
                  <Receipt size={32} className="mx-auto text-[#8B5E3C]/40 mb-2" />
                  <p className="font-bold text-[#3B2921]">No transactions yet</p>
                  <p className="text-[11px] text-[#8B5E3C] mt-0.5 mb-3">
                    There are no invoices recorded for {selectedPartyForLedger.name} yet.
                  </p>
                  <button
                    onClick={() => handleCreateBillForParty(selectedPartyForLedger)}
                    className="px-4 py-2 rounded-xl bg-[#3B2921] text-[#FFFDF8] font-bold text-xs"
                  >
                    + Create First Bill for {selectedPartyForLedger.name}
                  </button>
                </div>
              ) : (
                <div className="border border-[#E4D7C8] rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F7F3EA] border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 font-mono">Invoice</th>
                          <th className="py-2.5 px-3">Items</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-right">Paid</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4D7C8]">
                        {activeLedgerStats.bills.map(inv => {
                          const itemsSummary = inv.items.map(it => `${it.bagType} × ${it.quantity}`).join(', ');
                          const isPaid = inv.paymentStatus === 'Paid';
                          const isPending = inv.paymentStatus === 'Pending';
                          const paidVal = isPaid ? inv.grandTotal : (isPending ? 0 : (inv.paidAmount || 0));
                          const balVal = inv.balanceAmount !== undefined 
                            ? inv.balanceAmount 
                            : (isPaid ? 0 : isPending ? inv.grandTotal : Math.max(0, inv.grandTotal - paidVal));

                          return (
                            <tr key={inv.id} className="hover:bg-[#F7F3EA]/60 transition-colors">
                              {/* Date */}
                              <td className="py-2.5 px-3 text-[#8B5E3C] whitespace-nowrap">
                                {formatDate(inv.date)}
                              </td>

                              {/* Invoice No */}
                              <td className="py-2.5 px-3 font-mono font-bold text-[#3B2921] whitespace-nowrap">
                                {inv.invoiceNumber}
                              </td>

                              {/* Items */}
                              <td className="py-2.5 px-3 max-w-xs truncate text-[#2C211B]" title={itemsSummary}>
                                {itemsSummary}
                              </td>

                              {/* Grand Total */}
                              <td className="py-2.5 px-3 text-right font-mono font-black text-[#3B2921]">
                                {formatINR(inv.grandTotal)}
                              </td>

                              {/* Paid */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#4F7D5A]">
                                {formatINR(paidVal)}
                              </td>

                              {/* Balance */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                <span className={balVal > 0 ? 'text-[#B94A48]' : 'text-[#4F7D5A]'}>
                                  {formatINR(balVal)}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="py-2.5 px-3 text-center">
                                <StatusBadge status={inv.paymentStatus} size="sm" />
                              </td>

                              {/* Actions */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setPreviewInvoice(inv)}
                                    className="p-1 rounded text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 transition-colors"
                                    title="View Invoice"
                                  >
                                    <Eye size={13} />
                                  </button>

                                  <button
                                    onClick={() => {
                                      setSelectedPartyForLedger(null);
                                      navigate('/create-bill', { state: { editInvoice: inv } });
                                    }}
                                    className="p-1 rounded text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 transition-colors"
                                    title="Edit Bill in Create Bill"
                                  >
                                    <Edit2 size={13} />
                                  </button>

                                  <button
                                    onClick={() => printInvoice()}
                                    className="p-1 rounded text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 transition-colors"
                                    title="Print Invoice"
                                  >
                                    <Printer size={13} />
                                  </button>

                                  <button
                                    onClick={() => downloadInvoicePDF(inv, settings)}
                                    className="p-1 rounded text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 transition-colors"
                                    title="Download PDF"
                                  >
                                    <Download size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-[#E4D7C8] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedPartyForLedger(null)}
                className="px-5 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] font-bold text-xs transition-colors"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. ADD / EDIT PARTY MODAL */}
      {isPartyModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsPartyModalOpen(false)}
          title={editingParty ? `Edit Party — ${editingParty.name}` : 'Add New Customer / Party'}
          subtitle="Record customer contact & billing details for wholesale ledger"
          maxWidth="lg"
        >
          <form onSubmit={handleSavePartySubmit} className="space-y-4 text-xs">
            {formError && (
              <div className="p-3 rounded-xl bg-[#B94A48]/10 border border-[#B94A48]/30 text-[#B94A48] font-bold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{formError}</span>
              </div>
            )}

            {/* Party Name */}
            <div>
              <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                Party / Business Name <span className="text-[#B94A48]">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={e => {
                  setFormName(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="e.g. ABC Traders, Sri Venkatesh Stores"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
              />
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="e.g. orders@abctraders.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-medium text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
                />
              </div>
            </div>

            {/* GSTIN & State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  GSTIN (Optional)
                </label>
                <input
                  type="text"
                  value={formGstin}
                  onChange={e => setFormGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 33AAACB2211C1Z4"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none uppercase focus:border-[#3B2921]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  State / Place of Supply
                </label>
                <input
                  type="text"
                  value={formState}
                  onChange={e => setFormState(e.target.value)}
                  placeholder="e.g. Tamil Nadu, Karnataka"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                Address
              </label>
              <textarea
                rows={2}
                value={formAddress}
                onChange={e => setFormAddress(e.target.value)}
                placeholder="Shop address, Market Yard, Town, Pincode..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-medium text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                Notes / Special Terms
              </label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Credit terms, transport preference, contact person notes..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-medium text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-[#E4D7C8] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsPartyModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] font-bold text-xs border border-[#E4D7C8] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs shadow-sm transition-all active:scale-95 border border-[#3B2921]"
              >
                {editingParty ? 'Save Changes' : 'Save Party'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. DELETE / ARCHIVE WARNING MODAL */}
      {deleteWarningParty && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteWarningParty(null)}
          title="Party Has Existing Transaction Records"
          subtitle="Protecting historical billing and ledger records"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs text-[#2C211B]">
            <div className="p-4 rounded-xl bg-[#B94A48]/10 border border-[#B94A48]/30 flex items-start gap-3">
              <ShieldAlert size={22} className="text-[#B94A48] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-[#B94A48]">
                  Existing Invoices Found ({deleteWarningParty.billCount})
                </h4>
                <p className="mt-1 leading-relaxed text-[#2C211B]/90">
                  This party has existing transaction records. Deleting the party may affect historical records.
                </p>
                <p className="mt-1 text-[11px] text-[#8B5E3C]">
                  Instead of permanently deleting, you can <strong>Archive</strong> this customer. Archived parties will not appear as default choices for new bills, but all their historical bills and ledger statements remain safely accessible.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E4D7C8] flex flex-col sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteWarningParty(null)}
                className="px-3.5 py-2 rounded-xl bg-[#F7F3EA] text-[#3B2921] font-bold text-xs hover:bg-[#EAE2D2] order-2 sm:order-1"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  const p = deleteWarningParty.party;
                  setDeleteWarningParty(null);
                  archiveParty(p.id, true);
                }}
                className="px-4 py-2 rounded-xl bg-[#8B5E3C] hover:bg-[#724b2f] text-white font-bold text-xs flex items-center justify-center gap-1.5 order-1 sm:order-2"
              >
                <Archive size={14} />
                <span>Archive Party (Recommended)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const p = deleteWarningParty.party;
                  setDeleteWarningParty(null);
                  deleteParty(p.id);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#B94A48]/10 text-[#B94A48] hover:bg-[#B94A48]/20 font-bold text-xs border border-[#B94A48]/40 order-3"
              >
                Delete Anyway
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 8. INVOICE PREVIEW MODAL (From inside Party Ledger) */}
      {previewInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewInvoice(null)}
          title={`Invoice ${previewInvoice.invoiceNumber}`}
          subtitle={`Issued to ${previewInvoice.partyName} on ${formatDate(previewInvoice.date)}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex justify-end gap-2.5 no-print">
              <button
                onClick={() => printInvoice()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F7F3EA] text-[#3B2921] border border-[#E4D7C8] font-bold text-xs hover:bg-[#EAE2D2] transition-colors"
              >
                <Printer size={14} />
                <span>Print</span>
              </button>
              <button
                onClick={() => downloadInvoicePDF(previewInvoice, settings)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3B2921] text-[#FFFDF8] font-bold text-xs hover:bg-[#4E372C] transition-colors"
              >
                <Download size={14} />
                <span>Download PDF</span>
              </button>
            </div>

            <InvoicePreview
              invoice={previewInvoice}
              settings={settings}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
