import React from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { ReferenceCostItem } from './planningDataTypes';

interface CostsTabProps {
  activeSubTab: string;
  costCategoryFilter: string;
  setCostCategoryFilter: React.Dispatch<React.SetStateAction<string>>;
  setIsAddCostOpen: React.Dispatch<React.SetStateAction<boolean>>;
  allCombinedCosts: ReferenceCostItem[];
  isLoadingCosts: boolean;
  confirmDeleteCostId: string | null;
  setConfirmDeleteCostId: React.Dispatch<React.SetStateAction<string | null>>;
  handleDeleteCost: (id: string, name: string) => Promise<void>;
}

export const CostsTab: React.FC<CostsTabProps> = (props) => {
  const { activeSubTab, costCategoryFilter, setCostCategoryFilter, setIsAddCostOpen, allCombinedCosts, isLoadingCosts, confirmDeleteCostId, setConfirmDeleteCostId, handleDeleteCost } = props;
  return (
    <>
      {activeSubTab === 'costs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'Vé tham quan', 'Ăn uống', 'Lưu trú', 'Phương tiện', 'Hướng dẫn viên', 'Dự phòng'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCostCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                    costCategoryFilter === cat
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {cat === 'all' ? 'Tất cả định mức' : cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsAddCostOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition active:scale-95 shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Định Mức Chi Phí</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#090B11] shadow-xl">
            <div className="grid grid-cols-12 gap-3 bg-neutral-900 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
              <span className="col-span-2">Hạng mục</span>
              <span className="col-span-4">Khoản mục chi tiêu</span>
              <span className="col-span-3">Đơn giá tham khảo</span>
              <span className="col-span-2">Ghi chú định mức</span>
              <span className="col-span-1 text-right">Thao tác</span>
            </div>
            <div className="divide-y divide-neutral-800/80">
              {isLoadingCosts ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto" />
                  <p className="text-xs text-neutral-400 mt-2">Đang tải định mức chi phí...</p>
                </div>
              ) : allCombinedCosts.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 text-xs">
                  Không tìm thấy định mức chi phí phù hợp với bộ lọc.
                </div>
              ) : (
                allCombinedCosts.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-center px-6 py-4 text-xs hover:bg-neutral-900/70 transition">
                    <span className="col-span-2 font-bold text-blue-400">{item.category}</span>
                    <span className="col-span-4 font-bold text-white">{item.item}</span>
                    <span className="col-span-3 font-mono font-bold text-red-300 tabular-nums">{item.price}</span>
                    <span className="col-span-2 text-neutral-400 text-[11px] truncate" title={item.note}>{item.note}</span>
                    <div className="col-span-1 flex justify-end">
                      {item.id.startsWith('wp-cost-') ? (
                        <span className="text-[10px] text-neutral-500 font-mono italic">Auto-sync</span>
                      ) : confirmDeleteCostId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => void handleDeleteCost(item.id, item.item)}
                            className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold transition"
                          >
                            Xóa
                          </button>
                          <button
                            onClick={() => setConfirmDeleteCostId(null)}
                            className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-bold transition"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteCostId(item.id)}
                          className="p-1 rounded-lg text-neutral-500 hover:text-red-400 transition"
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
    </>
  );
};
