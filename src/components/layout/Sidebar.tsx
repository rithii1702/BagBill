import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FilePlus2, 
  BookOpenText, 
  Users, 
  ShoppingBag, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useBagBill } from '../../context/BagBillContext';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: any;
  highlight?: boolean;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onCloseMobile }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { settings } = useBagBill();

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/create-bill', label: 'Create Bill', icon: FilePlus2, highlight: true },
    { to: '/bills', label: 'Bill Book', icon: BookOpenText },
    { to: '/parties', label: 'Parties', icon: Users },
    { to: '/products', label: 'Products', icon: ShoppingBag },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#FFFDF8] border-r border-[#E4D7C8] text-[#2C211B] select-none">
      {/* Brand Header */}
      <div className={`p-4 border-b border-[#E4D7C8] flex items-center justify-between ${collapsed ? 'justify-center' : ''}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Bag Icon / Logo */}
          <div className="w-10 h-10 rounded-xl bg-[#3B2921] flex items-center justify-center text-[#FFFDF8] shadow-sm shrink-0 border border-[#8B5E3C]/30">
            <span className="font-extrabold text-base tracking-wider text-[#C99563]">BB</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="font-black text-xl tracking-tight text-[#3B2921] flex items-center gap-1">
                Bag<span className="text-[#C99563]">Bill</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8B5E3C] truncate">
                {settings.businessName || 'Bag Business Ledger'}
              </span>
            </div>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1.5 rounded-lg text-[#8B5E3C] hover:text-[#3B2921] hover:bg-[#F7F3EA] transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150
                ${isActive 
                  ? 'bg-[#3B2921] text-[#FFFDF8] shadow-md shadow-[#3B2921]/15' 
                  : item.highlight
                    ? 'bg-[#C99563]/15 text-[#3B2921] hover:bg-[#C99563]/25 border border-[#C99563]/30'
                    : 'text-[#2C211B] hover:bg-[#F7F3EA] hover:text-[#3B2921]'
                }
                ${collapsed ? 'justify-center px-2' : ''}
              `}
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon 
                    size={20} 
                    className={`shrink-0 ${isActive ? 'text-[#C99563]' : item.highlight ? 'text-[#8B5E3C]' : 'text-[#8B5E3C]'}`} 
                  />
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-[#C99563] text-[#FFFDF8]">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Ledger Note */}
      {!collapsed ? (
        <div className="p-3 m-3 rounded-xl bg-[#F7F3EA] border border-[#E4D7C8]/80 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#8B5E3C] mb-1">
            <Sparkles size={13} className="text-[#C99563]" />
            <span>Digital Business Records</span>
          </div>
          <p className="text-[11px] text-[#2C211B]/80 italic">
            "Never lose a calculation again."
          </p>
        </div>
      ) : (
        <div className="p-2 mb-2 flex justify-center text-[#C99563]" title="Never lose a calculation again.">
          <Sparkles size={16} />
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:block h-screen sticky top-0 transition-all duration-200 z-30 shrink-0 ${collapsed ? 'w-18' : 'w-64'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
