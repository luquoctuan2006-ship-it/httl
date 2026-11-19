import React, { useState } from 'react';
import { MapPin, Clock, Navigation, DollarSign, Plus, CheckCircle2 } from 'lucide-react';
import type { TripData } from '../../types/travel';
import { LocationsTab } from './planning-data/LocationsTab';
import { HoursTab } from './planning-data/HoursTab';
import { DistanceTab } from './planning-data/DistanceTab';
import { CostsTab } from './planning-data/CostsTab';
import { AddLocationModal } from './planning-data/AddLocationModal';
import { EditLocationModal } from './planning-data/EditLocationModal';
import { AddCostModal } from './planning-data/AddCostModal';
import { usePlanningLocations } from './planning-data/usePlanningLocations';
import { usePlanningResources } from './planning-data/usePlanningResources';
import { usePlanningRoute } from './planning-data/usePlanningRoute';


interface AdminPlanningDataProps {
  trip: TripData;
  onUpdateTrip?: (updatedTrip: TripData, message?: string) => Promise<void | boolean>;
}

type PlanningSubTab = 'locations' | 'hours' | 'distance' | 'costs';

const planningSubTabs = [
  { id: 'locations', label: '1. Địa điểm du lịch', icon: MapPin },
  { id: 'hours', label: '2. Giờ hoạt động & Định mức', icon: Clock },
  { id: 'distance', label: '3. Khoảng cách & Tuyến đường', icon: Navigation },
  { id: 'costs', label: '4. Chi phí tham khảo', icon: DollarSign },
] as const;

export const AdminPlanningDataView: React.FC<AdminPlanningDataProps> = ({ trip, onUpdateTrip }) => {
  const [activeSubTab, setActiveSubTab] = useState<PlanningSubTab>('locations');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const locationData = usePlanningLocations(trip, onUpdateTrip, showToast);
  const { locations } = locationData;
  const resources = usePlanningResources(showToast, locations);
  const route = usePlanningRoute(locations, trip.totalKm);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-xs font-bold text-white shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Master Data & Điểm Du Lịch
            </span>
            <span className="text-xs text-slate-400 font-semibold">{locations.length} điểm trong cơ sở dữ liệu</span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">Quản lý Dữ liệu Địa điểm Du lịch & Hoạch định</h2>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl">
            Cơ sở dữ liệu địa điểm du lịch ảnh hưởng trực tiếp đến chất lượng tạo lịch trình của AI. Quản lý tọa độ chuẩn, phân loại (thiên nhiên, ăn uống, vui chơi, văn hóa, lưu trú) và phát hiện dữ liệu thiếu sót.
          </p>
        </div>

        <button
          onClick={() => locationData.setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/30 transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Địa Điểm Mới</span>
        </button>
      </div>

      {/* Subtabs Bar */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {planningSubTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-teal-300 border border-teal-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUBTAB 1: ĐỊA ĐIỂM DU LỊCH (CORE CHỨC NĂNG) */}
      <LocationsTab {...locationData} activeSubTab={activeSubTab} />

      {/* SUBTAB 2: GIỜ HOẠT ĐỘNG & ĐỊNH MỨC THAM QUAN (DYNAMIC DỰA TRÊN ĐỊA ĐIỂM) */}
      <HoursTab {...route} {...locationData} activeSubTab={activeSubTab} />

      {/* SUBTAB 3: KHOẢNG CÁCH & TUYẾN ĐƯỜNG LIÊN VÙNG */}
      <DistanceTab {...route} locations={locations} activeSubTab={activeSubTab} />

      {/* SUBTAB 4: CHI PHÍ THAM KHẢO & ĐỊNH MỨC (DYNAMIC TỪ LOCATIONS + SERVER) */}
      <CostsTab {...resources} activeSubTab={activeSubTab} />

      {/* Modal: Thêm Địa Điểm Mới */}
      <AddLocationModal {...locationData} />

      {/* Modal: Chỉnh sửa Địa Điểm */}
      <EditLocationModal {...locationData} />

      {/* Modal: Thêm Định Mức Chi Phí Mới */}
      <AddCostModal {...resources} />
    </div>
  );
};
