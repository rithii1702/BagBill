import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    // Business Profile (Flat root properties matching frontend BusinessSettings)
    businessName: { type: String, default: '' },
    ownerName: { type: String, default: '' },
    tagline: { type: String, default: '' },
    logoText: { type: String, default: 'BB' },
    logoUrl: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: 'Tamil Nadu' },
    pincode: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    gstin: { type: String, default: '' },
    panNumber: { type: String, default: '' },

    // Bank Details
    bankName: { type: String, default: '' },
    accountHolderName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    bankIfsc: { type: String, default: '' },
    bankBranch: { type: String, default: '' },
    upiId: { type: String, default: '' },
    showBankDetailsOnInvoice: { type: Boolean, default: true },

    // Invoice Sequencing
    invoicePrefix: { type: String, default: 'INV-' },
    startingInvoiceNumber: { type: Number, default: 1 },
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
      default: '1. Goods once sold will not be taken back or exchanged.\n2. Invoices are subject to terms agreed upon.',
    },
    authorizedSignatoryName: { type: String, default: '' },
    authorizedSignatoryDesignation: { type: String, default: 'Authorized Signatory' },
    authorizedSignatoryText: { type: String, default: 'Authorized Signatory' },
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
