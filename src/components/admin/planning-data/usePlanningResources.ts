import { useEffect, useMemo, useState } from 'react';
import { authenticatedFetch } from '../../../api';
import type { Waypoint } from '../../../types/travel';
import type { NewCostForm, NewVehicleForm, ReferenceCostItem, VehicleItem } from './planningDataTypes';

export function usePlanningResources(
  showToast: (message: string) => void,
  locations: Waypoint[],
) {
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [newVehicleForm, setNewVehicleForm] = useState<NewVehicleForm>({
    type: '',
    speedAvg: '45 km/h',
    capacity: '16 khách',
    consumption: '12L / 100km',
    status: 'Sẵn sàng điều phối',
  });
  const [referenceCosts, setReferenceCosts] = useState<ReferenceCostItem[]>([]);
  const [costCategoryFilter, setCostCategoryFilter] = useState('all');
  const [isLoadingCosts, setIsLoadingCosts] = useState(false);
  const [isAddCostOpen, setIsAddCostOpen] = useState(false);
  const [newCostForm, setNewCostForm] = useState<NewCostForm>({
    category: 'Vé tham quan',
    item: '',
    price: '',
    note: '',
  });

  const fetchVehicles = async () => {
    try {
      setIsLoadingVehicles(true);
      const response = await authenticatedFetch('/api/admin/vehicles');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.vehicles)) setVehicles(data.vehicles);
      }
    } catch {
      // Keep the current list when the request fails.
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  const fetchReferenceCosts = async () => {
    try {
      setIsLoadingCosts(true);
      const response = await authenticatedFetch('/api/admin/reference-costs');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.costs)) setReferenceCosts(data.costs);
      }
    } catch {
      // Keep the current list when the request fails.
    } finally {
      setIsLoadingCosts(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchReferenceCosts();
  }, []);

  const handleCreateVehicle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newVehicleForm.type.trim()) return;
    try {
      const response = await authenticatedFetch('/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVehicleForm),
      });
      if (response.ok) {
        const data = await response.json();
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

  const handleToggleVehicleStatus = async (vehicle: VehicleItem) => {
    const nextStatus: VehicleItem['status'] =
      vehicle.status === 'Sẵn sàng điều phối'
        ? 'Đang chạy tour'
        : vehicle.status === 'Đang chạy tour'
          ? 'Bảo dưỡng định kỳ'
          : 'Sẵn sàng điều phối';

    setVehicles((previous) =>
      previous.map((item) => (item.id === vehicle.id ? { ...item, status: nextStatus } : item)),
    );
    try {
      await authenticatedFetch(`/api/admin/vehicles/${vehicle.id}`, {
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
    setVehicles((previous) => previous.filter((vehicle) => vehicle.id !== id));
    try {
      await authenticatedFetch(`/api/admin/vehicles/${id}`, { method: 'DELETE' });
      showToast(`Đã xóa phương tiện "${name}"`);
    } catch {
      showToast('Đã xóa phương tiện (cục bộ)');
    }
  };

  const handleCreateCost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCostForm.item.trim() || !newCostForm.price.trim()) return;
    try {
      const response = await authenticatedFetch('/api/admin/reference-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCostForm),
      });
      if (response.ok) {
        const data = await response.json();
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
    setReferenceCosts((previous) => previous.filter((cost) => cost.id !== id));
    try {
      await authenticatedFetch(`/api/admin/reference-costs/${id}`, { method: 'DELETE' });
      showToast(`Đã xóa định mức "${name}"`);
    } catch {
      showToast('Đã xóa định mức (cục bộ)');
    }
  };

  const allCombinedCosts = useMemo(() => {
    const waypointTicketCosts: ReferenceCostItem[] = locations
      .filter((waypoint) => waypoint.ticketPrice && waypoint.ticketPrice.trim() !== '')
      .map((waypoint) => ({
        id: `wp-cost-${waypoint.id}`,
        category: 'Vé tham quan',
        item: `Vé tham quan ${waypoint.name}`,
        price: waypoint.ticketPrice || 'Miễn phí',
        note: `Tự động trích xuất từ dữ liệu điểm ${waypoint.code}`,
      }));

    const merged = [...waypointTicketCosts, ...referenceCosts];
    return costCategoryFilter === 'all'
      ? merged
      : merged.filter((cost) => cost.category === costCategoryFilter);
  }, [locations, referenceCosts, costCategoryFilter]);

  return {
    vehicles,
    isLoadingVehicles,
    isAddVehicleOpen,
    setIsAddVehicleOpen,
    newVehicleForm,
    setNewVehicleForm,
    handleCreateVehicle,
    handleToggleVehicleStatus,
    handleDeleteVehicle,
    referenceCosts,
    costCategoryFilter,
    setCostCategoryFilter,
    isLoadingCosts,
    isAddCostOpen,
    setIsAddCostOpen,
    newCostForm,
    setNewCostForm,
    handleCreateCost,
    handleDeleteCost,
    allCombinedCosts,
  };
}
