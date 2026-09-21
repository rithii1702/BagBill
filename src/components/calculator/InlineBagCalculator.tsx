import React, { useState } from 'react';
import { 
  Calculator, 
  Check, 
  X, 
  Layers, 
  Percent, 
  Tag, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { BagType, BillItem, TaxMode } from '../../types';
import { formatINR } from '../../utils/formatters';

interface InlineBagCalculatorProps {
  itemIndex: number;
  initialItem: BillItem;
  taxMode: TaxMode;
  onApply: (updated: {
    bagType: BagType;
    quantity: number;
    unit: string;
    pricePerBag: number;
    discountPercent: number;
    gstRate: number;
    description?: string;
  }) => void;
  onClose: () => void;
}

export const InlineBagCalculator: React.FC<InlineBagCalculatorProps> = ({
  itemIndex,
  initialItem,
  taxMode,
  onApply,
  onClose,
}) => {
  // Mode: direct quantity vs bales multiplier
  const [calcMode, setCalcMode] = useState<'multiplier' | 'direct'>('direct');

  // Multiplier fields (e.g. 10 bales × 50 bags/bale = 500 bags)
  const initialQty = initialItem.quantity || 500;
  const guessedBales = initialQty >= 50 && initialQty % 50 === 0 ? initialQty / 50 : 10;
  const [balesCount, setBalesCount] = useState<number | ''>(guessedBales);
  const [bagsPerBale, setBagsPerBale] = useState<number | ''>(initialQty % 50 === 0 ? 50 : 100);

  // Direct fields
  const [directQty, setDirectQty] = useState<number | ''>(initialQty);
  const [unit, setUnit] = useState<string>(initialItem.unit || 'Bags');

  // Pricing & Tax
  const [bagType, setBagType] = useState<BagType>(initialItem.bagType || 'Gunny Bag');
  const [rate, setRate] = useState<number | ''>(initialItem.pricePerBag || 28.00);
  const [discountPercent, setDiscountPercent] = useState<number>(initialItem.discountPercent || 0);
  const [gstRate, setGstRate] = useState<number>(initialItem.gstRate !== undefined ? initialItem.gstRate : 5);

  // Bag presets
  const presets: { type: BagType; defaultPrice: number; defaultGst: number; hsn: string }[] = [
    { type: 'Gunny Bag', defaultPrice: 28.00, defaultGst: 5, hsn: '630510' },
    { type: 'Jute Bag', defaultPrice: 37.50, defaultGst: 5, hsn: '630510' },
    { type: 'PP Bag', defaultPrice: 14.50, defaultGst: 18, hsn: '392329' },
    { type: 'HDPE Bag', defaultPrice: 22.00, defaultGst: 18, hsn: '392329' },
    { type: 'Plastic Bag', defaultPrice: 8.50, defaultGst: 18, hsn: '392321' },
    { type: 'Custom Bag', defaultPrice: 42.00, defaultGst: 12, hsn: '630590' },
  ];

  // Derived effective quantity
  const effectiveQty = calcMode === 'multiplier'
    ? (typeof balesCount === 'number' ? balesCount : 0) * (typeof bagsPerBale === 'number' ? bagsPerBale : 0)
    : (typeof directQty === 'number' ? directQty : 0);

  const rateVal = typeof rate === 'number' ? rate : 0;
  const discPct = Math.max(0, Math.min(100, discountPercent || 0));
  const gstPct = Math.max(0, gstRate || 0);

  // Calculations
  const rawSubtotal = effectiveQty * rateVal;
  const discountAmount = (rawSubtotal * discPct) / 100;
  const taxableAmount = Math.max(0, rawSubtotal - discountAmount);
  const taxAmount = (taxableAmount * gstPct) / 100;
  const lineTotal = taxableAmount + taxAmount;
  const effectiveRatePerBag = effectiveQty > 0 ? lineTotal / effectiveQty : 0;

  const cgstAmount = taxMode === 'CGST_SGST' ? taxAmount / 2 : 0;
  const sgstAmount = taxMode === 'CGST_SGST' ? taxAmount / 2 : 0;
  const igstAmount = taxMode === 'IGST' ? taxAmount : 0;

  const handleApply = () => {
    if (effectiveQty <= 0) {
      alert('Please enter a valid quantity greater than 0');
      return;
    }
    if (rateVal <= 0) {
      alert('Please enter a valid rate per bag');
      return;
    }

    const description = calcMode === 'multiplier'
      ? `${balesCount} Bales × ${bagsPerBale} Bags/Bale (${bagType})`
      : `${effectiveQty} ${unit} (${bagType})`;

    onApply({
      bagType,
      quantity: effectiveQty,
      unit,
      pricePerBag: rateVal,
      discountPercent: discPct,
      gstRate: gstPct,
      description,
    });
  };

  const handleReset = () => {
    setBagType(initialItem.bagType);
    setDirectQty(initialItem.quantity);
    setRate(initialItem.pricePerBag);
    setDiscountPercent(initialItem.discountPercent || 0);
    setGstRate(initialItem.gstRate !== undefined ? initialItem.gstRate : 5);
    setBalesCount(10);
    setBagsPerBale(50);
  };

  return (
    <div className="bg-[#FFFDF8] border-2 border-[#C99563]/60 rounded-xl p-4 shadow-sm space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[#E4D7C8]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#3B2921] text-[#C99563]">
            <Calculator size={15} />
          </div>
          <div>
            <h4 className="text-xs font-black text-[#3B2921] flex items-center gap-1.5">
              <span>Inline Calculation Panel — Bag #{itemIndex + 1}</span>
              <span className="text-[10px] font-bold text-[#8B5E3C] bg-[#F7F3EA] px-2 py-0.5 rounded border border-[#E4D7C8]">
                {bagType}
              </span>
            </h4>
            <p className="text-[10px] text-[#8B5E3C]">
              Calculate bale multiplier, unit rates, bulk discount, & GST. Click Apply to instantly update this bag row.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleReset}
            className="p-1 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#F7F3EA] rounded-md transition-colors"
            title="Reset values to current bag item"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#F7F3EA] rounded-md transition-colors"
            title="Close calculator panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Prominent Quick Calculation Banner: Qty × Rate = Amount */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-[#3B2921] text-[#FFFDF8] gap-3 shadow-xs">
        <div>
          <div className="text-[10px] text-[#C99563] font-bold uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={12} />
            <span>Bag Item Calculation</span>
          </div>
          <div className="text-base sm:text-lg font-black font-mono tracking-tight mt-0.5">
            {effectiveQty.toLocaleString('en-IN')} {unit} × ₹{rateVal.toFixed(2)} = <span className="text-[#C99563]">{formatINR(rawSubtotal)}</span>
          </div>
          <div className="text-[10px] text-[#E4D7C8]/80 mt-0.5">
            {discPct > 0 ? `Less ${discPct}% Disc (${formatINR(discountAmount)}) • ` : ''}
            Taxable: {formatINR(taxableAmount)} • GST ({gstPct}%): +{formatINR(taxAmount)} • <strong className="text-white">Net Total: {formatINR(lineTotal)}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={handleApply}
          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#C99563] hover:bg-[#b88352] text-[#3B2921] font-black text-xs transition-all active:scale-95 shadow-xs flex items-center justify-center gap-1.5 shrink-0"
        >
          <Check size={14} />
          <span>Apply to Bill</span>
        </button>
      </div>

      {/* Bag Type Presets */}
      <div>
        <label className="block text-[10px] font-bold text-[#8B5E3C] uppercase tracking-wider mb-1.5">
          Select Bag Type Preset
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {presets.map(p => (
            <button
              key={p.type}
              type="button"
              onClick={() => {
                setBagType(p.type);
                setRate(p.defaultPrice);
                setGstRate(p.defaultGst);
              }}
              className={`px-2 py-1.5 rounded-lg text-left border transition-all ${
                bagType === p.type
                  ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921] shadow-2xs'
                  : 'bg-[#F7F3EA] hover:bg-[#EAE2D2] text-[#3B2921] border-[#E4D7C8]'
              }`}
            >
              <div className="text-[11px] font-bold truncate">{p.type}</div>
              <div className={`text-[10px] font-mono ${bagType === p.type ? 'text-[#C99563]' : 'text-[#8B5E3C]'}`}>
                ₹{p.defaultPrice.toFixed(2)} • {p.defaultGst}%
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quantity Mode & Controls */}
      <div className="p-3 rounded-xl bg-[#F7F3EA]/70 border border-[#E4D7C8] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-[11px] font-bold text-[#3B2921] flex items-center gap-1.5">
            <Layers size={13} className="text-[#8B5E3C]" />
            <span>Quantity Method</span>
          </label>

          <div className="flex rounded-lg bg-[#FFFDF8] p-0.5 border border-[#E4D7C8] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setCalcMode('multiplier')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                calcMode === 'multiplier'
                  ? 'bg-[#3B2921] text-[#FFFDF8] shadow-2xs'
                  : 'text-[#8B5E3C] hover:text-[#3B2921]'
              }`}
            >
              📦 Bales × Bags Multiplier
            </button>
            <button
              type="button"
              onClick={() => setCalcMode('direct')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                calcMode === 'direct'
                  ? 'bg-[#3B2921] text-[#FFFDF8] shadow-2xs'
                  : 'text-[#8B5E3C] hover:text-[#3B2921]'
              }`}
            >
              🔢 Direct Quantity
            </button>
          </div>
        </div>

        {calcMode === 'multiplier' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              {/* Bales Input */}
              <div className="sm:col-span-5">
                <label className="block text-[10px] font-bold text-[#8B5E3C] mb-1">
                  Number of Bales / Bundles
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={balesCount}
                    onChange={e => setBalesCount(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none"
                    placeholder="e.g. 10"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8B5E3C]">Bales</span>
                </div>
              </div>

              {/* Multiplier Operator */}
              <div className="sm:col-span-1 text-center font-black text-sm text-[#8B5E3C]">
                ×
              </div>

              {/* Bags per Bale */}
              <div className="sm:col-span-6">
                <label className="block text-[10px] font-bold text-[#8B5E3C] mb-1">
                  Bags per Bale (Packing Size)
                </label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      value={bagsPerBale}
                      onChange={e => setBagsPerBale(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none"
                      placeholder="e.g. 50"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8B5E3C]">Bags/Bale</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick chips for bales */}
            <div className="flex flex-wrap items-center gap-1 text-[10px] pt-1">
              <span className="text-[#8B5E3C] font-semibold">Quick Bales:</span>
              {[5, 10, 20, 50, 100].map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBalesCount(b)}
                  className={`px-1.5 py-0.5 rounded border font-bold ${
                    balesCount === b
                      ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921]'
                      : 'bg-[#FFFDF8] text-[#8B5E3C] border-[#E4D7C8] hover:border-[#C99563]'
                  }`}
                >
                  {b} Bales
                </button>
              ))}
              <span className="text-[#8B5E3C] font-semibold ml-2">Packing:</span>
              {[25, 50, 100, 200].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setBagsPerBale(p)}
                  className={`px-1.5 py-0.5 rounded border font-bold ${
                    bagsPerBale === p
                      ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921]'
                      : 'bg-[#FFFDF8] text-[#8B5E3C] border-[#E4D7C8] hover:border-[#C99563]'
                  }`}
                >
                  {p}/bale
                </button>
              ))}
            </div>

            {/* Multiplier result indicator */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-xs">
              <span className="text-[#8B5E3C] font-medium">
                {balesCount || 0} Bales × {bagsPerBale || 0} Bags per Bale
              </span>
              <span className="font-mono font-black text-[#3B2921]">
                = {effectiveQty.toLocaleString('en-IN')} Total Bags
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-8">
                <label className="block text-[10px] font-bold text-[#8B5E3C] mb-1">
                  Direct Quantity ({unit})
                </label>
                <input
                  type="number"
                  min="1"
                  value={directQty}
                  onChange={e => setDirectQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none"
                  placeholder="e.g. 500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[10px] font-bold text-[#8B5E3C] mb-1">
                  Unit
                </label>
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-bold text-[#3B2921] outline-none"
                >
                  <option value="Bags">Bags</option>
                  <option value="Bales">Bales</option>
                  <option value="Bundles">Bundles</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Kgs">Kgs</option>
                </select>
              </div>
            </div>

            {/* Quick Add Chips */}
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <span className="text-[#8B5E3C] font-semibold">Add:</span>
              {[50, 100, 500, 1000].map(add => (
                <button
                  key={add}
                  type="button"
                  onClick={() => setDirectQty(prev => (typeof prev === 'number' ? prev : 0) + add)}
                  className="px-2 py-0.5 rounded bg-[#FFFDF8] border border-[#E4D7C8] hover:border-[#C99563] text-[#8B5E3C] font-bold"
                >
                  +{add}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDirectQty(0)}
                className="px-2 py-0.5 rounded bg-[#FFFDF8] border border-[#E4D7C8] text-[#8B5E3C] hover:text-[#B94A48] font-semibold"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rate, Discount, and GST Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Rate per Bag */}
        <div className="sm:col-span-5 space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-[#8B5E3C] uppercase tracking-wider">
              Rate per Bag (₹)
            </label>
            <div className="flex gap-1">
              {[-1, +1].map(delta => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => setRate(prev => Math.max(0, +(Number(prev || 0) + delta).toFixed(2)))}
                  className="px-1 py-0.2 rounded text-[9px] font-bold bg-[#F7F3EA] border border-[#E4D7C8] text-[#8B5E3C]"
                >
                  {delta > 0 ? `+₹${delta}` : `-₹${Math.abs(delta)}`}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8B5E3C]">₹</span>
            <input
              type="number"
              min="0"
              step="0.10"
              value={rate}
              onChange={e => setRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="w-full pl-6 pr-2.5 py-1.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none text-right"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Discount % */}
        <div className="sm:col-span-3 space-y-1">
          <label className="block text-[10px] font-bold text-[#8B5E3C] uppercase tracking-wider">
            Discount %
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              value={discountPercent}
              onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
              className="w-full pr-6 pl-2.5 py-1.5 rounded-lg bg-[#FFFDF8] border border-[#E4D7C8] text-xs font-mono font-bold text-[#3B2921] outline-none text-right"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8B5E3C] font-bold">%</span>
          </div>
          <div className="flex gap-1">
            {[0, 2, 5].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDiscountPercent(d)}
                className={`flex-1 py-0.5 rounded text-[9px] font-bold border ${
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

        {/* Configurable GST Rate */}
        <div className="sm:col-span-4 space-y-1">
          <label className="block text-[10px] font-bold text-[#8B5E3C] uppercase tracking-wider">
            GST Rate (Configurable)
          </label>
          <div className="grid grid-cols-5 gap-1">
            {[0, 5, 12, 18, 28].map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGstRate(g)}
                className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                  gstRate === g
                    ? 'bg-[#3B2921] text-[#FFFDF8] border-[#3B2921] shadow-2xs'
                    : 'bg-[#FFFDF8] text-[#8B5E3C] border-[#E4D7C8] hover:border-[#C99563]'
                }`}
              >
                {g}%
              </button>
            ))}
          </div>
          <div className="text-[10px] text-[#8B5E3C] text-right font-medium">
            {taxMode === 'CGST_SGST' ? `CGST ${(gstRate / 2)}% + SGST ${(gstRate / 2)}%` : `IGST ${gstRate}%`}
          </div>
        </div>
      </div>

      {/* Real-Time Formula & Financial Breakdown Card */}
      <div className="p-3 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8] space-y-2">
        <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-[#E4D7C8]/70">
          <span className="font-bold text-[#3B2921] flex items-center gap-1">
            <Sparkles size={12} className="text-[#C99563]" />
            Formula Breakdown
          </span>
          <span className="text-[10px] text-[#8B5E3C] font-mono">
            {effectiveQty} × ₹{rateVal.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-[10px] text-[#8B5E3C] block">Gross Subtotal:</span>
            <span className="font-mono font-bold text-[#3B2921]">₹{rawSubtotal.toFixed(2)}</span>
          </div>

          <div>
            <span className="text-[10px] text-[#8B5E3C] block">Discount ({discPct}%):</span>
            <span className="font-mono font-bold text-[#B94A48]">-₹{discountAmount.toFixed(2)}</span>
          </div>

          <div>
            <span className="text-[10px] text-[#8B5E3C] block">Taxable Subtotal:</span>
            <span className="font-mono font-bold text-[#3B2921]">₹{taxableAmount.toFixed(2)}</span>
          </div>

          <div>
            <span className="text-[10px] text-[#8B5E3C] block">
              GST ({gstPct}%):
            </span>
            <span className="font-mono font-bold text-[#2E6F40]">+₹{taxAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Total & Net Cost highlight */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-[#E4D7C8]/70 gap-1.5">
          <div className="text-[11px] text-[#8B5E3C]">
            Effective Net Cost: <span className="font-mono font-bold text-[#3B2921]">₹{effectiveRatePerBag.toFixed(2)} / bag</span>
            {taxMode === 'CGST_SGST' && gstPct > 0 && (
              <span className="text-[10px] ml-2 text-[#8B5E3C]">
                (CGST ₹{cgstAmount.toFixed(2)} + SGST ₹{sgstAmount.toFixed(2)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#8B5E3C]">Calculated Total:</span>
            <span className="text-base font-black font-mono text-[#3B2921]">
              {formatINR(lineTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Action CTA Buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 rounded-xl text-xs font-bold text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#F7F3EA] border border-[#E4D7C8] transition-colors"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleApply}
          className="px-5 py-2 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] text-xs font-bold shadow-sm hover:shadow transition-all active:scale-95 flex items-center gap-2 border border-[#3B2921]"
        >
          <Check size={15} className="text-[#C99563]" />
          <span>Apply to Bill ({formatINR(lineTotal)})</span>
        </button>
      </div>
    </div>
  );
};
