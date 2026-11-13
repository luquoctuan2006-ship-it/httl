import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Calendar,
  MapPin,
  Users,
  Wallet,
  Sliders,
  Sparkles,
  ShieldAlert,
  Settings,
  UserCog,
  LogOut,
  X,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

type AppRole = 'user' | 'admin';

interface SidebarProps {
  currentTab: string;
  userName: string;
  userRole: AppRole;
  onLogout: () => void;
  onSelectTab: (tab: string) => void;
  alertCount?: number;
  tripCount?: number;
  onOpenAIPlanner: () => void;
  onOpenAccount?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  userName,
  userRole,
  onLogout,
  onSelectTab,
  alertCount = 0,
  tripCount = 0,
  onOpenAIPlanner,
  onOpenAccount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const mainNav = userRole === 'admin'
    ? [
        { id: 'dashboard', label: 'Dashboard / Thống kê', icon: LayoutDashboard },
        { id: 'users', label: 'Quản lý người dùng', icon: Users },
        { id: 'planning', label: 'Dữ liệu hoạch định', icon: MapPin },
        { id: 'rules', label: 'Quy tắc điều phối', icon: Sliders },
        { id: 'ai', label: 'Quản lý AI Engine', icon: Sparkles },
        { id: 'monitoring', label: 'Giám sát lịch trình', icon: ShieldAlert, badge: alertCount },
        { id: 'system', label: 'Hệ thống', icon: Settings },
      ]
    : [
        { id: 'dashboard', label: 'Bảng điều phối', icon: LayoutDashboard },
        { id: 'trips', label: 'Chuyến đi', icon: Compass, badge: tripCount },
        { id: 'schedule', label: 'Lịch trình', icon: Calendar },
        { id: 'map', label: 'Bản đồ tuyến', icon: MapPin },
        { id: 'members', label: 'Thành viên', icon: Users },
        { id: 'budget', label: 'Ngân sách', icon: Wallet },
      ];

  const isAdmin = userRole === 'admin';
  const asideBg = isAdmin
    ? 'bg-[#0B1320] text-slate-300 border-r border-slate-800/80'
    : 'bg-gradient-to-b from-slate-950 via-sky-950 to-emerald-950 text-sky-100 border-r border-white/10';

  const renderSidebarBody = (mobileDrawer: boolean) => (
    <>
      {/* Brand Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between gap-3 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-900/30 text-white font-bold shrink-0">
            <svg className="w-6 h-6 stroke-white fill-none stroke-[2]" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="m14.5 9.5-5 2 2 5 5-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-white font-extrabold text-lg tracking-tight flex items-center gap-1.5">
              <span>Voyager</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                AI
              </span>
            </div>
            <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">
              TRAVEL OPS
            </p>
          </div>
        </div>

        {mobileDrawer && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Đóng thanh điều hướng"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-3 pt-4 shrink-0">
        <div className={`rounded-xl border px-3 py-2 text-center ${isAdmin ? 'border-slate-700 bg-slate-900/80' : 'border-sky-300/30 bg-white/8 backdrop-blur-sm'}`}>
          <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isAdmin ? 'text-slate-400' : 'text-sky-200/90'}`}>Vai trò</div>
          <div className="mt-1 text-sm font-bold text-white">{userRole === 'admin' ? 'Admin' : 'User'}</div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <nav className="space-y-1">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile?.();
                }}
                className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? (isAdmin ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40 font-semibold' : 'bg-sky-500 text-white shadow-md shadow-sky-900/30 font-semibold')
                    : (isAdmin ? 'text-slate-300 hover:text-white hover:bg-slate-800/60' : 'text-sky-100/80 hover:text-white hover:bg-white/8')
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 tabular-nums ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Quick AI Planner & Offline Install Buttons */}
      <div className="px-3 pb-3 space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            onOpenAIPlanner();
            onCloseMobile?.();
          }}
          className={`w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition active:scale-98 shadow-md ${
            isAdmin
              ? 'bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white shadow-teal-950/50'
              : 'bg-gradient-to-r from-sky-500 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-white shadow-sky-950/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tạo tour mới (AI)</span>
        </button>

        <PWAInstallButton />
      </div>

      {/* User Dispatcher Profile */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 shrink-0">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/50 transition gap-1">
          <button
            type="button"
            onClick={() => {
              onOpenAccount?.();
              onCloseMobile?.();
            }}
            disabled={!onOpenAccount}
            title="Cài đặt tài khoản (đổi tên, đổi mật khẩu)"
            className="flex items-center gap-3 overflow-hidden text-left flex-1 rounded-lg hover:bg-slate-800/60 p-1 transition cursor-pointer disabled:cursor-default min-h-[44px]"
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-teal-700 border border-teal-500/50 flex items-center justify-center font-bold text-xs text-white uppercase shadow">
                {userName.split(' ').map((n) => n[0]).filter(Boolean).slice(-2).join('') || 'U'}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0B1320] rounded-full"></span>
            </div>
            <div className="truncate">
              <div className="text-sm font-bold text-white leading-tight truncate" title={userName}>{userName}</div>
              <div className="text-xs text-emerald-400 font-medium truncate">
                {userRole === 'admin' ? 'Điều phối viên (Admin)' : 'Khách du lịch (User)'}
              </div>
            </div>
          </button>

          {onOpenAccount && (
            <button
              type="button"
              onClick={() => {
                onOpenAccount();
                onCloseMobile?.();
              }}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-teal-300 hover:bg-teal-500/10 rounded-lg transition shrink-0"
              aria-label="Cài đặt tài khoản"
              title="Cài đặt tài khoản"
            >
              <UserCog className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onCloseMobile?.();
              onLogout();
            }}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition shrink-0"
            aria-label="Đăng xuất khỏi hệ thống"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className={`hidden lg:flex w-64 ${asideBg} flex-col h-screen shrink-0 select-none`}>
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile / Tablet slide-over drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Thanh điều hướng chính"
        >
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
          />
          <aside className={`relative z-10 w-72 max-w-[85vw] h-[100dvh] ${asideBg} flex flex-col shadow-2xl select-none`}>
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
