import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Sliders,
  Sparkles,
  ShieldAlert,
  Settings,
  Database,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Car,
  Wallet,
  Calendar,
  Lock,
  Unlock,
  Eye,
  Filter,
  Download,
  Upload,
  ArrowRight,
  TrendingUp,
  Cpu,
  RefreshCw,
  Activity,
  Check,
  AlertCircle,
  FileText,
  Compass,
  Navigation,
  DollarSign
} from 'lucide-react';
import { TripData, Waypoint, TripMember, Activity as ActivityType } from '../types/travel';

// ============================================================================
// 1. DASHBOARD / THỐNG KÊ
// - Số User, Số chuyến đi, Số lịch trình được tạo, Số lần AI được sử dụng, Thống kê hoạt động
// ============================================================================
interface AdminDashboardProps {
  trip: TripData;
  trips: TripData[];
  firebaseStatus: 'loading' | 'connected' | 'error';
  onNavigate: (tab: string) => void;
  onOpenAIPlanner: () => void;
  onOpenAIOptimize: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardProps> = ({
  trip,
  trips = [],
  firebaseStatus,
  onNavigate,
  onOpenAIPlanner,
  onOpenAIOptimize,
}) => {
  // Thống kê tổng hợp
  const totalUsers = 24; // User cơ sở dữ liệu
  const activeUsers = 22;
  const lockedUsers = 2;

  const totalTrips = Math.max(trips.length, 3);
  const activeTripsCount = 1;
  const preparingTripsCount = 1;
  const completedTripsCount = 1;

  const allActivities = useMemo(() => trip.days.flatMap((d) => d.activities), [trip.days]);
  const totalSchedulesCreated = trip.days.length * totalTrips;
  const totalActivitiesCount = allActivities.length + 36;

  const totalAICalls = 42;
  const aiSuccessRate = 97.6;
  const timeSavedEstimate = '16.5 giờ';

  return (
    <div className="space-y-6">
      {/* Executive Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 text-white border border-slate-700/80 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-teal-500/20 text-teal-300 border border-teal-500/40">
                Admin Executive Console
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                Phiên bản v2.6 Ops
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Bảng điều khiển & Thống kê Quản trị
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              Tổng quan toàn diện các chỉ số người dùng, chuyến đi, lịch trình được tạo, tần suất sử dụng AI và sức khỏe hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenAIPlanner}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/30 transition active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Khởi tạo Tour với AI</span>
            </button>
            <button
              onClick={() => onNavigate('monitoring')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition active:scale-95"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Giám sát Lịch trình</span>
            </button>
          </div>
        </div>
      </section>

      {/* 5 Core Metric Cards as per specification */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Metric 1: Số User */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Số User</span>
            <div className="rounded-xl bg-sky-500/10 p-2 text-sky-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{totalUsers}</span>
            <span className="text-xs font-semibold text-emerald-400">{activeUsers} hoạt động</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {lockedUsers} tài khoản bị khóa • 4 Admin & Điều phối
          </p>
          <button
            onClick={() => onNavigate('users')}
            className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-sky-400 hover:text-sky-300 w-full"
          >
            <span>Quản lý User</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metric 2: Số chuyến đi */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Số Chuyến Đi</span>
            <div className="rounded-xl bg-teal-500/10 p-2 text-teal-400">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{totalTrips}</span>
            <span className="text-xs font-semibold text-teal-400">tour quản lý</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {activeTripsCount} Đang chạy • {preparingTripsCount} Chuẩn bị • {completedTripsCount} Xong
          </p>
          <button
            onClick={() => onNavigate('monitoring')}
            className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-teal-400 hover:text-teal-300 w-full"
          >
            <span>Xem tiến độ tour</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metric 3: Số lịch trình được tạo */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Lịch Trình Tạo</span>
            <div className="rounded-xl bg-purple-500/10 p-2 text-purple-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{totalSchedulesCreated}</span>
            <span className="text-xs font-semibold text-purple-400">ngày hành trình</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {totalActivitiesCount} hoạt động tham quan & di chuyển
          </p>
          <button
            onClick={() => onNavigate('planning')}
            className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-purple-400 hover:text-purple-300 w-full"
          >
            <span>Dữ liệu hoạch định</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metric 4: Số lần AI được sử dụng */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Lượt Dùng AI</span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{totalAICalls}</span>
            <span className="text-xs font-semibold text-amber-400">lượt prompt</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Tỷ lệ thành công {aiSuccessRate}% • Tiết kiệm {timeSavedEstimate}
          </p>
          <button
            onClick={() => onNavigate('ai')}
            className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400 hover:text-amber-300 w-full"
          >
            <span>Cấu hình AI Engine</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metric 5: Thống kê hoạt động hệ thống */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Hoạt Động Hệ Thống</span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">99.9%</span>
            <span className="text-xs font-semibold text-slate-400">uptime</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Firestore: {firebaseStatus === 'connected' ? 'Đã kết nối' : 'Đang xử lý'} • 0 lỗi nghiêm trọng
          </p>
          <button
            onClick={() => onNavigate('system')}
            className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400 hover:text-emerald-300 w-full"
          >
            <span>Nhật ký & Cấu hình</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Operational Breakdown Chart & System Status Feed */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Phân bổ dữ liệu & Lưu lượng hoạt động */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              Thống kê Phân bổ Hoạt động & Tài nguyên
            </h3>
            <span className="text-xs text-slate-400">7 ngày qua</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Tài nguyên Người dùng ({totalUsers} users)</span>
                <span className="font-bold text-sky-400">92% Hoạt động bình thường</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: '92%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Lịch trình & Hoạt động hoàn tất</span>
                <span className="font-bold text-teal-400">78% Đúng tiến độ</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: '78%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Tỷ lệ phản hồi AI Engine (Gemini 2.5 Flash)</span>
                <span className="font-bold text-amber-400">98% Dưới 1.5s</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '98%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Độ tin cậy dữ liệu quy tắc điều phối</span>
                <span className="font-bold text-purple-400">100% Tuân thủ</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Module Access Matrix */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <h3 className="text-base font-black text-white pb-3 border-b border-slate-800">
            Truy cập Nhanh Các Phân Hệ Quản Trị
          </h3>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <button
              onClick={() => onNavigate('users')}
              className="p-3 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-left transition group"
            >
              <Users className="w-4 h-4 text-sky-400 group-hover:scale-110 transition" />
              <strong className="block text-white mt-1.5 font-bold">Quản lý User</strong>
              <span className="text-[10px] text-slate-400">Xem, Khóa, Phân quyền</span>
            </button>

            <button
              onClick={() => onNavigate('planning')}
              className="p-3 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-left transition group"
            >
              <MapPin className="w-4 h-4 text-purple-400 group-hover:scale-110 transition" />
              <strong className="block text-white mt-1.5 font-bold">Dữ liệu Hoạch định</strong>
              <span className="text-[10px] text-slate-400">Địa điểm, Xe, Đơn giá</span>
            </button>

            <button
              onClick={() => onNavigate('rules')}
              className="p-3 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-left transition group"
            >
              <Sliders className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
              <strong className="block text-white mt-1.5 font-bold">Quy tắc Điều phối</strong>
              <span className="text-[10px] text-slate-400">Thời gian, Xung đột, Tối ưu</span>
            </button>

            <button
              onClick={() => onNavigate('ai')}
              className="p-3 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-left transition group"
            >
              <Sparkles className="w-4 h-4 text-teal-400 group-hover:scale-110 transition" />
              <strong className="block text-white mt-1.5 font-bold">Quản lý AI</strong>
              <span className="text-[10px] text-slate-400">Prompt, Lập lịch, Lỗi</span>
            </button>

            <button
              onClick={() => onNavigate('monitoring')}
              className="p-3 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-left transition group"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400 group-hover:scale-110 transition" />
              <strong className="block text-white mt-1.5 font-bold">Giám sát Lịch trình</strong>
              <span className="text-[10px] text-slate-400">Tour active & Sự cố</span>
            </button>

            <button
              onClick={() => onNavigate('system')}
              className="p-3 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-left transition group"
            >
              <Settings className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
              <strong className="block text-white mt-1.5 font-bold">Hệ thống</strong>
              <span className="text-[10px] text-slate-400">Cấu hình & Audit Log</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 2. QUẢN LÝ NGƯỜI DÙNG
// - Xem User
// - Khóa/mở khóa
// - Phân quyền (RBAC)
// ============================================================================
interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Admin' | 'Quản lý điều hành' | 'Điều phối viên' | 'Hướng dẫn viên' | 'Tài xế' | 'Khách du lịch';
  isLocked: boolean;
  createdAt: string;
  lastLogin: string;
}

export const AdminUsersManagementView: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([
    {
      id: 'usr-1',
      name: 'Lữ Quốc Tuấn (Admin)',
      email: 'luquoctuan2006@gmail.com',
      phone: '0905 123 456',
      role: 'Admin',
      isLocked: false,
      createdAt: '01/10/2026',
      lastLogin: 'Hôm nay 10:24',
    },
    {
      id: 'usr-2',
      name: 'Minh Lê',
      email: 'minh.le@voyager.vn',
      phone: '0912 345 678',
      role: 'Điều phối viên',
      isLocked: false,
      createdAt: '02/10/2026',
      lastLogin: 'Hôm nay 09:15',
    },
    {
      id: 'usr-3',
      name: 'Trần Bình',
      email: 'driver.binh@voyager.vn',
      phone: '0905 888 999',
      role: 'Tài xế',
      isLocked: false,
      createdAt: '03/10/2026',
      lastLogin: 'Hôm qua 17:30',
    },
    {
      id: 'usr-4',
      name: 'Nguyễn Văn An',
      email: 'an.nguyen@voyager.vn',
      phone: '0934 567 890',
      role: 'Hướng dẫn viên',
      isLocked: false,
      createdAt: '05/10/2026',
      lastLogin: 'Hôm nay 08:00',
    },
    {
      id: 'usr-5',
      name: 'Hải Trần',
      email: 'haitran@gmail.com',
      phone: '0988 111 222',
      role: 'Khách du lịch',
      isLocked: false,
      createdAt: '08/10/2026',
      lastLogin: 'Hôm qua 20:10',
    },
    {
      id: 'usr-6',
      name: 'Đặng Quốc Khánh',
      email: 'khanh.dang@gmail.com',
      phone: '0977 333 444',
      role: 'Khách du lịch',
      isLocked: true,
      createdAt: '10/10/2026',
      lastLogin: '3 ngày trước',
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter logic
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone.includes(searchQuery);
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Chức năng 1: Khóa / Mở khóa
  const handleToggleLock = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, isLocked: !u.isLocked } : u
      )
    );
  };

  // Chức năng 2: Phân quyền RBAC
  const handleChangeRole = (userId: string, newRole: ManagedUser['role']) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
              Quản trị Người dùng & Phân quyền
            </span>
            <span className="text-xs text-slate-400 font-semibold">{users.length} tài khoản</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Quản lý Người dùng & RBAC</h2>
          <p className="mt-1 text-xs text-slate-400 max-w-xl">
            Xem danh sách tài khoản, Khóa / Mở khóa tài khoản truy cập và thiết lập phân quyền vai trò người dùng trong hệ thống.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedUser(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/30 transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm User mới</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, email, số điện thoại..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Role Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'Admin', 'Điều phối viên', 'Hướng dẫn viên', 'Tài xế', 'Khách du lịch'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                roleFilter === r
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {r === 'all' ? 'Tất cả vai trò' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table: Xem User, Khóa/Mở khóa, Phân quyền */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
        <div className="hidden md:grid grid-cols-12 gap-3 bg-slate-800/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
          <span className="col-span-4">Người dùng (Xem User)</span>
          <span className="col-span-3">Phân quyền (RBAC)</span>
          <span className="col-span-2 text-center">Trạng thái khóa</span>
          <span className="col-span-2 text-center">Đăng nhập gần nhất</span>
          <span className="col-span-1 text-right">Khóa/Mở</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex flex-col md:grid md:grid-cols-12 gap-3 items-start md:items-center px-6 py-4 hover:bg-slate-800/40 transition text-sm"
            >
              {/* Xem User */}
              <div className="md:col-span-4 flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    user.isLocked
                      ? 'bg-rose-950 border border-rose-800 text-rose-300'
                      : 'bg-slate-800 border border-slate-700 text-teal-300'
                  }`}
                >
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-white font-bold">{user.name}</strong>
                    {user.isLocked && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-900/80 text-rose-300 border border-rose-700">
                        Đã khóa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{user.email} • {user.phone}</p>
                </div>
              </div>

              {/* Phân quyền */}
              <div className="md:col-span-3">
                <select
                  value={user.role}
                  onChange={(e) => handleChangeRole(user.id, e.target.value as ManagedUser['role'])}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold text-teal-300"
                >
                  <option value="Admin">Admin (Toàn quyền)</option>
                  <option value="Quản lý điều hành">Quản lý điều hành</option>
                  <option value="Điều phối viên">Điều phối viên</option>
                  <option value="Hướng dẫn viên">Hướng dẫn viên</option>
                  <option value="Tài xế">Tài xế</option>
                  <option value="Khách du lịch">Khách du lịch</option>
                </select>
              </div>

              {/* Trạng thái khóa */}
              <div className="md:col-span-2 flex justify-start md:justify-center">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                    user.isLocked
                      ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${user.isLocked ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                  {user.isLocked ? 'Đang bị khóa' : 'Đang hoạt động'}
                </span>
              </div>

              {/* Lần đăng nhập cuối */}
              <div className="md:col-span-2 text-xs text-slate-400 text-center font-mono">
                {user.lastLogin}
              </div>

              {/* Khóa / Mở khóa button */}
              <div className="md:col-span-1 flex items-center justify-end">
                <button
                  onClick={() => handleToggleLock(user.id)}
                  title={user.isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản này'}
                  className={`p-2 rounded-xl border text-xs transition font-bold flex items-center gap-1 ${
                    user.isLocked
                      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                      : 'bg-rose-600/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
                  }`}
                >
                  {user.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 3. QUẢN LÝ DỮ LIỆU HOẠCH ĐỊNH
// - Địa điểm
// - Thời gian hoạt động
// - Khoảng cách/thời gian di chuyển
// - Phương tiện
// - Chi phí tham khảo
// ============================================================================
export const AdminPlanningDataView: React.FC<{ trip: TripData }> = ({ trip }) => {
  const [activeSubTab, setActiveSubTab] = useState<'locations' | 'hours' | 'distance' | 'vehicles' | 'costs'>('locations');

  // 1. Địa điểm
  const [locations, setLocations] = useState<Waypoint[]>(trip.waypoints);

  // 2. Thời gian hoạt động
  const operatingHours = [
    { place: 'Bà Nà Hills', open: '07:30', close: '21:00', duration: '4 - 5 giờ', note: 'Nên đến trước 09:00 để tránh đông cáp treo' },
    { place: 'Đại Nội Huế', open: '08:00', close: '17:30', duration: '2.5 - 3 giờ', note: 'Mở cửa tất cả các ngày trong tuần' },
    { place: 'Chùa Thiên Mụ', open: '06:30', close: '18:00', duration: '1 giờ', note: 'Trang phục lịch sự' },
    { place: 'Bán đảo Sơn Trà', open: '06:00', close: '19:00', duration: '2 giờ', note: 'Hạn chế đi sau 18:00 khi trời tối sương mù' },
    { place: 'Đèo Hải Vân', open: '24/24', close: '24/24', duration: '45 phút ngắm cảnh', note: 'Điểm dừng chân Đỉnh đèo Hải Vân Quan' },
  ];

  // 3. Khoảng cách & Thời gian di chuyển
  const distanceMatrix = [
    { from: 'Trung tâm Đà Nẵng', to: 'Bà Nà Hills', distance: '32 km', estTime: '45 phút', road: 'Tuyến QL14B & Tuyến Bà Nà - Suối Mơ' },
    { from: 'Đà Nẵng', to: 'Đèo Hải Vân', distance: '28 km', estTime: '40 phút', road: 'Tuyến ven biển Nguyễn Tất Thành' },
    { from: 'Đỉnh Đèo Hải Vân', to: 'Vịnh Lăng Cô', distance: '16 km', estTime: '25 phút', road: 'Đoạn đổ đèo dốc uốn lượn' },
    { from: 'Vịnh Lăng Cô', to: 'Đại Nội Huế', distance: '65 km', estTime: '75 phút', road: 'Quốc lộ 1A thông thoáng' },
    { from: 'Đại Nội Huế', to: 'Chùa Thiên Mụ', distance: '5 km', estTime: '12 phút', road: 'Đường Lê Duẩn & Kim Long dọc Sông Hương' },
  ];

  // 4. Phương tiện
  const vehicles = [
    { type: 'Xe du lịch 4–7 chỗ', speedAvg: '60 km/h', capacity: '4 - 6 khách', consumption: '8 lít / 100 km', status: 'Sẵn sàng' },
    { type: 'Xe 16 chỗ (Ford Transit)', speedAvg: '55 km/h', capacity: '10 - 15 khách', consumption: '11 lít / 100 km', status: 'Sẵn sàng' },
    { type: 'Xe 29 chỗ (Hyundai County)', speedAvg: '50 km/h', capacity: '18 - 28 khách', consumption: '16 lít / 100 km', status: 'Đang vận hành (Tour VN-1024)' },
    { type: 'Xe 45 chỗ (Universe)', speedAvg: '48 km/h', capacity: '35 - 44 khách', consumption: '24 lít / 100 km', status: 'Sẵn sàng' },
  ];

  // 5. Chi phí tham khảo
  const referenceCosts = [
    { category: 'Vé tham quan', item: 'Vé Cáp treo & Cầu Vàng Bà Nà', price: '950.000 ₫ / người', unit: 'Vé trọn gói', note: 'Bao gồm buffet trưa' },
    { category: 'Vé tham quan', item: 'Vé tham quan Hoàng Cung Huế', price: '200.000 ₫ / người', unit: 'Vé cổng', note: 'Miễn phí trẻ dưới 1m' },
    { category: 'Khách sạn', item: 'Khách sạn 4 sao ven biển Đà Nẵng', price: '1.200.000 ₫ / phòng / đêm', unit: 'Phòng Deluxe', note: 'Bao gồm ăn sáng' },
    { category: 'Khách sạn', item: 'Khách sạn boutique trung tâm Huế', price: '850.000 ₫ / phòng / đêm', unit: 'Phòng Superior', note: 'Gần sông Hương' },
    { category: 'Ăn uống', item: 'Suất ăn nhà hàng đặc sản địa phương', price: '180.000 ₫ / suất', unit: 'Khách', note: 'Thực đơn 6 món' },
    { category: 'Vận chuyển', item: 'Phí cầu đường & Hầm Hải Vân', price: '110.000 ₫ / lượt', unit: 'Xe 29 chỗ', note: 'Trạm BOT' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
            Cơ sở Dữ liệu Hoạch định
          </span>
          <span className="text-xs text-slate-400 font-semibold">Travel Knowledge Base</span>
        </div>
        <h2 className="mt-2 text-2xl font-black text-white">Quản lý Dữ liệu Hoạch định Hành trình</h2>
        <p className="mt-1 text-xs text-slate-400 max-w-2xl">
          Cơ sở dữ liệu định mức làm đầu vào cho thuật toán AI và Điều phối viên: Địa điểm, Giờ mở cửa, Cự ly ma trận, Định mức xe và Chi phí tham khảo chuẩn.
        </p>

        {/* 5 Subtabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {[
            { id: 'locations', label: '1. Địa điểm', icon: MapPin },
            { id: 'hours', label: '2. Thời gian hoạt động', icon: Clock },
            { id: 'distance', label: '3. Khoảng cách & Di chuyển', icon: Navigation },
            { id: 'vehicles', label: '4. Phương tiện', icon: Car },
            { id: 'costs', label: '5. Chi phí tham khảo', icon: Wallet },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtab 1: Địa điểm */}
      {activeSubTab === 'locations' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {locations.map((wp) => (
            <div key={wp.id} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-black text-teal-400">{wp.code}</span>
                  <h3 className="font-black text-white text-base mt-1">{wp.name}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Tọa độ: {wp.lat}, {wp.lng}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                  {wp.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subtab 2: Thời gian hoạt động */}
      {activeSubTab === 'hours' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
          <div className="grid grid-cols-12 gap-3 bg-slate-800/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <span className="col-span-4">Điểm tham quan</span>
            <span className="col-span-3">Giờ mở / Đóng cửa</span>
            <span className="col-span-2">Thời lượng khuyến nghị</span>
            <span className="col-span-3">Ghi chú điều phối</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {operatingHours.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-center px-6 py-4 text-xs">
                <span className="col-span-4 font-bold text-white text-sm">{item.place}</span>
                <span className="col-span-3 text-teal-300 font-mono font-bold">{item.open} — {item.close}</span>
                <span className="col-span-2 text-amber-300 font-bold">{item.duration}</span>
                <span className="col-span-3 text-slate-400">{item.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtab 3: Khoảng cách & Thời gian di chuyển */}
      {activeSubTab === 'distance' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
          <div className="grid grid-cols-12 gap-3 bg-slate-800/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <span className="col-span-4">Chặng xuất phát ➔ Điểm đến</span>
            <span className="col-span-2">Cự ly chuẩn</span>
            <span className="col-span-2">Thời gian ước tính</span>
            <span className="col-span-4">Tuyến đường huyết mạch</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {distanceMatrix.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-center px-6 py-4 text-xs">
                <span className="col-span-4 font-bold text-white">
                  {item.from} <span className="text-teal-400">➔</span> {item.to}
                </span>
                <span className="col-span-2 font-mono font-bold text-teal-300">{item.distance}</span>
                <span className="col-span-2 font-bold text-purple-300">{item.estTime}</span>
                <span className="col-span-4 text-slate-400">{item.road}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtab 4: Phương tiện */}
      {activeSubTab === 'vehicles' && (
        <div className="grid gap-4 md:grid-cols-2">
          {vehicles.map((v, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">{v.type}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-800">
                  {v.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl bg-slate-800/60 p-2.5">
                  <span className="text-slate-400 block text-[10px]">Tốc độ TB</span>
                  <strong className="text-teal-400">{v.speedAvg}</strong>
                </div>
                <div className="rounded-xl bg-slate-800/60 p-2.5">
                  <span className="text-slate-400 block text-[10px]">Sức chứa</span>
                  <strong className="text-white">{v.capacity}</strong>
                </div>
                <div className="rounded-xl bg-slate-800/60 p-2.5">
                  <span className="text-slate-400 block text-[10px]">Tiêu hao</span>
                  <strong className="text-amber-400">{v.consumption}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subtab 5: Chi phí tham khảo */}
      {activeSubTab === 'costs' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
          <div className="grid grid-cols-12 gap-3 bg-slate-800/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <span className="col-span-2">Hạng mục</span>
            <span className="col-span-4">Khoản mục chi tiêu</span>
            <span className="col-span-3">Đơn giá tham khảo</span>
            <span className="col-span-3">Ghi chú định mức</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {referenceCosts.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-center px-6 py-4 text-xs">
                <span className="col-span-2 font-bold text-teal-400">{item.category}</span>
                <span className="col-span-4 font-bold text-white">{item.item}</span>
                <span className="col-span-3 font-mono font-bold text-amber-300">{item.price}</span>
                <span className="col-span-3 text-slate-400">{item.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


// ============================================================================
// 4. QUẢN LÝ QUY TẮC ĐIỀU PHỐI
// - Quy tắc thời gian
// - Giới hạn ngân sách
// - Thời gian di chuyển
// - Xung đột lịch trình
// - Điều kiện tối ưu
// ============================================================================
export const AdminDispatchRulesView: React.FC = () => {
  // 1. Quy tắc thời gian
  const [bufferMinutes, setBufferMinutes] = useState('20');
  const [startHour, setStartHour] = useState('07:30');
  const [endHour, setEndHour] = useState('21:30');

  // 2. Giới hạn ngân sách
  const [budgetCapDaily, setBudgetCapDaily] = useState('8.000.000 ₫');
  const [budgetAlertThreshold, setBudgetAlertThreshold] = useState('90%');
  const [contingencyPercent, setContingencyPercent] = useState('10%');

  // 3. Thời gian di chuyển
  const [citySpeedLimit, setCitySpeedLimit] = useState('40 km/h');
  const [highwaySpeedLimit, setHighwaySpeedLimit] = useState('60 km/h');
  const [passSpeedLimit, setPassSpeedLimit] = useState('35 km/h');

  // 4. Xung đột lịch trình
  const [conflictChecks, setConflictChecks] = useState({
    overlapTime: true,
    openingHoursMismatch: true,
    impossibleTransit: true,
    hotelCheckinConflict: true,
  });

  // 5. Điều kiện tối ưu
  const [optimizationPriorities, setOptimizationPriorities] = useState({
    costSaving: true,
    transitTimeMinimization: true,
    avoidHotNoonSun: true,
    elderlyPacing: false,
  });

  const [isSaved, setIsSaved] = useState(false);

  const handleSaveRules = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Quy tắc & Ràng buộc Hệ thống
          </span>
          <span className="text-xs text-slate-400 font-semibold">Dispatch Rule Engine</span>
        </div>
        <h2 className="mt-2 text-2xl font-black text-white">Quản lý Quy tắc Điều phối Lịch trình</h2>
        <p className="mt-1 text-xs text-slate-400 max-w-2xl">
          Thiết lập các tiêu chuẩn vận hành: Ràng buộc thời gian đệm, Trần ngân sách, Quy tắc tốc độ di chuyển, Động cơ phát hiện xung đột và Tiêu chí tối ưu AI.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quy tắc 1: Thời gian */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-black text-base pb-3 border-b border-slate-800">
            <Clock className="w-4 h-4 text-teal-400" />
            <h3>1. Quy tắc Thời gian (Time Buffer)</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-bold">Thời gian đệm tối thiểu giữa 2 hoạt động</label>
              <input
                type="text"
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <span className="text-[10px] text-slate-500">Phút chuẩn bị lên xuống xe và tập trung đoàn</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Giờ khởi hành sớm nhất</label>
                <input
                  type="text"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Giờ kết thúc tour muộn nhất</label>
                <input
                  type="text"
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quy tắc 2: Giới hạn ngân sách */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-black text-base pb-3 border-b border-slate-800">
            <Wallet className="w-4 h-4 text-amber-400" />
            <h3>2. Giới hạn Ngân sách (Budget Thresholds)</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-bold">Hạn mức chi phí trần mỗi ngày</label>
              <input
                type="text"
                value={budgetCapDaily}
                onChange={(e) => setBudgetCapDaily(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Ngưỡng cảnh báo chi tiêu</label>
                <input
                  type="text"
                  value={budgetAlertThreshold}
                  onChange={(e) => setBudgetAlertThreshold(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Tỷ lệ dự phòng rủi ro</label>
                <input
                  type="text"
                  value={contingencyPercent}
                  onChange={(e) => setContingencyPercent(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quy tắc 3: Thời gian di chuyển */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-black text-base pb-3 border-b border-slate-800">
            <Car className="w-4 h-4 text-purple-400" />
            <h3>3. Thời gian Di chuyển & Tốc độ An toàn</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-bold">Đô thị nội thành</label>
              <input
                type="text"
                value={citySpeedLimit}
                onChange={(e) => setCitySpeedLimit(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1 font-bold">Quốc lộ 1A</label>
              <input
                type="text"
                value={highwaySpeedLimit}
                onChange={(e) => setHighwaySpeedLimit(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1 font-bold">Cung đèo Hải Vân</label>
              <input
                type="text"
                value={passSpeedLimit}
                onChange={(e) => setPassSpeedLimit(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Hệ thống tự động cộng thêm 15% thời gian dự phòng khi phát hiện giờ cao điểm hoặc thời tiết mưa sương mù.
          </p>
        </div>

        {/* Quy tắc 4: Xung đột lịch trình */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-black text-base pb-3 border-b border-slate-800">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h3>4. Động cơ Phát hiện Xung đột Lịch trình</h3>
          </div>
          <div className="space-y-2 text-xs">
            {[
              { key: 'overlapTime', label: 'Cảnh báo trùng lặp giờ giữa 2 hoạt động liên tiếp' },
              { key: 'openingHoursMismatch', label: 'Cảnh báo khi xếp lịch ngoài giờ mở cửa của điểm tham quan' },
              { key: 'impossibleTransit', label: 'Cảnh báo thời gian di chuyển không khả thi so với cự ly GPS' },
              { key: 'hotelCheckinConflict', label: 'Cảnh báo xếp lịch nhận phòng trước 14:00 chưa xác nhận' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conflictChecks[item.key as keyof typeof conflictChecks]}
                  onChange={() =>
                    setConflictChecks((prev) => ({
                      ...prev,
                      [item.key]: !prev[item.key as keyof typeof conflictChecks],
                    }))
                  }
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="text-slate-300">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Quy tắc 5: Điều kiện tối ưu */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-white font-black text-base pb-3 border-b border-slate-800">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <h3>5. Tiêu chí & Trọng số Tối ưu hóa (AI Optimization Weights)</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          {[
            { key: 'costSaving', title: 'Ưu tiên Tiết kiệm Chi phí', desc: 'Chọn giờ vé rẻ, hạn chế phát sinh' },
            { key: 'transitTimeMinimization', title: 'Tối ưu Tuyến đường', desc: 'Rút ngắn quãng đường xe chạy' },
            { key: 'avoidHotNoonSun', title: 'Tránh Nắng gắt Buổi trưa', desc: 'Hạn chế ngoài trời 11:30 - 14:00' },
            { key: 'elderlyPacing', title: 'Nhịp độ Thong thả', desc: 'Tăng thời gian nghỉ ngơi cho đoàn' },
          ].map((opt) => (
            <label
              key={opt.key}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                optimizationPriorities[opt.key as keyof typeof optimizationPriorities]
                  ? 'bg-teal-950/60 border-teal-500/40 text-teal-200'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <strong className="font-bold">{opt.title}</strong>
                <input
                  type="checkbox"
                  checked={optimizationPriorities[opt.key as keyof typeof optimizationPriorities]}
                  onChange={() =>
                    setOptimizationPriorities((prev) => ({
                      ...prev,
                      [opt.key]: !prev[opt.key as keyof typeof optimizationPriorities],
                    }))
                  }
                  className="rounded text-teal-600"
                />
              </div>
              <p className="text-[11px] text-slate-400">{opt.desc}</p>
            </label>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleSaveRules}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/30 transition active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSaved ? '✓ Đã lưu toàn bộ quy tắc!' : 'Lưu Cấu hình Quy tắc'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 5. QUẢN LÝ AI
// - Theo dõi yêu cầu AI
// - Theo dõi kết quả lập lịch
// - Cấu hình tham số
// - Theo dõi lỗi
// ============================================================================
export const AdminAIManagementView: React.FC = () => {
  // 1. Cấu hình tham số
  const [modelChoice, setModelChoice] = useState('gemini-2.5-flash');
  const [temperature, setTemperature] = useState('0.4');
  const [maxTokens, setMaxTokens] = useState('4096');
  const [systemPrompt, setSystemPrompt] = useState(
    'Bạn là chuyên gia điều hành tour du lịch cao cấp tại miền Trung Việt Nam. Hãy lập lịch trình tối ưu cự ly, thời gian mở cửa, chi phí và nhịp sinh học khách.'
  );

  // 2. Theo dõi yêu cầu AI
  const aiRequests = [
    { id: 'req-101', time: '10:24 Hôm nay', user: 'Lữ Quốc Tuấn (Admin)', prompt: 'Tối ưu lịch trình ngày 3 tránh mưa đèo Hải Vân', status: 'Hoàn thành', latency: '1.2s' },
    { id: 'req-102', time: '09:15 Hôm nay', user: 'Minh Lê (Điều phối)', prompt: 'Lập tour 7 ngày Đà Nẵng - Huế cho đoàn 18 khách', status: 'Hoàn thành', latency: '2.8s' },
    { id: 'req-103', time: 'Hôm qua 16:40', user: 'Hệ thống Auto-Check', prompt: 'Kiểm tra xung đột giờ mở cửa Bà Nà Hills', status: 'Hoàn thành', latency: '0.9s' },
    { id: 'req-104', time: 'Hôm qua 11:20', user: 'Minh Lê (Điều phối)', prompt: 'Đề xuất nhà hàng ăn chay gần Chùa Thiên Mụ', status: 'Hoàn thành', latency: '1.4s' },
  ];

  // 3. Theo dõi kết quả lập lịch
  const scheduleOutputs = [
    { title: 'Tối ưu đèo Hải Vân (Tour VN-1024)', confidence: '94%', costSaved: '640.000 ₫', timeSaved: '45 phút', applied: true },
    { title: 'Khởi tạo Tour Miền Trung 7 ngày', confidence: '98%', costSaved: '2.400.000 ₫', timeSaved: '3.5 giờ', applied: true },
    { title: 'Đổi thứ tự tham quan Đại Nội - Thiên Mụ', confidence: '91%', costSaved: '150.000 ₫', timeSaved: '20 phút', applied: false },
  ];

  // 4. Theo dõi lỗi
  const aiErrors = [
    { time: '05/10 14:20', code: 'TIMEOUT_408', detail: 'Quá thời gian phản hồi mạng khi tải hình ảnh vệ tinh', resolved: true },
    { time: '02/10 09:12', code: 'JSON_SYNTAX_FALLBACK', detail: 'Mô hình trả thiếu ngoặc nhọn, fallback parser đã tự sửa', resolved: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/40">
            Trung tâm Điều khiển Trí tuệ Nhân tạo
          </span>
          <span className="text-xs text-slate-400 font-semibold">Gemini Travel Agent Core</span>
        </div>
        <h2 className="mt-2 text-2xl font-black text-white">Quản lý AI & Động cơ Tối ưu hóa</h2>
        <p className="mt-1 text-xs text-slate-400 max-w-2xl">
          Theo dõi các lượt prompt gửi đến Gemini, đánh giá kết quả lập lịch, tinh chỉnh tham số model và giám sát tỷ lệ lỗi API.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Cấu hình tham số AI - 5 cols */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <h3 className="font-black text-white text-base pb-3 border-b border-slate-800 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-400" />
            Cấu hình Tham số AI Model
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 font-bold block mb-1">Mô hình AI (Model Version)</label>
              <select
                value={modelChoice}
                onChange={(e) => setModelChoice(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (Khuyến nghị - Nhanh & Chuẩn)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Tư duy sâu)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Temperature ({temperature})</label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full accent-teal-500"
                />
                <span className="text-[10px] text-slate-500">Thấp = Lịch trình chính xác</span>
              </div>
              <div>
                <label className="text-slate-300 font-bold block mb-1">Max Output Tokens</label>
                <input
                  type="text"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">System Prompt Định hướng</label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Theo dõi kết quả lập lịch - 7 cols */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <h3 className="font-black text-white text-base pb-3 border-b border-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Theo dõi Kết quả Lập lịch AI
          </h3>

          <div className="space-y-3">
            {scheduleOutputs.map((item, idx) => (
              <div key={idx} className="rounded-xl bg-slate-800/60 p-4 border border-slate-700/60 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-white text-sm">{item.title}</strong>
                  <span className="px-2 py-0.5 rounded-full font-bold bg-teal-950 text-teal-300 border border-teal-800">
                    Độ tin cậy: {item.confidence}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-800 p-2 text-slate-300">
                    Chi phí giảm: <strong className="text-amber-400">{item.costSaved}</strong>
                  </div>
                  <div className="rounded-lg bg-slate-800 p-2 text-slate-300">
                    Thời gian rút ngắn: <strong className="text-teal-400">{item.timeSaved}</strong>
                  </div>
                  <div className="rounded-lg bg-slate-800 p-2 text-slate-300">
                    Trạng thái: <strong className={item.applied ? 'text-emerald-400' : 'text-slate-400'}>{item.applied ? 'Đã áp dụng' : 'Bản nháp'}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Theo dõi yêu cầu AI & Theo dõi lỗi */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Yêu cầu AI gần nhất (8 cols) */}
        <div className="lg:col-span-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
          <div className="bg-slate-800/80 px-6 py-3.5 border-b border-slate-700 flex justify-between items-center text-xs">
            <strong className="text-white font-bold uppercase tracking-wider">Nhật ký Yêu cầu AI (Requests Log)</strong>
            <span className="text-slate-400">{aiRequests.length} yêu cầu gần nhất</span>
          </div>
          <div className="divide-y divide-slate-800/60 text-xs">
            {aiRequests.map((req) => (
              <div key={req.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-teal-400 font-bold">{req.id}</span>
                    <strong className="text-white">{req.user}</strong>
                    <span className="text-[10px] text-slate-500 font-mono">{req.time}</span>
                  </div>
                  <p className="text-slate-300 mt-1">{req.prompt}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300">
                    {req.status}
                  </span>
                  <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{req.latency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Theo dõi lỗi AI (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-3">
          <h4 className="font-bold text-white text-xs uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Theo dõi Lỗi AI (Error Log)
          </h4>
          <div className="space-y-2 text-xs">
            {aiErrors.map((err, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-800/60 border border-rose-900/40 text-slate-300">
                <div className="flex justify-between items-center mb-1">
                  <strong className="font-mono text-rose-400">{err.code}</strong>
                  <span className="text-[10px] text-slate-500">{err.time}</span>
                </div>
                <p className="text-[11px] text-slate-400">{err.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 6. GIÁM SÁT LỊCH TRÌNH
// - Xem các chuyến đang hoạt động
// - Phát hiện lịch trình có vấn đề
// - Theo dõi trạng thái điều phối
// ============================================================================
export const AdminScheduleMonitoringView: React.FC<{ trip: TripData }> = ({ trip }) => {
  // 1. Các chuyến đang hoạt động
  const activeTrips = [
    {
      code: 'VN-1024',
      name: 'Khám phá miền Trung 7 ngày',
      route: 'Đà Nẵng ➔ Huế',
      day: 'Ngày 3 / 7',
      vehicle: 'Xe 29 chỗ (43B-028.99)',
      driver: 'Trần Bình',
      guide: 'Nguyễn Văn An',
      guestCount: 18,
      status: 'Đang vận hành',
      health: 'Bình thường',
    },
    {
      code: 'VN-2048',
      name: 'Hành trình Di sản Hội An - Mỹ Sơn',
      route: 'Đà Nẵng ➔ Hội An',
      day: 'Ngày 1 / 3',
      vehicle: 'Xe 16 chỗ (43B-015.42)',
      driver: 'Lê Văn Hoàng',
      guide: 'Trần Thị Mai',
      guestCount: 12,
      status: 'Chuẩn bị xuất bến',
      health: 'Bình thường',
    },
  ];

  // 2. Phát hiện lịch trình có vấn đề
  const issues = [
    {
      id: 'iss-1',
      tripCode: 'VN-1024',
      severity: 'warning',
      title: 'Dự báo mưa dông trên đèo Hải Vân lúc 14:00',
      description: 'Thời tiết mưa có thể làm giảm tốc độ xe xuống dưới 30 km/h, trễ 35 phút đến Vịnh Lăng Cô.',
      suggestion: 'Đã có gợi ý AI chuyển hướng qua Hầm Hải Vân hoặc tham quan Lăng Cô sớm hơn.',
    },
    {
      id: 'iss-2',
      tripCode: 'VN-1024',
      severity: 'info',
      title: 'Buffet trưa Bà Nà Hills đông vào khung giờ 12:00',
      description: 'Khuyến nghị đoàn di chuyển dùng bữa lúc 11:30 để tránh xếp hàng quá 20 phút.',
      suggestion: 'Thông báo đã gửi tới Hướng dẫn viên.',
    },
  ];

  // 3. Trạng thái điều phối
  const [dispatchStatus, setDispatchStatus] = useState<'normal' | 'attention' | 'critical'>('normal');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
            Giám sát Vận hành Trực tiếp
          </span>
          <span className="text-xs text-slate-400 font-semibold">Live Tour Operations Radar</span>
        </div>
        <h2 className="mt-2 text-2xl font-black text-white">Giám sát Lịch trình & Phát hiện Vấn đề</h2>
        <p className="mt-1 text-xs text-slate-400 max-w-2xl">
          Theo dõi toàn bộ các chuyến đi đang hoạt động, tự động phát hiện lịch trình bị chậm trễ hoặc gặp sự cố và kiểm soát trạng thái điều phối.
        </p>
      </div>

      {/* 1. Xem các chuyến đang hoạt động */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="font-black text-white text-base flex items-center gap-2">
            <Compass className="w-4 h-4 text-teal-400" />
            1. Các Chuyến Đi Đang Hoạt Động ({activeTrips.length})
          </h3>
          <span className="text-xs font-bold text-emerald-400">● 100% Đang giám sát</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {activeTrips.map((t) => (
            <div key={t.code} className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-black text-teal-400">{t.code}</span>
                  <h4 className="font-black text-white text-base mt-0.5">{t.name}</h4>
                  <p className="text-xs text-slate-300">{t.route} • <strong className="text-teal-300">{t.day}</strong></p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {t.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-700/60">
                <div className="text-slate-400">Phương tiện: <strong className="text-white block">{t.vehicle}</strong></div>
                <div className="text-slate-400">Tài xế: <strong className="text-white block">{t.driver}</strong></div>
                <div className="text-slate-400">Đoàn khách: <strong className="text-white block">{t.guestCount} người</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Phát hiện lịch trình có vấn đề & 3. Theo dõi trạng thái điều phối */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Phát hiện vấn đề (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-black text-white text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              2. Phát hiện Lịch trình Có Vấn đề ({issues.length})
            </h3>
            <span className="text-xs text-slate-400">Tự động quét bởi AI Radar</span>
          </div>

          <div className="space-y-3 text-xs">
            {issues.map((iss) => (
              <div
                key={iss.id}
                className={`p-4 rounded-xl border ${
                  iss.severity === 'warning'
                    ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                    : 'bg-sky-950/40 border-sky-800/60 text-sky-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <strong className="font-bold text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    {iss.title}
                  </strong>
                  <span className="font-mono text-[10px] text-slate-400">{iss.tripCode}</span>
                </div>
                <p className="text-slate-300 leading-relaxed mb-2">{iss.description}</p>
                <div className="p-2.5 rounded-lg bg-slate-900/60 text-[11px] text-teal-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                  <span>{iss.suggestion}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trạng thái điều phối (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <h3 className="font-black text-white text-base pb-3 border-b border-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            3. Trạng thái Điều phối
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
              <span className="text-slate-400 block font-bold">Mức độ báo động hiện tại:</span>
              <div className="flex gap-2">
                {[
                  { id: 'normal', label: 'Bình thường', color: 'bg-emerald-600 text-white' },
                  { id: 'attention', label: 'Chú ý', color: 'bg-amber-600 text-white' },
                  { id: 'critical', label: 'Khẩn cấp', color: 'bg-rose-600 text-white' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setDispatchStatus(st.id as typeof dispatchStatus)}
                    className={`flex-1 py-1.5 rounded-lg font-bold border transition text-[11px] ${
                      dispatchStatus === st.id ? st.color : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 text-slate-300 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span>Điều phối viên trực:</span>
                <strong className="text-white">Minh Lê (Khu vực ĐN)</strong>
              </div>
              <div className="flex justify-between">
                <span>Đội xe trực tuyến:</span>
                <strong className="text-teal-400">100% tín hiệu GPS</strong>
              </div>
              <div className="flex justify-between">
                <span>Hỗ trợ kỹ thuật:</span>
                <strong className="text-emerald-400">Sẵn sàng 24/7</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 7. HỆ THỐNG
// - Cấu hình
// - Nhật ký hoạt động
// ============================================================================
export const AdminSystemManagementView: React.FC<{ trip: TripData }> = ({ trip }) => {
  // 1. Cấu hình
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('60 phút');
  const [backupAutoSchedule, setBackupAutoSchedule] = useState('Hằng ngày lúc 00:00');
  const [isSaved, setIsSaved] = useState(false);

  // 2. Nhật ký hoạt động (Audit log)
  const auditLogs = [
    { id: 'log-1', time: '10:24 Hôm nay', user: 'Lữ Quốc Tuấn (Admin)', action: 'Cập nhật phân quyền RBAC cho Nguyễn Văn An (Hướng dẫn viên)', status: 'Thành công' },
    { id: 'log-2', time: '09:15 Hôm nay', user: 'Minh Lê (Điều phối)', action: 'Chạy tối ưu hóa lịch trình ngày 3 qua Gemini 2.5 Flash', status: 'Thành công' },
    { id: 'log-3', time: 'Hôm qua 17:30', user: 'Lữ Quốc Tuấn (Admin)', action: 'Xuất bản sao lưu JSON toàn bộ hệ thống (voyager-backup.json)', status: 'Thành công' },
    { id: 'log-4', time: 'Hôm qua 14:10', user: 'Hệ thống tự động', action: 'Đồng bộ cơ sở dữ liệu Firestore Cloud DB: trips/active', status: 'Thành công' },
    { id: 'log-5', time: '05/10 08:00', user: 'Lữ Quốc Tuấn (Admin)', action: 'Khóa tài khoản người dùng Đặng Quốc Khánh', status: 'Thành công' },
  ];

  // Export JSON
  const handleExportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trip, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `voyager-system-backup-${trip.code}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Hạ tầng & Hệ thống
          </span>
          <span className="text-xs text-slate-400 font-semibold">Core System & Audit</span>
        </div>
        <h2 className="mt-2 text-2xl font-black text-white">Quản lý Hệ thống & Nhật ký Hoạt động</h2>
        <p className="mt-1 text-xs text-slate-400 max-w-2xl">
          Cấu hình tham số toàn cục hệ thống, chế độ bảo trì, sao lưu JSON và theo dõi nhật ký hoạt động (Audit log) của toàn bộ người dùng.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* 1. Cấu hình hệ thống (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <h3 className="font-black text-white text-base pb-3 border-b border-slate-800 flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            1. Cấu hình Hệ thống Toàn cục
          </h3>

          <div className="space-y-4 text-xs">
            {/* Chế độ bảo trì */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div>
                <strong className="text-white block">Chế độ bảo trì hệ thống</strong>
                <p className="text-slate-400 text-[11px] mt-0.5">Tạm khóa truy cập của khách khi nâng cấp</p>
              </div>
              <button
                type="button"
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={`w-12 h-6 rounded-full p-1 transition ${maintenanceMode ? 'bg-rose-600' : 'bg-slate-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Session Timeout */}
            <div>
              <label className="text-slate-300 font-bold block mb-1">Thời gian hết hạn phiên đăng nhập</label>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="30 phút">30 phút không hoạt động</option>
                <option value="60 phút">60 phút không hoạt động</option>
                <option value="120 phút">120 phút không hoạt động</option>
              </select>
            </div>

            {/* Sao lưu tự động */}
            <div>
              <label className="text-slate-300 font-bold block mb-1">Lịch sao lưu dữ liệu tự động</label>
              <select
                value={backupAutoSchedule}
                onChange={(e) => setBackupAutoSchedule(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="Hằng ngày lúc 00:00">Hằng ngày lúc 00:00</option>
                <option value="Mỗi 12 giờ">Mỗi 12 giờ</option>
                <option value="Hằng tuần">Hằng tuần vào Chủ nhật</option>
              </select>
            </div>

            {/* Nút Export Backup */}
            <div className="pt-2">
              <button
                onClick={handleExportBackup}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-300 font-bold text-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất bản sao lưu hệ thống (JSON)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Nhật ký hoạt động (Audit log) (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-black text-white text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              2. Nhật ký Hoạt động (Audit Log)
            </h3>
            <span className="text-xs text-slate-400">Ghi nhận tự động</span>
          </div>

          <div className="divide-y divide-slate-800/60 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <strong className="text-white">{log.user}</strong>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{log.time}</span>
                </div>
                <p className="text-slate-300 pl-3.5 leading-relaxed">{log.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
