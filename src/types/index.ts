export type BagType = 
  | 'Gunny Bag'
  | 'Jute Bag'
  | 'PP Bag'
  | 'Plastic Bag'
  | 'HDPE Bag'
  | 'Custom Bag';

export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';

export type TaxMode = 'CGST_SGST' | 'IGST';

export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';

export interface BillItem {
  id: string;
  productId?: string;
  productName?: string;
  bagType: BagType;
  category?: string;
  description?: string;
  hsnCode: string;
  hsnSac?: string; // alias for hsnCode
  quantity: number;
  unit: string;
  bundleCount?: number;
  perBundleQty?: number;
  pricePerBag: number;
  rate?: number; // alias for pricePerBag
  discountPercent: number; // item level discount %
  discount?: number; // alias for discountPercent
  gstRate: number; // e.g. 5, 12, 18
  amount: number; // quantity * pricePerBag
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface InvoiceBankDetails {
  bankName?: string;
  accountHolderName?: string;
  bankAccountNumber?: string;
  accountNumber?: string;
  bankIfsc?: string;
  ifscCode?: string;
  bankBranch?: string;
  upiId?: string;
  showBankDetails?: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  partyName: string;
  partyPhone: string;
  phone?: string; // alias for partyPhone
  partyAddress: string;
  address?: string; // alias for partyAddress
  partyGstin?: string;
  gstin?: string; // alias for partyGstin
  items: BillItem[];
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  taxMode: TaxMode;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalTax?: number;
  grandTotal: number;
  roundOff: number;
  paymentStatus: PaymentStatus;
  paymentMode?: PaymentMode;
  paidAmount?: number;
  balanceAmount?: number;
  paymentRef?: string;
  transactionReference?: string; // alias for paymentRef
  payments?: PaymentRecord[];
  isRcm?: boolean;
  notes?: string;
  vehicleNumber?: string;
  vehicleOrDispatchNumber?: string; // alias for vehicleNumber
  createdAt: string;
  bankDetails?: InvoiceBankDetails;
  businessSnapshot?: Partial<BusinessSettings>;
}

export interface PaymentRecord {
  id?: string;
  _id?: string;
  amount: number;
  date: string;
  method?: PaymentMode | string;
  reference?: string;
  notes?: string;
  recordedAt?: string;
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  gstin?: string;
  state?: string;
  notes?: string;
  isArchived?: boolean;
  totalPurchases: number;
  paidAmount: number;
  pendingAmount: number;
  lastTransactionDate: string;
}

export interface Product {
  id: string;
  name: string;
  bagType: BagType;
  category?: string; // e.g., 'Gunny', 'Jute', 'PP', 'HDPE', 'Plastic', 'Custom'
  defaultPrice: number;
  rate?: number; // alias for defaultPrice
  hsnCode: string;
  hsnSac?: string; // alias for hsnCode
  gstRate: number;
  description: string;
  unit: string; // e.g., 'Bag', 'Pcs', 'Bales', 'Bundles'
  stock?: number;
  isArchived?: boolean;
}

export interface BusinessSettings {
  businessName: string;
  ownerName?: string;
  tagline: string;
  logoText: string;
  logoUrl?: string; // base64 / data URL for custom uploaded logo
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website?: string;
  gstin: string;
  panNumber: string;
  bankName: string;
  accountHolderName?: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranch: string;
  upiId: string;
  showBankDetailsOnInvoice?: boolean;
  invoicePrefix: string;
  startingInvoiceNumber: number;
  invoiceNumberPadding?: number; // default 5 digits -> INV-00128
  defaultTaxMode: TaxMode;
  defaultGstRate?: number; // e.g. 5
  enableCgstSgst?: boolean;
  enableIgst?: boolean;
  defaultRcm?: boolean;
  defaultPaymentStatus: PaymentStatus;
  activePaymentModes?: PaymentMode[];
  defaultDueDays?: number; // e.g. 15
  termsAndConditions: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryDesignation?: string;
  authorizedSignatoryText: string;
  showSignatureSection?: boolean;
  showBusinessLogo?: boolean;
  showHsnSac?: boolean;
  showGstBreakup?: boolean;
  showTermsAndConditions?: boolean;
  currency?: string;
  dateFormat?: string;
  defaultUnit?: string;
}

export interface TransferToBillPayload {
  bagType?: BagType;
  quantity: number;
  pricePerBag: number;
  gstRate?: number;
  discountPercent?: number;
  unit?: string;
  note?: string;
}
