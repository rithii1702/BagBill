import React from 'react';
import { useBagBill } from '../../context/BagBillContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastNotification: React.FC = () => {
  const { toasts, dismissToast } = useBagBill();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => {
        const icons = {
          success: <CheckCircle2 className="text-[#4F7D5A] shrink-0" size={18} />,
          warning: <AlertTriangle className="text-[#C98232] shrink-0" size={18} />,
          error: <AlertCircle className="text-[#B94A48] shrink-0" size={18} />,
          info: <Info className="text-[#8B5E3C] shrink-0" size={18} />,
        };

        const bgColors = {
          success: 'bg-[#FFFDF8] border-[#4F7D5A]/40 text-[#2C211B]',
          warning: 'bg-[#FFFDF8] border-[#C98232]/40 text-[#2C211B]',
          error: 'bg-[#FFFDF8] border-[#B94A48]/40 text-[#2C211B]',
          info: 'bg-[#FFFDF8] border-[#8B5E3C]/40 text-[#2C211B]',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl border shadow-lg transition-all duration-300 transform translate-y-0 ${bgColors[toast.type]}`}
          >
            <div className="flex items-center gap-3">
              {icons[toast.type]}
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-[#8B5E3C] hover:text-[#3B2921] p-1 rounded-md transition-colors"
              aria-label="Close notification"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
