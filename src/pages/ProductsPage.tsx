import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Tag, 
  Layers, 
  Edit2, 
  Trash2, 
  Archive, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Grid, 
  List, 
  ShieldAlert, 
  X,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBagBill } from '../context/BagBillContext';
import { Product, BagType } from '../types';
import { formatINR } from '../utils/formatters';
import { Modal } from '../components/common/Modal';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    products, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    archiveProduct,
    isProductUsedInInvoices,
    sendToBill,
    showToast 
  } = useBagBill();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formBagType, setFormBagType] = useState<BagType>('Gunny Bag');
  const [formCategory, setFormCategory] = useState<string>('Gunny');
  const [formPrice, setFormPrice] = useState<number | ''>(28);
  const [formStock, setFormStock] = useState<number | ''>(100);
  const [formHsn, setFormHsn] = useState('630510');
  const [formGstRate, setFormGstRate] = useState<number>(5);
  const [formDescription, setFormDescription] = useState('');
  const [formUnit, setFormUnit] = useState('Bag');
  const [formIsArchived, setFormIsArchived] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Bag Categories available
  const availableCategories = ['Gunny', 'Jute', 'PP', 'HDPE', 'Plastic', 'Custom'];

  // Calculate Metrics
  const activeProducts = useMemo(() => products.filter(p => !p.isArchived), [products]);
  const archivedProducts = useMemo(() => products.filter(p => p.isArchived), [products]);
  const lowStockProducts = useMemo(() => activeProducts.filter(p => (p.stock ?? 0) <= 10), [activeProducts]);
  
  const averageRate = useMemo(() => {
    if (activeProducts.length === 0) return 0;
    const total = activeProducts.reduce((sum, p) => sum + (p.defaultPrice || p.rate || 0), 0);
    return total / activeProducts.length;
  }, [activeProducts]);

  // Stock Badge Render Helper
  const renderStockBadge = (stock: number = 0, unit: string = 'Bag') => {
    if (stock <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9B1C1C]" /> Out of Stock (0)
        </span>
      );
    }
    if (stock <= 10) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF08A] text-[#854D0E] border border-[#FDE047]">
          <AlertCircle size={10} /> Low Stock ({stock})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" /> {stock} {unit}s
      </span>
    );
  };

  // Form Handlers
  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormBagType('Gunny Bag');
    setFormCategory('Gunny');
    setFormPrice(28);
    setFormStock(100);
    setFormHsn('630510');
    setFormGstRate(5);
    setFormDescription('');
    setFormUnit('Bag');
    setFormIsArchived(false);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormBagType(prod.bagType);
    setFormCategory(prod.category || prod.bagType.replace(' Bag', ''));
    setFormPrice(prod.defaultPrice ?? prod.rate ?? 0);
    setFormStock(prod.stock !== undefined && prod.stock !== null ? prod.stock : 0);
    setFormHsn(prod.hsnCode || prod.hsnSac || '');
    setFormGstRate(prod.gstRate);
    setFormDescription(prod.description || '');
    setFormUnit(prod.unit || 'Bag');
    setFormIsArchived(Boolean(prod.isArchived));
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Product / Bag name is required.');
      return;
    }

    if (formPrice === '' || formPrice < 0) {
      setFormError('Please enter a valid rate (₹ >= 0).');
      return;
    }

    if (formStock === '' || Number(formStock) < 0 || isNaN(Number(formStock))) {
      setFormError('Please enter a valid stock quantity (>= 0).');
      return;
    }

    if (formGstRate < 0) {
      setFormError('Please select a valid GST rate.');
      return;
    }

    // Check for duplicate active names
    const duplicate = products.find(p => 
      p.name.toLowerCase() === cleanName.toLowerCase() && 
      p.id !== editingProduct?.id &&
      !p.isArchived
    );
    if (duplicate && !formIsArchived) {
      setFormError(`An active product named "${cleanName}" already exists.`);
      return;
    }

    const priceNum = typeof formPrice === 'number' ? formPrice : parseFloat(formPrice);
    const stockNum = typeof formStock === 'number' ? formStock : parseInt(formStock, 10);

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name: cleanName,
        bagType: formBagType,
        category: formCategory,
        defaultPrice: priceNum,
        rate: priceNum,
        stock: stockNum,
        hsnCode: formHsn.trim(),
        hsnSac: formHsn.trim(),
        gstRate: formGstRate,
        description: formDescription.trim(),
        unit: formUnit.trim() || 'Bag',
        isArchived: formIsArchived,
      });
      showToast(`Updated "${cleanName}". Note: Existing invoices remain strictly unchanged.`, 'info');
    } else {
      addProduct({
        name: cleanName,
        bagType: formBagType,
        category: formCategory,
        defaultPrice: priceNum,
        rate: priceNum,
        stock: stockNum,
        hsnCode: formHsn.trim(),
        hsnSac: formHsn.trim(),
        gstRate: formGstRate,
        description: formDescription.trim(),
        unit: formUnit.trim() || 'Bag',
        isArchived: formIsArchived,
      });
      showToast(`Added new product "${cleanName}"`, 'success');
    }

    setIsModalOpen(false);
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Status Filter
      if (statusFilter === 'active' && p.isArchived) return false;
      if (statusFilter === 'archived' && !p.isArchived) return false;

      // Category Filter
      if (selectedCategory !== 'All') {
        const cat = p.category || p.bagType.replace(' Bag', '');
        if (cat.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesType = p.bagType.toLowerCase().includes(term);
        const matchesCat = (p.category || '').toLowerCase().includes(term);
        const matchesHsn = (p.hsnCode || '').includes(term) || (p.hsnSac || '').includes(term);
        return matchesName || matchesType || matchesCat || matchesHsn;
      }

      return true;
    });
  }, [products, statusFilter, selectedCategory, searchTerm]);



  // Quick Action: Send to Create Bill
  const handleCreateBillWithProduct = (prod: Product) => {
    sendToBill({
      bagType: prod.bagType,
      quantity: 500,
      pricePerBag: prod.defaultPrice ?? prod.rate ?? 25,
      gstRate: prod.gstRate,
      unit: prod.unit || 'Bag',
      note: `${prod.name} (HSN: ${prod.hsnCode || prod.hsnSac || ''})`
    });
    showToast(`Prepared bill with ${prod.name}`, 'info');
    navigate('/create-bill');
  };

  // Safety Delete / Archive Check
  const handleDeleteClick = (prod: Product) => {
    setDeleteConfirmProduct(prod);
  };

  const executeDeleteOrArchive = () => {
    if (!deleteConfirmProduct) return;
    const isUsed = isProductUsedInInvoices(deleteConfirmProduct.id, deleteConfirmProduct.name);
    if (isUsed) {
      // Archive instead of delete to keep past bills valid
      archiveProduct(deleteConfirmProduct.id, true);
      showToast(`Archived "${deleteConfirmProduct.name}" to protect historical invoices.`, 'info');
    } else {
      deleteProduct(deleteConfirmProduct.id);
      showToast(`Deleted "${deleteConfirmProduct.name}".`, 'info');
    }
    setDeleteConfirmProduct(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-[#FFFDF8] p-5 sm:p-6 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-[#3B2921] text-[#C99563] shadow-xs">
            <ShoppingBag size={22} />
          </span>
          <div>
            <h2 className="text-xl font-black text-[#3B2921]">Products & Bag Types</h2>
            <p className="text-xs text-[#8B5E3C]">
              Manage commercial bag inventory, default rates, GST tax brackets, and HSN codes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={openAddModal}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs md:text-sm shadow-sm transition-all active:scale-95"
          >
            <Plus size={16} className="text-[#C99563]" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#F7F3EA] text-[#3B2921] border border-[#E4D7C8]">
            <ShoppingBag size={18} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider block">
              Total Products
            </span>
            <span className="text-lg font-black text-[#3B2921]">
              {products.length} <span className="text-xs font-normal text-[#8B5E3C]">types</span>
            </span>
          </div>
        </div>

        <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider block">
              Active Bags
            </span>
            <span className="text-lg font-black text-[#137333]">
              {activeProducts.length} <span className="text-xs font-normal text-[#8B5E3C]">ready</span>
            </span>
          </div>
        </div>

        <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#F7F3EA] text-[#C99563] border border-[#E4D7C8]">
            <Tag size={18} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider block">
              Average Rate
            </span>
            <span className="text-lg font-black font-mono text-[#3B2921]">
              {formatINR(averageRate)}
            </span>
          </div>
        </div>

        <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#F7F3EA] text-[#8B5E3C] border border-[#E4D7C8]">
            <Layers size={18} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#8B5E3C] uppercase tracking-wider block">
              Archived Bags
            </span>
            <span className="text-lg font-black text-[#8B5E3C]">
              {archivedProducts.length} <span className="text-xs font-normal text-[#8B5E3C]">hidden</span>
            </span>
          </div>
        </div>
      </div>

      {/* Low Stock Warning Banner if any active items need restocking */}
      {lowStockProducts.length > 0 && (
        <div className="bg-[#FEF08A]/30 border border-[#FDE047] p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 text-xs text-[#854D0E] shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#FEF08A] text-[#854D0E] shrink-0">
              <AlertCircle size={18} />
            </span>
            <div>
              <span className="font-bold block text-sm text-[#713F12]">
                Low Stock Alert: {lowStockProducts.length} {lowStockProducts.length === 1 ? 'bag type needs' : 'bag types need'} restocking!
              </span>
              <span className="text-[11px] text-[#854D0E]">
                {lowStockProducts.map(p => `${p.name} (${p.stock ?? 0} left)`).join(', ')}
              </span>
            </div>
          </div>
          <button
            onClick={() => setSearchTerm(lowStockProducts[0]?.name || '')}
            className="px-3.5 py-1.5 rounded-xl bg-[#854D0E] text-[#FFFDF8] font-bold text-[11px] shrink-0 hover:bg-[#713F12] transition-colors"
          >
            Review Items
          </button>
        </div>
      )}

      {/* Search, Category Filter, Status Tabs & View Mode */}
      <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E4D7C8] shadow-xs flex flex-col gap-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B5E3C]" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by product name, category, or HSN/SAC code..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] focus:border-[#3B2921] text-xs font-medium text-[#2C211B] outline-none transition-colors placeholder:text-[#8B5E3C]/60"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B5E3C] hover:text-[#3B2921]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[170px]">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] text-xs font-bold text-[#3B2921] outline-none cursor-pointer"
              >
                <option value="All">All Categories</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat} Bags</option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-[#F7F3EA] p-1 rounded-xl border border-[#E4D7C8]">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table' ? 'bg-[#3B2921] text-[#FFFDF8]' : 'text-[#8B5E3C] hover:text-[#3B2921]'
                }`}
                title="Table View"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'cards' ? 'bg-[#3B2921] text-[#FFFDF8]' : 'text-[#8B5E3C] hover:text-[#3B2921]'
                }`}
                title="Card View"
              >
                <Grid size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Status Tabs Bar */}
        <div className="flex items-center justify-between border-t border-[#E4D7C8]/70 pt-3">
          <div className="flex gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'active'
                  ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                  : 'bg-[#F7F3EA] text-[#8B5E3C] hover:bg-[#EAE2D2]'
              }`}
            >
              Active ({activeProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'archived'
                  ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                  : 'bg-[#F7F3EA] text-[#8B5E3C] hover:bg-[#EAE2D2]'
              }`}
            >
              Archived ({archivedProducts.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                  : 'bg-[#F7F3EA] text-[#8B5E3C] hover:bg-[#EAE2D2]'
              }`}
            >
              All ({products.length})
            </button>
          </div>

          <span className="text-[11px] text-[#8B5E3C] font-medium hidden sm:inline">
            Showing {filteredProducts.length} of {products.length} products
          </span>
        </div>
      </div>

      {/* Product Content: Table or Cards */}
      {filteredProducts.length === 0 ? (
        <div className="bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F7F3EA] text-[#8B5E3C] flex items-center justify-center mx-auto">
            <ShoppingBag size={24} />
          </div>
          <h3 className="font-bold text-base text-[#3B2921]">No Products Found</h3>
          <p className="text-xs text-[#8B5E3C] max-w-sm mx-auto">
            {searchTerm || selectedCategory !== 'All' 
              ? 'No bag types match your current search or category filter.'
              : 'Your product catalog is empty. Click "+ Add Product" to create your first bag type.'}
          </p>
          {(searchTerm || selectedCategory !== 'All') && (
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
              className="px-4 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] text-xs font-bold transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Table View (Desktop & Responsive) */
        <div className="bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F3EA] border-b border-[#E4D7C8] text-[#8B5E3C] font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Product / Bag Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Default Rate</th>
                  <th className="py-3 px-4 text-center">GST Rate</th>
                  <th className="py-3 px-4 text-center">Current Stock</th>
                  <th className="py-3 px-4">HSN/SAC</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4D7C8]/70">
                {filteredProducts.map(prod => {
                  const isArchived = Boolean(prod.isArchived);
                  const rate = prod.defaultPrice ?? prod.rate ?? 0;
                  const hsn = prod.hsnCode || prod.hsnSac || '630510';
                  const cat = prod.category || prod.bagType.replace(' Bag', '');

                  return (
                    <tr 
                      key={prod.id} 
                      className={`hover:bg-[#F7F3EA]/50 transition-colors ${
                        isArchived ? 'opacity-65 bg-[#FAF7F0]' : ''
                      }`}
                    >
                      {/* Product Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-[#F7F3EA] text-[#3B2921] border border-[#E4D7C8] shrink-0">
                            <ShoppingBag size={15} />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-[#3B2921] block leading-tight">
                              {prod.name}
                            </span>
                            {prod.description && (
                              <span className="text-[11px] text-[#8B5E3C] line-clamp-1 max-w-xs block">
                                {prod.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#C99563]/15 text-[#3B2921] border border-[#C99563]/30">
                          {cat}
                        </span>
                      </td>

                      {/* Default Rate */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-[#3B2921]">
                        {formatINR(rate)}
                        <span className="text-[10px] text-[#8B5E3C] font-normal block">
                          per {prod.unit || 'Bag'}
                        </span>
                      </td>

                      {/* GST Rate */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-[#F7F3EA] text-[#3B2921] border border-[#E4D7C8]">
                          {prod.gstRate}%
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-4 text-center">
                        {renderStockBadge(prod.stock ?? 0, prod.unit || 'Bag')}
                      </td>

                      {/* HSN/SAC */}
                      <td className="py-3.5 px-4 font-mono text-xs text-[#3B2921]">
                        {hsn}
                      </td>

                      {/* Unit */}
                      <td className="py-3.5 px-4 text-[#8B5E3C] font-semibold text-xs">
                        {prod.unit || 'Bag'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isArchived ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAE2D2] text-[#8B5E3C]">
                            <Archive size={10} /> Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F4EA] text-[#137333]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" /> Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Create Bill with this Bag */}
                          <button
                            type="button"
                            onClick={() => handleCreateBillWithProduct(prod)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-[11px] transition-all flex items-center gap-1 shadow-xs active:scale-95"
                            title="Create invoice with this bag"
                          >
                            <span>+ Bill</span>
                          </button>

                          {/* Edit Product */}
                          <button
                            type="button"
                            onClick={() => openEditModal(prod)}
                            className="p-1.5 rounded-lg text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Archive / Restore Toggle */}
                          <button
                            type="button"
                            onClick={() => archiveProduct(prod.id, !isArchived)}
                            className="p-1.5 rounded-lg text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 transition-colors"
                            title={isArchived ? 'Restore to Active' : 'Archive Product'}
                          >
                            {isArchived ? <RotateCcw size={14} /> : <Archive size={14} />}
                          </button>

                          {/* Delete Product with protective safety */}
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(prod)}
                            className="p-1.5 rounded-lg text-[#8B5E3C] hover:text-[#B94A48] hover:bg-[#B94A48]/10 transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View (Responsive Grid) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map(prod => {
            const isArchived = Boolean(prod.isArchived);
            const rate = prod.defaultPrice ?? prod.rate ?? 0;
            const hsn = prod.hsnCode || prod.hsnSac || '630510';
            const cat = prod.category || prod.bagType.replace(' Bag', '');

            return (
              <div
                key={prod.id}
                className={`bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] p-5 shadow-xs transition-all flex flex-col justify-between ${
                  isArchived ? 'opacity-70 bg-[#FAF7F0]' : 'hover:border-[#C99563]'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#E4D7C8]/70">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#C99563]/20 text-[#3B2921] border border-[#C99563]/30">
                          {cat}
                        </span>
                        {isArchived && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#EAE2D2] text-[#8B5E3C]">
                            Archived
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-base text-[#3B2921] leading-tight">
                        {prod.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(prod)}
                        className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                        title="Edit Product"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => archiveProduct(prod.id, !isArchived)}
                        className="p-1.5 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#E4D7C8]/40 rounded-lg transition-colors"
                        title={isArchived ? 'Restore' : 'Archive'}
                      >
                        {isArchived ? <RotateCcw size={14} /> : <Archive size={14} />}
                      </button>
                      <button
                        onClick={() => handleDeleteClick(prod)}
                        className="p-1.5 text-[#8B5E3C] hover:text-[#B94A48] hover:bg-[#B94A48]/10 rounded-lg transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#8B5E3C] py-2.5 min-h-[44px] leading-relaxed line-clamp-2">
                    {prod.description || 'Standard commercial wholesale packaging bags.'}
                  </p>

                  {/* Pricing & GST Badge */}
                  <div className="p-3 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] space-y-1.5 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#8B5E3C] font-semibold">Default Rate:</span>
                      <span className="font-mono font-black text-base text-[#3B2921]">
                        {formatINR(rate)} <span className="text-[10px] text-[#8B5E3C] font-normal">/{prod.unit || 'Bag'}</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#8B5E3C]">
                      <span>HSN/SAC Code:</span>
                      <span className="font-mono font-bold text-[#3B2921]">{hsn}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#8B5E3C]">
                      <span>GST Bracket:</span>
                      <span className="font-mono font-bold text-[#3B2921]">{prod.gstRate}%</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-[#8B5E3C] pt-0.5">
                      <span>Available Stock:</span>
                      <div>{renderStockBadge(prod.stock ?? 0, prod.unit || 'Bag')}</div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="pt-4 mt-3 border-t border-[#E4D7C8]/70 flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(prod)}
                    className="py-2 px-3 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Edit2 size={13} className="text-[#8B5E3C]" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleCreateBillWithProduct(prod)}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>+ Create Bill</span>
                    <ArrowRight size={13} className="text-[#C99563]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingProduct ? 'Edit Bag Product' : 'Add New Bag Product'}
          subtitle="Configure default wholesale price, HSN, and GST bracket for this bag type"
          maxWidth="md"
        >
          <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
            {formError && (
              <div className="p-3 rounded-xl bg-[#FDE8E8] border border-[#F8B4B4] text-[#9B1C1C] flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                Product / Bag Name <span className="text-[#B94A48]">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={e => { setFormName(e.target.value); setFormError(''); }}
                placeholder="e.g. Gunny Bag (50kg), Heavy Jute Sacks, PP Woven"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Bag Category
                </label>
                <select
                  value={formCategory}
                  onChange={e => {
                    const cat = e.target.value;
                    setFormCategory(cat);
                    const bagTypeVal = (cat.endsWith('Bag') ? cat : `${cat} Bag`) as BagType;
                    setFormBagType(bagTypeVal);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none"
                >
                  <option value="Gunny">Gunny</option>
                  <option value="Jute">Jute</option>
                  <option value="PP">PP</option>
                  <option value="HDPE">HDPE</option>
                  <option value="Plastic">Plastic</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Unit
                </label>
                <select
                  value={formUnit}
                  onChange={e => setFormUnit(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none"
                >
                  <option value="Bag">Bag</option>
                  <option value="Bags">Bags</option>
                  <option value="Bales">Bales</option>
                  <option value="Bundles">Bundles</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Kgs">Kgs</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Default Rate (₹) <span className="text-[#B94A48]">*</span>
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  required
                  value={formPrice}
                  onChange={e => setFormPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="e.g. 28.00"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Current Stock <span className="text-[#B94A48]">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={formStock}
                  onChange={e => setFormStock(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  HSN/SAC Code
                </label>
                <input
                  type="text"
                  value={formHsn}
                  onChange={e => setFormHsn(e.target.value)}
                  placeholder="e.g. 630510 or 392329"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-mono font-bold text-xs text-[#3B2921] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                  Configurable GST Bracket (%)
                </label>
                <select
                  value={formGstRate}
                  onChange={e => setFormGstRate(parseFloat(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-bold text-xs text-[#3B2921] outline-none"
                >
                  <option value="0">0% (Nil / Exempted)</option>
                  <option value="5">5% (Standard Jute & Gunny Sacks)</option>
                  <option value="12">12% (Processed / Cotton Bags)</option>
                  <option value="18">18% (PP / HDPE / Polyethylene Sacks)</option>
                  <option value="28">28% (Luxury / Specific)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#8B5E3C] uppercase tracking-wider mb-1">
                Description / Specifications
              </label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Bag dimensions, capacity (e.g. 50kg), weave specifications, or notes..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] font-medium text-xs text-[#3B2921] outline-none focus:border-[#3B2921]"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8]">
              <div>
                <span className="font-bold text-[#3B2921] block">Product Status</span>
                <span className="text-[11px] text-[#8B5E3C]">
                  {formIsArchived ? 'Archived (hidden from Create Bill dropdown)' : 'Active (available for new bills)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFormIsArchived(!formIsArchived)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  formIsArchived ? 'bg-[#8B5E3C] text-[#FFFDF8]' : 'bg-[#137333] text-[#FFFDF8]'
                }`}
              >
                {formIsArchived ? 'Archived' : 'Active'}
              </button>
            </div>

            {editingProduct && (
              <p className="text-[11px] text-[#8B5E3C] bg-[#F7F3EA] p-2.5 rounded-xl border border-[#E4D7C8]">
                <strong>Data Safety:</strong> Changes made to this product rate or GST will only apply to future invoices. All historical invoices remain completely untouched.
              </p>
            )}

            <div className="pt-3 border-t border-[#E4D7C8] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#F7F3EA] text-[#3B2921] font-bold text-xs hover:bg-[#EAE2D2]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#3B2921] text-[#FFFDF8] font-bold text-xs hover:bg-[#4E372C] transition-all"
              >
                {editingProduct ? 'Save Changes' : 'Add Bag Product'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Safety Deletion / Archive Confirmation Modal */}
      {deleteConfirmProduct && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirmProduct(null)}
          title="Delete or Archive Product?"
          subtitle={`Managing "${deleteConfirmProduct.name}"`}
          maxWidth="sm"
        >
          {isProductUsedInInvoices(deleteConfirmProduct.id, deleteConfirmProduct.name) ? (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#FDF6E2] border border-[#F1E0B0] text-[#7C5A14] flex items-start gap-2.5">
                <ShieldAlert size={20} className="shrink-0 text-[#B94A48] mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-[#3B2921]">
                    Cannot Permanently Delete Product
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    <strong>"{deleteConfirmProduct.name}"</strong> is referenced in existing billing records. Permanently removing it would disrupt historical records.
                  </p>
                  <p className="text-[11px] font-semibold text-[#8B5E3C]">
                    We recommend <strong>Archiving</strong> it instead. This safely hides it from new bill generation while preserving all historical invoices intact.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmProduct(null)}
                  className="px-4 py-2 rounded-xl bg-[#F7F3EA] text-[#3B2921] font-bold text-xs hover:bg-[#EAE2D2]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDeleteOrArchive}
                  className="px-4 py-2 rounded-xl bg-[#3B2921] text-[#FFFDF8] font-bold text-xs hover:bg-[#4E372C] flex items-center gap-1.5"
                >
                  <Archive size={14} className="text-[#C99563]" />
                  <span>Archive Product</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <p className="text-[#3B2921] leading-relaxed">
                Are you sure you want to permanently delete <strong>"{deleteConfirmProduct.name}"</strong>? This bag type is not used in any invoice.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmProduct(null)}
                  className="px-4 py-2 rounded-xl bg-[#F7F3EA] text-[#3B2921] font-bold text-xs hover:bg-[#EAE2D2]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDeleteOrArchive}
                  className="px-4 py-2 rounded-xl bg-[#B94A48] text-[#FFFDF8] font-bold text-xs hover:bg-[#993A38]"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
