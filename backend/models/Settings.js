import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    // Business Profile (Flat root properties matching frontend BusinessSettings)
    businessName: { type: String, required: true, default: 'Sri Lakshmi Jute & Gunny Mart' },
    ownerName: { type: String, default: 'S. Shanmugam' },
    tagline: { type: String, default: 'Wholesale & Retail Suppliers of All Kinds of Commercial Bags' },
    logoText: { type: String, default: 'SLJ' },
    logoUrl: { type: String, default: '' },
    address: { type: String, default: 'Shop No. 14, Commercial Market Yard, Opp. Old Cotton Market' },
    city: { type: String, default: 'Salem' },
    state: { type: String, default: 'Tamil Nadu' },
    pincode: { type: String, default: '636001' },
    phone: { type: String, default: '+91 98427 51234' },
    email: { type: String, default: 'sales@srilakshmijute.com' },
    website: { type: String, default: 'www.srilakshmijute.com' },
    gstin: { type: String, default: '33AABCS1429B1Z8' },
    panNumber: { type: String, default: 'AABCS1429B' },

    // Bank Details
    bankName: { type: String, default: 'State Bank of India' },
    accountHolderName: { type: String, default: 'Sri Lakshmi Jute & Gunny Mart' },
    bankAccountNumber: { type: String, default: '381920485910' },
    bankIfsc: { type: String, default: 'SBIN0001254' },
    bankBranch: { type: String, default: 'Salem Main Branch' },
    upiId: { type: String, default: 'lakshmijute@sbi' },
    showBankDetailsOnInvoice: { type: Boolean, default: true },

    // Invoice Sequencing
    invoicePrefix: { type: String, default: 'INV-' },
    startingInvoiceNumber: { type: Number, default: 126 },
    invoiceNumberPadding: { type: Number, default: 5 },

    // Tax Settings
    defaultTaxMode: { type: String, default: 'CGST_SGST' },
    defaultGstRate: { type: Number, default: 5 },
    enableCgstSgst: { type: Boolean, default: true },
    enableIgst: { type: Boolean, default: true },
    defaultRcm: { type: Boolean, default: false },

    // Payment & Due Date Settings
    defaultPaymentStatus: { type: String, default: 'Pending' },
    activePaymentModes: { type: [String], default: ['Cash', 'UPI', 'Bank Transfer', 'Cheque'] },
    defaultDueDays: { type: Number, default: 15 },

    // Terms & Conditions & Signatory
    termsAndConditions: {
      type: mongoose.Schema.Types.Mixed,
      default: '1. Goods once sold will not be taken back or exchanged.\n2. Interest @ 18% per annum will be charged if payment is not received within 15 days.\n3. Subject to Salem jurisdiction only.',
    },
    authorizedSignatoryName: { type: String, default: 'S. Shanmugam' },
    authorizedSignatoryDesignation: { type: String, default: 'Proprietor' },
    authorizedSignatoryText: { type: String, default: 'Proprietor / Authorized Signatory' },
    showSignatureSection: { type: Boolean, default: true },
    showBusinessLogo: { type: Boolean, default: true },
    showHsnSac: { type: Boolean, default: true },
    showGstBreakup: { type: Boolean, default: true },
    showTermsAndConditions: { type: Boolean, default: true },

    // App Preferences
    currency: { type: String, default: 'INR (₹)' },
    dateFormat: { type: String, default: 'DD MMM YYYY' },
    defaultUnit: { type: String, default: 'Bag' },

    // Backward compatibility subdocuments for Phase 1 backend controllers
    businessProfile: { type: Object, default: {} },
    invoiceSettings: { type: Object, default: {} },
    bankDetails: { type: Object, default: {} },
    taxSettings: { type: Object, default: {} },
  },
  {
    timestamps: true,
    strict: false,
  }
);

// Virtual to provide frontend-compatible 'id'
settingsSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Pre-save middleware to keep flat and nested representations synchronized
settingsSchema.pre('save', function (next) {
  // Sync flat to nested for compatibility with any legacy controllers
  this.businessProfile = {
    businessName: this.businessName,
    proprietorName: this.ownerName,
    tagline: this.tagline,
    address: this.address,
    city: this.city,
    state: this.state,
    pinCode: this.pincode,
    phone: this.phone,
    email: this.email,
    gstin: this.gstin,
    pan: this.panNumber,
    website: this.website,
    logoUrl: this.logoUrl,
  };

  this.invoiceSettings = {
    prefix: this.invoicePrefix,
    nextInvoiceNumber: this.startingInvoiceNumber,
    numberPadding: this.invoiceNumberPadding,
    defaultDueDays: this.defaultDueDays,
  };

  this.bankDetails = {
    bankName: this.bankName,
    accountHolder: this.accountHolderName,
    accountNumber: this.bankAccountNumber,
    ifscCode: this.bankIfsc,
    branchName: this.bankBranch,
    upiId: this.upiId,
  };

  this.taxSettings = {
    defaultTaxMode: this.defaultTaxMode,
    defaultGstRate: this.defaultGstRate,
  };

  next();
});

settingsSchema.set('toJSON', { virtuals: true });
settingsSchema.set('toObject', { virtuals: true });

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
