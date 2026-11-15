import React, { Suspense, lazy, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MetricCards } from "./MetricCards";
import { OperationsPanel } from "./OperationsPanel";
import { TimelineSchedule } from "./TimelineSchedule";
import { OfflineIndicator } from "./OfflineIndicator";
import { TripData, Activity, TripMember, Waypoint } from "../../types/travel";
import { AuthUser } from "../../types/auth";
import { Calendar, Clock, Compass, RotateCcw } from "lucide-react";

const LiveRouteMap = lazy(() =>
  import("./LiveRouteMap").then((m) => ({ default: m.LiveRouteMap })),
);
const TripsListView = lazy(() =>
  import("../trips/TripsListView").then((m) => ({ default: m.TripsListView })),
);
const MembersView = lazy(() =>
  import("../trips/MembersView").then((m) => ({ default: m.MembersView })),
);
const BudgetView = lazy(() =>
  import("../trips/BudgetView").then((m) => ({ default: m.BudgetView })),
);
const AIOptimizeModal = lazy(() =>
  import("../modals/AIOptimizeModal").then((m) => ({ default: m.AIOptimizeModal })),
);
const AddActivityModal = lazy(() =>
  import("../modals/AddActivityModal").then((m) => ({ default: m.AddActivityModal })),
);
const AlertsListModal = lazy(() =>
  import("../modals/AlertsListModal").then((m) => ({ default: m.AlertsListModal })),
);
const ActivityDetailModal = lazy(() =>
  import("../modals/ActivityDetailModal").then((m) => ({ default: m.ActivityDetailModal })),
);

const TabLoadingFallback = ({ label = "Đang tải giao diện..." }: { label?: string }) => (
  <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center text-xs font-semibold text-slate-500 shadow-2xs">
    {label}
  </div>
);

export function UserDashboard({
  trip,
  trips,
  tripsLoaded = true,
  onSelectTrip,
  currentTab,
  currentDayIndex,
  setCurrentDayIndex,
  filterMode,
  setFilterMode,
  searchQuery,
  setSearchQuery,
  firebaseStatus,
  authUser,
  onLogout,
  onOpenAccount,
  setCurrentTab,
  setSelectedActivity,
  selectedActivity,
  handleUpdateActivityStatus,
  handleDeleteActivity,
  handleEditActivity,
  handleAddDay,
  handleDeleteDay,
  handleUpdateDayNote,
  handleToggleMemberAttendance,
  handleUpdateMembers,
  handleUpdateTrip,
  isAIPlannerOpen: _isAIPlannerOpen,
  setIsAIPlannerOpen,
  isAIOptimizeOpen,
  setIsAIOptimizeOpen,
  isAddActivityOpen,
  setIsAddActivityOpen,
  isAlertsModalOpen,
  setIsAlertsModalOpen,
  handleDismissAlert,
  isAIApplied,
  handleApplyAIOptimization,
  handleAddActivity,
  handleUpdateTripBudget,
  canUndo,
  onUndo,
  onOpenEditTripModal,
  onDeleteTrip,
  onCloneTrip,
  onSelectWaypoint,
  onScanAlerts,
  isScanningAlerts,
  notificationsEnabled,
  onToggleNotifications,
  pendingSyncCount = 0,
  cachedAt = null,
  onRetryOfflineSync,
  onOpenAIPlanner,
  onOpenAIOptimize,
  onOpenAutoArrange,
  onOpenTraditionalPlanner,
}: {
  trip: TripData | null;
  trips: TripData[];
  tripsLoaded?: boolean;
  onSelectTrip: (trip: TripData) => void;
  currentTab: string;
  currentDayIndex: number;
  setCurrentDayIndex: React.Dispatch<React.SetStateAction<number>>;
  filterMode: 'timeline' | 'all';
  setFilterMode: React.Dispatch<React.SetStateAction<'timeline' | 'all'>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  firebaseStatus: 'loading' | 'connected' | 'error';
  authUser: AuthUser;
  onLogout: () => void;
  onOpenAccount?: () => void;
  setCurrentTab: React.Dispatch<React.SetStateAction<string>>;
  setSelectedActivity: React.Dispatch<React.SetStateAction<Activity | null>>;
  selectedActivity: Activity | null;
  handleUpdateActivityStatus: (id: string, newStatus: Activity['status']) => void;
  handleDeleteActivity: (id: string) => void;
  handleEditActivity: (activity: Activity) => void;
  handleAddDay: () => Promise<void>;
  handleDeleteDay: (dayIndex: number) => Promise<void>;
  handleUpdateDayNote: (dayIndex: number, note: string) => Promise<void>;
  handleToggleMemberAttendance: (id: string) => Promise<void>;
  handleUpdateMembers: (members: TripMember[]) => Promise<void>;
  handleUpdateTrip: (trip: TripData, message?: string) => Promise<void>;
  isAIPlannerOpen: boolean;
  setIsAIPlannerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAIOptimizeOpen: boolean;
  setIsAIOptimizeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAddActivityOpen: boolean;
  setIsAddActivityOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAlertsModalOpen: boolean;
  setIsAlertsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleDismissAlert: (id: string) => void;
  isAIApplied: boolean;
  handleApplyAIOptimization: (actionTitle?: string, actionReason?: string, costSaved?: string, recommendationData?: any) => void;
  handleAddActivity: (newAct: Activity, targetDayIndex?: number) => void;
  handleUpdateTripBudget: (updated: TripData) => Promise<void>;
  canUndo?: boolean;
  onUndo?: () => void;
  onOpenEditTripModal?: (tripTarget?: TripData) => void;
  onDeleteTrip?: (tripId: string) => void;
  onCloneTrip?: (trip: TripData) => void;
  onSelectWaypoint?: (wp: Waypoint) => void;
  onScanAlerts?: () => Promise<void>;
  isScanningAlerts?: boolean;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
  pendingSyncCount?: number;
  cachedAt?: string | null;
  onRetryOfflineSync?: () => void;
  onOpenAIPlanner?: () => void;
  onOpenAIOptimize?: () => void;
  onOpenAutoArrange?: () => void;
  onOpenTraditionalPlanner?: () => void;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const renderEmptyState = () => (
    <div className="rounded-3xl bg-white border border-slate-200 p-8 sm:p-12 text-center shadow-sm space-y-5 max-w-2xl mx-auto my-8">
      <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto">
        <Compass className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-slate-900">Chào {authUser.name}, bạn chưa có chuyến đi nào</h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
          Tài khoản của bạn hiện chưa có dữ liệu tour mẫu giả lập. Hãy tạo chuyến đi đầu tiên bằng trình lập lịch thủ công hoặc để Gemini AI thiết kế hành trình hoàn chỉnh theo nhu cầu của bạn.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onOpenTraditionalPlanner || onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
          className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-900/20 transition cursor-pointer"
        >
          📋 Tạo chuyến đi đầu tiên
        </button>
        <button
          type="button"
          onClick={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
          className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-300 font-bold text-xs border border-slate-700 transition flex items-center gap-2 cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
          <span>Lập lịch tự động</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-screen lg:h-screen w-full overflow-x-hidden lg:overflow-hidden bg-[radial-gradient(circle_at_top_left,#ecfeff,#f0fdf4_20%,#f8fafc_55%,#edf6ff_100%)] text-slate-800">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),transparent_35%,rgba(16,185,129,0.12))] pointer-events-none" />
      <div className="relative flex min-h-full lg:h-full w-full min-w-0">
        <Sidebar
          currentTab={currentTab}
          userName={authUser.name}
          userRole={authUser.role}
          onLogout={onLogout}
          onOpenAccount={onOpenAccount}
          onSelectTab={(tab) => setCurrentTab(tab)}
          alertCount={trip?.alerts.length || 0}
          tripCount={trips.length}
          onOpenAIPlanner={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-y-auto">
          <Header
            trip={trip}
            role="user"
            onOpenCreateTripModal={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
            onOpenEditTripModal={trip ? () => onOpenEditTripModal?.(trip) : undefined}
            onDeleteCurrentTrip={trip ? () => onDeleteTrip?.(trip.id) : undefined}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectActivity={(act, dayIdx) => {
              setSelectedActivity(act);
              setCurrentDayIndex(dayIdx);
              setCurrentTab('schedule');
            }}
            onSelectLocation={() => setCurrentTab('map')}
            onSelectMember={() => setCurrentTab('members')}
            onToggleAttendance={handleToggleMemberAttendance}
            firebaseStatus={firebaseStatus}
            onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          />

          <main className="flex-1 p-3 sm:p-5 md:p-6 space-y-5 max-w-[1600px] w-full mx-auto min-w-0">
            <OfflineIndicator
              pendingSyncCount={pendingSyncCount}
              cachedAt={cachedAt}
              onRetrySync={onRetryOfflineSync}
            />

            {/* Firestore direct sync indicator banner */}
            {trip && (
              <div
                role="status"
                className={`text-xs font-semibold flex items-center justify-between p-3 rounded-2xl border ${
                  firebaseStatus === 'connected'
                    ? 'bg-teal-50/80 text-teal-800 border-teal-200'
                    : firebaseStatus === 'loading'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      firebaseStatus === 'connected'
                        ? 'bg-emerald-500'
                        : firebaseStatus === 'loading'
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-rose-500'
                    }`}
                  />
                  <span>
                    {firebaseStatus === 'loading' && 'Đang kết nối Firestore...'}
                    {firebaseStatus === 'connected' && 'Firestore trực tiếp: Tự động lưu mọi thay đổi (thêm hoạt động, điểm danh, đổi trạng thái)'}
                    {firebaseStatus === 'error' && 'Không thể kết nối Firestore, đang sử dụng dữ liệu lưu tạm cục bộ.'}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  Chuyến đi: {trip.code} • Ngày {trip.currentDay}/{trip.totalDays}
                </span>
              </div>
            )}

            {searchQuery && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between text-xs text-amber-900">
                <span className="font-semibold">
                  Đang lọc toàn bộ dữ liệu theo: &quot;{searchQuery}&quot;
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="font-bold text-amber-800 hover:underline cursor-pointer"
                >
                  Xóa tìm kiếm
                </button>
              </div>
            )}

            {!tripsLoaded ? (
              <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center text-sm text-slate-500 font-semibold">
                Đang tải dữ liệu chuyến đi của bạn...
              </div>
            ) : currentTab === 'trips' ? (
              <Suspense fallback={<TabLoadingFallback label="Đang tải danh sách chuyến đi..." />}>
                <TripsListView
                  trips={trips}
                  currentTrip={trip}
                  onSelectTrip={onSelectTrip}
                  onOpenCreateModal={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
                  onEditTrip={onOpenEditTripModal}
                  onDeleteTrip={onDeleteTrip}
                  onCloneTrip={onCloneTrip}
                  readOnly={false}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                />
              </Suspense>
            ) : !trip ? (
              renderEmptyState()
            ) : (
              <>
                {currentTab === 'dashboard' && (
                  <>
                    {/* Hero Banner with Quick Actions */}
                    <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-6 text-white shadow-xl shadow-teal-950/20 border border-slate-800">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                        <div>
                          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-400">
                            <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                            <span>Bảng Điều Phối Du Lịch Thông Minh</span>
                          </div>
                          <h2 className="mt-2 text-2xl sm:text-3xl font-black text-white">
                            Chào {authUser.name}
                          </h2>
                          <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-slate-300">
                            Hành trình <strong className="text-white">{trip.title}</strong> ({trip.originFull} ➔ {trip.destinationFull}) • {trip.totalDays} ngày ({trip.dates}). Hệ thống giám sát giao thông, thời tiết đèo dốc và tự động tối ưu hóa lịch trình.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <button
                            onClick={onOpenTraditionalPlanner || onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
                            className="px-3.5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition shadow-lg shadow-teal-500/25 flex items-center gap-1.5 cursor-pointer"
                            title="Lập lịch theo mẫu tour chuẩn hoặc tự thiết kế từng ngày"
                          >
                            <span>📋 Lập lịch truyền thống</span>
                          </button>

                          <button
                            onClick={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
                            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 cursor-pointer"
                            title="Tự động lập toàn bộ hành trình"
                          >
                            <Calendar className="w-3.5 h-3.5 text-slate-950" />
                            <span>Lập lịch tự động</span>
                          </button>

                          {onOpenAutoArrange && (
                            <button
                              onClick={onOpenAutoArrange}
                              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-amber-400/30 transition flex items-center gap-1.5 cursor-pointer"
                              title="Tự động xếp lịch: loại bỏ chồng chéo thời gian và cân bằng đệm di chuyển"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-300" />
                              <span>Tự động xếp lịch</span>
                            </button>
                          )}

                          <button
                            onClick={onOpenAIOptimize || (() => setIsAIOptimizeOpen(true))}
                            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs border border-teal-400/30 transition flex items-center gap-1.5 cursor-pointer"
                            title="Sắp xếp lại các điểm tham quan và cảnh báo trong chuyến đi"
                          >
                            <span>Tối ưu chuyến đi</span>
                          </button>

                          {canUndo && onUndo && (
                            <button
                              onClick={onUndo}
                              className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-400/40 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                              title="Hoàn tác phương án tối ưu lịch trình vừa áp dụng"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Hoàn tác điều phối</span>
                            </button>
                          )}

                          <button
                            onClick={() => setIsAddActivityOpen(true)}
                            className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>+ Thêm hoạt động</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Metric Cards Row */}
                    <MetricCards
                      trip={trip}
                      onOpenMembers={() => setCurrentTab('members')}
                      onOpenBudget={() => setCurrentTab('budget')}
                      onOpenSchedule={() => setCurrentTab('schedule')}
                    />

                    {/* Operations Panel and Live Route Map */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start min-w-0">
                      <div className="xl:col-span-8 min-w-0">
                        <Suspense fallback={<TabLoadingFallback label="Đang tải bản đồ tuyến đường..." />}>
                          <LiveRouteMap
                            trip={trip}
                            onSelectWaypoint={onSelectWaypoint}
                            onUpdateTrip={handleUpdateTrip}
                            searchQuery={searchQuery}
                            onClearSearch={() => setSearchQuery('')}
                          />
                        </Suspense>
                      </div>

                      <div className="xl:col-span-4 min-w-0 space-y-4">
                        <OperationsPanel
                          trip={trip}
                          onOpenAlertsModal={() => setIsAlertsModalOpen(true)}
                          onOpenApplyAIPlan={onOpenAIOptimize || (() => setIsAIOptimizeOpen(true))}
                          isAIApplied={isAIApplied}
                          onUndo={onUndo}
                          canUndo={canUndo}
                          onScanAlerts={onScanAlerts}
                          isScanningAlerts={isScanningAlerts}
                          notificationsEnabled={notificationsEnabled}
                          onToggleNotifications={onToggleNotifications}
                        />
                      </div>
                    </div>

                    {/* Full-width Timeline Schedule */}
                    <div className="w-full min-w-0">
                      <TimelineSchedule
                        days={trip.days}
                        currentDayIndex={currentDayIndex}
                        onSelectDay={setCurrentDayIndex}
                        onAddActivity={() => setIsAddActivityOpen(true)}
                        onSelectActivity={(act) => setSelectedActivity(act)}
                        filterMode={filterMode}
                        onToggleFilterMode={() => setFilterMode(filterMode === 'timeline' ? 'all' : 'timeline')}
                        searchQuery={searchQuery}
                        onClearSearch={() => setSearchQuery('')}
                        onUpdateStatus={handleUpdateActivityStatus}
                        onDeleteActivity={handleDeleteActivity}
                        onEditActivity={handleEditActivity}
                        onAddDay={handleAddDay}
                        onDeleteDay={handleDeleteDay}
                        onUpdateDayNote={handleUpdateDayNote}
                        onOpenAutoArrange={onOpenAutoArrange}
                      />
                    </div>
                  </>
                )}

                {currentTab === 'schedule' && (
                  <div className="space-y-4 min-w-0 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                      <div>
                        <h2 className="text-xl font-black text-slate-900">Chi tiết Lịch trình Chuyến đi</h2>
                        <p className="text-xs text-slate-500 font-medium">
                          Hành trình {trip.title} • {trip.totalDays} ngày ({trip.confirmedActivities}/{trip.totalActivities} hoạt động đã xác nhận)
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {onOpenAutoArrange && (
                          <button
                            onClick={onOpenAutoArrange}
                            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                            title="Tự động kiểm tra xung đột thời gian, sắp xếp lại thứ tự và chèn khoảng đệm di chuyển"
                          >
                            <span>Tự động xếp lịch</span>
                          </button>
                        )}
                        <button
                          onClick={onOpenAIOptimize || (() => setIsAIOptimizeOpen(true))}
                          className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                          title="Phân tích và tối ưu lại lịch trình chuyến đi"
                        >
                          <span>Tối ưu chuyến đi</span>
                        </button>
                        <button
                          onClick={() => setFilterMode(filterMode === 'timeline' ? 'all' : 'timeline')}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          {filterMode === 'timeline' ? 'Hiện toàn bộ ngày' : 'Chế độ timeline'}
                        </button>
                        <button
                          onClick={() => setIsAddActivityOpen(true)}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          + Thêm hoạt động vào Ngày {currentDayIndex}
                        </button>
                      </div>
                    </div>

                    <TimelineSchedule
                      days={trip.days}
                      currentDayIndex={currentDayIndex}
                      onSelectDay={setCurrentDayIndex}
                      onAddActivity={() => setIsAddActivityOpen(true)}
                      onSelectActivity={(act) => setSelectedActivity(act)}
                      filterMode={filterMode}
                      onToggleFilterMode={() => setFilterMode(filterMode === 'timeline' ? 'all' : 'timeline')}
                      canAddActivity
                      searchQuery={searchQuery}
                      onClearSearch={() => setSearchQuery('')}
                      onUpdateStatus={handleUpdateActivityStatus}
                      onDeleteActivity={handleDeleteActivity}
                      onEditActivity={handleEditActivity}
                      onAddDay={handleAddDay}
                      onDeleteDay={handleDeleteDay}
                      onUpdateDayNote={handleUpdateDayNote}
                      onOpenAutoArrange={onOpenAutoArrange}
                    />
                  </div>
                )}

                {currentTab === 'map' && (
                  <div className="w-full min-w-0">
                    <Suspense fallback={<TabLoadingFallback label="Đang tải bản đồ tuyến đường..." />}>
                      <LiveRouteMap
                        trip={trip}
                        onSelectWaypoint={onSelectWaypoint}
                        onUpdateTrip={handleUpdateTrip}
                        searchQuery={searchQuery}
                        onClearSearch={() => setSearchQuery('')}
                      />
                    </Suspense>
                  </div>
                )}

                {currentTab === 'members' && (
                  <div className="w-full min-w-0">
                    <Suspense fallback={<TabLoadingFallback label="Đang tải danh sách thành viên..." />}>
                      <MembersView
                        members={trip.members}
                        onToggleStatus={handleToggleMemberAttendance}
                        onUpdateMembers={handleUpdateMembers}
                        searchQuery={searchQuery}
                        onClearSearch={() => setSearchQuery('')}
                      />
                    </Suspense>
                  </div>
                )}

                {currentTab === 'budget' && (
                  <div className="w-full min-w-0">
                    <Suspense fallback={<TabLoadingFallback label="Đang tải quản lý ngân sách..." />}>
                      <BudgetView
                        trip={trip}
                        onUpdateTripBudget={handleUpdateTripBudget}
                        searchQuery={searchQuery}
                        onClearSearch={() => setSearchQuery('')}
                      />
                    </Suspense>
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {trip && isAIOptimizeOpen && (
          <Suspense fallback={null}>
            <AIOptimizeModal
              isOpen={isAIOptimizeOpen}
              onClose={() => setIsAIOptimizeOpen(false)}
              trip={trip}
              onApplyChanges={handleApplyAIOptimization}
              isApplied={isAIApplied}
              onUndo={onUndo}
              canUndo={canUndo}
            />
          </Suspense>
        )}
        {trip && isAddActivityOpen && (
          <Suspense fallback={null}>
            <AddActivityModal
              isOpen={isAddActivityOpen}
              onClose={() => setIsAddActivityOpen(false)}
              dayIndex={currentDayIndex}
              days={trip.days}
              defaultLocation={trip.destinationFull}
              onAdd={handleAddActivity}
            />
          </Suspense>
        )}
        {trip && isAlertsModalOpen && (
          <Suspense fallback={null}>
            <AlertsListModal
              isOpen={isAlertsModalOpen}
              onClose={() => setIsAlertsModalOpen(false)}
              alerts={trip.alerts}
              onDismissAlert={handleDismissAlert}
              onTriggerAI={() => {
                setIsAlertsModalOpen(false);
                if (onOpenAIOptimize) {
                  onOpenAIOptimize();
                } else {
                  setIsAIOptimizeOpen(true);
                }
              }}
              onScanAlerts={onScanAlerts}
              isScanningAlerts={isScanningAlerts}
            />
          </Suspense>
        )}
        {selectedActivity && (
          <Suspense fallback={null}>
            <ActivityDetailModal
              activity={selectedActivity}
              onClose={() => setSelectedActivity(null)}
              onUpdateStatus={handleUpdateActivityStatus}
              onDeleteActivity={handleDeleteActivity}
              onEditActivity={handleEditActivity}
              canEdit
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
