import React from 'react';
import { Calendar, Clock, Edit2, MapPin, Trash2 } from 'lucide-react';
import type { Activity, DaySchedule } from '../../../types/travel';

interface ManualActivitiesListProps {
  currentDay: DaySchedule;
  activeDayIndex: number;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: string) => void;
  getActivityTypeIcon: (type: string) => React.ReactNode;
  getActivityTypeLabel: (type: string) => string;
}

export function ManualActivitiesList({
  currentDay,
  activeDayIndex,
  onEditActivity,
  onDeleteActivity,
  getActivityTypeIcon,
  getActivityTypeLabel,
}: ManualActivitiesListProps) {
  return (
    <>
                {/* Danh sách hoạt động của Ngày hiện tại */}
                <div className="space-y-2">
                  {currentDay.activities.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-neutral-300 text-xs text-neutral-500">
                      <Calendar className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="font-bold text-neutral-800">Chưa có hoạt động nào trong Ngày {activeDayIndex}</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Nhấp nút &quot;+ Thêm hoạt động&quot; ở trên để tự do thiết lập điểm đến và thời gian theo kế hoạch của bạn.
                      </p>
                    </div>
                  ) : (
                    currentDay.activities.map((act, actIdx) => (
                      <div
                        key={act.id}
                        className="p-3 bg-white rounded-xl border border-neutral-200 hover:border-blue-400 transition text-xs flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-neutral-950 flex items-center justify-center font-bold text-[11px] text-white shrink-0">
                            {actIdx + 1}
                          </span>

                          <div className="flex items-center gap-1.5 font-mono font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-xs shrink-0 tabular-nums">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>
                              {act.timeStart} — {act.timeEnd}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-neutral-950 truncate">{act.title}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-neutral-100 text-neutral-700 border border-neutral-200 shrink-0">
                                {getActivityTypeIcon(act.type)}
                                <span>{getActivityTypeLabel(act.type)}</span>
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5 truncate">
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 text-red-600 shrink-0" />
                                <span className="truncate">{act.location}</span>
                              </span>
                              {act.coordinates ? (
                                <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shrink-0 tabular-nums">
                                  {act.coordinates.lat.toFixed(3)}, {act.coordinates.lng.toFixed(3)}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded shrink-0">
                                  Chưa có tọa độ
                                </span>
                              )}
                              {act.cost && act.cost > 0 ? (
                                <span className="font-mono text-neutral-900 font-bold shrink-0 tabular-nums">
                                  · {act.cost.toLocaleString('vi-VN')} ₫
                                </span>
                              ) : null}
                              {act.details ? (
                                <span className="text-neutral-400 truncate hidden md:inline">
                                  · {act.details}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onEditActivity(act)}
                            className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Sửa hoạt động"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteActivity(act.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Xóa hoạt động này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

    </>
  );
}
