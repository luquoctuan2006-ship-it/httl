import React from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Compass,
  Loader2,
  MapPin,
  Route,
  Users,
  Wallet,
} from 'lucide-react';

import { PlaceAutocompleteInput, type PlaceCoordinates } from '../../common/PlaceAutocompleteInput';

type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

interface AiPlannerTabProps {
  isActive: boolean;
  aiDestination: string;
  setAiDestination: StateSetter<string>;
  aiDestinationCoordinates?: PlaceCoordinates;
  setAiDestinationCoordinates: StateSetter<PlaceCoordinates | undefined>;
  aiDays: number;
  setAiDays: StateSetter<number>;
  aiStartDate: string;
  setAiStartDate: StateSetter<string>;
  aiBudget: string;
  setAiBudget: StateSetter<string>;
  aiTravelStyle: string;
  setAiTravelStyle: StateSetter<string>;
  aiGroupType: string;
  setAiGroupType: StateSetter<string>;
  aiPreferences: string;
  setAiPreferences: StateSetter<string>;
  aiIsLoading: boolean;
  aiJobStatus: string | null;
  aiGeneratedPlan: any;
  isSaving: boolean;
  getStartLocation: (destination: string) => string;
  onGenerateAI: () => Promise<void>;
  onApplyAIPlan: () => Promise<void>;
}

export function AiPlannerTab(props: AiPlannerTabProps) {
  const {
    isActive,
    aiDestination,
    setAiDestination,
    aiDestinationCoordinates,
    setAiDestinationCoordinates,
    aiDays,
    setAiDays,
    aiStartDate,
    setAiStartDate,
    aiBudget,
    setAiBudget,
    aiTravelStyle,
    setAiTravelStyle,
    aiGroupType,
    setAiGroupType,
    aiPreferences,
    setAiPreferences,
    aiIsLoading,
    aiJobStatus,
    aiGeneratedPlan,
    isSaving,
    getStartLocation,
    onGenerateAI,
    onApplyAIPlan,
  } = props;

  return (
    <>
          {isActive && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-start gap-2.5 text-neutral-200">
                <Route className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-200 font-medium">
                  Hệ thống sẽ phân tích lộ trình, giờ mở cửa và thời gian di chuyển để đề xuất lịch trình phù hợp.
                </p>
              </div>

              {/* Destination & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block font-bold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-600" />
                    <span>Điểm đến du lịch mong muốn</span>
                  </label>
                  <PlaceAutocompleteInput
                    value={aiDestination}
                    onChangeText={setAiDestination}
                    coordinates={aiDestinationCoordinates}
                    onChangeCoordinates={setAiDestinationCoordinates}
                    placeholder="VD: Nha Trang, Đà Lạt, Sa Pa, Phú Quốc, Huế..."
                    inputClassName="w-full pl-8 pr-8 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Số ngày hành trình</span>
                  </label>
                  <select
                    value={aiDays}
                    onChange={(e) => setAiDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none bg-white"
                  >
                    <option value={2}>2 ngày 1 đêm</option>
                    <option value={3}>3 ngày 2 đêm</option>
                    <option value={4}>4 ngày 3 đêm</option>
                    <option value={5}>5 ngày 4 đêm</option>
                    <option value={7}>7 ngày 6 đêm</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ngày khởi hành</span>
                  </label>
                  <input
                    type="date"
                    value={aiStartDate}
                    onChange={(e) => setAiStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none bg-white"
                  />
                </div>
              </div>

              {/* Budget & Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-blue-600" />
                    <span>Mức ngân sách</span>
                  </label>
                  <select
                    value={aiBudget}
                    onChange={(e) => setAiBudget(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none bg-white"
                  >
                    <option value="Tiết kiệm (15 - 25 triệu)">Tiết kiệm (15 - 25 triệu)</option>
                    <option value="Tiêu chuẩn (30 - 45 triệu)">Tiêu chuẩn (30 - 45 triệu)</option>
                    <option value="Cao cấp / Nghỉ dưỡng (> 60 triệu)">Cao cấp / Nghỉ dưỡng (&gt; 60 triệu)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-blue-600" />
                    <span>Phong cách du lịch</span>
                  </label>
                  <input
                    type="text"
                    value={aiTravelStyle}
                    onChange={(e) => setAiTravelStyle(e.target.value)}
                    placeholder="VD: Văn hóa, Di sản, Sinh thái, Biển đảo, Check-in"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                  />
                </div>
              </div>

              {/* Group Profile */}
              <div>
                <label className="block font-bold text-neutral-800 mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>Đối tượng thành viên đoàn</span>
                </label>
                <input
                  type="text"
                  value={aiGroupType}
                  onChange={(e) => setAiGroupType(e.target.value)}
                  placeholder="VD: Gia đình có trẻ nhỏ, nhóm bạn thân 12 người, đoàn công ty 30 người"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                />
              </div>

              {/* Personal Preferences */}
              <div>
                <label className="block font-bold text-neutral-800 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>Yêu cầu & Lưu ý tối ưu lịch trình</span>
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={aiPreferences}
                  onChange={(e) => setAiPreferences(e.target.value)}
                  placeholder="Ưu tiên điểm tham quan mát mẻ buổi trưa, tránh nắng gắt, ăn hải sản tươi sống, khách sạn ven biển..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none resize-none"
                />
              </div>

              {/* Generate Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onGenerateAI}
                  disabled={aiIsLoading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {aiIsLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{aiJobStatus || 'Đang phân tích và sắp xếp lịch trình...'}</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 text-red-200" />
                      <span>Tạo lịch trình tự động</span>
                    </>
                  )}
                </button>
              </div>

              {/* Generated Plan Preview Box */}
              {aiGeneratedPlan && (
                <div className="mt-3 p-4 rounded-2xl bg-blue-50/70 border border-blue-200 animate-in fade-in slide-in-from-bottom-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-sm font-extrabold text-neutral-950">
                        {aiGeneratedPlan.title || 'Hành trình đề xuất tự động'}
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                      {aiGeneratedPlan.tripCode || 'VN-1025'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-blue-100">
                      <span className="text-neutral-400 block text-[10px]">Tuyến di chuyển:</span>
                      <strong className="text-neutral-900">
                        {aiGeneratedPlan.routeSummary?.origin || getStartLocation(aiDestination)} →{' '}
                        {aiGeneratedPlan.routeSummary?.destination || aiDestination} (
                        {aiGeneratedPlan.routeSummary?.totalKm || aiDays * 80} km)
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-blue-100">
                      <span className="text-neutral-400 block text-[10px]">Phương tiện:</span>
                      <strong className="text-neutral-900">
                        {aiGeneratedPlan.routeSummary?.vehicle || 'Xe 29 chỗ tiêu chuẩn'}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onApplyAIPlan}
                    disabled={isSaving}
                    className="w-full py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>
                      {isSaving
                        ? 'Đang lưu chuyến đi...'
                        : 'Lưu lịch trình tự động này vào chuyến đi'}
                    </span>
                    {!isSaving && <ArrowRight className="w-3.5 h-3.5 text-red-400" />}
                  </button>
                </div>
              )}
            </div>
          )}
    </>
  );
}
