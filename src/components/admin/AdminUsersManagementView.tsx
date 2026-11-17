import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Lock,
  Unlock,
  RefreshCw,
  Check,
  Copy,
} from 'lucide-react';
import { authenticatedFetch } from '../../api';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Admin' | 'Khách du lịch';
  isLocked: boolean;
  createdAt: string;
  lastLogin: string;
}

export const AdminUsersManagementView: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [resetLinkModal, setResetLinkModal] = useState<{ name: string; email: string; link: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Form thêm user mới
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Khách du lịch' as ManagedUser['role'],
  });
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadedCountRef = React.useRef(50);

  // Nạp danh sách từ server (hỗ trợ phân trang)
  const fetchUsers = async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true);
      const countToFetch = Math.max(loadedCountRef.current, 50);
      const res = await authenticatedFetch(`/api/admin/users?limit=${countToFetch}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setUsers(data.users);
          setNextPageToken(data.nextPageToken || null);
          loadedCountRef.current = data.users.length;
        }
      }
    } catch {
      // Giữ nguyên danh sách hiện tại nếu lỗi mạng
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken || isLoadingMore) return;
    try {
      setIsLoadingMore(true);
      const res = await authenticatedFetch(`/api/admin/users?limit=50&pageToken=${encodeURIComponent(nextPageToken)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setUsers((prev) => {
            const existingIds = new Set(prev.map((u) => u.id));
            const newOnes = data.users.filter((u: ManagedUser) => !existingIds.has(u.id));
            const combined = [...prev, ...newOnes];
            loadedCountRef.current = combined.length;
            return combined;
          });
          setNextPageToken(data.nextPageToken || null);
        }
      }
    } catch {
      showToast('Lỗi khi tải thêm danh sách người dùng!');
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchUsers(false);
    // Tự làm mới định kỳ chạy nền không nhấp nháy loading
    const timer = setInterval(() => fetchUsers(true), 20000);
    return () => clearInterval(timer);
  }, []);

  const userStats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => !u.isLocked).length;
    const locked = users.filter((u) => u.isLocked).length;
    const admins = users.filter((u) => u.role === 'Admin').length;
    const tourists = users.filter((u) => u.role !== 'Admin').length;
    return { total, active, locked, admins, tourists };
  }, [users]);

  // Filter logic
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone.includes(searchQuery);
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !u.isLocked) ||
        (statusFilter === 'locked' && u.isLocked);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Khóa / Mở khóa
  const handleToggleLock = async (user: ManagedUser) => {
    const nextLocked = !user.isLocked;
    const previousUsers = [...users];
    // Cập nhật lạc quan
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isLocked: nextLocked } : u)));

    try {
      const res = await authenticatedFetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: nextLocked }),
      });
      if (res.ok) {
        showToast(`Đã ${nextLocked ? 'khóa' : 'mở khóa'} tài khoản ${user.name}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setUsers(previousUsers);
        showToast(data.error || 'Lỗi khi cập nhật trạng thái khóa!');
      }
    } catch {
      setUsers(previousUsers);
      showToast('Lỗi kết nối khi cập nhật trạng thái khóa!');
    }
  };

  // Đổi vai trò RBAC
  const handleChangeRole = async (userId: string, newRole: ManagedUser['role']) => {
    const previousUsers = [...users];
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));

    try {
      const res = await authenticatedFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        showToast(`Đã phân quyền ${newRole} cho tài khoản`);
      } else {
        const data = await res.json().catch(() => ({}));
        setUsers(previousUsers);
        showToast(data.error || 'Lỗi khi cập nhật vai trò!');
      }
    } catch {
      setUsers(previousUsers);
      showToast('Lỗi kết nối khi cập nhật vai trò!');
    }
  };

  // Xóa user
  const handleDeleteUser = async (userId: string, name: string) => {
    setConfirmDeleteUserId(null);

    const previousUsers = [...users];
    setUsers((prev) => prev.filter((u) => u.id !== userId));

    try {
      const res = await authenticatedFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Đã xóa tài khoản "${name}" thành công`);
      } else {
        const data = await res.json().catch(() => ({}));
        setUsers(previousUsers);
        showToast(data.error || 'Lỗi khi xóa tài khoản!');
      }
    } catch {
      setUsers(previousUsers);
      showToast('Lỗi kết nối khi xóa tài khoản!');
    }
  };

  // Submit thêm user mới
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name.trim() || !newUserForm.email.trim()) {
      showToast('Vui lòng nhập họ tên và email!');
      return;
    }

    const payload = {
      name: newUserForm.name.trim(),
      email: newUserForm.email.trim(),
      phone: newUserForm.phone.trim() || '0900 000 000',
      role: newUserForm.role,
    };

    try {
      const res = await authenticatedFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.users) {
          setUsers(data.users);
        } else if (data.user) {
          setUsers((prev) => [data.user, ...prev]);
        }
        setIsModalOpen(false);
        setNewUserForm({ name: '', email: '', phone: '', role: 'Khách du lịch' });
        showToast(`Đã tạo tài khoản cho "${payload.name}"!`);
        if (data.resetLink) {
          setResetLinkModal({
            name: payload.name,
            email: payload.email,
            link: data.resetLink,
          });
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Lỗi khi tạo tài khoản!');
      }
    } catch {
      showToast('Lỗi kết nối khi tạo tài khoản!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-xs font-bold text-white shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
              Quản trị Người dùng & Phân quyền
            </span>
            <span className="text-xs text-slate-400 font-semibold">{users.length} tài khoản</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Quản lý Tài khoản & Phân quyền (RBAC)</h2>
          <p className="mt-1 text-xs text-slate-400 max-w-xl">
            Tra cứu danh sách người dùng, Khóa/Mở khóa tài khoản khi có vi phạm, phân chia vai trò và ghi nhận lịch sử thay đổi trên hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void fetchUsers(false)}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/30 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm User Mới</span>
          </button>
        </div>
      </div>

      {/* Dynamic User Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tổng tài khoản</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{userStats.total}</span>
            <span className="text-xs text-slate-500">người dùng ({userStats.active} hoạt động)</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Quản trị viên (Admin)</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400">{userStats.admins}</span>
            <span className="text-xs text-slate-500">toàn quyền hệ thống</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">Khách du lịch (User)</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-teal-300">{userStats.tourists}</span>
            <span className="text-xs text-slate-500">tài khoản người dùng</span>
          </div>
        </div>
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

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 font-bold focus:outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="locked">Đã bị khóa</option>
          </select>

          {/* Role Filters */}
          {['all', 'Admin', 'Khách du lịch'].map((r) => (
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

      {/* Users Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
        <div className="hidden md:grid grid-cols-12 gap-3 bg-slate-800/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
          <span className="col-span-4">Người dùng</span>
          <span className="col-span-3">Phân quyền (RBAC)</span>
          <span className="col-span-2 text-center">Trạng thái</span>
          <span className="col-span-2 text-center">Đăng nhập gần nhất</span>
          <span className="col-span-1 text-right">Thao tác</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {isLoading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-6 h-6 text-teal-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-semibold">Đang nạp danh sách tài khoản từ hệ thống...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Không tìm thấy người dùng phù hợp với điều kiện tìm kiếm.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex flex-col md:grid md:grid-cols-12 gap-3 items-start md:items-center px-6 py-4 hover:bg-slate-800/40 transition text-sm"
              >
                {/* User Info */}
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
                      <strong className={`font-bold ${user.isLocked ? 'text-slate-400 line-through' : 'text-white'}`}>
                        {user.name}
                      </strong>
                      {user.role === 'Admin' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          ROOT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{user.email}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{user.phone}</p>
                  </div>
                </div>

                {/* Role Dropdown */}
                <div className="md:col-span-3">
                  <select
                    value={user.role === 'Admin' ? 'Admin' : 'Khách du lịch'}
                    onChange={(e: any) => handleChangeRole(user.id, e.target.value)}
                    disabled={user.email === 'luquoctuan2006@gmail.com'}
                    className="w-full max-w-[170px] bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                  >
                    <option value="Admin">Admin (Quản trị)</option>
                    <option value="Khách du lịch">Khách du lịch (User)</option>
                  </select>
                </div>

                {/* Trạng thái khóa */}
                <div className="md:col-span-2 text-center">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      user.isLocked
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${user.isLocked ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                    {user.isLocked ? 'Đã khóa' : 'Hoạt động'}
                  </span>
                </div>

                {/* Đăng nhập gần nhất */}
                <div className="md:col-span-2 text-center text-xs text-slate-400">
                  <span>{user.lastLogin}</span>
                  <span className="block text-[10px] text-slate-500">Tạo: {user.createdAt}</span>
                </div>

                {/* Thao tác (Khóa / Mở khóa / Xóa) */}
                <div className="md:col-span-1 flex items-center justify-end gap-1.5 w-full md:w-auto">
                  <button
                    onClick={() => handleToggleLock(user)}
                    disabled={user.email === 'luquoctuan2006@gmail.com'}
                    title={user.isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản này'}
                    className={`p-2 rounded-xl border text-xs transition font-bold disabled:opacity-30 ${
                      user.isLocked
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                        : 'bg-rose-600/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
                    }`}
                  >
                    {user.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  </button>
                  {user.email !== 'luquoctuan2006@gmail.com' && (
                    confirmDeleteUserId === user.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void handleDeleteUser(user.id, user.name)}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition"
                        >
                          Xóa
                        </button>
                        <button
                          onClick={() => setConfirmDeleteUserId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold transition"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteUserId(user.id)}
                        title="Xóa tài khoản"
                        className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            ))
          )}
          {nextPageToken && (
            <div className="pt-4 pb-2 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-teal-400 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMore ? 'animate-spin' : ''}`} />
                <span>{isLoadingMore ? 'Đang tải thêm...' : 'Tải thêm người dùng'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Thêm User mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                <h3 className="font-black text-white text-base">Thêm Người Dùng Mới</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Họ và Tên *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Hoàng Minh Nhật"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Địa chỉ Email *</label>
                <input
                  type="email"
                  required
                  placeholder="nhat.hoang@voyager.vn"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  placeholder="0912 345 678"
                  value={newUserForm.phone}
                  onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Vai trò phân quyền (RBAC)</label>
                <select
                  value={newUserForm.role}
                  onChange={(e: any) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Khách du lịch">Khách du lịch (User)</option>
                  <option value="Admin">Admin (Quản trị viên)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-lg shadow-teal-900/40 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Tài Khoản</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Hiển thị Liên kết đặt mật khẩu an toàn */}
      {resetLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-teal-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-400" />
                <h3 className="font-black text-white text-base">Tạo Tài Khoản Thành Công</h3>
              </div>
              <button
                onClick={() => {
                  setResetLinkModal(null);
                  setIsCopied(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Tài khoản cho <strong className="text-teal-300">{resetLinkModal.name}</strong> ({resetLinkModal.email}) đã được khởi tạo thành công không cần mật khẩu mặc định.
              </p>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 leading-relaxed">
                Vui lòng sao chép liên kết thiết lập mật khẩu bên dưới và gửi an toàn cho người dùng:
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Liên kết đặt mật khẩu:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={resetLinkModal.link}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs font-mono select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetLinkModal.link);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2500);
                    }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition cursor-pointer"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setResetLinkModal(null);
                  setIsCopied(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};