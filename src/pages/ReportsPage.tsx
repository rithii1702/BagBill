import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Receipt, 
  Clock, 
  Download, 
  Calendar,
  Users,
  ShoppingBag,
  DollarSign,
  CheckCircle2,
  Eye,
  Printer,
  Edit2,
  FileSpreadsheet,
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { useBagBill } from '../context/BagBillContext';
import { formatINR, formatDate, getTodayDateString } from '../utils/formatters';
import { Invoice, Party } from '../types';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { InvoicePreview } from '../components/invoice/InvoicePreview';
import { downloadInvoicePDF, printInvoice } from '../utils/pdfGenerator';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { invoices, parties, products, settings, showToast } = useBagBill();

  // --- FILTER STATES ---
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month' | 'last_month' | 'year' | 'all' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('All');
  const [filterProduct, setFilterProduct] = useState<string>('All');
  const [filterParty, setFilterParty] = useState<string>('All');

  // --- VIEW & INTERACTION STATES ---
  const [trendGrouping, setTrendGrouping] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [productSortBy, setProductSortBy] = useState<'sales' | 'quantity' | 'bills'>('sales');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [selectedPartyForLedger, setSelectedPartyForLedger] = useState<Party | null>(null);

  // Active filter count check
  const isFilterActive = filterPeriod !== 'all' || 
    filterPaymentStatus !== 'All' || 
    filterProduct !== 'All' || 
    filterParty !== 'All';

  const resetAllFilters = () => {
    setFilterPeriod('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setFilterPaymentStatus('All');
    setFilterProduct('All');
    setFilterParty('All');
    showToast('Filters reset to All Time', 'info');
  };

  // --- COMPUTE DATE BOUNDARIES ---
  const dateRangeBounds = useMemo(() => {
    const today = new Date();
    const todayStr = getTodayDateString();

    if (filterPeriod === 'today') {
      return { start: todayStr, end: todayStr, label: `Today (${formatDate(todayStr)})` };
    }

    if (filterPeriod === 'week') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 6);
      const startStr = past7.toISOString().split('T')[0];
      return { start: startStr, end: todayStr, label: 'Last 7 Days' };
    }

    if (filterPeriod === 'month') {
      const y = today.getFullYear();
      const m = today.getMonth();
      const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
      return { start: firstDay, end: lastDay, label: 'This Month' };
    }

    if (filterPeriod === 'last_month') {
      const y = today.getFullYear();
      const m = today.getMonth();
      const firstDay = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m, 0).toISOString().split('T')[0];
      return { start: firstDay, end: lastDay, label: 'Last Month' };
    }

    if (filterPeriod === 'year') {
      const y = today.getFullYear();
      const firstDay = `${y}-01-01`;
      const lastDay = `${y}-12-31`;
      return { start: firstDay, end: lastDay, label: `This Year (${y})` };
    }

    if (filterPeriod === 'custom') {
      return {
        start: customStartDate || '1970-01-01',
        end: customEndDate || '2099-12-31',
        label: customStartDate && customEndDate 
          ? `${formatDate(customStartDate)} – ${formatDate(customEndDate)}`
          : 'Custom Range'
      };
    }

    return { start: null, end: null, label: 'All Time' };
  }, [filterPeriod, customStartDate, customEndDate]);

  // --- FILTERED INVOICES (Single Source of Truth) ---
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // 1. Date filter
      if (dateRangeBounds.start && dateRangeBounds.end) {
        if (inv.date < dateRangeBounds.start || inv.date > dateRangeBounds.end) {
          return false;
        }
      }

      // 2. Payment Status filter
      if (filterPaymentStatus !== 'All') {
        if (inv.paymentStatus !== filterPaymentStatus) {
          return false;
        }
      }

      // 3. Product filter (Check snapshot inside items)
      if (filterProduct !== 'All') {
        const normProd = filterProduct.toLowerCase();
        const hasProd = inv.items.some(it => {
          const itName = (it.productName || it.bagType || '').toLowerCase();
          const itType = (it.bagType || '').toLowerCase();
          return itName === normProd || itType === normProd || it.productId === filterProduct;
        });
        if (!hasProd) return false;
      }

      // 4. Party filter
      if (filterParty !== 'All') {
        const normParty = filterParty.toLowerCase();
        const invParty = (inv.partyName || '').toLowerCase();
        const invPhone = (inv.partyPhone || '').replace(/\D/g, '');
        const targetClean = filterParty.replace(/\D/g, '');
        const matchName = invParty === normParty;
        const matchPhone = targetClean && invPhone && invPhone === targetClean;
        if (!matchName && !matchPhone) return false;
      }

      return true;
    });
  }, [invoices, dateRangeBounds, filterPaymentStatus, filterProduct, filterParty]);

  // --- KPI METRICS ---
  const kpiMetrics = useMemo(() => {
    let sales = 0;
    let collected = 0;
    let outstanding = 0;
    let itemsSold = 0;

    filteredInvoices.forEach(inv => {
      const grand = inv.grandTotal || 0;
      sales += grand;

      if (inv.paymentStatus === 'Paid') {
        collected += grand;
      } else if (inv.paymentStatus === 'Pending') {
        outstanding += (inv.balanceAmount !== undefined ? inv.balanceAmount : grand);
      } else {
        const bal = inv.balanceAmount !== undefined ? inv.balanceAmount : Math.max(0, grand - (inv.paidAmount || 0));
        const pd = inv.paidAmount !== undefined ? inv.paidAmount : (grand - bal);
        collected += pd;
        outstanding += bal;
      }

      inv.items.forEach(it => {
        itemsSold += Number(it.quantity) || 0;
      });
    });

    const totalBills = filteredInvoices.length;
    const avgBillValue = totalBills > 0 ? sales / totalBills : 0;

    return {
      totalSales: sales,
      amountCollected: collected,
      outstanding: Math.max(0, outstanding),
      totalBills,
      totalItemsSold: itemsSold,
      averageBillValue: avgBillValue,
    };
  }, [filteredInvoices]);

  // --- SALES TREND OVER TIME (Actual Bills Grouped by Daily/Weekly/Monthly) ---
  const trendData = useMemo(() => {
    const map: { [key: string]: { period: string; sortKey: string; sales: number; collected: number; outstanding: number; billsCount: number } } = {};

    filteredInvoices.forEach(inv => {
      const grand = inv.grandTotal || 0;
      let pd = 0;
      let bal = 0;

      if (inv.paymentStatus === 'Paid') {
        pd = grand;
      } else if (inv.paymentStatus === 'Pending') {
        bal = inv.balanceAmount !== undefined ? inv.balanceAmount : grand;
      } else {
        bal = inv.balanceAmount !== undefined ? inv.balanceAmount : Math.max(0, grand - (inv.paidAmount || 0));
        pd = inv.paidAmount !== undefined ? inv.paidAmount : (grand - bal);
      }

      let key = inv.date;
      let label = formatDate(inv.date);

      if (trendGrouping === 'monthly') {
        key = inv.date.slice(0, 7); // YYYY-MM
        const [y, m] = key.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${monthNames[parseInt(m, 10) - 1]} ${y}`;
      } else if (trendGrouping === 'weekly') {
        // Group by ISO week or 7-day bracket
        const d = new Date(inv.date);
        const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
        const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        label = `Wk ${weekNum} (${d.getFullYear()})`;
      } else {
        // Daily: format like "18 Sep"
        const d = new Date(inv.date);
        const day = d.getDate();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${day} ${monthNames[d.getMonth()]}`;
      }

      if (!map[key]) {
        map[key] = { period: label, sortKey: key, sales: 0, collected: 0, outstanding: 0, billsCount: 0 };
      }

      map[key].sales += grand;
      map[key].collected += pd;
      map[key].outstanding += bal;
      map[key].billsCount += 1;
    });

    return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [filteredInvoices, trendGrouping]);

  // --- PAYMENT STATUS DONUT DATA & BREAKDOWN ---
  const paymentBreakdown = useMemo(() => {
    let paidCount = 0;
    let paidTotal = 0;
    let partialCount = 0;
    let partialTotal = 0;
    let pendingCount = 0;
    let pendingTotal = 0;

    filteredInvoices.forEach(inv => {
      const grand = inv.grandTotal || 0;
      if (inv.paymentStatus === 'Paid') {
        paidCount++;
        paidTotal += grand;
      } else if (inv.paymentStatus === 'Partial') {
        partialCount++;
        partialTotal += grand;
      } else {
        pendingCount++;
        pendingTotal += grand;
      }
    });

    const chartData = [
      { name: 'Paid', value: paidCount, amount: paidTotal, color: '#4F7D5A' },
      { name: 'Partial', value: partialCount, amount: partialTotal, color: '#C98232' },
      { name: 'Pending', value: pendingCount, amount: pendingTotal, color: '#B94A48' },
    ].filter(d => d.value > 0);

    return {
      chartData,
      paidCount,
      paidTotal,
      partialCount,
      partialTotal,
      pendingCount,
      pendingTotal,
    };
  }, [filteredInvoices]);

  // --- PRODUCT-WISE SALES PERFORMANCE ---
  const productPerformance = useMemo(() => {
    const map: { [key: string]: { 
      name: string; 
      category: string; 
      quantity: number; 
      billsSet: Set<string>; 
      salesAmount: number; 
      unit: string;
    } } = {};

    filteredInvoices.forEach(inv => {
      inv.items.forEach(it => {
        const prodName = it.productName || it.bagType;
        const key = prodName.trim();
        const cat = it.category || (products.find(p => p.name === prodName || p.bagType === it.bagType)?.category) || 'Gunny';
        const unit = it.unit || 'Bag';

        if (!map[key]) {
          map[key] = {
            name: key,
            category: cat,
            quantity: 0,
            billsSet: new Set<string>(),
            salesAmount: 0,
            unit,
          };
        }

        map[key].quantity += Number(it.quantity) || 0;
        map[key].salesAmount += it.totalAmount || (it.quantity * it.pricePerBag);
        map[key].billsSet.add(inv.id);
      });
    });

    const list = Object.values(map).map(p => ({
      name: p.name,
      category: p.category,
      quantitySold: p.quantity,
      billsCount: p.billsSet.size,
      salesAmount: p.salesAmount,
      averageRate: p.quantity > 0 ? p.salesAmount / p.quantity : 0,
      unit: p.unit,
    }));

    if (productSortBy === 'quantity') {
      return list.sort((a, b) => b.quantitySold - a.quantitySold);
    }
    if (productSortBy === 'bills') {
      return list.sort((a, b) => b.billsCount - a.billsCount);
    }
    return list.sort((a, b) => b.salesAmount - a.salesAmount);
  }, [filteredInvoices, products, productSortBy]);

  // --- PARTY-WISE SALES PERFORMANCE ---
  const partyPerformance = useMemo(() => {
    const map: { [key: string]: {
      partyName: string;
      partyPhone: string;
      billsCount: number;
      totalSales: number;
      amountPaid: number;
      outstanding: number;
      lastTransaction: string;
      bills: Invoice[];
    } } = {};

    filteredInvoices.forEach(inv => {
      const name = inv.partyName ? inv.partyName.trim() : 'Counter Sale';
      if (!map[name]) {
        map[name] = {
          partyName: name,
          partyPhone: inv.partyPhone || '',
          billsCount: 0,
          totalSales: 0,
          amountPaid: 0,
          outstanding: 0,
          lastTransaction: inv.date,
          bills: [],
        };
      }

      const grand = inv.grandTotal || 0;
      let pd = 0;
      let bal = 0;

      if (inv.paymentStatus === 'Paid') {
        pd = grand;
      } else if (inv.paymentStatus === 'Pending') {
        bal = inv.balanceAmount !== undefined ? inv.balanceAmount : grand;
      } else {
        bal = inv.balanceAmount !== undefined ? inv.balanceAmount : Math.max(0, grand - (inv.paidAmount || 0));
        pd = inv.paidAmount !== undefined ? inv.paidAmount : (grand - bal);
      }

      map[name].billsCount += 1;
      map[name].totalSales += grand;
      map[name].amountPaid += pd;
      map[name].outstanding += bal;
      map[name].bills.push(inv);

      if (!map[name].lastTransaction || inv.date > map[name].lastTransaction) {
        map[name].lastTransaction = inv.date;
      }
    });

    return Object.values(map).sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredInvoices]);

  // --- OUTSTANDING & AGEING REPORT ---
  const outstandingReport = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unpaidInvoices = filteredInvoices.filter(inv => {
      const isPaid = inv.paymentStatus === 'Paid';
      const bal = inv.balanceAmount !== undefined ? inv.balanceAmount : Math.max(0, inv.grandTotal - (inv.paidAmount || 0));
      return !isPaid && bal > 0.01;
    });

    // Age calculation in days
    const enriched = unpaidInvoices.map(inv => {
      const grand = inv.grandTotal || 0;
      const pd = inv.paidAmount || 0;
      const bal = inv.balanceAmount !== undefined ? inv.balanceAmount : Math.max(0, grand - pd);

      const invDate = new Date(inv.date);
      invDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - invDate.getTime();
      const ageDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      let bracket = '0–7 days';
      if (ageDays >= 60) bracket = '60+ days';
      else if (ageDays >= 31) bracket = '31–60 days';
      else if (ageDays >= 16) bracket = '16–30 days';
      else if (ageDays >= 8) bracket = '8–15 days';

      return {
        ...inv,
        paidCalculated: pd,
        balanceCalculated: bal,
        ageDays,
        bracket,
      };
    });

    // Sort highest balance first
    enriched.sort((a, b) => b.balanceCalculated - a.balanceCalculated);

    // Ageing summary buckets
    const ageingSummary = {
      '0–7 days': 0,
      '8–15 days': 0,
      '16–30 days': 0,
      '31–60 days': 0,
      '60+ days': 0,
    };

    enriched.forEach(item => {
      ageingSummary[item.bracket as keyof typeof ageingSummary] += item.balanceCalculated;
    });

    return {
      bills: enriched,
      ageingSummary,
      totalOutstanding: enriched.reduce((sum, b) => sum + b.balanceCalculated, 0),
    };
  }, [filteredInvoices]);

  // --- GST SUMMARY ---
  const gstSummary = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    // GST rate breakdown buckets
    const rateBrackets: { [key: number]: { taxable: number; gst: number; billsCount: number } } = {
      0: { taxable: 0, gst: 0, billsCount: 0 },
      5: { taxable: 0, gst: 0, billsCount: 0 },
      12: { taxable: 0, gst: 0, billsCount: 0 },
      18: { taxable: 0, gst: 0, billsCount: 0 },
      28: { taxable: 0, gst: 0, billsCount: 0 },
    };

    filteredInvoices.forEach(inv => {
      taxable += Number(inv.taxableAmount) || 0;
      cgst += Number(inv.cgstTotal) || 0;
      sgst += Number(inv.sgstTotal) || 0;
      igst += Number(inv.igstTotal) || 0;

      const seenBracketsInInvoice = new Set<number>();

      inv.items.forEach(it => {
        const rate = it.gstRate || 0;
        if (!rateBrackets[rate]) {
          rateBrackets[rate] = { taxable: 0, gst: 0, billsCount: 0 };
        }
        rateBrackets[rate].taxable += Number(it.taxableAmount) || 0;
        rateBrackets[rate].gst += (Number(it.cgstAmount || 0) + Number(it.sgstAmount || 0) + Number(it.igstAmount || 0));
        seenBracketsInInvoice.add(rate);
      });

      seenBracketsInInvoice.forEach(r => {
        if (rateBrackets[r]) rateBrackets[r].billsCount += 1;
      });
    });

    const totalGst = cgst + sgst + igst;

    return {
      taxableAmount: taxable,
      cgst,
      sgst,
      igst,
      totalGst,
      rateBrackets: Object.entries(rateBrackets)
        .map(([rate, data]) => ({ rate: Number(rate), ...data }))
        .filter(b => b.taxable > 0 || b.gst > 0)
        .sort((a, b) => a.rate - b.rate),
    };
  }, [filteredInvoices]);

  // --- BILL VALUE DISTRIBUTION ---
  const billValueDistribution = useMemo(() => {
    const buckets = [
      { range: '₹0 – ₹10K', min: 0, max: 10000, count: 0, total: 0 },
      { range: '₹10K – ₹25K', min: 10000, max: 25000, count: 0, total: 0 },
      { range: '₹25K – ₹50K', min: 25000, max: 50000, count: 0, total: 0 },
      { range: '₹50K – ₹1L', min: 50000, max: 100000, count: 0, total: 0 },
      { range: '₹1L+', min: 100000, max: Infinity, count: 0, total: 0 },
    ];

    filteredInvoices.forEach(inv => {
      const g = inv.grandTotal || 0;
      for (const b of buckets) {
        if (g >= b.min && (b.max === Infinity ? true : g < b.max)) {
          b.count++;
          b.total += g;
          break;
        }
      }
    });

    return buckets;
  }, [filteredInvoices]);

  // --- RECENT 10 TRANSACTIONS ---
  const recentTransactions = useMemo(() => {
    return [...filteredInvoices]
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || a.date).getTime() || 0;
        const timeB = new Date(b.createdAt || b.date).getTime() || 0;
        return timeB - timeA;
      })
      .slice(0, 10);
  }, [filteredInvoices]);

  // --- EXPORT TO CSV ---
  const handleExportCSV = () => {
    const lines: string[] = [];

    // Header Metadata
    lines.push(`"${settings.businessName} - Business Sales & Audit Report"`);
    lines.push(`"Report Generated Date: ${getTodayDateString()}"`);
    lines.push(`"Filter Period: ${dateRangeBounds.label}"`);
    lines.push(`"Payment Status: ${filterPaymentStatus}"`);
    lines.push(`"Party Filter: ${filterParty}"`);
    lines.push(`"Product Filter: ${filterProduct}"`);
    lines.push('');

    // KPI Summary
    lines.push('"--- KPI METRICS ---"');
    lines.push('"Total Sales (₹)","Amount Collected (₹)","Outstanding (₹)","Total Bills","Total Items Sold","Average Bill Value (₹)"');
    lines.push(`"${kpiMetrics.totalSales.toFixed(2)}","${kpiMetrics.amountCollected.toFixed(2)}","${kpiMetrics.outstanding.toFixed(2)}","${kpiMetrics.totalBills}","${kpiMetrics.totalItemsSold}","${kpiMetrics.averageBillValue.toFixed(2)}"`);
    lines.push('');

    // GST Summary
    lines.push('"--- GST SUMMARY ---"');
    lines.push('"Taxable Amount (₹)","CGST (₹)","SGST (₹)","IGST (₹)","Total GST (₹)"');
    lines.push(`"${gstSummary.taxableAmount.toFixed(2)}","${gstSummary.cgst.toFixed(2)}","${gstSummary.sgst.toFixed(2)}","${gstSummary.igst.toFixed(2)}","${gstSummary.totalGst.toFixed(2)}"`);
    lines.push('');

    // Product-Wise Sales
    lines.push('"--- PRODUCT PERFORMANCE ---"');
    lines.push('"Product / Bag Type","Category","Quantity Sold","Bills Count","Sales Amount (₹)","Average Rate (₹)"');
    productPerformance.forEach(p => {
      lines.push(`"${p.name}","${p.category}","${p.quantitySold} ${p.unit}","${p.billsCount}","${p.salesAmount.toFixed(2)}","${p.averageRate.toFixed(2)}"`);
    });
    lines.push('');

    // Party-Wise Sales
    lines.push('"--- PARTY PERFORMANCE ---"');
    lines.push('"Party Name","Bills Count","Total Sales (₹)","Amount Paid (₹)","Outstanding (₹)","Last Transaction"');
    partyPerformance.forEach(p => {
      lines.push(`"${p.partyName}","${p.billsCount}","${p.totalSales.toFixed(2)}","${p.amountPaid.toFixed(2)}","${p.outstanding.toFixed(2)}","${p.lastTransaction}"`);
    });
    lines.push('');

    // Detailed Invoices
    lines.push('"--- DETAILED BILLS LEDGER ---"');
    lines.push('"Date","Invoice Number","Party Name","Phone","Items Summary","Taxable Amount (₹)","Grand Total (₹)","Paid Amount (₹)","Balance Due (₹)","Status"');
    filteredInvoices.forEach(inv => {
      const itemsText = inv.items.map(it => `${it.bagType} x ${it.quantity}`).join('; ');
      const isPaid = inv.paymentStatus === 'Paid';
      const isPending = inv.paymentStatus === 'Pending';
      const pd = isPaid ? inv.grandTotal : (isPending ? 0 : (inv.paidAmount || 0));
      const bal = inv.balanceAmount !== undefined ? inv.balanceAmount : (isPaid ? 0 : Math.max(0, inv.grandTotal - pd));
      lines.push(`"${inv.date}","${inv.invoiceNumber}","${inv.partyName}","${inv.partyPhone || ''}","${itemsText}","${(inv.taxableAmount || 0).toFixed(2)}","${inv.grandTotal.toFixed(2)}","${pd.toFixed(2)}","${bal.toFixed(2)}","${inv.paymentStatus}"`);
    });

    const csvContent = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BagBill_Report_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Report CSV exported successfully', 'success');
  };

  // --- EXPORT TO PDF ---
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Background Paper tint
      doc.setFillColor(255, 253, 248);
      doc.rect(margin, margin, contentWidth, 273, 'F');
      doc.setDrawColor(228, 215, 200);
      doc.setLineWidth(0.5);
      doc.rect(margin, margin, contentWidth, 273, 'S');

      // Header Banner
      doc.setFillColor(59, 41, 33); // #3B2921
      doc.rect(margin, margin, contentWidth, 20, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(settings.businessName.toUpperCase(), margin + 6, margin + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(201, 149, 99); // #C99563
      doc.text('BUSINESS AUDIT & ANALYTICS REPORT', margin + 6, margin + 14);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(`Generated: ${formatDate(getTodayDateString())}`, pageWidth - margin - 6, margin + 8, { align: 'right' });
      doc.text(`Period: ${dateRangeBounds.label}`, pageWidth - margin - 6, margin + 14, { align: 'right' });

      y = margin + 26;

      // KPI Summary Section
      doc.setTextColor(59, 41, 33);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('1. EXECUTIVE FINANCIAL SUMMARY', margin + 6, y);
      y += 4;

      // 6 KPI Blocks
      const kpis = [
        { label: 'Total Sales', value: formatINR(kpiMetrics.totalSales) },
        { label: 'Amount Collected', value: formatINR(kpiMetrics.amountCollected) },
        { label: 'Outstanding Balance', value: formatINR(kpiMetrics.outstanding) },
        { label: 'Total Invoices', value: `${kpiMetrics.totalBills}` },
        { label: 'Total Bags Sold', value: `${kpiMetrics.totalItemsSold.toLocaleString('en-IN')}` },
        { label: 'Average Bill Value', value: formatINR(kpiMetrics.averageBillValue) },
      ];

      const colW = (contentWidth - 8) / 3;
      kpis.forEach((kpi, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const bx = margin + 4 + col * colW;
        const by = y + row * 15;

        doc.setFillColor(247, 243, 234);
        doc.setDrawColor(228, 215, 200);
        doc.roundedRect(bx, by, colW - 2, 13, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(139, 94, 60);
        doc.text(kpi.label.toUpperCase(), bx + 3, by + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(59, 41, 33);
        doc.text(kpi.value, bx + 3, by + 10);
      });

      y += 35;

      // GST Summary Section
      doc.setTextColor(59, 41, 33);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('2. TAX & GST RECONCILIATION', margin + 6, y);
      y += 4;

      doc.setFillColor(247, 243, 234);
      doc.rect(margin + 4, y, contentWidth - 8, 12, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(44, 33, 27);
      doc.text(`Taxable: ${formatINR(gstSummary.taxableAmount)}`, margin + 8, y + 7);
      doc.text(`CGST: ${formatINR(gstSummary.cgst)}`, margin + 55, y + 7);
      doc.text(`SGST: ${formatINR(gstSummary.sgst)}`, margin + 95, y + 7);
      doc.text(`IGST: ${formatINR(gstSummary.igst)}`, margin + 135, y + 7);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total GST: ${formatINR(gstSummary.totalGst)}`, pageWidth - margin - 8, y + 7, { align: 'right' });

      y += 18;

      // Top Products Section
      doc.setTextColor(59, 41, 33);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('3. TOP PRODUCT SALES', margin + 6, y);
      y += 4;

      // Product Table Header
      doc.setFillColor(59, 41, 33);
      doc.rect(margin + 4, y, contentWidth - 8, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.text('BAG PRODUCT', margin + 8, y + 4.2);
      doc.text('CATEGORY', margin + 65, y + 4.2);
      doc.text('QUANTITY', margin + 95, y + 4.2);
      doc.text('BILLS', margin + 125, y + 4.2);
      doc.text('AVG RATE', margin + 145, y + 4.2);
      doc.text('TOTAL SALES', pageWidth - margin - 8, y + 4.2, { align: 'right' });
      y += 6;

      productPerformance.slice(0, 5).forEach((prod, i) => {
        doc.setFillColor(i % 2 === 0 ? 255 : 247, i % 2 === 0 ? 253 : 243, i % 2 === 0 ? 248 : 234);
        doc.rect(margin + 4, y, contentWidth - 8, 5.5, 'F');
        doc.setTextColor(44, 33, 27);
        doc.setFont('helvetica', 'normal');
        doc.text(prod.name, margin + 8, y + 3.8);
        doc.text(prod.category, margin + 65, y + 3.8);
        doc.text(`${prod.quantitySold.toLocaleString('en-IN')} ${prod.unit}`, margin + 95, y + 3.8);
        doc.text(`${prod.billsCount}`, margin + 125, y + 3.8);
        doc.text(formatINR(prod.averageRate), margin + 145, y + 3.8);
        doc.setFont('helvetica', 'bold');
        doc.text(formatINR(prod.salesAmount), pageWidth - margin - 8, y + 3.8, { align: 'right' });
        y += 5.5;
      });

      y += 8;

      // Outstanding Receivables
      doc.setTextColor(59, 41, 33);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`4. OUTSTANDING RECEIVABLES (${formatINR(outstandingReport.totalOutstanding)})`, margin + 6, y);
      y += 4;

      doc.setFillColor(59, 41, 33);
      doc.rect(margin + 4, y, contentWidth - 8, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.text('CUSTOMER / PARTY', margin + 8, y + 4.2);
      doc.text('INVOICE #', margin + 65, y + 4.2);
      doc.text('DATE', margin + 95, y + 4.2);
      doc.text('AGE', margin + 125, y + 4.2);
      doc.text('BALANCE DUE', pageWidth - margin - 8, y + 4.2, { align: 'right' });
      y += 6;

      if (outstandingReport.bills.length === 0) {
        doc.setFillColor(247, 243, 234);
        doc.rect(margin + 4, y, contentWidth - 8, 7, 'F');
        doc.setTextColor(79, 125, 90);
        doc.text('All bills cleared. Zero outstanding balance.', margin + 8, y + 4.8);
        y += 7;
      } else {
        outstandingReport.bills.slice(0, 5).forEach((b, i) => {
          doc.setFillColor(i % 2 === 0 ? 255 : 247, i % 2 === 0 ? 253 : 243, i % 2 === 0 ? 248 : 234);
          doc.rect(margin + 4, y, contentWidth - 8, 5.5, 'F');
          doc.setTextColor(44, 33, 27);
          doc.setFont('helvetica', 'normal');
          doc.text(b.partyName, margin + 8, y + 3.8);
          doc.text(b.invoiceNumber, margin + 65, y + 3.8);
          doc.text(b.date, margin + 95, y + 3.8);
          doc.text(`${b.ageDays}d (${b.bracket})`, margin + 125, y + 3.8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(185, 74, 72);
          doc.text(formatINR(b.balanceCalculated), pageWidth - margin - 8, y + 3.8, { align: 'right' });
          y += 5.5;
        });
      }

      // Footer
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(139, 94, 60);
      doc.text('BagBill Wholesale Management System — Computer Generated Business Report', pageWidth / 2, 280, { align: 'center' });

      doc.save(`BagBill_Analytics_Report_${getTodayDateString()}.pdf`);
      showToast('Report PDF downloaded successfully', 'success');
    } catch (e) {
      console.error('Failed to export PDF', e);
      showToast('Error generating PDF report', 'error');
    }
  };

  // Helper to open party ledger modal
  const handleOpenPartyLedger = (partyName: string) => {
    const found = parties.find(p => p.name.trim().toLowerCase() === partyName.trim().toLowerCase());
    if (found) {
      setSelectedPartyForLedger(found);
    } else {
      // Create synthetic Party for counter sale or unregistered party
      setSelectedPartyForLedger({
        id: `party-temp-${Date.now()}`,
        name: partyName,
        phone: '',
        address: 'Local Market',
        totalPurchases: 0,
        paidAmount: 0,
        pendingAmount: 0,
        lastTransactionDate: '',
      });
    }
  };

  // Party stats for active ledger modal
  const activePartyLedgerStats = useMemo(() => {
    if (!selectedPartyForLedger) return null;
    const nameNorm = selectedPartyForLedger.name.trim().toLowerCase();
    const partyBills = invoices.filter(inv => (inv.partyName || '').trim().toLowerCase() === nameNorm);

    let totalPurchases = 0;
    let paidAmount = 0;
    let outstanding = 0;

    partyBills.forEach(inv => {
      const g = inv.grandTotal || 0;
      totalPurchases += g;
      if (inv.paymentStatus === 'Paid') {
        paidAmount += g;
      } else if (inv.paymentStatus === 'Pending') {
        outstanding += (inv.balanceAmount !== undefined ? inv.balanceAmount : g);
      } else {
        const bal = inv.balanceAmount !== undefined ? inv.balanceAmount : Math.max(0, g - (inv.paidAmount || 0));
        const pd = inv.paidAmount !== undefined ? inv.paidAmount : (g - bal);
        paidAmount += pd;
        outstanding += bal;
      }
    });

    return {
      bills: partyBills,
      totalBills: partyBills.length,
      totalPurchases,
      paidAmount,
      outstanding: Math.max(0, outstanding),
    };
  }, [selectedPartyForLedger, invoices]);

  // Unique list of product names for filter
  const productFilterOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => set.add(p.name));
    invoices.forEach(inv => inv.items.forEach(it => {
      if (it.productName) set.add(it.productName);
      if (it.bagType) set.add(it.bagType);
    }));
    return Array.from(set);
  }, [products, invoices]);

  // Unique list of party names for filter
  const partyFilterOptions = useMemo(() => {
    const set = new Set<string>();
    parties.forEach(p => set.add(p.name));
    invoices.forEach(inv => {
      if (inv.partyName) set.add(inv.partyName);
    });
    return Array.from(set);
  }, [parties, invoices]);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & EXPORT ACTIONS */}
      <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-[#3B2921] text-[#C99563] shadow-xs">
            <BarChart3 size={22} />
          </span>
          <div>
            <h2 className="text-xl font-black text-[#3B2921]">Business Reports & Analytics</h2>
            <p className="text-xs text-[#8B5E3C]">
              Audited sales metrics, collection ledger, GST liabilities, and real-time wholesale performance
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] border border-[#E4D7C8] text-[#3B2921] font-bold text-xs transition-all active:scale-95 shadow-xs"
            title="Export full filtered report to CSV"
          >
            <FileSpreadsheet size={15} className="text-[#8B5E3C]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs transition-all active:scale-95 shadow-xs"
            title="Download audit-ready PDF summary report"
          >
            <Download size={15} className="text-[#C99563]" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* 2. TOP FILTER BAR */}
      <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Date Range Presets */}
          <div className="flex items-center flex-wrap gap-1 bg-[#F7F3EA] p-1 rounded-xl border border-[#E4D7C8]">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'year', label: 'This Year' },
              { id: 'custom', label: 'Custom' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setFilterPeriod(p.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filterPeriod === p.id
                    ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                    : 'text-[#8B5E3C] hover:text-[#3B2921]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Active Period Label / Reset Button */}
          <div className="flex items-center gap-2 self-end lg:self-center">
            {isFilterActive && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#8B5E3C] hover:text-[#3B2921] text-xs font-bold border border-[#E4D7C8] transition-colors"
              >
                <RotateCcw size={13} />
                <span>Reset Filters</span>
              </button>
            )}
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#F7F3EA] text-[#3B2921] border border-[#E4D7C8]">
              {dateRangeBounds.label}
            </span>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {filterPeriod === 'custom' && (
          <div className="p-3 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-[#8B5E3C] flex items-center gap-1">
              <Calendar size={14} />
              <span>Select Date Range:</span>
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none"
              />
              <span className="text-[#8B5E3C]">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none"
              />
            </div>
          </div>
        )}

        {/* Dropdown Filters: Payment Status, Product, Party */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E4D7C8]/70">
          {/* Payment Status Dropdown */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C] mb-1">
              Payment Status
            </label>
            <select
              value={filterPaymentStatus}
              onChange={e => setFilterPaymentStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs font-bold text-[#3B2921] outline-none cursor-pointer"
            >
              <option value="All">All Payment Statuses</option>
              <option value="Paid">Paid Only</option>
              <option value="Partial">Partial Only</option>
              <option value="Pending">Pending Only</option>
            </select>
          </div>

          {/* Product Dropdown */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C] mb-1">
              Product / Bag Type
            </label>
            <select
              value={filterProduct}
              onChange={e => setFilterProduct(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs font-bold text-[#3B2921] outline-none cursor-pointer"
            >
              <option value="All">All Bag Products</option>
              {productFilterOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Party Dropdown */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C] mb-1">
              Customer / Party
            </label>
            <select
              value={filterParty}
              onChange={e => setFilterParty(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs font-bold text-[#3B2921] outline-none cursor-pointer"
            >
              <option value="All">All Trade Parties</option>
              {partyFilterOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. KPI CARDS (6 METRICS AS SPECIFIED) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Sales */}
        <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8B5E3C] text-[11px] font-bold uppercase tracking-wider">
            <span>Total Sales</span>
            <TrendingUp size={15} className="text-[#4F7D5A]" />
          </div>
          <div className="text-lg font-black font-mono text-[#3B2921] mt-2">
            {formatINR(kpiMetrics.totalSales)}
          </div>
          <p className="text-[10px] text-[#8B5E3C] mt-0.5">Sum of Grand Total</p>
        </div>

        {/* Amount Collected */}
        <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#4F7D5A] text-[11px] font-bold uppercase tracking-wider">
            <span>Collected</span>
            <CheckCircle2 size={15} className="text-[#4F7D5A]" />
          </div>
          <div className="text-lg font-black font-mono text-[#4F7D5A] mt-2">
            {formatINR(kpiMetrics.amountCollected)}
          </div>
          <p className="text-[10px] text-[#4F7D5A]/80 font-medium mt-0.5">Settled payments</p>
        </div>

        {/* Outstanding */}
        <div 
          onClick={() => setFilterPaymentStatus(filterPaymentStatus === 'Pending' ? 'All' : 'Pending')}
          className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between cursor-pointer hover:border-[#B94A48] transition-colors"
          title="Click to filter by unpaid/pending bills"
        >
          <div className="flex items-center justify-between text-[#B94A48] text-[11px] font-bold uppercase tracking-wider">
            <span>Outstanding</span>
            <Clock size={15} className="text-[#B94A48]" />
          </div>
          <div className="text-lg font-black font-mono text-[#B94A48] mt-2">
            {formatINR(kpiMetrics.outstanding)}
          </div>
          <p className="text-[10px] text-[#B94A48]/80 font-medium mt-0.5">Balance due</p>
        </div>

        {/* Total Bills */}
        <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8B5E3C] text-[11px] font-bold uppercase tracking-wider">
            <span>Total Bills</span>
            <Receipt size={15} className="text-[#8B5E3C]" />
          </div>
          <div className="text-lg font-black font-mono text-[#3B2921] mt-2">
            {kpiMetrics.totalBills}
          </div>
          <p className="text-[10px] text-[#8B5E3C] mt-0.5">Genuine invoices</p>
        </div>

        {/* Total Items Sold */}
        <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8B5E3C] text-[11px] font-bold uppercase tracking-wider">
            <span>Items Sold</span>
            <ShoppingBag size={15} className="text-[#C99563]" />
          </div>
          <div className="text-lg font-black font-mono text-[#3B2921] mt-2">
            {kpiMetrics.totalItemsSold.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-[#8B5E3C] mt-0.5">Bags dispatched</p>
        </div>

        {/* Average Bill Value */}
        <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8B5E3C] text-[11px] font-bold uppercase tracking-wider">
            <span>Avg Bill Value</span>
            <DollarSign size={15} className="text-[#8B5E3C]" />
          </div>
          <div className="text-lg font-black font-mono text-[#3B2921] mt-2">
            {formatINR(kpiMetrics.averageBillValue)}
          </div>
          <p className="text-[10px] text-[#8B5E3C] mt-0.5">Sales / Total bills</p>
        </div>
      </div>

      {/* EMPTY STATE WARNING IF NO BILLS MATCH FILTER */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F7F3EA] text-[#8B5E3C] flex items-center justify-center mx-auto">
            <Receipt size={24} />
          </div>
          <h3 className="font-bold text-base text-[#3B2921]">No Transactions Found</h3>
          <p className="text-xs text-[#8B5E3C] max-w-sm mx-auto">
            No bills match the selected date range, payment status, product, or customer filters.
          </p>
          <button
            onClick={resetAllFilters}
            className="px-4 py-2 rounded-xl bg-[#3B2921] text-[#FFFDF8] text-xs font-bold shadow-xs hover:bg-[#4E372C] transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <>
          {/* 4. SALES TREND & PAYMENT STATUS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sales Over Time Chart */}
            <div className="lg:col-span-8 bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-[#E4D7C8] gap-2">
                <div>
                  <h3 className="font-black text-base text-[#3B2921]">Sales Over Time</h3>
                  <p className="text-xs text-[#8B5E3C]">Revenue, collections, and balance trends based on actual bills</p>
                </div>

                {/* Grouping switch: Daily / Weekly / Monthly */}
                <div className="flex bg-[#F7F3EA] p-1 rounded-xl border border-[#E4D7C8] text-xs font-bold">
                  {(['daily', 'weekly', 'monthly'] as const).map(grp => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setTrendGrouping(grp)}
                      className={`px-3 py-1 rounded-lg capitalize transition-all ${
                        trendGrouping === grp
                          ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                          : 'text-[#8B5E3C] hover:text-[#3B2921]'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="h-72 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4D7C8" />
                    <XAxis dataKey="period" tick={{ fill: '#8B5E3C', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8B5E3C', fontSize: 11 }} tickFormatter={v => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip 
                      formatter={(val: any) => [formatINR(val), '']}
                      contentStyle={{ backgroundColor: '#FFFDF8', borderColor: '#E4D7C8', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Legend />
                    <Bar dataKey="sales" name="Total Sales" fill="#3B2921" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" name="Collected" fill="#4F7D5A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outstanding" name="Outstanding" fill="#B94A48" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Data Summary Grid */}
              <div className="mt-4 pt-3 border-t border-[#E4D7C8]/70 flex items-center justify-between text-xs text-[#8B5E3C]">
                <span>Showing <strong>{trendData.length}</strong> {trendGrouping} intervals</span>
                <span className="font-mono font-bold text-[#3B2921]">Total: {formatINR(kpiMetrics.totalSales)}</span>
              </div>
            </div>

            {/* Payment Status Donut & Breakdown */}
            <div className="lg:col-span-4 bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
              <div className="pb-3 border-b border-[#E4D7C8]">
                <h3 className="font-black text-base text-[#3B2921]">Payment Status</h3>
                <p className="text-xs text-[#8B5E3C]">Click a status to filter bills</p>
              </div>

              {/* Donut Chart */}
              <div className="h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentBreakdown.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      onClick={(entry: any) => {
                        if (entry && typeof entry.name === 'string') {
                          setFilterPaymentStatus(filterPaymentStatus === entry.name ? 'All' : entry.name);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {paymentBreakdown.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any, name: any, item: any) => [`${val} Bills (${formatINR(item.payload.amount)})`, name]}
                      contentStyle={{ backgroundColor: '#FFFDF8', borderColor: '#E4D7C8', borderRadius: '12px', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Interactive Status Pills */}
              <div className="space-y-2 pt-2 border-t border-[#E4D7C8]/70 text-xs">
                {/* Paid */}
                <div
                  onClick={() => setFilterPaymentStatus(filterPaymentStatus === 'Paid' ? 'All' : 'Paid')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    filterPaymentStatus === 'Paid'
                      ? 'bg-[#4F7D5A]/20 border-[#4F7D5A]'
                      : 'bg-[#F7F3EA] border-[#E4D7C8] hover:border-[#4F7D5A]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#4F7D5A]" />
                    <span className="font-bold text-[#3B2921]">Paid Bills</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#4F7D5A]">{paymentBreakdown.paidCount} bills</span>
                    <span className="font-mono text-[11px] text-[#8B5E3C] block">{formatINR(paymentBreakdown.paidTotal)}</span>
                  </div>
                </div>

                {/* Partial */}
                <div
                  onClick={() => setFilterPaymentStatus(filterPaymentStatus === 'Partial' ? 'All' : 'Partial')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    filterPaymentStatus === 'Partial'
                      ? 'bg-[#C98232]/20 border-[#C98232]'
                      : 'bg-[#F7F3EA] border-[#E4D7C8] hover:border-[#C98232]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C98232]" />
                    <span className="font-bold text-[#3B2921]">Partial Bills</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#C98232]">{paymentBreakdown.partialCount} bills</span>
                    <span className="font-mono text-[11px] text-[#8B5E3C] block">{formatINR(paymentBreakdown.partialTotal)}</span>
                  </div>
                </div>

                {/* Pending */}
                <div
                  onClick={() => setFilterPaymentStatus(filterPaymentStatus === 'Pending' ? 'All' : 'Pending')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    filterPaymentStatus === 'Pending'
                      ? 'bg-[#B94A48]/20 border-[#B94A48]'
                      : 'bg-[#F7F3EA] border-[#E4D7C8] hover:border-[#B94A48]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B94A48]" />
                    <span className="font-bold text-[#3B2921]">Pending Bills</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#B94A48]">{paymentBreakdown.pendingCount} bills</span>
                    <span className="font-mono text-[11px] text-[#8B5E3C] block">{formatINR(paymentBreakdown.pendingTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. PRODUCT-WISE SALES & PARTY-WISE SALES ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Product Performance Section */}
            <div className="lg:col-span-7 bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-[#E4D7C8] gap-2">
                <div>
                  <h3 className="font-black text-base text-[#3B2921]">Product-Wise Sales</h3>
                  <p className="text-xs text-[#8B5E3C]">Volume and revenue breakdown by bag type</p>
                </div>

                {/* Sort selector */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-[#8B5E3C] font-semibold">Sort by:</span>
                  <div className="flex bg-[#F7F3EA] p-0.5 rounded-lg border border-[#E4D7C8]">
                    <button
                      onClick={() => setProductSortBy('sales')}
                      className={`px-2 py-1 rounded text-[11px] font-bold ${
                        productSortBy === 'sales' ? 'bg-[#3B2921] text-[#FFFDF8]' : 'text-[#8B5E3C]'
                      }`}
                    >
                      Sales
                    </button>
                    <button
                      onClick={() => setProductSortBy('quantity')}
                      className={`px-2 py-1 rounded text-[11px] font-bold ${
                        productSortBy === 'quantity' ? 'bg-[#3B2921] text-[#FFFDF8]' : 'text-[#8B5E3C]'
                      }`}
                    >
                      Qty
                    </button>
                    <button
                      onClick={() => setProductSortBy('bills')}
                      className={`px-2 py-1 rounded text-[11px] font-bold ${
                        productSortBy === 'bills' ? 'bg-[#3B2921] text-[#FFFDF8]' : 'text-[#8B5E3C]'
                      }`}
                    >
                      Bills
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto pt-3">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Product / Bag Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Quantity Sold</th>
                      <th className="py-2.5 px-3 text-center">Bills</th>
                      <th className="py-2.5 px-3 text-right">Sales Amount</th>
                      <th className="py-2.5 px-3 text-right">Avg Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4D7C8]">
                    {productPerformance.map(prod => (
                      <tr 
                        key={prod.name}
                        onClick={() => setFilterProduct(filterProduct === prod.name ? 'All' : prod.name)}
                        className={`hover:bg-[#F7F3EA]/70 transition-colors cursor-pointer ${
                          filterProduct === prod.name ? 'bg-[#F7F3EA] font-bold' : ''
                        }`}
                        title="Click to filter reports by this product"
                      >
                        <td className="py-2.5 px-3 font-bold text-[#3B2921] flex items-center gap-2">
                          <ShoppingBag size={14} className="text-[#8B5E3C] shrink-0" />
                          <span>{prod.name}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C99563]/15 text-[#3B2921] border border-[#C99563]/30">
                            {prod.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#3B2921]">
                          {prod.quantitySold.toLocaleString('en-IN')} <span className="text-[10px] text-[#8B5E3C] font-normal">{prod.unit}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-[#8B5E3C]">
                          {prod.billsCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-[#3B2921]">
                          {formatINR(prod.salesAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#8B5E3C]">
                          {formatINR(prod.averageRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Party-Wise Sales Section */}
            <div className="lg:col-span-5 bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
              <div>
                <div className="pb-4 border-b border-[#E4D7C8]">
                  <h3 className="font-black text-base text-[#3B2921]">Party-Wise Sales</h3>
                  <p className="text-xs text-[#8B5E3C]">Customer billing volume & outstanding balance. Click party for Ledger.</p>
                </div>

                <div className="overflow-x-auto pt-3">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Party Name</th>
                        <th className="py-2.5 px-2 text-center">Bills</th>
                        <th className="py-2.5 px-3 text-right">Total Sales</th>
                        <th className="py-2.5 px-3 text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4D7C8]">
                      {partyPerformance.map(party => (
                        <tr 
                          key={party.partyName}
                          onClick={() => handleOpenPartyLedger(party.partyName)}
                          className="hover:bg-[#F7F3EA]/70 transition-colors cursor-pointer group"
                          title="Click to view Customer Account Ledger"
                        >
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-[#3B2921] group-hover:underline block">
                              {party.partyName}
                            </span>
                            <span className="text-[10px] text-[#8B5E3C]">
                              Last: {formatDate(party.lastTransaction)}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-[#8B5E3C]">
                            {party.billsCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#3B2921]">
                            {formatINR(party.totalSales)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className={party.outstanding > 0 ? 'text-[#B94A48]' : 'text-[#4F7D5A]'}>
                              {formatINR(party.outstanding)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-[#E4D7C8]/70 text-[11px] text-[#8B5E3C] flex items-center justify-between">
                <span>Top customer: <strong>{partyPerformance[0]?.partyName || 'N/A'}</strong></span>
                <span className="text-[#3B2921] font-bold">Click party name to open Ledger</span>
              </div>
            </div>
          </div>

          {/* 6. OUTSTANDING REPORT & AGEING ANALYSIS */}
          <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-[#E4D7C8] gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base text-[#3B2921]">Outstanding Receivables & Ageing</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B94A48]/15 text-[#B94A48]">
                    {outstandingReport.bills.length} unpaid invoices
                  </span>
                </div>
                <p className="text-xs text-[#8B5E3C]">
                  Credit analysis sorted by highest outstanding balance with invoice ageing
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-[#8B5E3C] font-medium">Total Outstanding:</span>
                <div className="text-lg font-black font-mono text-[#B94A48]">
                  {formatINR(outstandingReport.totalOutstanding)}
                </div>
              </div>
            </div>

            {/* Ageing Summary Brackets */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { label: '0–7 days', amount: outstandingReport.ageingSummary['0–7 days'], color: 'text-[#3B2921]' },
                { label: '8–15 days', amount: outstandingReport.ageingSummary['8–15 days'], color: 'text-[#8B5E3C]' },
                { label: '16–30 days', amount: outstandingReport.ageingSummary['16–30 days'], color: 'text-[#C98232]' },
                { label: '31–60 days', amount: outstandingReport.ageingSummary['31–60 days'], color: 'text-[#B94A48]' },
                { label: '60+ days', amount: outstandingReport.ageingSummary['60+ days'], color: 'text-[#9B1C1C]' },
              ].map(bracket => (
                <div key={bracket.label} className="p-3 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-center">
                  <span className="text-[10px] font-bold text-[#8B5E3C] uppercase block">{bracket.label}</span>
                  <span className={`text-sm font-black font-mono mt-0.5 block ${bracket.color}`}>
                    {formatINR(bracket.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Outstanding Bills Table */}
            {outstandingReport.bills.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#E6F4EA] text-[#137333] text-center text-xs font-bold border border-[#CEEAD6]">
                🎉 Excellent! There are zero outstanding balances for the selected filter period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Party Name</th>
                      <th className="py-2.5 px-3 font-mono">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Ageing</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                      <th className="py-2.5 px-3 text-right">Paid Amount</th>
                      <th className="py-2.5 px-3 text-right">Balance Due</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4D7C8]">
                    {outstandingReport.bills.map(inv => (
                      <tr key={inv.id} className="hover:bg-[#F7F3EA]/70 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#3B2921]">
                          <button
                            onClick={() => handleOpenPartyLedger(inv.partyName)}
                            className="hover:underline text-left"
                          >
                            {inv.partyName}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#3B2921]">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2.5 px-3 text-[#8B5E3C]">
                          {formatDate(inv.date)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.ageDays >= 30 ? 'bg-[#FDE8E8] text-[#9B1C1C]' : 'bg-[#F7F3EA] text-[#8B5E3C]'
                          }`}>
                            {inv.ageDays} days ({inv.bracket})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#3B2921]">
                          {formatINR(inv.grandTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#4F7D5A]">
                          {formatINR(inv.paidCalculated)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-[#B94A48]">
                          {formatINR(inv.balanceCalculated)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <StatusBadge status={inv.paymentStatus} size="sm" />
                        </td>
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
                              onClick={() => downloadInvoicePDF(inv, settings)}
                              className="p-1 rounded text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 transition-colors"
                              title="Download PDF"
                            >
                              <Download size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 7. GST SUMMARY & TAX RECONCILIATION */}
          <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-[#E4D7C8] gap-2">
              <div>
                <h3 className="font-black text-base text-[#3B2921]">GST Tax Summary & Liabilities</h3>
                <p className="text-xs text-[#8B5E3C]">
                  Reconciliation of Taxable Turnover, CGST, SGST, and IGST from actual recorded invoices
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-[#8B5E3C] font-medium">Total GST Liability:</span>
                <div className="text-lg font-black font-mono text-[#3B2921]">
                  {formatINR(gstSummary.totalGst)}
                </div>
              </div>
            </div>

            {/* GST Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8]">
                <span className="text-[10px] font-bold text-[#8B5E3C] uppercase block">Taxable Turnover</span>
                <div className="text-base font-black font-mono text-[#3B2921] mt-1">
                  {formatINR(gstSummary.taxableAmount)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8]">
                <span className="text-[10px] font-bold text-[#8B5E3C] uppercase block">CGST (Central)</span>
                <div className="text-base font-black font-mono text-[#3B2921] mt-1">
                  {formatINR(gstSummary.cgst)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8]">
                <span className="text-[10px] font-bold text-[#8B5E3C] uppercase block">SGST (State)</span>
                <div className="text-base font-black font-mono text-[#3B2921] mt-1">
                  {formatINR(gstSummary.sgst)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8]">
                <span className="text-[10px] font-bold text-[#8B5E3C] uppercase block">IGST (Inter-State)</span>
                <div className="text-base font-black font-mono text-[#3B2921] mt-1">
                  {formatINR(gstSummary.igst)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#3B2921] text-[#FFFDF8]">
                <span className="text-[10px] font-bold text-[#C99563] uppercase block">Total Output GST</span>
                <div className="text-base font-black font-mono text-[#FFFDF8] mt-1">
                  {formatINR(gstSummary.totalGst)}
                </div>
              </div>
            </div>

            {/* GST Rate Brackets Table */}
            {gstSummary.rateBrackets.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-2">
                  Tax Breakdown by GST Slab
                </h4>
                <div className="overflow-x-auto border border-[#E4D7C8] rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-[#F7F3EA] border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2 px-3">GST Bracket</th>
                        <th className="py-2 px-3 text-right">Taxable Turnover</th>
                        <th className="py-2 px-3 text-right">Tax Collected</th>
                        <th className="py-2 px-3 text-center">Invoices</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4D7C8]">
                      {gstSummary.rateBrackets.map(slab => (
                        <tr key={slab.rate} className="hover:bg-[#F7F3EA]/50">
                          <td className="py-2 px-3 font-mono font-bold text-[#3B2921]">
                            {slab.rate}% GST Slab
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-[#3B2921]">
                            {formatINR(slab.taxable)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-[#3B2921]">
                            {formatINR(slab.gst)}
                          </td>
                          <td className="py-2 px-3 text-center text-[#8B5E3C]">
                            {slab.billsCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 8. TOP 5 PRODUCTS, TOP 5 CUSTOMERS & BILL VALUE DISTRIBUTION */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top 5 Products */}
            <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-[#E4D7C8]">
                  <ShoppingBag size={16} className="text-[#8B5E3C]" />
                  <h3 className="font-black text-sm text-[#3B2921]">Top Selling Products</h3>
                </div>
                <div className="space-y-3 pt-3">
                  {productPerformance.slice(0, 5).map((prod, idx) => {
                    const topSales = productPerformance[0]?.salesAmount || 1;
                    const pct = Math.round((prod.salesAmount / topSales) * 100);
                    return (
                      <div key={prod.name} className="space-y-1">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="font-bold text-[#3B2921] flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-[#F7F3EA] text-[10px] flex items-center justify-center font-bold text-[#8B5E3C] border border-[#E4D7C8]">
                              {idx + 1}
                            </span>
                            <span>{prod.name}</span>
                          </span>
                          <span className="font-mono font-bold text-[#3B2921]">
                            {formatINR(prod.salesAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-[#8B5E3C]">
                          <span>{prod.quantitySold.toLocaleString('en-IN')} {prod.unit}</span>
                          <div className="w-28 h-1.5 rounded-full bg-[#F7F3EA] overflow-hidden">
                            <div className="h-full bg-[#3B2921]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top 5 Customers */}
            <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-[#E4D7C8]">
                  <Users size={16} className="text-[#8B5E3C]" />
                  <h3 className="font-black text-sm text-[#3B2921]">Top Parties by Sales</h3>
                </div>
                <div className="space-y-3 pt-3">
                  {partyPerformance.slice(0, 5).map((party, idx) => {
                    return (
                      <div 
                        key={party.partyName}
                        onClick={() => handleOpenPartyLedger(party.partyName)}
                        className="p-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] transition-colors cursor-pointer space-y-1"
                        title="Click to view Party Ledger"
                      >
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="font-bold text-[#3B2921] flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-[#3B2921] text-[10px] flex items-center justify-center font-bold text-[#FFFDF8]">
                              {idx + 1}
                            </span>
                            <span>{party.partyName}</span>
                          </span>
                          <span className="font-mono font-bold text-[#3B2921]">
                            {formatINR(party.totalSales)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-[#8B5E3C]">
                          <span>{party.billsCount} bills</span>
                          <span>Due: <strong className={party.outstanding > 0 ? 'text-[#B94A48]' : 'text-[#4F7D5A]'}>{formatINR(party.outstanding)}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bill Value Distribution */}
            <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-[#E4D7C8]">
                  <BarChart3 size={16} className="text-[#8B5E3C]" />
                  <h3 className="font-black text-sm text-[#3B2921]">Bill Value Distribution</h3>
                </div>
                <div className="space-y-2.5 pt-3">
                  {billValueDistribution.map(b => {
                    const totalBills = kpiMetrics.totalBills || 1;
                    const pct = Math.round((b.count / totalBills) * 100);
                    return (
                      <div key={b.range} className="space-y-1">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="font-bold text-[#3B2921]">{b.range}</span>
                          <span className="font-mono text-[#8B5E3C]">{b.count} bills ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F7F3EA] overflow-hidden border border-[#E4D7C8]/50">
                          <div className="h-full bg-[#8B5E3C]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[10px] text-[#8B5E3C] pt-2 border-t border-[#E4D7C8]/70">
                Segmented by Grand Total value per invoice
              </p>
            </div>
          </div>

          {/* 9. RECENT TRANSACTIONS (LATEST 10 BILLS) */}
          <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-3.5">
            <div className="flex justify-between items-center pb-3 border-b border-[#E4D7C8]">
              <div>
                <h3 className="font-black text-base text-[#3B2921]">Recent Filtered Transactions</h3>
                <p className="text-xs text-[#8B5E3C]">Showing latest 10 invoices matching active filters</p>
              </div>
              <button
                onClick={() => navigate('/bill-book')}
                className="text-xs font-bold text-[#8B5E3C] hover:text-[#3B2921] flex items-center gap-1"
              >
                <span>View All in Bill Book</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#F7F3EA] border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 font-mono">Invoice #</th>
                    <th className="py-2.5 px-3">Party Name</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4D7C8]">
                  {recentTransactions.map(inv => {
                    const isPaid = inv.paymentStatus === 'Paid';
                    const isPending = inv.paymentStatus === 'Pending';
                    const pd = isPaid ? inv.grandTotal : (isPending ? 0 : (inv.paidAmount || 0));
                    const bal = inv.balanceAmount !== undefined ? inv.balanceAmount : (isPaid ? 0 : Math.max(0, inv.grandTotal - pd));

                    return (
                      <tr key={inv.id} className="hover:bg-[#F7F3EA]/60 transition-colors">
                        <td className="py-2.5 px-3 text-[#8B5E3C] whitespace-nowrap">
                          {formatDate(inv.date)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#3B2921] whitespace-nowrap">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#3B2921]">
                          <button
                            onClick={() => handleOpenPartyLedger(inv.partyName)}
                            className="hover:underline text-left"
                          >
                            {inv.partyName}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-[#3B2921]">
                          {formatINR(inv.grandTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#4F7D5A]">
                          {formatINR(pd)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          <span className={bal > 0 ? 'text-[#B94A48]' : 'text-[#4F7D5A]'}>
                            {formatINR(bal)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <StatusBadge status={inv.paymentStatus} size="sm" />
                        </td>
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
                              onClick={() => navigate('/create-bill', { state: { editInvoice: inv } })}
                              className="p-1 rounded text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 transition-colors"
                              title="Edit Invoice"
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
        </>
      )}

      {/* INVOICE PREVIEW MODAL */}
      {previewInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewInvoice(null)}
          title={`Invoice ${previewInvoice.invoiceNumber}`}
          subtitle={`Issued to ${previewInvoice.partyName}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex justify-end gap-2 pb-2 border-b border-[#E4D7C8]">
              <button
                onClick={() => printInvoice()}
                className="px-3 py-1.5 rounded-lg bg-[#F7F3EA] text-[#3B2921] text-xs font-bold hover:bg-[#EAE2D2] flex items-center gap-1"
              >
                <Printer size={14} />
                <span>Print</span>
              </button>
              <button
                onClick={() => downloadInvoicePDF(previewInvoice, settings)}
                className="px-3 py-1.5 rounded-lg bg-[#3B2921] text-[#FFFDF8] text-xs font-bold hover:bg-[#4E372C] flex items-center gap-1"
              >
                <Download size={14} className="text-[#C99563]" />
                <span>Download PDF</span>
              </button>
            </div>
            <InvoicePreview invoice={previewInvoice} settings={settings} />
          </div>
        </Modal>
      )}

      {/* PARTY LEDGER MODAL */}
      {selectedPartyForLedger && activePartyLedgerStats && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPartyForLedger(null)}
          title={`Party Ledger — ${selectedPartyForLedger.name}`}
          subtitle="Customer statement of account & billing breakdown"
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs text-[#2C211B]">
            {/* Profile Box */}
            <div className="p-4 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-black text-[#3B2921]">{selectedPartyForLedger.name}</h3>
                <div className="text-[11px] text-[#8B5E3C] mt-1 space-x-3">
                  <span>Phone: <strong>{selectedPartyForLedger.phone || 'N/A'}</strong></span>
                  <span>GSTIN: <strong>{selectedPartyForLedger.gstin || 'Unregistered'}</strong></span>
                  <span>Address: {selectedPartyForLedger.address || 'Local'}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedPartyForLedger(null);
                  navigate('/create-bill', { state: { preselectedParty: selectedPartyForLedger } });
                }}
                className="px-3.5 py-2 rounded-xl bg-[#3B2921] text-[#FFFDF8] font-bold text-xs hover:bg-[#4E372C]"
              >
                + Create Bill for {selectedPartyForLedger.name}
              </button>
            </div>

            {/* 4 Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8]">
                <span className="text-[10px] font-bold text-[#8B5E3C] uppercase block">Total Purchases</span>
                <span className="text-base font-black font-mono text-[#3B2921] mt-0.5 block">
                  {formatINR(activePartyLedgerStats.totalPurchases)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8]">
                <span className="text-[10px] font-bold text-[#4F7D5A] uppercase block">Amount Paid</span>
                <span className="text-base font-black font-mono text-[#4F7D5A] mt-0.5 block">
                  {formatINR(activePartyLedgerStats.paidAmount)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8]">
                <span className="text-[10px] font-bold text-[#B94A48] uppercase block">Outstanding Due</span>
                <span className={`text-base font-black font-mono mt-0.5 block ${activePartyLedgerStats.outstanding > 0 ? 'text-[#B94A48]' : 'text-[#4F7D5A]'}`}>
                  {formatINR(activePartyLedgerStats.outstanding)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8]">
                <span className="text-[10px] font-bold text-[#8B5E3C] uppercase block">Total Invoices</span>
                <span className="text-base font-black font-mono text-[#3B2921] mt-0.5 block">
                  {activePartyLedgerStats.totalBills}
                </span>
              </div>
            </div>

            {/* Invoices List */}
            <div className="border border-[#E4D7C8] rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#F7F3EA] border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3 font-mono">Invoice #</th>
                    <th className="py-2 px-3">Items Summary</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-right">Paid</th>
                    <th className="py-2 px-3 text-right">Balance</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4D7C8]">
                  {activePartyLedgerStats.bills.map(b => {
                    const isPaid = b.paymentStatus === 'Paid';
                    const isPending = b.paymentStatus === 'Pending';
                    const pd = isPaid ? b.grandTotal : (isPending ? 0 : (b.paidAmount || 0));
                    const bal = b.balanceAmount !== undefined ? b.balanceAmount : (isPaid ? 0 : Math.max(0, b.grandTotal - pd));
                    const summary = b.items.map(it => `${it.bagType} x ${it.quantity}`).join(', ');

                    return (
                      <tr key={b.id} className="hover:bg-[#F7F3EA]/50">
                        <td className="py-2 px-3 text-[#8B5E3C]">{formatDate(b.date)}</td>
                        <td className="py-2 px-3 font-mono font-bold text-[#3B2921]">{b.invoiceNumber}</td>
                        <td className="py-2 px-3 max-w-xs truncate" title={summary}>{summary}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#3B2921]">{formatINR(b.grandTotal)}</td>
                        <td className="py-2 px-3 text-right font-mono text-[#4F7D5A]">{formatINR(pd)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          <span className={bal > 0 ? 'text-[#B94A48]' : 'text-[#4F7D5A]'}>
                            {formatINR(bal)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <StatusBadge status={b.paymentStatus} size="sm" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedPartyForLedger(null)}
                className="px-4 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] font-bold text-xs"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
