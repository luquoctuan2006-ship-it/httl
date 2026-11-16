/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { safeJsonResponse } from './api';
import { useAuthSession } from './hooks/useAuthSession';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useRealtimeAlertScanner } from './hooks/useRealtimeAlertScanner';
import { useTripActions } from './hooks/useTripActions';
import { useTripPersistence } from './hooks/useTripPersistence';
import type { Activity, GuestTripData, TripData } from './types/travel';
import {
  clearGuestCodeFromUrl,
  clearStoredGuestSession,
  extractGuestCodeFromUrl,
  loadStoredGuestSession,
  saveStoredGuestSession,
  type ActiveGuestSession,
} from './utils/guestSession';
import {
  isUserTripOwnerOrAdmin,
  isValidJoinCodeFormat,
  normalizeJoinCode,
} from './utils/tripJoinHelpers';

const AuthScreen = lazy(() =>
  import('./components/auth/AuthScreen').then((m) => ({ default: m.AuthScreen })),
);
const GuestTripView = lazy(() =>
  import('./components/guest/GuestTripView').then((m) => ({ default: m.GuestTripView })),
);
const AdminDashboard = lazy(() =>
  import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);
const UserDashboard = lazy(() =>
  import('./components/dashboard/UserDashboard').then((m) => ({ default: m.UserDashboard })),
);
const TripPlannerModal = lazy(() =>
  import('./components/modals/TripPlannerModal').then((m) => ({ default: m.TripPlannerModal })),
);
const AutoArrangeModal = lazy(() =>
  import('./components/modals/AutoArrangeModal').then((m) => ({ default: m.AutoArrangeModal })),
);
const EditTripModal = lazy(() =>
  import('./components/modals/EditTripModal').then((m) => ({ default: m.EditTripModal })),
);
const JoinTripModal = lazy(() =>
  import('./components/modals/JoinTripModal').then((m) => ({ default: m.JoinTripModal })),
);
const AccountModal = lazy(() =>
  import('./components/modals/AccountModal').then((m) => ({ default: m.AccountModal })),
);
const SyncConflictModal = lazy(() =>
  import('./components/modals/SyncConflictModal').then((m) => ({ default: m.SyncConflictModal })),
);

const FullPageLoadingFallback = ({ message = 'Đang tải giao diện...' }: { message?: string }) => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-300">
    {message}
  </div>
);

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
  const [isJoinTripModalOpen, setIsJoinTripModalOpen] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState<boolean>(false);
  const [tripToEdit, setTripToEdit] = useState<TripData | null>(null);
  const [urlGuestCode] = useState<string>(() => extractGuestCodeFromUrl());
  const [guestSession, setGuestSession] = useState<ActiveGuestSession | null>(null);
  const guestRestoreAttemptedRef = useRef<boolean>(false);
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

  const handleClearAuthAndGuest = useCallback(() => {
    setGuestSession((prev) => (prev?.enteredFromAccount ? null : prev));
    clearAuthUser();
  }, [clearAuthUser]);

  const persistence = useTripPersistence({
    authUserId,
    authUserRole: authUser?.role,
    isOnline,
    onClearAuthUser: handleClearAuthAndGuest,
    setCurrentDayIndex,
    showToast,
  });

  const canScanActiveTrip = Boolean(
    authUser &&
      persistence.trip &&
      isUserTripOwnerOrAdmin(persistence.trip, authUserId, authUser.role),
  );

  const {
    notificationsEnabled,
    isScanningAlerts,
    handleToggleNotifications,
    handleScanRealtimeAlerts,
  } = useRealtimeAlertScanner({
    authUserId,
    activeTripId: persistence.trip?.id,
    canScanAlerts: canScanActiveTrip,
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
    authUserRole: authUser?.role,
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
    ensureFullTrip: persistence.ensureFullTrip,
    applyAuthoritativeTripUpdate: persistence.applyAuthoritativeTripUpdate,
    removeTripFromLocalState: persistence.removeTripFromLocalState,
    performSignOutAndClearCache: persistence.performSignOutAndClearCache,
    setConflictState: persistence.setConflictState,
    saveQueueRef: persistence.saveQueueRef,
    lastSavedContentByTripIdRef: persistence.lastSavedContentByTripIdRef,
    latestServerVersionByTripIdRef: persistence.latestServerVersionByTripIdRef,
    showToast,
  });

  const handleOpenGuestModeWithCode = useCallback(
    async (rawCode: string, guestName?: string, enteredFromAccount = true) => {
      const cleanCode = normalizeJoinCode(rawCode);
      if (!isValidJoinCodeFormat(cleanCode)) {
        showToast('Mã tham gia chưa hợp lệ.', 'error');
        return;
      }

      try {
        const response = await fetch('/api/guest/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            joinCode: cleanCode,
            guestName: guestName?.trim() || undefined,
          }),
        });
        const result = await safeJsonResponse<{
          success?: boolean;
          error?: string;
          joinCode?: string;
          guestName?: string;
          trip?: GuestTripData;
        }>(response);

        if (!response.ok || !result?.success || !result.trip) {
          throw new Error(result?.error || 'Không thể mở giao diện Hành khách bằng mã này.');
        }

        const resolvedName = result.guestName || guestName?.trim() || 'Hành khách';
        const resolvedCode = result.joinCode || cleanCode;
        if (!enteredFromAccount) {
          saveStoredGuestSession(resolvedCode, resolvedName);
          clearGuestCodeFromUrl();
        }
        setGuestSession({
          joinCode: resolvedCode,
          guestName: resolvedName,
          trip: result.trip,
          enteredFromAccount,
        });
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Không thể mở giao diện Hành khách.', 'error');
      }
    },
    [showToast],
  );

  const handleRefreshGuestTrip = useCallback(async () => {
    if (!guestSession) return;
    try {
      const response = await fetch(
        `/api/guest/trip?code=${encodeURIComponent(guestSession.joinCode)}`,
      );
      const result = await safeJsonResponse<{
        success?: boolean;
        error?: string;
        trip?: GuestTripData;
      }>(response);
      if (!response.ok || !result?.success || !result.trip) {
        throw new Error(result?.error || 'Mã chuyến đi hiện đã đóng hoặc không còn hợp lệ.');
      }
      setGuestSession((prev) => (prev ? { ...prev, trip: result.trip! } : null));
      showToast('Đã làm mới lịch trình chuyến đi.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể làm mới lịch trình.', 'error');
    }
  }, [guestSession, showToast]);

  const handleExitGuestMode = useCallback(() => {
    clearStoredGuestSession();
    clearGuestCodeFromUrl();
    setGuestSession(null);
  }, []);

  useEffect(() => {
    if (authLoading || authUser || guestSession || guestRestoreAttemptedRef.current) return;
    guestRestoreAttemptedRef.current = true;
    const stored = loadStoredGuestSession();
    const codeToRestore = urlGuestCode || stored?.joinCode || '';
    if (!codeToRestore) return;

    const guestNameToUse = urlGuestCode ? '' : stored?.guestName || '';
    void handleOpenGuestModeWithCode(codeToRestore, guestNameToUse, false);
  }, [authLoading, authUser, guestSession, urlGuestCode, handleOpenGuestModeWithCode]);

  useEffect(() => {
    const adminExclusiveTabs = ['ai'];
    if (!isAdminMode && adminExclusiveTabs.includes(currentTab)) {
      setCurrentTab('dashboard');
      return;
    }
    if (
      authUser &&
      persistence.trip &&
      !isUserTripOwnerOrAdmin(persistence.trip, authUserId, authUser.role) &&
      currentTab === 'budget'
    ) {
      setCurrentTab('dashboard');
    }
  }, [isAdminMode, currentTab, authUser, authUserId, persistence.trip]);

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
    const adminExclusiveTabs = ['ai'];
    if (!isAdminMode && adminExclusiveTabs.includes(tab)) {
      setCurrentTab('dashboard');
      return;
    }
    setCurrentTab(tab);
  };

  if (guestSession) {
    return (
      <Suspense fallback={<FullPageLoadingFallback message="Đang tải giao diện Hành khách..." />}>
        <GuestTripView
          guestTrip={guestSession.trip}
          guestName={guestSession.guestName}
          joinCode={guestSession.joinCode}
          enteredFromAccount={guestSession.enteredFromAccount}
          onRefresh={handleRefreshGuestTrip}
          onExitGuestMode={handleExitGuestMode}
        />
      </Suspense>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-300">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (!authUser) {
    return (
      <Suspense fallback={<FullPageLoadingFallback message="Đang tải trang đăng nhập..." />}>
        <AuthScreen
          initialGuestCode={urlGuestCode}
          onEnterGuestTrip={({ joinCode, guestName, trip }) => {
            saveStoredGuestSession(joinCode, guestName);
            clearGuestCodeFromUrl();
            setGuestSession({
              joinCode,
              guestName,
              trip,
              enteredFromAccount: false,
            });
          }}
        />
      </Suspense>
    );
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
    onOpenJoinModal: () => setIsJoinTripModalOpen(true),
    onManageJoinCode: actions.handleManageJoinCode,
    onAddGuestCompanion: actions.handleAddGuestCompanion,
    onRemoveGuestCompanion: actions.handleRemoveGuestCompanion,
    onOpenGuestModeWithCode: (code: string, name?: string) =>
      handleOpenGuestModeWithCode(code, name, true),
    onLeaveTrip: actions.handleLeaveTrip,
  };

  return (
    <>
      <Suspense fallback={<FullPageLoadingFallback message="Đang tải tổng quan chuyến đi..." />}>
        {authUser.role === 'admin' ? (
          <AdminDashboard
            {...sharedDashboardProps}
            isAdminMode={isAdminMode}
            handleSelectTab={handleSelectTab}
            handleApplyGeneratedTrip={actions.handleApplyGeneratedTrip}
            onEnsureFullTrip={persistence.ensureFullTrip}
          />
        ) : (
          <UserDashboard {...sharedDashboardProps} />
        )}
      </Suspense>

      {persistence.hydratingTripId && (
        <div
          role="status"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900 text-teal-300 text-xs font-bold border border-teal-500/40 shadow-lg"
        >
          Đang tải chi tiết chuyến đi...
        </div>
      )}

      {/* Modal Lập lịch trình Đa năng — chỉ mount khi mở */}
      {isAIPlannerOpen && (
        <Suspense fallback={null}>
          <TripPlannerModal
            isOpen={isAIPlannerOpen}
            onClose={() => setIsAIPlannerOpen(false)}
            onApplyPlan={actions.handleApplyGeneratedTrip}
            initialTab={plannerInitialTab}
            owner={{ uid: authUser.id, name: authUser.name }}
          />
        </Suspense>
      )}

      {/* Modal Tự động Xếp lịch & Cân bằng thời gian — chỉ mount khi mở */}
      {isAutoArrangeOpen && persistence.trip && (
        <Suspense fallback={null}>
          <AutoArrangeModal
            isOpen={isAutoArrangeOpen}
            onClose={() => setIsAutoArrangeOpen(false)}
            currentDay={persistence.trip.days.find((d) => d.dayIndex === currentDayIndex) || persistence.trip.days[0]}
            trip={persistence.trip}
            onApplyDay={actions.handleApplyAutoArrangeDay}
            onApplyTrip={actions.handleApplyAutoArrangeTrip}
          />
        </Suspense>
      )}

      {/* Modal Chỉnh sửa thông tin chuyến đi — chỉ mount khi mở */}
      {isEditTripModalOpen && tripToEdit && (
        <Suspense fallback={null}>
          <EditTripModal
            isOpen={isEditTripModalOpen}
            onClose={() => setIsEditTripModalOpen(false)}
            trip={tripToEdit}
            onSave={actions.handleSaveEditedTrip}
          />
        </Suspense>
      )}

      {/* Modal Tham gia chuyến đi bằng mã mời — chỉ mount khi mở */}
      {isJoinTripModalOpen && (
        <Suspense fallback={null}>
          <JoinTripModal
            isOpen={isJoinTripModalOpen}
            onClose={() => setIsJoinTripModalOpen(false)}
            defaultDisplayName={authUser.name}
            onJoinTrip={actions.handleJoinTripByCode}
          />
        </Suspense>
      )}

      {/* Modal Quản lý tài khoản — chỉ mount khi mở */}
      {isAccountModalOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Modal xử lý xung đột đồng bộ phiên bản (409) — chỉ mount khi có xung đột */}
      {Boolean(persistence.conflictState) && (
        <Suspense fallback={null}>
          <SyncConflictModal
            localTrip={persistence.conflictState?.localTrip || null}
            serverTrip={persistence.conflictState?.serverTrip || null}
            isResolving={persistence.isResolvingConflict}
            onKeepLocal={() => void persistence.handleKeepLocalConflict()}
            onUseServer={persistence.handleUseServerConflict}
            onDismiss={() => persistence.setConflictState(null)}
          />
        </Suspense>
      )}

      {/* Modal cảnh báo khi đăng xuất còn dữ liệu ngoại tuyến chưa đồng bộ */}
      {persistence.isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
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
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold transition-all duration-300 bg-slate-900/95 text-white border-slate-700 animate-in fade-in slide-in-from-bottom-2"
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
