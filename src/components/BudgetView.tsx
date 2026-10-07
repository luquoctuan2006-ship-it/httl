import React, { useState } from 'react';
import {
  Wallet,
  TrendingDown,
  Plus,
  Edit3,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Receipt,
  Tag,
  Search,
  Check,
  Trash2,
  FileText,
  DollarSign,
  PieChart,
  Building,
  Sliders
} from 'lucide-react';
import { TripData, Activity, ExpenseInvoice } from '../types/travel';

interface BudgetViewProps {
  trip: TripData;
  onUpdateTripBudget?: (updatedTrip: TripData) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  trip,
  onUpdateTripBudget,
  searchQuery = '',
  onClearSearch,
}) => {
  // Modal states
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  const [isEditAllocationsOpen, setIsEditAllocationsOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editedCost, setEditedCost] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'invoices' | 'activities'>('invoices');

  // New Invoice form state
  const [invTitle, setInvTitle] = useState('');
  const [invAmount, setInvAmount] = useState<number>(500000);
  const [invCategory, setInvCategory] = useState<'transport' | 'hotel' | 'meal' | 'sightseeing' | 'contingency'>('meal');
  const [invVendor, setInvVendor] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState('2026-10-14');
  const [invDayIndex, setInvDayIndex] = useState<number>(trip.currentDay || 3);
  const [invNote, setInvNote] = useState('');

  // Form state for total budget
  const [newTotalBudget, setNewTotalBudget] = useState<number>(trip.budgetTotal || 48600000);

  // Form state for category allocations
  const currentAllocations = trip.customCategoryAllocations || {
    transport: Math.round((trip.budgetTotal || 48600000) * 0.28),
    hotel: Math.round((trip.budgetTotal || 48600000) * 0.35),
    meal: Math.round((trip.budgetTotal || 48600000) * 0.22),
    sightseeing: Math.round((trip.budgetTotal || 48600000) * 0.10),
    contingency: Math.round((trip.budgetTotal || 48600000) * 0.05),
  };
  const [allocTransport, setAllocTransport] = useState<number>(currentAllocations.transport || 13600000);
  const [allocHotel, setAllocHotel] = useState<number>(currentAllocations.hotel || 17000000);
  const [allocMeal, setAllocMeal] = useState<number>(currentAllocations.meal || 10700000);
  const [allocSightseeing, setAllocSightseeing] = useState<number>(currentAllocations.sightseeing || 4900000);
  const [allocContingency, setAllocContingency] = useState<number>(currentAllocations.contingency || 2400000);

  // Flatten all activities
  const allActivities = trip.days.flatMap((d) => d.activities);

  // Activity costs sum
  const totalActivityCosts = allActivities.reduce((sum, a) => sum + (a.cost || 0), 0);

  // Invoices list and sum
  const invoicesList: ExpenseInvoice[] = trip.invoices || [];
  const totalInvoicesCosts = invoicesList.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  // Dynamic Total Spent and Remaining
  const totalBudget = trip.budgetTotal || 48600000;
  // If invoices exist, spent combines activities + invoices, or uses activity sum
  const spentBudget = totalActivityCosts + totalInvoicesCosts;
  const remainingBudget = Math.max(0, totalBudget - spentBudget);
  const percentUsed = totalBudget > 0 ? Math.min(Math.round((spentBudget / totalBudget) * 100), 100) : 0;

  // Category breakdown calculation
  const categoryConfigs = [
    {
      id: 'transport' as const,
      name: 'Vận chuyển & Thuê xe di chuyển',
      types: ['transport'],
      allocated: currentAllocations.transport || Math.round(totalBudget * 0.28),
    },
    {
      id: 'hotel' as const,
      name: 'Khách sạn, Resort & Lưu trú',
      types: ['hotel', 'checkin'],
      allocated: currentAllocations.hotel || Math.round(totalBudget * 0.35),
    },
    {
      id: 'meal' as const,
      name: 'Ăn uống & Nhà hàng ẩm thực địa phương',
      types: ['meal'],
      allocated: currentAllocations.meal || Math.round(totalBudget * 0.22),
    },
    {
      id: 'sightseeing' as const,
      name: 'Vé tham quan, Cáp treo & Trải nghiệm',
      types: ['sightseeing'],
      allocated: currentAllocations.sightseeing || Math.round(totalBudget * 0.10),
    },
    {
      id: 'contingency' as const,
      name: 'Dự phòng rủi ro & Bảo hiểm du lịch',
      types: ['briefing'],
      allocated: currentAllocations.contingency || Math.round(totalBudget * 0.05),
    },
  ];

  const categories = categoryConfigs.map((cat) => {
    const catActivities = allActivities.filter((a) => cat.types.includes(a.type));
    const catInvoices = invoicesList.filter((inv) => inv.category === cat.id);
    const actSum = catActivities.reduce((sum, a) => sum + (a.cost || 0), 0);
    const invSum = catInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    const spent = actSum + invSum;
    const allocated = cat.allocated;
    const percent = allocated > 0 ? Math.min(Math.round((spent / allocated) * 100), 100) : 0;

    let status = 'Dự kiến';
    if (spent >= allocated) {
      status = 'Vượt hạn mức';
    } else if (spent > 0) {
      status = 'Đang dùng';
    }

    return {
      id: cat.id,
      name: cat.name,
      allocated,
      spent,
      percent,
      status,
      count: catActivities.length + catInvoices.length,
    };
  });

  // Handle Create Invoice
  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invTitle.trim() || invAmount <= 0) return;

    const newInvoice: ExpenseInvoice = {
      id: `inv-${Date.now()}`,
      title: invTitle.trim(),
      category: invCategory,
      amount: invAmount,
      date: invDate,
      vendor: invVendor.trim() || undefined,
      invoiceNumber: invNumber.trim() || undefined,
      dayIndex: invDayIndex,
      note: invNote.trim() || undefined,
    };

    const updatedInvoices = [newInvoice, ...invoicesList];
    const newSpent = spentBudget + invAmount;
    const newRemaining = Math.max(0, totalBudget - newSpent);
    const newPercent = Math.round((newSpent / totalBudget) * 100);

    const updatedTrip: TripData = {
      ...trip,
      invoices: updatedInvoices,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }

    // Reset & close
    setInvTitle('');
    setInvAmount(500000);
    setInvVendor('');
    setInvNumber('');
    setInvNote('');
    setIsInvoiceModalOpen(false);
  };

  // Handle Delete Invoice
  const handleDeleteInvoice = (id: string) => {
    const updatedInvoices = invoicesList.filter((i) => i.id !== id);
    const deletedInv = invoicesList.find((i) => i.id === id);
    const deletedAmount = deletedInv?.amount || 0;
    const newSpent = Math.max(0, spentBudget - deletedAmount);
    const newRemaining = Math.max(0, totalBudget - newSpent);
    const newPercent = Math.round((newSpent / totalBudget) * 100);

    const updatedTrip: TripData = {
      ...trip,
      invoices: updatedInvoices,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }
  };

  // Handle edit total budget
  const handleEditTotalBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTotalBudget <= 0) return;

    const newRemaining = Math.max(0, newTotalBudget - spentBudget);
    const newPercent = Math.round((spentBudget / newTotalBudget) * 100);

    const updatedTrip: TripData = {
      ...trip,
      budgetTotal: newTotalBudget,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }

    setIsEditBudgetOpen(false);
  };

  // Handle edit category allocations
  const handleSaveCategoryAllocations = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedTrip: TripData = {
      ...trip,
      customCategoryAllocations: {
        transport: allocTransport,
        hotel: allocHotel,
        meal: allocMeal,
        sightseeing: allocSightseeing,
        contingency: allocContingency,
      },
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }

    setIsEditAllocationsOpen(false);
  };

  // Handle saving edited activity cost
  const handleSaveActivityCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;

    const updatedDays = trip.days.map((day) => ({
      ...day,
      activities: day.activities.map((act) =>
        act.id === editingActivity.id ? { ...act, cost: Math.max(0, editedCost) } : act
      ),
    }));

    const recalculatedActs = updatedDays.flatMap((d) => d.activities);
    const newActTotal = recalculatedActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const newSpent = newActTotal + totalInvoicesCosts;
    const newRemaining = Math.max(0, totalBudget - newSpent);
    const newPercent = Math.round((newSpent / totalBudget) * 100);

    const updatedTrip: TripData = {
      ...trip,
      days: updatedDays,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }

    setEditingActivity(null);
  };

  // Filtered expense items
  const normalizedQuery = (searchQuery || '').trim().toLowerCase();
  const filteredInvoices = invoicesList.filter((inv) => {
    if (!normalizedQuery) return true;
    return (
      inv.title.toLowerCase().includes(normalizedQuery) ||
      inv.vendor?.toLowerCase().includes(normalizedQuery) ||
      inv.invoiceNumber?.toLowerCase().includes(normalizedQuery) ||
      inv.category.toLowerCase().includes(normalizedQuery)
    );
  });

  const expenseActivities = allActivities.filter((a) => (a.cost || 0) > 0);
  const filteredActivities = expenseActivities.filter((act) => {
    if (!normalizedQuery) return true;
    return (
      act.title.toLowerCase().includes(normalizedQuery) ||
      act.location.toLowerCase().includes(normalizedQuery) ||
      act.type.toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">Quản lý Ngân sách Chuyến đi</h2>
          <p className="text-xs text-slate-500 font-medium">
            Theo dõi chi tiêu thực tế tự động từ lịch trình tour &amp; quản lý hóa đơn chứng từ
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsEditAllocationsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Phân bổ 5 hạng mục</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditBudgetOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Sửa hạn mức</span>
          </button>

          <button
            type="button"
            onClick={() => setIsInvoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi nhận hóa đơn/chi tiêu</span>
          </button>
        </div>
      </div>

      {/* Top 3 KPI stats - COMPUTED DYNAMICALLY, ZERO HARDCODED */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">Tổng hạn mức ngân sách</span>
            <button
              type="button"
              onClick={() => setIsEditBudgetOpen(true)}
              className="text-[11px] text-teal-600 hover:underline font-bold"
            >
              Chỉnh sửa
            </button>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
            {totalBudget.toLocaleString('vi-VN')} ₫
          </div>
          <span className="text-xs text-teal-700 font-medium mt-1 inline-block">
            100% dự toán tour {trip.code}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Đã giải ngân thực tế</span>
          <div className="text-2xl font-black text-emerald-600 tracking-tight font-mono">
            {spentBudget.toLocaleString('vi-VN')} ₫
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 inline-block">
            Chiếm {percentUsed}% tổng dự toán ({allActivities.length} hoạt động, {invoicesList.length} chứng từ)
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Dự toán còn lại</span>
          <div className="text-2xl font-black text-blue-600 tracking-tight font-mono">
            {remainingBudget.toLocaleString('vi-VN')} ₫
          </div>
          <span className="text-xs text-emerald-600 font-semibold mt-1 inline-block">
            {remainingBudget > 0 ? `Khả dụng: ${Math.round((remainingBudget / totalBudget) * 100)}% kế hoạch` : 'Đã đạt hạn mức ngân sách'}
          </span>
        </div>
      </div>

      {/* 5 Categories Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Chi tiết phân bổ 5 hạng mục dịch vụ</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tự động tính từ các hoạt động lịch trình và hóa đơn thực tế
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditAllocationsOpen(true)}
            className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Điều chỉnh tỷ lệ phân bổ</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {categories.map((cat) => (
            <div key={cat.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900">{cat.name}</h4>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {cat.count} mục chi
                  </span>
                </div>
                <div className="w-full max-w-xs bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${cat.spent >= cat.allocated ? 'bg-rose-500' : 'bg-teal-500'}`}
                    style={{ width: `${Math.min((cat.spent / cat.allocated) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 sm:text-right">
                <div>
                  <span className="text-slate-400 block text-[11px]">Đã chi:</span>
                  <span className="font-bold text-slate-800 font-mono text-xs">{cat.spent.toLocaleString('vi-VN')} ₫</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Hạn mức:</span>
                  <span className="font-bold text-slate-500 font-mono text-xs">{cat.allocated.toLocaleString('vi-VN')} ₫</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    cat.status === 'Vượt hạn mức'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : cat.status === 'Đang dùng'
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs: Hóa đơn chứng từ vs Chi tiêu theo lịch trình */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl text-xs font-bold gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'invoices' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Hóa đơn &amp; Chứng từ thực tế ({invoicesList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activities')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'activities' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Chi phí hoạt động theo lịch trình ({expenseActivities.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsInvoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm hóa đơn/phiếu chi</span>
          </button>
        </div>

        {/* Tab 1: Real Invoices & Receipts */}
        {activeTab === 'invoices' && (
          <div className="divide-y divide-slate-100 text-xs">
            {filteredInvoices.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                <p>Chưa có hóa đơn hoặc chứng từ chi tiêu nào được ghi nhận.</p>
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className="text-teal-600 font-bold hover:underline"
                >
                  + Ghi nhận hóa đơn / phiếu chi đầu tiên
                </button>
              </div>
            ) : (
              filteredInvoices.map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50 gap-4 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center shrink-0 border border-teal-100">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-extrabold text-slate-900">{inv.title}</h5>
                        {inv.invoiceNumber && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            HD: {inv.invoiceNumber}
                          </span>
                        )}
                        <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                          {inv.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                        {inv.vendor && <span>Đơn vị: <strong>{inv.vendor}</strong></span>}
                        <span>Ngày {inv.dayIndex ? `tour: Ngày ${inv.dayIndex}` : ''} ({inv.date})</span>
                        {inv.note && <span className="text-slate-400 italic">• {inv.note}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-mono font-extrabold text-emerald-700 text-sm block">
                        -{inv.amount.toLocaleString('vi-VN')} ₫
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Đã thanh toán</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteInvoice(inv.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                      title="Xóa hóa đơn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Activity Expenses */}
        {activeTab === 'activities' && (
          <div className="divide-y divide-slate-100 text-xs">
            {filteredActivities.map((act) => (
              <div key={act.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 gap-3 group transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">{act.title}</h5>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {act.location} • {act.timeStart}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="font-mono font-bold text-slate-900 block text-sm">
                      {(act.cost || 0).toLocaleString('vi-VN')} ₫
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      {act.type}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingActivity(act);
                      setEditedCost(act.cost || 0);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                    title="Chỉnh sửa chi phí hoạt động"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Ghi nhận hóa đơn/chi tiêu thực tế */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                <h3 className="text-sm font-extrabold">Ghi nhận hóa đơn &amp; chi tiêu thực tế</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên khoản chi / Nội dung hóa đơn *</label>
                <input
                  type="text"
                  required
                  value={invTitle}
                  onChange={(e) => setInvTitle(e.target.value)}
                  placeholder="Ví dụ: Tiền xăng xe 29 chỗ chặng Hải Vân"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số tiền (VNĐ) *</label>
                  <input
                    type="number"
                    min={1000}
                    step={50000}
                    required
                    value={invAmount}
                    onChange={(e) => setInvAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phân loại hạng mục</label>
                  <select
                    value={invCategory}
                    onChange={(e) => setInvCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  >
                    <option value="transport">Vận chuyển & Thuê xe</option>
                    <option value="hotel">Khách sạn & Lưu trú</option>
                    <option value="meal">Ẩm thực & Nhà hàng</option>
                    <option value="sightseeing">Vé tham quan & Cáp treo</option>
                    <option value="contingency">Dự phòng & Khác</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đơn vị cung cấp / Nhà xe</label>
                  <input
                    type="text"
                    value={invVendor}
                    onChange={(e) => setInvVendor(e.target.value)}
                    placeholder="Nhà xe Tuấn Anh, KS Grand..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số phiếu thu / Hóa đơn</label>
                  <input
                    type="text"
                    value={invNumber}
                    onChange={(e) => setInvNumber(e.target.value)}
                    placeholder="HD-8849"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày lập hóa đơn</label>
                  <input
                    type="date"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thuộc Ngày tour</label>
                  <select
                    value={invDayIndex}
                    onChange={(e) => setInvDayIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                  >
                    {trip.days.map((d) => (
                      <option key={d.dayIndex} value={d.dayIndex}>
                        Ngày {d.dayIndex} ({d.dayName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú thêm</label>
                <input
                  type="text"
                  value={invNote}
                  onChange={(e) => setInvNote(e.target.value)}
                  placeholder="Thanh toán qua chuyển khoản, người nhận..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:border-teal-500 outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  Lưu hóa đơn &amp; Cập nhật ngân sách
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa tổng hạn mức */}
      {isEditBudgetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Cập nhật hạn mức ngân sách tour</h3>
              <button
                type="button"
                onClick={() => setIsEditBudgetOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditTotalBudget} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tổng hạn mức mới (VNĐ)</label>
                <input
                  type="number"
                  min={1000000}
                  step={1000000}
                  required
                  value={newTotalBudget}
                  onChange={(e) => setNewTotalBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-base focus:border-teal-500 outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Sau khi cập nhật, số dư còn lại và tỷ lệ phần trăm sẽ tự động tính toán lại và lưu vào Firestore.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditBudgetOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  Lưu hạn mức
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tùy chỉnh phân bổ 5 hạng mục */}
      {isEditAllocationsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                <h3 className="text-sm font-extrabold">Tùy chỉnh phân bổ 5 hạng mục (VNĐ)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditAllocationsOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategoryAllocations} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">1. Vận chuyển &amp; Xe di chuyển</label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={allocTransport}
                  onChange={(e) => setAllocTransport(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">2. Khách sạn &amp; Lưu trú</label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={allocHotel}
                  onChange={(e) => setAllocHotel(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">3. Ẩm thực &amp; Nhà hàng</label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={allocMeal}
                  onChange={(e) => setAllocMeal(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">4. Vé tham quan &amp; Trải nghiệm</label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={allocSightseeing}
                  onChange={(e) => setAllocSightseeing(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">5. Dự phòng rủi ro &amp; Bảo hiểm</label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={allocContingency}
                  onChange={(e) => setAllocContingency(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Tổng phân bổ:</span>
                <span className="font-mono text-slate-900">
                  {(allocTransport + allocHotel + allocMeal + allocSightseeing + allocContingency).toLocaleString('vi-VN')} ₫
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditAllocationsOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  Lưu phân bổ &amp; Lưu Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Sửa chi phí hoạt động */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-teal-600 text-white flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Cập nhật chi phí hoạt động</h3>
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
                className="p-1 rounded-full hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveActivityCost} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Hoạt động</label>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800">
                  {editingActivity.title}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Số tiền (VNĐ)</label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  required
                  value={editedCost}
                  onChange={(e) => setEditedCost(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-sm focus:border-teal-500 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingActivity(null)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  Lưu &amp; Cập nhật Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
