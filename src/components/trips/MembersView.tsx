import React, { useEffect, useState } from 'react';
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
import {
  buildGuestInviteUrl,
  getMemberInitials,
  isStaffRole,
  MAX_GUEST_COMPANIONS_PER_PASSENGER,
  MEMBER_ROLES,
} from '../../utils/trip/tripJoinHelpers';
import { Modal, ModalFooter } from '../common/Modal';
import { Field, SelectInput, TextInput } from '../common/Field';

interface MembersViewProps {
  tripId?: string;
  members: TripMember[];
  onToggleStatus: (id: string, nextStatus?: TripMember['attendanceStatus']) => Promise<void>;
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
  isAdmin?: boolean;
}

export const MembersView: React.FC<MembersViewProps> = ({
  tripId,
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
  isAdmin = false,
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

  // Filter tabs
  const [memberFilter, setMemberFilter] = useState<'all' | 'passenger' | 'staff' | 'guest'>('all');

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
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  useEffect(() => {
    setErrorMessage(null);
    setMemberFilter('all');
    setIsCompanionModalOpen(false);
    setCompanionName('');
    setCompanionPhone('');
    setCompanionPreference('');
    setGuestPreviewName('');
    setIsAddModalOpen(false);
    setEditingMember(null);
    setDeletingMemberId(null);
    setIsLeaveConfirmOpen(false);
    setIsSavingMember(false);
    setIsDeletingMember(false);
  }, [tripId]);

  const passengerCount = members.filter((m) => !isStaffRole(m.role) && m.memberType !== 'guest').length;
  const staffCount = members.filter((m) => isStaffRole(m.role)).length;
  const guestCount = members.filter((m) => m.memberType === 'guest').length;

  const normalizedQuery = (searchQuery || '').trim().toLowerCase();
  const filteredMembers = members.filter((member) => {
    if (memberFilter === 'passenger' && (isStaffRole(member.role) || member.memberType === 'guest')) {
      return false;
    }
    if (memberFilter === 'staff' && !isStaffRole(member.role)) {
      return false;
    }
    if (memberFilter === 'guest' && member.memberType !== 'guest') {
      return false;
    }
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
  const myCompanionCount = currentUserUid
    ? members.filter((m) => m.memberType === 'guest' && m.invitedByUid === currentUserUid).length
    : 0;
  const companionLimitReached = !isTripOwner && myCompanionCount >= MAX_GUEST_COMPANIONS_PER_PASSENGER;

  const deletingTarget = deletingMemberId ? members.find((m) => m.id === deletingMemberId) || null : null;
  const cascadeCompanionsCount =
    deletingTarget?.uid && deletingTarget.memberType !== 'guest'
      ? members.filter((m) => m.memberType === 'guest' && m.invitedByUid === deletingTarget.uid).length
      : 0;

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

  const setAttendance = async (memberId: string, nextStatus: TripMember['attendanceStatus']) => {
    setUpdatingMemberId(memberId);
    setErrorMessage(null);
    try {
      await onToggleStatus(memberId, nextStatus);
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
    if (!newName.trim() || isSavingMember) return;

    setIsSavingMember(true);
    setErrorMessage(null);
    const newMember: TripMember = {
      id: `member-${Date.now()}`,
      name: newName.trim(),
      avatar: getMemberInitials(newName),
      role: newRole.trim() || 'Khách du lịch',
      phone: newPhone.trim(),
      status: 'offline',
      attendanceStatus: newAttendance,
      specialPreference: newPreference.trim() || undefined,
      memberType: 'manual',
    };

    try {
      const updated = [...members, newMember];
      if (onUpdateMembers) {
        await onUpdateMembers(updated);
      }
      setIsAddModalOpen(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể thêm thành viên mới');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleOpenEditModal = (member: TripMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditRole(member.role);
    setEditPhone(member.phone || '');
    setEditPreference(member.specialPreference || '');
  };

  const handleSaveEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim() || isSavingMember) return;

    setIsSavingMember(true);
    setErrorMessage(null);
    const updated = members.map((m) => {
      if (m.id === editingMember.id) {
        return {
          ...m,
          name: editName.trim(),
          avatar: getMemberInitials(editName),
          role: editRole.trim() || m.role,
          phone: editPhone.trim(),
          specialPreference: editPreference.trim() || undefined,
        };
      }
      return m;
    });

    try {
      if (onUpdateMembers) {
        await onUpdateMembers(updated);
      }
      setEditingMember(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể cập nhật thông tin thành viên');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (isDeletingMember) return;
    setIsDeletingMember(true);
    setErrorMessage(null);
    try {
      const target = members.find((m) => m.id === id);
      if (!isTripOwner && target?.invitedByUid === currentUserUid && onRemoveGuestCompanion) {
        await onRemoveGuestCompanion(id);
        setDeletingMemberId(null);
        return;
      }
      const removedOwnerUid =
        target?.uid && target.memberType !== 'guest' ? target.uid : null;
      const updated = members.filter(
        (m) =>
          m.id !== id &&
          !(removedOwnerUid && m.memberType === 'guest' && m.invitedByUid === removedOwnerUid),
      );
      if (onUpdateMembers) {
        await onUpdateMembers(updated);
      }
      setDeletingMemberId(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể xóa thành viên');
    } finally {
      setIsDeletingMember(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${isAdmin ? 'text-white' : 'text-neutral-950'}`}>Thành viên &amp; Mời Hành khách</h2>
          <p className={`text-xs mt-0.5 tabular-nums ${isAdmin ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {members.length} thành viên · {presentCount} có mặt · {onlineCount} trực tuyến
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onAddGuestCompanion && (
            <button
              type="button"
              onClick={() => setIsCompanionModalOpen(true)}
              title={
                companionLimitReached
                  ? `Mỗi hành khách chỉ có thể thêm tối đa ${MAX_GUEST_COMPANIONS_PER_PASSENGER} người thân đi cùng`
                  : 'Đăng ký người thân không có tài khoản'
              }
              className={`h-9 flex items-center gap-1.5 px-3.5 rounded-lg border text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                companionLimitReached
                  ? 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800'
              }`}
            >
              <UserPlus className={`w-3.5 h-3.5 ${companionLimitReached ? 'text-red-600' : 'text-blue-600'}`} />
              <span>
                Thêm người thân{!isTripOwner ? ` (${myCompanionCount}/${MAX_GUEST_COMPANIONS_PER_PASSENGER})` : ''}
              </span>
            </button>
          )}

          {isTripOwner && onUpdateMembers && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-9 flex items-center gap-1.5 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm thành viên</span>
            </button>
          )}

          {!isTripOwner && onLeaveTrip && (
            <button
              type="button"
              onClick={() => setIsLeaveConfirmOpen(true)}
              className="h-9 flex items-center gap-1.5 px-3.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Rời chuyến</span>
            </button>
          )}
        </div>
      </div>

      {/* Share / Join Code Management & Guest Handoff Card */}
      {(joinCode || (isTripOwner && onManageJoinCode)) && (
        <div className="rounded-xl bg-white text-neutral-900 border border-neutral-200 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-950">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Mã tham gia chuyến đi</span>
              </span>
              {joinCode && (
                <span
                  className={`text-xs font-semibold ${
                    joinCodeEnabled ? 'text-blue-700' : 'text-red-600'
                  }`}
                >
                  · {joinCodeEnabled ? 'Đang mở tham gia' : 'Đang tạm khóa'}
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              {isTripOwner
                ? 'Chia sẻ mã này để bạn bè tham gia chuyến với tư cách Hành khách có tài khoản, hoặc nhập giúp cho người thân không tài khoản.'
                : 'Dùng mã này để mời thêm người thân không tài khoản cùng theo dõi lịch trình.'}
            </p>

            {joinCode ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="px-3.5 py-2 rounded-lg bg-neutral-950 text-blue-300 border border-neutral-800 font-mono text-base font-bold tracking-[0.2em] select-all">
                  {joinCode}
                </div>

                <button
                  type="button"
                  onClick={() => void handleCopy('code')}
                  className="h-9 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  {copiedType === 'code' ? <Check className="w-3.5 h-3.5 text-blue-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'code' ? 'Đã chép mã' : 'Sao chép mã'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopy('link')}
                  className="h-9 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-blue-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  {copiedType === 'link' ? <Check className="w-3.5 h-3.5 text-blue-600" /> : <Link2 className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'link' ? 'Đã chép link mời' : 'Sao chép link mời'}</span>
                </button>

                {isTripOwner && onManageJoinCode && (
                  <>
                    <button
                      type="button"
                      disabled={isManagingCode}
                      onClick={() => void handleCodeAction('rotate')}
                      className="h-9 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      title="Đổi sang mã mời mới (mã cũ sẽ hết hiệu lực)"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isManagingCode ? 'animate-spin' : ''}`} />
                      <span>Đổi mã mới</span>
                    </button>

                    <button
                      type="button"
                      disabled={isManagingCode}
                      onClick={() => void handleCodeAction('toggle')}
                      className="h-9 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {joinCodeEnabled ? <Lock className="w-3.5 h-3.5 text-red-600" /> : <Unlock className="w-3.5 h-3.5 text-blue-600" />}
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
                  className="mt-1 h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isManagingCode ? 'Đang tạo mã...' : 'Tạo mã mời vào chuyến'}</span>
                </button>
              )
            )}
          </div>

          {/* Direct Guest Portal Handoff */}
          {joinCode && joinCodeEnabled && onOpenGuestModeWithCode && (
            <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-neutral-100 pt-4 lg:pt-0 lg:pl-5 space-y-2.5 text-xs">
              <div className="font-bold text-neutral-950">
                Mở giao diện Hành khách (Không tài khoản)
              </div>
              <p className="text-xs text-neutral-500">
                Nhập tên người thân (nếu cần) và mở nhanh bằng mã <strong className="font-mono text-blue-700">{joinCode}</strong>.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={guestPreviewName}
                  onChange={(e) => setGuestPreviewName(e.target.value)}
                  placeholder="Tên người thân (tùy chọn)"
                  className="flex-1 h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  disabled={isOpeningGuestPreview}
                  onClick={() => void handleOpenGuestForRelative()}
                  className="h-9 px-3.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 transition disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-red-400" />
                  <span>{isOpeningGuestPreview ? 'Đang mở...' : 'Mở giao diện'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          {errorMessage}
        </p>
      )}

      {/* Quick Filter Tabs */}
      {members.length > 0 && (
        <div className={`flex items-center gap-1.5 flex-wrap border-b pb-3 ${isAdmin ? 'border-neutral-800' : 'border-neutral-200'}`}>
          {(
            [
              { id: 'all', label: 'Tất cả', count: members.length },
              { id: 'passenger', label: 'Hành khách', count: passengerCount },
              { id: 'staff', label: 'Điều hành / Xe', count: staffCount },
              { id: 'guest', label: 'Người thân không TK', count: guestCount },
            ] as const
          ).map((tab) => {
            const active = memberFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMemberFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer tabular-nums whitespace-nowrap ${
                  active
                    ? isAdmin
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-950 text-white'
                    : isAdmin
                      ? 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                      : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>
      )}

      {/* Search active notice */}
      {normalizedQuery && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-950">
          <span>Tìm kiếm thành viên theo: <strong>&quot;{searchQuery}&quot;</strong> ({filteredMembers.length} kết quả)</span>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="font-bold text-blue-700 hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* Members Grid */}
      {filteredMembers.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-xl border border-dashed border-neutral-200 text-xs text-neutral-500">
          {normalizedQuery ? (
            <>
              Không tìm thấy thành viên nào khớp với từ khóa &quot;{searchQuery}&quot;.
              {onClearSearch && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="block mx-auto mt-2 text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  Xem tất cả thành viên
                </button>
              )}
            </>
          ) : memberFilter !== 'all' ? (
            <>
              Không có thành viên nào trong nhóm lọc này.
              <button
                type="button"
                onClick={() => setMemberFilter('all')}
                className="block mx-auto mt-2 text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Xem tất cả thành viên
              </button>
            </>
          ) : (
            <>
              Chưa có thành viên nào trong đoàn.
              {isTripOwner && onUpdateMembers && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="block mx-auto mt-2 text-blue-600 font-semibold hover:underline cursor-pointer"
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

            const accountLabel =
              member.memberType === 'account'
                ? 'Có tài khoản'
                : member.memberType === 'guest'
                  ? 'Không tài khoản'
                  : 'Thêm thủ công';

            const roleColor =
              member.role === 'Trưởng đoàn'
                ? 'text-neutral-950'
                : member.role === 'Hướng dẫn viên'
                  ? 'text-blue-700'
                  : member.role === 'Tài xế'
                    ? 'text-blue-600'
                    : member.role === 'Khách VIP'
                      ? 'text-red-600'
                      : 'text-neutral-600';

            return (
              <div
                key={member.id}
                className="p-4 rounded-xl bg-white border border-neutral-200 hover:border-blue-400 transition flex flex-col justify-between group"
              >
                <div>
                  {/* Header row with Avatar, Name, Role & Account status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-neutral-950 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {member.avatar || getMemberInitials(member.name)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-neutral-950 leading-snug truncate">
                          {member.name}
                          {isOwnMember && (
                            <span className="ml-1.5 text-xs font-semibold text-blue-700">(Bạn)</span>
                          )}
                        </h4>
                        <div className="text-xs mt-0.5 truncate">
                          <span className={`font-semibold ${roleColor}`}>{member.role}</span>
                          <span aria-hidden="true" className="text-neutral-300 mx-1.5">·</span>
                          <span className="text-neutral-500">{accountLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          member.status === 'online'
                            ? 'bg-blue-600'
                            : member.status === 'busy'
                              ? 'bg-red-600'
                              : 'bg-neutral-300'
                        }`}
                        title={
                          member.status === 'online'
                            ? 'Trực tuyến'
                            : member.status === 'busy'
                              ? 'Đang bận'
                              : 'Ngoại tuyến'
                        }
                      />
                      {isTripOwner && onUpdateMembers && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(member)}
                          className="opacity-70 group-hover:opacity-100 p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition cursor-pointer"
                          title="Chỉnh sửa thông tin"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteThisMember && (
                        <button
                          type="button"
                          onClick={() => setDeletingMemberId(member.id)}
                          className="opacity-70 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition cursor-pointer"
                          title="Xóa thành viên"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-xs text-neutral-600">
                    {member.phone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <a
                          href={`tel:${member.phone}`}
                          className="font-mono text-neutral-800 hover:text-blue-700 hover:underline tabular-nums"
                        >
                          {member.phone}
                        </a>
                      </div>
                    ) : (
                      <div className="text-[11px] text-neutral-400">Chưa có số điện thoại</div>
                    )}

                    {member.invitedByName && (
                      <div className="text-[11px] font-medium text-blue-700">
                        Đi cùng: <span className="font-semibold">{member.invitedByName}</span>
                      </div>
                    )}

                    {member.specialPreference && (
                      <div className="p-2 rounded-lg bg-red-50/70 border border-red-200/70 text-[11px] text-red-900 flex items-start gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                        <span><strong>Lưu ý:</strong> {member.specialPreference}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attendance segmented control (supports all 3 states) */}
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-neutral-500 font-medium shrink-0">Điểm danh:</span>
                  {canToggleAttendance ? (
                    <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 gap-0.5">
                      {(
                        [
                          { value: 'Chưa điểm danh', label: 'Chưa ĐD', activeCls: 'bg-neutral-950 text-white shadow-2xs border-neutral-950' },
                          { value: 'Có mặt', label: 'Có mặt', activeCls: 'bg-blue-600 text-white border-blue-600' },
                          { value: 'Vắng mặt', label: 'Vắng mặt', activeCls: 'bg-red-600 text-white border-red-600' },
                        ] as const
                      ).map((opt) => {
                        const normalizedStatus =
                          member.attendanceStatus === 'Có mặt' || member.attendanceStatus === 'Vắng mặt'
                            ? member.attendanceStatus
                            : 'Chưa điểm danh';
                        const isActive = normalizedStatus === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={updatingMemberId === member.id}
                            title={`Đặt trạng thái: ${opt.value}`}
                            aria-pressed={isActive}
                            onClick={() => void setAttendance(member.id, opt.value)}
                            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition disabled:opacity-50 cursor-pointer ${
                              isActive
                                ? opt.activeCls
                                : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/80'
                            }`}
                          >
                            {updatingMemberId === member.id && isActive ? '...' : opt.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span
                      className={`font-semibold flex items-center gap-1 ${
                        member.attendanceStatus === 'Có mặt'
                          ? 'text-blue-700'
                          : member.attendanceStatus === 'Vắng mặt'
                            ? 'text-red-700'
                            : 'text-neutral-500'
                      }`}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${member.attendanceStatus === 'Có mặt' ? 'text-blue-600' : 'text-neutral-400'}`} />
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
        title="Thêm người thân đi cùng (không cần tài khoản)"
        subtitle="Đăng ký tên người thân vào danh sách đoàn và dùng chung mã mời để xem giao diện Hành khách"
        icon={<UserPlus className="w-4 h-4" />}
      >
        <form onSubmit={handleCreateCompanion} className="p-6 space-y-4 text-xs">
          {!isTripOwner && (
            <div
              className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                companionLimitReached
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-600'
              }`}
            >
              {companionLimitReached
                ? `Bạn đã thêm đủ tối đa ${MAX_GUEST_COMPANIONS_PER_PASSENGER} người thân đi cùng cho chuyến đi này.`
                : `Số người thân bạn đã thêm: ${myCompanionCount}/${MAX_GUEST_COMPANIONS_PER_PASSENGER}.`}
            </div>
          )}

          <Field label="Họ và tên người thân *">
            <TextInput
              type="text"
              required
              autoFocus
              disabled={companionLimitReached}
              value={companionName}
              onChange={(e) => setCompanionName(e.target.value)}
              placeholder="Ví dụ: Cô Lan / Bé Minh"
            />
          </Field>

          <Field label="Số điện thoại (tùy chọn)">
            <TextInput
              type="tel"
              disabled={companionLimitReached}
              value={companionPhone}
              onChange={(e) => setCompanionPhone(e.target.value)}
              placeholder="Nếu chưa có điện thoại có thể bỏ trống"
              className="font-mono"
            />
          </Field>

          <Field label="Lưu ý ăn uống / sức khỏe (tùy chọn)">
            <TextInput
              type="text"
              disabled={companionLimitReached}
              value={companionPreference}
              onChange={(e) => setCompanionPreference(e.target.value)}
              placeholder="Ví dụ: Say xe, ăn chay, người lớn tuổi..."
            />
          </Field>

          <ModalFooter
            onCancel={() => setIsCompanionModalOpen(false)}
            submitLabel={isSavingCompanion ? 'Đang lưu...' : 'Thêm vào đoàn'}
            disabled={isSavingCompanion || companionLimitReached}
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

          <Field label="Số điện thoại liên hệ (tùy chọn)">
            <TextInput
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Ví dụ: 0912 345 678 (có thể bỏ trống)"
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
            cancelDisabled={isSavingMember}
            disabled={isSavingMember}
            submitLabel={isSavingMember ? 'Đang lưu...' : 'Thêm thành viên mới'}
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

            <Field label="Số điện thoại (tùy chọn)">
              <TextInput
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Bỏ trống nếu chưa có"
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
            cancelDisabled={isSavingMember}
            disabled={isSavingMember}
            submitLabel={isSavingMember ? 'Đang lưu...' : 'Lưu thay đổi'}
          />
        </form>
      </Modal>

      {/* Modal: Xác nhận xóa thành viên */}
      <Modal
        isOpen={Boolean(deletingMemberId)}
        onClose={() => !isDeletingMember && setDeletingMemberId(null)}
        maxWidth="sm"
        hideHeader
      >
        <div className="p-6 text-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-neutral-950">Xóa thành viên khỏi đoàn?</h3>
            <p className="text-neutral-500 mt-1 leading-relaxed">
              Hành động này sẽ xóa {deletingTarget?.name ? <strong>&quot;{deletingTarget.name}&quot;</strong> : 'thành viên này'} khỏi danh sách đoàn.
              {cascadeCompanionsCount > 0 && (
                <span className="block mt-1.5 text-red-700 font-semibold">
                  Đồng thời sẽ xóa {cascadeCompanionsCount} người thân đi cùng do thành viên này đăng ký.
                </span>
              )}
            </p>
          </div>
          <ModalFooter
            cancelLabel="Hủy bỏ"
            onCancel={() => setDeletingMemberId(null)}
            cancelDisabled={isDeletingMember}
            disabled={isDeletingMember}
            submitLabel={isDeletingMember ? 'Đang xóa...' : 'Xác nhận xóa'}
            submitType="button"
            onSubmitClick={() => deletingMemberId && void handleDeleteMember(deletingMemberId)}
            submitVariant="red"
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
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <LogOut className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-neutral-950">Rời khỏi chuyến đi này?</h3>
            <p className="text-neutral-500 mt-1">
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
            submitVariant="red"
            bordered={false}
            align="center"
          />
        </div>
      </Modal>
    </div>
  );
};

