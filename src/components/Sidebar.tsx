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
  MoreVertical
} from 'lucide-react';

type AppRole = 'user' | 'admin';

interface SidebarProps {
  currentTab: string;
  userName: string;
  userRole: AppRole;
  onLogout: () => void;
  onSelectTab: (tab: string) => void;
  alertCount?: number;
  tripCount?: number;
  onOpenProjectDocs: () => void;
  onOpenAIPlanner: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  userName,
  userRole,
  onLogout,
  onSelectTab,
  alertCount = 3,
  tripCount = 0,
  onOpenProjectDocs,
  onOpenAIPlanner,
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

  return (
    <aside className={`w-64 ${isAdmin ? 'bg-[#0B1320] text-slate-300 border-r border-slate-800/80' : 'bg-gradient-to-b from-slate-950 via-sky-950 to-emerald-950 text-sky-100 border-r border-white/10'} flex flex-col h-screen shrink-0 select-none`}>
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-800/60">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-900/30 text-white font-bold">
          <svg className="w-6 h-6 stroke-white fill-none stroke-[2]" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="m14.5 9.5-5 2 2 5 5-2z" />
          </svg>
        </div>
        <div>
          <div className="text-white font-extrabold text-lg tracking-tight flex items-center gap-1.5">
            Voyager
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">AI</span>
          </div>
          <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">
            TRAVEL OPS
          </p>
        </div>
      </div>

      <div className="px-3 pt-4">
        <div className={`rounded-xl border px-3 py-2 text-center ${isAdmin ? 'border-slate-700 bg-slate-900/80' : 'border-sky-300/30 bg-white/8 backdrop-blur-sm'}`}>
          <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isAdmin ? 'text-slate-400' : 'text-sky-200/90'}`}>Vai trò</div>
          <div className={`mt-1 text-sm font-bold ${isAdmin ? 'text-white' : 'text-white'}`}>{userRole === 'admin' ? 'Admin' : 'User'}</div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <div>
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                    isActive
                      ? (isAdmin ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40 font-semibold' : 'bg-sky-500 text-white shadow-md shadow-sky-900/30 font-semibold')
                      : (isAdmin ? 'text-slate-300 hover:text-white hover:bg-slate-800/60' : 'text-sky-100/80 hover:text-white hover:bg-white/8')
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
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

      </div>

      {/* User Dispatcher Profile */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60 transition cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-xs text-white">
                ML
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0B1320] rounded-full"></span>
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">{userName}</div>
              <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                {userRole === 'admin' ? 'Điều phối viên' : 'User portal'}
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
            aria-label="Đăng xuất"
            title="Đăng xuất"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
