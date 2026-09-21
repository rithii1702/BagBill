import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Plus, 
  Bell, 
  Building2, 
  CalendarDays,
  Clock
} from 'lucide-react';
import { useBagBill } from '../../context/BagBillContext';

interface TopHeaderProps {
  onOpenMobileMenu: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenMobileMenu }) => {
  const navigate = useNavigate();
  const { settings, invoices } = useBagBill();
  const [showNotifications, setShowNotifications] = useState(false);

  // Greeting based on current hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning 👋';
    if (hour < 17) return 'Good afternoon ☀️';
    return 'Good evening 🌙';
  };

  // Format today's full date
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Recent 3 events for notification dropdown
  const pendingInvoices = invoices.filter(inv => inv.paymentStatus === 'Pending');

  return (
    <header className="sticky top-0 z-20 bg-[#FFFDF8]/90 backdrop-blur-md border-b border-[#E4D7C8] px-4 md:px-8 py-3.5 flex items-center justify-between shadow-xs">
      {/* Left: Mobile hamburger + Greeting */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-[#3B2921] hover:bg-[#F7F3EA] border border-[#E4D7C8]"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-[#3B2921] tracking-tight">
              {getGreeting()}
            </h1>
          </div>
          <p className="hidden sm:block text-xs md:text-sm text-[#8B5E3C] font-medium mt-0.5">
            Here's what's happening with your business today.
          </p>
        </div>
      </div>

      {/* Right: Date, Notifications, Business profile & CTAs */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Date pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F7F3EA] border border-[#E4D7C8] text-xs font-semibold text-[#8B5E3C]">
          <CalendarDays size={14} className="text-[#C99563]" />
          <span>{todayFormatted}</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-full text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#F7F3EA] border border-[#E4D7C8] transition-colors"
            title="Notifications"
          >
            <Bell size={18} />
            {pendingInvoices.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#B94A48] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#FFFDF8]">
                {pendingInvoices.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div 
              className="absolute right-0 mt-2 w-80 bg-[#FFFDF8] rounded-2xl border border-[#E4D7C8] shadow-xl p-3 z-50 text-[#2C211B] animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#E4D7C8]">
                <h4 className="font-bold text-sm text-[#3B2921]">Alerts & Pending Bills</h4>
                <span className="text-[11px] font-semibold text-[#8B5E3C]">
                  {pendingInvoices.length} Pending
                </span>
              </div>
              <div className="py-2 space-y-2 max-h-60 overflow-y-auto">
                {pendingInvoices.length === 0 ? (
                  <p className="text-xs text-center text-[#8B5E3C] py-3">All payments are cleared!</p>
                ) : (
                  pendingInvoices.slice(0, 4).map(inv => (
                    <div 
                      key={inv.id} 
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/bills');
                      }}
                      className="p-2 rounded-xl hover:bg-[#F7F3EA] cursor-pointer text-xs flex items-start gap-2.5 transition-colors border border-transparent hover:border-[#E4D7C8]"
                    >
                      <Clock size={16} className="text-[#C98232] shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between font-semibold text-[#3B2921]">
                          <span className="truncate">{inv.partyName}</span>
                          <span>₹{inv.grandTotal.toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-[10px] text-[#8B5E3C]">
                          Bill {inv.invoiceNumber} is pending payment
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Business Profile pill */}
        <div 
          onClick={() => navigate('/settings')}
          className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F7F3EA] border border-[#E4D7C8] cursor-pointer hover:border-[#C99563] transition-colors"
          title="Click to view/edit business settings"
        >
          <div className="w-6 h-6 rounded-full bg-[#3B2921] text-[#FFFDF8] flex items-center justify-center text-[10px] font-black">
            {settings.logoText || 'BB'}
          </div>
          <span className="text-xs font-bold text-[#3B2921] max-w-[130px] truncate">
            {settings.businessName}
          </span>
        </div>

        {/* Create Bill Primary CTA */}
        <button
          onClick={() => navigate('/create-bill')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3B2921] hover:bg-[#4E372C] text-[#FFFDF8] font-bold text-xs md:text-sm shadow-sm hover:shadow-md transition-all active:scale-95 border border-[#3B2921]"
        >
          <Plus size={16} className="text-[#C99563]" />
          <span>New Bill</span>
        </button>
      </div>
    </header>
  );
};
