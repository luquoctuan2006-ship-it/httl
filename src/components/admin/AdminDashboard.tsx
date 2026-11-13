import React, { useState } from "react";
import { Sidebar } from "../dashboard/Sidebar";
import { Header } from "../dashboard/Header";
import { MetricCards } from "../dashboard/MetricCards";
import { LiveRouteMap } from "../dashboard/LiveRouteMap";
import { OperationsPanel } from "../dashboard/OperationsPanel";
import { TimelineSchedule } from "../dashboard/TimelineSchedule";
import { AIOptimizeModal } from "../modals/AIOptimizeModal";
import { AddActivityModal } from "../modals/AddActivityModal";
import { AlertsListModal } from "../modals/AlertsListModal";
import { ActivityDetailModal } from "../modals/ActivityDetailModal";
import { TripsListView } from "../trips/TripsListView";
import { MembersView } from "../trips/MembersView";
import { BudgetView } from "../trips/BudgetView";
import { OfflineIndicator } from "../dashboard/OfflineIndicator";
import {
  AdminDashboardView,
  AdminUsersManagementView,
  AdminPlanningDataView,
  AdminDispatchRulesView,
  AdminAIManagementView,
  AdminScheduleMonitoringView,
  AdminSystemManagementView,
} from "./AdminManagementViews";
import { TripData, Activity, TripMember, Waypoint } from "../../types/travel";
import { AuthUser } from "../../types/auth";
import { Compass } from "lucide-react";

export function AdminDashboard({
  trip,
  trips,
  tripsLoaded = true,
  onSelectTrip,
  currentTab,
  setCurrentTab,
  currentDayIndex,
  setCurrentDayIndex,
  filterMode,
  setFilterMode,
  searchQuery,
  setSearchQuery,
  firebaseStatus,
  isAIApplied,
  authUser,
  onLogout,
  onOpenAccount,
  isAdminMode,
  isAIPlannerOpen,
  setIsAIPlannerOpen,
  isAIOptimizeOpen,
  setIsAIOptimizeOpen,
  isAddActivityOpen,
  setIsAddActivityOpen,
  isAlertsModalOpen,
  setIsAlertsModalOpen,
  selectedActivity,
  setSelectedActivity,
  handleSelectTab,
  handleApplyGeneratedTrip,
  handleApplyAIOptimization,
  handleAddActivity,
  handleUpdateActivityStatus,
  handleDeleteActivity,
  handleEditActivity,
  handleAddDay,
  handleDeleteDay,
  handleUpdateDayNote,
  handleToggleMemberAttendance,
  handleUpdateMembers,
  handleUpdateTrip,
  handleDismissAlert,
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
  setCurrentTab: React.Dispatch<React.SetStateAction<string>>;
  currentDayIndex: number;
  setCurrentDayIndex: React.Dispatch<React.SetStateAction<number>>;
  filterMode: 'timeline' | 'all';
  setFilterMode: React.Dispatch<React.SetStateAction<'timeline' | 'all'>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  firebaseStatus: 'loading' | 'connected' | 'error';
  isAIApplied: boolean;
  authUser: AuthUser;
  onLogout: () => void;
  onOpenAccount?: () => void;
  isAdminMode: boolean;
  isAIPlannerOpen: boolean;
  setIsAIPlannerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAIOptimizeOpen: boolean;
  setIsAIOptimizeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAddActivityOpen: boolean;
  setIsAddActivityOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAlertsModalOpen: boolean;
  setIsAlertsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedActivity: Activity | null;
  setSelectedActivity: React.Dispatch<React.SetStateAction<Activity | null>>;
  handleSelectTab: (tab: string) => void;
  handleApplyGeneratedTrip: (newTrip: TripData) => Promise<void>;
  handleApplyAIOptimization: (actionTitle?: string, actionReason?: string, costSaved?: string) => void;
  handleAddActivity: (newAct: Activity, targetDayIndex?: number) => void;
  handleUpdateActivityStatus: (id: string, newStatus: Activity['status']) => void;
  handleDeleteActivity: (id: string) => void;
  handleEditActivity: (activity: Activity) => void;
  handleAddDay: () => Promise<void>;
  handleDeleteDay: (dayIndex: number) => Promise<void>;
  handleUpdateDayNote: (dayIndex: number, note: string) => Promise<void>;
  handleToggleMemberAttendance: (id: string) => Promise<void>;
  handleUpdateMembers: (members: TripMember[]) => Promise<void>;
  handleUpdateTrip: (trip: TripData, message?: string) => Promise<void>;
  handleDismissAlert: (id: string) => void;
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

  const emptyTripNotice = (
    <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-10 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center mx-auto">
        <Compass className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-black text-white">Chưa có chuyến đi nào trong hệ thống</h3>
      <p className="text-xs text-slate-400 max-w-md mx-auto">
        Tạo chuyến đi đầu tiên để điều phối lịch trình, giám sát cảnh báo hoặc phân tích dữ liệu hoạch định.
      </p>
      <button
        type="button"
        onClick={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
        className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition"
      >
        + Tạo chuyến đi mới
      </button>
    </div>
  );

  return (
    <div className="relative flex min-h-screen lg:h-screen w-full overflow-x-hidden lg:overflow-hidden bg-[radial-gradient(circle_at_top_left,#0f172a,#111827_28%,#020817_100%)] text-slate-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(45,212,191,0.12),transparent_40%,rgba(59,130,246,0.08))] pointer-events-none" />
      <div className="relative flex min-h-full lg:h-full w-full min-w-0">
      <Sidebar
        currentTab={currentTab}
        userName={authUser.name}
        userRole={authUser.role}
        onLogout={onLogout}
        onOpenAccount={onOpenAccount}
        onSelectTab={handleSelectTab}
        alertCount={trip?.alerts.length || 0}
        tripCount={trips.length}
        onOpenAIPlanner={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-y-auto">
        <Header
          trip={trip}
          role="admin"
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
          onSelectLocation={() => setCurrentTab('locations')}
          onSelectMember={() => setCurrentTab('members')}
          onToggleAttendance={handleToggleMemberAttendance}
          firebaseStatus={firebaseStatus}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-3 sm:p-5 md:p-6 space-y-6 max-w-[1680px] w-full mx-auto min-w-0">
          <OfflineIndicator
            pendingSyncCount={pendingSyncCount}
            cachedAt={cachedAt}
            onRetrySync={onRetryOfflineSync}
          />

          {firebaseStatus === 'error' && (
            <div
              role="status"
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2"
            >
              <span>⚠️</span>
              <span>Không thể đồng bộ cơ sở dữ liệu Firestore Cloud</span>
            </div>
          )}

          {currentTab === 'users' && <AdminUsersManagementView />}
          {currentTab === 'rules' && <AdminDispatchRulesView />}

          {!tripsLoaded && !['users', 'rules'].includes(currentTab) ? (
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-12 text-center text-sm text-slate-400">
              Đang tải dữ liệu hệ thống...
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && isAdminMode && (
                trip ? (
                  <AdminDashboardView
                    trip={trip}
                    trips={trips}
                    firebaseStatus={firebaseStatus}
                    onNavigate={handleSelectTab}
                    onOpenAIPlanner={() => setIsAIPlannerOpen(true)}
                    onOpenAIOptimize={() => setIsAIOptimizeOpen(true)}
                  />
                ) : emptyTripNotice
              )}

              {currentTab === 'planning' && (trip ? <AdminPlanningDataView trip={trip} onUpdateTrip={handleUpdateTrip} /> : emptyTripNotice)}
              {currentTab === 'ai' && (trip ? <AdminAIManagementView onOpenAIPlanner={() => setIsAIPlannerOpen(true)} trip={trip} isAIApplied={isAIApplied} /> : emptyTripNotice)}
              {currentTab === 'monitoring' && (trip ? <AdminScheduleMonitoringView trip={trip} trips={trips} onUpdateTrip={handleUpdateTrip} /> : emptyTripNotice)}
              {currentTab === 'system' && (trip ? <AdminSystemManagementView trip={trip} /> : emptyTripNotice)}
              {currentTab === 'locations' && (trip ? <AdminPlanningDataView trip={trip} onUpdateTrip={handleUpdateTrip} /> : emptyTripNotice)}

              {currentTab === 'dashboard' && !isAdminMode && (
                trip ? (
                  <>
                    <MetricCards
                      trip={trip}
                      onOpenMembers={() => setCurrentTab('members')}
                      onOpenBudget={() => setCurrentTab('budget')}
                      onOpenSchedule={() => setCurrentTab('schedule')}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      <div className="lg:col-span-8">
                        <LiveRouteMap
                          trip={trip}
                          onSelectWaypoint={onSelectWaypoint}
                          onUpdateTrip={handleUpdateTrip}
                          searchQuery={searchQuery}
                          onClearSearch={() => setSearchQuery('')}
                        />
                      </div>

                      <div className="lg:col-span-4">
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
                      onOpenAutoArrange={onOpenAutoArrange}
                    />
                  </>
                ) : emptyTripNotice
              )}

              {currentTab === 'trips' && (
                <TripsListView
                  trips={trips}
                  currentTrip={trip}
                  onSelectTrip={onSelectTrip}
                  onOpenCreateModal={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
                  onEditTrip={onOpenEditTripModal}
                  onDeleteTrip={onDeleteTrip}
                  onCloneTrip={onCloneTrip}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                />
              )}

              {currentTab === 'schedule' && (
                trip ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black text-white">Chi tiết Lịch trình Toàn bộ Hành trình</h2>
                        <p className="text-xs text-slate-400 font-medium">
                          Xem và chỉnh sửa toàn bộ các chặng từ Ngày 1 đến Ngày {trip.totalDays}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {onOpenAutoArrange && (
                          <button
                            onClick={onOpenAutoArrange}
                            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/30 transition flex items-center gap-1.5 cursor-pointer"
                            title="Tự động kiểm tra xung đột thời gian, sắp xếp lại thứ tự và chèn khoảng đệm di chuyển"
                          >
                            <span>⚡ Tự động xếp lịch</span>
                          </button>
                        )}
                        <button
                          onClick={() => setIsAddActivityOpen(true)}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-900/30 transition cursor-pointer"
                        >
                          + Thêm hoạt động mới
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
                ) : emptyTripNotice
              )}

              {currentTab === 'map' && (
                trip ? (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xl font-black text-white">Bản đồ Tuyến đường Toàn cảnh & Telematics</h2>
                      <p className="text-xs text-slate-400 font-medium">
                        Giám sát hành trình phương tiện trực tiếp trên cung đường {trip.originFull} - {trip.destinationFull}
                      </p>
                    </div>
                    <LiveRouteMap
                      trip={trip}
                      onSelectWaypoint={onSelectWaypoint}
                      onUpdateTrip={handleUpdateTrip}
                      searchQuery={searchQuery}
                      onClearSearch={() => setSearchQuery('')}
                    />
                  </div>
                ) : emptyTripNotice
              )}

              {currentTab === 'members' && (
                trip ? (
                  <MembersView
                    members={trip.members}
                    onToggleStatus={handleToggleMemberAttendance}
                    onUpdateMembers={handleUpdateMembers}
                    searchQuery={searchQuery}
                    onClearSearch={() => setSearchQuery('')}
                  />
                ) : emptyTripNotice
              )}

              {currentTab === 'budget' && (
                trip ? (
                  <BudgetView
                    trip={trip}
                    onUpdateTripBudget={handleUpdateTripBudget}
                    searchQuery={searchQuery}
                    onClearSearch={() => setSearchQuery('')}
                  />
                ) : emptyTripNotice
              )}
            </>
          )}

        </main>
      </div>

      {trip && (
        <>
          <AIOptimizeModal
            isOpen={isAIOptimizeOpen}
            onClose={() => setIsAIOptimizeOpen(false)}
            trip={trip}
            onApplyChanges={handleApplyAIOptimization}
            isApplied={isAIApplied}
            onUndo={onUndo}
            canUndo={canUndo}
          />
          <AddActivityModal
            isOpen={isAddActivityOpen}
            onClose={() => setIsAddActivityOpen(false)}
            dayIndex={currentDayIndex}
            days={trip.days}
            defaultLocation={trip.destinationFull}
            onAdd={handleAddActivity}
          />
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
        </>
      )}
      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onUpdateStatus={handleUpdateActivityStatus}
        onDeleteActivity={handleDeleteActivity}
        onEditActivity={handleEditActivity}
      />
      </div>
    </div>
  );
}
