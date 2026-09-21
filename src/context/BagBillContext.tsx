import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  Invoice, 
  InvoiceBankDetails,
  Party, 
  Product, 
  BusinessSettings, 
  TransferToBillPayload,
} from '../types';
import { 
  initialBusinessSettings, 
  initialParties, 
  initialProducts, 
  initialInvoices 
} from '../data/seedData';
import api from '../services/api';

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

interface BagBillContextType {
  invoices: Invoice[];
  parties: Party[];
  products: Product[];
  settings: BusinessSettings;
  transferBuffer: TransferToBillPayload | null;
  toasts: ToastInfo[];
  nextInvoiceNumber: string;
  isLoading: boolean;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Promise<Invoice>;
  updateInvoice: (id: string, updated: Partial<Invoice>) => Promise<Invoice | null>;
  recordPayment: (id: string, payment: {
    amount: number;
    date?: string;
    method?: string;
    reference?: string;
    notes?: string;
  }) => Promise<Invoice>;
  deleteInvoice: (id: string) => void;
  duplicateInvoice: (id: string) => Invoice | null;
  addParty: (party: Omit<Party, 'id' | 'totalPurchases' | 'paidAmount' | 'pendingAmount' | 'lastTransactionDate'>) => Party;
  updateParty: (id: string, updated: Partial<Party>) => void;
  deleteParty: (id: string) => void;
  archiveParty: (id: string, isArchived?: boolean) => void;
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, updated: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  archiveProduct: (id: string, isArchived?: boolean) => void;
  isProductUsedInInvoices: (productId: string, productName: string) => boolean;
  updateSettings: (newSettings: Partial<BusinessSettings>) => void;
  resetSettingsToDefaults: () => void;
  sendToBill: (item: TransferToBillPayload) => void;
  clearTransferBuffer: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  dismissToast: (id: string) => void;
  refreshFromBackend: () => Promise<void>;
}

const BagBillContext = createContext<BagBillContextType | undefined>(undefined);

const STORAGE_KEYS = {
  INVOICES: 'bagbill_invoices_v1',
  PARTIES: 'bagbill_parties_v1',
  PRODUCTS: 'bagbill_products_v1',
  SETTINGS: 'bagbill_settings_v1',
};

export function recalculatePartyStatsFromInvoices(party: Party, allInvoices: Invoice[]): Party {
  const normName = party.name.trim().toLowerCase();
  const cleanPhone = party.phone ? party.phone.replace(/\D/g, '') : '';

  const partyInvoices = allInvoices.filter(inv => {
    const invName = inv.partyName ? inv.partyName.trim().toLowerCase() : '';
    if (invName && invName === normName) return true;
    if (cleanPhone && inv.partyPhone) {
      const invPhone = inv.partyPhone.replace(/\D/g, '');
      if (invPhone && invPhone === cleanPhone) return true;
    }
    return false;
  });

  let totalPurchases = 0;
  let paidAmount = 0;
  let latestDate = party.lastTransactionDate || '';

  partyInvoices.forEach(inv => {
    const grand = inv.grandTotal || 0;
    totalPurchases += grand;
    if (inv.paymentStatus === 'Paid') {
      paidAmount += grand;
    } else if (inv.paymentStatus === 'Pending') {
      paidAmount += 0;
    } else if (inv.paymentStatus === 'Partial') {
      const bal = inv.balanceAmount !== undefined ? inv.balanceAmount : Math.max(0, grand - (inv.paidAmount || 0));
      paidAmount += (grand - bal);
    }
    if (inv.date && (!latestDate || inv.date > latestDate)) {
      latestDate = inv.date;
    }
  });

  const pendingAmount = Math.max(0, totalPurchases - paidAmount);

  return {
    ...party,
    totalPurchases,
    paidAmount,
    pendingAmount,
    lastTransactionDate: latestDate,
  };
}

export function sanitizeAndDeduplicateInvoices(rawInvoices: Invoice[]): { cleaned: Invoice[]; removedCount: number } {
  if (!rawInvoices || !Array.isArray(rawInvoices)) {
    return { cleaned: [], removedCount: 0 };
  }

  // Sort descending by invoice sequence number, then by creation date
  const sorted = [...rawInvoices].sort((a, b) => {
    const matchA = a.invoiceNumber?.match(/(\d+)$/);
    const matchB = b.invoiceNumber?.match(/(\d+)$/);
    if (matchA && matchB) {
      const diff = parseInt(matchB[1], 10) - parseInt(matchA[1], 10);
      if (diff !== 0) return diff;
    }
    const timeA = new Date(a.createdAt || a.date).getTime() || 0;
    const timeB = new Date(b.createdAt || b.date).getTime() || 0;
    return timeB - timeA;
  });

  const cleaned: Invoice[] = [];
  let removedCount = 0;

  for (const candidate of sorted) {
    const isDuplicate = cleaned.some(kept => {
      // 1. Exact ID match (both having same MongoDB _id or temporary id)
      const keptId = kept.id || (kept as any)._id;
      const candId = candidate.id || (candidate as any)._id;
      if (keptId && candId && String(keptId) === String(candId)) {
        return true;
      }

      // 2. Exact Invoice Number match (case-insensitive)
      if (kept.invoiceNumber && candidate.invoiceNumber &&
          kept.invoiceNumber.trim().toUpperCase() === candidate.invoiceNumber.trim().toUpperCase()) {
        return true;
      }

      // 3. Genuine rapid double-click race condition:
      // Same party, same date, same grandTotal, same items, AND timestamps within 5 seconds (< 5000ms),
      // where invoice numbers are identical or unassigned.
      // Note: Invoices with distinct sequence numbers (e.g. INV-00128 and INV-00129) are separate valid invoices and NEVER duplicates.
      const sameParty = kept.partyName?.trim().toLowerCase() === candidate.partyName?.trim().toLowerCase();
      const sameDate = kept.date === candidate.date;
      const sameTotal = Math.abs((kept.grandTotal || 0) - (candidate.grandTotal || 0)) < 0.01;
      const sameItems = kept.items?.length === candidate.items?.length;
      
      const timeKept = new Date(kept.createdAt || kept.date).getTime() || 0;
      const timeCand = new Date(candidate.createdAt || candidate.date).getTime() || 0;
      const isSubFiveSeconds = Math.abs(timeKept - timeCand) < 5000;

      if (sameParty && sameDate && sameTotal && sameItems && isSubFiveSeconds) {
        const numMatchKept = kept.invoiceNumber?.match(/(\d+)$/);
        const numMatchCand = candidate.invoiceNumber?.match(/(\d+)$/);
        // If neither has a distinct assigned number, or both have identical numbers
        if (!numMatchKept || !numMatchCand || numMatchKept[1] === numMatchCand[1]) {
          return true;
        }
      }

      return false;
    });

    if (isDuplicate) {
      console.warn(`[BagBill Deduplication] Removed accidental duplicate invoice ${candidate.invoiceNumber || candidate.id}`);
      removedCount++;
    } else {
      cleaned.push(candidate);
    }
  }

  cleaned.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date).getTime() || 0;
    const timeB = new Date(b.createdAt || b.date).getTime() || 0;
    return timeB - timeA;
  });

  return { cleaned, removedCount };
}

export const BagBillProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize from localStorage cache for zero-latency initial render
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.INVOICES);
    let list: Invoice[] = initialInvoices;
    if (saved) {
      try {
        list = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse invoices from storage', e);
      }
    }
    const { cleaned } = sanitizeAndDeduplicateInvoices(list);
    return cleaned;
  });

  const [parties, setParties] = useState<Party[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PARTIES);
    let rawParties: Party[] = initialParties;
    if (saved) {
      try {
        rawParties = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse parties from storage', e);
      }
    }
    return rawParties;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse products from storage', e);
      }
    }
    return initialProducts;
  });

  const [settings, setSettings] = useState<BusinessSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse settings from storage', e);
      }
    }
    return initialBusinessSettings;
  });

  const [transferBuffer, setTransferBuffer] = useState<TransferToBillPayload | null>(null);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const inFlightSavesRef = useRef<Set<string>>(new Set());

  // Function to refresh state directly from MongoDB backend APIs (memoized to prevent render-loop cascades)
  const refreshFromBackend = useCallback(async () => {
    try {
      const [backendSettings, backendParties, backendProducts, backendBills] = await Promise.all([
        api.settings.get().catch(err => {
          console.warn('[BagBill API] Settings fetch fallback to cache:', err.message);
          return null;
        }),
        api.parties.getAll().catch(err => {
          console.warn('[BagBill API] Parties fetch fallback to cache:', err.message);
          return null;
        }),
        api.products.getAll().catch(err => {
          console.warn('[BagBill API] Products fetch fallback to cache:', err.message);
          return null;
        }),
        api.bills.getAll().catch(err => {
          console.warn('[BagBill API] Bills fetch fallback to cache:', err.message);
          return null;
        }),
      ]);

      if (backendSettings) {
        setSettings(prev => ({ ...prev, ...backendSettings }));
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(backendSettings));
      }

      if (backendParties && Array.isArray(backendParties) && backendParties.length > 0) {
        setParties(backendParties);
        localStorage.setItem(STORAGE_KEYS.PARTIES, JSON.stringify(backendParties));
      }

      if (backendProducts && Array.isArray(backendProducts) && backendProducts.length > 0) {
        setProducts(backendProducts);
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(backendProducts));
      }

      if (backendBills && Array.isArray(backendBills) && backendBills.length > 0) {
        const { cleaned } = sanitizeAndDeduplicateInvoices(backendBills);
        setInvoices(cleaned);
        localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(cleaned));
      }
    } catch (error) {
      console.error('[BagBill API] Synchronization error with MongoDB:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Synchronize with MongoDB on mount
  useEffect(() => {
    refreshFromBackend();
  }, []);

  // Sync state changes to localStorage cache
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PARTIES, JSON.stringify(parties));
  }, [parties]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // Compute next invoice number
  const nextInvoiceNumber = React.useMemo(() => {
    const prefix = settings.invoicePrefix || 'INV-';
    const padding = settings.invoiceNumberPadding || 5;
    let highestNum = (settings.startingInvoiceNumber || 100) - 1;
    invoices.forEach(inv => {
      if (inv.invoiceNumber) {
        const match = inv.invoiceNumber.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > highestNum) {
            highestNum = num;
          }
        }
      }
    });
    const nextNum = Math.max(highestNum + 1, settings.startingInvoiceNumber || 1);
    return `${prefix}${String(nextNum).padStart(padding, '0')}`;
  }, [invoices, settings.invoicePrefix, settings.startingInvoiceNumber, settings.invoiceNumberPadding]);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addInvoice = async (invoiceData: Omit<Invoice, 'id' | 'createdAt'>): Promise<Invoice> => {
    const defaultBankSnapshot: InvoiceBankDetails = {
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

    const defaultBusinessSnapshot: Partial<BusinessSettings> = {
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

    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      bankDetails: invoiceData.bankDetails || defaultBankSnapshot,
      businessSnapshot: invoiceData.businessSnapshot || defaultBusinessSnapshot,
    };

    const saveKey = `${newInvoice.partyName}_${newInvoice.date}_${newInvoice.grandTotal}_${newInvoice.invoiceNumber || ''}`;
    if (inFlightSavesRef.current.has(saveKey)) {
      console.warn('[BagBill Deduplication] Blocked concurrent submission for in-flight bill:', saveKey);
      const existing = invoices.find(i => i.invoiceNumber && i.invoiceNumber === newInvoice.invoiceNumber);
      if (existing) return existing;
    }
    inFlightSavesRef.current.add(saveKey);

    let resultInvoice = newInvoice;

    // 1. Optimistic local state update
    setInvoices(prev => {
      const existingByNumberIndex = prev.findIndex(inv => 
        inv.invoiceNumber && newInvoice.invoiceNumber &&
        inv.invoiceNumber.trim().toUpperCase() === newInvoice.invoiceNumber.trim().toUpperCase()
      );

      if (existingByNumberIndex !== -1) {
        const existing = prev[existingByNumberIndex];
        resultInvoice = {
          ...existing,
          ...newInvoice,
          id: existing.id,
          invoiceNumber: existing.invoiceNumber,
          createdAt: existing.createdAt,
        };
        const updatedList = [...prev];
        updatedList[existingByNumberIndex] = resultInvoice;
        return updatedList;
      }

      // Check for rapid sub-5-second duplicate with identical party, date, total, items
      const rapidDuplicateIndex = prev.findIndex(inv => {
        const sameParty = inv.partyName.trim().toLowerCase() === newInvoice.partyName.trim().toLowerCase();
        const sameDate = inv.date === newInvoice.date;
        const sameTotal = Math.abs((inv.grandTotal || 0) - (newInvoice.grandTotal || 0)) < 0.01;
        const sameItems = inv.items.length === newInvoice.items.length;
        const timeDiff = Math.abs(Date.now() - new Date(inv.createdAt).getTime());
        return sameParty && sameDate && sameTotal && sameItems && timeDiff < 5000;
      });

      if (rapidDuplicateIndex !== -1) {
        resultInvoice = prev[rapidDuplicateIndex];
        return prev;
      }

      return [newInvoice, ...prev];
    });

    // 2. Persist to MongoDB backend and await persistence
    try {
      const savedBill = await api.bills.create(newInvoice);
      if (savedBill && (savedBill.id || (savedBill as any)._id)) {
        const realId = savedBill.id || (savedBill as any)._id;
        resultInvoice = { ...newInvoice, ...savedBill, id: realId };
        setInvoices(current => current.map(inv => 
          (inv.id === newInvoice.id || (inv.invoiceNumber && inv.invoiceNumber === resultInvoice.invoiceNumber)) 
            ? resultInvoice 
            : inv
        ));
      }
      // Refresh parties and products to fetch dynamic MongoDB stats & inventory stock
      api.parties.getAll().then(refreshedParties => {
        if (refreshedParties && refreshedParties.length > 0) {
          setParties(refreshedParties);
        }
      }).catch(() => {});
      api.products.getAll().then(refreshedProducts => {
        if (refreshedProducts && refreshedProducts.length > 0) {
          setProducts(refreshedProducts);
        }
      }).catch(() => {});
    } catch (err: any) {
      console.error('[BagBill API] Error persisting bill to MongoDB:', err);
      // Rollback optimistic addition if request completely failed
      setInvoices(current => current.filter(inv => inv.id !== newInvoice.id));
      throw new Error(err.message || 'Failed to save bill to database.');
    } finally {
      inFlightSavesRef.current.delete(saveKey);
    }

    // 3. Update starting sequence in settings locally
    const numMatch = resultInvoice.invoiceNumber?.match(/(\d+)$/);
    if (numMatch) {
      const invNumVal = parseInt(numMatch[1], 10);
      if (!isNaN(invNumVal)) {
        setSettings(prev => {
          const nextStart = Math.max(prev.startingInvoiceNumber || 0, invNumVal + 1);
          if (nextStart !== prev.startingInvoiceNumber) {
            return { ...prev, startingInvoiceNumber: nextStart };
          }
          return prev;
        });
      }
    }

    showToast(`Invoice ${resultInvoice.invoiceNumber} recorded successfully!`, 'success');
    return resultInvoice;
  };

  const updateInvoice = async (id: string, updated: Partial<Invoice>): Promise<Invoice | null> => {
    let updatedRecord: Invoice | null = null;

    setInvoices(prev => {
      return prev.map(inv => {
        if (inv.id === id || (inv as any)._id === id) {
          const safeUpdated = { ...updated };
          delete safeUpdated.invoiceNumber;
          delete safeUpdated.id;
          delete (safeUpdated as any)._id;
          delete safeUpdated.createdAt;
          updatedRecord = { ...inv, ...safeUpdated };
          return updatedRecord;
        }
        return inv;
      });
    });

    if (updatedRecord) {
      // Send PUT to MongoDB backend and await persistence
      try {
        const saved = await api.bills.update(id, updated);
        if (saved) {
          setInvoices(current => current.map(inv => (inv.id === id || (inv as any)._id === id) ? { ...inv, ...saved } : inv));
          updatedRecord = saved;
        }
        api.parties.getAll().then(refreshed => setParties(refreshed)).catch(() => {});
        api.products.getAll().then(refreshed => setProducts(refreshed)).catch(() => {});
        showToast('Invoice updated in MongoDB', 'info');
      } catch (err: any) {
        console.error('[BagBill API] Error updating invoice in MongoDB:', err);
        throw new Error(err.message || 'Failed to update bill in database.');
      }
    }

    return updatedRecord;
  };

  const recordPayment = async (id: string, payment: {
    amount: number;
    date?: string;
    method?: string;
    reference?: string;
    notes?: string;
  }): Promise<Invoice> => {
    try {
      const updatedBill = await api.bills.recordPayment(id, payment);
      if (updatedBill) {
        setInvoices(current => current.map(inv => 
          (inv.id === id || (inv as any)._id === id || (inv.invoiceNumber && inv.invoiceNumber === updatedBill.invoiceNumber))
            ? { ...inv, ...updatedBill }
            : inv
        ));
      }
      api.parties.getAll().then(refreshed => {
        if (refreshed && refreshed.length > 0) setParties(refreshed);
      }).catch(() => {});
      showToast(`Payment of ₹${payment.amount} recorded for ${updatedBill.invoiceNumber}!`, 'success');
      return updatedBill;
    } catch (err: any) {
      console.error('[BagBill API] Error recording payment:', err);
      showToast(err.message || 'Failed to record payment.', 'error');
      throw err;
    }
  };

  const deleteInvoice = (id: string) => {
    const target = invoices.find(i => i.id === id || (i as any)._id === id);
    setInvoices(prev => prev.filter(inv => inv.id !== id && (inv as any)._id !== id));

    // Send DELETE to MongoDB backend
    api.bills.delete(id)
      .then(() => {
        api.parties.getAll().then(refreshed => setParties(refreshed)).catch(() => {});
        api.products.getAll().then(refreshed => setProducts(refreshed)).catch(() => {});
      })
      .catch(err => {
        console.error('[BagBill API] Error deleting invoice in MongoDB:', err);
      });

    showToast(`Invoice ${target?.invoiceNumber || ''} deleted`, 'info');
  };

  const duplicateInvoice = (id: string): Invoice | null => {
    const original = invoices.find(i => i.id === id || (i as any)._id === id);
    if (!original) return null;

    const duplicated: Invoice = {
      ...original,
      id: `inv-${Date.now()}`,
      invoiceNumber: nextInvoiceNumber,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      paymentStatus: 'Pending',
    };

    setInvoices(prev => [duplicated, ...prev]);

    // Persist to MongoDB
    api.bills.create(duplicated)
      .then(saved => {
        if (saved && (saved.id || (saved as any)._id)) {
          const realId = saved.id || (saved as any)._id;
          setInvoices(current => current.map(inv => inv.id === duplicated.id ? { ...inv, ...saved, id: realId } : inv));
        }
        api.parties.getAll().then(refreshed => setParties(refreshed)).catch(() => {});
        api.products.getAll().then(refreshed => setProducts(refreshed)).catch(() => {});
      })
      .catch(err => {
        console.error('[BagBill API] Error persisting duplicated bill to MongoDB:', err);
      });

    showToast(`Invoice duplicated as ${duplicated.invoiceNumber}`, 'success');
    return duplicated;
  };

  const addParty = (partyData: Omit<Party, 'id' | 'totalPurchases' | 'paidAmount' | 'pendingAmount' | 'lastTransactionDate'>): Party => {
    const tempId = `party-${Date.now()}`;
    const newParty: Party = {
      ...partyData,
      id: tempId,
      totalPurchases: 0,
      paidAmount: 0,
      pendingAmount: 0,
      lastTransactionDate: new Date().toISOString().split('T')[0],
    };

    setParties(prev => [newParty, ...prev]);

    // Persist to MongoDB
    api.parties.create(partyData)
      .then(saved => {
        if (saved && (saved.id || (saved as any)._id)) {
          const realId = saved.id || (saved as any)._id;
          setParties(current => current.map(p => p.id === tempId ? { ...p, ...saved, id: realId } : p));
        }
      })
      .catch(err => {
        console.error('[BagBill API] Error adding party to MongoDB:', err);
      });

    showToast(`Party ${newParty.name} added`, 'success');
    return newParty;
  };

  const updateParty = (id: string, updated: Partial<Party>) => {
    setParties(prev => prev.map(p => (p.id === id || (p as any)._id === id) ? { ...p, ...updated } : p));

    // Send PUT to MongoDB
    api.parties.update(id, updated)
      .catch(err => {
        console.error('[BagBill API] Error updating party in MongoDB:', err);
      });

    showToast('Party details updated', 'info');
  };

  const deleteParty = (id: string) => {
    const target = parties.find(p => p.id === id || (p as any)._id === id);
    setParties(prev => prev.filter(p => p.id !== id && (p as any)._id !== id));

    // Send DELETE to MongoDB (permanent = true)
    api.parties.delete(id, true)
      .catch(err => {
        console.error('[BagBill API] Error deleting party in MongoDB:', err);
      });

    showToast(`Party ${target?.name || ''} removed`, 'info');
  };

  const archiveParty = (id: string, isArchived: boolean = true) => {
    setParties(prev => prev.map(p => (p.id === id || (p as any)._id === id) ? { ...p, isArchived } : p));

    // Send PUT to MongoDB
    api.parties.update(id, { isArchived })
      .catch(err => {
        console.error('[BagBill API] Error archiving party in MongoDB:', err);
      });

    showToast(isArchived ? 'Party archived' : 'Party restored from archive', 'info');
  };

  const addProduct = (productData: Omit<Product, 'id'>): Product => {
    const tempId = `prod-${Date.now()}`;
    const newProd: Product = {
      ...productData,
      id: tempId,
      unit: productData.unit || 'Bag',
      stock: productData.stock !== undefined ? productData.stock : 0,
      isArchived: Boolean(productData.isArchived),
    };

    setProducts(prev => [newProd, ...prev]);

    // Persist to MongoDB
    api.products.create(productData)
      .then(saved => {
        if (saved && (saved.id || (saved as any)._id)) {
          const realId = saved.id || (saved as any)._id;
          setProducts(current => current.map(p => p.id === tempId ? { ...p, ...saved, id: realId } : p));
        }
      })
      .catch(err => {
        console.error('[BagBill API] Error adding product to MongoDB:', err);
      });

    showToast(`Product ${newProd.name} added`, 'success');
    return newProd;
  };

  const updateProduct = (id: string, updated: Partial<Product>) => {
    setProducts(prev => prev.map(p => (p.id === id || (p as any)._id === id) ? { ...p, ...updated } : p));

    // Send PUT to MongoDB
    api.products.update(id, updated)
      .catch(err => {
        console.error('[BagBill API] Error updating product in MongoDB:', err);
      });

    showToast('Product updated', 'info');
  };

  const archiveProduct = (id: string, isArchived: boolean = true) => {
    setProducts(prev => prev.map(p => (p.id === id || (p as any)._id === id) ? { ...p, isArchived } : p));

    // Send PUT to MongoDB
    api.products.update(id, { isArchived })
      .catch(err => {
        console.error('[BagBill API] Error archiving product in MongoDB:', err);
      });

    showToast(isArchived ? 'Product archived' : 'Product restored from archive', 'info');
  };

  const isProductUsedInInvoices = (productId: string, productName: string): boolean => {
    const normName = productName.trim().toLowerCase();
    return invoices.some(inv => 
      inv.items.some(it => 
        (it.productId && (it.productId === productId || (it as any)._id === productId)) ||
        (it.productName && it.productName.trim().toLowerCase() === normName) ||
        (it.bagType && it.bagType.trim().toLowerCase() === normName)
      )
    );
  };

  const deleteProduct = (id: string) => {
    const target = products.find(p => p.id === id || (p as any)._id === id);
    if (!target) return;
    
    if (isProductUsedInInvoices(target.id, target.name)) {
      showToast(`Cannot delete "${target.name}" because it is referenced in recorded invoices. Please archive it instead.`, 'error');
      return;
    }

    setProducts(prev => prev.filter(p => p.id !== id && (p as any)._id !== id));

    // Send DELETE to MongoDB (permanent = true)
    api.products.delete(id, true)
      .catch(err => {
        console.error('[BagBill API] Error deleting product in MongoDB:', err);
      });

    showToast(`Product ${target.name} deleted`, 'info');
  };

  const updateSettings = (newSettings: Partial<BusinessSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));

    // Send PUT to MongoDB
    api.settings.update(newSettings)
      .catch(err => {
        console.error('[BagBill API] Error saving settings in MongoDB:', err);
      });

    showToast('Business settings saved to MongoDB', 'success');
  };

  const resetSettingsToDefaults = () => {
    setSettings(initialBusinessSettings);

    // Send PUT to MongoDB
    api.settings.update(initialBusinessSettings)
      .catch(err => {
        console.error('[BagBill API] Error resetting settings in MongoDB:', err);
      });

    showToast('Settings reset to defaults', 'info');
  };

  const sendToBill = (item: TransferToBillPayload) => {
    setTransferBuffer(item);
  };

  const clearTransferBuffer = () => {
    setTransferBuffer(null);
  };

  return (
    <BagBillContext.Provider
      value={{
        invoices,
        parties,
        products,
        settings,
        transferBuffer,
        toasts,
        nextInvoiceNumber,
        isLoading,
        addInvoice,
        updateInvoice,
        recordPayment,
        deleteInvoice,
        duplicateInvoice,
        addParty,
        updateParty,
        deleteParty,
        archiveParty,
        addProduct,
        updateProduct,
        deleteProduct,
        archiveProduct,
        isProductUsedInInvoices,
        updateSettings,
        resetSettingsToDefaults,
        sendToBill,
        clearTransferBuffer,
        showToast,
        dismissToast,
        refreshFromBackend,
      }}
    >
      {children}
    </BagBillContext.Provider>
  );
};

export const useBagBill = (): BagBillContextType => {
  const context = useContext(BagBillContext);
  if (!context) {
    throw new Error('useBagBill must be used within a BagBillProvider');
  }
  return context;
};
