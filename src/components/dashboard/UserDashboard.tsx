import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MetricCards } from "./MetricCards";
import { OperationsPanel } from "./OperationsPanel";
import { TimelineSchedule } from "./TimelineSchedule";
import { OfflineIndicator } from "./OfflineIndicator";
import { TripData, Activity, TripMember, Waypoint } from "../../types/travel";
import { AuthUser } from "../../types/auth";
import { isUserTripOwnerOrAdmin } from "../../utils/trip/tripJoinHelpers";
import { isBudgetAlert } from "../../utils/trip/budgetAlerts";
import { countUnreadAlerts, getSeenAlertIds, markAlertsAsSeen } from "../../utils/schedule/seenAlerts";
import { buildRouteProgress, formatTravelDuration } from "../../utils/route/routeProgress";
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  ChevronDown,
  Clock,
  CloudSun,
  Compass,
  KeyRound,
  MapPin,
  Navigation,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Users,
} from "lucide-react";

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
  <div className="rounded-xl bg-white border border-neutral-200 p-10 text-center text-xs font-semibold text-neutral-500">
    {label}
  </div>
);

const STATUS_TEXT_CLASS: Record<Activity["status"], string> = {
  "Hoàn tất": "text-neutral-900",
  "Đang diễn ra": "text-red-600",
  "Đã xác nhận": "text-blue-700",
  "Cần xử lý": "text-red-700",
  "Chờ duyệt": "text-neutral-500",
};

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
  onOpenJoinModal,
  onManageJoinCode,
  onAddGuestCompanion,
  onRemoveGuestCompanion,
  onOpenGuestModeWithCode,
  onLeaveTrip,
}: {
  trip: TripData | null;
  trips: TripData[];
  tripsLoaded?: boolean;
  onSelectTrip: (trip: TripData) => void;
  currentTab: string;
  currentDayIndex: number;
  setCurrentDayIndex: React.Dispatch<React.SetStateAction<number>>;
  filterMode: "timeline" | "all";
  setFilterMode: React.Dispatch<React.SetStateAction<"timeline" | "all">>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  firebaseStatus: "loading" | "connected" | "error";
  authUser: AuthUser;
  onLogout: () => void;
  onOpenAccount?: () => void;
  setCurrentTab: React.Dispatch<React.SetStateAction<string>>;
  setSelectedActivity: React.Dispatch<React.SetStateAction<Activity | null>>;
  selectedActivity: Activity | null;
  handleUpdateActivityStatus: (id: string, newStatus: Activity["status"]) => void;
  handleDeleteActivity: (id: string) => void;
  handleEditActivity: (activity: Activity) => void;
  handleAddDay: () => Promise<void>;
  handleDeleteDay: (dayIndex: number) => Promise<void>;
  handleUpdateDayNote: (dayIndex: number, note: string) => Promise<void>;
  handleToggleMemberAttendance: (id: string, nextStatus?: TripMember["attendanceStatus"]) => Promise<void>;
  handleUpdateMembers: (members: TripMember[]) => Promise<void>;
  handleUpdateTrip: (trip: TripData, message?: string) => Promise<void | boolean>;
  setIsAIPlannerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAIOptimizeOpen: boolean;
  setIsAIOptimizeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAddActivityOpen: boolean;
  setIsAddActivityOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAlertsModalOpen: boolean;
  setIsAlertsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleDismissAlert: (id: string) => void;
  isAIApplied: boolean;
  handleApplyAIOptimization: (
    actionTitle?: string,
    actionReason?: string,
    costSaved?: string,
    recommendationData?: any,
  ) => void;
  handleAddActivity: (newAct: Activity, targetDayIndex?: number) => void;
  handleUpdateTripBudget: (updated: TripData) => Promise<void | boolean>;
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
  onOpenJoinModal?: () => void;
  onManageJoinCode?: (action: "generate" | "rotate" | "toggle") => Promise<void>;
  onAddGuestCompanion?: (payload: {
    name: string;
    phone?: string;
    specialPreference?: string;
  }) => Promise<void>;
  onRemoveGuestCompanion?: (memberId: string) => Promise<void>;
  onOpenGuestModeWithCode?: (joinCode: string, guestName?: string) => Promise<void>;
  onLeaveTrip?: () => Promise<void>;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const isTripOwner = trip ? isUserTripOwnerOrAdmin(trip, authUser.id, authUser.role) : true;
  const isParticipant = Boolean(trip && !isTripOwner);
  const visibleTripAlerts = trip
    ? isParticipant
      ? (trip.alerts || []).filter((a) => !isBudgetAlert(a))
      : trip.alerts || []
    : [];

  const [seenAlertIds, setSeenAlertIds] = useState<Set<string>>(() => getSeenAlertIds(trip?.id));

  useEffect(() => {
    setSeenAlertIds(getSeenAlertIds(trip?.id));
  }, [trip?.id]);

  useEffect(() => {
    setIsToolsMenuOpen(false);
  }, [trip?.id, currentTab]);

  useEffect(() => {
    if (!isToolsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isToolsMenuOpen]);

  useEffect(() => {
    if (!trip?.id || !isAlertsModalOpen || visibleTripAlerts.length === 0) return;
    setSeenAlertIds(markAlertsAsSeen(trip.id, visibleTripAlerts.map((a) => a.id)));
  }, [trip?.id, isAlertsModalOpen, visibleTripAlerts]);

  const unreadAlertCount = countUnreadAlerts(visibleTripAlerts, seenAlertIds);

  const handleOpenAlertsModal = () => {
    if (trip?.id && visibleTripAlerts.length > 0) {
      setSeenAlertIds(markAlertsAsSeen(trip.id, visibleTripAlerts.map((a) => a.id)));
    }
    setIsAlertsModalOpen(true);
  };

  const overviewRouteSummary = useMemo(() => {
    if (!trip) return null;
    return buildRouteProgress(trip, "all");
  }, [trip]);

  const activeOverviewDay = useMemo(() => {
    if (!trip || !trip.days?.length) return null;
    return trip.days.find((d) => d.dayIndex === currentDayIndex) || trip.days[0];
  }, [trip, currentDayIndex]);

  const sortedOverviewActivities = useMemo(() => {
    const acts = activeOverviewDay?.activities || [];
    const q = (searchQuery || "").trim().toLowerCase();
    const filtered = q
      ? acts.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.location.toLowerCase().includes(q) ||
            a.details.toLowerCase().includes(q),
        )
      : acts;
    return [...filtered].sort((a, b) => (a.timeStart || "").localeCompare(b.timeStart || ""));
  }, [activeOverviewDay, searchQuery]);

  const renderEmptyState = () => (
    <div className="rounded-2xl bg-white border border-neutral-200 p-8 sm:p-12 text-center space-y-5 max-w-2xl mx-auto my-8">
      <div className="w-14 h-14 rounded-xl bg-neutral-950 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto shadow-md">
        <Compass className="w-7 h-7" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-950">
          Chào {authUser.name}, bạn chưa có chuyến đi nào
        </h2>
        <p className="text-xs sm:text-sm text-neutral-500 max-w-lg mx-auto leading-relaxed">
          Hãy tạo chuyến đi đầu tiên bằng trình lập lịch hoặc nhập mã tham gia nếu bạn được mời vào một hành trình khác.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onOpenTraditionalPlanner || onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>Tạo chuyến đi đầu tiên</span>
        </button>
        <button
          type="button"
          onClick={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
          className="px-4 py-2.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Calendar className="w-4 h-4 text-red-400" />
          <span>Lập lịch tự động</span>
        </button>
        {onOpenJoinModal && (
          <button
            type="button"
            onClick={onOpenJoinModal}
            className="px-4 py-2.5 rounded-lg bg-white hover:bg-neutral-50 text-neutral-800 font-semibold text-xs border border-neutral-200 transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <KeyRound className="w-4 h-4 text-red-600" />
            <span>Tham gia bằng mã</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-screen lg:h-screen w-full overflow-x-hidden lg:overflow-hidden bg-[#F4F6FA] text-neutral-900">
      <div className="relative flex min-h-full lg:h-full w-full min-w-0">
        <Sidebar
          currentTab={currentTab}
          userName={authUser.name}
          userRole={authUser.role}
          onLogout={onLogout}
          onOpenAccount={onOpenAccount}
          onSelectTab={(tab) => setCurrentTab(tab)}
          tripCount={trips.length}
          onOpenAIPlanner={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
          onOpenJoinTrip={onOpenJoinModal}
          hideBudgetTab={isParticipant}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-y-auto">
          <Header
            trip={trip}
            role="user"
            isTripParticipant={isParticipant}
            currentUserUid={authUser.id}
            onOpenEditTripModal={trip && isTripOwner ? () => onOpenEditTripModal?.(trip) : undefined}
            onDeleteCurrentTrip={trip && isTripOwner ? () => onDeleteTrip?.(trip.id) : undefined}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectActivity={(act, dayIdx) => {
              setSelectedActivity(act);
              setCurrentDayIndex(dayIdx);
              setCurrentTab("schedule");
            }}
            onSelectLocation={() => setCurrentTab("map")}
            onSelectMember={() => setCurrentTab("members")}
            onToggleAttendance={handleToggleMemberAttendance}
            onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          />

          <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-[1480px] w-full mx-auto min-w-0">
            <OfflineIndicator
              pendingSyncCount={pendingSyncCount}
              cachedAt={cachedAt}
              onRetrySync={onRetryOfflineSync}
            />

            {trip && firebaseStatus === "error" && (
              <div
                role="status"
                className="text-xs font-medium flex items-center justify-between px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-800"
              >
                <span>Không thể kết nối máy chủ đồng bộ — thay đổi đang được lưu tạm cục bộ.</span>
              </div>
            )}

            {searchQuery && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 flex items-center justify-between text-xs text-blue-950">
                <span className="font-medium">
                  Đang lọc theo từ khóa: <strong className="font-semibold">&quot;{searchQuery}&quot;</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="font-semibold text-red-600 hover:underline cursor-pointer"
                >
                  Xóa lọc
                </button>
              </div>
            )}

            {!tripsLoaded ? (
              <div className="rounded-xl bg-white border border-neutral-200 p-12 text-center text-sm text-neutral-500 font-medium">
                Đang tải dữ liệu chuyến đi của bạn...
              </div>
            ) : currentTab === "trips" ? (
              <Suspense fallback={<TabLoadingFallback label="Đang tải danh sách chuyến đi..." />}>
                <TripsListView
                  trips={trips}
                  currentTrip={trip}
                  onSelectTrip={onSelectTrip}
                  onOpenCreateModal={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
                  onOpenJoinModal={onOpenJoinModal}
                  onEditTrip={onOpenEditTripModal}
                  onDeleteTrip={onDeleteTrip}
                  onCloneTrip={onCloneTrip}
                  readOnly={false}
                  currentUserUid={authUser.id}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery("")}
                />
              </Suspense>
            ) : !trip ? (
              renderEmptyState()
            ) : (
              <>
                {currentTab === "dashboard" && (
                  <div className="space-y-5">
                    {/* Compact Trip Overview Bar */}
                    <section className="rounded-xl bg-white border border-neutral-200 px-5 py-4 sm:px-6 sm:py-5">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-500">
                            <span className="font-semibold text-blue-700">
                              {isParticipant ? "Hành khách tham gia" : "Chủ chuyến đi"}
                            </span>
                            <span aria-hidden="true" className="text-neutral-300">
                              ·
                            </span>
                            <span className="tabular-nums">{trip.dates}</span>
                            <span aria-hidden="true" className="text-neutral-300">
                              ·
                            </span>
                            <span className="tabular-nums">{trip.totalDays} ngày</span>
                            {trip.vehicle && (
                              <>
                                <span aria-hidden="true" className="text-neutral-300">
                                  ·
                                </span>
                                <span>{trip.vehicle}</span>
                              </>
                            )}
                          </div>

                          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 truncate">
                            {trip.title}
                          </h2>

                          <p className="text-xs sm:text-sm text-neutral-500">
                            {trip.originFull} → {trip.destinationFull}
                            {isParticipant
                              ? " · Chế độ xem lịch trình, điểm danh bản thân và đăng ký người thân đi cùng."
                              : " · Theo dõi tiến độ lịch trình, tuyến đường và ngân sách tập trung."}
                          </p>
                        </div>

                        {isParticipant ? (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setCurrentTab("members")}
                              className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>
                                Thành viên &amp; Người thân{trip.joinCode ? ` (${trip.joinCode})` : ""}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCurrentTab("schedule")}
                              className="h-9 px-3.5 rounded-lg bg-white hover:bg-neutral-50 text-neutral-800 font-semibold text-xs border border-neutral-200 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                              <span>Xem lịch trình</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsAddActivityOpen(true)}
                              className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Thêm hoạt động</span>
                            </button>

                            <div className="relative" ref={toolsMenuRef}>
                              <button
                                type="button"
                                onClick={() => setIsToolsMenuOpen((prev) => !prev)}
                                aria-expanded={isToolsMenuOpen}
                                className="h-9 px-3.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white font-semibold text-xs border border-neutral-800 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                                <span>Công cụ lịch trình</span>
                                {canUndo && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-red-500"
                                    title="Có thay đổi có thể hoàn tác"
                                  />
                                )}
                                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                              </button>

                              {isToolsMenuOpen && (
                                <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white border border-neutral-200 shadow-lg py-1.5 z-30 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsToolsMenuOpen(false);
                                      (onOpenTraditionalPlanner || onOpenAIPlanner || (() => setIsAIPlannerOpen(true)))();
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-neutral-800 hover:bg-neutral-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                  >
                                    <CalendarPlus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>Lập lịch truyền thống</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsToolsMenuOpen(false);
                                      (onOpenAIPlanner || (() => setIsAIPlannerOpen(true)))();
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-neutral-800 hover:bg-neutral-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                  >
                                    <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>Lập lịch tự động</span>
                                  </button>

                                  {onOpenAutoArrange && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsToolsMenuOpen(false);
                                        onOpenAutoArrange();
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-neutral-800 hover:bg-neutral-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                    >
                                      <Clock className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                                      <span>Tự động xếp lịch</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsToolsMenuOpen(false);
                                      (onOpenAIOptimize || (() => setIsAIOptimizeOpen(true)))();
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-neutral-800 hover:bg-neutral-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                  >
                                    <Compass className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                    <span>Tối ưu chuyến đi</span>
                                  </button>

                                  {canUndo && onUndo && (
                                    <>
                                      <div className="my-1 border-t border-neutral-100" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsToolsMenuOpen(false);
                                          onUndo();
                                        }}
                                        className="w-full px-3.5 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2.5 font-semibold cursor-pointer"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                                        <span>Hoàn tác thay đổi lịch</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Metric Cards Row */}
                    <MetricCards
                      trip={trip}
                      onOpenMembers={() => setCurrentTab("members")}
                      onOpenBudget={() => setCurrentTab("budget")}
                      onOpenSchedule={() => setCurrentTab("schedule")}
                      onOpenMap={() => setCurrentTab("map")}
                      hideBudgetCard={isParticipant}
                    />

                    {/* Focused 2-Column Overview: Agenda Summary + Route/Alerts */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start min-w-0">
                      {/* Left Column: Compact Daily Agenda Preview */}
                      <section className="xl:col-span-7 min-w-0 rounded-xl bg-white border border-neutral-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-neutral-950">Lịch trình trong ngày</h3>
                            <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                              {activeOverviewDay
                                ? `Ngày ${activeOverviewDay.dayIndex}${activeOverviewDay.fullDate || activeOverviewDay.dateLabel ? ` · ${activeOverviewDay.fullDate || activeOverviewDay.dateLabel}` : ""} (${sortedOverviewActivities.length} hoạt động)`
                                : "Chưa có ngày lịch trình"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setCurrentTab("schedule")}
                            className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <span>Mở toàn bộ lịch trình</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {trip.days && trip.days.length > 0 && (
                          <div className="px-5 py-2.5 border-b border-neutral-100 bg-neutral-50/80 flex items-center gap-1.5 overflow-x-auto">
                            {trip.days.map((day) => {
                              const isSelected = day.dayIndex === (activeOverviewDay?.dayIndex ?? currentDayIndex);
                              return (
                                <button
                                  key={day.dayIndex}
                                  type="button"
                                  onClick={() => setCurrentDayIndex(day.dayIndex)}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer shrink-0 tabular-nums ${
                                    isSelected
                                      ? "bg-neutral-950 text-white"
                                      : "text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-950"
                                  }`}
                                >
                                  Ngày {day.dayIndex}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {sortedOverviewActivities.length === 0 ? (
                          <div className="p-8 text-center space-y-2.5">
                            <p className="text-xs text-neutral-500">
                              {searchQuery
                                ? `Không có hoạt động nào khớp với "${searchQuery}" trong ngày này.`
                                : "Chưa có hoạt động nào trong ngày này."}
                            </p>
                            {isTripOwner && !searchQuery && (
                              <button
                                type="button"
                                onClick={() => setIsAddActivityOpen(true)}
                                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
                              >
                                + Thêm hoạt động vào Ngày {activeOverviewDay?.dayIndex ?? currentDayIndex}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="divide-y divide-neutral-100">
                            {sortedOverviewActivities.map((act) => (
                              <button
                                key={act.id}
                                type="button"
                                onClick={() => setSelectedActivity(act)}
                                className="w-full px-5 py-3.5 text-left hover:bg-neutral-50 transition flex items-start gap-4 cursor-pointer"
                              >
                                <div className="w-24 shrink-0 font-mono text-xs font-semibold text-neutral-500 tabular-nums pt-0.5">
                                  {act.timeStart}
                                  {act.timeEnd ? ` – ${act.timeEnd}` : ""}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-neutral-950 truncate">
                                    {act.title}
                                  </div>
                                  <div className="text-xs text-neutral-500 truncate mt-0.5 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                                    <span className="truncate">{act.location}</span>
                                  </div>
                                </div>

                                <div className="shrink-0 text-right space-y-0.5">
                                  <div className={`text-xs font-semibold ${STATUS_TEXT_CLASS[act.status] || "text-neutral-600"}`}>
                                    {act.status}
                                  </div>
                                  {!isParticipant && (act.cost || 0) > 0 && (
                                    <div className="text-[11px] font-mono text-neutral-400 tabular-nums">
                                      {(act.cost || 0).toLocaleString("vi-VN")} ₫
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </section>

                      {/* Right Column: Compact Route & Weather Summary + Alerts/Optimize */}
                      <div className="xl:col-span-5 min-w-0 space-y-5">
                        <section className="rounded-xl bg-white border border-neutral-200 p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-bold text-neutral-950">Tuyến đường &amp; Thời tiết</h3>
                              <p className="text-xs text-neutral-500 mt-0.5">
                                {trip.originFull} → {trip.destinationFull}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCurrentTab("map")}
                              className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <span>Mở bản đồ</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-3 py-3 border-y border-neutral-100">
                            <div>
                              <div className="text-[11px] text-neutral-500">Chặng hoàn tất</div>
                              <div className="text-sm font-bold text-neutral-950 tabular-nums mt-0.5">
                                {overviewRouteSummary
                                  ? `${overviewRouteSummary.completedStops}/${overviewRouteSummary.totalStops} điểm`
                                  : `${trip.destinationsCount} điểm`}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-neutral-500">Tổng cự ly</div>
                              <div className="text-sm font-bold text-neutral-950 tabular-nums mt-0.5">
                                {overviewRouteSummary && overviewRouteSummary.totalRouteKm > 0
                                  ? `${overviewRouteSummary.totalRouteKm} km`
                                  : `${trip.totalKm || 0} km`}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] text-neutral-500">Thời gian chạy</div>
                              <div className="text-sm font-bold text-neutral-950 tabular-nums mt-0.5">
                                {overviewRouteSummary && overviewRouteSummary.totalTravelMinutes > 0
                                  ? formatTravelDuration(overviewRouteSummary.totalTravelMinutes)
                                  : "—"}
                              </div>
                            </div>
                          </div>

                          {overviewRouteSummary?.currentStop && (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-neutral-500 flex items-center gap-1.5">
                                  <Navigation className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                  <span>Điểm hiện tại</span>
                                </span>
                                <span className="font-semibold text-neutral-950 truncate max-w-[60%] text-right">
                                  {overviewRouteSummary.currentStop.name}
                                </span>
                              </div>
                              {overviewRouteSummary.nextStop && (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-neutral-500">Điểm kế tiếp</span>
                                  <span className="font-medium text-blue-700 truncate max-w-[60%] text-right">
                                    {overviewRouteSummary.nextStop.name}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {trip.weather && (trip.weather.description || trip.weather.temp > 0) && (
                            <div className="pt-3 border-t border-neutral-100 flex items-start justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2 text-neutral-600">
                                <CloudSun className="w-4 h-4 text-blue-600 shrink-0" />
                                <span>
                                  {trip.weather.description || "Thời tiết tuyến"}
                                  {trip.weather.rainProb ? ` · Mưa ${trip.weather.rainProb}` : ""}
                                </span>
                              </div>
                              {typeof trip.weather.temp === "number" && trip.weather.temp > 0 && (
                                <span className="font-mono font-bold text-neutral-950 tabular-nums shrink-0">
                                  {trip.weather.temp}°C
                                </span>
                              )}
                            </div>
                          )}
                        </section>

                        <OperationsPanel
                          trip={{ ...trip, alerts: visibleTripAlerts }}
                          unreadAlertCount={unreadAlertCount}
                          onOpenAlertsModal={handleOpenAlertsModal}
                          onOpenApplyAIPlan={onOpenAIOptimize || (() => setIsAIOptimizeOpen(true))}
                          isAIApplied={isAIApplied}
                          onScanAlerts={isTripOwner ? onScanAlerts : undefined}
                          isScanningAlerts={isScanningAlerts}
                          notificationsEnabled={notificationsEnabled}
                          onToggleNotifications={isTripOwner ? onToggleNotifications : undefined}
                          readOnly={isParticipant}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentTab === "schedule" && (
                  <div className="min-w-0 w-full">
                    <TimelineSchedule
                      days={trip.days}
                      currentDayIndex={currentDayIndex}
                      onSelectDay={setCurrentDayIndex}
                      onAddActivity={() => setIsAddActivityOpen(true)}
                      onSelectActivity={(act) => setSelectedActivity(act)}
                      filterMode={filterMode}
                      onToggleFilterMode={() => setFilterMode(filterMode === "timeline" ? "all" : "timeline")}
                      canAddActivity={isTripOwner}
                      searchQuery={searchQuery}
                      onClearSearch={() => setSearchQuery("")}
                      onUpdateStatus={isTripOwner ? handleUpdateActivityStatus : undefined}
                      onAddDay={isTripOwner ? handleAddDay : undefined}
                      onDeleteDay={isTripOwner ? handleDeleteDay : undefined}
                      onUpdateDayNote={isTripOwner ? handleUpdateDayNote : undefined}
                      onOpenAutoArrange={isTripOwner ? onOpenAutoArrange : undefined}
                      onOpenAIOptimize={
                        isTripOwner ? onOpenAIOptimize || (() => setIsAIOptimizeOpen(true)) : undefined
                      }
                    />
                  </div>
                )}

                {currentTab === "map" && (
                  <div className="w-full min-w-0">
                    <Suspense fallback={<TabLoadingFallback label="Đang tải bản đồ tuyến đường..." />}>
                      <LiveRouteMap
                        trip={trip}
                        onSelectWaypoint={onSelectWaypoint}
                        onUpdateTrip={isTripOwner ? handleUpdateTrip : undefined}
                        readOnly={isParticipant}
                        searchQuery={searchQuery}
                        onClearSearch={() => setSearchQuery("")}
                      />
                    </Suspense>
                  </div>
                )}

                {currentTab === "members" && (
                  <div className="w-full min-w-0">
                    <Suspense fallback={<TabLoadingFallback label="Đang tải danh sách thành viên..." />}>
                      <MembersView
                        key={trip.id}
                        tripId={trip.id}
                        members={trip.members}
                        onToggleStatus={handleToggleMemberAttendance}
                        onUpdateMembers={isTripOwner ? handleUpdateMembers : undefined}
                        searchQuery={searchQuery}
                        onClearSearch={() => setSearchQuery("")}
                        joinCode={trip.joinCode}
                        joinCodeEnabled={trip.joinCodeEnabled ?? true}
                        isTripOwner={isTripOwner}
                        currentUserUid={authUser.id}
                        onManageJoinCode={isTripOwner ? onManageJoinCode : undefined}
                        onAddGuestCompanion={onAddGuestCompanion}
                        onRemoveGuestCompanion={onRemoveGuestCompanion}
                        onOpenGuestModeWithCode={onOpenGuestModeWithCode}
                        onLeaveTrip={isParticipant ? onLeaveTrip : undefined}
                      />
                    </Suspense>
                  </div>
                )}

                {currentTab === "budget" &&
                  (isParticipant ? (
                    <div className="rounded-xl bg-white border border-neutral-200 p-8 text-center space-y-3">
                      <h3 className="text-base font-bold text-neutral-950">Thông tin ngân sách nội bộ</h3>
                      <p className="text-xs text-neutral-500 max-w-md mx-auto">
                        Ngân sách và chứng từ chi phí chỉ hiển thị cho chủ chuyến đi hoặc quản trị viên.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCurrentTab("dashboard")}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
                      >
                        Quay lại Tổng quan
                      </button>
                    </div>
                  ) : (
                    <div className="w-full min-w-0">
                      <Suspense fallback={<TabLoadingFallback label="Đang tải quản lý ngân sách..." />}>
                        <BudgetView
                          trip={trip}
                          onUpdateTripBudget={handleUpdateTripBudget}
                          searchQuery={searchQuery}
                          onClearSearch={() => setSearchQuery("")}
                        />
                      </Suspense>
                    </div>
                  ))}
              </>
            )}
          </main>
        </div>

        {trip && isTripOwner && isAIOptimizeOpen && (
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
        {trip && isTripOwner && isAddActivityOpen && (
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
              alerts={visibleTripAlerts}
              onDismissAlert={isTripOwner ? handleDismissAlert : undefined}
              onTriggerAI={
                isTripOwner
                  ? () => {
                      setIsAlertsModalOpen(false);
                      if (onOpenAIOptimize) {
                        onOpenAIOptimize();
                      } else {
                        setIsAIOptimizeOpen(true);
                      }
                    }
                  : undefined
              }
              onScanAlerts={isTripOwner ? onScanAlerts : undefined}
              isScanningAlerts={isScanningAlerts}
            />
          </Suspense>
        )}
        {selectedActivity && (
          <Suspense fallback={null}>
            <ActivityDetailModal
              activity={selectedActivity}
              onClose={() => setSelectedActivity(null)}
              onUpdateStatus={isTripOwner ? handleUpdateActivityStatus : undefined}
              onDeleteActivity={isTripOwner ? handleDeleteActivity : undefined}
              onEditActivity={isTripOwner ? handleEditActivity : undefined}
              canEdit={isTripOwner}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
