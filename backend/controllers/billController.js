import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import Settings from '../models/Settings.js';
import Product from '../models/Product.js';

// Helper function to format invoice number
const formatInvoiceNumber = (prefix, seq, padding = 5) => {
  return `${prefix || 'INV-'}${String(seq).padStart(padding, '0')}`;
};

// Helper to resolve catalog product from a bill item
const resolveProduct = async (item) => {
  let product = null;
  if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
    product = await Product.findById(item.productId);
  }
  if (!product && (item.productName || item.bagType)) {
    const targetName = (item.productName || item.bagType).trim();
    const escaped = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    product = await Product.findOne({
      name: { $regex: new RegExp(`^${escaped}$`, 'i') },
      isArchived: { $ne: true },
    });
    if (!product) {
      product = await Product.findOne({
        name: { $regex: new RegExp(`^${escaped}$`, 'i') },
      });
    }
  }
  if (!product && item.bagType) {
    product = await Product.findOne({ bagType: item.bagType, isArchived: { $ne: true } });
    if (!product) {
      product = await Product.findOne({ bagType: item.bagType });
    }
  }
  return product;
};

// @desc    Get next invoice number preview (READ-ONLY, NEVER INCREMENTS)
// @route   GET /api/bills/next-number
// @access  Public
export const getNextInvoiceNumber = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    const prefix = settings.invoicePrefix || settings.invoiceSettings?.prefix || 'INV-';
    const nextInvoiceNumber = settings.startingInvoiceNumber || settings.invoiceSettings?.nextInvoiceNumber || 126;
    const numberPadding = settings.invoiceNumberPadding || settings.invoiceSettings?.numberPadding || 5;

    const formatted = formatInvoiceNumber(prefix, nextInvoiceNumber, numberPadding);

    res.json({
      success: true,
      data: {
        invoiceNumber: formatted,
        nextSequence: nextInvoiceNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bills with filtering & search
// @route   GET /api/bills
// @access  Public
export const getBills = async (req, res, next) => {
  try {
    const { startDate, endDate, paymentStatus, partyName, search } = req.query;
    const filter = {};

    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.date = { $gte: startDate };
    } else if (endDate) {
      filter.date = { $lte: endDate };
    }

    if (paymentStatus && paymentStatus !== 'All') {
      filter.paymentStatus = paymentStatus;
    }

    if (partyName && partyName !== 'All') {
      filter.partyName = partyName;
    }

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { partyName: { $regex: search, $options: 'i' } },
        { 'items.productName': { $regex: search, $options: 'i' } },
        { 'items.bagType': { $regex: search, $options: 'i' } },
      ];
    }

    const bills = await Bill.find(filter).sort({ date: -1, createdAt: -1 });

    res.json({
      success: true,
      count: bills.length,
      data: bills,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single bill by ID or invoiceNumber
// @route   GET /api/bills/:id
// @access  Public
export const getBillById = async (req, res, next) => {
  try {
    const id = req.params.id;
    let bill = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bill = await Bill.findById(id);
    }
    if (!bill) {
      bill = await Bill.findOne({ invoiceNumber: id });
    }
    if (!bill) {
      res.status(404);
      throw new Error(`Invoice not found with id ${req.params.id}`);
    }
    res.json({
      success: true,
      data: bill,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new bill (Assigns invoice number once & snapshots profile)
// @route   POST /api/bills
// @access  Public
export const createBill = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    const billData = { ...req.body };

    // Upfront payload validation
    if (!billData.partyName || !String(billData.partyName).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer / Party name is required',
      });
    }

    if (!billData.items || !Array.isArray(billData.items) || billData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one bag/product item is required to create an invoice',
      });
    }

    const prefix = settings.invoicePrefix || settings.invoiceSettings?.prefix || 'INV-';
    const currentSeq = settings.startingInvoiceNumber || settings.invoiceSettings?.nextInvoiceNumber || 126;
    const padding = settings.invoiceNumberPadding || settings.invoiceSettings?.numberPadding || 5;

    // 1. Check for rapid duplicate submission (within 5 seconds with identical items)
    const checkParty = String(billData.partyName || '').trim();
    const checkDate = billData.date || new Date().toISOString().split('T')[0];
    if (checkParty) {
      const recentThreshold = new Date(Date.now() - 5000);
      const dupQuery = {
        partyName: { $regex: new RegExp(`^${checkParty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        date: checkDate,
        createdAt: { $gte: recentThreshold },
      };
      if (billData.grandTotal !== undefined && billData.grandTotal !== null) {
        dupQuery.grandTotal = Number(billData.grandTotal);
      }
      const duplicateBill = await Bill.findOne(dupQuery);

      if (duplicateBill) {
        const existingItems = duplicateBill.items || [];
        const incomingItems = billData.items || [];
        if (existingItems.length === incomingItems.length) {
          console.warn(`[BagBill API] Rapid duplicate bill submission avoided. Returning existing invoice ${duplicateBill.invoiceNumber}`);
          return res.status(200).json({
            success: true,
            data: duplicateBill,
          });
        }
      }
    }

    // 2. Invoice number assignment & deduplication check
    if (billData.invoiceNumber) {
      // If a bill with this invoice number already exists, update it in place
      const existing = await Bill.findOne({ invoiceNumber: billData.invoiceNumber.trim() });
      if (existing) {
        console.warn(`[BagBill API] Invoice ${billData.invoiceNumber} already exists. Updating existing record.`);
        const updated = await Bill.findByIdAndUpdate(existing._id, billData, { new: true, runValidators: true });
        return res.status(200).json({
          success: true,
          data: updated,
        });
      }

      // Advance sequence in settings if higher than current
      const numMatch = billData.invoiceNumber.match(/(\d+)$/);
      if (numMatch) {
        const parsedSeq = parseInt(numMatch[1], 10);
        if (!isNaN(parsedSeq) && parsedSeq >= currentSeq) {
          await Settings.findByIdAndUpdate(settings._id, {
            $set: {
              startingInvoiceNumber: parsedSeq + 1,
              'invoiceSettings.nextInvoiceNumber': parsedSeq + 1,
            },
          });
        }
      }
    } else {
      // Auto-assign sequential invoice number
      billData.invoiceNumber = formatInvoiceNumber(prefix, currentSeq, padding);

      // Increment sequence atomically
      await Settings.findByIdAndUpdate(settings._id, {
        $inc: {
          startingInvoiceNumber: 1,
          'invoiceSettings.nextInvoiceNumber': 1,
        },
      });
    }

    // 3. Snapshot current business profile & banking details for historical immutability
    if (!billData.businessSnapshot || Object.keys(billData.businessSnapshot).length === 0) {
      billData.businessSnapshot = {
        businessName: settings.businessName || settings.businessProfile?.businessName || '',
        ownerName: settings.ownerName || settings.businessProfile?.proprietorName || '',
        tagline: settings.tagline || settings.businessProfile?.tagline || '',
        logoText: settings.logoText || 'SLJ',
        logoUrl: settings.logoUrl || settings.businessProfile?.logoUrl || '',
        address: settings.address || settings.businessProfile?.address || '',
        city: settings.city || settings.businessProfile?.city || '',
        state: settings.state || settings.businessProfile?.state || '',
        pincode: settings.pincode || settings.businessProfile?.pinCode || '',
        phone: settings.phone || settings.businessProfile?.phone || '',
        email: settings.email || settings.businessProfile?.email || '',
        website: settings.website || settings.businessProfile?.website || '',
        gstin: settings.gstin || settings.businessProfile?.gstin || '',
        panNumber: settings.panNumber || settings.businessProfile?.pan || '',
        bankName: settings.bankName || '',
        accountHolderName: settings.accountHolderName || '',
        bankAccountNumber: settings.bankAccountNumber || '',
        bankIfsc: settings.bankIfsc || '',
        bankBranch: settings.bankBranch || '',
        upiId: settings.upiId || '',
        showBankDetailsOnInvoice: settings.showBankDetailsOnInvoice ?? true,
        termsAndConditions: settings.termsAndConditions || '',
      };
    }

    if (!billData.bankDetails || Object.keys(billData.bankDetails).length === 0) {
      billData.bankDetails = {
        bankName: settings.bankName || '',
        accountHolderName: settings.accountHolderName || settings.businessName || '',
        bankAccountNumber: settings.bankAccountNumber || '',
        accountNumber: settings.bankAccountNumber || '',
        bankIfsc: settings.bankIfsc || '',
        ifscCode: settings.bankIfsc || '',
        bankBranch: settings.bankBranch || '',
        upiId: settings.upiId || '',
        showBankDetails: settings.showBankDetailsOnInvoice ?? true,
      };
    }

    // 4. Compute line items & invoice summary
    const taxMode = billData.taxMode || settings.defaultTaxMode || 'CGST_SGST';
    billData.taxMode = taxMode;

    let subtotal = 0;
    let totalDiscount = 0;
    let taxableAmount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const items = (billData.items || []).map(item => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.pricePerBag ?? item.rate ?? 0);
      const rawItemTotal = Math.round(quantity * rate * 100) / 100;

      const discountPercent = Number(item.discountPercent ?? item.discount ?? 0);
      const discountAmount = Math.round(rawItemTotal * (discountPercent / 100) * 100) / 100;
      const itemTaxable = Math.round((rawItemTotal - discountAmount) * 100) / 100;

      const gstRate = Number(item.gstRate) || 0;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (taxMode === 'CGST_SGST') {
        const halfRate = gstRate / 2;
        cgst = Math.round(itemTaxable * (halfRate / 100) * 100) / 100;
        sgst = Math.round(itemTaxable * (halfRate / 100) * 100) / 100;
      } else if (taxMode === 'IGST') {
        igst = Math.round(itemTaxable * (gstRate / 100) * 100) / 100;
      }

      const totalAmount = Math.round((itemTaxable + cgst + sgst + igst) * 100) / 100;

      subtotal += rawItemTotal;
      totalDiscount += discountAmount;
      taxableAmount += itemTaxable;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;

      return {
        ...item,
        quantity,
        rate,
        pricePerBag: rate,
        discountPercent,
        discount: discountPercent,
        discountAmount,
        taxableAmount: itemTaxable,
        gstRate,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        amount: rawItemTotal,
        totalAmount,
      };
    });

    billData.items = items;
    billData.subtotal = Math.round(subtotal * 100) / 100;
    billData.totalDiscount = Math.round(totalDiscount * 100) / 100;
    billData.taxableAmount = Math.round(taxableAmount * 100) / 100;
    billData.cgstTotal = Math.round(cgstTotal * 100) / 100;
    billData.sgstTotal = Math.round(sgstTotal * 100) / 100;
    billData.igstTotal = Math.round(igstTotal * 100) / 100;
    billData.totalTax = Math.round((cgstTotal + sgstTotal + igstTotal) * 100) / 100;

    const unroundedGrandTotal = billData.taxableAmount + billData.totalTax;
    let roundOff = 0;
    let grandTotal = unroundedGrandTotal;

    if (billData.roundOff !== undefined && billData.grandTotal !== undefined) {
      roundOff = Number(billData.roundOff) || 0;
      grandTotal = Number(billData.grandTotal);
    } else {
      grandTotal = Math.round(unroundedGrandTotal);
      roundOff = Math.round((grandTotal - unroundedGrandTotal) * 100) / 100;
    }

    billData.roundOff = roundOff;
    billData.grandTotal = grandTotal;

    const paidAmount = Number(billData.paidAmount) || 0;
    billData.paidAmount = paidAmount;
    billData.balanceAmount = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);

    if (paidAmount >= grandTotal && grandTotal > 0) {
      billData.paymentStatus = 'Paid';
    } else if (paidAmount > 0) {
      billData.paymentStatus = 'Partial';
    } else {
      billData.paymentStatus = 'Pending';
    }

    // Initialize payment history entry if advance paid amount was provided
    if (paidAmount > 0 && (!billData.payments || billData.payments.length === 0)) {
      billData.payments = [
        {
          amount: paidAmount,
          date: billData.date || new Date().toISOString().split('T')[0],
          method: billData.paymentMode || 'Cash',
          reference: billData.paymentRef || billData.transactionReference || '',
          notes: 'Advance / Initial payment upon bill creation',
          recordedAt: new Date(),
        },
      ];
    }

    // Verify product stock availability before creating bill
    const productRequirements = new Map();
    for (const item of billData.items || []) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;
      const product = await resolveProduct(item);
      if (product) {
        const pId = product._id.toString();
        const currentReq = productRequirements.get(pId) || { product, requestedQty: 0 };
        currentReq.requestedQty += qty;
        productRequirements.set(pId, currentReq);
      }
    }

    for (const { product, requestedQty } of productRequirements.values()) {
      const currentStock = Number(product.stock) || 0;
      if (currentStock < requestedQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${currentStock}.`,
        });
      }
    }

    const bill = await Bill.create(billData);

    // Deduct stock only after bill has been successfully persisted
    for (const { product, requestedQty } of productRequirements.values()) {
      await Product.findByIdAndUpdate(product._id, {
        $inc: { stock: -requestedQty },
      });
    }

    res.status(201).json({
      success: true,
      data: bill,
    });
  } catch (error) {
    if (error.code === 11000 && billData && billData.invoiceNumber) {
      console.warn(`[BagBill API] Handled concurrent insertion for ${billData.invoiceNumber}. Fetching existing record.`);
      const existing = await Bill.findOne({ invoiceNumber: billData.invoiceNumber.trim() });
      if (existing) {
        return res.status(200).json({
          success: true,
          data: existing,
        });
      }
    }
    next(error);
  }
};

// @desc    Update bill (Preserves original invoiceNumber & sequence)
// @route   PUT /api/bills/:id
// @access  Public
export const updateBill = async (req, res, next) => {
  try {
    const id = req.params.id;
    let existingBill = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      existingBill = await Bill.findById(id);
    }
    if (!existingBill) {
      existingBill = await Bill.findOne({ invoiceNumber: id });
    }
    if (!existingBill) {
      res.status(404);
      throw new Error(`Invoice not found with id ${req.params.id}`);
    }

    const updateData = { ...req.body };

    // Prevent unintentional change of invoice number
    if (!updateData.invoiceNumber) {
      updateData.invoiceNumber = existingBill.invoiceNumber;
    }

    // Preserve historical snapshot if not explicitly updating it
    if (!updateData.businessSnapshot) {
      updateData.businessSnapshot = existingBill.businessSnapshot;
    }
    if (!updateData.bankDetails) {
      updateData.bankDetails = existingBill.bankDetails;
    }

    // Recalculate if items were updated and verify inventory stock deltas
    const stockDeltas = []; // { product, delta }
    if (updateData.items && Array.isArray(updateData.items)) {
      // 1. Calculate old quantities per product
      const oldQtyMap = new Map();
      for (const oldItem of existingBill.items || []) {
        const qty = Number(oldItem.quantity) || 0;
        if (qty <= 0) continue;
        const prod = await resolveProduct(oldItem);
        if (prod) {
          const pId = prod._id.toString();
          const cur = oldQtyMap.get(pId) || { product: prod, qty: 0 };
          cur.qty += qty;
          oldQtyMap.set(pId, cur);
        }
      }

      // 2. Calculate new quantities per product
      const newQtyMap = new Map();
      for (const newItem of updateData.items || []) {
        const qty = Number(newItem.quantity) || 0;
        if (qty <= 0) continue;
        const prod = await resolveProduct(newItem);
        if (prod) {
          const pId = prod._id.toString();
          const cur = newQtyMap.get(pId) || { product: prod, qty: 0 };
          cur.qty += qty;
          newQtyMap.set(pId, cur);
        }
      }

      // 3. Compute deltas (newQty - oldQty)
      const allProductIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);
      for (const pId of allProductIds) {
        const oldEntry = oldQtyMap.get(pId);
        const newEntry = newQtyMap.get(pId);
        const product = (newEntry || oldEntry).product;
        const oldQty = oldEntry ? oldEntry.qty : 0;
        const newQty = newEntry ? newEntry.qty : 0;
        const delta = newQty - oldQty;

        if (delta > 0) {
          const freshProd = await Product.findById(product._id);
          const availStock = freshProd ? Number(freshProd.stock) || 0 : 0;
          if (availStock < delta) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${product.name}. Available: ${availStock}.`,
            });
          }
        }
        stockDeltas.push({ product, delta });
      }
      const taxMode = updateData.taxMode || existingBill.taxMode || 'CGST_SGST';
      updateData.taxMode = taxMode;

      let subtotal = 0;
      let totalDiscount = 0;
      let taxableAmount = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;

      const items = updateData.items.map(item => {
        const quantity = Number(item.quantity) || 0;
        const rate = Number(item.pricePerBag ?? item.rate ?? 0);
        const rawItemTotal = Math.round(quantity * rate * 100) / 100;

        const discountPercent = Number(item.discountPercent ?? item.discount ?? 0);
        const discountAmount = Math.round(rawItemTotal * (discountPercent / 100) * 100) / 100;
        const itemTaxable = Math.round((rawItemTotal - discountAmount) * 100) / 100;

        const gstRate = Number(item.gstRate) || 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (taxMode === 'CGST_SGST') {
          const halfRate = gstRate / 2;
          cgst = Math.round(itemTaxable * (halfRate / 100) * 100) / 100;
          sgst = Math.round(itemTaxable * (halfRate / 100) * 100) / 100;
        } else if (taxMode === 'IGST') {
          igst = Math.round(itemTaxable * (gstRate / 100) * 100) / 100;
        }

        const totalAmount = Math.round((itemTaxable + cgst + sgst + igst) * 100) / 100;

        subtotal += rawItemTotal;
        totalDiscount += discountAmount;
        taxableAmount += itemTaxable;
        cgstTotal += cgst;
        sgstTotal += sgst;
        igstTotal += igst;

        return {
          ...item,
          quantity,
          rate,
          pricePerBag: rate,
          discountPercent,
          discount: discountPercent,
          discountAmount,
          taxableAmount: itemTaxable,
          gstRate,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          amount: rawItemTotal,
          totalAmount,
        };
      });

      updateData.items = items;
      updateData.subtotal = Math.round(subtotal * 100) / 100;
      updateData.totalDiscount = Math.round(totalDiscount * 100) / 100;
      updateData.taxableAmount = Math.round(taxableAmount * 100) / 100;
      updateData.cgstTotal = Math.round(cgstTotal * 100) / 100;
      updateData.sgstTotal = Math.round(sgstTotal * 100) / 100;
      updateData.igstTotal = Math.round(igstTotal * 100) / 100;
      updateData.totalTax = Math.round((cgstTotal + sgstTotal + igstTotal) * 100) / 100;

      const unroundedGrandTotal = updateData.taxableAmount + updateData.totalTax;
      let roundOff = 0;
      let grandTotal = unroundedGrandTotal;

      if (updateData.roundOff !== undefined && updateData.grandTotal !== undefined) {
        roundOff = Number(updateData.roundOff) || 0;
        grandTotal = Number(updateData.grandTotal);
      } else {
        grandTotal = Math.round(unroundedGrandTotal);
        roundOff = Math.round((grandTotal - unroundedGrandTotal) * 100) / 100;
      }

      updateData.roundOff = roundOff;
      updateData.grandTotal = grandTotal;
    }

    const paidAmount = updateData.paidAmount !== undefined ? Number(updateData.paidAmount) : existingBill.paidAmount;
    const grandTotal = updateData.grandTotal !== undefined ? Number(updateData.grandTotal) : existingBill.grandTotal;

    updateData.paidAmount = paidAmount;
    updateData.balanceAmount = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);

    if (paidAmount >= grandTotal && grandTotal > 0) {
      updateData.paymentStatus = 'Paid';
    } else if (paidAmount > 0) {
      updateData.paymentStatus = 'Partial';
    } else {
      updateData.paymentStatus = 'Pending';
    }

    const updatedBill = await Bill.findByIdAndUpdate(existingBill._id, updateData, {
      new: true,
      runValidators: true,
    });

    // Apply inventory stock deltas
    for (const { product, delta } of stockDeltas) {
      if (delta !== 0) {
        await Product.findByIdAndUpdate(product._id, {
          $inc: { stock: -delta },
        });
      }
    }

    res.json({
      success: true,
      data: updatedBill,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a bill
// @route   DELETE /api/bills/:id
// @access  Public
export const deleteBill = async (req, res, next) => {
  try {
    const id = req.params.id;
    let bill = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bill = await Bill.findById(id);
    }
    if (!bill) {
      bill = await Bill.findOne({ invoiceNumber: id });
    }
    if (!bill) {
      res.status(404);
      throw new Error(`Invoice not found with id ${req.params.id}`);
    }

    // Restore stock for all items in the deleted bill
    for (const item of bill.items || []) {
      const qty = Number(item.quantity) || 0;
      if (qty > 0) {
        const product = await resolveProduct(item);
        if (product) {
          await Product.findByIdAndUpdate(product._id, {
            $inc: { stock: qty },
          });
        }
      }
    }

    await Bill.findByIdAndDelete(bill._id);

    res.json({
      success: true,
      message: `Invoice ${bill.invoiceNumber} deleted successfully and inventory stock restored`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record a payment against an existing bill
// @route   POST /api/bills/:id/payments
// @access  Public
export const recordPayment = async (req, res, next) => {
  try {
    const id = req.params.id;
    let bill = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bill = await Bill.findById(id);
    }
    if (!bill) {
      bill = await Bill.findOne({ invoiceNumber: id });
    }
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: `Invoice not found with id ${req.params.id}`,
      });
    }

    const rawAmount = req.body.amount;
    const amount = Number(rawAmount);
    if (rawAmount === undefined || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0',
      });
    }

    const grandTotal = Number(bill.grandTotal) || 0;
    const currentPaid = Number(bill.paidAmount) || 0;
    const currentBalance = bill.balanceAmount !== undefined
      ? Number(bill.balanceAmount)
      : Math.max(0, Math.round((grandTotal - currentPaid) * 100) / 100);

    // Overpayment protection (reject if already fully paid)
    if (currentBalance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already fully paid. No further payment can be recorded.',
      });
    }

    // Overpayment protection (reject if payment exceeds remaining balance)
    if (amount > currentBalance + 0.001) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${amount}) cannot exceed remaining balance (₹${currentBalance})`,
      });
    }

    const newPaid = Math.round((currentPaid + amount) * 100) / 100;
    const newBalance = Math.max(0, Math.round((grandTotal - newPaid) * 100) / 100);

    let newStatus = 'Partial';
    if (newBalance <= 0 || newPaid >= grandTotal) {
      newStatus = 'Paid';
    } else if (newPaid > 0) {
      newStatus = 'Partial';
    } else {
      newStatus = 'Pending';
    }

    const paymentDate = req.body.date || new Date().toISOString().split('T')[0];
    const paymentMethod = req.body.method || req.body.paymentMode || 'Cash';
    const paymentRef = req.body.reference || req.body.paymentRef || '';
    const notes = req.body.notes || '';

    const paymentEntry = {
      amount,
      date: paymentDate,
      method: paymentMethod,
      reference: paymentRef,
      notes,
      recordedAt: new Date(),
    };

    if (!Array.isArray(bill.payments)) {
      bill.payments = [];
    }

    // If bill already had paidAmount > 0 but payments array was empty (e.g. earlier test bill), backfill initial record
    if (currentPaid > 0 && bill.payments.length === 0) {
      bill.payments.push({
        amount: currentPaid,
        date: bill.date,
        method: bill.paymentMode || 'Cash',
        reference: bill.paymentRef || '',
        notes: 'Initial advance payment',
        recordedAt: bill.createdAt || new Date(),
      });
    }

    bill.payments.push(paymentEntry);
    bill.paidAmount = newPaid;
    bill.balanceAmount = newBalance;
    bill.paymentStatus = newStatus;
    bill.paymentMode = paymentMethod;
    if (paymentRef) {
      bill.paymentRef = paymentRef;
      bill.transactionReference = paymentRef;
    }

    // Persist to MongoDB. NOTE: Product stock is NOT affected (Inventory Safety).
    await bill.save();

    res.status(200).json({
      success: true,
      data: bill,
      message: `Payment of ₹${amount} recorded successfully. Remaining balance: ₹${newBalance}.`,
    });
  } catch (error) {
    next(error);
  }
};

