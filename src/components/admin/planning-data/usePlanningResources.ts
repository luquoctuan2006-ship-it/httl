import { useEffect, useMemo, useState } from 'react';
import { authenticatedFetch } from '../../../api';
import type { Waypoint } from '../../../types/travel';
import type { NewCostForm, ReferenceCostItem } from './planningDataTypes';

export function usePlanningResources(
  showToast: (message: string) => void,
  locations: Waypoint[],
) {
  const [referenceCosts, setReferenceCosts] = useState<ReferenceCostItem[]>([]);
  const [costCategoryFilter, setCostCategoryFilter] = useState('all');
  const [isLoadingCosts, setIsLoadingCosts] = useState(false);
  const [isAddCostOpen, setIsAddCostOpen] = useState(false);
  const [confirmDeleteCostId, setConfirmDeleteCostId] = useState<string | null>(null);
  const [newCostForm, setNewCostForm] = useState<NewCostForm>({
    category: 'Vé tham quan',
    item: '',
    price: '',
    note: '',
  });

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
    fetchReferenceCosts();
  }, []);

  const handleCreateCost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCostForm.item.trim() || !newCostForm.price.trim()) return;
    try {
      const response = await authenticatedFetch('/api/admin/reference-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCostForm),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Không thể lưu định mức chi phí lên máy chủ');
      }
      if (data?.costs) setReferenceCosts(data.costs);
      showToast(`Đã thêm định mức chi phí "${newCostForm.item}"`);
      setIsAddCostOpen(false);
      setNewCostForm({ category: 'Vé tham quan', item: '', price: '', note: '' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi thêm định mức chi phí');
    }
  };

  const handleDeleteCost = async (id: string, name: string) => {
    setConfirmDeleteCostId(null);
    const previousCosts = referenceCosts;
    setReferenceCosts((previous) => previous.filter((cost) => cost.id !== id));
    try {
      const response = await authenticatedFetch(`/api/admin/reference-costs/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Không thể xóa định mức chi phí');
      }
      if (Array.isArray(data?.costs)) {
        setReferenceCosts(data.costs);
      }
      showToast(`Đã xóa định mức "${name}"`);
    } catch (err) {
      setReferenceCosts(previousCosts);
      showToast(err instanceof Error ? err.message : `Lỗi khi xóa định mức "${name}"`);
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
    referenceCosts,
    costCategoryFilter,
    setCostCategoryFilter,
    isLoadingCosts,
    isAddCostOpen,
    setIsAddCostOpen,
    newCostForm,
    setNewCostForm,
    handleCreateCost,
    confirmDeleteCostId,
    setConfirmDeleteCostId,
    handleDeleteCost,
    allCombinedCosts,
  };
}
