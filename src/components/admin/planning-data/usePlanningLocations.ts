import { useEffect, useMemo, useState } from 'react';
import type { TripData, Waypoint } from '../../../types/travel';
import type { NewLocationForm } from './planningDataTypes';

type UpdateTrip = (updatedTrip: TripData, message?: string) => Promise<void | boolean>;

function mapWaypointsToLocations(waypoints: Waypoint[] | undefined): Waypoint[] {
  return (waypoints || []).map((wp) => ({
    ...wp,
    category: wp.category || 'culture',
    openHours: wp.openHours || '',
    ticketPrice: wp.ticketPrice || '',
    description: wp.description || '',
    isHidden: wp.isHidden || false,
    ...(wp.isCustom ? { isCustom: true } : {}),
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
    code: String((trip.waypoints?.length || 0) + 1).padStart(2, '0'),
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
    } else if (message) {
      showToast(message);
    }
  };

  const checkDataValidation = (waypoint: Waypoint) => {
    const issues: string[] = [];
    const hasNonZero = Math.abs(waypoint.lat) > 0.0001 || Math.abs(waypoint.lng) > 0.0001;
    if (!Number.isFinite(waypoint.lat) || !hasNonZero || waypoint.lat < -90 || waypoint.lat > 90) {
      issues.push('Tọa độ vĩ độ (Lat) chưa hợp lệ (-90 đến 90)');
    }
    if (!Number.isFinite(waypoint.lng) || !hasNonZero || waypoint.lng < -180 || waypoint.lng > 180) {
      issues.push('Tọa độ kinh độ (Lng) chưa hợp lệ (-180 đến 180)');
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
      isCustom: true,
    };

    const updated = [...locations, newWaypoint];
    await syncLocationsToTrip(updated, `Đã thêm địa điểm du lịch mới "${newWaypoint.name}"`);
    setIsAddModalOpen(false);
    setNewLocationForm({
      code: String(updated.length + 1).padStart(2, '0'),
      name: '',
      lat: '',
      lng: '',
      category: 'culture',
      openHours: '08:00 - 18:00',
      ticketPrice: '100.000 ₫',
      description: '',
    });
  };

  const handleSaveEditLocation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingWaypoint) return;

    const savedWaypoint = { ...editingWaypoint, isCustom: true };
    const updated = locations.map((wp) => (wp.id === savedWaypoint.id ? savedWaypoint : wp));
    await syncLocationsToTrip(updated, `Đã cập nhật thông tin địa điểm "${savedWaypoint.name}"`);
    setEditingWaypoint(null);
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
