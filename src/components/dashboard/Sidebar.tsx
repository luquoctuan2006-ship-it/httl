import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Calendar,
  MapPin,
  Users,
  Wallet,
  Plus,
  Cpu,
  UserCog,
  LogOut,
  X,
  KeyRound,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

type AppRole = 'user' | 'admin';

interface SidebarProps {
  currentTab: string;
  userName: string;
  userRole: AppRole;
  onLogout: () => void;
  onSelectTab: (tab: string) => void;
  tripCount?: number;
  onOpenAIPlanner: () => void;
  onOpenJoinTrip?: () => void;
  hideBudgetTab?: boolean;
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
  tripCount = 0,
  onOpenAIPlanner,
  onOpenJoinTrip,
  hideBudgetTab = false,
  onOpenAccount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const userNav = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'schedule', label: 'Lịch trình', icon: Calendar },
    { id: 'map', label: 'Bản đồ tuyến', icon: MapPin },
    { id: 'members', label: 'Thành viên', icon: Users },
    ...(!hideBudgetTab ? [{ id: 'budget', label: 'Ngân sách', icon: Wallet }] : []),
    { id: 'trips', label: 'Danh sách chuyến', icon: Compass, badge: tripCount },
  ];

  const mainNav = userRole === 'admin'
    ? [
        { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
        { id: 'users', label: 'Quản lý người dùng', icon: Users },
        { id: 'trips', label: 'Quản lý chuyến đi', icon: Compass, badge: tripCount },
        { id: 'ai', label: 'Quản lý AI', icon: Cpu },
      ]
    : userNav;

  const isAdmin = userRole === 'admin';
  const asideBg = isAdmin
    ? 'bg-[#0B1320] text-slate-300 border-r border-slate-800/80'
    : 'bg-slate-950 text-slate-300 border-r border-slate-800/80';

  const renderSidebarBody = (mobileDrawer: boolean) => (
    <>
      {/* Brand Wordmark */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shrink-0">
            <svg className="w-4.5 h-4.5 stroke-white fill-none stroke-[2]" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="m14.5 9.5-5 2 2 5 5-2z" />
            </svg>
          </div>
          <span className="text-white font-bold text-base tracking-tight whitespace-nowrap">
            Voyager
          </span>
        </div>

        {mobileDrawer && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Đóng thanh điều hướng"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <nav className="space-y-1" aria-label="Điều hướng chính">
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
                className={`w-full min-h-[40px] flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs font-mono tabular-nums shrink-0 ${
                      isActive ? 'text-teal-100' : 'text-slate-500'
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

      {/* Quick Actions */}
      <div className="px-3 pb-3 space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            onOpenAIPlanner();
            onCloseMobile?.();
          }}
          className="w-full min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs bg-teal-600 hover:bg-teal-500 text-white transition cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Tạo chuyến đi</span>
        </button>

        {!isAdmin && onOpenJoinTrip && (
          <button
            type="button"
            onClick={() => {
              onOpenJoinTrip();
              onCloseMobile?.();
            }}
            className="w-full min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold text-xs border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition cursor-pointer whitespace-nowrap"
          >
            <KeyRound className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>Tham gia bằng mã</span>
          </button>
        )}

        <PWAInstallButton />
      </div>

      {/* Account Footer */}
      <div className="p-3 border-t border-slate-800/80 shrink-0">
        <div className="flex items-center justify-between gap-1 rounded-lg p-1.5 hover:bg-slate-900/70 transition">
          <button
            type="button"
            onClick={() => {
              onOpenAccount?.();
              onCloseMobile?.();
            }}
            disabled={!onOpenAccount}
            title="Cài đặt tài khoản (đổi tên, đổi mật khẩu)"
            className="flex items-center gap-2.5 overflow-hidden text-left flex-1 rounded-md p-1 transition cursor-pointer disabled:cursor-default min-h-[40px]"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-teal-300 uppercase shrink-0">
              {userName.split(' ').map((n) => n[0]).filter(Boolean).slice(-2).join('') || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white leading-tight truncate" title={userName}>
                {userName}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {userRole === 'admin' ? 'Quản trị viên' : 'Tài khoản cá nhân'}
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
              className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition shrink-0 cursor-pointer"
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
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition shrink-0 cursor-pointer"
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
      <aside className={`hidden lg:flex w-60 ${asideBg} flex-col h-screen shrink-0 select-none`}>
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
            className="fixed inset-0 bg-slate-950/65"
          />
          <aside className={`relative z-10 w-64 max-w-[85vw] h-[100dvh] ${asideBg} flex flex-col shadow-2xl select-none`}>
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
