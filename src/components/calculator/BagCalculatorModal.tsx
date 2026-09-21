import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Check, 
  RotateCcw, 
  ShoppingBag, 
  Layers, 
  Percent, 
  Info,
  ArrowRight,
  Plus
} from 'lucide-react';
import { BagType, BillItem, TaxMode } from '../../types';
import { formatINR } from '../../utils/formatters';
import { Modal } from '../common/Modal';

export interface BagCalculatorData {
  bagType: BagType;
  quantity: number;
  unit: string;
  pricePerBag: number;
  discountPercent: number;
  gstRate: number;
  description?: string;
}

interface BagCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BillItem[];
  targetIndex: number;
  taxMode: TaxMode;
  onApply: (targetIndex: number, data: BagCalculatorData, isNewItem?: boolean) => void;
}

export const BagCalculatorModal: React.FC<BagCalculatorModalProps> = ({
  isOpen,
  onClose,
  items,
  targetIndex,
  taxMode,
  onApply,
}) => {
  // Selected target: either an existing row index or 'new'
  const [selectedTarget, setSelectedTarget] = useState<number | 'new'>(targetIndex);

  // Calculation mode: direct quantity vs bales multiplier
  const [calcMode, setCalcMode] = useState<'direct' | 'multiplier'>('direct');

  // Active item reference
  const currentItem = selectedTarget !== 'new' && items[selectedTarget] ? items[selectedTarget] : null;

  // Form states
  const [bagType, setBagType] = useState<BagType>(currentItem?.bagType || 'Gunny Bag');
  const [unit, setUnit] = useState<string>(currentItem?.unit || 'Bags');
  const [directQty, setDirectQty] = useState<number | ''>(currentItem?.quantity || 500);
  const [balesCount, setBalesCount] = useState<number | ''>(10);
  const [bagsPerBale, setBagsPerBale] = useState<number | ''>(50);
  const [rate, setRate] = useState<number | ''>(currentItem?.pricePerBag || 28.00);
  const [discountPercent, setDiscountPercent] = useState<number>(currentItem?.discountPercent || 0);
  const [gstRate, setGstRate] = useState<number>(currentItem?.gstRate !== undefined ? currentItem.gstRate : 5);

  // Bag presets for wholesale quick selection
  const presets: { type: BagType; label: string; defaultPrice: number; defaultGst: number; hsn: string }[] = [
    { type: 'Gunny Bag', label: 'Gunny (5%)', defaultPrice: 28.00, defaultGst: 5, hsn: '630510' },
    { type: 'Jute Bag', label: 'Jute (5%)', defaultPrice: 37.50, defaultGst: 5, hsn: '630510' },
    { type: 'PP Bag', label: 'PP Sacks (18%)', defaultPrice: 14.50, defaultGst: 18, hsn: '392329' },
    { type: 'HDPE Bag', label: 'HDPE (18%)', defaultPrice: 22.00, defaultGst: 18, hsn: '392329' },
    { type: 'Plastic Bag', label: 'Plastic (18%)', defaultPrice: 8.50, defaultGst: 18, hsn: '392321' },
    { type: 'Custom Bag', label: 'Custom (12%)', defaultPrice: 42.00, defaultGst: 12, hsn: '630590' },
  ];

  // Sync state when modal opens or target changes
  useEffect(() => {
    setSelectedTarget(targetIndex);
  }, [targetIndex, isOpen]);

  useEffect(() => {
    if (selectedTarget !== 'new' && items[selectedTarget]) {
      const it = items[selectedTarget];
      setBagType(it.bagType);
      setUnit(it.unit || 'Bags');
      setDirectQty(it.quantity);
      setRate(it.pricePerBag);
      setDiscountPercent(it.discountPercent || 0);
      setGstRate(it.gstRate !== undefined ? it.gstRate : 5);
      if (it.quantity >= 50 && it.quantity % 50 === 0) {
        setBalesCount(it.quantity / 50);
        setBagsPerBale(50);
      }
    } else if (selectedTarget === 'new') {
      setBagType('Gunny Bag');
      setUnit('Bags');
      setDirectQty(500);
      setRate(28.00);
      setDiscountPercent(0);
      setGstRate(5);
      setBalesCount(10);
      setBagsPerBale(50);
    }
  }, [selectedTarget, items]);

  // Derived Effective Quantity
  const effectiveQty = calcMode === 'multiplier'
    ? (typeof balesCount === 'number' ? balesCount : 0) * (typeof bagsPerBale === 'number' ? bagsPerBale : 0)
    : (typeof directQty === 'number' ? directQty : 0);

  const rateVal = typeof rate === 'number' ? rate : 0;
  const discPct = Math.max(0, Math.min(100, discountPercent || 0));
  const gstPct = Math.max(0, gstRate || 0);

  // Exact Calculation Breakdown
  const subtotal = effectiveQty * rateVal;
  const discountAmount = (subtotal * discPct) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstAmount = (taxableAmount * gstPct) / 100;
  const finalTotal = taxableAmount + gstAmount;
  const effectivePerBag = effectiveQty > 0 ? finalTotal / effectiveQty : 0;

  const handleApply = () => {
    if (effectiveQty <= 0) {
      alert('Please enter a valid quantity greater than 0');
      return;
    }
    if (rateVal < 0) {
      alert('Please enter a valid rate per bag');
      return;
    }

    const payload: BagCalculatorData = {
      bagType,
      quantity: effectiveQty,
      unit,
      pricePerBag: rateVal,
      discountPercent: discPct,
      gstRate: gstPct,
      description: calcMode === 'multiplier'
        ? `${balesCount} Bales × ${bagsPerBale} Bags/Bale (${bagType})`
        : `${effectiveQty} ${unit} (${bagType})`,
    };

    const isNew = selectedTarget === 'new';
    const targetIdx = isNew ? items.length : selectedTarget;
    onApply(targetIdx, payload, isNew);
    onClose();
  };

  const handleReset = () => {
    if (selectedTarget !== 'new' && items[selectedTarget]) {
      const it = items[selectedTarget];
      setBagType(it.bagType);
      setDirectQty(it.quantity);
      setRate(it.pricePerBag);
      setDiscountPercent(it.discountPercent || 0);
      setGstRate(it.gstRate !== undefined ? it.gstRate : 5);
      setUnit(it.unit || 'Bags');
    } else {
      setBagType('Gunny Bag');
      setDirectQty(500);
      setRate(28.00);
      setDiscountPercent(0);
      setGstRate(5);
    }
    setBalesCount(10);
    setBagsPerBale(50);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🧮 Bag Calculator"
      subtitle="Fast wholesale bag calculation with bale multipliers, discounts, and GST"
      maxWidth="2xl"
    >
      <div className="space-y-5 text-[#2C211B]">
        {/* Target Bag Row Selector Bar */}
        <div className="p-3 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-[#8B5E3C]" />
            <span className="text-xs font-bold text-[#3B2921]">Applying to:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {items.map((item, idx) => (
              <button
                key={item.id || idx}
                type="button"
                onClick={() => setSelectedTarget(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                  selectedTarget === idx
                    ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921] shadow-2xs'
                    : 'bg-[#FFFDF8] text-[#8B5E3C] border-[#E4D7C8] hover:border-[#C99563]'
                }`}
              >
                Bag #{idx + 1} ({item.bagType})
              </button>
            ))}

            <button
              type="button"
              onClick={() => setSelectedTarget('new')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                selectedTarget === 'new'
                  ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921] shadow-2xs'
                  : 'bg-[#FFFDF8] text-[#8B5E3C] border-[#E4D7C8] hover:border-[#C99563]'
              }`}
            >
              <Plus size={12} />
              <span>+ New Bag</span>
            </button>
          </div>
        </div>

        {/* Bag Presets */}
        <div>
          <label className="block text-xs font-bold text-[#8B5E3C] uppercase tracking-wider mb-1.5">
            Quick Bag Presets
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {presets.map(p => (
              <button
                key={p.type}
                type="button"
                onClick={() => {
                  setBagType(p.type);
                  setRate(p.defaultPrice);
                  setGstRate(p.defaultGst);
                }}
                className={`p-2 rounded-xl border text-center transition-all ${
                  bagType === p.type
                    ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921] shadow-xs'
                    : 'bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] border-[#E4D7C8]'
                }`}
              >
                <div className="font-bold text-xs">{p.label}</div>
                <div className={`text-[10px] ${bagType === p.type ? 'text-[#C99563]' : 'text-[#8B5E3C]'}`}>
                  ₹{p.defaultPrice}/bag
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Calculation Mode: Direct vs Bales Multiplier */}
        <div className="flex rounded-xl bg-[#F7F3EA] p-1 border border-[#E4D7C8]">
          <button
            type="button"
            onClick={() => setCalcMode('direct')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              calcMode === 'direct'
                ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                : 'text-[#8B5E3C] hover:text-[#3B2921]'
            }`}
          >
            Direct Quantity Entry
          </button>
          <button
            type="button"
            onClick={() => setCalcMode('multiplier')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              calcMode === 'multiplier'
                ? 'bg-[#3B2921] text-[#FFFDF8] shadow-xs'
                : 'text-[#8B5E3C] hover:text-[#3B2921]'
            }`}
          >
            <Layers size={13} />
            <span>Bales / Bundles Multiplier</span>
          </button>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Left Sub-column: Quantity details */}
          <div className="space-y-3 p-4 rounded-xl bg-[#F7F3EA]/60 border border-[#E4D7C8]">
            <h5 className="text-xs font-bold text-[#3B2921] flex items-center justify-between">
              <span>Quantity Configuration</span>
              <span className="font-mono text-[#8B5E3C] font-semibold">{effectiveQty.toLocaleString('en-IN')} {unit}</span>
            </h5>

            {calcMode === 'direct' ? (
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-[#8B5E3C]">
                  Total Bags / Units
                </label>
                <div className="flex rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] overflow-hidden focus-within:border-[#C99563]">
                  <input
                    type="number"
                    min="1"
                    value={directQty}
                    onChange={e => setDirectQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="min-w-0 flex-1 px-3 py-2 text-xs font-mono font-bold text-[#3B2921] outline-none"
                    placeholder="e.g. 500"
                  />
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="shrink-0 min-w-[78px] px-2.5 bg-[#F7F3EA] border-l border-[#E4D7C8] text-xs font-bold text-[#8B5E3C] outline-none cursor-pointer"
                  >
                    <option value="Bags">Bags</option>
                    <option value="Bales">Bales</option>
                    <option value="Bundles">Bundles</option>
                    <option value="Pcs">Pcs</option>
                  </select>
                </div>

                {/* Quick Add Increment Chips */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-[#8B5E3C] font-semibold">Quick add:</span>
                  {[100, 500, 1000, 5000].map(add => (
                    <button
                      key={add}
                      type="button"
                      onClick={() => setDirectQty(prev => (typeof prev === 'number' ? prev : 0) + add)}
                      className="px-2 py-0.5 rounded bg-[#FFFDF8] border border-[#E4D7C8] text-[10px] font-bold text-[#3B2921] hover:border-[#C99563]"
                    >
                      +{add}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                      No. of Bales
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={balesCount}
                      onChange={e => setBalesCount(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      placeholder="10"
                      className="w-full px-3 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                      Bags per Bale
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={bagsPerBale}
                      onChange={e => setBagsPerBale(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      placeholder="50"
                      className="w-full px-3 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-[11px] text-[#8B5E3C]">
                  Multiplier Formula: <strong className="text-[#3B2921]">{balesCount || 0} bales × {bagsPerBale || 0} bags</strong> = <span className="font-mono font-black text-[#3B2921]">{effectiveQty} total bags</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Sub-column: Rate, Discount, GST */}
          <div className="space-y-3 p-4 rounded-xl bg-[#F7F3EA]/60 border border-[#E4D7C8]">
            <h5 className="text-xs font-bold text-[#3B2921]">
              Rate, Discount & Tax
            </h5>

            {/* Rate per Bag */}
            <div>
              <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                Rate per Bag (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8B5E3C]">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={rate}
                  onChange={e => setRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="28.00"
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none"
                />
              </div>
            </div>

            {/* Discount % */}
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <label className="text-[11px] font-bold text-[#8B5E3C]">
                  Discount %
                </label>
                <div className="flex gap-1">
                  {[0, 2, 5, 10].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiscountPercent(d)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        discountPercent === d
                          ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921]'
                          : 'bg-[#FFFDF8] text-[#8B5E3C] border-[#E4D7C8]'
                      }`}
                    >
                      {d}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="w-full pr-7 pl-3 py-2 rounded-xl bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8B5E3C]">%</span>
              </div>
            </div>

            {/* GST Rate */}
            <div>
              <label className="block text-[11px] font-bold text-[#8B5E3C] mb-1">
                GST Rate
              </label>
              <div className="grid grid-cols-5 gap-1">
                {[0, 5, 12, 18, 28].map(gst => (
                  <button
                    key={gst}
                    type="button"
                    onClick={() => setGstRate(gst)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      gstRate === gst
                        ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921] shadow-2xs'
                        : 'bg-[#FFFDF8] text-[#8B5E3C] border-[#E4D7C8] hover:border-[#C99563]'
                    }`}
                  >
                    {gst}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Calculation Result Summary Card */}
        <div className="bg-[#FFFDF8] p-4 rounded-xl border-2 border-[#C99563] shadow-xs space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-[#E4D7C8]">
            <div className="flex items-center gap-1.5">
              <Calculator size={16} className="text-[#8B5E3C]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#3B2921]">
                Calculation Result
              </span>
            </div>
            <span className="text-xs font-bold font-mono text-[#8B5E3C]">
              {bagType}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8B5E3C] block">Subtotal</span>
              <span className="font-mono font-bold text-sm text-[#3B2921]">
                {formatINR(subtotal)}
              </span>
              <span className="text-[10px] text-[#8B5E3C] block">
                {effectiveQty} × ₹{rateVal.toFixed(2)}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8B5E3C] block">Discount ({discPct}%)</span>
              <span className="font-mono font-bold text-sm text-[#B94A48]">
                -{formatINR(discountAmount)}
              </span>
              <span className="text-[10px] text-[#8B5E3C] block">
                Taxable: {formatINR(taxableAmount)}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8B5E3C] block">
                GST ({gstPct}%)
              </span>
              <span className="font-mono font-bold text-sm text-[#3B2921]">
                +{formatINR(gstAmount)}
              </span>
              <span className="text-[10px] text-[#8B5E3C] block">
                {taxMode === 'IGST' ? 'IGST' : `${(gstPct/2).toFixed(1)}% CGST + ${(gstPct/2).toFixed(1)}% SGST`}
              </span>
            </div>

            <div className="bg-[#3B2921] text-[#FFFDF8] p-2 rounded-lg text-right">
              <span className="text-[10px] uppercase font-bold text-[#C99563] block">Final Total</span>
              <span className="font-mono font-black text-base text-[#FFFDF8] block">
                {formatINR(finalTotal)}
              </span>
              <span className="text-[9px] text-[#C99563] block font-mono">
                ₹{effectivePerBag.toFixed(2)}/bag net
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E4D7C8]">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#F7F3EA] transition-colors"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] font-bold text-xs border border-[#E4D7C8] transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-black text-xs md:text-sm shadow-md transition-all active:scale-95 border border-[#3B2921]"
            >
              <Check size={16} className="text-[#C99563]" />
              <span>Apply to Bill</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
