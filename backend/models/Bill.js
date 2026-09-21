import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema(
  {
    productId: { type: String, default: '' },
    productName: { type: String, default: '' },
    bagType: {
      type: String,
      default: 'Gunny Bag',
    },
    category: { type: String, default: '' },
    description: { type: String, default: '' },
    hsnCode: { type: String, default: '630510' },
    hsnSac: { type: String, default: '630510' },
    quantity: { type: Number, required: true, min: [0, 'Quantity cannot be negative'], default: 1 },
    unit: { type: String, default: 'Bag' },
    pricePerBag: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    discount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    gstRate: { type: Number, default: 5, min: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
  },
  { _id: true, strict: false }
);

lineItemSchema.pre('validate', function (next) {
  if (this.pricePerBag !== undefined && (!this.rate || this.rate === 0)) {
    this.rate = this.pricePerBag;
  }
  if (this.rate !== undefined && (!this.pricePerBag || this.pricePerBag === 0)) {
    this.pricePerBag = this.rate;
  }
  if (this.discountPercent !== undefined && !this.discount) {
    this.discount = this.discountPercent;
  }
  if (this.discount !== undefined && !this.discountPercent) {
    this.discountPercent = this.discount;
  }
  if (this.hsnCode && !this.hsnSac) {
    this.hsnSac = this.hsnCode;
  }
  if (this.hsnSac && !this.hsnCode) {
    this.hsnCode = this.hsnSac;
  }
  next();
});

lineItemSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
lineItemSchema.set('toJSON', { virtuals: true });
lineItemSchema.set('toObject', { virtuals: true });

const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be greater than 0'],
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    method: {
      type: String,
      default: 'Cash',
    },
    reference: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

paymentSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

const billSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Invoice date is required'],
      default: () => new Date().toISOString().split('T')[0],
    },
    dueDate: {
      type: String,
      default: '',
    },
    partyId: {
      type: String,
      default: '',
      index: true,
    },
    partyName: {
      type: String,
      required: [true, 'Party name is required'],
      trim: true,
    },
    partyPhone: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    partyAddress: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    partyGstin: {
      type: String,
      default: '',
      trim: true,
    },
    gstin: {
      type: String,
      default: '',
      trim: true,
    },
    items: {
      type: [lineItemSchema],
      validate: [v => Array.isArray(v) && v.length > 0, 'Bill must contain at least one line item'],
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    totalDiscount: {
      type: Number,
      default: 0,
    },
    taxableAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    taxMode: {
      type: String,
      enum: ['None', 'CGST_SGST', 'IGST'],
      default: 'CGST_SGST',
    },
    cgstTotal: {
      type: Number,
      default: 0,
    },
    sgstTotal: {
      type: Number,
      default: 0,
    },
    igstTotal: {
      type: Number,
      default: 0,
    },
    totalTax: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAmount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Pending', 'Partial'],
      default: 'Pending',
    },
    paymentMode: {
      type: String,
      default: 'Cash',
    },
    paymentRef: {
      type: String,
      default: '',
    },
    transactionReference: {
      type: String,
      default: '',
    },
    payments: {
      type: [paymentSchema],
      default: [],
    },
    isRcm: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
    },
    terms: {
      type: String,
      default: '',
    },
    vehicleNumber: {
      type: String,
      default: '',
      trim: true,
    },
    vehicleOrDispatchNumber: {
      type: String,
      default: '',
      trim: true,
    },
    eWayBillNumber: {
      type: String,
      default: '',
      trim: true,
    },
    // Historical Snapshots (Historical Immutability)
    businessSnapshot: {
      type: Object,
      default: {},
    },
    bankDetails: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

billSchema.pre('validate', function (next) {
  if (this.partyPhone && !this.phone) this.phone = this.partyPhone;
  if (this.phone && !this.partyPhone) this.partyPhone = this.phone;
  if (this.partyAddress && !this.address) this.address = this.partyAddress;
  if (this.address && !this.partyAddress) this.partyAddress = this.address;
  if (this.partyGstin && !this.gstin) this.gstin = this.partyGstin;
  if (this.gstin && !this.partyGstin) this.partyGstin = this.gstin;
  if (this.paymentRef && !this.transactionReference) this.transactionReference = this.paymentRef;
  if (this.transactionReference && !this.paymentRef) this.paymentRef = this.transactionReference;
  if (this.vehicleNumber && !this.vehicleOrDispatchNumber) this.vehicleOrDispatchNumber = this.vehicleNumber;
  if (this.vehicleOrDispatchNumber && !this.vehicleNumber) this.vehicleNumber = this.vehicleOrDispatchNumber;
  next();
});

billSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
billSchema.set('toJSON', { virtuals: true });
billSchema.set('toObject', { virtuals: true });

const Bill = mongoose.model('Bill', billSchema);
export default Bill;
