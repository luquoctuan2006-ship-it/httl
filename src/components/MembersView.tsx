import React, { useState } from 'react';
import { Users, Phone, CheckCircle2, Heart, Shield, Award } from 'lucide-react';
import { TripMember } from '../types/travel';

interface MembersViewProps {
  members: TripMember[];
  onToggleStatus: (id: string) => Promise<void>;
}

export const MembersView: React.FC<MembersViewProps> = ({ members, onToggleStatus }) => {
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const presentCount = members.filter((member) => member.attendanceStatus === 'Có mặt').length;
  const onlineCount = members.filter((member) => member.status === 'online').length;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">Danh sách Thành viên & Hồ sơ Sở thích</h2>
          <p className="text-xs text-slate-500 font-medium">
            Quản lý {members.length} thành viên đoàn, điểm danh và cá nhân hóa nhu cầu
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{presentCount}/{members.length} có mặt · {onlineCount} trực tuyến</span>
          </span>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          {errorMessage}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-sm transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 font-bold text-sm flex items-center justify-center border border-teal-200">
                    {member.avatar}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">{member.name}</h4>
                    <span className="text-[11px] font-semibold text-slate-500">{member.role}</span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {member.status}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{member.phone}</span>
                </div>

                {member.specialPreference && (
                  <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900 flex items-start gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span><strong>Sở thích:</strong> {member.specialPreference}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-[11px]">
              <span className="text-slate-400">Trạng thái điểm danh:</span>
              <button
                type="button"
                disabled={updatingMemberId === member.id}
                onClick={() => void toggleAttendance(member.id)}
                aria-pressed={member.attendanceStatus === 'Có mặt'}
                className={`font-bold flex items-center gap-1 disabled:opacity-50 ${member.attendanceStatus === 'Có mặt' ? 'text-emerald-600' : 'text-slate-500 hover:text-teal-700'}`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {updatingMemberId === member.id ? 'Đang lưu...' : member.attendanceStatus || 'Chưa điểm danh'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
