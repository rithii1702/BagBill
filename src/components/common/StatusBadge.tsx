import React from 'react';
import { PaymentStatus } from '../../types';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs font-semibold gap-1.5',
    lg: 'px-3 py-1.5 text-sm font-semibold gap-2',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  if (status === 'Paid') {
    return (
      <span className={`inline-flex items-center rounded-full bg-[#4F7D5A]/15 text-[#305439] border border-[#4F7D5A]/30 ${sizeClasses[size]}`}>
        <CheckCircle2 size={iconSizes[size]} className="text-[#4F7D5A]" />
        <span>Paid</span>
      </span>
    );
  }

  if (status === 'Pending') {
    return (
      <span className={`inline-flex items-center rounded-full bg-[#B94A48]/15 text-[#882c2a] border border-[#B94A48]/30 ${sizeClasses[size]}`}>
        <AlertCircle size={iconSizes[size]} className="text-[#B94A48]" />
        <span>Pending</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full bg-[#C98232]/15 text-[#8b551a] border border-[#C98232]/30 ${sizeClasses[size]}`}>
      <Clock size={iconSizes[size]} className="text-[#C98232]" />
      <span>Partial</span>
    </span>
  );
};
