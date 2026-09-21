import Party from '../models/Party.js';
import Bill from '../models/Bill.js';

// @desc    Get all parties with dynamically calculated financial ledger stats
// @route   GET /api/parties
// @access  Public
export const getParties = async (req, res, next) => {
  try {
    const { includeArchived, search } = req.query;
    const filter = {};

    if (includeArchived !== 'true') {
      filter.isArchived = { $ne: true };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } },
      ];
    }

    const parties = await Party.find(filter).sort({ name: 1 });

    // Aggregate bill financial metrics by party name & partyId
    const billStats = await Bill.aggregate([
      {
        $group: {
          _id: { $toLower: '$partyName' },
          totalPurchases: { $sum: '$grandTotal' },
          paidAmount: { $sum: '$paidAmount' },
          pendingAmount: { $sum: '$balanceAmount' },
          totalBills: { $sum: 1 },
          lastTransactionDate: { $max: '$date' },
        },
      },
    ]);

    const statsMap = new Map();
    billStats.forEach(stat => {
      if (stat._id) {
        statsMap.set(stat._id.trim(), stat);
      }
    });

    const enrichedParties = parties.map(party => {
      const pObj = party.toObject();
      const pStats = statsMap.get(party.name.toLowerCase().trim()) || {
        totalPurchases: 0,
        paidAmount: 0,
        pendingAmount: 0,
        totalBills: 0,
        lastTransactionDate: null,
      };

      return {
        ...pObj,
        totalPurchases: pStats.totalPurchases,
        paidAmount: pStats.paidAmount,
        pendingAmount: pStats.pendingAmount,
        balance: pStats.pendingAmount,
        totalBills: pStats.totalBills,
        lastTransactionDate: pStats.lastTransactionDate,
      };
    });

    res.json({
      success: true,
      count: enrichedParties.length,
      data: enrichedParties,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single party with ledger transactions
// @route   GET /api/parties/:id
// @access  Public
export const getPartyById = async (req, res, next) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) {
      res.status(404);
      throw new Error(`Party not found with id ${req.params.id}`);
    }

    // Fetch all related bills for ledger
    const bills = await Bill.find({
      $or: [
        { partyId: party._id.toString() },
        { partyName: { $regex: `^${party.name.trim()}$`, $options: 'i' } },
      ],
    }).sort({ date: -1, createdAt: -1 });

    const totalPurchases = bills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    const paidAmount = bills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
    const pendingAmount = bills.reduce((sum, b) => sum + (b.balanceAmount || 0), 0);

    const partyData = {
      ...party.toObject(),
      totalPurchases,
      paidAmount,
      pendingAmount,
      balance: pendingAmount,
      totalBills: bills.length,
      lastTransactionDate: bills.length > 0 ? bills[0].date : null,
      bills,
    };

    res.json({
      success: true,
      data: partyData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new party
// @route   POST /api/parties
// @access  Public
export const createParty = async (req, res, next) => {
  try {
    const party = await Party.create(req.body);
    res.status(201).json({
      success: true,
      data: party,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update party
// @route   PUT /api/parties/:id
// @access  Public
export const updateParty = async (req, res, next) => {
  try {
    const party = await Party.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!party) {
      res.status(404);
      throw new Error(`Party not found with id ${req.params.id}`);
    }
    res.json({
      success: true,
      data: party,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive or Delete party
// @route   DELETE /api/parties/:id
// @access  Public
export const deleteParty = async (req, res, next) => {
  try {
    const { permanent } = req.query;
    if (permanent === 'true') {
      const party = await Party.findByIdAndDelete(req.params.id);
      if (!party) {
        res.status(404);
        throw new Error(`Party not found with id ${req.params.id}`);
      }
      return res.json({
        success: true,
        message: 'Party permanently deleted',
      });
    }

    const party = await Party.findByIdAndUpdate(
      req.params.id,
      { isArchived: true },
      { new: true }
    );
    if (!party) {
      res.status(404);
      throw new Error(`Party not found with id ${req.params.id}`);
    }
    res.json({
      success: true,
      message: 'Party archived successfully',
      data: party,
    });
  } catch (error) {
    next(error);
  }
};
