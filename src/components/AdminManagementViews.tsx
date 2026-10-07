import React from 'react';
import { Database, MapPin, Settings2, ShieldCheck, Users, Wifi, WifiOff } from 'lucide-react';
import { TripData } from '../types/travel';

interface AdminDashboardViewProps {
  trip: TripData;
  firebaseStatus: 'loading' | 'connected' | 'error';
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ trip, firebaseStatus }) => (
  <div className="space-y-5">
    <section className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-xl shadow-slate-900/20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Admin console</p>
      <h2 className="mt-3 text-3xl font-black">Dashboard hệ thống</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">
        Xem tổng trạng dữ liệu và trạng thái hoạt động của hệ thống. Các quyền quản lý chi tiết nằm trong các tab được cấp quyền riêng.
      </p>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-teal-50 p-2.5 text-teal-600"><MapPin className="w-5 h-5" /></div>
          <div><p className="text-xs font-semibold text-slate-500">Điểm địa lý</p><strong className="text-2xl">{trip.waypoints.length}</strong></div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600"><Users className="w-5 h-5" /></div>
          <div><p className="text-xs font-semibold text-slate-500">Người dùng</p><strong className="text-2xl">{trip.members.length}</strong></div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600"><Database className="w-5 h-5" /></div>
          <div><p className="text-xs font-semibold text-slate-500">Kết nối dữ liệu</p><strong className="text-lg capitalize">{firebaseStatus}</strong></div>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div><h3 className="text-lg font-black text-slate-900">Tình trạng hệ thống</h3><p className="text-xs text-slate-500">Tổng trạng thái hiện tại</p></div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Hoạt động bình thường</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Chuyến đi', trip.status],
          ['Lịch trình', `${trip.days.length} ngày`],
          ['Cảnh báo', `${trip.alerts.length} thông báo`],
          ['Ngân sách', `${trip.budgetUsedPercent}% dùng`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-black text-slate-900">{value}</p></div>
        ))}
      </div>
    </section>
  </div>
);

export const LocationsManagementView: React.FC<{ trip: TripData }> = ({ trip }) => (
  <div className="space-y-4">
    <div className="flex items-end justify-between gap-4">
      <div><h2 className="text-2xl font-black text-slate-900">Quản lý địa điểm</h2><p className="text-sm text-slate-500">Xem toàn bộ điểm tham quan trong hành trình.</p></div>
      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{trip.waypoints.length} điểm</span>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {trip.waypoints.map((waypoint) => (
        <article key={waypoint.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">{waypoint.code}</span><div><h3 className="font-black text-slate-900">{waypoint.name}</h3><p className="text-xs text-slate-500">Tọa độ {waypoint.lat.toFixed(4)}, {waypoint.lng.toFixed(4)}</p></div></div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${waypoint.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : waypoint.status === 'current' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{waypoint.status}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-400 block">Đã đến</span><strong>{waypoint.arrivalTime || '—'}</strong></div><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-400 block">Điểm rời</span><strong>{waypoint.departureTime || '—'}</strong></div></div>
        </article>
      ))}
    </div>
  </div>
);

export const UsersManagementView: React.FC<{ trip: TripData }> = ({ trip }) => (
  <div className="space-y-4">
    <div><h2 className="text-2xl font-black text-slate-900">Quản lý người dùng</h2><p className="text-sm text-slate-500">Danh sách người cùng tham gia chuyến đi.</p></div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1.3fr_1fr_.7fr] gap-3 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500"><span>Người</span><span>Vai trò</span><span>Trạng thái</span></div>
      {trip.members.map((member) => (
        <div key={member.id} className="grid grid-cols-[1.3fr_1fr_.7fr] items-center gap-3 border-t border-slate-100 px-5 py-4 text-sm">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{member.avatar}</span><div><strong>{member.name}</strong><p className="text-xs text-slate-500">{member.phone}</p></div></div>
          <span className="text-slate-600">{member.role}</span>
          <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${member.status === 'online' ? 'bg-emerald-50 text-emerald-700' : member.status === 'busy' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}><span className={`h-1.5 w-1.5 rounded-full ${member.status === 'online' ? 'bg-emerald-500' : member.status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'}`} />{member.status}</span>
        </div>
      ))}
    </div>
  </div>
);

export const SystemDataManagementView: React.FC<{ firebaseStatus: 'loading' | 'connected' | 'error' }> = ({ firebaseStatus }) => (
  <div className="space-y-4">
    <div><h2 className="text-2xl font-black text-slate-900">Quản lý dữ liệu hệ thống</h2><p className="text-sm text-slate-500">Kiểm tra các nguồn dữ liệu và trạng thái dịch vụ.</p></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">{firebaseStatus === 'connected' ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}</div><div><h3 className="font-black text-slate-900">Firestore</h3><p className="text-xs text-slate-500">{firebaseStatus === 'connected' ? 'Kết nối thành công' : firebaseStatus === 'loading' ? 'Đang kết nối...' : 'Không thể kết nối'}</p></div></div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs"><span className="text-slate-500">Nền tảng:</span> <strong>trips/active</strong></div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-teal-50 p-2.5 text-teal-600"><ShieldCheck className="w-5 w-5" /></div><div><h3 className="font-black text-slate-900">Xác thực danh tính</h3><p className="text-xs text-slate-500">Firebase Authentication</p></div></div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs"><span className="text-slate-500">Quyền:</span> <strong>admin / user</strong></div></div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-sky-50 p-2.5 text-sky-600"><Settings2 className="w-5 h-5" /></div><div><h3 className="font-black text-slate-900">Cấu trúc dữ liệu</h3><p className="text-xs text-slate-500">Dữ liệu chuyến đi, lịch trình, địa điểm, thành viên và ngân sách được lưu trong Firestore.</p></div></div></div>
  </div>
);
