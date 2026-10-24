/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { LiveRouteMap } from './components/LiveRouteMap';
import { OperationsPanel } from './components/OperationsPanel';
import { TimelineSchedule } from './components/TimelineSchedule';
import { AIPlannerModal } from './components/AIPlannerModal';
import { AIOptimizeModal } from './components/AIOptimizeModal';
import { AddActivityModal } from './components/AddActivityModal';
import { AlertsListModal } from './components/AlertsListModal';
import { ActivityDetailModal } from './components/ActivityDetailModal';
import { TripsListView } from './components/TripsListView';
import { EditTripModal } from './components/EditTripModal';
import { detectScheduleAndWeatherAlerts } from './utils/alertDetector';
import { MembersView } from './components/MembersView';
import { BudgetView } from './components/BudgetView';
import {
  AdminDashboardView,
  AdminUsersManagementView,
  AdminPlanningDataView,
  AdminDispatchRulesView,
  AdminAIManagementView,
  AdminScheduleMonitoringView,
  AdminSystemManagementView,
} from './components/AdminManagementViews';
import { initialTripData } from './data/mockData';
import { normalizeTripData } from './data/normalizeTripData';
import { TripData, Activity, TripMember } from './types/travel';
import { authenticatedFetch, safeJsonResponse } from './api';
import { applyScheduleChangesStrict, filterAlertsByRecommendation } from './utils/applyOptimization';
import { RotateCcw } from 'lucide-react';
import {
  db,
  firebaseAuth,
  firebaseAuthConfigured,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from './firebase';

type AppRole = 'user' | 'admin';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setMessage('Vui lòng nhập định dạng email hợp lệ.');
      setIsSubmitting(false);
      return;
    }

    if (cleanPassword.length < 6) {
      setMessage('Mật khẩu phải có ít nhất 6 ký tự.');
      setIsSubmitting(false);
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setMessage('Vui lòng nhập họ và tên của bạn.');
      setIsSubmitting(false);
      return;
    }

    if (!firebaseAuth) {
      setMessage('Hệ thống chưa cấu hình Firebase Auth nên chưa thể đăng nhập.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(firebaseAuth, cleanEmail, cleanPassword);
      } else {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, cleanPassword);
        try {
          await updateProfile(credential.user, { displayName: name.trim() });
        } catch {}
      }
    } catch (error: any) {
      console.warn('Firebase auth failed:', error?.code);
      setMessage(
        mode === 'login'
          ? 'Email hoặc mật khẩu không đúng.'
          : 'Không thể tạo tài khoản. Email có thể đã được sử dụng.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/60">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-xl font-black text-white shadow-lg shadow-teal-600/30">
            V
          </div>
          <h1 className="text-2xl font-black text-white">Voyager Travel Ops</h1>
          <p className="mt-2 text-sm text-slate-400">{mode === 'login' ? 'Đăng nhập vào hệ thống' : 'Tạo tài khoản mới'}</p>
        </div>


        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setEmail('');
              setPassword('');
              setMessage('');
            }}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${mode === 'login' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-300 hover:text-white'}`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setName('');
              setEmail('');
              setPassword('');
              setMessage('');
            }}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${mode === 'register' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-300 hover:text-white'}`}
          >
            Đăng ký
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Họ tên</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-teal-500"
                placeholder="Nguyễn Văn A"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-teal-500"
              placeholder="email@example.com"
            />
            {mode === 'register' && (
              <p className="mt-1 text-[11px] text-slate-400">
                * Mẹo: Email có đuôi <code className="text-teal-400 font-mono">@voyager.vn</code> hoặc chứa <code className="text-teal-400 font-mono">admin</code> sẽ nhận quyền <strong>Admin</strong>. Email khác nhận quyền <strong>User</strong>.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-teal-500"
              placeholder="••••••••"
            />
          </div>

          {message && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-300 flex items-start gap-2">
              <span>⚠️</span>
              <span>{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-teal-900/30 active:scale-98"
          >
            {isSubmitting ? 'Đang xác thực...' : mode === 'login' ? 'Đăng nhập vào hệ thống' : 'Tạo tài khoản & Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}

function hasMojibake(value: unknown): boolean {
  if (typeof value === 'string') {
    // Chỉ bắt lỗi mã hóa thật (UTF-8 bị đọc thành Latin-1); không báo nhầm chữ Â, Ã, Õ hay dấu "?" hợp lệ
    return /�|Ã[\u0080-\u00BF]|Â[\u00A0-\u00BF]|á[»º]/.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMojibake(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasMojibake(item));
  }

  return false;
}

function sanitizeTripData<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (hasMojibake(value)) {
    return initialTripData as T;
  }
  return value;
}

export default function App() {
  const [trip, setTrip] = useState<TripData>(initialTripData);
  const [trips, setTrips] = useState<TripData[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(3); // Day 3 (T4 14) matching screenshot
  const [filterMode, setFilterMode] = useState<'timeline' | 'all'>('timeline');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAIApplied, setIsAIApplied] = useState<boolean>(false);
  const [loadedTripUserId, setLoadedTripUserId] = useState<string | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const isAdminMode = authUser?.role === 'admin';

  useEffect(() => {
    void testFirestoreConnection();
  }, []);

  useEffect(() => {
    if (!firebaseAuth) {
      setAuthLoading(false);
      return;
    }

    return onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setAuthLoading(false);
        return;
      }

      try {
        // Quyền admin chỉ lấy từ custom claim `role` đã được Firebase ký.
        const token = await user.getIdTokenResult();
        setAuthUser({
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Người dùng',
          email: user.email || '',
          role: token.claims.role === 'admin' ? 'admin' : 'user',
        });
      } catch {
        setAuthUser(null);
      } finally {
        setAuthLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    const adminExclusiveTabs = ['planning', 'rules', 'ai', 'monitoring', 'system'];
    if (!isAdminMode && adminExclusiveTabs.includes(currentTab)) {
      setCurrentTab('dashboard');
    }
  }, [isAdminMode, currentTab]);

  useEffect(() => {
    if (trip.days && trip.days.length > 0) {
      if (!trip.days.some((d) => d.dayIndex === currentDayIndex)) {
        const fallbackDay =
          trip.currentDay && trip.days.some((d) => d.dayIndex === trip.currentDay)
            ? trip.currentDay
            : trip.days[0].dayIndex;
        setCurrentDayIndex(fallbackDay);
      }
    }
  }, [trip, currentDayIndex]);

  const handleSelectTab = (tab: string) => {
    const adminExclusiveTabs = ['planning', 'rules', 'ai', 'monitoring', 'system'];
    if (!isAdminMode && adminExclusiveTabs.includes(tab)) {
      setCurrentTab('dashboard');
      return;
    }

    setCurrentTab(tab);
  };

  useEffect(() => {
    let cancelled = false;

    if (!authUser) return;
    setFirebaseStatus('loading');
    // Đổi tài khoản: bỏ ngay dữ liệu của người trước và chặn autosave cho tới khi nạp xong
    setTrips([]);
    setLoadedTripUserId(null);

    const loadFromApi = async () => {
      try {
        // Server chỉ trả về các chuyến của chính user này (admin: tất cả)
        const response = await authenticatedFetch('/api/trips');
        if (!response.ok) throw new Error('Không thể tải dữ liệu chuyến đi');
        const { activeTrip, trips: savedTrips } = await safeJsonResponse(response);
        if (cancelled || !activeTrip) return;

        const correctedTrip = normalizeTripData(activeTrip);
        const correctedTrips = Array.isArray(savedTrips)
          ? savedTrips.map(normalizeTripData)
          : [correctedTrip];
        setTrips(correctedTrips);
        setTrip(correctedTrip);
        setCurrentDayIndex(correctedTrip.currentDay || 1);
        setFirebaseStatus('connected');
        setLoadedTripUserId(authUser.id);
      } catch (error) {
        if (cancelled) return;
        console.error('Trip loading error:', error);
        setFirebaseStatus('error');
      }
    };

    void loadFromApi();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || loadedTripUserId !== authUser.id) return;

    const timeout = window.setTimeout(() => {
      const saveTrip = async () => {
        try {
          const normalized = normalizeTripData(trip);
          const response = await authenticatedFetch(`/api/trips/${encodeURIComponent(normalized.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(normalized),
          });
          if (!response.ok) throw new Error('Không thể lưu dữ liệu chuyến đi');
          setTrips((prev) => prev.map((item) => (item.id === normalized.id ? normalized : item)));
          setFirebaseStatus('connected');
        } catch (error) {
          console.error('Trip save error:', error);
          setFirebaseStatus('error');
        }
      };

      void saveTrip();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [trip, authUser, loadedTripUserId]);

  // Modals state
  const [isAIPlannerOpen, setIsAIPlannerOpen] = useState<boolean>(false);
  const [isAIOptimizeOpen, setIsAIOptimizeOpen] = useState<boolean>(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState<boolean>(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [lastOptimizedTripSnapshot, setLastOptimizedTripSnapshot] = useState<TripData | null>(null);
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState<boolean>(false);
  const [tripToEdit, setTripToEdit] = useState<TripData | null>(null);
  const [isScanningAlerts, setIsScanningAlerts] = useState<boolean>(false);

  const showToast = (
    text: string,
    type: 'success' | 'error' | 'info' = 'success',
    actionLabel?: string,
    onAction?: () => void,
  ) => {
    setToastMessage({ text, type, actionLabel, onAction });
    window.setTimeout(() => {
      setToastMessage((current) => (current?.text === text ? null : current));
    }, 4500);
  };

  const saveTripToFirestore = async (updatedTrip: TripData, successMessage?: string) => {
    const normalizedTrip = normalizeTripData(updatedTrip);
    setTrip(normalizedTrip);
    setFirebaseStatus('loading');

    try {
      const response = await authenticatedFetch(`/api/trips/${encodeURIComponent(normalizedTrip.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedTrip),
      });
      const result = await safeJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Lỗi lưu chuyến đi');
      }
      setTrips((prev) => prev.map((item) => (item.id === normalizedTrip.id ? normalizedTrip : item)));
      setFirebaseStatus('connected');

      if (successMessage) showToast(successMessage, 'success');
    } catch (error) {
      console.error('All trip save methods failed:', error);
      setFirebaseStatus('error');
      showToast('Lỗi khi lưu chuyến đi, vui lòng thử lại', 'error');
    }
  };

  // Handler: Hoàn tác phương án tối ưu (Undo Optimization)
  const handleUndoOptimization = async () => {
    if (!lastOptimizedTripSnapshot) {
      showToast('Không có phương án nào để hoàn tác', 'info');
      return;
    }
    const previous = structuredClone(lastOptimizedTripSnapshot);
    setLastOptimizedTripSnapshot(null);
    setIsAIApplied(false);
    setTrip(previous);
    await saveTripToFirestore(previous, 'Đã hoàn tác phương án tối ưu thành công!');
  };

  // Handler: Mở modal chỉnh sửa thông tin chuyến đi
  const handleOpenEditTripModal = (tripTarget?: TripData) => {
    setTripToEdit(tripTarget || trip);
    setIsEditTripModalOpen(true);
  };

  // Handler: Lưu thông tin chuyến đi sau khi chỉnh sửa
  const handleSaveEditedTrip = async (updatedFields: Partial<TripData>) => {
    const target = tripToEdit || trip;
    const merged: TripData = {
      ...target,
      ...updatedFields,
    };
    await saveTripToFirestore(merged, 'Đã cập nhật thông tin chuyến đi thành công!');
    if (target.id === trip.id) {
      setTrip(merged);
    }
    setTrips((prev) => prev.map((t) => (t.id === target.id ? merged : t)));
    setIsEditTripModalOpen(false);
  };

  // Handler: Xóa chuyến đi
  const handleDeleteTrip = async (tripId: string) => {
    try {
      const response = await authenticatedFetch(`/api/trips/${encodeURIComponent(tripId)}`, {
        method: 'DELETE',
      });
      const result = await safeJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Lỗi khi xóa chuyến đi');
      }

      const nextTrips = trips.filter((t) => t.id !== tripId);
      setTrips(nextTrips);

      if (trip.id === tripId) {
        if (nextTrips.length > 0) {
          setTrip(nextTrips[0]);
        } else if (result.activeTrip) {
          setTrip(result.activeTrip);
        } else {
          // Khởi tạo chuyến mới nếu xóa hết
          const safeUid = authUser?.id || 'user';
          const freshTrip: TripData = {
            ...initialTripData,
            id: `trip-${Date.now()}-${safeUid}`,
            ownerId: safeUid,
            title: 'Chuyến đi mới chưa đặt tên',
            code: `VN-${Math.floor(1000 + Math.random() * 9000)}`,
            days: initialTripData.days,
          };
          setTrip(freshTrip);
          setTrips([freshTrip]);
        }
      }

      showToast(result.message || 'Đã xóa chuyến đi thành công', 'success');
    } catch (error: any) {
      console.error('Delete trip error:', error);
      showToast(error.message || 'Không thể xóa chuyến đi', 'error');
    }
  };

  // Handler: Tự động quét và cập nhật cảnh báo vận hành thời gian thực
  const handleScanRealtimeAlerts = async () => {
    setIsScanningAlerts(true);
    try {
      const detected = detectScheduleAndWeatherAlerts(trip);
      const updated: TripData = {
        ...trip,
        alerts: detected,
      };
      await saveTripToFirestore(updated);
      showToast(`Đã quét tự động: phát hiện ${detected.length} cảnh báo vận hành thực tế!`, 'success');
    } catch (error: any) {
      console.error('Scan alerts error:', error);
      showToast('Lỗi khi quét cảnh báo', 'error');
    } finally {
      setIsScanningAlerts(false);
    }
  };

  // Handler: Kiểm tra quyền Admin khi mở modal AI Planner
  const handleOpenAIPlanner = () => {
    if (!isAdminMode) {
      showToast('Chỉ tài khoản Admin điều phối mới có quyền gọi Gemini AI tạo tour để bảo toàn hạn ngạch.', 'info');
      return;
    }
    setIsAIPlannerOpen(true);
  };

  // Handler: Kiểm tra quyền Admin khi mở modal AI Optimize
  const handleOpenAIOptimize = () => {
    if (!isAdminMode) {
      showToast('Chỉ tài khoản Admin điều phối mới có quyền gọi Gemini AI tối ưu lịch trình.', 'info');
      return;
    }
    setIsAIOptimizeOpen(true);
  };

  // Handler: Apply AI / Rule-based Optimization
  // Tuân thủ: Ghép thay đổi CHỈ theo activityId duy nhất; chỉ xóa cảnh báo thực sự được xử lý.
  const handleApplyAIOptimization = async (
    actionTitle?: string,
    actionReason?: string,
    costSaved?: string,
    recommendationData?: any
  ) => {
    // 1. Lưu bản chụp trạng thái chuyến đi trước khi tối ưu để có thể hoàn tác (Undo)
    setLastOptimizedTripSnapshot(structuredClone(trip));

    const targetDayIndex =
      recommendationData?.targetDayIndex ??
      trip.days.find((d) => d.hasWarning || d.pendingCount > 0)?.dayIndex ??
      currentDayIndex;

    const scheduleChanges: any[] = Array.isArray(recommendationData?.scheduleChanges)
      ? recommendationData.scheduleChanges
      : [];

    let allChangedActivities: Activity[] = [];

    const updatedDays = trip.days.map((day) => {
      if (day.dayIndex === targetDayIndex) {
        // GHÉP THAY ĐỔI DUY NHẤT THEO activityId
        const { updatedDay, changedActivities } = applyScheduleChangesStrict(
          day,
          scheduleChanges,
          actionTitle,
          actionReason,
        );
        allChangedActivities = changedActivities;
        return updatedDay;
      }
      return day;
    });

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;

    // LỌC CẢNH BÁO: CHỈ XÓA CẢNH BÁO MÀ ĐỀ XUẤT THỰC SỰ XỬ LÝ (giữ nguyên cảnh báo khác)
    const { remainingAlerts, resolvedAlerts } = filterAlertsByRecommendation(
      trip.alerts,
      recommendationData || { actionTitle, reason: actionReason, scheduleChanges },
      allChangedActivities,
      targetDayIndex,
    );

    const savingsNumber =
      Number(costSaved?.replace(/\D/g, '')) ||
      Number(trip.aiSavingsEstimate?.replace(/\D/g, '')) ||
      320000;

    const updatedTrip: TripData = {
      ...trip,
      alerts: remainingAlerts,
      days: updatedDays,
      budgetRemaining: trip.budgetRemaining + savingsNumber,
      aiSavingsEstimate: costSaved || trip.aiSavingsEstimate,
      confirmedActivities: confirmed,
      pendingActivities: pending,
    };

    setIsAIApplied(true);
    await saveTripToFirestore(updatedTrip);

    showToast(
      `Đã áp dụng điều phối Ngày ${targetDayIndex} (đã xử lý ${resolvedAlerts.length} cảnh báo)!`,
      'success',
      'Hoàn tác',
      () => void handleUndoOptimization(),
    );
  };

  // Handler: Add Activity
  const handleAddActivity = async (newAct: Activity, targetDayIndex?: number) => {
    const dayTarget = targetDayIndex ?? currentDayIndex;
    let dayMatched = false;
    const updatedDays = trip.days.map((d) => {
      if (d.dayIndex === dayTarget) {
        dayMatched = true;
        const newActivities = [...d.activities, newAct];
        return {
          ...d,
          activities: newActivities,
          confirmedCount: newActivities.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length,
          pendingCount: newActivities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
        };
      }
      return d;
    });

    if (!dayMatched && updatedDays.length > 0) {
      const firstDayActs = [...updatedDays[0].activities, newAct];
      updatedDays[0] = {
        ...updatedDays[0],
        activities: firstDayActs,
        confirmedCount: firstDayActs.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length,
        pendingCount: firstDayActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
      };
    }

    const allActs = updatedDays.flatMap((d) => d.activities);
    const totalActivityCosts = allActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const newSpent = totalActivityCosts > 0 ? totalActivityCosts : trip.budgetUsed + (newAct.cost || 0);
    const newRemaining = Math.max(0, trip.budgetTotal - newSpent);
    const newPercent = trip.budgetTotal > 0 ? Math.min(100, Math.round((newSpent / trip.budgetTotal) * 100)) : 0;
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;

    const updatedTrip: TripData = {
      ...trip,
      totalActivities: allActs.length,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
      days: updatedDays,
    };

    await saveTripToFirestore(updatedTrip, `Đã thêm hoạt động "${newAct.title}" vào Firestore!`);
  };

  // Handler: Add New Day
  const handleAddDay = async () => {
    const nextDayIndex = trip.days.length > 0 ? Math.max(...trip.days.map((d) => d.dayIndex)) + 1 : 1;
    const dayNamesCycle = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const dayName = dayNamesCycle[(nextDayIndex - 1) % 7];
    const newDay = {
      dayIndex: nextDayIndex,
      dateLabel: `${dayName} ${nextDayIndex}`,
      dayName,
      dateNum: nextDayIndex,
      fullDate: `Ngày ${nextDayIndex}`,
      confirmedCount: 0,
      pendingCount: 0,
      dispatcherNote: 'Chặng mới được thêm vào lịch trình',
      activities: [],
    };
    const updatedDays = [...trip.days, newDay];
    const updatedTrip: TripData = {
      ...trip,
      totalDays: updatedDays.length,
      days: updatedDays,
    };
    setCurrentDayIndex(nextDayIndex);
    await saveTripToFirestore(updatedTrip, `Đã thêm Ngày ${nextDayIndex} vào lịch trình!`);
  };

  // Handler: Delete Day
  const handleDeleteDay = async (dayIndexToDelete: number) => {
    if (trip.days.length <= 1) {
      showToast('Hành trình cần ít nhất 1 ngày!', 'error');
      return;
    }
    const updatedDays = trip.days
      .filter((d) => d.dayIndex !== dayIndexToDelete)
      .map((d, idx) => ({
        ...d,
        dayIndex: idx + 1,
      }));
    const allActs = updatedDays.flatMap((d) => d.activities);
    const totalActivityCosts = allActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const newSpent = totalActivityCosts;
    const newRemaining = Math.max(0, trip.budgetTotal - newSpent);
    const newPercent = trip.budgetTotal > 0 ? Math.min(100, Math.round((newSpent / trip.budgetTotal) * 100)) : 0;

    const updatedTrip: TripData = {
      ...trip,
      totalDays: updatedDays.length,
      days: updatedDays,
      totalActivities: allActs.length,
      confirmedActivities: allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length,
      pendingActivities: allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
      currentDay: Math.min(currentDayIndex, updatedDays.length),
    };
    setCurrentDayIndex((prev) => Math.min(prev, updatedDays.length));
    await saveTripToFirestore(updatedTrip, `Đã xóa Ngày ${dayIndexToDelete} khỏi lịch trình!`);
  };

  // Handler: Update Day Note
  const handleUpdateDayNote = async (dayIndex: number, note: string) => {
    const updatedDays = trip.days.map((d) => (d.dayIndex === dayIndex ? { ...d, dispatcherNote: note } : d));
    const updatedTrip: TripData = { ...trip, days: updatedDays };
    await saveTripToFirestore(updatedTrip, `Đã lưu ghi chú Ngày ${dayIndex}!`);
  };

  // Handler: Update Activity status
  const handleUpdateActivityStatus = async (id: string, newStatus: Activity['status']) => {
    let activityTitle = '';
    const updatedDays = trip.days.map((d) => ({
      ...d,
      activities: d.activities.map((a) => {
        if (a.id === id) {
          activityTitle = a.title;
          return { ...a, status: newStatus };
        }
        return a;
      }),
    }));

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;

    const updatedTrip: TripData = {
      ...trip,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      days: updatedDays,
    };

    await saveTripToFirestore(
      updatedTrip,
      `Đã chuyển "${activityTitle || 'Hoạt động'}" sang "${newStatus}" trên Firestore!`
    );
  };

  // Handler: Delete Activity
  const handleDeleteActivity = async (id: string) => {
    let deletedTitle = '';
    const updatedDays = trip.days.map((d) => {
      const remaining = d.activities.filter((a) => {
        if (a.id === id) {
          deletedTitle = a.title;
          return false;
        }
        return true;
      });
      return { ...d, activities: remaining };
    });

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;
    const totalActivityCosts = allActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const newSpent = totalActivityCosts;
    const newRemaining = Math.max(0, trip.budgetTotal - newSpent);
    const newPercent = trip.budgetTotal > 0 ? Math.min(100, Math.round((newSpent / trip.budgetTotal) * 100)) : 0;

    const updatedTrip: TripData = {
      ...trip,
      totalActivities: allActs.length,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
      days: updatedDays,
    };

    await saveTripToFirestore(
      updatedTrip,
      `Đã xóa hoạt động "${deletedTitle || id}" trên Firestore!`
    );
  };

  // Handler: Edit Activity
  const handleEditActivity = async (updatedActivity: Activity) => {
    const updatedDays = trip.days.map((d) => ({
      ...d,
      activities: d.activities.map((a) => (a.id === updatedActivity.id ? updatedActivity : a)),
    }));

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;
    const totalActivityCosts = allActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const newSpent = totalActivityCosts;
    const newRemaining = Math.max(0, trip.budgetTotal - newSpent);
    const newPercent = trip.budgetTotal > 0 ? Math.min(100, Math.round((newSpent / trip.budgetTotal) * 100)) : 0;

    const updatedTrip: TripData = {
      ...trip,
      totalActivities: allActs.length,
      confirmedActivities: confirmed,
      pendingActivities: pending,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
      days: updatedDays,
    };

    await saveTripToFirestore(
      updatedTrip,
      `Đã cập nhật hoạt động "${updatedActivity.title}" trên Firestore!`
    );
  };

  // Handler: Toggle Member Attendance
  // Chỉ cập nhật đúng 1 thành viên qua PATCH (không ghi đè cả chuyến đi); lỗi mới dùng lưu toàn bộ làm dự phòng.
  const handleToggleMemberAttendance = async (id: string) => {
    const member = trip.members.find((item) => item.id === id);
    if (!member) return;

    const attendanceStatus: TripMember['attendanceStatus'] = member.attendanceStatus === 'Có mặt' ? 'Vắng mặt' : 'Có mặt';
    const tripId = trip.id;

    try {
      const response = await authenticatedFetch(
        `/api/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(id)}/attendance`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendanceStatus }),
        },
      );
      const result = await safeJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Không thể lưu điểm danh');
      }

      // Cập nhật theo state mới nhất để không làm mất các thay đổi khác
      setTrip((prev) => {
        if (prev.id !== tripId) return prev;
        const members = prev.members.map((item) => (item.id === id ? { ...item, attendanceStatus } : item));
        const presentCount = members.filter((item) => item.attendanceStatus === 'Có mặt').length;
        return { ...prev, members, membersStatus: `${presentCount}/${members.length} đã điểm danh` };
      });
      showToast(`Đã lưu điểm danh: ${member.name} (${attendanceStatus})`, 'success');
    } catch (error) {
      console.warn('PATCH điểm danh thất bại, chuyển sang lưu toàn bộ chuyến đi:', error);
      const updatedMembers = trip.members.map((item) => (item.id === id ? { ...item, attendanceStatus } : item));
      const presentCount = updatedMembers.filter((item) => item.attendanceStatus === 'Có mặt').length;
      await saveTripToFirestore(
        { ...trip, members: updatedMembers, membersStatus: `${presentCount}/${updatedMembers.length} đã điểm danh` },
        `Đã lưu điểm danh: ${member.name} (${attendanceStatus})`,
      );
    }
  };

  // Handler: Update Trip Budget
  const handleUpdateTripBudget = async (updatedTrip: TripData) => {
    await saveTripToFirestore(updatedTrip, 'Đã cập nhật ngân sách chuyến đi trên Firestore!');
  };

  // Handler: Update Trip Members list (Add, Edit, Delete)
  // Đồng bộ "tài xế phụ trách xe" (telematics) với thành viên có vai trò "Tài xế".
  const handleUpdateMembers = async (updatedMembers: TripMember[]) => {
    const presentCount = updatedMembers.filter((item) => item.attendanceStatus === 'Có mặt').length;
    const membersStatus = `${presentCount}/${updatedMembers.length} đã điểm danh`;

    const drivers = updatedMembers.filter((m) => m.role === 'Tài xế');
    const wasLinked = Boolean(trip.telematics.driverMemberId);
    const noDriverYet = !trip.telematics.driver || trip.telematics.driver === 'Chưa phân công';
    const assigned =
      drivers.find((m) => m.id === trip.telematics.driverMemberId) ||
      drivers.find((m) => m.name === trip.telematics.driver) ||
      (wasLinked || noDriverYet ? drivers[0] : undefined);

    const { driverMemberId: _previousDriverId, ...baseTelematics } = trip.telematics;
    let telematics: TripData['telematics'] = trip.telematics;
    if (assigned) {
      telematics = { ...baseTelematics, driver: assigned.name, driverPhone: assigned.phone, driverMemberId: assigned.id };
    } else if (wasLinked) {
      // Tài xế đã liên kết bị xóa hoặc đổi vai trò và không còn tài xế nào khác
      telematics = { ...baseTelematics, driver: 'Chưa phân công', driverPhone: '' };
    }

    const updatedTrip: TripData = {
      ...trip,
      members: updatedMembers,
      membersStatus,
      membersTotal: updatedMembers.length,
      membersOnline: updatedMembers.filter((m) => m.status === 'online').length,
      telematics,
    };
    await saveTripToFirestore(updatedTrip, 'Đã cập nhật danh sách thành viên trên Firestore!');
  };

  // Handler: Update General Trip Data (Telematics, Weather, etc.)
  const handleUpdateTrip = async (updatedTrip: TripData, message?: string) => {
    await saveTripToFirestore(updatedTrip, message || 'Đã đồng bộ dữ liệu chuyến đi lên Firestore!');
  };

  // Handler: Dismiss Alert
  const handleDismissAlert = async (id: string) => {
    const updatedTrip: TripData = {
      ...trip,
      alerts: trip.alerts.filter((a) => a.id !== id),
    };
    await saveTripToFirestore(updatedTrip);
  };

  // Handler: Apply newly generated trip from Gemini AI
  const handleSelectTrip = (selectedTrip: TripData) => {
    setTrip(selectedTrip);
    setCurrentDayIndex(selectedTrip.currentDay || 1);
    setCurrentTab('dashboard');
  };

  const handleApplyGeneratedTrip = async (newTrip: TripData) => {
    const response = await authenticatedFetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTrip),
    });
    const result = await safeJsonResponse(response);
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Không thể lưu chuyến đi mới');
    }

    // Không thay chuyến đi vừa tạo bằng dữ liệu mẫu; server đã chuẩn hóa, client chỉ chuẩn hóa lại
    const savedTrip = normalizeTripData(result.trip);
    setTrips((prev) => [savedTrip, ...prev.filter((item) => item.id !== savedTrip.id)]);
    setTrip(savedTrip);
    setCurrentDayIndex(1);
    setIsAIApplied(false);
    showToast(`Đã tạo chuyến đi ${savedTrip.title} thành công!`, 'success');
  };

  const handleLogout = async () => {
    try {
      if (typeof localStorage !== 'undefined') {
      }
      if (firebaseAuth && firebaseAuth.currentUser) {
        await signOut(firebaseAuth);
      }
    } catch (err) {
      console.warn('SignOut error:', err);
    } finally {
      setAuthUser(null);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-300">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  return (
    <>
      {authUser.role === 'admin' ? (
        <AdminDashboard
          trip={trip}
          trips={trips}
          onSelectTrip={handleSelectTrip}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          currentDayIndex={currentDayIndex}
          setCurrentDayIndex={setCurrentDayIndex}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          firebaseStatus={firebaseStatus}
          isAIApplied={isAIApplied}
          authUser={authUser}
          onLogout={handleLogout}
          isAdminMode={isAdminMode}
          isAIPlannerOpen={isAIPlannerOpen}
          setIsAIPlannerOpen={setIsAIPlannerOpen}
          isAIOptimizeOpen={isAIOptimizeOpen}
          setIsAIOptimizeOpen={setIsAIOptimizeOpen}
          isAddActivityOpen={isAddActivityOpen}
          setIsAddActivityOpen={setIsAddActivityOpen}
          isAlertsModalOpen={isAlertsModalOpen}
          setIsAlertsModalOpen={setIsAlertsModalOpen}
          selectedActivity={selectedActivity}
          setSelectedActivity={setSelectedActivity}
          handleSelectTab={handleSelectTab}
          handleApplyGeneratedTrip={handleApplyGeneratedTrip}
          handleApplyAIOptimization={handleApplyAIOptimization}
          handleAddActivity={handleAddActivity}
          handleUpdateActivityStatus={handleUpdateActivityStatus}
          handleDeleteActivity={handleDeleteActivity}
          handleEditActivity={handleEditActivity}
          handleAddDay={handleAddDay}
          handleDeleteDay={handleDeleteDay}
          handleUpdateDayNote={handleUpdateDayNote}
          handleToggleMemberAttendance={handleToggleMemberAttendance}
          handleUpdateMembers={handleUpdateMembers}
          handleUpdateTrip={handleUpdateTrip}
          handleDismissAlert={handleDismissAlert}
          handleUpdateTripBudget={handleUpdateTripBudget}
          canUndo={!!lastOptimizedTripSnapshot}
          onUndo={handleUndoOptimization}
          onOpenEditTripModal={handleOpenEditTripModal}
          onDeleteTrip={handleDeleteTrip}
          onScanAlerts={handleScanRealtimeAlerts}
          isScanningAlerts={isScanningAlerts}
          onOpenAIPlanner={handleOpenAIPlanner}
          onOpenAIOptimize={handleOpenAIOptimize}
        />
      ) : (
        <UserDashboard
          trip={trip}
          trips={trips}
          onSelectTrip={handleSelectTrip}
          currentTab={currentTab}
          currentDayIndex={currentDayIndex}
          setCurrentDayIndex={setCurrentDayIndex}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          firebaseStatus={firebaseStatus}
          authUser={authUser}
          onLogout={handleLogout}
          setCurrentTab={setCurrentTab}
          setSelectedActivity={setSelectedActivity}
          selectedActivity={selectedActivity}
          handleUpdateActivityStatus={handleUpdateActivityStatus}
          handleDeleteActivity={handleDeleteActivity}
          handleEditActivity={handleEditActivity}
          handleAddDay={handleAddDay}
          handleDeleteDay={handleDeleteDay}
          handleUpdateDayNote={handleUpdateDayNote}
          handleToggleMemberAttendance={handleToggleMemberAttendance}
          handleUpdateMembers={handleUpdateMembers}
          handleUpdateTrip={handleUpdateTrip}
          isAIPlannerOpen={isAIPlannerOpen}
          setIsAIPlannerOpen={setIsAIPlannerOpen}
          isAIOptimizeOpen={isAIOptimizeOpen}
          setIsAIOptimizeOpen={setIsAIOptimizeOpen}
          isAddActivityOpen={isAddActivityOpen}
          setIsAddActivityOpen={setIsAddActivityOpen}
          isAIApplied={isAIApplied}
          isAlertsModalOpen={isAlertsModalOpen}
          setIsAlertsModalOpen={setIsAlertsModalOpen}
          handleDismissAlert={handleDismissAlert}
          handleApplyGeneratedTrip={handleApplyGeneratedTrip}
          handleApplyAIOptimization={handleApplyAIOptimization}
          handleAddActivity={handleAddActivity}
          handleUpdateTripBudget={handleUpdateTripBudget}
          canUndo={!!lastOptimizedTripSnapshot}
          onUndo={handleUndoOptimization}
          onOpenEditTripModal={handleOpenEditTripModal}
          onDeleteTrip={handleDeleteTrip}
          onScanAlerts={handleScanRealtimeAlerts}
          isScanningAlerts={isScanningAlerts}
          onOpenAIPlanner={handleOpenAIPlanner}
          onOpenAIOptimize={handleOpenAIOptimize}
        />
      )}

      {/* Modal Chỉnh sửa thông tin chuyến đi (tên, ngày, ngân sách...) */}
      {isEditTripModalOpen && tripToEdit && (
        <EditTripModal
          isOpen={isEditTripModalOpen}
          onClose={() => setIsEditTripModalOpen(false)}
          trip={tripToEdit}
          onSave={handleSaveEditedTrip}
        />
      )}

      {/* Floating Toast Notification for Firestore Actions */}
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

function AdminDashboard({
  trip,
  trips,
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
  onScanAlerts,
  isScanningAlerts,
  onOpenAIPlanner,
  onOpenAIOptimize,
}: {
  trip: TripData;
  trips: TripData[];
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
  onScanAlerts?: () => Promise<void>;
  isScanningAlerts?: boolean;
  onOpenAIPlanner?: () => void;
  onOpenAIOptimize?: () => void;
}) {
  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#0f172a,#111827_28%,#020817_100%)] text-slate-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(45,212,191,0.12),transparent_40%,rgba(59,130,246,0.08))]" />
      <div className="relative flex h-full w-full">
      <Sidebar
        currentTab={currentTab}
        userName={authUser.name}
        userRole={authUser.role}
        onLogout={onLogout}
        onSelectTab={handleSelectTab}
        alertCount={trip.alerts.length}
        tripCount={trips.length}
        onOpenAIPlanner={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
      />

      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <Header
          trip={trip}
          role="admin"
          onOpenCreateTripModal={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
          onOpenEditTripModal={() => onOpenEditTripModal?.(trip)}
          onDeleteCurrentTrip={() => onDeleteTrip?.(trip.id)}
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
        />

        <main className="flex-1 p-5 md:p-6 space-y-6 max-w-[1680px] w-full mx-auto">
          {firebaseStatus === 'error' && (
            <div
              role="status"
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2"
            >
              <span>⚠️</span>
              <span>Không thể đồng bộ cơ sở dữ liệu Firestore Cloud</span>
            </div>
          )}

          {currentTab === 'dashboard' && isAdminMode && (
            <AdminDashboardView
              trip={trip}
              trips={trips}
              firebaseStatus={firebaseStatus}
              onNavigate={handleSelectTab}
              onOpenAIPlanner={() => setIsAIPlannerOpen(true)}
              onOpenAIOptimize={() => setIsAIOptimizeOpen(true)}
            />
          )}

          {currentTab === 'users' && <AdminUsersManagementView />}
          {currentTab === 'planning' && <AdminPlanningDataView trip={trip} onUpdateTrip={handleUpdateTrip} />}
          {currentTab === 'rules' && <AdminDispatchRulesView />}
          {currentTab === 'ai' && <AdminAIManagementView onOpenAIPlanner={() => setIsAIPlannerOpen(true)} trip={trip} isAIApplied={isAIApplied} />}
          {currentTab === 'monitoring' && <AdminScheduleMonitoringView trip={trip} trips={trips} onUpdateTrip={handleUpdateTrip} />}
          {currentTab === 'system' && <AdminSystemManagementView trip={trip} />}
          {currentTab === 'locations' && <AdminPlanningDataView trip={trip} onUpdateTrip={handleUpdateTrip} />}

          {currentTab === 'dashboard' && !isAdminMode && (
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
                    onSelectWaypoint={(wp) => console.log('Selected waypoint:', wp.name)}
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
              />
            </>
          )}



          {currentTab === 'trips' && (
            <TripsListView
              trips={trips}
              currentTrip={trip}
              onSelectTrip={onSelectTrip}
              onOpenCreateModal={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
              onEditTrip={onOpenEditTripModal}
              onDeleteTrip={onDeleteTrip}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
            />
          )}

          {currentTab === 'schedule' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">Chi tiết Lịch trình Toàn bộ Hành trình</h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Xem và chỉnh sửa toàn bộ các chặng từ Ngày 1 đến Ngày {trip.totalDays}
                  </p>
                </div>
                <button
                  onClick={() => setIsAddActivityOpen(true)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-900/30 transition"
                >
                  + Thêm hoạt động mới
                </button>
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
              />
            </div>
          )}

          {currentTab === 'map' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-white">Bản đồ Tuyến đường Toàn cảnh & Telematics</h2>
                <p className="text-xs text-slate-400 font-medium">
                  Giám sát hành trình xe 29 chỗ trực tiếp trên cung đường Đà Nẵng - Huế
                </p>
              </div>
              <LiveRouteMap
                trip={trip}
                onUpdateTrip={handleUpdateTrip}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
              />
            </div>
          )}

          {currentTab === 'members' && (
            <MembersView
              members={trip.members}
              onToggleStatus={handleToggleMemberAttendance}
              onUpdateMembers={handleUpdateMembers}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
            />
          )}

          {currentTab === 'budget' && (
            <BudgetView
              trip={trip}
              onUpdateTripBudget={handleUpdateTripBudget}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
            />
          )}

        </main>
      </div>

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

function UserDashboard({
  trip,
  trips,
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
  isAIPlannerOpen,
  setIsAIPlannerOpen,
  isAIOptimizeOpen,
  setIsAIOptimizeOpen,
  isAddActivityOpen,
  setIsAddActivityOpen,
  isAlertsModalOpen,
  setIsAlertsModalOpen,
  handleDismissAlert,
  isAIApplied,
  handleApplyGeneratedTrip,
  handleApplyAIOptimization,
  handleAddActivity,
  handleUpdateTripBudget,
  canUndo,
  onUndo,
  onOpenEditTripModal,
  onDeleteTrip,
  onScanAlerts,
  isScanningAlerts,
  onOpenAIPlanner,
  onOpenAIOptimize,
}: {
  trip: TripData;
  trips: TripData[];
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
  handleApplyGeneratedTrip: (newTrip: TripData) => Promise<void>;
  handleApplyAIOptimization: (actionTitle?: string, actionReason?: string, costSaved?: string, recommendationData?: any) => void;
  handleAddActivity: (newAct: Activity, targetDayIndex?: number) => void;
  handleUpdateTripBudget: (updated: TripData) => Promise<void>;
  canUndo?: boolean;
  onUndo?: () => void;
  onOpenEditTripModal?: (tripTarget?: TripData) => void;
  onDeleteTrip?: (tripId: string) => void;
  onScanAlerts?: () => Promise<void>;
  isScanningAlerts?: boolean;
  onOpenAIPlanner?: () => void;
  onOpenAIOptimize?: () => void;
}) {
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,#ecfeff,#f0fdf4_20%,#f8fafc_55%,#edf6ff_100%)] text-slate-800">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),transparent_35%,rgba(16,185,129,0.12))] pointer-events-none" />
      <div className="relative flex h-full w-full min-w-0 overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          userName={authUser.name}
          userRole={authUser.role}
          onLogout={onLogout}
          onSelectTab={(tab) => setCurrentTab(tab)}
          alertCount={trip.alerts.length}
          tripCount={trips.length}
          onOpenAIPlanner={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
        />

        <div className="flex-1 flex flex-col h-screen min-w-0 overflow-y-auto">
          <Header
            trip={trip}
            role="user"
            onOpenCreateTripModal={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
            onOpenEditTripModal={() => onOpenEditTripModal?.(trip)}
            onDeleteCurrentTrip={() => onDeleteTrip?.(trip.id)}
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
          />

          <main className="flex-1 p-4 sm:p-5 md:p-6 space-y-5 max-w-[1600px] w-full mx-auto min-w-0">
            {/* Firestore direct sync indicator banner */}
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
                  {firebaseStatus === 'error' && 'Không thể kết nối Firestore, đang dùng bộ nhớ tạm thời.'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                Chuyến đi: {trip.code} • Ngày {trip.currentDay}/{trip.totalDays}
              </span>
            </div>

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
                        onClick={onOpenAIOptimize || (() => setIsAIOptimizeOpen(true))}
                        className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition shadow-lg shadow-teal-500/25 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>⚡ Tối ưu AI</span>
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
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>+ Thêm hoạt động</span>
                      </button>
                      <button
                        onClick={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
                        className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>✨ Tạo tour mới</span>
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
                    <LiveRouteMap
                      trip={trip}
                      onSelectWaypoint={(wp) => console.log('Selected waypoint:', wp.name)}
                      onUpdateTrip={handleUpdateTrip}
                      searchQuery={searchQuery}
                      onClearSearch={() => setSearchQuery('')}
                    />
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
                  />
                </div>
              </>
            )}

            {currentTab === 'trips' && (
              <TripsListView
                trips={trips}
                currentTrip={trip}
                onSelectTrip={onSelectTrip}
                onOpenCreateModal={onOpenAIPlanner || (() => setIsAIPlannerOpen(true))}
                onEditTrip={onOpenEditTripModal}
                onDeleteTrip={onDeleteTrip}
                readOnly={false}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
              />
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
                    <button
                      onClick={onOpenAIOptimize || (() => setIsAIOptimizeOpen(true))}
                      className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      title="Phân tích và tối ưu lại lịch trình thông minh với Gemini AI"
                    >
                      <span>⚡ Tối ưu AI</span>
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
                  onSelectActivity={setSelectedActivity}
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
                />
              </div>
            )}

            {currentTab === 'map' && (
              <div className="w-full min-w-0">
                <LiveRouteMap
                  trip={trip}
                  onUpdateTrip={handleUpdateTrip}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                />
              </div>
            )}

            {currentTab === 'members' && (
              <div className="w-full min-w-0">
                <MembersView
                  members={trip.members}
                  onToggleStatus={handleToggleMemberAttendance}
                  onUpdateMembers={handleUpdateMembers}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                />
              </div>
            )}

            {currentTab === 'budget' && (
              <div className="w-full min-w-0">
                <BudgetView
                  trip={trip}
                  onUpdateTripBudget={handleUpdateTripBudget}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                />
              </div>
            )}
          </main>
        </div>

        <AIPlannerModal
          isOpen={isAIPlannerOpen}
          onClose={() => setIsAIPlannerOpen(false)}
          onApplyPlan={handleApplyGeneratedTrip}
        />
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
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onUpdateStatus={handleUpdateActivityStatus}
          onDeleteActivity={handleDeleteActivity}
          onEditActivity={handleEditActivity}
          canEdit
        />
      </div>
    </div>
  );
}