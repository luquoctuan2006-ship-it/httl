import React, { useState } from 'react';
import {
  Users,
  Phone,
  CheckCircle2,
  Heart,
  Plus,
  Edit3,
  Trash2,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Lock,
  Unlock,
  Link2,
  UserPlus,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { TripMember } from '../../types/travel';
import { buildGuestInviteUrl } from '../../utils/tripJoinHelpers';
import { Modal, ModalFooter } from '../common/Modal';
import { Field, SelectInput, TextInput } from '../common/Field';

const MEMBER_ROLES = ['Khách du lịch', 'Khách VIP', 'Trưởng đoàn', 'Hướng dẫn viên', 'Tài xế'] as const;

interface MembersViewProps {
  members: TripMember[];
  onToggleStatus: (id: string) => Promise<void>;
  onUpdateMembers?: (updatedMembers: TripMember[]) => Promise<void>;
  searchQuery?: string;
  onClearSearch?: () => void;
  joinCode?: string;
  joinCodeEnabled?: boolean;
  isTripOwner?: boolean;
  currentUserUid?: string;
  onManageJoinCode?: (action: 'generate' | 'rotate' | 'toggle') => Promise<void>;
  onAddGuestCompanion?: (payload: { name: string; phone?: string; specialPreference?: string }) => Promise<void>;
  onRemoveGuestCompanion?: (memberId: string) => Promise<void>;
  onOpenGuestModeWithCode?: (joinCode: string, guestName?: string) => Promise<void>;
  onLeaveTrip?: () => Promise<void>;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  onToggleStatus,
  onUpdateMembers,
  searchQuery = '',
  onClearSearch,
  joinCode,
  joinCodeEnabled = true,
  isTripOwner = true,
  currentUserUid,
  onManageJoinCode,
  onAddGuestCompanion,
  onRemoveGuestCompanion,
  onOpenGuestModeWithCode,
  onLeaveTrip,
}) => {
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const [isManagingCode, setIsManagingCode] = useState(false);

  // Add relative / guest companion without account
  const [isCompanionModalOpen, setIsCompanionModalOpen] = useState(false);
  const [companionName, setCompanionName] = useState('');
  const [companionPhone, setCompanionPhone] = useState('');
  const [companionPreference, setCompanionPreference] = useState('');
  const [isSavingCompanion, setIsSavingCompanion] = useState(false);

  // Quick helper: enter/open guest mode for a relative on this device
  const [guestPreviewName, setGuestPreviewName] = useState('');
  const [isOpeningGuestPreview, setIsOpeningGuestPreview] = useState(false);

  // Leave confirmation
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Modal Add Member state (Owner/Admin)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<string>('Khách du lịch');
  const [newPhone, setNewPhone] = useState('');
  const [newPreference, setNewPreference] = useState('');
  const [newAttendance, setNewAttendance] = useState<'Có mặt' | 'Vắng mặt' | 'Chưa điểm danh'>('Chưa điểm danh');

  // Modal Edit Member state (Owner/Admin)
  const [editingMember, setEditingMember] = useState<TripMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<string>('Khách du lịch');
  const [editPhone, setEditPhone] = useState('');
  const [editPreference, setEditPreference] = useState('');

  // Delete confirm state (Owner/Admin)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);

  const normalizedQuery = (searchQuery || '').trim().toLowerCase();
  const filteredMembers = members.filter((member) => {
    if (!normalizedQuery) return true;
    return (
      member.name.toLowerCase().includes(normalizedQuery) ||
      member.role.toLowerCase().includes(normalizedQuery) ||
      member.phone.toLowerCase().includes(normalizedQuery) ||
      (member.invitedByName && member.invitedByName.toLowerCase().includes(normalizedQuery)) ||
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

  const handleCopy = async (type: 'code' | 'link') => {
    if (!joinCode) return;
    const text = type === 'code' ? joinCode : buildGuestInviteUrl(joinCode);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType((prev) => (prev === type ? null : prev)), 2500);
    } catch {
      // Clipboard unsupported fallback
    }
  };

  const handleCodeAction = async (action: 'generate' | 'rotate' | 'toggle') => {
    if (!onManageJoinCode) return;
    setIsManagingCode(true);
    setErrorMessage(null);
    try {
      await onManageJoinCode(action);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể cập nhật mã mời');
    } finally {
      setIsManagingCode(false);
    }
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

  const handleCreateCompanion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddGuestCompanion || !companionName.trim()) return;
    setIsSavingCompanion(true);
    setErrorMessage(null);
    try {
      await onAddGuestCompanion({
        name: companionName.trim(),
        phone: companionPhone.trim() || undefined,
        specialPreference: companionPreference.trim() || undefined,
      });
      setGuestPreviewName(companionName.trim());
      setCompanionName('');
      setCompanionPhone('');
      setCompanionPreference('');
      setIsCompanionModalOpen(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể thêm người thân vào đoàn');
    } finally {
      setIsSavingCompanion(false);
    }
  };

  const handleOpenGuestForRelative = async (relativeName?: string) => {
    if (!joinCode || !onOpenGuestModeWithCode) return;
    setIsOpeningGuestPreview(true);
    setErrorMessage(null);
    try {
      await onOpenGuestModeWithCode(joinCode, (relativeName || guestPreviewName).trim() || undefined);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể mở giao diện hành khách');
    } finally {
      setIsOpeningGuestPreview(false);
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
      memberType: 'manual',
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
    const target = members.find((m) => m.id === id);
    if (!isTripOwner && target?.invitedByUid === currentUserUid && onRemoveGuestCompanion) {
      await onRemoveGuestCompanion(id);
      setDeletingMemberId(null);
      return;
    }
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
          <h2 className="text-xl font-black text-slate-900">Danh sách Thành viên &amp; Mời Hành khách</h2>
          <p className="text-xs text-slate-500 font-medium">
            Quản lý {members.length} thành viên đoàn, mã tham gia cho hành khách có tài khoản và người thân không tài khoản
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 tabular-nums">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{presentCount}/{members.length} có mặt · {onlineCount} trực tuyến</span>
          </span>

          {onAddGuestCompanion && (
            <button
              type="button"
              onClick={() => setIsCompanionModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm người thân (không TK)</span>
            </button>
          )}

          {isTripOwner && onUpdateMembers && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm thành viên</span>
            </button>
          )}

          {!isTripOwner && onLeaveTrip && (
            <button
              type="button"
              onClick={() => setIsLeaveConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Rời chuyến</span>
            </button>
          )}
        </div>
      </div>

      {/* Share / Join Code Management & Guest Handoff Card */}
      {(joinCode || (isTripOwner && onManageJoinCode)) && (
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-teal-700">
                <KeyRound className="w-4 h-4" />
                <span>Mã tham gia chuyến đi (Join Code)</span>
              </span>
              {joinCode && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                    joinCodeEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {joinCodeEnabled ? 'Đang mở cho HK' : 'Đang tạm khóa'}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isTripOwner
                ? 'Chia sẻ mã này để bạn bè tham gia chuyến với tư cách Hành khách (HK), hoặc nhập giúp cho người thân không có tài khoản để xem lịch trình riêng.'
                : 'Bạn đang tham gia chuyến với tư cách Hành khách (HK). Dùng mã này để mời thêm người thân không có tài khoản cùng theo dõi lịch trình.'}
            </p>

            {joinCode ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="px-4 py-2 rounded-xl bg-slate-900 text-white font-mono text-lg font-black tracking-[0.22em] select-all">
                  {joinCode}
                </div>

                <button
                  type="button"
                  onClick={() => void handleCopy('code')}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition"
                >
                  {copiedType === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'code' ? 'Đã chép mã' : 'Sao chép mã'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopy('link')}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold inline-flex items-center gap-1.5 transition"
                >
                  {copiedType === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'link' ? 'Đã chép link mời' : 'Sao chép link mời'}</span>
                </button>

                {isTripOwner && onManageJoinCode && (
                  <>
                    <button
                      type="button"
                      disabled={isManagingCode}
                      onClick={() => void handleCodeAction('rotate')}
                      className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                      title="Đổi sang mã mời mới (mã cũ sẽ hết hiệu lực)"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isManagingCode ? 'animate-spin' : ''}`} />
                      <span>Đổi mã mới</span>
                    </button>

                    <button
                      type="button"
                      disabled={isManagingCode}
                      onClick={() => void handleCodeAction('toggle')}
                      className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {joinCodeEnabled ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{joinCodeEnabled ? 'Khóa mã' : 'Mở lại mã'}</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              isTripOwner &&
              onManageJoinCode && (
                <button
                  type="button"
                  disabled={isManagingCode}
                  onClick={() => void handleCodeAction('generate')}
                  className="mt-1 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isManagingCode ? 'Đang tạo mã...' : 'Tạo mã mời vào chuyến'}</span>
                </button>
              )
            )}
          </div>

          {/* Direct Guest Portal Handoff Box */}
          {joinCode && joinCodeEnabled && onOpenGuestModeWithCode && (
            <div className="lg:col-span-5 rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2.5 text-xs">
              <div className="font-extrabold text-slate-900">
                Mở giao diện Hành khách (Không tài khoản)
              </div>
              <p className="text-[11px] text-slate-500">
                Nhập tên người thân (nếu cần) và mở ngay giao diện Hành khách gọn nhẹ trên thiết bị này bằng mã <strong className="font-mono text-slate-800">{joinCode}</strong>.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={guestPreviewName}
                  onChange={(e) => setGuestPreviewName(e.target.value)}
                  placeholder="Tên người thân (tùy chọn)"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  disabled={isOpeningGuestPreview}
                  onClick={() => void handleOpenGuestForRelative()}
                  className="min-h-[38px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center justify-center gap-1.5 shrink-0 transition disabled:opacity-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isOpeningGuestPreview ? 'Đang mở...' : 'Mở giao diện HK'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
              {isTripOwner && onUpdateMembers && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="block mx-auto mt-2 text-teal-600 font-bold hover:underline"
                >
                  + Thêm thành viên đầu tiên
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => {
            const isOwnMember = Boolean(currentUserUid && member.uid === currentUserUid);
            const isInvitedByMe = Boolean(currentUserUid && member.invitedByUid === currentUserUid);
            const canToggleAttendance = isTripOwner || isOwnMember || isInvitedByMe;
            const canDeleteThisMember =
              (isTripOwner && Boolean(onUpdateMembers)) ||
              (!isTripOwner && isInvitedByMe && Boolean(onRemoveGuestCompanion));

            return (
              <div
                key={member.id}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  {/* Header row with Avatar, Name, Role & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 text-white font-extrabold text-sm flex items-center justify-center shadow-xs shrink-0">
                        {member.avatar || getInitials(member.name)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-extrabold text-slate-900 leading-snug truncate">
                          {member.name}
                          {isOwnMember && (
                            <span className="ml-1.5 text-[10px] font-bold text-teal-700">(Bạn)</span>
                          )}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRoleBadge(member.role)}`}>
                            {member.role}
                          </span>
                          {member.memberType === 'account' && (
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border bg-sky-50 text-sky-700 border-sky-200">
                              Tài khoản HK
                            </span>
                          )}
                          {member.memberType === 'guest' && (
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border bg-amber-50 text-amber-800 border-amber-200">
                              Không TK
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Trực tuyến" />
                      {isTripOwner && onUpdateMembers && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(member)}
                          className="opacity-70 group-hover:opacity-100 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition"
                          title="Chỉnh sửa thông tin"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteThisMember && (
                        <button
                          type="button"
                          onClick={() => setDeletingMemberId(member.id)}
                          className="opacity-70 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Xóa thành viên"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-xs text-slate-600 mt-2">
                    {member.phone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a
                          href={`tel:${member.phone}`}
                          className="font-mono text-slate-700 hover:text-teal-700 hover:underline"
                        >
                          {member.phone}
                        </a>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">Chưa bổ sung số điện thoại</div>
                    )}

                    {member.invitedByName && (
                      <div className="text-[11px] font-semibold text-teal-700 bg-teal-50/70 border border-teal-200/70 rounded-lg px-2.5 py-1">
                        Người thân đi cùng: {member.invitedByName}
                      </div>
                    )}

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
                  {canToggleAttendance ? (
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
                  ) : (
                    <span
                      className={`font-bold px-3 py-1 rounded-lg border flex items-center gap-1.5 ${
                        member.attendanceStatus === 'Có mặt'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : member.attendanceStatus === 'Vắng mặt'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${member.attendanceStatus === 'Có mặt' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{member.attendanceStatus || 'Chưa điểm danh'}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Đăng ký người thân không có tài khoản */}
      <Modal
        isOpen={isCompanionModalOpen}
        onClose={() => setIsCompanionModalOpen(false)}
        title="Thêm người thân (không cần tài khoản)"
        subtitle="Đăng ký tên người thân vào danh sách đoàn và dùng chung mã mời để xem giao diện Hành khách"
        icon={<UserPlus className="w-4 h-4" />}
      >
        <form onSubmit={handleCreateCompanion} className="p-6 space-y-4 text-xs">
          <Field label="Họ và tên người thân *">
            <TextInput
              type="text"
              required
              autoFocus
              value={companionName}
              onChange={(e) => setCompanionName(e.target.value)}
              placeholder="Ví dụ: Cô Lan / Bé Minh"
            />
          </Field>

          <Field label="Số điện thoại (tùy chọn)">
            <TextInput
              type="tel"
              value={companionPhone}
              onChange={(e) => setCompanionPhone(e.target.value)}
              placeholder="Nếu chưa có điện thoại có thể bỏ trống"
              className="font-mono"
            />
          </Field>

          <Field label="Lưu ý ăn uống / sức khỏe (tùy chọn)">
            <TextInput
              type="text"
              value={companionPreference}
              onChange={(e) => setCompanionPreference(e.target.value)}
              placeholder="Ví dụ: Say xe, ăn chay, người lớn tuổi..."
            />
          </Field>

          <ModalFooter
            onCancel={() => setIsCompanionModalOpen(false)}
            submitLabel={isSavingCompanion ? 'Đang lưu...' : 'Thêm vào đoàn'}
            disabled={isSavingCompanion}
          />
        </form>
      </Modal>

      {/* Modal: Thêm thành viên mới (Chủ chuyến) */}
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

      {/* Modal: Chỉnh sửa thông tin thành viên (Chủ chuyến) */}
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

      {/* Modal: Xác nhận rời chuyến */}
      <Modal
        isOpen={isLeaveConfirmOpen}
        onClose={() => setIsLeaveConfirmOpen(false)}
        maxWidth="sm"
        hideHeader
      >
        <div className="p-6 text-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <LogOut className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Rời khỏi chuyến đi này?</h3>
            <p className="text-slate-500 mt-1">
              Chuyến đi sẽ biến mất khỏi danh sách của bạn. Bạn có thể dùng mã mời để tham gia lại bất cứ lúc nào.
            </p>
          </div>
          <ModalFooter
            cancelLabel="Ở lại"
            onCancel={() => setIsLeaveConfirmOpen(false)}
            submitLabel={isLeaving ? 'Đang rời...' : 'Xác nhận rời chuyến'}
            submitType="button"
            disabled={isLeaving}
            onSubmitClick={() => {
              if (!onLeaveTrip) return;
              setIsLeaving(true);
              void onLeaveTrip().finally(() => {
                setIsLeaving(false);
                setIsLeaveConfirmOpen(false);
              });
            }}
            submitVariant="rose"
            bordered={false}
            align="center"
          />
        </div>
      </Modal>
    </div>
  );
};

