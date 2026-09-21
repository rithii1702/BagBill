import { Invoice, Party } from '../types';
import { formatDate, getTodayDateString } from './formatters';

export type DateFilterPeriod = 
  | 'today' 
  | 'yesterday' 
  | 'week' 
  | 'month' 
  | 'last_month' 
  | 'year' 
  | 'custom' 
  | 'all';

/**
 * Returns the verified paid amount for an invoice.
 * - If status is 'Paid', entire grandTotal is paid.
 * - If status is 'Pending', paid amount is 0.
 * - If status is 'Partial', uses paidAmount or (grandTotal - balanceAmount).
 */
export function getInvoicePaidAmount(inv: Invoice): number {
  const grand = inv.grandTotal || 0;
  if (inv.paymentStatus === 'Paid') return grand;
  if (inv.paymentStatus === 'Pending') return 0;
  
  if (inv.paidAmount !== undefined && inv.paidAmount !== null) {
    return Number(inv.paidAmount);
  }
  if (inv.balanceAmount !== undefined && inv.balanceAmount !== null) {
    return Math.max(0, grand - Number(inv.balanceAmount));
  }
  return 0;
}

/**
 * Returns the verified balance due for an invoice.
 * - If status is 'Paid', balance is 0.
 * - If balanceAmount is explicitly defined, uses that.
 * - Otherwise: max(0, grandTotal - paidAmount).
 */
export function getInvoiceBalance(inv: Invoice): number {
  const grand = inv.grandTotal || 0;
  if (inv.paymentStatus === 'Paid') return 0;
  if (inv.balanceAmount !== undefined && inv.balanceAmount !== null) {
    return Math.max(0, Number(inv.balanceAmount));
  }
  const paid = getInvoicePaidAmount(inv);
  return Math.max(0, grand - paid);
}

/**
 * Computes core KPI metrics from a collection of invoices.
 */
export function calculateKPIMetrics(invoices: Invoice[]) {
  let totalSales = 0;
  let amountCollected = 0;
  let outstanding = 0;
  let bagsSold = 0;
  let taxableAmount = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let totalGst = 0;

  invoices.forEach(inv => {
    const grand = inv.grandTotal || 0;
    totalSales += grand;
    amountCollected += getInvoicePaidAmount(inv);
    outstanding += getInvoiceBalance(inv);

    taxableAmount += Number(inv.taxableAmount) || 0;
    const cgst = Number(inv.cgstTotal) || 0;
    const sgst = Number(inv.sgstTotal) || 0;
    const igst = Number(inv.igstTotal) || 0;
    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;
    totalGst += Number(inv.totalTax) || (cgst + sgst + igst);

    if (Array.isArray(inv.items)) {
      inv.items.forEach(it => {
        bagsSold += Number(it.quantity) || 0;
      });
    }
  });

  const totalBills = invoices.length;
  const averageBillValue = totalBills > 0 ? Math.round(totalSales / totalBills) : 0;

  return {
    totalSales,
    amountCollected,
    outstanding: Math.max(0, outstanding),
    totalBills,
    bagsSold,
    averageBillValue,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    cgstTotal: Math.round(cgstTotal * 100) / 100,
    sgstTotal: Math.round(sgstTotal * 100) / 100,
    igstTotal: Math.round(igstTotal * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
  };
}

/**
 * Returns date range boundaries for filtering.
 */
export function getDateRangeBounds(
  period: DateFilterPeriod, 
  customStart?: string, 
  customEnd?: string
): { start: string | null; end: string | null; label: string } {
  const today = new Date();
  const todayStr = getTodayDateString();

  if (period === 'today') {
    return { start: todayStr, end: todayStr, label: `Today (${formatDate(todayStr)})` };
  }

  if (period === 'yesterday') {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().split('T')[0];
    return { start: yestStr, end: yestStr, label: `Yesterday (${formatDate(yestStr)})` };
  }

  if (period === 'week') {
    const past7 = new Date(today);
    past7.setDate(past7.getDate() - 6);
    const startStr = past7.toISOString().split('T')[0];
    return { start: startStr, end: todayStr, label: 'This Week (Last 7 Days)' };
  }

  if (period === 'month') {
    const y = today.getFullYear();
    const m = today.getMonth();
    const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
    const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
    return { start: firstDay, end: lastDay, label: 'This Month' };
  }

  if (period === 'last_month') {
    const y = today.getFullYear();
    const m = today.getMonth();
    const firstDay = new Date(y, m - 1, 1).toISOString().split('T')[0];
    const lastDay = new Date(y, m, 0).toISOString().split('T')[0];
    return { start: firstDay, end: lastDay, label: 'Last Month' };
  }

  if (period === 'year') {
    const y = today.getFullYear();
    const firstDay = `${y}-01-01`;
    const lastDay = `${y}-12-31`;
    return { start: firstDay, end: lastDay, label: `This Year (${y})` };
  }

  if (period === 'custom') {
    return {
      start: customStart || '1970-01-01',
      end: customEnd || '2099-12-31',
      label: customStart && customEnd ? `${formatDate(customStart)} – ${formatDate(customEnd)}` : 'Custom Range'
    };
  }

  return { start: null, end: null, label: 'All Time' };
}

/**
 * Filters invoices by date boundaries.
 */
export function filterInvoicesByDate(
  invoices: Invoice[],
  bounds: { start: string | null; end: string | null }
): Invoice[] {
  if (!bounds.start || !bounds.end) return invoices;
  return invoices.filter(inv => inv.date >= bounds.start! && inv.date <= bounds.end!);
}

export interface TrendDataPoint {
  period: string;
  sortKey: string;
  sales: number;
  collected: number;
  outstanding: number;
  billsCount: number;
}

/**
 * Groups invoices into sales trend data points (Daily, Weekly, or Monthly).
 */
export function calculateTrendData(
  invoices: Invoice[], 
  grouping: 'daily' | 'weekly' | 'monthly'
): TrendDataPoint[] {
  const map: { [key: string]: TrendDataPoint } = {};

  invoices.forEach(inv => {
    const grand = inv.grandTotal || 0;
    const paid = getInvoicePaidAmount(inv);
    const balance = getInvoiceBalance(inv);

    let key = inv.date;
    let label = formatDate(inv.date);

    if (grouping === 'monthly') {
      key = inv.date.slice(0, 7); // YYYY-MM
      const [y, m] = key.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      label = `${monthNames[parseInt(m, 10) - 1]} ${y}`;
    } else if (grouping === 'weekly') {
      const d = new Date(inv.date);
      const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
      const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      label = `Wk ${weekNum} (${d.getFullYear()})`;
    } else {
      const d = new Date(inv.date);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      label = `${d.getDate()} ${monthNames[d.getMonth()]}`;
    }

    if (!map[key]) {
      map[key] = {
        period: label,
        sortKey: key,
        sales: 0,
        collected: 0,
        outstanding: 0,
        billsCount: 0,
      };
    }

    map[key].sales += grand;
    map[key].collected += paid;
    map[key].outstanding += balance;
    map[key].billsCount += 1;
  });

  return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export interface PaymentOverview {
  paid: { count: number; amount: number };
  partial: { count: number; amount: number };
  pending: { count: number; amount: number };
  totalCount: number;
  totalAmount: number;
}

/**
 * Calculates payment status breakdown for Paid, Partial, and Pending bills.
 */
export function calculatePaymentOverview(invoices: Invoice[]): PaymentOverview {
  const overview: PaymentOverview = {
    paid: { count: 0, amount: 0 },
    partial: { count: 0, amount: 0 },
    pending: { count: 0, amount: 0 },
    totalCount: invoices.length,
    totalAmount: 0,
  };

  invoices.forEach(inv => {
    const grand = inv.grandTotal || 0;
    overview.totalAmount += grand;

    if (inv.paymentStatus === 'Paid') {
      overview.paid.count += 1;
      overview.paid.amount += grand;
    } else if (inv.paymentStatus === 'Pending') {
      overview.pending.count += 1;
      overview.pending.amount += grand;
    } else {
      overview.partial.count += 1;
      overview.partial.amount += grand;
    }
  });

  return overview;
}

export interface TopProductMetric {
  name: string;
  category?: string;
  quantity: number;
  sales: number;
  billsCount: number;
  avgRate: number;
}

/**
 * Aggregates top products by sales amount from invoice line item snapshots.
 */
export function aggregateProductSales(invoices: Invoice[], limit: number = 5): TopProductMetric[] {
  const map: { [name: string]: { name: string; category?: string; quantity: number; sales: number; bills: Set<string> } } = {};

  invoices.forEach(inv => {
    if (!Array.isArray(inv.items)) return;
    inv.items.forEach(it => {
      const name = it.productName || it.bagType || 'Other Bags';
      if (!map[name]) {
        map[name] = {
          name,
          category: it.category || (it.bagType ? it.bagType.replace(' Bag', '') : 'Bag'),
          quantity: 0,
          sales: 0,
          bills: new Set(),
        };
      }
      map[name].quantity += Number(it.quantity) || 0;
      map[name].sales += Number(it.totalAmount) || 0;
      map[name].bills.add(inv.invoiceNumber);
    });
  });

  return Object.values(map)
    .map(p => ({
      name: p.name,
      category: p.category,
      quantity: p.quantity,
      sales: p.sales,
      billsCount: p.bills.size,
      avgRate: p.quantity > 0 ? p.sales / p.quantity : 0,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, limit);
}

export interface TopPartyMetric {
  partyId?: string;
  partyName: string;
  phone?: string;
  gstin?: string;
  address?: string;
  billsCount: number;
  totalSales: number;
  paidAmount: number;
  outstanding: number;
  lastTransactionDate: string;
}

/**
 * Aggregates customer parties by total sales volume.
 */
export function aggregatePartySales(
  invoices: Invoice[], 
  parties: Party[], 
  limit: number = 5
): TopPartyMetric[] {
  const map: { [name: string]: { bills: number; sales: number; paid: number; balance: number; lastDate: string; partyObj?: Party } } = {};

  // First register existing parties
  parties.forEach(p => {
    const key = p.name.trim().toLowerCase();
    map[key] = {
      bills: 0,
      sales: 0,
      paid: 0,
      balance: 0,
      lastDate: p.lastTransactionDate || '',
      partyObj: p,
    };
  });

  // Accumulate from actual invoices
  invoices.forEach(inv => {
    const key = (inv.partyName || 'Counter Sale').trim().toLowerCase();
    if (!map[key]) {
      map[key] = {
        bills: 0,
        sales: 0,
        paid: 0,
        balance: 0,
        lastDate: '',
      };
    }

    const grand = inv.grandTotal || 0;
    const paid = getInvoicePaidAmount(inv);
    const bal = getInvoiceBalance(inv);

    map[key].bills += 1;
    map[key].sales += grand;
    map[key].paid += paid;
    map[key].balance += bal;

    if (!map[key].lastDate || inv.date > map[key].lastDate) {
      map[key].lastDate = inv.date;
    }
  });

  return Object.entries(map)
    .filter(([_, data]) => data.bills > 0 || data.sales > 0)
    .map(([_, data]) => {
      const p = data.partyObj;
      return {
        partyId: p?.id,
        partyName: p?.name || 'Walk-in Customer',
        phone: p?.phone || '',
        gstin: p?.gstin || '',
        address: p?.address || '',
        billsCount: data.bills,
        totalSales: data.sales,
        paidAmount: data.paid,
        outstanding: data.balance,
        lastTransactionDate: data.lastDate,
      };
    })
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, limit);
}

/**
 * Extracts unpaid or partially paid invoices sorted by highest balance due first.
 */
export function getOutstandingInvoices(invoices: Invoice[], limit: number = 10): Invoice[] {
  return invoices
    .filter(inv => getInvoiceBalance(inv) > 0)
    .sort((a, b) => {
      const balA = getInvoiceBalance(a);
      const balB = getInvoiceBalance(b);
      if (balB !== balA) return balB - balA;
      return b.date.localeCompare(a.date);
    })
    .slice(0, limit);
}
