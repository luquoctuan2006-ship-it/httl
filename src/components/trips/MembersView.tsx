import React, { useState } from 'react';
import {
  Users,
  Phone,
  CheckCircle2,
  Heart,
  Plus,
  Edit3,
  Trash2,
} from 'lucide-react';
import { TripMember } from '../../types/travel';
import { Modal, ModalFooter } from '../common/Modal';
import { Field, SelectInput, TextInput } from '../common/Field';

const MEMBER_ROLES = ['Khách du lịch', 'Khách VIP', 'Trưởng đoàn', 'Hướng dẫn viên', 'Tài xế'] as const;

interface MembersViewProps {
  members: TripMember[];
  onToggleStatus: (id: string) => Promise<void>;
  onUpdateMembers?: (updatedMembers: TripMember[]) => Promise<void>;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  onToggleStatus,
  onUpdateMembers,
  searchQuery = '',
  onClearSearch,
}) => {
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal Add Member state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<string>('Khách du lịch');
  const [newPhone, setNewPhone] = useState('');
  const [newPreference, setNewPreference] = useState('');
  const [newAttendance, setNewAttendance] = useState<'Có mặt' | 'Vắng mặt' | 'Chưa điểm danh'>('Chưa điểm danh');

  // Modal Edit Member state
  const [editingMember, setEditingMember] = useState<TripMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<string>('Khách du lịch');
  const [editPhone, setEditPhone] = useState('');
  const [editPreference, setEditPreference] = useState('');

  // Delete confirm state
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);

  const normalizedQuery = (searchQuery || '').trim().toLowerCase();
  const filteredMembers = members.filter((member) => {
    if (!normalizedQuery) return true;
    return (
      member.name.toLowerCase().includes(normalizedQuery) ||
      member.role.toLowerCase().includes(normalizedQuery) ||
      member.phone.toLowerCase().includes(normalizedQuery) ||
      (member.specialPreference && member.specialPreference.toLowerCase().includes(normalizedQuery))
    );
  });

  const presentCount = members.filter((member) => member.attendanceStatus === 'Có mặt').length;
  const onlineCount = members.filter((member) => member.status === 'online').length;

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (name.slice(0, 2) || 'TV').toUpperCase();
  };

  const toggleAttendance = async (memberId: string) => {
    setUpdatingMemberId(memberId);
    setErrorMessage(null);
    try {
      await onToggleStatus(memberId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể cập nhật điểm danh');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleOpenAddModal = () => {
    setNewName('');
    setNewRole('Khách du lịch');
    setNewPhone('');
    setNewPreference('');
    setNewAttendance('Chưa điểm danh');
    setIsAddModalOpen(true);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const newMember: TripMember = {
      id: `member-${Date.now()}`,
      name: newName.trim(),
      avatar: getInitials(newName),
      role: newRole.trim(),
      phone: newPhone.trim(),
      status: 'online',
      attendanceStatus: newAttendance,
      specialPreference: newPreference.trim() || undefined,
    };

    const updated = [...members, newMember];
    if (onUpdateMembers) {
      await onUpdateMembers(updated);
    }
    setIsAddModalOpen(false);
  };

  const handleOpenEditModal = (member: TripMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditRole(member.role);
    setEditPhone(member.phone);
    setEditPreference(member.specialPreference || '');
  };

  const handleSaveEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim() || !editPhone.trim()) return;

    const updated = members.map((m) => {
      if (m.id === editingMember.id) {
        return {
          ...m,
          name: editName.trim(),
          avatar: getInitials(editName),
          role: editRole.trim(),
          phone: editPhone.trim(),
          specialPreference: editPreference.trim() || undefined,
        };
      }
      return m;
    });

    if (onUpdateMembers) {
      await onUpdateMembers(updated);
    }
    setEditingMember(null);
  };

  const handleDeleteMember = async (id: string) => {
    const updated = members.filter((m) => m.id !== id);
    if (onUpdateMembers) {
      await onUpdateMembers(updated);
    }
    setDeletingMemberId(null);
  };

  const getRoleBadge = (role: string) => {
    if (role === 'Trưởng đoàn') {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (role === 'Hướng dẫn viên') {
      return 'bg-teal-50 text-teal-700 border-teal-200';
    }
    if (role === 'Tài xế') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (role === 'Khách VIP') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">Danh sách Thành viên &amp; Hồ sơ Đoàn</h2>
          <p className="text-xs text-slate-500 font-medium">
            Quản lý {members.length} thành viên đoàn, điểm danh thời gian thực và cá nhân hóa nhu cầu
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{presentCount}/{members.length} có mặt · {onlineCount} trực tuyến</span>
          </span>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm thành viên</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          {errorMessage}
        </p>
      )}

      {/* Search active notice */}
      {normalizedQuery && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
          <span>Tìm kiếm thành viên theo: <strong>&quot;{searchQuery}&quot;</strong> ({filteredMembers.length} kết quả)</span>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="font-bold text-amber-800 hover:underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* Members Grid */}
      {filteredMembers.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
          {normalizedQuery ? (
            <>
              Không tìm thấy thành viên nào khớp với từ khóa &quot;{searchQuery}&quot;.
              {onClearSearch && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="block mx-auto mt-2 text-teal-600 font-bold hover:underline"
                >
                  Xem tất cả thành viên
                </button>
              )}
            </>
          ) : (
            <>
              Chưa có thành viên nào trong đoàn.
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="block mx-auto mt-2 text-teal-600 font-bold hover:underline"
              >
                + Thêm thành viên đầu tiên
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition flex flex-col justify-between group"
            >
              <div>
                {/* Header row with Avatar, Name, Role & Status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                      {member.avatar || getInitials(member.name)}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 leading-snug">{member.name}</h4>
                      <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRoleBadge(member.role)}`}>
                        {member.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Trực tuyến" />
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(member)}
                      className="opacity-70 group-hover:opacity-100 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition"
                      title="Chỉnh sửa thông tin"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingMemberId(member.id)}
                      className="opacity-70 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                      title="Xóa thành viên"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs text-slate-600 mt-2">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a
                      href={`tel:${member.phone}`}
                      className="font-mono text-slate-700 hover:text-teal-700 hover:underline"
                    >
                      {member.phone}
                    </a>
                  </div>

                  {member.specialPreference ? (
                    <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span><strong>Sở thích / Dị ứng:</strong> {member.specialPreference}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      Chưa có ghi chú sở thích đặc biệt
                    </div>
                  )}
                </div>
              </div>

              {/* Attendance toggle footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-[11px]">
                <span className="text-slate-400 font-medium">Điểm danh:</span>
                <button
                  type="button"
                  disabled={updatingMemberId === member.id}
                  onClick={() => void toggleAttendance(member.id)}
                  aria-pressed={member.attendanceStatus === 'Có mặt'}
                  className={`font-bold px-3 py-1 rounded-lg border flex items-center gap-1.5 transition disabled:opacity-50 ${
                    member.attendanceStatus === 'Có mặt'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : member.attendanceStatus === 'Vắng mặt'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${member.attendanceStatus === 'Có mặt' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>
                    {updatingMemberId === member.id
                      ? 'Đang lưu...'
                      : member.attendanceStatus || 'Chưa điểm danh'}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Thêm thành viên mới */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Thêm thành viên mới vào đoàn"
        icon={<Users className="w-4 h-4" />}
      >
        <form onSubmit={handleCreateMember} className="p-6 space-y-4 text-xs">
          <Field label="Họ và tên *">
            <TextInput
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn Bảo"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vai trò trong đoàn">
              <SelectInput value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                {MEMBER_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Điểm danh ban đầu">
              <SelectInput
                value={newAttendance}
                onChange={(e) => setNewAttendance(e.target.value as 'Có mặt' | 'Vắng mặt' | 'Chưa điểm danh')}
              >
                <option value="Chưa điểm danh">Chưa điểm danh</option>
                <option value="Có mặt">Có mặt</option>
                <option value="Vắng mặt">Vắng mặt</option>
              </SelectInput>
            </Field>
          </div>

          <Field label="Số điện thoại liên hệ *">
            <TextInput
              type="tel"
              required
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Ví dụ: 0912 345 678"
              className="font-mono"
            />
          </Field>

          <Field label="Sở thích cá nhân / Ghi chú dị ứng thực phẩm">
            <TextInput
              type="text"
              value={newPreference}
              onChange={(e) => setNewPreference(e.target.value)}
              placeholder="Ví dụ: Ăn chay trường, Say xe, Dị ứng tôm cua..."
            />
          </Field>

          <ModalFooter
            onCancel={() => setIsAddModalOpen(false)}
            submitLabel="Thêm thành viên & Lưu Firestore"
          />
        </form>
      </Modal>

      {/* Modal: Chỉnh sửa thông tin thành viên */}
      <Modal
        isOpen={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        title="Chỉnh sửa thông tin thành viên"
        icon={<Edit3 className="w-4 h-4" />}
      >
        <form onSubmit={handleSaveEditMember} className="p-6 space-y-4 text-xs">
          <Field label="Họ và tên *">
            <TextInput
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vai trò trong đoàn">
              <SelectInput value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                {MEMBER_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Số điện thoại *">
              <TextInput
                type="tel"
                required
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="font-mono"
              />
            </Field>
          </div>

          <Field label="Sở thích cá nhân / Ghi chú">
            <TextInput
              type="text"
              value={editPreference}
              onChange={(e) => setEditPreference(e.target.value)}
              placeholder="Ví dụ: Ăn chay trường, Say xe..."
            />
          </Field>

          <ModalFooter
            onCancel={() => setEditingMember(null)}
            submitLabel="Cập nhật & Lưu Firestore"
          />
        </form>
      </Modal>

      {/* Modal: Xác nhận xóa thành viên */}
      <Modal
        isOpen={Boolean(deletingMemberId)}
        onClose={() => setDeletingMemberId(null)}
        maxWidth="sm"
        hideHeader
      >
        <div className="p-6 text-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Xóa thành viên khỏi đoàn?</h3>
            <p className="text-slate-500 mt-1">
              Hành động này sẽ xóa thành viên này khỏi đoàn và đồng bộ ngay lên Firestore.
            </p>
          </div>
          <ModalFooter
            cancelLabel="Hủy bỏ"
            onCancel={() => setDeletingMemberId(null)}
            submitLabel="Xác nhận xóa"
            submitType="button"
            onSubmitClick={() => deletingMemberId && void handleDeleteMember(deletingMemberId)}
            submitVariant="rose"
            bordered={false}
            align="center"
          />
        </div>
      </Modal>
    </div>
  );
};
