import mongoose from 'mongoose';
import Bill from '../models/Bill.js';

// Helper to calculate date boundaries
const getDateFilter = (period, customStart, customEnd) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (period === 'today') {
    return {
      query: { date: todayStr },
      start: todayStr,
      end: todayStr,
      label: `Today (${todayStr})`,
    };
  }

  if (period === 'yesterday') {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().split('T')[0];
    return {
      query: { date: yestStr },
      start: yestStr,
      end: yestStr,
      label: `Yesterday (${yestStr})`,
    };
  }

  if (period === 'week') {
    const past7 = new Date(today);
    past7.setDate(past7.getDate() - 6);
    const startStr = past7.toISOString().split('T')[0];
    return {
      query: { date: { $gte: startStr, $lte: todayStr } },
      start: startStr,
      end: todayStr,
      label: 'This Week',
    };
  }

  if (period === 'month') {
    const y = today.getFullYear();
    const m = today.getMonth();
    const firstDay = new Date(Date.UTC(y, m, 1)).toISOString().split('T')[0];
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).toISOString().split('T')[0];
    return {
      query: { date: { $gte: firstDay, $lte: lastDay } },
      start: firstDay,
      end: lastDay,
      label: 'This Month',
    };
  }

  if (period === 'last_month') {
    const y = today.getFullYear();
    const m = today.getMonth();
    const firstDay = new Date(Date.UTC(y, m - 1, 1)).toISOString().split('T')[0];
    const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().split('T')[0];
    return {
      query: { date: { $gte: firstDay, $lte: lastDay } },
      start: firstDay,
      end: lastDay,
      label: 'Last Month',
    };
  }

  if (period === 'year') {
    const y = today.getFullYear();
    const start = `${y}-01-01`;
    const end = `${y}-12-31`;
    return {
      query: { date: { $gte: start, $lte: end } },
      start,
      end,
      label: `This Year (${y})`,
    };
  }

  if (period === 'custom' && customStart && customEnd) {
    return {
      query: { date: { $gte: customStart, $lte: customEnd } },
      start: customStart,
      end: customEnd,
      label: `${customStart} to ${customEnd}`,
    };
  }

  return {
    query: {},
    start: null,
    end: null,
    label: 'All Time',
  };
};

// @desc    Get aggregated business dashboard analytics
// @route   GET /api/dashboard/summary
// @access  Public
export const getDashboardSummary = async (req, res, next) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    const { query: matchQuery, start, end, label } = getDateFilter(period, startDate, endDate);

    // 1. KPI Summary Aggregation
    const [summaryAgg] = await Bill.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalBills: { $sum: 1 },
          totalPaid: { $sum: '$paidAmount' },
          outstanding: { $sum: '$balanceAmount' },
          taxableAmount: { $sum: '$taxableAmount' },
          cgstTotal: { $sum: '$cgstTotal' },
          sgstTotal: { $sum: '$sgstTotal' },
          igstTotal: { $sum: '$igstTotal' },
          totalTax: { $sum: '$totalTax' },
        },
      },
    ]);

    // 2. Bags Sold Aggregation
    const [bagsAgg] = await Bill.aggregate([
      { $match: matchQuery },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          bagsSold: { $sum: '$items.quantity' },
        },
      },
    ]);

    const totalSales = summaryAgg?.totalSales || 0;
    const totalBills = summaryAgg?.totalBills || 0;
    const totalPaid = summaryAgg?.totalPaid || 0;
    const outstanding = summaryAgg?.outstanding || 0;
    const taxableAmount = summaryAgg?.taxableAmount || 0;
    const cgstTotal = summaryAgg?.cgstTotal || 0;
    const sgstTotal = summaryAgg?.sgstTotal || 0;
    const igstTotal = summaryAgg?.igstTotal || 0;
    const totalTax = summaryAgg?.totalTax || (cgstTotal + sgstTotal + igstTotal);
    const bagsSold = bagsAgg?.bagsSold || 0;
    const averageBillValue = totalBills > 0 ? Math.round(totalSales / totalBills) : 0;

    // 3. Payment Status Overview
    const paymentStatusAgg = await Bill.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          amount: { $sum: '$grandTotal' },
          paidAmount: { $sum: '$paidAmount' },
          balanceAmount: { $sum: '$balanceAmount' },
        },
      },
    ]);

    const paymentOverview = {
      paid: { count: 0, amount: 0 },
      partial: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      totalCount: totalBills,
      totalAmount: totalSales,
    };

    paymentStatusAgg.forEach(p => {
      if (p._id === 'Paid') {
        paymentOverview.paid = { count: p.count, amount: p.amount };
      } else if (p._id === 'Partial') {
        paymentOverview.partial = { count: p.count, amount: p.amount };
      } else if (p._id === 'Pending') {
        paymentOverview.pending = { count: p.count, amount: p.amount };
      }
    });

    // 4. Sales & Bill Count Trend (Chronologically Sorted)
    const trendAgg = await Bill.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$date',
          sales: { $sum: '$grandTotal' },
          collected: { $sum: '$paidAmount' },
          outstanding: { $sum: '$balanceAmount' },
          billsCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const trendData = trendAgg.map(t => {
      const d = new Date(t._id);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayLabel = !isNaN(d.getTime()) ? `${d.getDate()} ${monthNames[d.getMonth()]}` : t._id;
      return {
        date: t._id,
        period: dayLabel,
        sales: Math.round(t.sales * 100) / 100,
        collected: Math.round(t.collected * 100) / 100,
        outstanding: Math.round(t.outstanding * 100) / 100,
        billsCount: t.billsCount,
      };
    });

    // 5. Top Selling Products
    const topProductsAgg = await Bill.aggregate([
      { $match: matchQuery },
      { $unwind: '$items' },
      {
        $group: {
          _id: { $ifNull: ['$items.productName', '$items.bagType'] },
          category: { $first: '$items.category' },
          bagType: { $first: '$items.bagType' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.totalAmount' },
          billsSet: { $addToSet: '$invoiceNumber' },
        },
      },
      {
        $project: {
          name: '$_id',
          category: { $ifNull: ['$category', '$bagType'] },
          quantity: 1,
          revenue: 1,
          billsCount: { $size: '$billsSet' },
          avgRate: {
            $cond: [
              { $gt: ['$quantity', 0] },
              { $round: [{ $divide: ['$revenue', '$quantity'] }, 2] },
              0,
            ],
          },
        },
      },
      { $sort: { quantity: -1, revenue: -1 } },
      { $limit: 8 },
    ]);

    // 6. Recent Bills (Latest 8)
    const recentBills = await Bill.find(matchQuery)
      .sort({ date: -1, createdAt: -1 })
      .limit(8)
      .select('invoiceNumber partyName partyPhone date grandTotal paidAmount balanceAmount paymentStatus items');

    res.json({
      success: true,
      data: {
        period,
        dateRange: { start, end, label },
        kpis: {
          totalSales,
          totalBills,
          totalPaid,
          outstanding,
          totalGst: totalTax,
          cgstTotal,
          sgstTotal,
          igstTotal,
          taxableAmount,
          bagsSold,
          averageBillValue,
        },
        paymentOverview,
        trendData,
        topProducts: topProductsAgg,
        gstSummary: {
          totalGst: totalTax,
          cgst: cgstTotal,
          sgst: sgstTotal,
          igst: igstTotal,
          taxableAmount,
        },
        recentBills,
      },
    });
  } catch (error) {
    next(error);
  }
};
