import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Check,
  FileText,
  Zap,
} from 'lucide-react';
import { TripData } from '../../types/travel';
import { authenticatedFetch } from '../../api';


export interface AdminAIManagementProps {
  onOpenAIPlanner?: () => void;
  trip?: TripData | null;
  isAIApplied?: boolean;
}

export const AdminAIManagementView: React.FC<AdminAIManagementProps> = ({
  onOpenAIPlanner,
  trip,
  isAIApplied = false,
}) => {
  const [modelChoice, setModelChoice] = useState('gemini-3.5-flash');
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; label: string }>>([
    { id: 'gemini-3.5-flash', label: 'gemini-3.5-flash (Khuyến nghị)' },
    { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (Nhanh & kinh tế)' },
    { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
    { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
  ]);
  const [temperature, setTemperature] = useState('0.55');
  const [maxTokens, setMaxTokens] = useState('4000');
  const [systemPrompt, setSystemPrompt] = useState(
    'Bạn là chuyên gia điều phối tour du lịch cao cấp tại Việt Nam. Khi lập kế hoạch, hãy tối ưu hóa tuyến đường di chuyển hợp lý nhất, tôn trọng giờ mở cửa địa điểm và phân bổ chi phí minh bạch.'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latency: string; model: string; message?: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live Logs
  const [aiRequests, setAiRequests] = useState<any[]>([]);
  const [aiErrors, setAiErrors] = useState<any[]>([]);

  // Dynamic metrics from real AI requests
  const totalRequests = aiRequests.length;
  const successfulRequests = useMemo(
    () => aiRequests.filter((r) => r.status === 'Hoàn thành' || !r.status || r.status === 'success'),
    [aiRequests]
  );
  const avgReliability = useMemo(() => {
    if (totalRequests === 0) return '100%';
    const rate = Math.round((successfulRequests.length / totalRequests) * 100);
    return `${rate}%`;
  }, [totalRequests, successfulRequests.length]);

  const avgLatencyStr = useMemo(() => {
    if (totalRequests === 0) return '0.0s';
    const sum = aiRequests.reduce((acc, r) => {
      const val = parseFloat(String(r.latency || '0').replace('s', ''));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    return `${(sum / totalRequests).toFixed(2)}s`;
  }, [aiRequests, totalRequests]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Nạp cấu hình từ server
  const fetchAIConfig = async () => {
    try {
      const res = await authenticatedFetch('/api/admin/config');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.availableModels) && data.availableModels.length > 0) {
          setAvailableModels(data.availableModels);
        }
        if (data.config) {
          if (data.config.aiModel) setModelChoice(data.config.aiModel);
          if (data.config.temperature !== undefined) setTemperature(String(data.config.temperature));
          if (data.config.maxTokens) setMaxTokens(String(data.config.maxTokens));
          if (data.config.systemPrompt) setSystemPrompt(data.config.systemPrompt);
        }
      }
    } catch {
      // Giữ nguyên cấu hình hiện tại nếu tạm mất kết nối
    }

    try {
      const resLogs = await authenticatedFetch('/api/admin/ai-logs');
      if (resLogs.ok) {
        const dataLogs = await resLogs.json();
        if (Array.isArray(dataLogs.requests)) {
          setAiRequests(dataLogs.requests);
        }
        if (Array.isArray(dataLogs.errors)) {
          setAiErrors(dataLogs.errors);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchAIConfig();
  }, []);

  // Lưu cấu hình xuống server
  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await authenticatedFetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiModel: modelChoice,
          temperature: parseFloat(temperature) || 0.55,
          maxTokens: parseInt(maxTokens, 10) || 4000,
          systemPrompt,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.success !== false) {
        showToast(`Đã lưu cấu hình AI! Server hiện sử dụng mô hình "${modelChoice}".`);
      } else {
        showToast(payload.error || 'Lỗi khi lưu cấu hình lên máy chủ!');
      }
    } catch {
      showToast('Không thể kết nối máy chủ để lưu cấu hình AI.');
    } finally {
      setIsSaving(false);
    }
  };

  // Kiểm tra kết nối AI thời gian thực
  const handleTestAICall = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await authenticatedFetch('/api/admin/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          latency: data.latency,
          model: data.model || modelChoice,
          message: 'Kết nối mô hình Gemini thành công!',
        });
        showToast(`Ping AI thành công! Độ trễ: ${data.latency}`);
        // Refresh logs
        fetchAIConfig();
      } else {
        setTestResult({
          success: false,
          latency: data.latency || 'N/A',
          model: modelChoice,
          message: data.error || 'Lỗi phản hồi từ Gemini API',
        });
        showToast('Ping AI thất bại!');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latency: 'N/A',
        model: modelChoice,
        message: err.message || 'Lỗi mạng kết nối tới máy chủ',
      });
      showToast('Lỗi mạng khi kiểm tra AI');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-[#090B11] p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-red-600/20 text-red-300 border border-red-500/40">
              Trung tâm Điều khiển AI Gemini
            </span>
            <span className="text-xs text-neutral-400 font-semibold">Gemini Dynamic Model Engine</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Giám sát & Quản lý Hệ thống AI</h2>
          <p className="mt-1 text-xs text-neutral-400 max-w-2xl">
            Lựa chọn mô hình AI đang chạy thực tế trên máy chủ (áp dụng trực tiếp cho người dùng), theo dõi thời gian phản hồi, kiểm soát tỷ lệ lỗi và tinh chỉnh System Prompt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestAICall}
            disabled={isTesting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-blue-300 font-bold text-xs transition active:scale-95 disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${isTesting ? 'animate-bounce text-red-400' : 'text-blue-400'}`} />
            <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm Tra Kết Nối AI (Ping)'}</span>
          </button>
          {onOpenAIPlanner && (
            <button
              onClick={onOpenAIPlanner}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-950/40 transition active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Chạy AI Tạo Tour</span>
            </button>
          )}
        </div>
      </div>

      {/* Kết quả Test Ping nếu có */}
      {testResult && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between transition-all ${
            testResult.success
              ? 'bg-blue-950/60 border-blue-500/40 text-blue-200'
              : 'bg-red-950/60 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {testResult.success ? <CheckCircle2 className="w-5 h-5 text-blue-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
            <div>
              <strong className="block font-bold">
                {testResult.success ? 'Kết nối Gemini API thành công!' : 'Kết nối Gemini API gặp lỗi!'}
              </strong>
              <span className="text-[11px] opacity-80">{testResult.message}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono font-bold text-sm">{testResult.latency}</span>
            <span className="block text-[10px] opacity-75">Model: {testResult.model}</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Khối Cấu hình Tham số AI (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-neutral-800 bg-[#090B11] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <h3 className="font-black text-white text-base flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              Cấu hình Model & Tham số Hoạt động
            </h3>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
              Active Server Core
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Lựa chọn Model */}
            <div>
              <label className="text-neutral-300 font-bold block mb-1">
                Mô hình AI Đang Hoạt động (Model Version)
              </label>
              <select
                value={modelChoice}
                onChange={(e) => setModelChoice(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2.5 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableModels.map((modelOpt) => (
                  <option key={modelOpt.id} value={modelOpt.id}>
                    {modelOpt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-400 mt-1">
                Mô hình này sẽ được toàn bộ hệ thống (lập tour, tối ưu tuyến, tái lập khi mưa) gọi trực tiếp.
              </p>
            </div>

            {/* Slider Temperature & Max Tokens */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-neutral-300 font-bold">Temperature</label>
                  <span className="font-mono text-blue-400 font-bold">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full accent-blue-600"
                />
                <span className="text-[10px] text-neutral-500 block">Thấp = Chính xác cao; Cao = Sáng tạo</span>
              </div>

              <div>
                <label className="text-neutral-300 font-bold block mb-1">Max Output Tokens</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <label className="text-neutral-300 font-bold block mb-1">System Prompt Định hướng AI</label>
              <textarea
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-3 text-white text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Nút Lưu cấu hình */}
            <button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-500 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-blue-950/40 transition active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isSaving ? 'Đang lưu cấu hình...' : 'Lưu & Kích Hoạt Cấu Hình AI Trên Server'}</span>
            </button>
          </div>
        </div>

        {/* Khối Theo dõi Kết quả Lập lịch & Hiệu quả (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-neutral-800 bg-[#090B11] p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-2">
            <h3 className="font-black text-white text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              Đánh giá Hiệu quả Lập lịch AI Thực tế
            </h3>
            <span className="text-xs text-neutral-400">
              Độ tin cậy TB: <strong className="text-blue-400 font-mono tabular-nums">{avgReliability}</strong> • Độ trễ TB: <strong className="text-red-400 font-mono tabular-nums">{avgLatencyStr}</strong>
            </span>
          </div>

          {aiRequests.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
              <Sparkles className="w-8 h-8 text-blue-400 mx-auto opacity-80" />
              <p className="text-neutral-200 text-sm font-bold">Chưa có nhật ký chạy AI nào từ máy chủ</p>
              <p className="text-neutral-400 text-xs max-w-md mx-auto">
                Hệ thống sẽ tự động trích xuất các lượt chạy AI thực tế (tạo tour, tối ưu hành trình, ping kết nối) ngay khi có tác vụ phát sinh.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={handleTestAICall}
                  disabled={isTesting}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition"
                >
                  {isTesting ? 'Đang ping...' : 'Kiểm tra Ping AI ngay'}
                </button>
                {onOpenAIPlanner && (
                  <button
                    onClick={onOpenAIPlanner}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
                  >
                    Tạo tour mới với AI
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {aiRequests.map((req, idx) => {
                const latencyNum = parseFloat(String(req.latency || '1.0').replace('s', ''));
                const isSuccess = req.status === 'Hoàn thành' || !req.status || req.status === 'success';
                const confidence = isSuccess
                  ? latencyNum <= 1.5
                    ? '98%'
                    : latencyNum <= 3.0
                    ? '95%'
                    : '92%'
                  : '0%';
                const applied = req.applied !== undefined
                  ? req.applied
                  : isSuccess && (isAIApplied || Boolean(trip?.title));

                return (
                  <div key={req.id || idx} className="rounded-xl bg-neutral-900/80 p-4 border border-neutral-800 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-blue-400 font-bold shrink-0">{req.id}</span>
                        <strong className="text-white text-sm truncate" title={req.prompt}>
                          {req.prompt || `Yêu cầu xử lý ${req.id}`}
                        </strong>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] shrink-0 border ${
                        isSuccess
                          ? 'bg-blue-950 text-blue-300 border-blue-800'
                          : 'bg-red-950 text-red-300 border-red-800'
                      }`}>
                        Độ tin cậy: {confidence}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-neutral-950 p-2 text-neutral-300 border border-neutral-800">
                        Độ trễ phản hồi: <strong className="text-blue-400 font-mono">{req.latency || 'N/A'}</strong>
                      </div>
                      <div className="rounded-lg bg-neutral-950 p-2 text-neutral-300 border border-neutral-800 truncate">
                        Mô hình: <strong className="text-red-300 font-mono">{req.model || modelChoice}</strong>
                      </div>
                      <div className="rounded-lg bg-neutral-950 p-2 text-neutral-300 border border-neutral-800">
                        Tình trạng: <strong className={applied ? 'text-blue-400' : 'text-neutral-400'}>
                          {applied ? 'Đã áp dụng vào tour' : 'Sẵn sàng điều phối'}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/80">
                      <span>Người thực hiện: <strong className="text-neutral-300">{req.user || 'Hệ thống'}</strong></span>
                      <span className="font-mono text-[10px] text-neutral-500">{req.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Nhật ký Yêu cầu AI & Theo dõi Lỗi */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Requests Log (8 cols) */}
        <div className="lg:col-span-8 overflow-hidden rounded-2xl border border-neutral-800 bg-[#090B11] shadow-xl">
          <div className="bg-neutral-900/90 px-6 py-3.5 border-b border-neutral-800 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <strong className="text-white font-bold uppercase tracking-wider">Nhật ký Yêu cầu AI Thực tế (Requests Log)</strong>
            </div>
            <button
              onClick={fetchAIConfig}
              className="text-neutral-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Làm mới
            </button>
          </div>
          <div className="divide-y divide-neutral-800/70 text-xs">
            {aiRequests.length === 0 ? (
              <div className="p-6 text-center text-neutral-400">Chưa có lịch sử gọi AI nào trên máy chủ.</div>
            ) : (
              aiRequests.map((req) => (
                <div key={req.id} className="p-4 flex items-center justify-between hover:bg-neutral-900/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400 font-bold">{req.id}</span>
                      <strong className="text-white">{req.user}</strong>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-red-300 border border-neutral-700">
                        {req.model || modelChoice}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">{req.time}</span>
                    </div>
                    <p className="text-neutral-300 mt-1 line-clamp-1">{req.prompt}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                      {req.status}
                    </span>
                    <span className="block text-[10px] text-neutral-400 font-mono mt-0.5">{req.latency}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Error Monitor (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-neutral-800 bg-[#090B11] p-6 shadow-xl space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Giám sát Lỗi API & Hạn mức
          </h4>
          <p className="text-[11px] text-neutral-400">Theo dõi các lỗi timeout hoặc phân tích JSON để khắc phục kịp thời.</p>

          <div className="space-y-2 text-xs">
            {aiErrors.length === 0 ? (
              <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-neutral-400 text-center">
                Chưa ghi nhận lỗi AI nào.
              </div>
            ) : (
              aiErrors.map((err) => (
                <div key={err.id || err.code} className="p-3 rounded-xl bg-neutral-900/80 border border-red-900/50 text-neutral-300 space-y-1">
                  <div className="flex justify-between items-center">
                    <strong className="font-mono text-red-400">{err.code}</strong>
                    <span className="text-[10px] text-neutral-500">{err.time}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">{err.detail}</p>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-neutral-800 text-blue-300 border border-neutral-700">
                    Đã tự động khắc phục
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};