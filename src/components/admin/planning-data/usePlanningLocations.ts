import { useEffect, useMemo, useState } from 'react';
import type { TripData, Waypoint } from '../../../types/travel';
import type { NewLocationForm } from './planningDataTypes';

type UpdateTrip = (updatedTrip: TripData, message?: string) => Promise<void>;

function mapWaypointsToLocations(waypoints: Waypoint[] | undefined): Waypoint[] {
  return (waypoints || []).map((wp) => ({
    ...wp,
    category: wp.category || 'culture',
    openHours: wp.openHours || '',
    ticketPrice: wp.ticketPrice || '',
    description: wp.description || '',
    isHidden: wp.isHidden || false,
  }));
}

export function usePlanningLocations(
  trip: TripData,
  onUpdateTrip: UpdateTrip | undefined,
  showToast: (message: string) => void,
) {
  const [locations, setLocations] = useState<Waypoint[]>(() =>
    mapWaypointsToLocations(trip.waypoints),
  );
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [filterInvalidOnly, setFilterInvalidOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLocationForm, setNewLocationForm] = useState<NewLocationForm>({
    code: `0${(trip.waypoints?.length || 0) + 1}`,
    name: '',
    lat: '',
    lng: '',
    category: 'culture',
    openHours: '08:00 - 18:00',
    ticketPrice: '100.000 ₫',
    description: '',
  });

  useEffect(() => {
    setLocations(mapWaypointsToLocations(trip.waypoints));
    setEditingWaypoint(null);
    setConfirmDeleteId(null);
  }, [trip.id, trip.waypoints]);

  const syncLocationsToTrip = async (newLocations: Waypoint[], message?: string) => {
    setLocations(newLocations);
    if (onUpdateTrip) {
      const updatedTrip: TripData = {
        ...trip,
        waypoints: newLocations,
        destinationsCount: newLocations.length || trip.totalDays,
      };
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
      showToast('Vui lòng nhập tên địa điểm!');
      return;
    }

    const lat = Number.parseFloat(newLocationForm.lat) || 0;
    const lng = Number.parseFloat(newLocationForm.lng) || 0;
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
      lat: '',
      lng: '',
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
    setConfirmDeleteId(null);
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
    confirmDeleteId,
    setConfirmDeleteId,
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
