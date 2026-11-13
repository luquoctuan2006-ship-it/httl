import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Sliders,
  Sparkles,
  ShieldAlert,
  Settings,
  Database,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Car,
  Wallet,
  Calendar,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Filter,
  Download,
  Upload,
  ArrowRight,
  TrendingUp,
  Cpu,
  RefreshCw,
  Activity,
  Check,
  AlertCircle,
  FileText,
  Compass,
  Navigation,
  DollarSign,
  Flag,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { TripData, Waypoint, TripMember, Activity as ActivityType } from '../../types/travel';
import { authenticatedFetch } from '../../api';


interface AdminPlanningDataProps {
  trip: TripData;
  onUpdateTrip?: (updatedTrip: TripData, message?: string) => Promise<void>;
}

export const AdminPlanningDataView: React.FC<AdminPlanningDataProps> = ({ trip, onUpdateTrip }) => {
  const [activeSubTab, setActiveSubTab] = useState<'locations' | 'hours' | 'distance' | 'vehicles' | 'costs'>('locations');
  const [locations, setLocations] = useState<Waypoint[]>(() => {
    // Enrich with initial details if missing
    return (trip.waypoints || []).map((wp) => ({
      ...wp,
      category: wp.category || (wp.name.includes('Bà Nà') || wp.name.includes('Sơn Trà') ? 'nature' : wp.name.includes('Đại Nội') || wp.name.includes('Hội An') ? 'culture' : 'entertainment'),
      openHours: wp.openHours || (wp.name.includes('Bà Nà') ? '07:30 - 21:00' : wp.name.includes('Đại Nội') ? '08:00 - 17:30' : '07:00 - 21:00'),
      ticketPrice: wp.ticketPrice || (wp.name.includes('Bà Nà') ? '900.000 ₫' : wp.name.includes('Đại Nội') ? '200.000 ₫' : 'Miễn phí'),
      description: wp.description || 'Điểm tham quan nổi tiếng trong cung đường du lịch miền Trung.',
      isHidden: wp.isHidden || false,
    }));
  });

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [filterInvalidOnly, setFilterInvalidOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Đồng bộ lên cha & Firestore khi locations thay đổi
  const syncLocationsToTrip = async (newLocations: Waypoint[], msg?: string) => {
    setLocations(newLocations);
    if (onUpdateTrip) {
      const updatedTrip: TripData = {
        ...trip,
        waypoints: newLocations,
      };
      await onUpdateTrip(updatedTrip, msg || 'Đã đồng bộ danh mục địa điểm du lịch!');
    }
  };

  // Kiểm tra tính hợp lệ của dữ liệu
  const checkDataValidation = (wp: Waypoint) => {
    const issues: string[] = [];
    if (!wp.lat || isNaN(wp.lat) || wp.lat < 8 || wp.lat > 24) {
      issues.push('Tọa độ vĩ độ (Lat) không hợp lệ ở Việt Nam (8-24)');
    }
    if (!wp.lng || isNaN(wp.lng) || wp.lng < 102 || wp.lng > 110) {
      issues.push('Tọa độ kinh độ (Lng) không hợp lệ ở Việt Nam (102-110)');
    }
    if (!wp.openHours || wp.openHours.trim() === '') {
      issues.push('Chưa có giờ mở / đóng cửa');
    }
    if (!wp.ticketPrice || wp.ticketPrice.trim() === '') {
      issues.push('Chưa có thông tin giá vé tham khảo');
    }
    return issues;
  };

  // Thêm mới waypoint
  const [newLocationForm, setNewLocationForm] = useState({
    code: `0${locations.length + 1}`,
    name: '',
    lat: '16.0544',
    lng: '108.2022',
    category: 'culture',
    openHours: '08:00 - 18:00',
    ticketPrice: '100.000 ₫',
    description: '',
  });

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationForm.name.trim()) {
      alert('Vui lòng nhập tên địa điểm!');
      return;
    }

    const lat = parseFloat(newLocationForm.lat) || 16.0;
    const lng = parseFloat(newLocationForm.lng) || 108.0;

    const newWp: Waypoint = {
      id: `wp-${Date.now()}`,
      code: newLocationForm.code.trim() || `WP-${locations.length + 1}`,
      name: newLocationForm.name.trim(),
      status: 'pending',
      lat,
      lng,
      xPercent: 50,
      yPercent: 50,
      category: newLocationForm.category,
      openHours: newLocationForm.openHours,
      ticketPrice: newLocationForm.ticketPrice,
      description: newLocationForm.description.trim(),
      isHidden: false,
    };

    const updated = [...locations, newWp];
    await syncLocationsToTrip(updated, `Đã thêm địa điểm du lịch mới "${newWp.name}"`);
    setIsAddModalOpen(false);
    setNewLocationForm({
      code: `0${updated.length + 1}`,
      name: '',
      lat: '16.0544',
      lng: '108.2022',
      category: 'culture',
      openHours: '08:00 - 18:00',
      ticketPrice: '100.000 ₫',
      description: '',
    });
    showToast(`Đã thêm địa điểm "${newWp.name}" thành công!`);
  };

  // Chỉnh sửa waypoint
  const handleSaveEditLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWaypoint) return;

    const updated = locations.map((wp) => (wp.id === editingWaypoint.id ? editingWaypoint : wp));
    await syncLocationsToTrip(updated, `Đã cập nhật thông tin địa điểm "${editingWaypoint.name}"`);
    setEditingWaypoint(null);
    showToast(`Đã cập nhật địa điểm "${editingWaypoint.name}"`);
  };

  // Ẩn / Hiện địa điểm
  const handleToggleHide = async (id: string) => {
    const updated = locations.map((wp) => {
      if (wp.id === id) {
        const nextHidden = !wp.isHidden;
        showToast(`Đã ${nextHidden ? 'ẩn khỏi gợi ý AI' : 'hiển thị lại'} địa điểm "${wp.name}"`);
        return { ...wp, isHidden: nextHidden };
      }
      return wp;
    });
    await syncLocationsToTrip(updated);
  };

  // Xóa địa điểm
  const handleDeleteLocation = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa địa điểm "${name}" khỏi cơ sở dữ liệu?`)) return;
    const updated = locations.filter((wp) => wp.id !== id);
    await syncLocationsToTrip(updated, `Đã xóa địa điểm "${name}"`);
    showToast(`Đã xóa địa điểm "${name}"`);
  };

  // Filtered locations
  const filteredLocations = useMemo(() => {
    return locations.filter((wp) => {
      const matchSearch =
        !searchQuery ||
        wp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wp.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === 'all' || wp.category === categoryFilter;
      const issues = checkDataValidation(wp);
      const matchInvalid = !filterInvalidOnly || issues.length > 0;
      return matchSearch && matchCat && matchInvalid;
    });
  }, [locations, searchQuery, categoryFilter, filterInvalidOnly]);

  const totalInvalidCount = useMemo(() => {
    return locations.filter((wp) => checkDataValidation(wp).length > 0).length;
  }, [locations]);

  // Helper: Haversine road-distance calculator
  const computeHaversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 1.35 * 10) / 10;
  };

  // State: Vehicles & Fleet Management
  interface VehicleItem {
    id: string;
    type: string;
    speedAvg: string;
    capacity: string;
    consumption: string;
    status: 'Sẵn sàng điều phối' | 'Đang chạy tour' | 'Bảo dưỡng định kỳ';
  }

  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [newVehicleForm, setNewVehicleForm] = useState({
    type: '',
    speedAvg: '45 km/h',
    capacity: '16 khách',
    consumption: '12L / 100km',
    status: 'Sẵn sàng điều phối' as VehicleItem['status'],
  });

  // State: Reference Benchmark Costs
  interface ReferenceCostItem {
    id: string;
    category: string;
    item: string;
    price: string;
    note: string;
  }

  const [referenceCosts, setReferenceCosts] = useState<ReferenceCostItem[]>([]);
  const [costCategoryFilter, setCostCategoryFilter] = useState<string>('all');
  const [isLoadingCosts, setIsLoadingCosts] = useState(false);
  const [isAddCostOpen, setIsAddCostOpen] = useState(false);
  const [newCostForm, setNewCostForm] = useState({
    category: 'Vé tham quan',
    item: '',
    price: '',
    note: '',
  });

  // Interactive Point-to-Point Calculator
  const [calcOrigin, setCalcOrigin] = useState<string>('');
  const [calcDest, setCalcDest] = useState<string>('');

  // Nạp Phương tiện & Định mức chi phí từ Server
  const fetchVehicles = async () => {
    try {
      setIsLoadingVehicles(true);
      const res = await authenticatedFetch('/api/admin/vehicles');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.vehicles)) {
          setVehicles(data.vehicles);
        }
      }
    } catch {
      // Giữ nguyên danh sách
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  const fetchReferenceCosts = async () => {
    try {
      setIsLoadingCosts(true);
      const res = await authenticatedFetch('/api/admin/reference-costs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.costs)) {
          setReferenceCosts(data.costs);
        }
      }
    } catch {
      // Giữ nguyên danh sách
    } finally {
      setIsLoadingCosts(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchReferenceCosts();
  }, []);

  // Handlers: Quản lý phương tiện
  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleForm.type.trim()) return;
    try {
      const res = await authenticatedFetch('/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVehicleForm),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.vehicles) setVehicles(data.vehicles);
      }
      showToast(`Đã thêm phương tiện "${newVehicleForm.type}" thành công`);
      setIsAddVehicleOpen(false);
      setNewVehicleForm({
        type: '',
        speedAvg: '45 km/h',
        capacity: '16 khách',
        consumption: '12L / 100km',
        status: 'Sẵn sàng điều phối',
      });
    } catch {
      showToast('Lỗi khi thêm phương tiện');
    }
  };

  const handleToggleVehicleStatus = async (veh: VehicleItem) => {
    const nextStatus: VehicleItem['status'] =
      veh.status === 'Sẵn sàng điều phối'
        ? 'Đang chạy tour'
        : veh.status === 'Đang chạy tour'
        ? 'Bảo dưỡng định kỳ'
        : 'Sẵn sàng điều phối';

    setVehicles((prev) => prev.map((v) => (v.id === veh.id ? { ...v, status: nextStatus } : v)));
    try {
      await authenticatedFetch(`/api/admin/vehicles/${veh.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast(`Đã chuyển trạng thái xe sang "${nextStatus}"`);
    } catch {
      showToast(`Đã đổi trạng thái sang "${nextStatus}" (cục bộ)`);
    }
  };

  const handleDeleteVehicle = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa phương tiện "${name}"?`)) return;
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    try {
      await authenticatedFetch(`/api/admin/vehicles/${id}`, { method: 'DELETE' });
      showToast(`Đã xóa phương tiện "${name}"`);
    } catch {
      showToast(`Đã xóa phương tiện (cục bộ)`);
    }
  };

  // Handlers: Quản lý định mức chi phí
  const handleCreateCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCostForm.item.trim() || !newCostForm.price.trim()) return;
    try {
      const res = await authenticatedFetch('/api/admin/reference-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCostForm),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.costs) setReferenceCosts(data.costs);
      }
      showToast(`Đã thêm định mức chi phí "${newCostForm.item}"`);
      setIsAddCostOpen(false);
      setNewCostForm({ category: 'Vé tham quan', item: '', price: '', note: '' });
    } catch {
      showToast('Lỗi khi thêm định mức chi phí');
    }
  };

  const handleDeleteCost = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa định mức chi phí "${name}"?`)) return;
    setReferenceCosts((prev) => prev.filter((c) => c.id !== id));
    try {
      await authenticatedFetch(`/api/admin/reference-costs/${id}`, { method: 'DELETE' });
      showToast(`Đã xóa định mức "${name}"`);
    } catch {
      showToast(`Đã xóa định mức (cục bộ)`);
    }
  };

  // SUBTAB 2: Dynamic Operating Hours derived directly from locations (trip.waypoints)
  const dynamicOperatingHours = useMemo(() => {
    return locations.map((wp) => {
      const hours = (wp.openHours && wp.openHours.trim()) || '07:30 - 18:00';
      const parts = hours.includes('-') ? hours.split('-').map((s) => s.trim()) : [hours, ''];
      const open = parts[0] || '08:00';
      const close = parts[1] || '18:00';

      let duration = '2 - 3 giờ';
      if (wp.category === 'nature') duration = '3 - 4 giờ';
      else if (wp.category === 'entertainment') duration = '4 - 5 giờ';
      else if (wp.category === 'food') duration = '1 - 1.5 giờ';
      else if (wp.category === 'stay') duration = '12 - 24 giờ';

      return {
        id: wp.id,
        code: wp.code,
        place: wp.name,
        category: wp.category || 'culture',
        open,
        close,
        openHours: hours,
        duration,
        note: wp.description || 'Lịch trình tham quan tiêu chuẩn Voyager',
        ticketPrice: wp.ticketPrice || 'Miễn phí',
        rawWaypoint: wp,
      };
    });
  }, [locations]);

  // SUBTAB 3: Dynamic Distance Matrix calculated from consecutive waypoints in locations
  const dynamicDistanceMatrix = useMemo(() => {
    if (locations.length < 2) return [];
    const matrix: Array<{
      from: string;
      to: string;
      distance: string;
      estTime: string;
      road: string;
      km: number;
    }> = [];

    for (let i = 0; i < locations.length - 1; i++) {
      const curr = locations[i];
      const next = locations[i + 1];
      const km = computeHaversineKm(curr.lat, curr.lng, next.lat, next.lng);
      const minutes = Math.max(10, Math.round((km / 42) * 60));
      const estTime = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} phút`;

      let road = `Tuyến kết nối Chặng ${i + 1} ➔ Chặng ${i + 2}`;
      if (curr.name.includes('Bà Nà') || next.name.includes('Bà Nà')) {
        road = 'Tuyến QL14B & Tuyến Bà Nà - Suối Mơ';
      } else if (curr.name.includes('Hải Vân') || next.name.includes('Hải Vân')) {
        road = 'Tuyến ven biển Nguyễn Tất Thành & Đèo Hải Vân';
      } else if (curr.name.includes('Huế') || next.name.includes('Huế')) {
        road = 'Quốc lộ 1A thông thoáng kết nối Cố đô Huế';
      } else if (curr.name.includes('Hội An') || next.name.includes('Hội An')) {
        road = 'Tuyến ven biển Võ Nguyên Giáp & Lạc Long Quân';
      }

      matrix.push({
        from: curr.name,
        to: next.name,
        distance: `${km} km`,
        estTime,
        road,
        km,
      });
    }
    return matrix;
  }, [locations]);

  const totalCalculatedKm = useMemo(() => {
    if (dynamicDistanceMatrix.length > 0) {
      return Math.round(dynamicDistanceMatrix.reduce((acc, leg) => acc + leg.km, 0));
    }
    return trip.totalKm || 146;
  }, [dynamicDistanceMatrix, trip.totalKm]);

  const totalCalculatedHours = useMemo(() => {
    const minutes = Math.round((totalCalculatedKm / 42) * 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} phút`;
  }, [totalCalculatedKm]);

  // Interactive Point-to-Point Calculator Result
  const calculatedLeg = useMemo(() => {
    if (!calcOrigin || !calcDest || calcOrigin === calcDest) return null;
    const origWp = locations.find((l) => l.id === calcOrigin);
    const destWp = locations.find((l) => l.id === calcDest);
    if (!origWp || !destWp) return null;

    const km = computeHaversineKm(origWp.lat, origWp.lng, destWp.lat, destWp.lng);
    const minutes = Math.max(10, Math.round((km / 42) * 60));
    const estTime = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} phút`;
    return {
      from: origWp.name,
      to: destWp.name,
      distance: `${km} km`,
      estTime,
    };
  }, [calcOrigin, calcDest, locations]);

  // SUBTAB 5: Combined reference costs (Auto-aggregated ticket costs from locations + benchmark costs)
  const allCombinedCosts = useMemo(() => {
    const waypointTicketCosts: ReferenceCostItem[] = locations
      .filter((wp) => wp.ticketPrice && wp.ticketPrice.trim() !== '')
      .map((wp) => ({
        id: `wp-cost-${wp.id}`,
        category: 'Vé tham quan',
        item: `Vé tham quan ${wp.name}`,
        price: wp.ticketPrice || 'Miễn phí',
        note: `Tự động trích xuất từ dữ liệu điểm ${wp.code}`,
      }));

    const merged = [...waypointTicketCosts, ...referenceCosts];
    if (costCategoryFilter === 'all') return merged;
    return merged.filter((c) => c.category === costCategoryFilter);
  }, [locations, referenceCosts, costCategoryFilter]);

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
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/30 transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Địa Điểm Mới</span>
        </button>
      </div>

      {/* Subtabs Bar */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {[
            { id: 'locations', label: '1. Địa điểm du lịch', icon: MapPin },
            { id: 'hours', label: '2. Giờ hoạt động & Định mức', icon: Clock },
            { id: 'distance', label: '3. Khoảng cách & Tuyến đường', icon: Navigation },
            { id: 'vehicles', label: '4. Phương tiện & Vận hành', icon: Car },
            { id: 'costs', label: '5. Chi phí tham khảo', icon: DollarSign },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
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
      {activeSubTab === 'locations' && (
        <div className="space-y-4">
          {/* Cảnh báo Dữ liệu Thiếu / Lỗi nếu có */}
          {totalInvalidCount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <strong>Phát hiện {totalInvalidCount} địa điểm có dữ liệu chưa hoàn thiện!</strong>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    Tọa độ ngoài phạm vi Việt Nam hoặc thiếu giờ mở cửa / giá vé có thể khiến AI ước lượng lịch trình thiếu chính xác.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFilterInvalidOnly(!filterInvalidOnly)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                  filterInvalidOnly ? 'bg-amber-500 text-slate-900' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200'
                }`}
              >
                {filterInvalidOnly ? 'Xem tất cả' : 'Lọc điểm cần sửa'}
              </button>
            </div>
          )}

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm địa điểm theo tên hoặc mã..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Phân loại Type Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'Tất cả loại hình' },
                { id: 'nature', label: '🌿 Thiên nhiên' },
                { id: 'food', label: '🍜 Ăn uống' },
                { id: 'entertainment', label: '🎡 Vui chơi' },
                { id: 'culture', label: '🏛️ Văn hóa' },
                { id: 'stay', label: '🏨 Lưu trú' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    categoryFilter === c.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Locations */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredLocations.map((wp) => {
              const issues = checkDataValidation(wp);
              const hasIssues = issues.length > 0;
              const catLabels: Record<string, string> = {
                nature: 'Thiên nhiên',
                food: 'Ăn uống',
                entertainment: 'Vui chơi',
                culture: 'Văn hóa',
                stay: 'Lưu trú',
              };

              return (
                <div
                  key={wp.id}
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-3 ${
                    wp.isHidden
                      ? 'border-slate-800 bg-slate-900/50 opacity-60'
                      : hasIssues
                      ? 'border-amber-500/40 bg-slate-900/90 shadow-amber-950/20'
                      : 'border-slate-800 bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-teal-400">{wp.code}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {catLabels[wp.category || 'culture'] || wp.category}
                        </span>
                        {wp.isHidden && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                            Đang ẩn
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-white text-base mt-1">{wp.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Tọa độ: {wp.lat}, {wp.lng}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleHide(wp.id)}
                        title={wp.isHidden ? 'Hiển thị lại địa điểm' : 'Ẩn địa điểm khỏi gợi ý'}
                        className={`p-1.5 rounded-lg border transition ${
                          wp.isHidden ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-800 text-teal-400 border-teal-500/30'
                        }`}
                      >
                        {wp.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditingWaypoint(wp)}
                        title="Chỉnh sửa thông tin"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(wp.id, wp.name)}
                        title="Xóa địa điểm"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800">
                    <div className="rounded-xl bg-slate-800/60 p-2">
                      <span className="text-[10px] text-slate-400 block">Giờ mở cửa</span>
                      <strong className="text-slate-200">{wp.openHours || 'Chưa cập nhật'}</strong>
                    </div>
                    <div className="rounded-xl bg-slate-800/60 p-2">
                      <span className="text-[10px] text-slate-400 block">Giá vé tham khảo</span>
                      <strong className="text-amber-300">{wp.ticketPrice || 'Miễn phí'}</strong>
                    </div>
                  </div>

                  {wp.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{wp.description}</p>
                  )}

                  {/* Cảnh báo lỗi dữ liệu */}
                  {hasIssues && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2 text-[11px] text-amber-300 space-y-0.5">
                      <div className="font-bold flex items-center gap-1 text-[10px] uppercase">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        Cần bổ sung:
                      </div>
                      {issues.map((iss, i) => (
                        <div key={i} className="text-slate-300 text-[10px]">• {iss}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: GIỜ HOẠT ĐỘNG & ĐỊNH MỨC THAM QUAN (DYNAMIC DỰA TRÊN ĐỊA ĐIỂM) */}
      {activeSubTab === 'hours' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tổng điểm tham quan</span>
              <span className="text-xl font-black text-white">{locations.length} điểm</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">Mở cửa sớm (≤ 07:30)</span>
              <span className="text-xl font-black text-teal-300">
                {dynamicOperatingHours.filter((h) => h.open <= '07:30').length} điểm
              </span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Mở tối muộn / 24h</span>
              <span className="text-xl font-black text-amber-300">
                {dynamicOperatingHours.filter((h) => h.close >= '20:00' || h.openHours.includes('24')).length} điểm
              </span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Miễn phí vé</span>
              <span className="text-xl font-black text-sky-300">
                {dynamicOperatingHours.filter((h) => h.ticketPrice === 'Miễn phí' || h.ticketPrice.includes('0')).length} điểm
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
            <div className="grid grid-cols-12 gap-3 bg-slate-800/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <span className="col-span-4">Điểm tham quan & Danh mục</span>
              <span className="col-span-3">Giờ mở / Đóng cửa</span>
              <span className="col-span-2">Thời lượng khuyến nghị</span>
              <span className="col-span-2">Ghi chú điều phối</span>
              <span className="col-span-1 text-right">Thao tác</span>
            </div>
            <div className="divide-y divide-slate-800/60">
              {dynamicOperatingHours.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Chưa có địa điểm nào trong cơ sở dữ liệu. Vui lòng thêm điểm ở Tab 1.
                </div>
              ) : (
                dynamicOperatingHours.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-center px-6 py-4 text-xs hover:bg-slate-800/30 transition">
                    <div className="col-span-4 flex items-center gap-2.5">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                        {item.code}
                      </span>
                      <div>
                        <strong className="font-bold text-white text-sm block">{item.place}</strong>
                        <span className="text-[10px] text-teal-400 uppercase font-bold tracking-wider">
                          {item.category === 'nature' ? '🌿 Thiên nhiên' : item.category === 'culture' ? '🏛️ Văn hóa' : item.category === 'entertainment' ? '🎡 Vui chơi' : item.category === 'food' ? '🍜 Ăn uống' : '🏨 Lưu trú'}
                        </span>
                      </div>
                    </div>
                    <span className="col-span-3 text-teal-300 font-mono font-bold">
                      {item.openHours}
                    </span>
                    <span className="col-span-2 text-amber-300 font-bold">{item.duration}</span>
                    <span className="col-span-2 text-slate-400 truncate" title={item.note}>{item.note}</span>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => setEditingWaypoint(item.rawWaypoint)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition"
                        title="Chỉnh sửa giờ & thông tin"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: KHOẢNG CÁCH & TUYẾN ĐƯỜNG LIÊN VÙNG */}
      {activeSubTab === 'distance' && (
        <div className="space-y-4">
          {/* Trip Route Overview Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                <Navigation className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Tổng quan Tuyến đường Tour Hiện tại</h3>
                <p className="text-xs text-slate-400">
                  Cự ly và thời gian được tính toán chuẩn xác theo tọa độ GPS và hệ số uốn lượn đường sá Việt Nam (1.35x).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="rounded-xl bg-slate-800/80 px-4 py-2 text-center border border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">Tổng cự ly</span>
                <span className="text-sm font-black text-teal-300">{totalCalculatedKm} km</span>
              </div>
              <div className="rounded-xl bg-slate-800/80 px-4 py-2 text-center border border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">Thời gian chạy xe</span>
                <span className="text-sm font-black text-purple-300">{totalCalculatedHours}</span>
              </div>
            </div>
          </div>

          {/* Interactive Point-to-Point Distance Calculator */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-400" />
              Tra cứu Ma trận Cự ly & Thời gian Tức thì Giữa 2 Điểm
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-5">
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Điểm xuất phát (A)</label>
                <select
                  value={calcOrigin}
                  onChange={(e) => setCalcOrigin(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">-- Chọn điểm xuất phát --</option>
                  {locations.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.code} - {wp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 flex justify-center pt-3 sm:pt-4">
                <ArrowRight className="w-5 h-5 text-teal-400" />
              </div>

              <div className="sm:col-span-5">
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Điểm đến (B)</label>
                <select
                  value={calcDest}
                  onChange={(e) => setCalcDest(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">-- Chọn điểm đến --</option>
                  {locations.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.code} - {wp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {calculatedLeg && (
              <div className="mt-3 p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between text-xs animate-fade-in">
                <div className="text-slate-200">
                  <strong className="text-white">{calculatedLeg.from}</strong> ➔ <strong className="text-white">{calculatedLeg.to}</strong>
                </div>
                <div className="flex items-center gap-4 font-bold">
                  <span className="text-teal-300 font-mono">Cự ly: {calculatedLeg.distance}</span>
                  <span className="text-purple-300 font-mono">Dự kiến: {calculatedLeg.estTime}</span>
                </div>
              </div>
            )}
          </div>

          {/* Consecutive Leg Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
            <div className="grid grid-cols-12 gap-3 bg-slate-800/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <span className="col-span-4">Chặng xuất phát ➔ Điểm đến</span>
              <span className="col-span-2">Cự ly chuẩn</span>
              <span className="col-span-2">Thời gian ước tính</span>
              <span className="col-span-4">Tuyến đường huyết mạch</span>
            </div>
            <div className="divide-y divide-slate-800/60">
              {dynamicDistanceMatrix.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Cần ít nhất 2 địa điểm trong cơ sở dữ liệu để tự động sinh ma trận khoảng cách chặng.
                </div>
              ) : (
                dynamicDistanceMatrix.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center px-6 py-4 text-xs hover:bg-slate-800/30 transition">
                    <span className="col-span-4 font-bold text-white">
                      {item.from} <span className="text-teal-400 font-normal">➔</span> {item.to}
                    </span>
                    <span className="col-span-2 font-mono font-bold text-teal-300">{item.distance}</span>
                    <span className="col-span-2 font-bold text-purple-300">{item.estTime}</span>
                    <span className="col-span-4 text-slate-400">{item.road}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: PHƯƠNG TIỆN & ĐIỀU PHỐI (DYNAMIC TRUY XUẤT TỪ SERVER) */}
      {activeSubTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs text-slate-400 font-semibold">
              Quản lý định mức xe, tốc độ trung bình và lượng tiêu hao nhiên liệu phục vụ thuật toán AI
            </span>
            <button
              onClick={() => setIsAddVehicleOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Phương Tiện Mới</span>
            </button>
          </div>

          {isLoadingVehicles ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-6 h-6 text-teal-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Đang tải danh sách đội xe điều phối...</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {vehicles.map((v) => (
                <div key={v.id} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-base">{v.type}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleVehicleStatus(v)}
                        title="Nhấp để chuyển trạng thái"
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                          v.status === 'Sẵn sàng điều phối'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900/40'
                            : v.status === 'Đang chạy tour'
                            ? 'bg-sky-950 text-sky-300 border-sky-800 hover:bg-sky-900/40'
                            : 'bg-amber-950 text-amber-300 border-amber-800 hover:bg-amber-900/40'
                        }`}
                      >
                        {v.status}
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(v.id, v.type)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition"
                        title="Xóa phương tiện"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-slate-800/60 p-2.5">
                      <span className="text-slate-400 block text-[10px]">Tốc độ TB</span>
                      <strong className="text-teal-400">{v.speedAvg}</strong>
                    </div>
                    <div className="rounded-xl bg-slate-800/60 p-2.5">
                      <span className="text-slate-400 block text-[10px]">Sức chứa</span>
                      <strong className="text-white">{v.capacity}</strong>
                    </div>
                    <div className="rounded-xl bg-slate-800/60 p-2.5">
                      <span className="text-slate-400 block text-[10px]">Tiêu hao</span>
                      <strong className="text-amber-400">{v.consumption}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 5: CHI PHÍ THAM KHẢO & ĐỊNH MỨC (DYNAMIC TỪ LOCATIONS + SERVER) */}
      {activeSubTab === 'costs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'Vé tham quan', 'Ăn uống', 'Lưu trú', 'Phương tiện', 'Hướng dẫn viên', 'Dự phòng'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCostCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    costCategoryFilter === cat
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat === 'all' ? 'Tất cả định mức' : cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsAddCostOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow transition active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Định Mức Chi Phí</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
            <div className="grid grid-cols-12 gap-3 bg-slate-800/80 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
              <span className="col-span-2">Hạng mục</span>
              <span className="col-span-4">Khoản mục chi tiêu</span>
              <span className="col-span-3">Đơn giá tham khảo</span>
              <span className="col-span-2">Ghi chú định mức</span>
              <span className="col-span-1 text-right">Thao tác</span>
            </div>
            <div className="divide-y divide-slate-800/60">
              {isLoadingCosts ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-6 h-6 text-teal-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">Đang tải định mức chi phí...</p>
                </div>
              ) : allCombinedCosts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Không tìm thấy định mức chi phí phù hợp với bộ lọc.
                </div>
              ) : (
                allCombinedCosts.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-center px-6 py-4 text-xs hover:bg-slate-800/30 transition">
                    <span className="col-span-2 font-bold text-teal-400">{item.category}</span>
                    <span className="col-span-4 font-bold text-white">{item.item}</span>
                    <span className="col-span-3 font-mono font-bold text-amber-300">{item.price}</span>
                    <span className="col-span-2 text-slate-400 text-[11px] truncate" title={item.note}>{item.note}</span>
                    <div className="col-span-1 flex justify-end">
                      {item.id.startsWith('wp-cost-') ? (
                        <span className="text-[10px] text-slate-500 font-mono italic">Auto-sync</span>
                      ) : (
                        <button
                          onClick={() => handleDeleteCost(item.id, item.item)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition"
                          title="Xóa định mức"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm Địa Điểm Mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-400" />
                <h3 className="font-black text-white text-base">Thêm Địa Điểm Du Lịch Mới</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-slate-300 font-bold block mb-1">Mã Code *</label>
                  <input
                    type="text"
                    required
                    value={newLocationForm.code}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, code: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-300 font-bold block mb-1">Tên Địa Điểm *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Lăng Tự Đức"
                    value={newLocationForm.name}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Vĩ độ (Lat) *</label>
                  <input
                    type="text"
                    required
                    placeholder="16.4698"
                    value={newLocationForm.lat}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, lat: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Kinh độ (Lng) *</label>
                  <input
                    type="text"
                    required
                    placeholder="107.578"
                    value={newLocationForm.lng}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, lng: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Loại hình</label>
                  <select
                    value={newLocationForm.category}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, category: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                  >
                    <option value="culture">🏛️ Văn hóa</option>
                    <option value="nature">🌿 Thiên nhiên</option>
                    <option value="entertainment">🎡 Vui chơi</option>
                    <option value="food">🍜 Ăn uống</option>
                    <option value="stay">🏨 Lưu trú</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Giờ mở cửa</label>
                  <input
                    type="text"
                    placeholder="07:30 - 17:30"
                    value={newLocationForm.openHours}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, openHours: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Giá vé tham khảo</label>
                  <input
                    type="text"
                    placeholder="150.000 ₫"
                    value={newLocationForm.ticketPrice}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, ticketPrice: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Mô tả / Lưu ý điều phối</label>
                <textarea
                  rows={2}
                  placeholder="Thông tin đặc điểm, thời lượng khuyến nghị cho AI..."
                  value={newLocationForm.description}
                  onChange={(e) => setNewLocationForm({ ...newLocationForm, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-lg shadow-teal-900/40 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lưu Địa Điểm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa Địa Điểm */}
      {editingWaypoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-sky-400" />
                <h3 className="font-black text-white text-base">Chỉnh Sửa Địa Điểm</h3>
              </div>
              <button
                onClick={() => setEditingWaypoint(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLocation} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-slate-300 font-bold block mb-1">Mã Code</label>
                  <input
                    type="text"
                    required
                    value={editingWaypoint.code}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, code: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-300 font-bold block mb-1">Tên Địa Điểm</label>
                  <input
                    type="text"
                    required
                    value={editingWaypoint.name}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Vĩ độ (Lat)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingWaypoint.lat}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, lat: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Kinh độ (Lng)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingWaypoint.lng}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, lng: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Loại hình</label>
                  <select
                    value={editingWaypoint.category || 'culture'}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, category: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                  >
                    <option value="culture">🏛️ Văn hóa</option>
                    <option value="nature">🌿 Thiên nhiên</option>
                    <option value="entertainment">🎡 Vui chơi</option>
                    <option value="food">🍜 Ăn uống</option>
                    <option value="stay">🏨 Lưu trú</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Giờ mở cửa</label>
                  <input
                    type="text"
                    value={editingWaypoint.openHours || ''}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, openHours: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Giá vé tham khảo</label>
                  <input
                    type="text"
                    value={editingWaypoint.ticketPrice || ''}
                    onChange={(e) => setEditingWaypoint({ ...editingWaypoint, ticketPrice: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Mô tả / Lưu ý điều phối</label>
                <textarea
                  rows={2}
                  value={editingWaypoint.description || ''}
                  onChange={(e) => setEditingWaypoint({ ...editingWaypoint, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingWaypoint(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-lg shadow-sky-900/40 transition active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Cập Nhật Địa Điểm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Thêm Phương Tiện Mới */}
      {isAddVehicleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-teal-400" />
                <h3 className="font-black text-white text-base">Thêm Phương Tiện Mới</h3>
              </div>
              <button
                onClick={() => setIsAddVehicleOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Loại xe & Dòng xe *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Xe du lịch 35 chỗ (Thaco Town)"
                  value={newVehicleForm.type}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, type: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Tốc độ TB (km/h)</label>
                  <input
                    type="text"
                    required
                    placeholder="45 km/h"
                    value={newVehicleForm.speedAvg}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, speedAvg: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Sức chứa tối đa</label>
                  <input
                    type="text"
                    required
                    placeholder="28 khách"
                    value={newVehicleForm.capacity}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, capacity: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Định mức nhiên liệu</label>
                  <input
                    type="text"
                    placeholder="15L / 100km"
                    value={newVehicleForm.consumption}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, consumption: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Trạng thái ban đầu</label>
                  <select
                    value={newVehicleForm.status}
                    onChange={(e: any) => setNewVehicleForm({ ...newVehicleForm, status: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                  >
                    <option value="Sẵn sàng điều phối">Sẵn sàng điều phối</option>
                    <option value="Đang chạy tour">Đang chạy tour</option>
                    <option value="Bảo dưỡng định kỳ">Bảo dưỡng định kỳ</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddVehicleOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-lg shadow-teal-900/40 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Phương Tiện</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Thêm Định Mức Chi Phí Mới */}
      {isAddCostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-teal-400" />
                <h3 className="font-black text-white text-base">Thêm Định Mức Chi Phí</h3>
              </div>
              <button
                onClick={() => setIsAddCostOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCost} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Hạng mục chi tiêu</label>
                <select
                  value={newCostForm.category}
                  onChange={(e) => setNewCostForm({ ...newCostForm, category: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Vé tham quan">Vé tham quan</option>
                  <option value="Ăn uống">Ăn uống</option>
                  <option value="Lưu trú">Lưu trú</option>
                  <option value="Phương tiện">Phương tiện</option>
                  <option value="Hướng dẫn viên">Hướng dẫn viên</option>
                  <option value="Dự phòng">Dự phòng</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Tên dịch vụ / Khoản mục *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Buffet trưa nhà hàng 4 sao"
                  value={newCostForm.item}
                  onChange={(e) => setNewCostForm({ ...newCostForm, item: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Đơn giá tham khảo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 250.000 ₫ / suất"
                  value={newCostForm.price}
                  onChange={(e) => setNewCostForm({ ...newCostForm, price: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Ghi chú định mức</label>
                <input
                  type="text"
                  placeholder="Áp dụng cho đoàn từ 10 khách trở lên..."
                  value={newCostForm.note}
                  onChange={(e) => setNewCostForm({ ...newCostForm, note: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddCostOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-lg shadow-teal-900/40 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lưu Định Mức</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


// ============================================================================
// 4. GIÁM SÁT HỆ THỐNG AI & CẤU HÌNH THỜI GIAN THỰC
// - Theo dõi số lượt tạo và điều chỉnh lịch trình.
// - Thống kê thời gian phản hồi, lỗi API và các yêu cầu thất bại.
// - Quản lý mô hình: thay đổi model Gemini thực tế trên server (không chỉ là dummy .env).
// - Nút test kết nối AI thời gian thực (độ trễ ms).
// - Nhật ký Request / Error log thực tế.
// ============================================================================