import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Receipt, 
  Clock, 
  Calendar, 
  Plus, 
  BookOpen, 
  Eye, 
  Download, 
  FileEdit,
  ShoppingBag,
  Sparkles,
  Users,
  Package,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Printer,
  ChevronRight,
  RotateCcw,
  FilePlus2,
  ExternalLink,
  Layers
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { useBagBill } from '../context/BagBillContext';
import { formatINR, formatDate, getTodayDateString } from '../utils/formatters';
import { 
  DateFilterPeriod,
  getInvoicePaidAmount,
  getInvoiceBalance,
  calculateKPIMetrics,
  getDateRangeBounds,
  filterInvoicesByDate,
  calculateTrendData,
  calculatePaymentOverview,
  aggregateProductSales,
  aggregatePartySales,
  getOutstandingInvoices
} from '../utils/analytics';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { InvoicePreview } from '../components/invoice/InvoicePreview';
import { downloadInvoicePDF, printInvoice } from '../utils/pdfGenerator';
import { Invoice, Party, PaymentStatus } from '../types';
import api from '../services/api';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { invoices, parties, settings, refreshFromBackend } = useBagBill();

  // --- FILTER STATES ---
  const [filterPeriod, setFilterPeriod] = useState<DateFilterPeriod>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [trendGrouping, setTrendGrouping] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [trendMetric, setTrendMetric] = useState<'sales' | 'bills'>('sales');
  const [topProductSortBy, setTopProductSortBy] = useState<'quantity' | 'revenue'>('quantity');

  // --- BACKEND ANALYTICS STATE ---
  const [backendData, setBackendData] = useState<any>(null);
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Sync latest MongoDB bills on mount
  useEffect(() => {
    refreshFromBackend().catch(err => {
      console.warn('Dashboard backend sync:', err.message);
    });
  }, [refreshFromBackend]);

  // Fetch MongoDB backend analytics aggregation
  useEffect(() => {
    let isMounted = true;
    const fetchAnalytics = async () => {
      setIsLoadingBackend(true);
      setBackendError(null);
      try {
        const res = await api.dashboard.getSummary({
          period: filterPeriod,
          startDate: customStartDate,
          endDate: customEndDate,
        });
        if (isMounted && res) {
          setBackendData(res);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Backend analytics API fallback:', err);
          if (invoices.length === 0) {
            setBackendError('Unable to load dashboard data.');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingBackend(false);
        }
      }
    };

    fetchAnalytics();
    return () => { isMounted = false; };
  }, [filterPeriod, customStartDate, customEndDate, invoices.length]);

  // --- MODAL STATES ---
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<Party | null>(null);

  // --- DATE BOUNDARIES & FILTERING ---
  const dateRangeBounds = useMemo(() => {
    return getDateRangeBounds(filterPeriod, customStartDate, customEndDate);
  }, [filterPeriod, customStartDate, customEndDate]);

  const filteredInvoices = useMemo(() => {
    return filterInvoicesByDate(invoices, dateRangeBounds);
  }, [invoices, dateRangeBounds]);

  const isFilterActive = filterPeriod !== 'month';

  const resetFilter = () => {
    setFilterPeriod('month');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // --- KPI CALCULATIONS ---
  const kpis = useMemo(() => {
    if (backendData?.kpis) {
      return {
        ...backendData.kpis,
        amountCollected: backendData.kpis.totalPaid,
      };
    }
    const local = calculateKPIMetrics(filteredInvoices);
    return {
      ...local,
      totalPaid: local.amountCollected,
    };
  }, [backendData, filteredInvoices]);

  // --- GST TAX SUMMARY ---
  const gstSummary = useMemo(() => {
    if (backendData?.gstSummary) {
      return backendData.gstSummary;
    }
    return {
      totalGst: kpis.totalGst || 0,
      cgst: kpis.cgstTotal || 0,
      sgst: kpis.sgstTotal || 0,
      igst: kpis.igstTotal || 0,
      taxableAmount: kpis.taxableAmount || 0,
    };
  }, [backendData, kpis]);

  // --- TODAY'S BUSINESS SECTION ---
  const todayDateStr = getTodayDateString();
  const todayMetrics = useMemo(() => {
    const todayInvoices = invoices.filter(inv => inv.date === todayDateStr);
    let sales = 0;
    let collection = 0;
    let outstanding = 0;
    let bags = 0;

    todayInvoices.forEach(inv => {
      sales += inv.grandTotal || 0;
      collection += getInvoicePaidAmount(inv);
      outstanding += getInvoiceBalance(inv);
      if (Array.isArray(inv.items)) {
        inv.items.forEach(it => {
          bags += Number(it.quantity) || 0;
        });
      }
    });

    return {
      sales,
      collection,
      outstanding: Math.max(0, outstanding),
      bills: todayInvoices.length,
      bags,
    };
  }, [invoices, todayDateStr]);

  // --- SALES TREND CHART ---
  const trendData = useMemo(() => {
    if (backendData?.trendData && backendData.trendData.length > 0 && trendGrouping === 'daily') {
      return backendData.trendData;
    }
    return calculateTrendData(filteredInvoices, trendGrouping);
  }, [backendData, filteredInvoices, trendGrouping]);

  // --- PAYMENT OVERVIEW ---
  const paymentOverview = useMemo(() => {
    if (backendData?.paymentOverview) {
      return backendData.paymentOverview;
    }
    return calculatePaymentOverview(filteredInvoices);
  }, [backendData, filteredInvoices]);

  // --- OUTSTANDING PAYMENTS ---
  const outstandingInvoices = useMemo(() => {
    return getOutstandingInvoices(filteredInvoices, 10);
  }, [filteredInvoices]);

  // --- RECENT BILLS ---
  const recentBills = useMemo(() => {
    if (backendData?.recentBills && backendData.recentBills.length > 0) {
      return backendData.recentBills.map((b: any) => ({
        ...b,
        id: b._id ? String(b._id) : (b.id || b.invoiceNumber),
      }));
    }
    return [...filteredInvoices]
      .sort((a, b) => b.date.localeCompare(a.date) || b.invoiceNumber.localeCompare(a.invoiceNumber))
      .slice(0, 8);
  }, [backendData, filteredInvoices]);

  // --- TOP PRODUCTS ---
  const topProducts = useMemo(() => {
    let list: Array<any> = [];
    if (backendData?.topProducts && backendData.topProducts.length > 0) {
      list = backendData.topProducts.map((p: any) => ({
        name: p.name,
        category: p.category,
        quantity: p.quantity,
        sales: p.revenue || p.sales || 0,
        revenue: p.revenue || p.sales || 0,
        billsCount: p.billsCount || 0,
        avgRate: p.avgRate || 0,
      }));
    } else {
      const local = aggregateProductSales(filteredInvoices, 8);
      list = local.map(p => ({
        ...p,
        revenue: p.sales,
      }));
    }

    return [...list].sort((a, b) => {
      if (topProductSortBy === 'quantity') {
        return (b.quantity || 0) - (a.quantity || 0);
      }
      return (b.sales || b.revenue || 0) - (a.sales || a.revenue || 0);
    });
  }, [backendData, filteredInvoices, topProductSortBy]);

  const maxProductMetric = useMemo(() => {
    if (topProducts.length === 0) return 1;
    if (topProductSortBy === 'quantity') {
      return Math.max(...topProducts.map(p => p.quantity || 0), 1);
    }
    return Math.max(...topProducts.map(p => p.sales || p.revenue || 0), 1);
  }, [topProducts, topProductSortBy]);

  // --- TOP PARTIES ---
  const topParties = useMemo(() => {
    return aggregatePartySales(filteredInvoices, parties, 5);
  }, [filteredInvoices, parties]);

  // --- ACTIVE PARTY LEDGER STATS ---
  const activePartyLedgerStats = useMemo(() => {
    if (!selectedPartyForLedger) return null;
    const nameNorm = selectedPartyForLedger.name.trim().toLowerCase();
    const phoneNorm = (selectedPartyForLedger.phone || '').replace(/\D/g, '');

    const partyInvoices = invoices.filter(inv => {
      const invParty = (inv.partyName || '').trim().toLowerCase();
      const invPhone = (inv.partyPhone || '').replace(/\D/g, '');
      const matchName = invParty === nameNorm;
      const matchPhone = phoneNorm && invPhone && invPhone === phoneNorm;
      return matchName || matchPhone;
    }).sort((a, b) => b.date.localeCompare(a.date));

    let totalSales = 0;
    let totalPaid = 0;
    let totalBal = 0;

    partyInvoices.forEach(inv => {
      totalSales += inv.grandTotal || 0;
      totalPaid += getInvoicePaidAmount(inv);
      totalBal += getInvoiceBalance(inv);
    });

    return {
      invoices: partyInvoices,
      totalSales,
      totalPaid,
      outstanding: Math.max(0, totalBal),
      totalBills: partyInvoices.length,
    };
  }, [selectedPartyForLedger, invoices]);

  // Helper for navigating to Bill Book with payment status pre-selected
  const handleFilterBillBookByStatus = (status: PaymentStatus) => {
    navigate('/bills', { state: { statusFilter: status } });
  };

  // Helper for opening party ledger from top party row
  const handleOpenPartyLedger = (partyName: string, partyId?: string) => {
    const matchedParty = parties.find(p => p.id === partyId || p.name.trim().toLowerCase() === partyName.trim().toLowerCase());
    if (matchedParty) {
      setSelectedPartyForLedger(matchedParty);
    } else {
      // Create lightweight party reference if not found in saved parties
      const tempParty: Party = {
        id: partyId || `temp-${Date.now()}`,
        name: partyName,
        phone: '',
        address: 'Direct Wholesale Buyer',
        totalPurchases: 0,
        paidAmount: 0,
        pendingAmount: 0,
        lastTransactionDate: '',
      };
      setSelectedPartyForLedger(tempParty);
    }
  };

  // Helper for opening full invoice modal from recent bills or outstanding list
  const handleOpenInvoicePreview = (bill: any) => {
    const fullBill = invoices.find(i => i.invoiceNumber === bill.invoiceNumber) || bill;
    setSelectedInvoiceForModal(fullBill);
  };

  // Empty state check
  if (invoices.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        <div className="bg-[#FFFDF8] border border-[#E4D7C8] rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs mt-6">
          <div className="w-16 h-16 rounded-2xl bg-[#C99563]/20 border border-[#C99563]/30 text-[#8B5E3C] flex items-center justify-center mx-auto mb-4">
            <ShoppingBag size={32} />
          </div>
          <h2 className="text-2xl font-black text-[#3B2921] tracking-tight">No Transactions Yet</h2>
          <p className="text-sm text-[#8B5E3C] mt-2 mb-6 max-w-md mx-auto">
            Welcome to {settings.businessName || 'BagBill'}. Create your first GST invoice to start tracking bag sales, collections, customer ledgers, and inventory.
          </p>
          <button
            onClick={() => navigate('/create-bill')}
            className="px-6 py-3 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-sm inline-flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus size={18} className="text-[#C99563]" />
            <span>Create Your First Bill</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150 pb-12">
      {/* 1. WELCOME BANNER & QUICK ACTIONS */}
      <div className="bg-[#FFFDF8] border border-[#E4D7C8] rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-[#C99563]/10 rounded-full blur-2xl pointer-events-none" />

        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#C99563]/20 text-[#3B2921] border border-[#C99563]/40">
              Wholesale Bag Business Hub
            </span>
            <span className="text-xs text-[#8B5E3C] font-semibold flex items-center gap-1">
              <Sparkles size={12} className="text-[#C99563]" />
              Digital Ledger Active
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#3B2921] tracking-tight mt-1">
            {settings.businessName || 'Sri Lakshmi Jute & Gunny Mart'}
          </h2>
          <p className="text-xs sm:text-sm text-[#8B5E3C] font-medium max-w-xl mt-0.5">
            {settings.tagline || 'Real-time billing, collections, receivable ageing, and customer ledgers.'}
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full lg:w-auto">
          <button
            onClick={() => navigate('/create-bill')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-sm border border-[#3B2921]"
          >
            <Plus size={16} className="text-[#C99563]" />
            <span>+ New Bill</span>
          </button>
          
          <button
            onClick={() => navigate('/bills')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] border border-[#E4D7C8] font-bold text-xs sm:text-sm transition-all active:scale-95"
          >
            <BookOpen size={16} className="text-[#8B5E3C]" />
            <span>Bill Book</span>
          </button>

          <button
            onClick={() => navigate('/parties')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] border border-[#E4D7C8] font-bold text-xs sm:text-sm transition-all active:scale-95"
          >
            <Users size={16} className="text-[#8B5E3C]" />
            <span>Parties</span>
          </button>

          <button
            onClick={() => navigate('/products')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] border border-[#E4D7C8] font-bold text-xs sm:text-sm transition-all active:scale-95"
          >
            <Package size={16} className="text-[#8B5E3C]" />
            <span>Products</span>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] border border-[#E4D7C8] font-bold text-xs sm:text-sm transition-all active:scale-95"
          >
            <BarChart3 size={16} className="text-[#8B5E3C]" />
            <span>Reports</span>
          </button>
        </div>
      </div>

      {/* 2. TOP DATE FILTER BAR */}
      <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-[#8B5E3C]" />
          <span className="text-xs font-bold text-[#3B2921] uppercase tracking-wider">Date Period:</span>
          <span className="text-xs text-[#8B5E3C] font-semibold bg-[#F7F3EA] px-2.5 py-1 rounded-lg border border-[#E4D7C8]">
            {dateRangeBounds.label}
          </span>
          {isLoadingBackend && (
            <span className="text-[11px] font-semibold text-[#8B5E3C] animate-pulse flex items-center gap-1.5 ml-2">
              <Clock size={12} className="animate-spin text-[#C99563]" />
              <span>Loading dashboard...</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          {(['today', 'yesterday', 'week', 'month', 'last_month', 'year', 'custom', 'all'] as DateFilterPeriod[]).map((period) => {
            const labels: Record<DateFilterPeriod, string> = {
              today: 'Today',
              yesterday: 'Yesterday',
              week: 'This Week',
              month: 'This Month',
              last_month: 'Last Month',
              year: 'This Year',
              custom: 'Custom',
              all: 'All Time',
            };
            const isSelected = filterPeriod === period;
            return (
              <button
                key={period}
                onClick={() => setFilterPeriod(period)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                  isSelected
                    ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921] shadow-xs'
                    : 'bg-[#F7F3EA] text-[#8B5E3C] border-[#E4D7C8] hover:border-[#C99563] hover:text-[#3B2921]'
                }`}
              >
                {labels[period]}
              </button>
            );
          })}

          {isFilterActive && (
            <button
              onClick={resetFilter}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-[#E4D7C8]/40 hover:bg-[#E4D7C8] text-[#8B5E3C] flex items-center gap-1 transition-all"
              title="Reset date filter to This Month"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Backend Offline / Error Banner */}
      {backendError && (
        <div className="p-3.5 bg-[#B94A48]/10 border border-[#B94A48]/30 rounded-xl text-xs text-[#B94A48] flex items-center gap-2">
          <AlertCircle size={15} />
          <span>Unable to load dashboard data from server. Displaying local data.</span>
        </div>
      )}

      {/* Filtered Range Empty State Banner */}
      {kpis.totalBills === 0 && !isLoadingBackend && (
        <div className="p-4 bg-[#FFFDF8] border border-[#E4D7C8] rounded-2xl text-xs text-[#8B5E3C] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-[#C99563] shrink-0" />
            <span className="font-semibold text-[#3B2921]">No sales data for this period ({dateRangeBounds.label}).</span>
          </div>
          <button
            onClick={() => setFilterPeriod('all')}
            className="px-3.5 py-1.5 bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] font-bold rounded-xl border border-[#E4D7C8] transition-colors shadow-2xs"
          >
            Show All Time Records
          </button>
        </div>
      )}

      {/* Inline Date Pickers for Custom Range */}
      {filterPeriod === 'custom' && (
        <div className="p-3.5 bg-[#F7F3EA] rounded-xl border border-[#E4D7C8] flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-[#3B2921]">Select Custom Date Range:</span>
          <div className="flex items-center gap-2">
            <span className="text-[#8B5E3C]">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#E4D7C8] bg-[#FFFDF8] text-[#3B2921] font-mono text-xs focus:outline-hidden focus:border-[#8B5E3C]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#8B5E3C]">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#E4D7C8] bg-[#FFFDF8] text-[#3B2921] font-mono text-xs focus:outline-hidden focus:border-[#8B5E3C]"
            />
          </div>
        </div>
      )}

      {/* 3. TODAY'S BUSINESS COMPACT SECTION */}
      <div className="bg-[#F7F3EA] border border-[#E4D7C8] rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#4F7D5A] animate-pulse" />
            <h3 className="text-xs sm:text-sm font-black text-[#3B2921] uppercase tracking-wider">
              Today's Live Business ({formatDate(todayDateStr)})
            </h3>
          </div>
          <span className="text-[11px] text-[#8B5E3C] font-semibold">
            {todayMetrics.bills === 0 ? 'No bills created today yet' : `${todayMetrics.bills} ${todayMetrics.bills === 1 ? 'bill' : 'bills'} issued today`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-[#FFFDF8] p-3.5 rounded-xl border border-[#E4D7C8]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">Today's Sales</div>
            <div className="text-lg sm:text-xl font-black font-mono text-[#3B2921] mt-1">
              {formatINR(todayMetrics.sales)}
            </div>
          </div>

          <div className="bg-[#FFFDF8] p-3.5 rounded-xl border border-[#E4D7C8]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#4F7D5A]">Today's Collection</div>
            <div className="text-lg sm:text-xl font-black font-mono text-[#4F7D5A] mt-1">
              {formatINR(todayMetrics.collection)}
            </div>
          </div>

          <div className="bg-[#FFFDF8] p-3.5 rounded-xl border border-[#E4D7C8]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#B94A48]">Today's Outstanding</div>
            <div className="text-lg sm:text-xl font-black font-mono text-[#B94A48] mt-1">
              {formatINR(todayMetrics.outstanding)}
            </div>
          </div>

          <div className="bg-[#FFFDF8] p-3.5 rounded-xl border border-[#E4D7C8]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">Today's Bills</div>
            <div className="text-lg sm:text-xl font-black font-mono text-[#3B2921] mt-1">
              {todayMetrics.bills}
            </div>
          </div>

          <div className="bg-[#FFFDF8] p-3.5 rounded-xl border border-[#E4D7C8] col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">Today's Bags Sold</div>
            <div className="text-lg sm:text-xl font-black font-mono text-[#3B2921] mt-1">
              {todayMetrics.bags.toLocaleString('en-IN')} <span className="text-xs font-normal text-[#8B5E3C]">Bags</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MAIN 6 KPI CARDS (RESPOND TO TOP DATE FILTER) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Card 1: Total Sales */}
        <div className="bg-[#FFFDF8] p-4.5 rounded-2xl border border-[#E4D7C8] shadow-xs hover:border-[#C99563] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider">Total Sales</span>
            <div className="w-8 h-8 rounded-xl bg-[#8B5E3C]/15 text-[#8B5E3C] flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black font-mono text-[#3B2921]">
              {formatINR(kpis.totalSales)}
            </div>
            <div className="text-[11px] text-[#8B5E3C] font-semibold mt-0.5">
              Filtered Period Revenue
            </div>
          </div>
        </div>

        {/* Card 2: Number of Bills */}
        <div className="bg-[#FFFDF8] p-4.5 rounded-2xl border border-[#E4D7C8] shadow-xs hover:border-[#C99563] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider">Number of Bills</span>
            <div className="w-8 h-8 rounded-xl bg-[#C99563]/25 text-[#3B2921] flex items-center justify-center">
              <Receipt size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black font-mono text-[#3B2921]">
              {kpis.totalBills}
            </div>
            <div className="text-[11px] text-[#8B5E3C] font-semibold mt-0.5">
              Invoices Issued
            </div>
          </div>
        </div>

        {/* Card 3: Total Amount Paid */}
        <div className="bg-[#FFFDF8] p-4.5 rounded-2xl border border-[#E4D7C8] shadow-xs hover:border-[#C99563] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#4F7D5A] uppercase tracking-wider">Total Paid</span>
            <div className="w-8 h-8 rounded-xl bg-[#4F7D5A]/15 text-[#4F7D5A] flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black font-mono text-[#4F7D5A]">
              {formatINR(kpis.totalPaid ?? kpis.amountCollected ?? 0)}
            </div>
            <div className="text-[11px] text-[#4F7D5A] font-semibold mt-0.5">
              Realized Receipts
            </div>
          </div>
        </div>

        {/* Card 4: Outstanding Amount */}
        <div className="bg-[#FFFDF8] p-4.5 rounded-2xl border border-[#E4D7C8] shadow-xs hover:border-[#C99563] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#B94A48] uppercase tracking-wider">Outstanding</span>
            <div className="w-8 h-8 rounded-xl bg-[#B94A48]/15 text-[#B94A48] flex items-center justify-center">
              <Clock3 size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black font-mono text-[#B94A48]">
              {formatINR(kpis.outstanding)}
            </div>
            <div className="text-[11px] text-[#B94A48] font-semibold mt-0.5">
              Pending Collections
            </div>
          </div>
        </div>

        {/* Card 5: Total GST Collected */}
        <div className="bg-[#FFFDF8] p-4.5 rounded-2xl border border-[#E4D7C8] shadow-xs hover:border-[#C99563] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider">GST Collected</span>
            <div className="w-8 h-8 rounded-xl bg-[#8B5E3C]/15 text-[#8B5E3C] flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black font-mono text-[#3B2921]">
              {formatINR(kpis.totalGst ?? kpis.totalTax ?? 0)}
            </div>
            <div className="text-[11px] text-[#8B5E3C] font-semibold mt-0.5 truncate">
              Taxable: {formatINR(kpis.taxableAmount || 0)}
            </div>
          </div>
        </div>

        {/* Card 6: Total Products/Bags Sold */}
        <div className="bg-[#FFFDF8] p-4.5 rounded-2xl border border-[#E4D7C8] shadow-xs hover:border-[#C99563] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider">Bags Sold</span>
            <div className="w-8 h-8 rounded-xl bg-[#8B5E3C]/15 text-[#8B5E3C] flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black font-mono text-[#3B2921]">
              {(kpis.bagsSold || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-[#8B5E3C] font-semibold mt-0.5">
              Total Units Shipped
            </div>
          </div>
        </div>
      </div>

      {/* 4B. GST TAX SUMMARY PANEL */}
      <div className="bg-[#FFFDF8] border border-[#E4D7C8] rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-[#E4D7C8]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#8B5E3C]/10 text-[#8B5E3C] flex items-center justify-center">
              <Layers size={16} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-[#3B2921] uppercase tracking-wider">
                GST Tax Summary ({dateRangeBounds.label})
              </h3>
              <p className="text-[11px] text-[#8B5E3C]">Authoritative GST collected for tax compliance & GSTR-1 preparation</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-[#8B5E3C]">Total GST: </span>
            <span className="font-mono font-black text-sm text-[#3B2921]">{formatINR(gstSummary.totalGst)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-3.5">
          <div className="bg-[#F7F3EA] p-3 rounded-xl border border-[#E4D7C8]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">CGST (Central)</div>
            <div className="text-base sm:text-lg font-black font-mono text-[#3B2921] mt-0.5">
              {formatINR(gstSummary.cgst)}
            </div>
          </div>

          <div className="bg-[#F7F3EA] p-3 rounded-xl border border-[#E4D7C8]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">SGST (State)</div>
            <div className="text-base sm:text-lg font-black font-mono text-[#3B2921] mt-0.5">
              {formatINR(gstSummary.sgst)}
            </div>
          </div>

          <div className="bg-[#F7F3EA] p-3 rounded-xl border border-[#E4D7C8]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">IGST (Inter-State)</div>
            <div className="text-base sm:text-lg font-black font-mono text-[#3B2921] mt-0.5">
              {formatINR(gstSummary.igst)}
            </div>
          </div>

          <div className="bg-[#F7F3EA] p-3 rounded-xl border border-[#E4D7C8]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">Taxable Turnover</div>
            <div className="text-base sm:text-lg font-black font-mono text-[#3B2921] mt-0.5">
              {formatINR(gstSummary.taxableAmount)}
            </div>
          </div>

          <div className="bg-[#F7F3EA] p-3 rounded-xl border border-[#E4D7C8] col-span-2 sm:col-span-4 lg:col-span-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">Total Tax Pool</div>
            <div className="text-base sm:text-lg font-black font-mono text-[#8B5E3C] mt-0.5">
              {formatINR(gstSummary.totalGst)}
            </div>
          </div>
        </div>
      </div>

      {/* 5. SALES TREND & PAYMENT OVERVIEW GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Recharts BarChart (2 Cols) */}
        <div className="lg:col-span-2 bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-[#E4D7C8]">
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#3B2921] flex items-center gap-2">
                <BarChart3 size={18} className="text-[#8B5E3C]" />
                <span>Sales & Bill Trends</span>
              </h3>
              <p className="text-xs text-[#8B5E3C]">
                {trendMetric === 'sales'
                  ? 'Actual billed amounts vs collections vs outstanding'
                  : 'Total number of bills issued over time'}
              </p>
            </div>

            {/* Metric & Grouping Toggles */}
            <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
              {/* Sales vs Bills metric toggle */}
              <div className="flex rounded-xl bg-[#F7F3EA] p-1 border border-[#E4D7C8]">
                <button
                  onClick={() => setTrendMetric('sales')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    trendMetric === 'sales'
                      ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                      : 'text-[#8B5E3C] hover:text-[#3B2921]'
                  }`}
                >
                  Sales (₹)
                </button>
                <button
                  onClick={() => setTrendMetric('bills')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    trendMetric === 'bills'
                      ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                      : 'text-[#8B5E3C] hover:text-[#3B2921]'
                  }`}
                >
                  Bills (#)
                </button>
              </div>

              {/* Daily / Weekly / Monthly Toggle */}
              <div className="flex rounded-xl bg-[#F7F3EA] p-1 border border-[#E4D7C8]">
                <button
                  onClick={() => setTrendGrouping('daily')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    trendGrouping === 'daily'
                      ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                      : 'text-[#8B5E3C] hover:text-[#3B2921]'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setTrendGrouping('weekly')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    trendGrouping === 'weekly'
                      ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                      : 'text-[#8B5E3C] hover:text-[#3B2921]'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setTrendGrouping('monthly')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    trendGrouping === 'monthly'
                      ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                      : 'text-[#8B5E3C] hover:text-[#3B2921]'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
          </div>

          {/* Chart Canvas */}
          <div className="h-68 sm:h-76 w-full pt-4">
            {trendData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-[#8B5E3C]">
                <Layers size={24} className="text-[#C99563] mb-2" />
                <span>No invoice records in this timeframe</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4D7C8" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fill: '#8B5E3C', fontSize: 11, fontWeight: 500 }}
                    axisLine={{ stroke: '#E4D7C8' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#8B5E3C', fontSize: 11, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => trendMetric === 'sales'
                      ? `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
                      : `${val}`
                    }
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#FFFDF8] p-3 rounded-xl border border-[#E4D7C8] shadow-lg text-xs space-y-1">
                            <p className="font-bold text-[#3B2921] mb-1">{label}</p>
                            {trendMetric === 'sales' ? (
                              <>
                                <p className="text-[#8B5E3C]">
                                  Sales: <strong className="font-mono text-[#3B2921]">{formatINR(payload[0]?.value as number)}</strong>
                                </p>
                                <p className="text-[#4F7D5A]">
                                  Collected: <strong className="font-mono text-[#4F7D5A]">{formatINR(payload[1]?.value as number)}</strong>
                                </p>
                                <p className="text-[#B94A48]">
                                  Outstanding: <strong className="font-mono text-[#B94A48]">{formatINR(payload[2]?.value as number)}</strong>
                                </p>
                              </>
                            ) : (
                              <p className="text-[#8B5E3C]">
                                Invoices Issued: <strong className="font-mono text-[#3B2921]">{payload[0]?.value}</strong>
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    formatter={(val) => <span className="text-xs font-bold text-[#3B2921]">{val}</span>}
                  />
                  {trendMetric === 'sales' ? (
                    <>
                      <Bar dataKey="sales" name="Total Sales" fill="#8B5E3C" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="collected" name="Collected" fill="#4F7D5A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outstanding" name="Outstanding" fill="#B94A48" radius={[4, 4, 0, 0]} />
                    </>
                  ) : (
                    <Bar dataKey="billsCount" name="Invoices Created" fill="#8B5E3C" radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 6. PAYMENT OVERVIEW SECTION (1 Col) */}
        <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E4D7C8]">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#3B2921]">Payment Overview</h3>
                <p className="text-xs text-[#8B5E3C]">Click to view filtered bills in Bill Book</p>
              </div>
              <button
                onClick={() => navigate('/bills')}
                className="text-xs font-bold text-[#8B5E3C] hover:text-[#3B2921] flex items-center gap-1"
              >
                <span>All Bills</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {/* Paid Box */}
              <div 
                onClick={() => handleFilterBillBookByStatus('Paid')}
                className="p-3.5 rounded-xl bg-[#4F7D5A]/10 border border-[#4F7D5A]/30 hover:border-[#4F7D5A] cursor-pointer transition-all hover:shadow-xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#4F7D5A] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Paid</span>
                  </span>
                  <span className="text-xs font-bold text-[#4F7D5A] bg-[#4F7D5A]/15 px-2 py-0.5 rounded-md">
                    {paymentOverview.paid.count} {paymentOverview.paid.count === 1 ? 'bill' : 'bills'}
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-[#3B2921] mt-1.5 group-hover:text-[#4F7D5A] transition-colors">
                  {formatINR(paymentOverview.paid.amount)}
                </div>
                <div className="text-[10px] text-[#4F7D5A] mt-1 font-semibold flex items-center justify-between">
                  <span>Fully cleared invoices</span>
                  <span className="underline underline-offset-2">Filter in Bill Book &rarr;</span>
                </div>
              </div>

              {/* Partial Box */}
              <div 
                onClick={() => handleFilterBillBookByStatus('Partial')}
                className="p-3.5 rounded-xl bg-[#C99563]/15 border border-[#C99563]/40 hover:border-[#C99563] cursor-pointer transition-all hover:shadow-xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#8B5E3C] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>Partial</span>
                  </span>
                  <span className="text-xs font-bold text-[#8B5E3C] bg-[#C99563]/25 px-2 py-0.5 rounded-md">
                    {paymentOverview.partial.count} {paymentOverview.partial.count === 1 ? 'bill' : 'bills'}
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-[#3B2921] mt-1.5 group-hover:text-[#8B5E3C] transition-colors">
                  {formatINR(paymentOverview.partial.amount)}
                </div>
                <div className="text-[10px] text-[#8B5E3C] mt-1 font-semibold flex items-center justify-between">
                  <span>Advance received, balance pending</span>
                  <span className="underline underline-offset-2">Filter in Bill Book &rarr;</span>
                </div>
              </div>

              {/* Pending Box */}
              <div 
                onClick={() => handleFilterBillBookByStatus('Pending')}
                className="p-3.5 rounded-xl bg-[#B94A48]/10 border border-[#B94A48]/30 hover:border-[#B94A48] cursor-pointer transition-all hover:shadow-xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#B94A48] uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    <span>Pending</span>
                  </span>
                  <span className="text-xs font-bold text-[#B94A48] bg-[#B94A48]/15 px-2 py-0.5 rounded-md">
                    {paymentOverview.pending.count} {paymentOverview.pending.count === 1 ? 'bill' : 'bills'}
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-[#3B2921] mt-1.5 group-hover:text-[#B94A48] transition-colors">
                  {formatINR(paymentOverview.pending.amount)}
                </div>
                <div className="text-[10px] text-[#B94A48] mt-1 font-semibold flex items-center justify-between">
                  <span>Awaiting payment</span>
                  <span className="underline underline-offset-2">Filter in Bill Book &rarr;</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E4D7C8] text-xs flex items-center justify-between text-[#8B5E3C]">
            <span>Total Filtered Volume:</span>
            <span className="font-mono font-bold text-[#3B2921]">{formatINR(paymentOverview.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* 7. OUTSTANDING PAYMENTS SECTION (Sorted by highest balance due) */}
      <div className="bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E4D7C8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black text-[#3B2921] flex items-center gap-2">
              <Clock3 size={18} className="text-[#B94A48]" />
              <span>Outstanding Payments & Receivables</span>
            </h3>
            <p className="text-xs text-[#8B5E3C]">Unpaid and partially settled customer accounts sorted by highest balance due</p>
          </div>
          <span className="text-xs font-bold bg-[#B94A48]/10 text-[#B94A48] border border-[#B94A48]/30 px-3 py-1 rounded-xl">
            Total Due: {formatINR(kpis.outstanding)}
          </span>
        </div>

        <div className="overflow-x-auto">
          {outstandingInvoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8B5E3C]">
              <CheckCircle2 size={32} className="text-[#4F7D5A] mx-auto mb-2" />
              <p className="font-bold text-sm text-[#3B2921]">All Filtered Accounts Settled!</p>
              <p className="mt-0.5">There are zero pending or partially paid invoices in this period.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="bg-[#F7F3EA] border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Total (₹)</th>
                  <th className="py-3 px-4 text-right">Paid (₹)</th>
                  <th className="py-3 px-4 text-right">Balance Due (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4D7C8]">
                {outstandingInvoices.map((inv) => {
                  const paid = getInvoicePaidAmount(inv);
                  const bal = getInvoiceBalance(inv);
                  return (
                    <tr key={inv.id} className="hover:bg-[#F7F3EA]/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#3B2921]">
                        <button 
                          onClick={() => handleOpenPartyLedger(inv.partyName)}
                          className="hover:underline hover:text-[#8B5E3C] text-left"
                        >
                          {inv.partyName}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#3B2921]">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-[#8B5E3C]">
                        {formatDate(inv.date)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#3B2921]">
                        {formatINR(inv.grandTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#4F7D5A]">
                        {formatINR(paid)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-sm text-[#B94A48]">
                        {formatINR(bal)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={inv.paymentStatus} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedInvoiceForModal(inv)}
                            className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                            title="View Invoice"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => navigate('/create-bill', { state: { editInvoice: inv } })}
                            className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                            title="Edit Bill"
                          >
                            <FileEdit size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInvoiceForModal(inv);
                              setTimeout(() => printInvoice(), 200);
                            }}
                            className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                            title="Print Invoice"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            onClick={() => downloadInvoicePDF(inv, settings)}
                            className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                            title="Download PDF"
                          >
                            <Download size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 8. TOP PRODUCTS & TOP PARTIES (2 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-[#E4D7C8]">
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#3B2921] flex items-center gap-2">
                <Package size={18} className="text-[#8B5E3C]" />
                <span>Top Selling Products</span>
              </h3>
              <p className="text-xs text-[#8B5E3C]">
                Ranked by {topProductSortBy === 'quantity' ? 'units sold' : 'sales revenue'} in selected period
              </p>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
              <div className="flex rounded-xl bg-[#F7F3EA] p-1 border border-[#E4D7C8]">
                <button
                  onClick={() => setTopProductSortBy('quantity')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    topProductSortBy === 'quantity'
                      ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                      : 'text-[#8B5E3C] hover:text-[#3B2921]'
                  }`}
                >
                  By Qty
                </button>
                <button
                  onClick={() => setTopProductSortBy('revenue')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    topProductSortBy === 'revenue'
                      ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                      : 'text-[#8B5E3C] hover:text-[#3B2921]'
                  }`}
                >
                  By Revenue
                </button>
              </div>

              <button
                onClick={() => navigate('/products')}
                className="text-xs font-bold text-[#8B5E3C] hover:text-[#3B2921] flex items-center gap-1"
              >
                <span>Catalog</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3.5">
            {topProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8B5E3C]">
                No product sales found for this timeframe.
              </div>
            ) : (
              topProducts.map((prod, idx) => {
                const metricVal = topProductSortBy === 'quantity' ? prod.quantity : (prod.sales || prod.revenue || 0);
                const percent = Math.min(100, Math.round((metricVal / maxProductMetric) * 100));
                const revenue = prod.sales || prod.revenue || 0;
                return (
                  <div key={prod.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#F7F3EA] text-[#8B5E3C] font-mono font-bold flex items-center justify-center text-[10px] border border-[#E4D7C8]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-[#3B2921]">{prod.name}</span>
                        <span className="text-[10px] font-semibold bg-[#F7F3EA] text-[#8B5E3C] px-2 py-0.5 rounded border border-[#E4D7C8]">
                          {prod.category}
                        </span>
                      </div>
                      <div className="text-right font-mono flex items-center gap-2">
                        <span className="text-xs font-bold text-[#3B2921]">
                          {prod.quantity.toLocaleString('en-IN')} Bags
                        </span>
                        <span className="text-[#8B5E3C]">•</span>
                        <strong className="text-[#4F7D5A] font-bold">
                          {formatINR(revenue)}
                        </strong>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-[#F7F3EA] overflow-hidden border border-[#E4D7C8]/50">
                      <div 
                        className="h-full bg-linear-to-r from-[#C99563] to-[#8B5E3C] rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Parties */}
        <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4D7C8]">
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#3B2921] flex items-center gap-2">
                <Users size={18} className="text-[#8B5E3C]" />
                <span>Top Wholesale Parties</span>
              </h3>
              <p className="text-xs text-[#8B5E3C]">Ranked by total order volume in selected period</p>
            </div>
            <button
              onClick={() => navigate('/parties')}
              className="text-xs font-bold text-[#8B5E3C] hover:text-[#3B2921] flex items-center gap-1"
            >
              <span>All Parties</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {topParties.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8B5E3C]">
                No customer transactions recorded in this timeframe.
              </div>
            ) : (
              topParties.map((party, idx) => (
                <div 
                  key={party.partyName}
                  onClick={() => handleOpenPartyLedger(party.partyName, party.partyId)}
                  className="p-3 rounded-xl bg-[#F7F3EA]/70 hover:bg-[#F7F3EA] border border-[#E4D7C8] transition-all cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#3B2921] text-[#FFFDF8] font-mono font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-[#3B2921] flex items-center gap-1.5">
                        <span>{party.partyName}</span>
                        <ExternalLink size={12} className="text-[#8B5E3C]" />
                      </div>
                      <div className="text-[10px] text-[#8B5E3C]">
                        {party.billsCount} {party.billsCount === 1 ? 'bill' : 'bills'} • Last: {formatDate(party.lastTransactionDate) || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-[#3B2921]">
                      {formatINR(party.totalSales)}
                    </div>
                    <div className="text-[10px] font-mono font-semibold">
                      {party.outstanding > 0 ? (
                        <span className="text-[#B94A48]">Due: {formatINR(party.outstanding)}</span>
                      ) : (
                        <span className="text-[#4F7D5A]">Cleared</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 9. RECENT BILLS SECTION */}
      <div className="bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E4D7C8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black text-[#3B2921] flex items-center gap-2">
              <Receipt size={18} className="text-[#8B5E3C]" />
              <span>Recent Invoices</span>
            </h3>
            <p className="text-xs text-[#8B5E3C]">Latest generated invoices from your digital bill book</p>
          </div>
          <button
            onClick={() => navigate('/bills')}
            className="text-xs font-bold text-[#8B5E3C] hover:text-[#3B2921] underline decoration-[#C99563] underline-offset-4"
          >
            View All Bills ({invoices.length}) &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead>
              <tr className="bg-[#F7F3EA] border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Party</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-right">Paid (₹)</th>
                <th className="py-3 px-4 text-right">Balance (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4D7C8]">
              {recentBills.map((bill: any) => {
                const paid = getInvoicePaidAmount(bill);
                const bal = getInvoiceBalance(bill);

                return (
                  <tr key={bill.id} className="hover:bg-[#F7F3EA]/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#3B2921]">
                      <button 
                        onClick={() => handleOpenInvoicePreview(bill)}
                        className="hover:underline hover:text-[#8B5E3C]"
                      >
                        {bill.invoiceNumber}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#3B2921]">
                      <button
                        onClick={() => handleOpenPartyLedger(bill.partyName)}
                        className="hover:underline hover:text-[#8B5E3C]"
                      >
                        {bill.partyName}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-[#8B5E3C]">
                      {formatDate(bill.date)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-[#3B2921]">
                      {formatINR(bill.grandTotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#4F7D5A]">
                      {formatINR(paid)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#B94A48]">
                      {formatINR(bal)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={bill.paymentStatus} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenInvoicePreview(bill)}
                          className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                          title="View Invoice Preview"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => {
                            const fullBill = invoices.find(i => i.invoiceNumber === bill.invoiceNumber) || bill;
                            downloadInvoicePDF(fullBill, settings);
                          }}
                          className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Download size={15} />
                        </button>
                        <button
                          onClick={() => navigate('/create-bill', { state: { editInvoice: bill } })}
                          className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                          title="Edit Bill"
                        >
                          <FileEdit size={15} />
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

      {/* 10. INVOICE PREVIEW MODAL */}
      {selectedInvoiceForModal && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInvoiceForModal(null)}
          title={`Tax Invoice — ${selectedInvoiceForModal.invoiceNumber}`}
          subtitle={`Issued to ${selectedInvoiceForModal.partyName} on ${formatDate(selectedInvoiceForModal.date)}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex justify-end gap-2 no-print">
              <button
                onClick={() => printInvoice()}
                className="px-3.5 py-2 rounded-xl bg-[#F7F3EA] text-[#3B2921] border border-[#E4D7C8] font-bold text-xs hover:bg-[#EAE2D2] transition-colors flex items-center gap-1.5"
              >
                <Printer size={15} />
                <span>Print Invoice</span>
              </button>
              <button
                onClick={() => downloadInvoicePDF(selectedInvoiceForModal, settings)}
                className="px-4 py-2 rounded-xl bg-[#3B2921] text-[#FFFDF8] font-bold text-xs hover:bg-[#4E372C] transition-colors flex items-center gap-1.5"
              >
                <Download size={15} className="text-[#C99563]" />
                <span>Download PDF</span>
              </button>
            </div>

            <InvoicePreview 
              invoice={selectedInvoiceForModal} 
              settings={settings} 
            />
          </div>
        </Modal>
      )}

      {/* 11. PARTY LEDGER MODAL (Statement of Account) */}
      {selectedPartyForLedger && activePartyLedgerStats && (
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
                    {selectedPartyForLedger.address || 'Local Market'}
                  </div>
                </div>
              </div>

              {/* Action: Create Bill */}
              <button
                onClick={() => {
                  setSelectedPartyForLedger(null);
                  navigate('/create-bill', { state: { preselectedParty: selectedPartyForLedger } });
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
              >
                <FilePlus2 size={15} className="text-[#C99563]" />
                <span>+ Create Bill for {selectedPartyForLedger.name}</span>
              </button>
            </div>

            {/* Financial Summary Cards */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B5E3C] mb-2">
                Dynamic Financial Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">
                    Total Purchases
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-[#3B2921] mt-0.5">
                    {formatINR(activePartyLedgerStats.totalSales)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#4F7D5A]">
                    Amount Paid
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-[#4F7D5A] mt-0.5">
                    {formatINR(activePartyLedgerStats.totalPaid)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#B94A48]">
                    Outstanding
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-[#B94A48] mt-0.5">
                    {formatINR(activePartyLedgerStats.outstanding)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">
                    Total Bills
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-[#3B2921] mt-0.5">
                    {activePartyLedgerStats.totalBills}
                  </div>
                </div>
              </div>
            </div>

            {/* Complete Transaction History Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B5E3C] mb-2">
                Transaction History
              </h4>
              <div className="border border-[#E4D7C8] rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs min-w-[550px]">
                    <thead className="bg-[#F7F3EA] text-[#8B5E3C] font-bold uppercase tracking-wider sticky top-0 border-b border-[#E4D7C8]">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3 text-right">Paid (₹)</th>
                        <th className="py-2.5 px-3 text-right">Balance (₹)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4D7C8]">
                      {activePartyLedgerStats.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-[#8B5E3C]">
                            No bills recorded for this party yet.
                          </td>
                        </tr>
                      ) : (
                        activePartyLedgerStats.invoices.map((inv) => {
                          const paid = getInvoicePaidAmount(inv);
                          const bal = getInvoiceBalance(inv);
                          return (
                            <tr key={inv.id} className="hover:bg-[#F7F3EA]/50">
                              <td className="py-2.5 px-3 font-mono text-[#8B5E3C]">
                                {formatDate(inv.date)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-[#3B2921]">
                                {inv.invoiceNumber}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#3B2921]">
                                {formatINR(inv.grandTotal)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#4F7D5A]">
                                {formatINR(paid)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#B94A48]">
                                {formatINR(bal)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <StatusBadge status={inv.paymentStatus} size="sm" />
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setSelectedInvoiceForModal(inv)}
                                    className="p-1 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded"
                                    title="View Invoice"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    onClick={() => downloadInvoicePDF(inv, settings)}
                                    className="p-1 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded"
                                    title="Download PDF"
                                  >
                                    <Download size={14} />
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
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default Dashboard;
