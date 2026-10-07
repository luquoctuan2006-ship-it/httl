import React, { useState } from 'react';
import {
  X,
  Code2,
  Database,
  Cpu,
  Layers,
  Copy,
  Check,
  BookOpen,
  Terminal,
  Sparkles,
  Server
} from 'lucide-react';

interface ProjectArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectArchitectureModal: React.FC<ProjectArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'python' | 'firebase' | 'outline'>('architecture');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const pythonFastAPICode = `# main.py - Voyager Travel Ops Backend
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from google import genai
import firebase_admin
from firebase_admin import credentials, firestore

app = FastAPI(title="Voyager Travel Dispatcher API", version="1.0.0")

# 1. Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Initialize Gemini Client (Python SDK)
ai = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 3. Initialize Firebase Admin SDK
cred = credentials.Certificate("firebase-credentials.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Request Models
class UserPreference(BaseModel):
    destination: str
    days: int
    budget: str
    travel_style: str
    group_type: str
    preferences: str

@app.post("/api/itinerary/generate")
async def generate_itinerary(req: UserPreference):
    prompt = f"""
    Bạn là hệ thống AI quy hoạch lịch trình du lịch thông minh Voyager.
    Điểm đến: {req.destination}, {req.days} ngày.
    Ngân sách: {req.budget}. Phong cách: {req.travel_style}.
    Đối tượng: {req.group_type}. Sở thích: {req.preferences}.
    Trả về JSON lịch trình tối ưu theo từng mốc thời gian, chi phí và điều phối an toàn.
    """
    
    response = ai.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt,
        config={"response_mime_type": "application/json"}
    )
    
    # Save to Firebase Firestore
    doc_ref = db.collection("trips").document()
    doc_ref.set({"ai_plan": response.text, "created_at": firestore.SERVER_TIMESTAMP})
    
    return {"trip_id": doc_ref.id, "plan": response.text}

@app.post("/api/itinerary/optimize-realtime")
async def optimize_realtime(trip_id: str, weather_alert: str):
    prompt = f"Phân tích cảnh báo: {weather_alert} và điều chỉnh lịch trình chuyến đi {trip_id} để tránh mưa và trễ giờ check-in."
    response = ai.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt,
        config={"response_mime_type": "application/json"}
    )
    return {"optimized_plan": response.text}
`;

  const firebaseRulesCode = `// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Chuyến đi & Lịch trình điều phối
    match /trips/{tripId} {
      allow read: if true;
      allow write: if request.auth != null;
      
      match /activities/{activityId} {
        allow read, write: if true;
      }
      
      match /telematics/{telematicsId} {
        allow read, write: if true;
      }
      
      match /alerts/{alertId} {
        allow read, write: if true;
      }
    }
  }
}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
        {/* Modal Top Header */}
        <div className="px-6 py-5 bg-[#0B1320] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">
                  Tài liệu Đề tài: Hệ thống Hoạch định & Điều phối Du lịch Thông minh
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-900/60 text-teal-300 border border-teal-700/60">
                  Python + Firebase + Gemini AI
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Kiến trúc hệ thống, mã nguồn backend Python FastAPI, Firestore Schema & đề cương báo cáo đề tài
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2.5 rounded-t-xl transition border-b-2 flex items-center gap-2 ${
              activeTab === 'architecture'
                ? 'bg-white border-teal-600 text-teal-800 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Kiến trúc Hệ thống</span>
          </button>

          <button
            onClick={() => setActiveTab('python')}
            className={`px-4 py-2.5 rounded-t-xl transition border-b-2 flex items-center gap-2 ${
              activeTab === 'python'
                ? 'bg-white border-teal-600 text-teal-800 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>2. Backend Python (FastAPI)</span>
          </button>

          <button
            onClick={() => setActiveTab('firebase')}
            className={`px-4 py-2.5 rounded-t-xl transition border-b-2 flex items-center gap-2 ${
              activeTab === 'firebase'
                ? 'bg-white border-teal-600 text-teal-800 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>3. Firebase Firestore Schema</span>
          </button>

          <button
            onClick={() => setActiveTab('outline')}
            className={`px-4 py-2.5 rounded-t-xl transition border-b-2 flex items-center gap-2 ${
              activeTab === 'outline'
                ? 'bg-white border-teal-600 text-teal-800 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>4. Đề cương Báo cáo Đề tài</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Tab 1: Architecture */}
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200">
                <h4 className="text-sm font-extrabold text-teal-900 mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-700" />
                  Mô hình 3 Lớp (3-Tier Intelligent Architecture)
                </h4>
                <p className="text-xs text-teal-800 leading-relaxed">
                  Đề tài xây dựng một hệ thống hoàn chỉnh kết hợp sức mạnh giao diện điều hành thời gian thực (Frontend React Dashboard), khối xử lý nghiệp vụ & thuật toán điều phối (Backend Python) cùng cơ sở dữ liệu phân tán thời gian thực (Google Firebase) và trí tuệ nhân tạo tạo sinh (Gemini API).
                </p>
              </div>

              {/* Visual Flow diagram blocks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold mb-2">
                    UI
                  </div>
                  <h5 className="text-xs font-extrabold text-slate-900">Bảng điều phối Voyager</h5>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Giao diện điều phối du lịch đa điểm, bản đồ số trực tiếp, cảnh báo rủi ro thời gian thực, quản lý đoàn.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2">
                    PY
                  </div>
                  <h5 className="text-xs font-extrabold text-slate-900">Python Backend & Gemini AI</h5>
                  <p className="text-[11px] text-slate-500 mt-1">
                    FastAPI / Flask tiếp nhận sở thích du khách, gọi Gemini 3.8 Flash sinh lịch trình JSON, phân tích tối ưu thời tiết.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-2">
                    DB
                  </div>
                  <h5 className="text-xs font-extrabold text-slate-900">Firebase Cloud Firestore</h5>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Lưu trữ dữ liệu chuyến đi, vị trí GPS tài xế, danh sách khách, cảnh báo thời tiết với tính năng Real-time Sync.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-white font-mono text-xs">
                <div className="text-slate-400 mb-2">// Luồng xử lý nghiệp vụ thông minh:</div>
                <div className="text-emerald-400">1. Người dùng nhập: [Điểm đến: Miền Trung, 7 ngày, Đoàn gia đình, Thích ẩm thực & biển, Ngân sách 48tr]</div>
                <div className="text-teal-300">2. Python Backend gửi prompt chuẩn cấu trúc tới Gemini API (model gemini-3.8-flash)</div>
                <div className="text-cyan-300">3. Gemini trả về JSON chi tiết các chặng, thời gian từng hoạt động, dự toán ngân sách</div>
                <div className="text-amber-300">4. Firebase lưu trữ và phát sóng trạng thái chuyến đi đến xe du lịch & điều phối viên</div>
                <div className="text-rose-300">5. Khi có cảnh báo (mưa Lăng Cô 75%), Gemini kích hoạt module Re-routing & Điều chỉnh lịch trình</div>
              </div>
            </div>
          )}

          {/* Tab 2: Python Code */}
          {activeTab === 'python' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-teal-600" />
                  <span>Mã nguồn hoàn chỉnh `main.py` (FastAPI + Google GenAI + Firebase Admin):</span>
                </span>
                <button
                  onClick={() => handleCopy(pythonFastAPICode, 'py')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {copiedKey === 'py' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép Code Python</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 rounded-2xl bg-[#0F172A] text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed max-h-[380px] border border-slate-800">
                <code>{pythonFastAPICode}</code>
              </pre>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <strong>Lệnh cài đặt thư viện cần thiết trong môi trường Python:</strong>
                <code className="block mt-1 font-mono text-teal-700 bg-teal-50 p-2 rounded">
                  pip install fastapi uvicorn google-genai firebase-admin pydantic
                </code>
              </div>
            </div>
          )}

          {/* Tab 3: Firebase Schema */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800">
                  Cấu trúc Collections trên Firebase Firestore:
                </h4>
                <button
                  onClick={() => handleCopy(firebaseRulesCode, 'rules')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {copiedKey === 'rules' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Sao chép Firestore Rules</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <strong className="text-teal-700 font-bold block mb-1">📁 Collection /trips:</strong>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Chứa metadata chuyến đi (code: "VN-1024", title, routeSummary, status: "Đang vận hành", budgetTotal, budgetUsed).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <strong className="text-blue-700 font-bold block mb-1">📁 Sub-collection /activities:</strong>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Các mốc sự kiện trong ngày (timeStart, timeEnd, location, status: "Hoàn tất" | "Đang diễn ra", coordinates).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <strong className="text-amber-700 font-bold block mb-1">📁 Sub-collection /telematics:</strong>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Dữ liệu GPS xe trực tiếp (lat, lng, speed, driver: "Trần Bình", vehicleType, eta: "10:24").
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <strong className="text-rose-700 font-bold block mb-1">📁 Sub-collection /alerts:</strong>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Cảnh báo thời tiết thời gian thực và đề xuất giải pháp của Voyager AI.
                  </p>
                </div>
              </div>

              <pre className="p-4 rounded-2xl bg-[#0F172A] text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed max-h-[220px] border border-slate-800">
                <code>{firebaseRulesCode}</code>
              </pre>
            </div>
          )}

          {/* Tab 4: Thesis Outline */}
          {activeTab === 'outline' && (
            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <h4 className="text-sm font-extrabold text-slate-900 mb-2">
                  Gợi ý Cấu trúc Báo cáo Đề tài Khóa luận / Nghiên cứu:
                </h4>
                <div className="space-y-2 leading-relaxed">
                  <div>
                    <strong>Chương 1: Tổng quan Đề tài</strong>
                    <p className="text-slate-500 text-[11px]">
                      - Thực trạng ngành lữ hành: Khó khăn trong việc phối hợp lộ trình linh hoạt và ứng biến trước thời tiết xấu.<br />
                      - Mục tiêu: Xây dựng hệ sinh thái điều phối lịch trình du lịch thông minh, ứng dụng GenAI để cá nhân hóa hành trình.
                    </p>
                  </div>

                  <div>
                    <strong>Chương 2: Cơ sở Lý thuyết & Công nghệ</strong>
                    <p className="text-slate-500 text-[11px]">
                      - Mô hình ngôn ngữ lớn (LLM) và Google Gemini API trong bài toán lập lịch trình tối ưu đa mục tiêu.<br />
                      - Nền tảng Firebase Cloud Firestore và cơ chế đồng bộ dữ liệu thời gian thực (Real-time synchronization).<br />
                      - Kiến trúc vi dịch vụ với Python FastAPI.
                    </p>
                  </div>

                  <div>
                    <strong>Chương 3: Phân tích Thiết kế Hệ thống</strong>
                    <p className="text-slate-500 text-[11px]">
                      - Sơ đồ ca sử dụng (Use Case), luồng dữ liệu (DFD), thiết kế cơ sở dữ liệu NoSQL.<br />
                      - Thiết kế Prompt Engineering cho Gemini 3.8 Flash sinh dữ liệu JSON chuẩn xác.
                    </p>
                  </div>

                  <div>
                    <strong>Chương 4: Cài đặt & Đánh giá Kết quả</strong>
                    <p className="text-slate-500 text-[11px]">
                      - Giao diện Bảng điều phối trực quan (Voyager Travel Ops Dashboard).<br />
                      - Khảo sát độ trễ phản hồi, độ tin cậy của đề xuất AI (94%), chi phí tiết kiệm dự kiến.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Đề tài: Hệ thống hoạch định và điều phối lịch trình du lịch thông minh
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
