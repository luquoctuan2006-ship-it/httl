/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ManualPlannerTab } from './trip-planner/ManualPlannerTab';
import { AiPlannerTab } from './trip-planner/AiPlannerTab';
import { useManualTripPlanner } from './trip-planner/useManualTripPlanner';
import { useAiTripPlanner } from './trip-planner/useAiTripPlanner';
import {
  X,
  Route,
  Calendar,
  Compass,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { TripData } from '../../types/travel';

interface TripPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPlan: (newTrip: TripData) => Promise<void>;
  initialTab?: 'traditional' | 'ai';
}

export const TripPlannerModal: React.FC<TripPlannerModalProps> = ({
  isOpen,
  onClose,
  onApplyPlan,
  initialTab = 'traditional',
}) => {
  // Tab chính: 'traditional' (Lập lịch truyền thống / thủ công) | 'ai' (Lập lịch tự động bằng AI)
  const [activeTab, setActiveTab] = useState<'traditional' | 'ai'>(initialTab);

  // Trạng thái chung
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const manualPlanner = useManualTripPlanner({ onApplyPlan, onClose, setErrorMsg, setSuccessMsg, setIsSaving });
  const aiPlanner = useAiTripPlanner({ isOpen, initialTab, onApplyPlan, onClose, setErrorMsg, setSuccessMsg, setIsSaving });

  useEffect(() => {
    setActiveTab(initialTab);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[94vh]">
        {/* Top Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shrink-0">
              <Compass className="w-5 h-5 text-teal-100" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Hoạch định Lịch trình Chuyến đi</h3>
              <p className="text-xs text-teal-100 font-medium">
                Tạo chuyến đi thủ công hoặc sắp xếp lịch trình tự động
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center bg-slate-200/80 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('traditional');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'traditional'
                  ? 'bg-white text-teal-800 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>Lập lịch truyền thống (Thủ công)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('ai');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Route className="w-4 h-4 text-amber-300" />
              <span>Lập lịch tự động</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
            {activeTab === 'traditional'
              ? 'Tự thiết lập từng ngày & hoạt động'
              : 'Sắp xếp lộ trình và hoạt động theo chuyến đi'}
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 1: LẬP LỊCH TRUYỀN THỐNG (THỦ CÔNG - ZERO MOCK DATA) */}
          {/* ==================================================== */}
          <ManualPlannerTab {...manualPlanner} isActive={activeTab === 'traditional'} isSaving={isSaving} />

          {/* ==================================================== */}
          {/* TAB 2: LẬP LỊCH TỰ ĐỘNG */}
          {/* ==================================================== */}
          <AiPlannerTab {...aiPlanner} isActive={activeTab === 'ai'} isSaving={isSaving} />
        </div>
      </div>
    </div>
  );
};
