import { useMemo, useState } from 'react';
import type { TripData, Waypoint } from '../../../types/travel';
import type { NewLocationForm } from './planningDataTypes';

type UpdateTrip = (updatedTrip: TripData, message?: string) => Promise<void>;

export function usePlanningLocations(
  trip: TripData,
  onUpdateTrip: UpdateTrip | undefined,
  showToast: (message: string) => void,
) {
  const [locations, setLocations] = useState<Waypoint[]>(() =>
    (trip.waypoints || []).map((wp) => ({
      ...wp,
      category:
        wp.category ||
        (wp.name.includes('Bà Nà') || wp.name.includes('Sơn Trà')
          ? 'nature'
          : wp.name.includes('Đại Nội') || wp.name.includes('Hội An')
            ? 'culture'
            : 'entertainment'),
      openHours:
        wp.openHours ||
        (wp.name.includes('Bà Nà')
          ? '07:30 - 21:00'
          : wp.name.includes('Đại Nội')
            ? '08:00 - 17:30'
            : '07:00 - 21:00'),
      ticketPrice:
        wp.ticketPrice ||
        (wp.name.includes('Bà Nà')
          ? '900.000 ₫'
          : wp.name.includes('Đại Nội')
            ? '200.000 ₫'
            : 'Miễn phí'),
      description: wp.description || 'Điểm tham quan nổi tiếng trong cung đường du lịch miền Trung.',
      isHidden: wp.isHidden || false,
    })),
  );
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [filterInvalidOnly, setFilterInvalidOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLocationForm, setNewLocationForm] = useState<NewLocationForm>({
    code: `0${locations.length + 1}`,
    name: '',
    lat: '16.0544',
    lng: '108.2022',
    category: 'culture',
    openHours: '08:00 - 18:00',
    ticketPrice: '100.000 ₫',
    description: '',
  });

  const syncLocationsToTrip = async (newLocations: Waypoint[], message?: string) => {
    setLocations(newLocations);
    if (onUpdateTrip) {
      const updatedTrip: TripData = { ...trip, waypoints: newLocations };
      await onUpdateTrip(updatedTrip, message || 'Đã đồng bộ danh mục địa điểm du lịch!');
    }
  };

  const checkDataValidation = (waypoint: Waypoint) => {
    const issues: string[] = [];
    if (!waypoint.lat || Number.isNaN(waypoint.lat) || waypoint.lat < 8 || waypoint.lat > 24) {
      issues.push('Tọa độ vĩ độ (Lat) không hợp lệ ở Việt Nam (8-24)');
    }
    if (!waypoint.lng || Number.isNaN(waypoint.lng) || waypoint.lng < 102 || waypoint.lng > 110) {
      issues.push('Tọa độ kinh độ (Lng) không hợp lệ ở Việt Nam (102-110)');
    }
    if (!waypoint.openHours || waypoint.openHours.trim() === '') {
      issues.push('Chưa có giờ mở / đóng cửa');
    }
    if (!waypoint.ticketPrice || waypoint.ticketPrice.trim() === '') {
      issues.push('Chưa có thông tin giá vé tham khảo');
    }
    return issues;
  };

  const handleCreateLocation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newLocationForm.name.trim()) {
      alert('Vui lòng nhập tên địa điểm!');
      return;
    }

    const lat = Number.parseFloat(newLocationForm.lat) || 16.0;
    const lng = Number.parseFloat(newLocationForm.lng) || 108.0;
    const newWaypoint: Waypoint = {
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

    const updated = [...locations, newWaypoint];
    await syncLocationsToTrip(updated, `Đã thêm địa điểm du lịch mới "${newWaypoint.name}"`);
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
    showToast(`Đã thêm địa điểm "${newWaypoint.name}" thành công!`);
  };

  const handleSaveEditLocation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingWaypoint) return;

    const updated = locations.map((wp) => (wp.id === editingWaypoint.id ? editingWaypoint : wp));
    await syncLocationsToTrip(updated, `Đã cập nhật thông tin địa điểm "${editingWaypoint.name}"`);
    setEditingWaypoint(null);
    showToast(`Đã cập nhật địa điểm "${editingWaypoint.name}"`);
  };

  const handleToggleHide = async (id: string) => {
    const updated = locations.map((wp) => {
      if (wp.id !== id) return wp;
      const nextHidden = !wp.isHidden;
      showToast(`Đã ${nextHidden ? 'ẩn khỏi gợi ý AI' : 'hiển thị lại'} địa điểm "${wp.name}"`);
      return { ...wp, isHidden: nextHidden };
    });
    await syncLocationsToTrip(updated);
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa địa điểm "${name}" khỏi cơ sở dữ liệu?`)) return;
    const updated = locations.filter((wp) => wp.id !== id);
    await syncLocationsToTrip(updated, `Đã xóa địa điểm "${name}"`);
    showToast(`Đã xóa địa điểm "${name}"`);
  };

  const filteredLocations = useMemo(
    () =>
      locations.filter((wp) => {
        const matchSearch =
          !searchQuery ||
          wp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          wp.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchCategory = categoryFilter === 'all' || wp.category === categoryFilter;
        const matchInvalid = !filterInvalidOnly || checkDataValidation(wp).length > 0;
        return matchSearch && matchCategory && matchInvalid;
      }),
    [locations, searchQuery, categoryFilter, filterInvalidOnly],
  );

  const totalInvalidCount = useMemo(
    () => locations.filter((wp) => checkDataValidation(wp).length > 0).length,
    [locations],
  );

  return {
    locations,
    categoryFilter,
    setCategoryFilter,
    filterInvalidOnly,
    setFilterInvalidOnly,
    searchQuery,
    setSearchQuery,
    editingWaypoint,
    setEditingWaypoint,
    isAddModalOpen,
    setIsAddModalOpen,
    newLocationForm,
    setNewLocationForm,
    checkDataValidation,
    handleCreateLocation,
    handleSaveEditLocation,
    handleToggleHide,
    handleDeleteLocation,
    filteredLocations,
    totalInvalidCount,
  };
}
