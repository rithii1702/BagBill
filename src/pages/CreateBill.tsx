import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Printer, 
  Download, 
  Save, 
  CheckCircle2, 
  RotateCcw, 
  ShoppingBag, 
  Building2, 
  Receipt,
  Sparkles,
  ArrowRight,
  Calculator,
  Copy,
  Lock,
  Unlock,
  UserPlus,
  Search,
  ChevronDown,
  UserCheck,
  AlertTriangle,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useBagBill } from '../context/BagBillContext';
import { Invoice, BillItem, BagType, TaxMode, PaymentStatus, PaymentMode, Party, Product, InvoiceBankDetails, BusinessSettings } from '../types';
import { InvoicePreview } from '../components/invoice/InvoicePreview';
import { downloadInvoicePDF, printInvoice } from '../utils/pdfGenerator';
import { formatINR, getTodayDateString } from '../utils/formatters';
import { numberToWordsINR } from '../utils/numberToWords';
import { BagCalculatorModal, BagCalculatorData } from '../components/calculator/BagCalculatorModal';
import { Modal } from '../components/common/Modal';

export const CreateBill: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    settings, 
    parties, 
    products, 
    nextInvoiceNumber, 
    addInvoice, 
    updateInvoice,
    addParty,
    transferBuffer, 
    clearTransferBuffer,
    showToast 
  } = useBagBill();

  // Check if we are editing or duplicating an invoice passed via state
  const editInvoice = location.state?.editInvoice as Invoice | undefined;
  const isEditing = Boolean(editInvoice);
  const preselectedParty = location.state?.preselectedParty as Party | undefined;

  // Form State
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null);
  const activeSavedInvoice = editInvoice || generatedInvoice;
  const isSavedBill = Boolean(activeSavedInvoice);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  const [isInvoiceUnlocked, setIsInvoiceUnlocked] = useState<boolean>(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(editInvoice?.invoiceNumber || nextInvoiceNumber);
  const [date, setDate] = useState<string>(editInvoice?.date || getTodayDateString());
  const [dueDate, setDueDate] = useState<string>(() => {
    if (editInvoice?.dueDate) return editInvoice.dueDate;
    const d = new Date();
    d.setDate(d.getDate() + (settings.defaultDueDays ?? 15));
    return d.toISOString().split('T')[0];
  });
  
  // Keep invoice number synced with nextInvoiceNumber when not editing an existing invoice, not manually unlocked, and not yet generated
  useEffect(() => {
    if (!editInvoice && !isInvoiceUnlocked && !generatedInvoice) {
      setInvoiceNumber(nextInvoiceNumber);
    }
  }, [nextInvoiceNumber, editInvoice, isInvoiceUnlocked, generatedInvoice]);

  // Party state
  const [selectedPartyId, setSelectedPartyId] = useState<string>(editInvoice?.partyName ? '' : (preselectedParty?.id || ''));
  const [partyName, setPartyName] = useState<string>(editInvoice?.partyName || preselectedParty?.name || '');
  const [partyPhone, setPartyPhone] = useState<string>(editInvoice?.partyPhone || preselectedParty?.phone || '');
  const [partyAddress, setPartyAddress] = useState<string>(editInvoice?.partyAddress || preselectedParty?.address || '');
  const [partyGstin, setPartyGstin] = useState<string>(editInvoice?.partyGstin || preselectedParty?.gstin || '');

  // Handle incoming preselectedParty if navigated from Parties page or Ledger
  useEffect(() => {
    if (location.state?.preselectedParty) {
      const p = location.state.preselectedParty as Party;
      setSelectedPartyId(p.id);
      setPartyName(p.name);
      setPartyPhone(p.phone);
      setPartyAddress(p.address);
      setPartyGstin(p.gstin || '');
      showToast(`Selected party: ${p.name}`, 'info');
    }
  }, [location.state]);

  // Party search & picker dropdown state
  const [partySearchTerm, setPartySearchTerm] = useState<string>('');
  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState<boolean>(false);
  const partyPickerRef = useRef<HTMLDivElement>(null);

  // Close party dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (partyPickerRef.current && !partyPickerRef.current.contains(e.target as Node)) {
        setIsPartyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filtered parties for search dropdown
  const filteredParties = useMemo(() => {
    const term = partySearchTerm.trim().toLowerCase();
    const baseList = parties.filter(p => !p.isArchived);
    if (!term) return baseList;
    return parties.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.phone.toLowerCase().includes(term) ||
      (p.gstin && p.gstin.toLowerCase().includes(term))
    );
  }, [parties, partySearchTerm]);

  // Add Party Modal state
  const [isAddPartyModalOpen, setIsAddPartyModalOpen] = useState<boolean>(false);
  const [newPartyForm, setNewPartyForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    state: '',
    notes: '',
  });
  const [newPartyError, setNewPartyError] = useState<string>('');

  // Settings / Taxes / Payment
  const [taxMode, setTaxMode] = useState<TaxMode>(editInvoice?.taxMode || settings.defaultTaxMode || 'CGST_SGST');
  const [isRcm, setIsRcm] = useState<boolean>(editInvoice?.isRcm || settings.defaultRcm || false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(editInvoice?.paymentStatus || settings.defaultPaymentStatus || 'Pending');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(
    editInvoice?.paymentMode || 
    (settings.activePaymentModes && settings.activePaymentModes.length > 0 ? settings.activePaymentModes[0] : 'Cash')
  );
  const [paidAdvanceAmount, setPaidAdvanceAmount] = useState<number | ''>(editInvoice?.paidAmount !== undefined ? editInvoice.paidAmount : '');
  const [paymentRef, setPaymentRef] = useState<string>(editInvoice?.paymentRef || '');
  const [autoRoundOff, setAutoRoundOff] = useState<boolean>(true);
  const [vehicleNumber, setVehicleNumber] = useState<string>(editInvoice?.vehicleNumber || '');
  const [notes, setNotes] = useState<string>(editInvoice?.notes || settings.termsAndConditions || '');

  // Bag Calculator Modal state (modal popup inside Create Bill)
  const [isBagCalcModalOpen, setIsBagCalcModalOpen] = useState<boolean>(false);
  const [bagCalcTargetIndex, setBagCalcTargetIndex] = useState<number>(0);

  // Bill Items
  const [items, setItems] = useState<BillItem[]>(() => {
    if (editInvoice?.items && editInvoice.items.length > 0) {
      return editInvoice.items;
    }
    return [
      {
        id: 'item-1',
        bagType: 'Gunny Bag',
        description: 'Standard Gunny Bag 50kg capacity',
        hsnCode: '630510',
        quantity: 500,
        unit: 'Bags',
        pricePerBag: 28.00,
        discountPercent: 0,
        gstRate: 5,
        amount: 14000,
        discountAmount: 0,
        taxableAmount: 14000,
        cgstAmount: 350,
        sgstAmount: 350,
        igstAmount: 0,
        totalAmount: 14700,
      }
    ];
  });

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Support preselectedProduct from Products catalog navigation
  useEffect(() => {
    if (location.state?.preselectedProduct) {
      const prod = location.state.preselectedProduct as Product;
      const rate = prod.defaultPrice ?? prod.rate ?? 28;
      const qty = 500;
      const raw = qty * rate;
      const gst = (raw * prod.gstRate) / 100;
      const initialItem: BillItem = {
        id: `item-${Date.now()}`,
        productId: prod.id,
        productName: prod.name,
        bagType: prod.bagType,
        category: prod.category,
        description: prod.description || `${prod.name}`,
        hsnCode: prod.hsnCode || prod.hsnSac || '630510',
        hsnSac: prod.hsnCode || prod.hsnSac || '630510',
        quantity: qty,
        unit: prod.unit || 'Bag',
        pricePerBag: rate,
        rate: rate,
        discountPercent: 0,
        discount: 0,
        gstRate: prod.gstRate,
        amount: raw,
        discountAmount: 0,
        taxableAmount: raw,
        cgstAmount: gst / 2,
        sgstAmount: gst / 2,
        igstAmount: gst,
        totalAmount: raw + gst,
      };
      setItems([initialItem]);
      showToast(`Selected product: ${prod.name}`, 'info');
    }
  }, [location.state, showToast]);

  // Consume Calculator transferBuffer if present
  useEffect(() => {
    if (transferBuffer) {
      const bagType = transferBuffer.bagType || 'Gunny Bag';
      const prodMatch = products.find(p => p.bagType === bagType && !p.isArchived) || products.find(p => p.bagType === bagType);
      const hsn = prodMatch?.hsnCode || prodMatch?.hsnSac || '630510';
      const gst = transferBuffer.gstRate !== undefined ? transferBuffer.gstRate : (prodMatch?.gstRate || 5);
      const qty = transferBuffer.quantity || 100;
      const price = transferBuffer.pricePerBag || (prodMatch?.defaultPrice ?? prodMatch?.rate ?? 25);
      const disc = transferBuffer.discountPercent || 0;
      const unitVal = transferBuffer.unit || prodMatch?.unit || 'Bag';

      const rawAmount = qty * price;
      const discAmount = (rawAmount * disc) / 100;
      const taxable = Math.max(0, rawAmount - discAmount);
      const taxAmount = (taxable * gst) / 100;

      const newItem: BillItem = {
        id: `item-${Date.now()}`,
        productId: prodMatch?.id,
        productName: prodMatch?.name || bagType,
        bagType,
        category: prodMatch?.category,
        description: transferBuffer.note || prodMatch?.description || `${bagType} batch`,
        hsnCode: hsn,
        hsnSac: hsn,
        quantity: qty,
        unit: unitVal,
        pricePerBag: price,
        rate: price,
        discountPercent: disc,
        discount: disc,
        gstRate: gst,
        amount: rawAmount,
        discountAmount: discAmount,
        taxableAmount: taxable,
        cgstAmount: taxAmount / 2,
        sgstAmount: taxAmount / 2,
        igstAmount: taxAmount,
        totalAmount: taxable + taxAmount,
      };

      setItems(prev => [newItem, ...prev]);
      showToast(`Added ${qty} ${bagType} to bill!`, 'success');
      clearTransferBuffer();
    }
  }, [transferBuffer, products, clearTransferBuffer, showToast]);

  // Party selection handler
  const handleSelectParty = (party: Party) => {
    setSelectedPartyId(party.id);
    setPartyName(party.name);
    setPartyPhone(party.phone);
    setPartyAddress(party.address);
    setPartyGstin(party.gstin || '');
    setIsPartyDropdownOpen(false);
    setPartySearchTerm('');
    if (errors.partyName) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.partyName;
        return copy;
      });
    }
    showToast(`Selected party: ${party.name}`, 'info');
  };

  const handleClearSelectedParty = () => {
    setSelectedPartyId('');
    setPartyName('');
    setPartyPhone('');
    setPartyAddress('');
    setPartyGstin('');
    setPartySearchTerm('');
    setIsPartyDropdownOpen(false);
    showToast('Switched to manual entry', 'info');
  };

  const handleCreateNewPartySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newPartyForm.name.trim();
    if (!cleanName) {
      setNewPartyError('Party / Business name is required');
      return;
    }

    const existing = parties.find(p => p.name.toLowerCase().trim() === cleanName.toLowerCase() && !p.isArchived);
    if (existing) {
      handleSelectParty(existing);
      setIsAddPartyModalOpen(false);
      setNewPartyForm({ name: '', phone: '', email: '', address: '', gstin: '', state: '', notes: '' });
      showToast(`Party "${existing.name}" already exists — selected automatically.`, 'info');
      return;
    }

    const created = addParty({
      name: cleanName,
      phone: newPartyForm.phone.trim(),
      email: newPartyForm.email.trim(),
      address: newPartyForm.address.trim(),
      gstin: newPartyForm.gstin.trim().toUpperCase(),
      state: newPartyForm.state.trim(),
      notes: newPartyForm.notes.trim(),
      isArchived: false,
    });

    // Auto-select immediately in Create Bill
    setSelectedPartyId(created.id);
    setPartyName(created.name);
    setPartyPhone(created.phone);
    setPartyAddress(created.address);
    setPartyGstin(created.gstin || '');

    if (errors.partyName) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.partyName;
        return copy;
      });
    }

    // Reset & close modal
    setNewPartyForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      gstin: '',
      state: '',
      notes: '',
    });
    setNewPartyError('');
    setIsAddPartyModalOpen(false);
    showToast(`Party "${created.name}" added and selected!`, 'success');
  };

  // Dedicated helper to select a product for a line item from catalog
  const handleSelectProductForItem = (index: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };

      const rate = prod.defaultPrice ?? prod.rate ?? 25;
      const hsn = prod.hsnCode || prod.hsnSac || '630510';
      const unit = prod.unit || 'Bag';

      item.productId = prod.id;
      item.productName = prod.name;
      item.bagType = prod.bagType;
      item.category = prod.category;
      item.description = prod.description || `${prod.name}`;
      item.hsnCode = hsn;
      item.hsnSac = hsn;
      item.unit = unit;
      item.pricePerBag = rate;
      item.rate = rate;
      item.gstRate = prod.gstRate;

      const qty = Math.max(1, Number(item.quantity) || 1);
      const discPct = Math.max(0, Math.min(100, Number(item.discountPercent) || 0));
      const gstPct = item.gstRate;

      const rawAmount = qty * rate;
      const discountVal = (rawAmount * discPct) / 100;
      const taxable = Math.max(0, rawAmount - discountVal);
      const totalTax = (taxable * gstPct) / 100;

      item.amount = rawAmount;
      item.discountAmount = discountVal;
      item.taxableAmount = taxable;
      item.cgstAmount = totalTax / 2;
      item.sgstAmount = totalTax / 2;
      item.igstAmount = totalTax;
      item.totalAmount = taxable + totalTax;

      updated[index] = item;
      return updated;
    });
  };

  // Line item change helper
  const handleItemChange = (index: number, field: keyof BillItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // If bagType changed, autofill HSN and default GST rate from product catalog
      if (field === 'bagType') {
        const prod = products.find(p => p.bagType === value && !p.isArchived) || products.find(p => p.bagType === value);
        if (prod) {
          item.productId = prod.id;
          item.productName = prod.name;
          item.category = prod.category;
          item.hsnCode = prod.hsnCode || prod.hsnSac || item.hsnCode;
          item.hsnSac = prod.hsnCode || prod.hsnSac || item.hsnCode;
          item.gstRate = prod.gstRate;
          item.unit = prod.unit || item.unit || 'Bag';
          item.pricePerBag = prod.defaultPrice ?? prod.rate ?? item.pricePerBag;
          item.rate = item.pricePerBag;
        }
      }
      if (field === 'pricePerBag') {
        item.rate = value;
      }
      if (field === 'hsnCode') {
        item.hsnSac = value;
      }
      if (field === 'discountPercent') {
        item.discount = value;
      }

      // Recompute math
      const qty = Math.max(0, Number(item.quantity) || 0);
      const rate = Math.max(0, Number(item.pricePerBag) || 0);
      const discPct = Math.max(0, Math.min(100, Number(item.discountPercent) || 0));
      const gstPct = Math.max(0, Number(item.gstRate) || 0);

      const rawAmount = qty * rate;
      const discountVal = (rawAmount * discPct) / 100;
      const taxable = Math.max(0, rawAmount - discountVal);
      const totalTax = (taxable * gstPct) / 100;

      item.amount = rawAmount;
      item.discountAmount = discountVal;
      item.taxableAmount = taxable;
      item.cgstAmount = totalTax / 2;
      item.sgstAmount = totalTax / 2;
      item.igstAmount = totalTax;
      item.totalAmount = taxable + totalTax;

      updated[index] = item;
      return updated;
    });
  };

  const handleAddItem = () => {
    const activeProductsList = products.filter(p => !p.isArchived);
    const defaultBag = activeProductsList[0] || products[0] || {
      id: 'prod-default',
      name: 'Gunny Bag',
      bagType: 'Gunny Bag' as BagType,
      category: 'Gunny',
      hsnCode: '630510',
      defaultPrice: 28.0,
      rate: 28.0,
      gstRate: 5,
      unit: 'Bag',
      description: 'Standard Gunny Bag 50kg capacity',
    };

    const qty = 500;
    const rate = defaultBag.defaultPrice ?? defaultBag.rate ?? 28.0;
    const raw = qty * rate;
    const gst = (raw * defaultBag.gstRate) / 100;

    const newItem: BillItem = {
      id: `item-${Date.now()}`,
      productId: defaultBag.id,
      productName: defaultBag.name,
      bagType: defaultBag.bagType,
      category: defaultBag.category,
      description: defaultBag.description || `${defaultBag.name} batch`,
      hsnCode: defaultBag.hsnCode || '630510',
      hsnSac: defaultBag.hsnCode || '630510',
      quantity: qty,
      unit: defaultBag.unit || 'Bag',
      pricePerBag: rate,
      rate: rate,
      discountPercent: 0,
      discount: 0,
      gstRate: defaultBag.gstRate,
      amount: raw,
      discountAmount: 0,
      taxableAmount: raw,
      cgstAmount: gst / 2,
      sgstAmount: gst / 2,
      igstAmount: gst,
      totalAmount: raw + gst,
    };

    setItems(prev => [...prev, newItem]);
  };

  const handleDuplicateItem = (index: number) => {
    const source = items[index];
    if (!source) return;
    const duplicated: BillItem = {
      ...source,
      id: `item-${Date.now()}`,
      description: `${source.bagType} (Copy)`,
    };
    setItems(prev => [...prev.slice(0, index + 1), duplicated, ...prev.slice(index + 1)]);
    showToast(`Duplicated ${source.bagType}`, 'info');
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      showToast('A bill must contain at least one item', 'warning');
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Wholesale Bag Calculator integration callback
  const handleApplyBagCalculator = (targetIdx: number, data: BagCalculatorData, isNewItem?: boolean) => {
    const prod = products.find(p => p.bagType === data.bagType);
    const hsn = prod?.hsnCode || '630510';
    const rawAmount = data.quantity * data.pricePerBag;
    const discAmount = (rawAmount * (data.discountPercent || 0)) / 100;
    const taxable = Math.max(0, rawAmount - discAmount);
    const totalTax = (taxable * (data.gstRate || 0)) / 100;

    const newItemData: BillItem = {
      id: isNewItem || !items[targetIdx] ? `item-${Date.now()}` : items[targetIdx].id,
      bagType: data.bagType,
      description: data.description || `${data.bagType} batch`,
      hsnCode: hsn,
      quantity: data.quantity,
      unit: data.unit || 'Bags',
      pricePerBag: data.pricePerBag,
      rate: data.pricePerBag,
      discountPercent: data.discountPercent,
      discount: data.discountPercent,
      gstRate: data.gstRate,
      amount: rawAmount,
      discountAmount: discAmount,
      taxableAmount: taxable,
      cgstAmount: taxMode === 'CGST_SGST' ? totalTax / 2 : 0,
      sgstAmount: taxMode === 'CGST_SGST' ? totalTax / 2 : 0,
      igstAmount: taxMode === 'IGST' ? totalTax : 0,
      totalAmount: taxable + totalTax,
    };

    if (isNewItem || targetIdx >= items.length) {
      setItems(prev => [...prev, newItemData]);
      showToast(`Added ${data.quantity} ${data.bagType} (${formatINR(newItemData.totalAmount)}) from Calculator`, 'success');
    } else {
      setItems(prev => {
        const updated = [...prev];
        updated[targetIdx] = newItemData;
        return updated;
      });
      showToast(`Transferred calculation to Bag #${targetIdx + 1} (${formatINR(newItemData.totalAmount)})`, 'success');
    }
  };

  // Calculations for bill summary & GST breakdown
  const summary = useMemo(() => {
    let totalQuantity = 0;
    let subtotal = 0;
    let totalDiscount = 0;
    let taxableAmount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    // Detailed breakdown by GST rate
    const gstRateBreakdown: { [key: number]: { taxable: number; cgst: number; sgst: number; igst: number } } = {};

    items.forEach(item => {
      totalQuantity += (item.quantity || 0);
      subtotal += item.amount;
      totalDiscount += item.discountAmount;
      taxableAmount += item.taxableAmount;

      const rate = item.gstRate || 0;
      if (!gstRateBreakdown[rate]) {
        gstRateBreakdown[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      }
      gstRateBreakdown[rate].taxable += item.taxableAmount;

      const lineTax = (item.taxableAmount * rate) / 100;
      if (taxMode === 'IGST') {
        igstTotal += lineTax;
        gstRateBreakdown[rate].igst += lineTax;
      } else {
        const half = lineTax / 2;
        cgstTotal += half;
        sgstTotal += half;
        gstRateBreakdown[rate].cgst += half;
        gstRateBreakdown[rate].sgst += half;
      }
    });

    const totalTax = taxMode === 'IGST' ? igstTotal : cgstTotal + sgstTotal;
    const unroundedTotal = taxableAmount + totalTax;
    const grandTotal = autoRoundOff ? Math.round(unroundedTotal) : Math.round(unroundedTotal * 100) / 100;
    const roundOff = Math.round((grandTotal - unroundedTotal) * 100) / 100;

    // Partial balance computation
    const advancePaid = paymentStatus === 'Paid' 
      ? grandTotal 
      : paymentStatus === 'Pending' 
        ? 0 
        : (typeof paidAdvanceAmount === 'number' ? paidAdvanceAmount : 0);
    const balanceDue = paymentStatus === 'Paid' 
      ? 0 
      : paymentStatus === 'Pending' 
        ? grandTotal 
        : Math.max(0, grandTotal - advancePaid);

    return {
      totalQuantity,
      subtotal,
      totalDiscount,
      taxableAmount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      totalTax,
      roundOff,
      grandTotal,
      advancePaid,
      balanceDue,
      gstRateBreakdown,
    };
  }, [items, taxMode, autoRoundOff, paidAdvanceAmount, paymentStatus]);

  // Handle Payment Status switching
  const handlePaymentStatusChange = (status: PaymentStatus) => {
    setPaymentStatus(status);
    if (status === 'Paid') {
      setPaidAdvanceAmount(summary.grandTotal);
    } else if (status === 'Pending') {
      setPaidAdvanceAmount(0);
    } else if (status === 'Partial') {
      if (paidAdvanceAmount === '' || paidAdvanceAmount === 0 || paidAdvanceAmount === summary.grandTotal) {
        setPaidAdvanceAmount(Math.round(summary.grandTotal / 2));
      }
    }
  };

  // Construct current real-time invoice object for live preview
  const liveInvoice: Invoice = useMemo(() => {
    const synchronizedItems = items.map(item => {
      const lineTax = (item.taxableAmount * (item.gstRate || 0)) / 100;
      return {
        ...item,
        cgstAmount: taxMode === 'CGST_SGST' ? lineTax / 2 : 0,
        sgstAmount: taxMode === 'CGST_SGST' ? lineTax / 2 : 0,
        igstAmount: taxMode === 'IGST' ? lineTax : 0,
        totalAmount: item.taxableAmount + lineTax,
      };
    });

    return {
      id: editInvoice?.id || 'live-preview-id',
      invoiceNumber: invoiceNumber || nextInvoiceNumber,
      date,
      dueDate: paymentStatus === 'Paid' ? date : dueDate,
      partyName: partyName.trim() || 'ABC Traders',
      partyPhone: partyPhone.trim(),
      partyAddress: partyAddress.trim(),
      partyGstin: partyGstin.trim(),
      items: synchronizedItems,
      subtotal: summary.subtotal,
      totalDiscount: summary.totalDiscount,
      taxableAmount: summary.taxableAmount,
      taxMode,
      cgstTotal: summary.cgstTotal,
      sgstTotal: summary.sgstTotal,
      igstTotal: summary.igstTotal,
      grandTotal: summary.grandTotal,
      roundOff: summary.roundOff,
      paymentStatus,
      paymentMode,
      paidAmount: summary.advancePaid,
      balanceAmount: summary.balanceDue,
      paymentRef,
      isRcm,
      notes,
      vehicleNumber,
      createdAt: editInvoice?.createdAt || new Date().toISOString(),
    };
  }, [
    editInvoice,
    invoiceNumber,
    nextInvoiceNumber,
    date,
    dueDate,
    partyName,
    partyPhone,
    partyAddress,
    partyGstin,
    items,
    summary,
    taxMode,
    paymentStatus,
    paymentMode,
    paymentRef,
    isRcm,
    notes,
    vehicleNumber,
  ]);

  // Quick Credit terms helper
  const handleCreditDays = (days: number) => {
    const [y, m, day] = (date || getTodayDateString()).split('-').map(Number);
    const d = new Date(y, m - 1, day);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDueDate(`${yyyy}-${mm}-${dd}`);
    showToast(`Payment Due Date set to ${days} days from bill date (${dd}/${mm}/${yyyy})`, 'info');
  };

  // Validate form
  const validateForm = (): { [key: string]: string } => {
    const newErrors: { [key: string]: string } = {};

    if (!partyName.trim()) {
      newErrors.partyName = 'Party name is required to issue an invoice';
    }

    if (partyPhone.trim() && !/^\d{10}$/.test(partyPhone.trim().replace(/\D/g, ''))) {
      newErrors.partyPhone = 'Phone number should be 10 digits';
    }

    if (partyGstin.trim() && partyGstin.trim().length !== 15) {
      newErrors.partyGstin = 'GSTIN must be 15 alphanumeric characters';
    }

    if (items.length === 0) {
      newErrors.items = 'Please add at least one bag product';
    }

    // Check stock availability
    const requestedStockMap = new Map<string, { product: Product; requested: number }>();
    items.forEach((item, idx) => {
      if (!item.bagType || !item.bagType.trim()) {
        newErrors[`item_${idx}_name`] = 'Product / bag description is required';
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`item_${idx}_qty`] = 'Quantity must be greater than 0';
      }
      if (item.pricePerBag === undefined || item.pricePerBag < 0) {
        newErrors[`item_${idx}_price`] = 'Price cannot be negative';
      }
      if (item.discountPercent < 0 || item.discountPercent > 100) {
        newErrors[`item_${idx}_disc`] = 'Discount must be between 0% and 100%';
      }

      const matchedProd = products.find(p => 
        (item.productId && (p.id === item.productId || (p as any)._id === item.productId)) ||
        p.name.toLowerCase() === item.bagType.toLowerCase() ||
        p.bagType.toLowerCase() === item.bagType.toLowerCase()
      );
      if (matchedProd && matchedProd.stock !== undefined && matchedProd.stock !== null) {
        const prodKey = matchedProd.id || matchedProd.name;
        const existing = requestedStockMap.get(prodKey) || { product: matchedProd, requested: 0 };
        existing.requested += (item.quantity || 0);
        requestedStockMap.set(prodKey, existing);
      }
    });

    if (!editInvoice) {
      for (const [, { product, requested }] of requestedStockMap) {
        if (requested > (product.stock ?? 0)) {
          newErrors.stock = `Insufficient stock for ${product.name}. Available: ${product.stock ?? 0}.`;
          break;
        }
      }
    }

    const adv = Number(paidAdvanceAmount) || 0;
    if (paymentStatus === 'Partial') {
      if (adv <= 0) {
        newErrors.paidAdvance = 'Advance amount must be greater than ₹0 for partial status';
      } else if (adv >= summary.grandTotal) {
        newErrors.paidAdvance = 'Advance amount cannot be equal to or greater than grand total';
      }
    } else if (adv > summary.grandTotal) {
      newErrors.paidAdvance = 'Paid amount cannot exceed grand total';
    }

    setErrors(newErrors);
    return newErrors;
  };

  // Action Handlers
  const handleGenerateInvoice = async () => {
    // 1. Guard against double clicks and rapid concurrent invocations
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      const firstError = Object.values(formErrors)[0];
      showToast(firstError, 'error');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const finalItems = items.map(item => {
        const lineTax = (item.taxableAmount * (item.gstRate || 0)) / 100;
        return {
          ...item,
          rate: item.pricePerBag,
          discount: item.discountPercent,
          cgstAmount: taxMode === 'CGST_SGST' ? lineTax / 2 : 0,
          sgstAmount: taxMode === 'CGST_SGST' ? lineTax / 2 : 0,
          igstAmount: taxMode === 'IGST' ? lineTax : 0,
          totalAmount: item.taxableAmount + lineTax,
        };
      });

      const activeRecord = editInvoice || generatedInvoice;

      const defaultBankSnapshot: InvoiceBankDetails = activeRecord?.bankDetails || {
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

      const defaultBusinessSnapshot: Partial<BusinessSettings> = activeRecord?.businessSnapshot || {
        businessName: settings.businessName,
        ownerName: settings.ownerName,
        tagline: settings.tagline,
        logoText: settings.logoText,
        logoUrl: settings.logoUrl,
        address: settings.address,
        city: settings.city,
        state: settings.state,
        pincode: settings.pincode,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        gstin: settings.gstin,
        panNumber: settings.panNumber,
        bankName: settings.bankName,
        accountHolderName: settings.accountHolderName,
        bankAccountNumber: settings.bankAccountNumber,
        bankIfsc: settings.bankIfsc,
        bankBranch: settings.bankBranch,
        upiId: settings.upiId,
        showBankDetailsOnInvoice: settings.showBankDetailsOnInvoice,
        termsAndConditions: settings.termsAndConditions,
        authorizedSignatoryName: settings.authorizedSignatoryName,
        authorizedSignatoryDesignation: settings.authorizedSignatoryDesignation,
        authorizedSignatoryText: settings.authorizedSignatoryText,
        showSignatureSection: settings.showSignatureSection,
        showBusinessLogo: settings.showBusinessLogo,
        showHsnSac: settings.showHsnSac,
        showGstBreakup: settings.showGstBreakup,
        showTermsAndConditions: settings.showTermsAndConditions,
      };

      const payload = {
        invoiceNumber: activeRecord ? activeRecord.invoiceNumber : (invoiceNumber || nextInvoiceNumber),
        date,
        dueDate: paymentStatus === 'Paid' ? date : dueDate,
        partyName: partyName.trim(),
        partyPhone: partyPhone.trim(),
        phone: partyPhone.trim(),
        partyAddress: partyAddress.trim(),
        address: partyAddress.trim(),
        partyGstin: partyGstin.trim(),
        gstin: partyGstin.trim(),
        items: finalItems,
        subtotal: summary.subtotal,
        totalDiscount: summary.totalDiscount,
        taxableAmount: summary.taxableAmount,
        taxMode,
        cgstTotal: summary.cgstTotal,
        sgstTotal: summary.sgstTotal,
        igstTotal: summary.igstTotal,
        grandTotal: summary.grandTotal,
        roundOff: summary.roundOff,
        paymentStatus,
        paymentMode,
        paidAmount: summary.advancePaid,
        balanceAmount: summary.balanceDue,
        paymentRef,
        transactionReference: paymentRef,
        isRcm,
        notes,
        vehicleNumber,
        vehicleOrDispatchNumber: vehicleNumber,
        bankDetails: defaultBankSnapshot,
        businessSnapshot: defaultBusinessSnapshot,
      };

      if (activeRecord) {
        // UPDATE EXISTING INVOICE IN PLACE (Never creates duplicate bill records)
        const updated = await updateInvoice(activeRecord.id, payload);
        const resulting: Invoice = updated || {
          ...payload,
          id: activeRecord.id,
          invoiceNumber: activeRecord.invoiceNumber,
          createdAt: activeRecord.createdAt,
        };
        setGeneratedInvoice(resulting);
        setInvoiceNumber(resulting.invoiceNumber);
        showToast(`Invoice ${activeRecord.invoiceNumber} updated in Bill Book!`, 'success');
      } else {
        // CREATE EXACTLY ONE NEW INVOICE
        const saved = await addInvoice(payload);
        setGeneratedInvoice(saved);
        setInvoiceNumber(saved.invoiceNumber);
        showToast(`Invoice ${saved.invoiceNumber} saved & recorded in Bill Book!`, 'success');
      }

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3B2921', '#8B5E3C', '#C99563', '#4F7D5A'],
        });
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.error('Error saving bill:', err);
      showToast(err.message || 'Failed to save bill to database. Please try again.', 'error');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    showToast(`Draft for ${partyName || 'Bill'} saved locally`, 'info');
  };

  const handleReset = () => {
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    setIsInvoiceUnlocked(false);
    setInvoiceNumber(nextInvoiceNumber);
    setPartyName('');
    setPartyPhone('');
    setPartyAddress('');
    setPartyGstin('');
    setSelectedPartyId('');
    setPartySearchTerm('');
    setIsPartyDropdownOpen(false);
    setVehicleNumber('');
    setNotes('');
    setPaymentStatus('Pending');
    setPaymentRef('');
    setPaidAdvanceAmount('');
    setErrors({});
    setGeneratedInvoice(null);
    setItems([
      {
        id: `item-${Date.now()}`,
        bagType: 'Gunny Bag',
        description: 'Standard Gunny Bag 50kg capacity',
        hsnCode: '630510',
        quantity: 500,
        unit: 'Bags',
        pricePerBag: 28.00,
        discountPercent: 0,
        gstRate: 5,
        amount: 14000,
        discountAmount: 0,
        taxableAmount: 14000,
        cgstAmount: 350,
        sgstAmount: 350,
        igstAmount: 0,
        totalAmount: 14700,
      }
    ]);
    showToast('Ready for new bill', 'info');
  };

  // Bag presets dynamically mapped from active product catalog
  const bagPresets = useMemo(() => {
    const active = products.filter(p => !p.isArchived);
    if (active.length > 0) {
      return active.map(p => ({
        id: p.id,
        type: p.bagType,
        name: p.name,
        label: `${p.name} (Stock: ${p.stock ?? 0})`,
        stock: p.stock ?? 0,
        gst: p.gstRate,
        price: p.defaultPrice ?? p.rate ?? 25,
        hsn: p.hsnCode || p.hsnSac || '630510',
        unit: p.unit || 'Bag',
      }));
    }
    return [
      { id: 'prod-1', type: 'Gunny Bag' as BagType, name: 'Gunny Bag', label: 'Gunny (5%)', gst: 5, price: 28.00, hsn: '630510', unit: 'Bag' },
      { id: 'prod-2', type: 'Jute Bag' as BagType, name: 'Jute Bag', label: 'Jute (5%)', gst: 5, price: 35.00, hsn: '630510', unit: 'Bag' },
      { id: 'prod-3', type: 'PP Bag' as BagType, name: 'PP Bag', label: 'PP Sacks (18%)', gst: 18, price: 25.00, hsn: '392329', unit: 'Bag' },
      { id: 'prod-4', type: 'HDPE Bag' as BagType, name: 'HDPE Bag', label: 'HDPE (18%)', gst: 18, price: 30.00, hsn: '392329', unit: 'Bag' },
      { id: 'prod-5', type: 'Plastic Bag' as BagType, name: 'Plastic Bag', label: 'Plastic (18%)', gst: 18, price: 10.00, hsn: '392321', unit: 'Bag' },
      { id: 'prod-6', type: 'Custom Bag' as BagType, name: 'Custom Bag', label: 'Custom (12%)', gst: 12, price: 42.00, hsn: '630590', unit: 'Bag' },
    ];
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#FFFDF8] p-5 rounded-2xl border border-[#E4D7C8] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#3B2921] text-[#C99563]">
              <Receipt size={20} />
            </span>
            <div>
              <h2 className="text-xl font-black text-[#3B2921]">
                {activeSavedInvoice ? `Edit Tax Invoice (${activeSavedInvoice.invoiceNumber})` : 'Create Tax Invoice'}
              </h2>
              <p className="text-xs text-[#8B5E3C]">
                {activeSavedInvoice 
                  ? `Modifying saved invoice issued to ${activeSavedInvoice.partyName} — invoice number remains ${activeSavedInvoice.invoiceNumber}`
                  : 'Enter order details on the left — invoice renders live on the right'}
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#8B5E3C] hover:text-[#3B2921] border border-[#E4D7C8] font-bold text-xs transition-colors"
            title={isSavedBill ? 'Cancel Edit & New Bill' : 'Reset Form'}
          >
            <RotateCcw size={14} />
            <span>{isSavedBill ? 'Cancel / New' : 'Reset'}</span>
          </button>

          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] border border-[#E4D7C8] font-bold text-xs transition-colors"
          >
            <Save size={14} className="text-[#8B5E3C]" />
            <span>Save Draft</span>
          </button>

          <button
            onClick={() => downloadInvoicePDF(generatedInvoice || liveInvoice, settings)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] border border-[#E4D7C8] font-bold text-xs transition-colors"
          >
            <Download size={14} className="text-[#8B5E3C]" />
            <span>PDF</span>
          </button>

          <button
            onClick={() => printInvoice()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] border border-[#E4D7C8] font-bold text-xs transition-colors"
          >
            <Printer size={14} className="text-[#8B5E3C]" />
            <span>Print</span>
          </button>

          <button
            onClick={handleGenerateInvoice}
            disabled={isSubmitting}
            data-testid="save-bill-button"
            title={activeSavedInvoice ? 'Update Bill in Database' : 'Save Bill to Database & Bill Book'}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-black text-xs md:text-sm shadow-sm transition-all active:scale-95 border border-[#3B2921] ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <CheckCircle2 size={16} className="text-[#C99563]" />
            <span>{isSubmitting ? 'Saving Bill...' : (activeSavedInvoice ? 'Update Bill' : 'Save Bill')}</span>
          </button>
        </div>
      </div>

      {/* Success Banner if Generated */}
      {generatedInvoice && (
        <div className="bg-[#4F7D5A]/15 border-2 border-[#4F7D5A] rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[#2C211B] animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4F7D5A] text-white flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <h4 className="font-bold text-base text-[#305439]">
                Invoice {generatedInvoice.invoiceNumber} {isEditing ? 'Updated' : 'Generated'} Successfully!
              </h4>
              <p className="text-xs text-[#4F7D5A] font-semibold mt-0.5">
                Total {formatINR(generatedInvoice.grandTotal)} recorded in Digital Bill Book for {generatedInvoice.partyName}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => downloadInvoicePDF(generatedInvoice, settings)}
              className="px-3 py-1.5 rounded-xl bg-white text-[#305439] border border-[#4F7D5A]/40 text-xs font-bold shadow-xs hover:bg-[#F7F3EA]"
            >
              Download PDF
            </button>
            <button
              onClick={() => printInvoice()}
              className="px-3 py-1.5 rounded-xl bg-white text-[#305439] border border-[#4F7D5A]/40 text-xs font-bold shadow-xs hover:bg-[#F7F3EA]"
            >
              Print
            </button>
            <button
              onClick={() => navigate('/bills')}
              className="px-3.5 py-1.5 rounded-xl bg-[#4F7D5A] text-white text-xs font-bold hover:bg-[#3d6346] flex items-center gap-1"
            >
              <span>View in Bill Book</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={handleReset}
              className="px-3.5 py-1.5 rounded-xl bg-[#3B2921] text-[#FFFDF8] text-xs font-bold hover:bg-[#4E372C] flex items-center gap-1"
            >
              <Plus size={14} />
              <span>+ New Bill</span>
            </button>
          </div>
        </div>
      )}

      {/* 2-Column Core Billing Workstation (Preserved layout) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Bill Creation Form (6 cols on xl) */}
        <div className="xl:col-span-6 space-y-6">
          {/* Card 1: Invoice Meta & Party Details */}
          <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4D7C8]">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-[#8B5E3C]" />
                <h3 className="font-bold text-base text-[#3B2921]">Party Details</h3>
              </div>
              <span className="text-xs font-mono font-bold text-[#3B2921] bg-[#F7F3EA] px-2.5 py-1 rounded-lg border border-[#E4D7C8]">
                {invoiceNumber}
              </span>
            </div>

            {/* Quick Party Search & Selector with Add New Party */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider">
                  Select Existing Party / Directory
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNewPartyForm({
                      name: '',
                      phone: '',
                      email: '',
                      address: '',
                      gstin: '',
                      state: '',
                      notes: '',
                    });
                    setNewPartyError('');
                    setIsAddPartyModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs shadow-2xs border border-[#3B2921] transition-all active:scale-95"
                >
                  <UserPlus size={13} className="text-[#C99563]" />
                  <span>+ Add New Party</span>
                </button>
              </div>

              {/* Searchable Combobox */}
              <div ref={partyPickerRef} className="relative">
                <div className="relative flex items-center">
                  <Search size={15} className="absolute left-3.5 text-[#8B5E3C] pointer-events-none" />
                  <input
                    type="text"
                    value={partySearchTerm}
                    onChange={e => {
                      setPartySearchTerm(e.target.value);
                      setIsPartyDropdownOpen(true);
                    }}
                    onFocus={() => setIsPartyDropdownOpen(true)}
                    placeholder={
                      selectedPartyId && partyName 
                        ? `Selected: ${partyName} (Search another party...)` 
                        : "Search party by name, phone or GSTIN..."
                    }
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] focus:border-[#3B2921] text-xs font-bold text-[#3B2921] outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPartyDropdownOpen(!isPartyDropdownOpen)}
                    className="absolute right-3 p-1 text-[#8B5E3C] hover:text-[#3B2921]"
                  >
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isPartyDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Dropdown Menu */}
                {isPartyDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#FFFDF8] border border-[#E4D7C8] rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-[#E4D7C8]/50">
                    <button
                      type="button"
                      onClick={handleClearSelectedParty}
                      className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-[#F7F3EA] flex items-center justify-between text-[#8B5E3C] transition-colors"
                    >
                      <span className="font-semibold">+ Counter Sale / Walk-in Customer (Manual Entry)</span>
                      <span className="text-[10px] bg-[#E4D7C8]/50 px-1.5 py-0.5 rounded text-[#3B2921]">Blank Form</span>
                    </button>

                    {filteredParties.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#8B5E3C]">
                        <p className="font-semibold">No parties matching "{partySearchTerm}"</p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsPartyDropdownOpen(false);
                            setNewPartyForm(prev => ({ ...prev, name: partySearchTerm }));
                            setIsAddPartyModalOpen(true);
                          }}
                          className="mt-2 text-xs font-bold text-[#3B2921] underline hover:text-[#8B5E3C]"
                        >
                          + Add "{partySearchTerm}" as New Party
                        </button>
                      </div>
                    ) : (
                      filteredParties.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectParty(p)}
                          className={`w-full px-3.5 py-2.5 text-left text-xs hover:bg-[#F7F3EA] transition-colors flex items-center justify-between ${
                            selectedPartyId === p.id ? 'bg-[#F7F3EA] font-bold text-[#3B2921]' : 'text-[#2C211B]'
                          }`}
                        >
                          <div>
                            <div className="font-bold flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {selectedPartyId === p.id && (
                                <span className="text-[10px] text-[#4F7D5A] bg-[#4F7D5A]/15 px-1.5 py-0.5 rounded font-bold">
                                  Current
                                </span>
                              )}
                              {p.isArchived && (
                                <span className="text-[9px] text-[#8B5E3C] bg-[#E4D7C8]/60 px-1 py-0.5 rounded">
                                  Archived
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#8B5E3C] mt-0.5 flex flex-wrap gap-2">
                              <span>📞 {p.phone || 'No phone'}</span>
                              {p.address && <span className="truncate max-w-[200px]">📍 {p.address}</span>}
                            </div>
                          </div>
                          {p.gstin && (
                            <span className="font-mono text-[10px] text-[#8B5E3C] bg-[#F7F3EA] px-2 py-0.5 rounded border border-[#E4D7C8]">
                              {p.gstin}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Auto-filled status banner */}
              {selectedPartyId && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#4F7D5A]/10 border border-[#4F7D5A]/30 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 text-[#305439] font-bold">
                    <UserCheck size={14} className="text-[#4F7D5A]" />
                    <span>Auto-filled from directory: {partyName}</span>
                    <span className="text-[10px] text-[#4F7D5A] font-medium hidden sm:inline">(editable below)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelectedParty}
                    className="text-[11px] text-[#8B5E3C] hover:text-[#B94A48] font-bold flex items-center gap-0.5"
                  >
                    <X size={12} />
                    <span>Clear / Manual</span>
                  </button>
                </div>
              )}
            </div>

            {/* Party Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Party Name <span className="text-[#B94A48]">*</span>
                </label>
                <input
                  type="text"
                  value={partyName}
                  onChange={e => {
                    setPartyName(e.target.value);
                    if (errors.partyName) setErrors({ ...errors, partyName: '' });
                  }}
                  placeholder="e.g. ABC Traders"
                  className={`w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border text-xs font-bold text-[#3B2921] outline-none ${
                    errors.partyName ? 'border-[#B94A48] ring-1 ring-[#B94A48]' : 'border-[#E4D7C8] focus:border-[#3B2921]'
                  }`}
                />
                {errors.partyName && (
                  <p className="text-[11px] text-[#B94A48] font-semibold mt-1">{errors.partyName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={partyPhone}
                  onChange={e => setPartyPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] focus:border-[#3B2921] text-xs font-bold text-[#3B2921] outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={partyAddress}
                  onChange={e => setPartyAddress(e.target.value)}
                  placeholder="e.g. Plot 42, Industrial Area, Phase II, Erode"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] focus:border-[#3B2921] text-xs font-medium text-[#3B2921] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Party GSTIN (Optional)
                </label>
                <input
                  type="text"
                  value={partyGstin}
                  onChange={e => setPartyGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 33AAACB2211C1Z4"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] focus:border-[#3B2921] text-xs font-mono font-bold text-[#3B2921] outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Vehicle / Dispatch No.
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. TN 33 AB 4590"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] focus:border-[#3B2921] text-xs font-mono font-bold text-[#3B2921] outline-none uppercase"
                />
              </div>
            </div>

            {/* Date and Invoice Number row */}
            <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-[#E4D7C8]">
              <div>
                <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Bill Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs font-bold text-[#3B2921] outline-none"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-[#8B5E3C] uppercase tracking-wider flex items-center gap-1.5">
                    <span>Invoice Number</span>
                    {isSavedBill ? (
                      <span className="text-[9px] bg-[#8B5E3C]/15 text-[#8B5E3C] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        Locked (Saved Bill)
                      </span>
                    ) : !isInvoiceUnlocked ? (
                      <span className="text-[9px] bg-[#4F7D5A]/15 text-[#4F7D5A] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        Auto-Seq
                      </span>
                    ) : null}
                  </label>
                  {!isSavedBill && (
                    <button
                      type="button"
                      onClick={() => setIsInvoiceUnlocked(prev => !prev)}
                      className="text-[10px] text-[#8B5E3C] hover:text-[#3B2921] font-semibold flex items-center gap-1 transition-colors"
                      title={isInvoiceUnlocked ? 'Lock to auto-sequence' : 'Edit invoice number manually'}
                    >
                      {isInvoiceUnlocked ? (
                        <>
                          <Lock size={10} />
                          <span>Lock (Auto)</span>
                        </>
                      ) : (
                        <>
                          <Unlock size={10} />
                          <span>Edit</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={invoiceNumber}
                    readOnly={isSavedBill || !isInvoiceUnlocked}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold outline-none transition-colors ${
                      isSavedBill || !isInvoiceUnlocked
                        ? 'bg-[#EAE2D2]/50 text-[#3B2921] border-[#E4D7C8] cursor-not-allowed select-all'
                        : 'bg-[#FFFDF8] text-[#3B2921] border-[#8B5E3C] ring-1 ring-[#8B5E3C]'
                    }`}
                  />
                  {(isSavedBill || !isInvoiceUnlocked) && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B5E3C] opacity-70">
                      <Lock size={12} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Bag / Product Section (IMPROVED Order Details with Smart Calculator integration) */}
          <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-[#E4D7C8]">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-[#8B5E3C]" />
                <h3 className="font-bold text-base text-[#3B2921]">Order Details (Bag Items)</h3>
                <span className="text-xs font-bold text-[#8B5E3C] bg-[#F7F3EA] px-2 py-0.5 rounded-full border border-[#E4D7C8]">
                  {items.length} {items.length === 1 ? 'Bag Type' : 'Bag Types'}
                </span>
              </div>

              {/* Bag Calculator Modal Trigger */}
              <button
                type="button"
                onClick={() => {
                  setBagCalcTargetIndex(0);
                  setIsBagCalcModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] border border-[#3B2921] shadow-2xs transition-all active:scale-95"
                title="Open wholesale bag calculator"
              >
                <Calculator size={14} className="text-[#C99563]" />
                <span>🧮 Bag Calculator</span>
              </button>
            </div>

            {/* Items List */}
            <div className="space-y-4">
              {items.map((item, index) => (
                <div 
                  key={item.id} 
                  className="p-4 rounded-xl transition-all bg-[#F7F3EA]/70 border border-[#E4D7C8] hover:border-[#C99563]"
                >
                  {/* Item Header with Row Actions */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E4D7C8]/70">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#3B2921] bg-[#FFFDF8] px-2 py-0.5 rounded border border-[#E4D7C8]">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-bold text-[#8B5E3C]">
                        {item.bagType}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Calculate for this row */}
                      <button
                        type="button"
                        onClick={() => {
                          setBagCalcTargetIndex(index);
                          setIsBagCalcModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all bg-[#FFFDF8] hover:bg-[#F7F3EA] text-[#8B5E3C] hover:text-[#3B2921] border-[#E4D7C8]"
                        title="Calculate with Bales / Multiplier for this bag"
                      >
                        <Calculator size={12} className="text-[#8B5E3C]" />
                        <span>Calculate</span>
                      </button>

                      {/* Duplicate row */}
                      <button
                        type="button"
                        onClick={() => handleDuplicateItem(index)}
                        className="p-1.5 rounded-lg text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 transition-colors"
                        title="Duplicate Bag Item"
                      >
                        <Copy size={13} />
                      </button>

                      {/* Remove row */}
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1.5 rounded-lg text-[#8B5E3C] hover:text-[#B94A48] hover:bg-[#B94A48]/10 transition-colors"
                          title="Remove Bag Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {bagPresets.map(preset => {
                      const isSelected = item.productId === preset.id || (!item.productId && item.bagType === preset.type);
                      return (
                        <button
                          key={preset.id || preset.type}
                          type="button"
                          onClick={() => {
                            if (preset.id) {
                              handleSelectProductForItem(index, preset.id);
                            } else {
                              handleItemChange(index, 'bagType', preset.type);
                              handleItemChange(index, 'pricePerBag', preset.price);
                              handleItemChange(index, 'gstRate', preset.gst);
                              handleItemChange(index, 'hsnCode', preset.hsn);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                            isSelected
                              ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921]'
                              : 'bg-[#FFFDF8] text-[#8B5E3C] border-[#E4D7C8] hover:border-[#C99563]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Item Primary Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Bag Type Dropdown */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                        Bag Product / Type
                      </label>
                      <select
                        value={item.productId || item.bagType}
                        onChange={e => {
                          const val = e.target.value;
                          const found = products.find(p => p.id === val);
                          if (found) {
                            handleSelectProductForItem(index, found.id);
                          } else {
                            handleItemChange(index, 'bagType', val as BagType);
                          }
                        }}
                        className="w-full px-2.5 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-bold text-[#3B2921] outline-none"
                      >
                        {products.filter(p => !p.isArchived).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{p.defaultPrice ?? p.rate} · Stock: {p.stock ?? 0})
                          </option>
                        ))}
                        {products.filter(p => !p.isArchived).length === 0 && (
                          <>
                            <option value="Gunny Bag">Gunny Bag</option>
                            <option value="Jute Bag">Jute Bag</option>
                            <option value="PP Bag">PP Bag</option>
                            <option value="Plastic Bag">Plastic Bag</option>
                            <option value="HDPE Bag">HDPE Bag</option>
                            <option value="Custom Bag">Custom Bag</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Quantity + Unit */}
                    <div className="sm:col-span-4 md:col-span-3">
                      <div className="flex justify-between items-baseline mb-1">
                        <label className="text-[11px] font-bold text-[#8B5E3C]">
                          Quantity
                        </label>
                        <span className="text-[10px] text-[#8B5E3C]/80 font-medium">Unit</span>
                      </div>
                      <div className="flex items-stretch rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] overflow-hidden focus-within:border-[#C99563]">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                          className="min-w-0 flex-1 px-2.5 py-2 text-xs font-mono font-bold text-[#3B2921] outline-none text-right"
                        />
                        <select
                          value={item.unit || 'Bags'}
                          onChange={e => handleItemChange(index, 'unit', e.target.value)}
                          className="shrink-0 min-w-[78px] px-2 py-2 bg-[#F7F3EA] border-l border-[#E4D7C8] text-[11px] font-bold text-[#8B5E3C] outline-none cursor-pointer"
                        >
                          <option value="Bags">Bags</option>
                          <option value="Bales">Bales</option>
                          <option value="Bundles">Bundles</option>
                          <option value="Pcs">Pcs</option>
                          <option value="Kgs">Kgs</option>
                        </select>
                      </div>
                      {(() => {
                        const matchedProd = products.find(p => 
                          (item.productId && (p.id === item.productId || (p as any)._id === item.productId)) ||
                          p.name.toLowerCase() === item.bagType.toLowerCase() ||
                          p.bagType.toLowerCase() === item.bagType.toLowerCase()
                        );
                        const curStock = matchedProd?.stock;
                        if (curStock !== undefined && curStock !== null) {
                          if (item.quantity > curStock) {
                            return (
                              <p className="text-[10px] font-bold text-[#B94A48] mt-1 flex items-center gap-1">
                                <AlertTriangle size={11} className="shrink-0" />
                                <span>Max available: {curStock}</span>
                              </p>
                            );
                          } else if (curStock <= 10) {
                            return (
                              <p className="text-[10px] font-bold text-[#854D0E] mt-1 flex items-center gap-1">
                                <AlertTriangle size={11} className="shrink-0" />
                                <span>Low stock: {curStock} left</span>
                              </p>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>

                    {/* Rate per Bag */}
                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                        Rate (₹/bag)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8B5E3C]">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.10"
                          value={item.pricePerBag}
                          onChange={e => handleItemChange(index, 'pricePerBag', parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none text-right"
                        />
                      </div>
                    </div>

                    {/* Discount % */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                        Disc %
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPercent}
                          onChange={e => handleItemChange(index, 'discountPercent', parseFloat(e.target.value) || 0)}
                          className="w-full pr-5 pl-2 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none text-right"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8B5E3C]">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Second row: Quick Increments, HSN, Configurable GST Rate, & Formula Breakdown */}
                  <div className="pt-2.5 mt-2 border-t border-[#E4D7C8]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left controls: Quick Qty, HSN, & GST */}
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                      {/* Quick quantity chips */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-[#8B5E3C] font-bold shrink-0">Quick Qty:</span>
                        <div className="flex items-center gap-1">
                          {[100, 500, 1000].map(add => (
                            <button
                              key={add}
                              type="button"
                              onClick={() => handleItemChange(index, 'quantity', (item.quantity || 0) + add)}
                              className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#FFFDF8] border border-[#E4D7C8] hover:border-[#C99563] text-[#8B5E3C] transition-colors"
                            >
                              +{add}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Visual separator on larger viewports */}
                      <div className="hidden md:block w-px h-4 bg-[#E4D7C8]" />

                      {/* HSN Input */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-[#8B5E3C] font-bold shrink-0">HSN:</span>
                        <input
                          type="text"
                          value={item.hsnCode}
                          onChange={e => handleItemChange(index, 'hsnCode', e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-[11px] font-mono font-medium text-[#3B2921] focus:border-[#C99563] outline-none"
                          placeholder="HSN"
                        />
                      </div>

                      {/* GST Dropdown */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-[#8B5E3C] font-bold shrink-0">GST:</span>
                        <select
                          value={item.gstRate}
                          onChange={e => handleItemChange(index, 'gstRate', parseFloat(e.target.value))}
                          className="min-w-[66px] px-2 py-1 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-[11px] font-bold text-[#3B2921] text-center cursor-pointer focus:border-[#C99563] outline-none"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>
                    </div>

                    {/* Right side: Interactive Real-Time Formula Outcome */}
                    <div className="self-end sm:self-auto shrink-0 bg-[#FFFDF8] px-3 py-1.5 rounded-xl border border-[#E4D7C8] text-right shadow-2xs">
                      <div className="text-[10px] text-[#8B5E3C] font-medium whitespace-nowrap">
                        {item.quantity} × ₹{item.pricePerBag.toFixed(2)}
                        {item.discountPercent > 0 ? ` -${item.discountPercent}%` : ''}
                        {` + ${item.gstRate}% GST`}
                      </div>
                      <div className="font-mono font-black text-xs text-[#3B2921] whitespace-nowrap">
                        = {formatINR(item.totalAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Another Bag CTA */}
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[#8B5E3C] hover:border-[#3B2921] bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus size={16} className="text-[#8B5E3C]" />
              <span>+ Add Another Bag</span>
            </button>
          </div>

          {/* Card 3: Taxation & Settlement (IMPROVED GST Calculation & Payment Status) */}
          <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4D7C8]">
              <h3 className="font-bold text-base text-[#3B2921]">Taxation & Settlement</h3>
              <span className="text-xs font-bold text-[#8B5E3C]">GST & Collections</span>
            </div>

            {/* GST Tax Mode & RCM Toggle */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-1.5">
                  GST Tax Mode
                </label>
                <div className="flex rounded-xl bg-[#F7F3EA] p-1 border border-[#E4D7C8]">
                  <button
                    type="button"
                    onClick={() => setTaxMode('CGST_SGST')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      taxMode === 'CGST_SGST' ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs' : 'text-[#8B5E3C]'
                    }`}
                  >
                    CGST + SGST (Intrastate)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxMode('IGST')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      taxMode === 'IGST' ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs' : 'text-[#8B5E3C]'
                    }`}
                  >
                    IGST (Interstate)
                  </button>
                </div>
              </div>

              {/* Reverse Charge Mechanism (RCM) & Round-off Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRcm}
                    onChange={e => setIsRcm(e.target.checked)}
                    className="w-4 h-4 rounded text-[#3B2921] accent-[#3B2921]"
                  />
                  <span className="text-xs font-bold text-[#3B2921]">Reverse Charge (RCM Applicable)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRoundOff}
                    onChange={e => setAutoRoundOff(e.target.checked)}
                    className="w-4 h-4 rounded text-[#3B2921] accent-[#3B2921]"
                  />
                  <span className="text-xs font-bold text-[#3B2921]">Auto Round Off to Nearest ₹1</span>
                </label>
              </div>

              {/* GST Rate Distribution Summary Table (If multi-rate) */}
              <div className="p-3 rounded-xl bg-[#F7F3EA]/70 border border-[#E4D7C8] space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#8B5E3C] pb-1 border-b border-[#E4D7C8]">
                  <span>GST Rate Split</span>
                  <span>Taxable Base & Tax Amount</span>
                </div>
                {Object.entries(summary.gstRateBreakdown).map(([rateStr, val]) => (
                  <div key={rateStr} className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold text-[#3B2921]">
                      {rateStr}% GST ({taxMode === 'IGST' ? `${rateStr}% IGST` : `${(Number(rateStr)/2).toFixed(1)}% CGST + ${(Number(rateStr)/2).toFixed(1)}% SGST`}):
                    </span>
                    <span className="font-mono text-[#8B5E3C]">
                      Base {formatINR(val.taxable)} &rarr; Tax {formatINR(taxMode === 'IGST' ? val.igst : val.cgst + val.sgst)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* IMPROVED PAYMENT STATUS SECTION */}
            <div className="pt-2 border-t border-[#E4D7C8] space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-1.5">
                  Payment Status
                </label>
                <div className="flex rounded-xl bg-[#F7F3EA] p-1 border border-[#E4D7C8]">
                  {(['Pending', 'Partial', 'Paid'] as PaymentStatus[]).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handlePaymentStatusChange(st)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        paymentStatus === st ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs' : 'text-[#8B5E3C]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Payment Mode & Details based on status */}
              {paymentStatus === 'Paid' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#4F7D5A]/10 border border-[#4F7D5A]/30 text-xs">
                    <span className="font-bold text-[#4F7D5A]">✓ Full payment received at billing</span>
                    <span className="font-mono font-black text-[#4F7D5A]">{formatINR(summary.grandTotal)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8]">
                    <div>
                      <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                        Payment Mode
                      </label>
                      <select
                        value={paymentMode}
                        onChange={e => setPaymentMode(e.target.value as PaymentMode)}
                        className="w-full px-2.5 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none"
                      >
                        {(settings.activePaymentModes && settings.activePaymentModes.length > 0 ? settings.activePaymentModes : ['Cash', 'UPI', 'Bank Transfer', 'Cheque']).map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                        Transaction Ref / Note
                      </label>
                      <input
                        type="text"
                        value={paymentRef}
                        onChange={e => setPaymentRef(e.target.value)}
                        placeholder="e.g. UTR102948 or Cash Receipt"
                        className="w-full px-2.5 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-medium text-[#3B2921] outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentStatus === 'Partial' && (
                <div className="p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] space-y-3">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-[#E4D7C8]">
                    <span className="text-[#8B5E3C]">Total Order Amount:</span>
                    <span className="font-mono font-bold text-[#3B2921]">{formatINR(summary.grandTotal)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#4F7D5A] mb-1">
                        Paid Amount (₹) <span className="text-[#B94A48]">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={summary.grandTotal}
                        value={paidAdvanceAmount}
                        onChange={e => {
                          setPaidAdvanceAmount(e.target.value === '' ? '' : parseFloat(e.target.value));
                          if (errors.paidAdvance) setErrors({ ...errors, paidAdvance: '' });
                        }}
                        placeholder="e.g. 5000"
                        className={`w-full px-2.5 py-2 rounded-xl bg-[#FFFDF8] border font-mono font-bold text-xs text-[#3B2921] outline-none ${
                          errors.paidAdvance ? 'border-[#B94A48] ring-1 ring-[#B94A48]' : 'border-[#E4D7C8]'
                        }`}
                      />
                      {errors.paidAdvance && (
                        <p className="text-[10px] text-[#B94A48] mt-1">{errors.paidAdvance}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                        Payment Mode
                      </label>
                      <select
                        value={paymentMode}
                        onChange={e => setPaymentMode(e.target.value as PaymentMode)}
                        className="w-full px-2.5 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none"
                      >
                        {(settings.activePaymentModes && settings.activePaymentModes.length > 0 ? settings.activePaymentModes : ['Cash', 'UPI', 'Bank Transfer', 'Cheque']).map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#B94A48] mb-1">
                        Balance Due (₹)
                      </label>
                      <div className="w-full px-2.5 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] font-mono font-black text-xs text-[#B94A48]">
                        {formatINR(summary.balanceDue)}
                      </div>
                    </div>
                  </div>

                  {/* Due date picker & credit terms for balance */}
                  <div className="pt-2 border-t border-[#E4D7C8]/70 space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
                      <span className="text-[11px] font-bold text-[#8B5E3C]">Credit Terms on Balance:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[7, 15, 30].map(days => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => handleCreditDays(days)}
                            className="px-2 py-0.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] hover:border-[#C99563] text-[10px] font-bold text-[#3B2921] transition-all"
                          >
                            +{days} Days
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                        Balance Due Date
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentStatus === 'Pending' && (
                <div className="p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] space-y-2.5">
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-[#E4D7C8]">
                    <span className="text-[#8B5E3C]">Total Balance Due:</span>
                    <span className="font-mono font-black text-sm text-[#B94A48]">{formatINR(summary.grandTotal)}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="text-[11px] font-bold text-[#8B5E3C]">Credit Terms:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[7, 15, 30].map(days => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => handleCreditDays(days)}
                          className="px-2.5 py-1 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] hover:border-[#C99563] text-[11px] font-bold text-[#3B2921] transition-all"
                        >
                          +{days} Days Credit
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                      Payment Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Terms / Remarks */}
            <div>
              <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                Notes & Terms (shown on invoice)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Payment terms, delivery lorry receipt details, or notes..."
                className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs font-medium text-[#2C211B] outline-none"
              />
            </div>
          </div>

          {/* Card 4: Dedicated BILL SUMMARY Section (Comprehensive breakdown before preview) */}
          <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border-2 border-[#E4D7C8] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4D7C8]">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-[#8B5E3C]" />
                <h3 className="font-bold text-base text-[#3B2921]">Bill Summary</h3>
              </div>
              <span className="text-xs font-bold font-mono text-[#8B5E3C]">
                {summary.totalQuantity.toLocaleString('en-IN')} Total Bags
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[#8B5E3C]">
                <span>Gross Items Subtotal:</span>
                <span className="font-mono font-semibold text-[#3B2921]">{formatINR(summary.subtotal)}</span>
              </div>

              {summary.totalDiscount > 0 && (
                <div className="flex justify-between text-[#B94A48]">
                  <span>Total Discount:</span>
                  <span className="font-mono font-semibold">-{formatINR(summary.totalDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between pt-1 border-t border-[#E4D7C8] text-[#3B2921] font-semibold">
                <span className="text-[#8B5E3C]">Taxable Value:</span>
                <span className="font-mono font-bold">{formatINR(summary.taxableAmount)}</span>
              </div>

              {/* Tax Split */}
              {taxMode === 'IGST' ? (
                <div className="flex justify-between text-[#8B5E3C]">
                  <span>IGST Output:</span>
                  <span className="font-mono font-semibold text-[#3B2921]">{formatINR(summary.igstTotal)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-[#8B5E3C]">
                    <span>CGST:</span>
                    <span className="font-mono font-semibold text-[#3B2921]">{formatINR(summary.cgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#8B5E3C]">
                    <span>SGST:</span>
                    <span className="font-mono font-semibold text-[#3B2921]">{formatINR(summary.sgstTotal)}</span>
                  </div>
                </>
              )}

              {summary.roundOff !== 0 && (
                <div className="flex justify-between text-[#8B5E3C]">
                  <span>Round Off:</span>
                  <span className="font-mono">{summary.roundOff > 0 ? `+${summary.roundOff.toFixed(2)}` : summary.roundOff.toFixed(2)}</span>
                </div>
              )}

              {/* Prominent Net Payable Box */}
              <div className="p-4 rounded-xl bg-[#3B2921] text-[#FFFDF8] mt-3 shadow-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-black uppercase tracking-wider text-[#C99563]">
                    GRAND TOTAL (NET PAYABLE)
                  </span>
                  <span className="text-2xl font-black font-mono text-[#FFFDF8]">
                    {formatINR(summary.grandTotal)}
                  </span>
                </div>

                {/* Partial Settlement details inside summary */}
                {paymentStatus === 'Partial' && (
                  <div className="pt-2 mt-2 border-t border-[#C99563]/30 flex justify-between text-xs text-[#C99563]">
                    <span>Advance: {formatINR(summary.advancePaid)}</span>
                    <span className="text-white font-bold">Balance Due: {formatINR(summary.balanceDue)}</span>
                  </div>
                )}
              </div>

              {/* Amount in Indian words preview */}
              <div className="p-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-[11px] text-[#8B5E3C]">
                <strong>In Words:</strong> {numberToWordsINR(summary.grandTotal)}
              </div>
            </div>

            {/* Bottom Actions Bar on Form */}
            <div className="pt-3 border-t border-[#E4D7C8] flex flex-col sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={() => downloadInvoicePDF(generatedInvoice || liveInvoice, settings)}
                className="px-4 py-2.5 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] font-bold text-xs border border-[#E4D7C8] transition-colors flex items-center justify-center gap-1.5"
              >
                <Download size={15} />
                <span>PDF Invoice</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateInvoice}
                disabled={isSubmitting}
                data-testid="save-bill-button-bottom"
                title={activeSavedInvoice ? 'Update Bill in Database' : 'Save Bill to Database & Bill Book'}
                className={`px-6 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-black text-xs md:text-sm shadow-sm transition-all active:scale-95 border border-[#3B2921] flex items-center justify-center gap-1.5 ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <CheckCircle2 size={16} className="text-[#C99563]" />
                <span>{isSubmitting ? 'Saving Bill...' : (activeSavedInvoice ? 'Update Bill' : 'Save Bill')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Invoice Preview (6 cols on xl, sticky) */}
        <div className="xl:col-span-6 xl:sticky xl:top-20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#8B5E3C]">
              <Sparkles size={14} className="text-[#C99563]" />
              <span>{generatedInvoice ? `TAX INVOICE — ${generatedInvoice.invoiceNumber}` : 'LIVE TAX INVOICE PREVIEW'}</span>
            </div>
            <span className="text-[11px] text-[#8B5E3C]">
              {generatedInvoice ? 'Generated & Saved to Bill Book' : 'Updates in real-time'}
            </span>
          </div>

          <InvoicePreview 
            invoice={generatedInvoice || liveInvoice} 
            settings={settings} 
          />
        </div>
      </div>

      {/* Wholesale Bag Calculator Modal */}
      <BagCalculatorModal
        isOpen={isBagCalcModalOpen}
        onClose={() => setIsBagCalcModalOpen(false)}
        items={items}
        targetIndex={bagCalcTargetIndex}
        taxMode={taxMode}
        onApply={handleApplyBagCalculator}
      />

      {/* Add New Party Modal */}
      {isAddPartyModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddPartyModalOpen(false)}
          title="Add New Customer / Party"
          subtitle="Record customer contact & billing details and auto-select for this bill"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateNewPartySubmit} className="space-y-4 text-xs">
            {newPartyError && (
              <div className="p-3 rounded-xl bg-[#B94A48]/10 border border-[#B94A48]/30 text-[#B94A48] font-bold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{newPartyError}</span>
              </div>
            )}

            {/* Party Name */}
            <div>
              <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                Party / Business Name <span className="text-[#B94A48]">*</span>
              </label>
              <input
                type="text"
                required
                value={newPartyForm.name}
                onChange={e => {
                  setNewPartyForm({ ...newPartyForm, name: e.target.value });
                  if (newPartyError) setNewPartyError('');
                }}
                placeholder="e.g. ABC Traders, Sri Venkatesh Stores"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
              />
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={newPartyForm.phone}
                  onChange={e => setNewPartyForm({ ...newPartyForm, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newPartyForm.email}
                  onChange={e => setNewPartyForm({ ...newPartyForm, email: e.target.value })}
                  placeholder="e.g. orders@abctraders.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-medium text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
                />
              </div>
            </div>

            {/* GSTIN & State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  GSTIN (Optional)
                </label>
                <input
                  type="text"
                  value={newPartyForm.gstin}
                  onChange={e => setNewPartyForm({ ...newPartyForm, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 33AAACB2211C1Z4"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none uppercase focus:border-[#3B2921]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  State / Place of Supply
                </label>
                <input
                  type="text"
                  value={newPartyForm.state}
                  onChange={e => setNewPartyForm({ ...newPartyForm, state: e.target.value })}
                  placeholder="e.g. Tamil Nadu, Karnataka"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                Address
              </label>
              <textarea
                rows={2}
                value={newPartyForm.address}
                onChange={e => setNewPartyForm({ ...newPartyForm, address: e.target.value })}
                placeholder="Shop address, Market Yard, Town, Pincode..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-medium text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                Notes / Special Terms
              </label>
              <textarea
                rows={2}
                value={newPartyForm.notes}
                onChange={e => setNewPartyForm({ ...newPartyForm, notes: e.target.value })}
                placeholder="Credit terms, transport preference, contact person notes..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-medium text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-[#E4D7C8] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAddPartyModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] font-bold text-xs border border-[#E4D7C8] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs shadow-sm transition-all active:scale-95 border border-[#3B2921]"
              >
                Save & Select Party
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
