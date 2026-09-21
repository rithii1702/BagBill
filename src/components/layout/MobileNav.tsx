import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FilePlus2, BookOpenText, Users, ShoppingBag } from 'lucide-react';

export const MobileNav: React.FC = () => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FFFDF8] border-t border-[#E4D7C8] px-2 py-1.5 flex items-center justify-around shadow-lg">
      <NavLink
        to="/dashboard"
        className={({ isActive }) => `
          flex flex-col items-center py-1 px-2 rounded-xl text-[11px] font-bold transition-colors
          ${isActive ? 'text-[#3B2921]' : 'text-[#8B5E3C] hover:text-[#3B2921]'}
        `}
      >
        <LayoutDashboard size={20} className="mb-0.5" />
        <span>Home</span>
      </NavLink>

      <NavLink
        to="/products"
        className={({ isActive }) => `
          flex flex-col items-center py-1 px-2 rounded-xl text-[11px] font-bold transition-colors
          ${isActive ? 'text-[#3B2921]' : 'text-[#8B5E3C] hover:text-[#3B2921]'}
        `}
      >
        <ShoppingBag size={20} className="mb-0.5" />
        <span>Bags</span>
      </NavLink>

      {/* Prominent Center Create Bill */}
      <NavLink
        to="/create-bill"
        className="flex flex-col items-center -mt-5"
      >
        <div className="w-12 h-12 rounded-full bg-[#3B2921] border-3 border-[#FFFDF8] text-[#C99563] flex items-center justify-center shadow-lg hover:bg-[#4E372C] transition-transform active:scale-95">
          <FilePlus2 size={24} />
        </div>
        <span className="text-[10px] font-extrabold text-[#3B2921] mt-0.5">Create Bill</span>
      </NavLink>

      <NavLink
        to="/bills"
        className={({ isActive }) => `
          flex flex-col items-center py-1 px-2 rounded-xl text-[11px] font-bold transition-colors
          ${isActive ? 'text-[#3B2921]' : 'text-[#8B5E3C] hover:text-[#3B2921]'}
        `}
      >
        <BookOpenText size={20} className="mb-0.5" />
        <span>Ledger</span>
      </NavLink>

      <NavLink
        to="/parties"
        className={({ isActive }) => `
          flex flex-col items-center py-1 px-2 rounded-xl text-[11px] font-bold transition-colors
          ${isActive ? 'text-[#3B2921]' : 'text-[#8B5E3C] hover:text-[#3B2921]'}
        `}
      >
        <Users size={20} className="mb-0.5" />
        <span>Parties</span>
      </NavLink>
    </div>
  );
};
