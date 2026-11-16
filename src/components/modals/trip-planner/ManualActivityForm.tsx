import { Edit2, Plus, X } from 'lucide-react';
import type { ManualPlannerTabProps } from './ManualPlannerTab';

type ManualActivityFormProps = Pick<
  ManualPlannerTabProps,
  | 'isActivityFormOpen'
  | 'setIsActivityFormOpen'
  | 'onSaveActivity'
  | 'actFormError'
  | 'editingActivityId'
  | 'actTitle'
  | 'setActTitle'
  | 'actType'
  | 'setActType'
  | 'actTimeStart'
  | 'setActTimeStart'
  | 'actTimeEnd'
  | 'setActTimeEnd'
  | 'actLocation'
  | 'setActLocation'
  | 'actCost'
  | 'setActCost'
  | 'actDetails'
  | 'setActDetails'
  | 'activeDayIndex'
>;

export function ManualActivityForm(props: ManualActivityFormProps) {
  const {
    isActivityFormOpen,
    setIsActivityFormOpen,
    onSaveActivity,
    actFormError,
    editingActivityId,
    actTitle,
    setActTitle,
    actType,
    setActType,
    actTimeStart,
    setActTimeStart,
    actTimeEnd,
    setActTimeEnd,
    actLocation,
    setActLocation,
    actCost,
    setActCost,
    actDetails,
    setActDetails,
    activeDayIndex,
  } = props;

  return (
    <>
                {/* Form Thêm / Chỉnh sửa hoạt động (Inline Form) */}
                {isActivityFormOpen && (
                  <form
                    onSubmit={onSaveActivity}
                    className="p-4 bg-teal-50/60 rounded-2xl border-2 border-teal-500/30 space-y-3 animate-in fade-in slide-in-from-top-2"
                  >
                    <div className="flex items-center justify-between border-b border-teal-200 pb-2">
                      <h5 className="text-xs font-black text-teal-900 flex items-center gap-1.5">
                        {editingActivityId ? (
                          <>
                            <Edit2 className="w-3.5 h-3.5 text-teal-700" />
                            <span>Chỉnh sửa hoạt động</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-teal-700" />
                            <span>Thêm hoạt động mới vào Ngày {activeDayIndex}</span>
                          </>
                        )}
                      </h5>
                      <button
                        type="button"
                        onClick={() => setIsActivityFormOpen(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {actFormError && (
                      <div className="p-2 bg-rose-100 text-rose-800 text-[11px] font-semibold rounded-lg">
                        {actFormError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
                      <div className="sm:col-span-8">
                        <label className="block font-bold text-slate-700 mb-1">
                          Tên hoạt động / Điểm tham quan <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={actTitle}
                          onChange={(e) => setActTitle(e.target.value)}
                          placeholder="VD: Tham quan Tháp Bà Ponagar / Dùng cơm trưa nem nướng"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block font-bold text-slate-700 mb-1">Phân loại</label>
                        <select
                          value={actType}
                          onChange={(e) => setActType(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium outline-none"
                        >
                          <option value="sightseeing">Tham quan</option>
                          <option value="meal">Ăn uống</option>
                          <option value="transport">Di chuyển</option>
                          <option value="hotel">Khách sạn / Lưu trú</option>
                          <option value="checkin">Check-in / Nhận phòng</option>
                          <option value="briefing">Điều hành / Tập trung</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">Giờ bắt đầu</label>
                        <input
                          type="time"
                          value={actTimeStart}
                          onChange={(e) => setActTimeStart(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">Giờ kết thúc</label>
                        <input
                          type="time"
                          value={actTimeEnd}
                          onChange={(e) => setActTimeEnd(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">Địa điểm cụ thể</label>
                        <input
                          type="text"
                          value={actLocation}
                          onChange={(e) => setActLocation(e.target.value)}
                          placeholder="VD: Đường 2/4, Vĩnh Phước, Nha Trang"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">Chi phí dự kiến (VNĐ)</label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={actCost}
                          onChange={(e) => setActCost(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="VD: 500000"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono outline-none"
                        />
                      </div>

                      <div className="sm:col-span-12">
                        <label className="block font-bold text-slate-700 mb-1">
                          Chi tiết / Yêu cầu vận hành
                        </label>
                        <input
                          type="text"
                          value={actDetails}
                          onChange={(e) => setActDetails(e.target.value)}
                          placeholder="VD: Vé tham quan đã đặt trước, HDV liên hệ ban quản lý trước 15 phút"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-teal-200">
                      <button
                        type="button"
                        onClick={() => setIsActivityFormOpen(false)}
                        className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        {editingActivityId ? 'Cập nhật hoạt động' : 'Lưu hoạt động vào Ngày ' + activeDayIndex}
                      </button>
                    </div>
                  </form>
                )}


    </>
  );
}
