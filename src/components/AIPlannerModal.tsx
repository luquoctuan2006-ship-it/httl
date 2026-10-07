import React, { useState } from 'react';
import {
  X,
  Sparkles,
  MapPin,
  Calendar,
  Wallet,
  Users,
  Compass,
  Check,
  Loader2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { TripData } from '../types/travel';
import { authenticatedFetch, safeJsonResponse } from '../api';

interface AIPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPlan: (newTrip: TripData) => Promise<void>;
}

export const AIPlannerModal: React.FC<AIPlannerModalProps> = ({
  isOpen,
  onClose,
  onApplyPlan,
}) => {
  const [destination, setDestination] = useState('Đà Nẵng - Hội An - Huế');
  const [days, setDays] = useState(7);
  const [budget, setBudget] = useState('Tiêu chuẩn (40 - 50 triệu)');
  const [travelStyle, setTravelStyle] = useState('Văn hóa, Di sản & Ẩm thực bản địa');
  const [groupType, setGroupType] = useState('Đoàn gia đình & bạn bè (18 người)');
  const [preferences, setPreferences] = useState(
    'Ưu tiên điểm tham quan mát mẻ vào buổi trưa, trải nghiệm ẩm thực địa phương, nghỉ tại resort/khách sạn 4 sao ven biển'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setGeneratedPlan(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 190_000);

    try {
      const res = await authenticatedFetch('/api/gemini/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          destination,
          days,
          budget,
          travelStyle,
          groupType,
          preferences,
          startLocation: 'Sân bay Quốc tế Đà Nẵng',
        }),
      });

      const json = await safeJsonResponse(res);
      if (json.success && json.data) {
        setGeneratedPlan(json.data);
      } else {
        throw new Error(json.error || 'Không thể tạo lịch trình');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Yêu cầu tạo lịch trình vượt quá thời gian chờ. Vui lòng thử lại hoặc giảm số ngày hành trình.'
          : err instanceof Error
            ? err.message
            : 'Không thể tạo lịch trình bằng Gemini',
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!generatedPlan) return;
    // Map to TripData structure
    const updatedTrip: TripData = {
      id: `trip-${Date.now()}`,
      code: generatedPlan.tripCode || 'VN-1025',
      title: generatedPlan.title || `Khám phá ${destination} ${days} ngày`,
      status: 'Đang vận hành',
      dates: '12–18 THG 10, 2026',
      origin: generatedPlan.routeSummary?.origin || 'ĐN',
      originFull: 'Đà Nẵng',
      destination: generatedPlan.routeSummary?.destination || 'HUE',
      destinationFull: 'Huế',
      destinationsCount: generatedPlan.routeSummary?.destinationsCount || 5,
      totalKm: generatedPlan.routeSummary?.totalKm || 428,
      vehicle: generatedPlan.routeSummary?.vehicle || 'Xe 29 chỗ',
      currentDay: 1,
      totalDays: days,
      totalActivities: generatedPlan.days ? generatedPlan.days.length * 3 : 18,
      confirmedActivities: 16,
      pendingActivities: 2,
      budgetTotal: generatedPlan.budget?.total || 48600000,
      budgetUsed: generatedPlan.budget?.used || 15000000,
      budgetRemaining: (generatedPlan.budget?.total && generatedPlan.budget?.used)
        ? Math.max(0, generatedPlan.budget.total - generatedPlan.budget.used)
        : 33600000,
      budgetUsedPercent: (generatedPlan.budget?.total && generatedPlan.budget?.used)
        ? Math.round((generatedPlan.budget.used / generatedPlan.budget.total) * 100)
        : 31,
      membersOnline: 8,
      membersTotal: 8,
      membersStatus: 'Tất cả đã tập trung',
      weather: {
        temp: 28,
        description: 'Mây nhẹ',
        rainProb: '20%',
        rainProbTime: '15:00',
      },
      telematics: {
        from: 'Sân bay Đà Nẵng',
        to: 'Hội An',
        durationMinutes: 35,
        eta: '10:15',
        vehicleType: 'Xe 29 chỗ',
        driver: 'Trần Bình',
        passengerCount: 18,
        gpsStatus: 'GPS ổn định',
        trafficStatus: 'Lưu thông tốt',
        lastUpdated: '10:00',
      },
      waypoints: [
        { id: 'wp-1', code: '01', name: 'Đà Nẵng', status: 'completed', lat: 16.0544, lng: 108.2022, xPercent: 24, yPercent: 52 },
        { id: 'wp-2', code: '02', name: 'Hội An', status: 'current', lat: 15.8801, lng: 108.338, xPercent: 36, yPercent: 44 },
        { id: 'wp-3', code: '03', name: 'Bà Nà', status: 'pending', lat: 15.9988, lng: 107.986, xPercent: 46, yPercent: 40 },
        { id: 'wp-4', code: '04', name: 'Lăng Cô', status: 'pending', lat: 16.2294, lng: 108.082, xPercent: 60, yPercent: 33 },
        { id: 'wp-5', code: '05', name: 'Huế', status: 'pending', lat: 16.4698, lng: 107.578, xPercent: 82, yPercent: 24 },
      ],
      alerts: [
        {
          id: 'alt-new-1',
          title: 'Dự báo mưa nhẹ buổi chiều',
          timeAgo: 'Vừa xong',
          description: 'Khả năng có mưa rào nhẹ 20%, không ảnh hưởng nhiều đến lịch tham quan.',
          severity: 'info',
          category: 'weather',
        },
      ],
      aiSuggestions: [
        {
          id: 'sug-new-1',
          title: 'Gợi ý check-in khung giờ vàng',
          badge: '-20’',
          description: 'Đến Hội An lúc hoàng hôn để du khách chụp ảnh hoa đăng đẹp nhất.',
        },
      ],
      aiSavingsEstimate: '520.000đ',
      aiConfidence: '96%',
      members: [
        { id: 'm1', name: 'Minh Lê', avatar: 'ML', role: 'Trưởng đoàn', phone: '0905 123 456', status: 'online' },
        { id: 'm2', name: 'An Nguyễn', avatar: 'AN', role: 'Hướng dẫn viên', phone: '0912 345 678', status: 'online' },
        { id: 'm3', name: 'Hải Trần', avatar: 'HT', role: 'Tài xế', phone: '0988 777 999', status: 'online' },
        { id: 'm4', name: 'Quốc Khánh', avatar: 'QK', role: 'Khách du lịch', phone: '0977 111 222', status: 'online' },
      ],
      days: (generatedPlan.days && generatedPlan.days.length > 0)
        ? generatedPlan.days.map((d: any, idx: number) => ({
            dayIndex: idx + 1,
            dateLabel: `T${idx + 2} ${12 + idx}`,
            dayName: `T${idx + 2}`,
            dateNum: 12 + idx,
            fullDate: d.fullDate || `Ngày ${idx + 1}`,
            confirmedCount: 3,
            pendingCount: 0,
            dispatcherNote: d.summary || 'Theo dõi hành trình',
            activities: d.activities || [],
          }))
        : [
            {
              dayIndex: 1,
              dateLabel: 'T2 12',
              dayName: 'T2',
              dateNum: 12,
              fullDate: 'Thứ Hai, 12 tháng 10',
              confirmedCount: 3,
              pendingCount: 0,
              dispatcherNote: 'Đoàn bắt đầu xuất phát theo lịch trình AI vừa gợi ý.',
              activities: [
                {
                  id: 'a1',
                  timeStart: '08:30',
                  timeEnd: '10:00',
                  title: 'Đón đoàn & Khởi hành đi Hội An',
                  location: 'Sân bay Đà Nẵng',
                  status: 'Đang diễn ra',
                  type: 'transport',
                  details: 'Xe 29 chỗ • Hướng dẫn viên An',
                },
                {
                  id: 'a2',
                  timeStart: '11:00',
                  timeEnd: '13:00',
                  title: 'Thưởng thức ẩm thực Phố Hội & Check-in',
                  location: 'Phố Cổ Hội An',
                  status: 'Đã xác nhận',
                  type: 'meal',
                  details: 'Thực đơn cơm gà Bà Buội, chè bắp',
                },
                {
                  id: 'a3',
                  timeStart: '15:30',
                  timeEnd: '18:00',
                  title: 'Khám phá di sản Chùa Cầu & Sông Hoài',
                  location: 'Hội An',
                  status: 'Đã xác nhận',
                  type: 'sightseeing',
                  details: 'Trải nghiệm đèn lồng thủ công',
                },
              ],
            },
          ],
    };

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await onApplyPlan(updatedTrip);
      onClose();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Không thể lưu chuyến đi mới');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#0F766E] to-[#0D9488] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                Hoạch định Lịch trình Thông minh cùng Gemini AI
              </h3>
              <p className="text-xs text-teal-100 font-medium">
                Cá nhân hóa theo sở thích du khách, ngân sách & tối ưu cung đường
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Destination & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                <span>Điểm đến du lịch</span>
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="VD: Đà Nẵng - Huế - Hội An"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>Số ngày hành trình</span>
              </label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none bg-white"
              >
                <option value={3}>3 ngày 2 đêm (Tour ngắn ngày)</option>
                <option value={5}>5 ngày 4 đêm (Tiêu chuẩn)</option>
                <option value={7}>7 ngày 6 đêm (Trọn vẹn di sản)</option>
                <option value={10}>10 ngày (Xuyên Việt miền Trung)</option>
              </select>
            </div>
          </div>

          {/* Budget & Style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-teal-600" />
                <span>Mức ngân sách</span>
              </label>
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none bg-white"
              >
                <option value="Tiết kiệm (20 - 30 triệu)">Tiết kiệm (20 - 30 triệu)</option>
                <option value="Tiêu chuẩn (40 - 50 triệu)">Tiêu chuẩn (40 - 50 triệu)</option>
                <option value="Cao cấp / Nghỉ dưỡng (> 70 triệu)">Cao cấp / Nghỉ dưỡng (&gt; 70 triệu)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-teal-600" />
                <span>Phong cách du lịch</span>
              </label>
              <input
                type="text"
                value={travelStyle}
                onChange={(e) => setTravelStyle(e.target.value)}
                placeholder="VD: Văn hóa, Di sản, Sinh thái, Check-in"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
              />
            </div>
          </div>

          {/* Group Profile */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>Đối tượng thành viên đoàn</span>
            </label>
            <input
              type="text"
              value={groupType}
              onChange={(e) => setGroupType(e.target.value)}
              placeholder="VD: Gia đình có trẻ nhỏ, nhóm trẻ bạn thân, đoàn doanh nghiệp"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
            />
          </div>

          {/* Personal Preferences */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Sở thích cá nhân hóa & Yêu cầu điều phối đặc biệt</span>
              </span>
              <span className="text-[11px] text-teal-600 font-semibold">Gemini API Powered</span>
            </label>
            <textarea
              rows={3}
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="Nhập các sở thích: ưu tiên chụp ảnh, không di chuyển liên tục quá 2 tiếng, tránh nắng gắt buổi trưa, ăn hải sản tươi sống..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none resize-none"
            />
          </div>

          {/* Generate Button */}
          <div className="pt-2">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-700/20 transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gemini AI đang phân tích dữ liệu & hoạch định hành trình...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Khởi tạo & Tối ưu Lịch trình bằng Gemini API</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {errorMsg}
            </p>
          )}

          {/* Generated Plan Preview Box */}
          {generatedPlan && (
            <div className="mt-4 p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-sm font-extrabold text-teal-900">
                    {generatedPlan.title || 'Hành trình đề xuất'}
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-teal-700 bg-white px-2 py-0.5 rounded border border-teal-200">
                  {generatedPlan.tripCode || 'VN-1025'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                  <span className="text-slate-400 block text-[11px]">Tuyến di chuyển:</span>
                  <strong className="text-slate-800">
                    {generatedPlan.routeSummary?.origin || 'ĐN'} → {generatedPlan.routeSummary?.destination || 'HUE'} ({generatedPlan.routeSummary?.totalKm || 428} km)
                  </strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                  <span className="text-slate-400 block text-[11px]">Phương tiện:</span>
                  <strong className="text-slate-800">{generatedPlan.routeSummary?.vehicle || 'Xe 29 chỗ'}</strong>
                </div>
              </div>

              {/* AI Operational Suggestions Preview */}
              {generatedPlan.aiOperationalSuggestions && (
                <div className="space-y-1.5 mb-3">
                  <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                    Đề xuất điều phối vận hành thông minh:
                  </span>
                  {generatedPlan.aiOperationalSuggestions.map((sug: any, idx: number) => (
                    <div key={idx} className="bg-white p-2 rounded-lg border border-teal-100 text-[11px] text-slate-700 flex items-start gap-1.5">
                      <Sparkles className="w-3 h-3 text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>{sug.title}: </strong>
                        <span>{sug.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleApply}
                disabled={isSaving}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-2"
              >
                <span>{isSaving ? 'Đang lưu chuyến đi...' : 'Nạp hành trình này vào Bảng điều phối'}</span>
                {!isSaving && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
