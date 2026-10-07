import React from 'react';
import { Search, Plus, ChevronRight } from 'lucide-react';
import { TripData } from '../types/travel';

type AppRole = 'user' | 'admin';

interface HeaderProps {
  trip: TripData;
  role: AppRole;
  onOpenCreateTripModal: () => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
}

export const Header: React.FC<HeaderProps> = ({
  trip,
  role,
  onOpenCreateTripModal,
  onSearchChange,
  searchQuery,
}) => {
  const isAdminMode = role === 'admin';
  return (
    <header className="bg-white border-b border-slate-200/90 px-6 py-4 sticky top-0 z-30">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Breadcrumbs & Title */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <span>{isAdminMode ? 'ADMIN OPS' : 'USER PORTAL'}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-teal-700 font-bold">{trip.code}</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {trip.title}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {trip.status}
            </span>
          </div>
        </div>

        {/* Right: Search, Notifications & Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Global Search Bar */}
          <div className="relative w-64 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm điểm đến, thành viên... ⌘K"
              className="w-full pl-9 pr-10 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-white border border-slate-200 text-slate-400 font-mono px-1.5 py-0.5 rounded shadow-xs">
              ⌘K
            </kbd>
          </div>

          {!isAdminMode && (
            <button
              onClick={onOpenCreateTripModal}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-teal-700/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo chuyến đi</span>
            </button>
          )}

        </div>
      </div>
    </header>
  );
};
