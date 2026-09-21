import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Receipt, 
  CreditCard, 
  Percent, 
  FileText, 
  Sliders, 
  Save, 
  RotateCcw, 
  Upload, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Check
} from 'lucide-react';
import { useBagBill } from '../context/BagBillContext';
import { BusinessSettings, PaymentStatus, PaymentMode } from '../types';
import { Modal } from '../components/common/Modal';

type SettingsTab = 'profile' | 'invoice' | 'bank' | 'tax' | 'terms' | 'appearance';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetSettingsToDefaults, showToast } = useBagBill();

  // Active Tab State
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Form State initialized from persistent Context
  const [formData, setFormData] = useState<BusinessSettings>({ ...settings });
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [showAccountNumber, setShowAccountNumber] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Keep form data synchronized when settings in context are updated or reset
  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Field validation function matching business rules
  const validateBusinessProfile = (data: BusinessSettings): { [key: string]: string } => {
    const errs: { [key: string]: string } = {};

    // 1. Business Name: Required
    if (!data.businessName || !data.businessName.trim()) {
      errs.businessName = 'Business / Firm Name is required';
    }

    // 2. Phone Number: Valid Indian phone number format (if entered)
    if (data.phone && data.phone.trim()) {
      const cleanPhone = data.phone.trim().replace(/[\s\-()]/g, '');
      const isValidPhone = /^(\+91|91|0)?[6-9]\d{9}$/.test(cleanPhone);
      if (!isValidPhone) {
        errs.phone = 'Enter a valid Indian phone number (10 digits, e.g. 98427 51234 or +91 98427 51234)';
      }
    }

    // 3. Email Address: Valid email format (if entered)
    if (data.email && data.email.trim()) {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim());
      if (!isValidEmail) {
        errs.email = 'Enter a valid email address (e.g. name@example.com)';
      }
    }

    // 4. PIN Code: Exactly 6 digits (if entered)
    if (data.pincode && data.pincode.trim()) {
      const cleanPin = data.pincode.trim();
      if (!/^\d{6}$/.test(cleanPin)) {
        errs.pincode = 'PIN Code must be exactly 6 digits (e.g. 636001)';
      }
    }

    // 5. GSTIN: Validate basic GSTIN format (if entered)
    if (data.gstin && data.gstin.trim()) {
      const gstinVal = data.gstin.trim().toUpperCase();
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinVal)) {
        errs.gstin = 'Invalid GSTIN format (15 characters, e.g. 33AABCS1429B1Z8)';
      }
    }

    // 6. PAN: Validate basic PAN format (if entered)
    if (data.panNumber && data.panNumber.trim()) {
      const panVal = data.panNumber.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panVal)) {
        errs.panNumber = 'Invalid PAN format (10 characters, e.g. AABCS1429B)';
      }
    }

    return errs;
  };

  const handleChange = <K extends keyof BusinessSettings>(field: K, value: BusinessSettings[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsSaved(false);

    // Clear error for edited field
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleTogglePaymentMode = (mode: PaymentMode) => {
    const current = formData.activePaymentModes || ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
    let updated: PaymentMode[];
    if (current.includes(mode)) {
      if (current.length === 1) {
        showToast('At least one payment method must remain active', 'warning');
        return;
      }
      updated = current.filter(m => m !== mode);
    } else {
      updated = [...current, mode];
    }
    handleChange('activePaymentModes', updated);
  };

  // Image logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Please upload a valid image file (PNG, JPG, or WebP)', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size exceeds 2MB limit. Please upload a smaller image.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Url = uploadEvent.target?.result as string;
      handleChange('logoUrl', base64Url);
      showToast('Logo uploaded. Click "Save Changes" to apply persistently.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    handleChange('logoUrl', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast('Custom logo removed. Monogram text will be used.', 'info');
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const errs = validateBusinessProfile(formData);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      setActiveTab('profile');
      showToast(Object.values(errs)[0], 'error');
      return;
    }

    setFormErrors({});
    updateSettings(formData);
    setIsSaved(true);
    showToast('Settings saved successfully.', 'success');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleConfirmReset = () => {
    resetSettingsToDefaults();
    setIsResetModalOpen(false);
    showToast('Settings have been reset to system defaults. Historical bills remain untouched.', 'info');
  };

  // Compute live invoice number preview
  const invoicePreviewSample = `${formData.invoicePrefix || 'INV-'}${String(formData.startingInvoiceNumber || 128).padStart(formData.invoiceNumberPadding || 5, '0')}`;

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-150">
      {/* 1. TOP HEADER & SAVE BAR */}
      <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#C99563]/20 text-[#3B2921] border border-[#C99563]/40">
              System Settings & Configuration
            </span>
            <span className="text-xs text-[#8B5E3C] font-semibold flex items-center gap-1">
              <Sparkles size={12} className="text-[#C99563]" />
              Persistent Storage
            </span>
          </div>
          <h2 className="text-2xl font-black text-[#3B2921] tracking-tight mt-1">
            Business Settings & Invoice Preferences
          </h2>
          <p className="text-xs text-[#8B5E3C] font-medium max-w-xl mt-0.5">
            Manage your firm identity, invoice numbering, bank details, tax defaults, and appearance.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#8B5E3C] hover:text-[#3B2921] border border-[#E4D7C8] font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
            title="Reset settings to defaults without modifying bills"
          >
            <RotateCcw size={15} />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs md:text-sm shadow-sm transition-all active:scale-95 border border-[#3B2921]"
          >
            {isSaved ? <Check size={16} className="text-[#4F7D5A]" /> : <Save size={16} className="text-[#C99563]" />}
            <span>{isSaved ? 'Saved!' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* 2. TABBED NAVIGATION */}
      <div className="bg-[#FFFDF8] p-1.5 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-wrap gap-1">
        {[
          { id: 'profile', label: 'Business Profile', icon: Building2 },
          { id: 'invoice', label: 'Invoice Settings', icon: Receipt },
          { id: 'bank', label: 'Bank & Payment Details', icon: CreditCard },
          { id: 'tax', label: 'Tax Settings', icon: Percent },
          { id: 'terms', label: 'Terms & Signature', icon: FileText },
          { id: 'appearance', label: 'Appearance & App', icon: Sliders },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                isActive
                  ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                  : 'text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#F7F3EA]'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-[#C99563]' : 'text-[#8B5E3C]'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. TAB CONTENT FORMS */}
      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* ======================================================== */}
        {/* TAB A: BUSINESS PROFILE                                  */}
        {/* ======================================================== */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4D7C8]">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-[#8B5E3C]" />
                  <div>
                    <h3 className="font-bold text-base text-[#3B2921]">Wholesale Business Profile</h3>
                    <p className="text-[11px] text-[#8B5E3C]">This information appears on invoice headers, bills, and PDFs</p>
                  </div>
                </div>
              </div>

              {/* Logo Uploader & Monogram */}
              <div className="p-4 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {formData.logoUrl ? (
                    <div className="w-16 h-16 rounded-xl border-2 border-[#8B5E3C] bg-white p-1 overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
                      <img src={formData.logoUrl} alt="Business Logo" className="max-w-full max-h-full object-contain aspect-square" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[#3B2921] text-[#C99563] flex items-center justify-center font-black text-2xl shrink-0 border-2 border-[#8B5E3C] shadow-xs">
                      {formData.logoText || 'SLJ'}
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-[#3B2921] text-sm">Business Logo & Brand Monogram</h4>
                    <p className="text-[11px] text-[#8B5E3C] mt-0.5">
                      {formData.logoUrl ? 'Custom logo image active (PNG, JPG, WebP)' : 'Default text monogram active'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-[#3B2921] text-[#FFFDF8] font-bold text-xs hover:bg-[#4E372C] flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <Upload size={13} className="text-[#C99563]" />
                        <span>{formData.logoUrl ? 'Replace Logo' : 'Upload Logo Image'}</span>
                      </button>

                      {formData.logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-3 py-1.5 rounded-lg bg-[#FFFDF8] text-[#B94A48] border border-[#B94A48]/30 hover:bg-[#B94A48]/10 font-bold text-xs flex items-center gap-1 transition-all"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full sm:w-48">
                  <label className="block text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Monogram / Short Code
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={formData.logoText || ''}
                    onChange={e => handleChange('logoText', e.target.value.toUpperCase())}
                    placeholder="SLJ"
                    className="w-full px-3 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] font-black text-xs text-[#3B2921] outline-none uppercase font-mono"
                  />
                  <span className="text-[10px] text-[#8B5E3C]">Shown if no image logo uploaded</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Business / Firm Name <span className="text-[#B94A48]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={e => handleChange('businessName', e.target.value)}
                    placeholder="Sri Lakshmi Jute & Gunny Mart"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border font-bold text-xs text-[#3B2921] outline-none ${
                      formErrors.businessName ? 'border-[#B94A48] focus:border-[#B94A48]' : 'border-[#E4D7C8] focus:border-[#8B5E3C]'
                    }`}
                  />
                  {formErrors.businessName && (
                    <p className="text-[10px] text-[#B94A48] font-semibold mt-1">{formErrors.businessName}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Proprietor / Owner Name
                  </label>
                  <input
                    type="text"
                    value={formData.ownerName || ''}
                    onChange={e => handleChange('ownerName', e.target.value)}
                    placeholder="S. Shanmugam"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Tagline / Business Subtitle
                  </label>
                  <input
                    type="text"
                    value={formData.tagline}
                    onChange={e => handleChange('tagline', e.target.value)}
                    placeholder="Wholesale & Retail Suppliers of All Kinds of Commercial Bags"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Business Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => handleChange('address', e.target.value)}
                    placeholder="Shop No. 14, Commercial Market Yard, Opp. Old Cotton Market"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => handleChange('city', e.target.value)}
                    placeholder="Salem"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={e => handleChange('state', e.target.value)}
                      placeholder="Tamil Nadu"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={formData.pincode}
                      onChange={e => handleChange('pincode', e.target.value)}
                      placeholder="636001"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border font-mono text-xs text-[#3B2921] outline-none ${
                        formErrors.pincode ? 'border-[#B94A48] focus:border-[#B94A48]' : 'border-[#E4D7C8] focus:border-[#8B5E3C]'
                      }`}
                    />
                    {formErrors.pincode && (
                      <p className="text-[10px] text-[#B94A48] font-semibold mt-1">{formErrors.pincode}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    placeholder="+91 98427 51234"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border font-mono text-xs text-[#3B2921] outline-none ${
                      formErrors.phone ? 'border-[#B94A48] focus:border-[#B94A48]' : 'border-[#E4D7C8] focus:border-[#8B5E3C]'
                    }`}
                  />
                  {formErrors.phone && (
                    <p className="text-[10px] text-[#B94A48] font-semibold mt-1">{formErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder="sales@srilakshmijute.com"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border text-xs text-[#3B2921] outline-none ${
                      formErrors.email ? 'border-[#B94A48] focus:border-[#B94A48]' : 'border-[#E4D7C8] focus:border-[#8B5E3C]'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-[10px] text-[#B94A48] font-semibold mt-1">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={formData.gstin}
                    onChange={e => handleChange('gstin', e.target.value.toUpperCase())}
                    placeholder="33AABCS1429B1Z8"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border font-mono font-bold text-xs text-[#3B2921] outline-none uppercase ${
                      formErrors.gstin ? 'border-[#B94A48] focus:border-[#B94A48]' : 'border-[#E4D7C8] focus:border-[#8B5E3C]'
                    }`}
                  />
                  {formErrors.gstin && (
                    <p className="text-[10px] text-[#B94A48] font-semibold mt-1">{formErrors.gstin}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formData.panNumber}
                    onChange={e => handleChange('panNumber', e.target.value.toUpperCase())}
                    placeholder="AABCS1429B"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border font-mono font-bold text-xs text-[#3B2921] outline-none uppercase ${
                      formErrors.panNumber ? 'border-[#B94A48] focus:border-[#B94A48]' : 'border-[#E4D7C8] focus:border-[#8B5E3C]'
                    }`}
                  />
                  {formErrors.panNumber && (
                    <p className="text-[10px] text-[#B94A48] font-semibold mt-1">{formErrors.panNumber}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Website / Web Portal (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.website || ''}
                    onChange={e => handleChange('website', e.target.value)}
                    placeholder="www.srilakshmijute.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB B: INVOICE SETTINGS                                  */}
        {/* ======================================================== */}
        {activeTab === 'invoice' && (
          <div className="space-y-6">
            <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E4D7C8]">
                <Receipt size={18} className="text-[#8B5E3C]" />
                <div>
                  <h3 className="font-bold text-base text-[#3B2921]">Invoice Numbering & Prefix Configuration</h3>
                  <p className="text-[11px] text-[#8B5E3C]">Configure how future bills are automatically numbered and formatted</p>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="p-3.5 rounded-xl bg-[#C99563]/15 border border-[#C99563]/40 text-xs text-[#3B2921] flex items-start gap-2.5">
                <ShieldCheck size={18} className="text-[#8B5E3C] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#3B2921]">Historical Invoices Protected:</strong> Existing recorded bills in Bill Book and Party Ledger will <strong>NEVER</strong> be renumbered or altered. Changes here only determine the sequence for genuinely new invoices.
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">Next Invoice Number Preview:</span>
                  <div className="text-2xl font-black font-mono text-[#3B2921] tracking-wider mt-0.5">
                    {invoicePreviewSample}
                  </div>
                </div>
                <div className="text-xs text-[#8B5E3C] font-semibold bg-[#FFFDF8] px-3 py-1.5 rounded-lg border border-[#E4D7C8]">
                  Assigned strictly once upon bill generation
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    value={formData.invoicePrefix}
                    onChange={e => handleChange('invoicePrefix', e.target.value.toUpperCase())}
                    placeholder="INV-"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none uppercase focus:border-[#8B5E3C]"
                  />
                  <span className="text-[10px] text-[#8B5E3C]">e.g. INV-, BILL-, SLJ-</span>
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Next Invoice Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.startingInvoiceNumber}
                    onChange={e => handleChange('startingInvoiceNumber', parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                  <span className="text-[10px] text-[#8B5E3C]">Sequence number assigned to genuinely new bills</span>
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Digit Padding (Digits)
                  </label>
                  <select
                    value={formData.invoiceNumberPadding || 5}
                    onChange={e => handleChange('invoiceNumberPadding', parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  >
                    <option value={3}>3 digits (INV-128)</option>
                    <option value={4}>4 digits (INV-0128)</option>
                    <option value={5}>5 digits (INV-00128)</option>
                    <option value={6}>6 digits (INV-000128)</option>
                  </select>
                  <span className="text-[10px] text-[#8B5E3C]">Zero-padding format</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB C: BANK & PAYMENT DETAILS                            */}
        {/* ======================================================== */}
        {activeTab === 'bank' && (
          <div className="space-y-6">
            <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4D7C8]">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-[#8B5E3C]" />
                  <div>
                    <h3 className="font-bold text-base text-[#3B2921]">Bank Accounts & Settlement Details</h3>
                    <p className="text-[11px] text-[#8B5E3C]">Printed on tax invoices for direct RTGS/NEFT/UPI wholesale collections</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#3B2921]">Print on Invoices:</span>
                  <input
                    type="checkbox"
                    checked={formData.showBankDetailsOnInvoice ?? true}
                    onChange={e => handleChange('showBankDetailsOnInvoice', e.target.checked)}
                    className="w-4 h-4 accent-[#3B2921] cursor-pointer"
                  />
                </div>
              </div>

              {/* Data Protection Alert */}
              <div className="p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#8B5E3C] flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-[#4F7D5A] shrink-0 mt-0.5" />
                <div>
                  <strong>Snapshot Protection:</strong> Whenever an invoice is generated, the current bank details are permanently snapshotted to that bill record. Changing your bank details here will apply to future bills without altering historical PDFs.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={e => handleChange('bankName', e.target.value)}
                    placeholder="State Bank of India"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={formData.accountHolderName || ''}
                    onChange={e => handleChange('accountHolderName', e.target.value)}
                    placeholder="Sri Lakshmi Jute & Gunny Mart"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-[#8B5E3C] uppercase tracking-wider">
                      Account Number
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAccountNumber(!showAccountNumber)}
                      className="text-[#8B5E3C] hover:text-[#3B2921] flex items-center gap-1 text-[11px]"
                    >
                      {showAccountNumber ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showAccountNumber ? 'Mask' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showAccountNumber ? 'text' : 'password'}
                    value={formData.bankAccountNumber}
                    onChange={e => handleChange('bankAccountNumber', e.target.value)}
                    placeholder="381920485910"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={formData.bankIfsc}
                    onChange={e => handleChange('bankIfsc', e.target.value.toUpperCase())}
                    placeholder="SBIN0001254"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none uppercase focus:border-[#8B5E3C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Bank Branch
                  </label>
                  <input
                    type="text"
                    value={formData.bankBranch}
                    onChange={e => handleChange('bankBranch', e.target.value)}
                    placeholder="Salem Main Branch"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    UPI ID (QR / Instant Pay)
                  </label>
                  <input
                    type="text"
                    value={formData.upiId}
                    onChange={e => handleChange('upiId', e.target.value)}
                    placeholder="lakshmijute@sbi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB D: TAX SETTINGS                                      */}
        {/* ======================================================== */}
        {activeTab === 'tax' && (
          <div className="space-y-6">
            <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E4D7C8]">
                <Percent size={18} className="text-[#8B5E3C]" />
                <div>
                  <h3 className="font-bold text-base text-[#3B2921]">GST & Tax Defaults</h3>
                  <p className="text-[11px] text-[#8B5E3C]">Configure default tax modes and brackets for invoice creation</p>
                </div>
              </div>

              {/* Crucial Independence Notice */}
              <div className="p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#3B2921] flex items-start gap-2.5">
                <HelpCircle size={18} className="text-[#8B5E3C] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#3B2921]">Product Rates Take Precedence:</strong> The default GST rate configured here is for fallback only. Product-specific GST brackets from your bag catalog (e.g. <strong>Gunny Bag &rarr; 5%</strong>, <strong>PP Bag &rarr; 18%</strong>) will automatically override this default whenever a catalog item is chosen.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1.5">
                    Default Tax Mode for New Bills
                  </label>
                  <div className="flex rounded-xl bg-[#F7F3EA] p-1 border border-[#E4D7C8]">
                    <button
                      type="button"
                      onClick={() => handleChange('defaultTaxMode', 'CGST_SGST')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        formData.defaultTaxMode === 'CGST_SGST'
                          ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                          : 'text-[#8B5E3C] hover:text-[#3B2921]'
                      }`}
                    >
                      CGST + SGST (Intra-State)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange('defaultTaxMode', 'IGST')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        formData.defaultTaxMode === 'IGST'
                          ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                          : 'text-[#8B5E3C] hover:text-[#3B2921]'
                      }`}
                    >
                      IGST (Inter-State)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1.5">
                    Default GST Rate (Blank Items)
                  </label>
                  <select
                    value={formData.defaultGstRate || 5}
                    onChange={e => handleChange('defaultGstRate', parseFloat(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none"
                  >
                    <option value={0}>0% GST (Exempt)</option>
                    <option value={5}>5% GST (Jute, Gunny Sacks)</option>
                    <option value={12}>12% GST (Custom Bags)</option>
                    <option value={18}>18% GST (HDPE, PP, Plastic Bags)</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>

                <div className="sm:col-span-2 p-4 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] space-y-3">
                  <h4 className="font-bold text-xs text-[#3B2921] uppercase tracking-wider">
                    Advanced Tax Rules
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#3B2921]">
                      <input
                        type="checkbox"
                        checked={formData.enableCgstSgst ?? true}
                        onChange={e => handleChange('enableCgstSgst', e.target.checked)}
                        className="w-4 h-4 accent-[#3B2921]"
                      />
                      <span>Enable Intra-State CGST + SGST Calculation Mode</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#3B2921]">
                      <input
                        type="checkbox"
                        checked={formData.enableIgst ?? true}
                        onChange={e => handleChange('enableIgst', e.target.checked)}
                        className="w-4 h-4 accent-[#3B2921]"
                      />
                      <span>Enable Inter-State IGST Calculation Mode</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#3B2921]">
                      <input
                        type="checkbox"
                        checked={formData.defaultRcm ?? false}
                        onChange={e => handleChange('defaultRcm', e.target.checked)}
                        className="w-4 h-4 accent-[#3B2921]"
                      />
                      <span>Reverse Charge Mechanism (RCM) Default ON</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB E: TERMS & SIGNATURE                                 */}
        {/* ======================================================== */}
        {activeTab === 'terms' && (
          <div className="space-y-6">
            <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E4D7C8]">
                <FileText size={18} className="text-[#8B5E3C]" />
                <div>
                  <h3 className="font-bold text-base text-[#3B2921]">Terms, Conditions & Authorized Signatory</h3>
                  <p className="text-[11px] text-[#8B5E3C]">Legal terms, credit clauses, and signatory credentials for invoices</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider">
                    Terms & Conditions Clause
                  </label>
                  <button
                    type="button"
                    onClick={() => handleChange('termsAndConditions', '1. Goods once sold will not be taken back or exchanged.\n2. Interest @ 18% per annum will be charged if payment is not received within 15 days.\n3. Subject to Salem jurisdiction only.')}
                    className="text-[10px] font-bold text-[#8B5E3C] hover:text-[#3B2921] underline"
                  >
                    Reset Sample Terms
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={formData.termsAndConditions}
                  onChange={e => handleChange('termsAndConditions', e.target.value)}
                  placeholder="1. Goods once sold will not be returned..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none leading-relaxed font-sans focus:border-[#8B5E3C]"
                />
                <span className="text-[10px] text-[#8B5E3C]">These clauses are automatically attached to future generated invoices.</span>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#E4D7C8]">
                  <h4 className="font-bold text-xs text-[#3B2921] uppercase tracking-wider">
                    Authorized Signatory Credentials
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#3B2921]">
                    <span>Show Signature Block:</span>
                    <input
                      type="checkbox"
                      checked={formData.showSignatureSection ?? true}
                      onChange={e => handleChange('showSignatureSection', e.target.checked)}
                      className="w-4 h-4 accent-[#3B2921]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                      Signatory Name
                    </label>
                    <input
                      type="text"
                      value={formData.authorizedSignatoryName || ''}
                      onChange={e => handleChange('authorizedSignatoryName', e.target.value)}
                      placeholder="S. Shanmugam"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                      Designation / Role
                    </label>
                    <input
                      type="text"
                      value={formData.authorizedSignatoryDesignation || ''}
                      onChange={e => handleChange('authorizedSignatoryDesignation', e.target.value)}
                      placeholder="Proprietor / Partner"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                      Signatory Footer Text
                    </label>
                    <input
                      type="text"
                      value={formData.authorizedSignatoryText}
                      onChange={e => handleChange('authorizedSignatoryText', e.target.value)}
                      placeholder="Proprietor / Authorized Signatory"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs text-[#3B2921] outline-none focus:border-[#8B5E3C]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB F: APPEARANCE & APP SETTINGS                         */}
        {/* ======================================================== */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E4D7C8]">
                <Sliders size={18} className="text-[#8B5E3C]" />
                <div>
                  <h3 className="font-bold text-base text-[#3B2921]">Invoice Appearance & Settlement Rules</h3>
                  <p className="text-[11px] text-[#8B5E3C]">Configure invoice layout elements, payment modes, and defaults</p>
                </div>
              </div>

              {/* Invoice Layout Elements Toggle */}
              <div className="p-4 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] space-y-3">
                <h4 className="font-bold text-xs text-[#3B2921] uppercase tracking-wider">
                  Invoice Sections Visibility
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: 'showBusinessLogo', label: 'Show Business Logo / Monogram' },
                    { key: 'showBankDetails', label: 'Show Bank Details Section' },
                    { key: 'showHsnSac', label: 'Show HSN/SAC Codes on Items' },
                    { key: 'showGstBreakup', label: 'Show GST Rate Breakdown Table' },
                    { key: 'showTermsAndConditions', label: 'Show Terms & Conditions' },
                    { key: 'showSignatureSection', label: 'Show Authorized Signature Block' },
                  ].map(toggle => (
                    <label key={toggle.key} className="flex items-center gap-2.5 p-2 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] cursor-pointer hover:border-[#C99563]">
                      <input
                        type="checkbox"
                        checked={formData[toggle.key as keyof BusinessSettings] !== false}
                        onChange={e => handleChange(toggle.key as keyof BusinessSettings, e.target.checked as any)}
                        className="w-4 h-4 accent-[#3B2921]"
                      />
                      <span className="font-bold text-xs text-[#3B2921]">{toggle.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Configurable Active Payment Methods */}
              <div className="p-4 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] space-y-3">
                <h4 className="font-bold text-xs text-[#3B2921] uppercase tracking-wider">
                  Active Payment Modes in Create Bill
                </h4>
                <p className="text-[11px] text-[#8B5E3C]">Select which payment methods should be available in the dropdown</p>
                <div className="flex flex-wrap gap-2.5">
                  {(['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'] as PaymentMode[]).map(mode => {
                    const isChecked = (formData.activePaymentModes || ['Cash', 'UPI', 'Bank Transfer', 'Cheque']).includes(mode);
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleTogglePaymentMode(mode)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          isChecked
                            ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921] shadow-2xs'
                            : 'bg-[#FFFDF8] text-[#8B5E3C] border-[#E4D7C8] hover:border-[#C99563]'
                        }`}
                      >
                        {isChecked ? `✓ ${mode}` : `+ ${mode}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default Payment Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Default Payment Status
                  </label>
                  <select
                    value={formData.defaultPaymentStatus}
                    onChange={e => handleChange('defaultPaymentStatus', e.target.value as PaymentStatus)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none"
                  >
                    <option value="Pending">Pending (Credit Order)</option>
                    <option value="Partial">Partial (Advance Payment)</option>
                    <option value="Paid">Paid (Cash / Settled)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Default Due Days (Credit Term)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={formData.defaultDueDays ?? 15}
                    onChange={e => handleChange('defaultDueDays', parseInt(e.target.value, 10) || 0)}
                    placeholder="15"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none"
                  />
                  <span className="text-[10px] text-[#8B5E3C]">Auto-calculates Due Date as today + X days</span>
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    disabled
                    value="INR (₹) — Indian Rupee"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#E4D7C8]/40 border border-[#E4D7C8] font-bold text-xs text-[#8B5E3C] cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                    Default Bag Unit
                  </label>
                  <input
                    type="text"
                    value={formData.defaultUnit || 'Bag'}
                    onChange={e => handleChange('defaultUnit', e.target.value)}
                    placeholder="Bag"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. BOTTOM SAVE ACTION BAR */}
        <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#8B5E3C]">
            All configuration updates are stored persistently in your local browser state.
          </div>
          <button
            type="button"
            onClick={() => handleSave()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 border border-[#3B2921]"
          >
            {isSaved ? <Check size={16} className="text-[#4F7D5A]" /> : <Save size={16} className="text-[#C99563]" />}
            <span>{isSaved ? 'Settings Saved!' : 'Save Changes'}</span>
          </button>
        </div>
      </form>

      {/* 5. RESET SETTINGS CONFIRMATION MODAL */}
      {isResetModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsResetModalOpen(false)}
          title="Reset all settings to default values?"
          subtitle="Confirm configuration reset"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#B94A48]/10 border border-[#B94A48]/30 flex items-start gap-3">
              <AlertTriangle size={20} className="text-[#B94A48] shrink-0 mt-0.5" />
              <div className="text-xs text-[#2C211B]">
                <p className="font-bold text-[#B94A48] mb-1">Safe Settings Reset</p>
                <p className="leading-relaxed">
                  Reset all settings to default values? This action will restore business details, bank accounts, and defaults back to system initial state.
                </p>
                <p className="font-semibold text-[#3B2921] mt-2">
                  ✓ Your bills, customer ledgers, products, and reports will NEVER be deleted or modified.
                </p>
                <p className="font-semibold text-[#3B2921] mt-1">
                  ✓ Existing invoice numbers will NEVER be changed.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#F7F3EA] text-[#8B5E3C] font-bold text-xs hover:bg-[#EAE2D2] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl bg-[#B94A48] text-white font-bold text-xs hover:bg-[#A33B39] transition-colors shadow-xs"
              >
                Reset
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default SettingsPage;
