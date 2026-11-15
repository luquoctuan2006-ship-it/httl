/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { TripPlannerModal } from './components/modals/TripPlannerModal';
import { AutoArrangeModal } from './components/modals/AutoArrangeModal';
import { EditTripModal } from './components/modals/EditTripModal';
import { AccountModal } from './components/modals/AccountModal';
import { SyncConflictModal } from './components/modals/SyncConflictModal';
import { AuthScreen } from './components/auth/AuthScreen';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UserDashboard } from './components/dashboard/UserDashboard';
import { useAuthSession } from './hooks/useAuthSession';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useRealtimeAlertScanner } from './hooks/useRealtimeAlertScanner';
import { useTripActions } from './hooks/useTripActions';
import { useTripPersistence } from './hooks/useTripPersistence';
import type { Activity, TripData } from './types/travel';

export default function App() {
  const { authUser, authUserId, authLoading, clearAuthUser, updateAuthUserName } = useAuthSession();
  const isOnline = useOnlineStatus();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(1);
  const [filterMode, setFilterMode] = useState<'timeline' | 'all'>('timeline');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & toast state
  const [isAIPlannerOpen, setIsAIPlannerOpen] = useState<boolean>(false);
  const [plannerInitialTab, setPlannerInitialTab] = useState<'traditional' | 'ai'>('traditional');
  const [isAutoArrangeOpen, setIsAutoArrangeOpen] = useState<boolean>(false);
  const [isAIOptimizeOpen, setIsAIOptimizeOpen] = useState<boolean>(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState<boolean>(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState<boolean>(false);
  const [tripToEdit, setTripToEdit] = useState<TripData | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  const isAdminMode = authUser?.role === 'admin';

  const showToast = useCallback((
    text: string,
    type: 'success' | 'error' | 'info' = 'success',
    actionLabel?: string,
    onAction?: () => void,
  ) => {
    setToastMessage({ text, type, actionLabel, onAction });
    window.setTimeout(() => {
      setToastMessage((current) => (current?.text === text ? null : current));
    }, 4500);
  }, []);

  const persistence = useTripPersistence({
    authUserId,
    isOnline,
    onClearAuthUser: clearAuthUser,
    setCurrentDayIndex,
    showToast,
  });

  const {
    notificationsEnabled,
    isScanningAlerts,
    handleToggleNotifications,
    handleScanRealtimeAlerts,
  } = useRealtimeAlertScanner({
    authUserId,
    activeTripId: persistence.trip?.id,
    isOnline,
    loadedTripUserId: persistence.loadedTripUserId,
    hasConflict: Boolean(persistence.conflictState),
    latestTripRef: persistence.latestTripRef,
    lastSavedContentByTripIdRef: persistence.lastSavedContentByTripIdRef,
    latestServerVersionByTripIdRef: persistence.latestServerVersionByTripIdRef,
    saveQueueRef: persistence.saveQueueRef,
    setTrip: persistence.setTrip,
    setFirebaseStatus: persistence.setFirebaseStatus,
    saveTripToFirestore: persistence.saveTripToFirestore,
    showToast,
  });

  const actions = useTripActions({
    trip: persistence.trip,
    trips: persistence.trips,
    authUserId,
    currentDayIndex,
    setTrip: persistence.setTrip,
    setTrips: persistence.setTrips,
    setCurrentDayIndex,
    setCurrentTab,
    setSelectedActivity,
    tripToEdit,
    setTripToEdit,
    setIsEditTripModalOpen,
    setIsAIPlannerOpen,
    setPlannerInitialTab,
    setIsAutoArrangeOpen,
    setIsAIOptimizeOpen,
    saveTripToFirestore: persistence.saveTripToFirestore,
    executeTripPut: persistence.executeTripPut,
    fetchServerTripSnapshot: persistence.fetchServerTripSnapshot,
    performSignOutAndClearCache: persistence.performSignOutAndClearCache,
    setConflictState: persistence.setConflictState,
    saveQueueRef: persistence.saveQueueRef,
    lastSavedContentByTripIdRef: persistence.lastSavedContentByTripIdRef,
    latestServerVersionByTripIdRef: persistence.latestServerVersionByTripIdRef,
    showToast,
  });

  useEffect(() => {
    const adminExclusiveTabs = ['planning', 'rules', 'ai', 'monitoring', 'system'];
    if (!isAdminMode && adminExclusiveTabs.includes(currentTab)) {
      setCurrentTab('dashboard');
    }
  }, [isAdminMode, currentTab]);

  useEffect(() => {
    const trip = persistence.trip;
    if (trip?.days && trip.days.length > 0) {
      if (!trip.days.some((d) => d.dayIndex === currentDayIndex)) {
        const fallbackDay =
          trip.currentDay && trip.days.some((d) => d.dayIndex === trip.currentDay)
            ? trip.currentDay
            : trip.days[0].dayIndex;
        setCurrentDayIndex(fallbackDay);
      }
    }
  }, [persistence.trip, currentDayIndex]);

  const handleSelectTab = (tab: string) => {
    const adminExclusiveTabs = ['planning', 'rules', 'ai', 'monitoring', 'system'];
    if (!isAdminMode && adminExclusiveTabs.includes(tab)) {
      setCurrentTab('dashboard');
      return;
    }
    setCurrentTab(tab);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-300">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  const sharedDashboardProps = {
    trip: persistence.trip,
    trips: persistence.trips,
    tripsLoaded: persistence.tripsLoaded,
    onSelectTrip: actions.handleSelectTrip,
    currentTab,
    setCurrentTab,
    currentDayIndex,
    setCurrentDayIndex,
    filterMode,
    setFilterMode,
    searchQuery,
    setSearchQuery,
    firebaseStatus: persistence.firebaseStatus,
    isAIApplied: actions.isAIApplied,
    authUser,
    onLogout: persistence.handleLogout,
    onOpenAccount: () => setIsAccountModalOpen(true),
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
    handleApplyAIOptimization: actions.handleApplyAIOptimization,
    handleAddActivity: actions.handleAddActivity,
    handleUpdateActivityStatus: actions.handleUpdateActivityStatus,
    handleDeleteActivity: actions.handleDeleteActivity,
    handleEditActivity: actions.handleEditActivity,
    handleAddDay: actions.handleAddDay,
    handleDeleteDay: actions.handleDeleteDay,
    handleUpdateDayNote: actions.handleUpdateDayNote,
    handleToggleMemberAttendance: actions.handleToggleMemberAttendance,
    handleUpdateMembers: actions.handleUpdateMembers,
    handleUpdateTrip: actions.handleUpdateTrip,
    handleDismissAlert: actions.handleDismissAlert,
    handleUpdateTripBudget: actions.handleUpdateTripBudget,
    canUndo: Boolean(actions.lastOptimizedTripSnapshot),
    onUndo: actions.handleUndoOptimization,
    onOpenEditTripModal: actions.handleOpenEditTripModal,
    onDeleteTrip: actions.handleDeleteTrip,
    onCloneTrip: actions.handleCloneTrip,
    onSelectWaypoint: actions.handleSelectWaypoint,
    onScanAlerts: () => handleScanRealtimeAlerts(false),
    isScanningAlerts,
    notificationsEnabled,
    onToggleNotifications: () => void handleToggleNotifications(),
    pendingSyncCount: persistence.pendingSyncCount,
    cachedAt: persistence.cachedAt,
    onRetryOfflineSync: () => void persistence.syncPendingOfflineTrips(),
    onOpenAIPlanner: actions.handleOpenAIPlanner,
    onOpenAIOptimize: actions.handleOpenAIOptimize,
    onOpenAutoArrange: actions.handleOpenAutoArrange,
    onOpenTraditionalPlanner: actions.handleOpenTraditionalPlanner,
  };

  return (
    <>
      {authUser.role === 'admin' ? (
        <AdminDashboard
          {...sharedDashboardProps}
          isAdminMode={isAdminMode}
          handleSelectTab={handleSelectTab}
          handleApplyGeneratedTrip={actions.handleApplyGeneratedTrip}
        />
      ) : (
        <UserDashboard {...sharedDashboardProps} />
      )}

      {/* Modal Lập lịch trình Đa năng */}
      <TripPlannerModal
        isOpen={isAIPlannerOpen}
        onClose={() => setIsAIPlannerOpen(false)}
        onApplyPlan={actions.handleApplyGeneratedTrip}
        initialTab={plannerInitialTab}
      />

      {/* Modal Tự động Xếp lịch & Cân bằng thời gian */}
      {isAutoArrangeOpen && persistence.trip && (
        <AutoArrangeModal
          isOpen={isAutoArrangeOpen}
          onClose={() => setIsAutoArrangeOpen(false)}
          currentDay={persistence.trip.days.find((d) => d.dayIndex === currentDayIndex) || persistence.trip.days[0]}
          trip={persistence.trip}
          onApplyDay={actions.handleApplyAutoArrangeDay}
          onApplyTrip={actions.handleApplyAutoArrangeTrip}
        />
      )}

      {/* Modal Chỉnh sửa thông tin chuyến đi */}
      {isEditTripModalOpen && tripToEdit && (
        <EditTripModal
          isOpen={isEditTripModalOpen}
          onClose={() => setIsEditTripModalOpen(false)}
          trip={tripToEdit}
          onSave={actions.handleSaveEditedTrip}
        />
      )}

      {/* Modal Quản lý tài khoản */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        authUser={authUser}
        onProfileUpdated={updateAuthUserName}
        onAccountDeleted={() => {
          setIsAccountModalOpen(false);
          void persistence.performSignOutAndClearCache(authUserId);
        }}
        onShowToast={(text, type) => showToast(text, type)}
      />

      {/* Modal xử lý xung đột đồng bộ phiên bản (409) */}
      <SyncConflictModal
        localTrip={persistence.conflictState?.localTrip || null}
        serverTrip={persistence.conflictState?.serverTrip || null}
        isResolving={persistence.isResolvingConflict}
        onKeepLocal={() => void persistence.handleKeepLocalConflict()}
        onUseServer={persistence.handleUseServerConflict}
        onDismiss={() => persistence.setConflictState(null)}
      />

      {/* Modal cảnh báo khi đăng xuất còn dữ liệu ngoại tuyến chưa đồng bộ */}
      {persistence.isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-rose-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-rose-600 text-white flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <h3 className="text-sm font-extrabold">Cảnh báo dữ liệu chưa đồng bộ</h3>
                <p className="text-[11px] text-rose-100">Đăng xuất sẽ xóa bộ nhớ đệm ngoại tuyến trên máy</p>
              </div>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-700 leading-relaxed">
              <p>
                Hiện vẫn còn <strong>{Math.max(1, persistence.pendingSyncCount)} thay đổi</strong> đang lưu tạm trên thiết bị chưa được đồng bộ lên máy chủ. Để tránh lộ dữ liệu đoàn khách và ảnh chứng từ, thao tác đăng xuất sẽ xóa sạch cache ngoại tuyến khỏi trình duyệt này.
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => persistence.setIsLogoutConfirmOpen(false)}
                  disabled={persistence.isSyncingBeforeLogout}
                  className="px-3.5 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                {isOnline && (
                  <button
                    type="button"
                    onClick={() => void persistence.handleSyncAndLogout()}
                    disabled={persistence.isSyncingBeforeLogout}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition disabled:opacity-50"
                  >
                    {persistence.isSyncingBeforeLogout ? 'Đang đồng bộ...' : 'Đồng bộ rồi đăng xuất'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void persistence.performSignOutAndClearCache()}
                  disabled={persistence.isSyncingBeforeLogout}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition disabled:opacity-50"
                >
                  Vẫn đăng xuất &amp; Xóa cache
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold transition-all duration-300 backdrop-blur-md bg-slate-900/95 text-white border-slate-700 animate-in fade-in slide-in-from-bottom-2"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              toastMessage.type === 'error'
                ? 'bg-rose-500'
                : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <span className="flex-1">{toastMessage.text}</span>
          {toastMessage.onAction && (
            <button
              onClick={() => {
                toastMessage.onAction?.();
                setToastMessage(null);
              }}
              className="ml-2 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{toastMessage.actionLabel || 'Hoàn tác'}</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
