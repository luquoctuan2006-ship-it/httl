/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
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
import { ProjectArchitectureModal } from './components/ProjectArchitectureModal';
import { TripsListView } from './components/TripsListView';
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
import { authenticatedFetch, safeJsonResponse, setMockAuthToken } from './api';
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

function AuthScreen({ onMockLogin }: { onMockLogin: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin@voyager.vn');
  const [password, setPassword] = useState('123456');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!firebaseAuth) return;
    setIsSubmitting(true);
    setMessage('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      setMessage(error?.message || 'Không thể đăng nhập bằng Google. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firebaseAuth) {
      const normalizedEmail = email.trim() || 'admin@voyager.vn';
      const role: AppRole = normalizedEmail.toLowerCase().includes('admin') ? 'admin' : 'user';
      const uid = `mock-${role}`;
      const displayName = name.trim() || (role === 'admin' ? 'Điều phối viên Admin' : normalizedEmail.split('@')[0] || 'Người dùng');
      setMockAuthToken(`mock-token:${uid}:${role}:${normalizedEmail}`);
      onMockLogin({
        id: uid,
        name: displayName,
        email: normalizedEmail,
        role,
      });
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      } else {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        if (name.trim()) {
          try {
            await updateProfile(credential.user, { displayName: name.trim() });
          } catch (profileError) {
            console.warn('Firebase account was created, but its display name could not be updated.', profileError);
          }
        }
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      const messages: Record<string, string> = {
        'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
        'auth/email-already-in-use': 'Email này đã được đăng ký.',
        'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự.',
        'auth/invalid-email': 'Email không hợp lệ.',
        'auth/too-many-requests': 'Có quá nhiều lần thử. Vui lòng thử lại sau.',
        'auth/operation-not-allowed': 'Firebase chưa bật phương thức Email/Password. Hãy sử dụng Đăng nhập bằng Google bên trên hoặc bật trong Firebase Console.',
        'auth/admin-restricted-operation': 'Firebase đang chặn đăng ký Email/Password. Hãy kiểm tra Authentication settings trong Firebase Console.',
        'auth/unauthorized-domain': 'Tên miền hiện tại chưa được cho phép trong Firebase Authentication > Settings > Authorized domains.',
        'auth/network-request-failed': 'Không kết nối được Firebase. Hãy kiểm tra mạng và thử lại.',
        'auth/invalid-api-key': 'Firebase API key không hợp lệ.',
        'auth/app-not-authorized': 'Ứng dụng chưa được cấp quyền cho Firebase project này.',
      };
      console.error('Firebase authentication failed:', code || error);
      setMessage(messages[code || ''] || `Firebase trả về lỗi${code ? ` (${code})` : ''}. Vui lòng thử đăng nhập bằng Google.`);
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

        {firebaseAuth && (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Đăng nhập với Google</span>
          </button>
        )}

        {firebaseAuth && (
          <div className="relative mb-4 text-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
            <span className="relative bg-slate-900 px-3 text-xs uppercase tracking-wider text-slate-400">hoặc bằng email</span>
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${mode === 'login' ? 'bg-teal-600 text-white' : 'text-slate-300'}`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${mode === 'register' ? 'bg-teal-600 text-white' : 'text-slate-300'}`}
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
              placeholder="admin@voyager.vn"
            />
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

          {message && <p className="text-sm text-amber-300">{message}</p>}

          <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? 'Đang xác thực...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>

        {!firebaseAuthConfigured && <p className="mt-4 text-xs text-slate-400">Chế độ bộ nhớ tạm (In-memory Demo): Nhập email có chữ &quot;admin&quot; để vào quyền Admin, hoặc email khác để vào quyền User.</p>}
      </div>
    </div>
  );
}

function hasMojibake(value: unknown): boolean {
  if (typeof value === 'string') {
    return /�|Ã|Â|Ð|ð|Ñ|Õ|\?\s|\?\w/.test(value) || value.includes('??');
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
        const token = await user.getIdTokenResult();
        const isAdmin =
          token.claims.role === 'admin' ||
          user.email === 'luquoctuan2006@gmail.com' ||
          (user.email && user.email.toLowerCase().includes('admin'));
        setAuthUser({
          id: user.uid,
          name: user.displayName || user.email || 'Người dùng',
          email: user.email || '',
          role: isAdmin ? 'admin' : 'user',
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

    const loadFromApi = async () => {
      try {
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

        if (db) {
          await setDoc(doc(db, 'trips', 'active'), correctedTrip);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Trip loading error:', error);
        setFirebaseStatus('error');
      }
    };

    if (!db) {
      void loadFromApi();
      return () => { cancelled = true; };
    }

    const activeTripDoc = doc(db, 'trips', 'active');
    void getDoc(activeTripDoc)
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          const savedTrip = normalizeTripData(snap.data());
          setTrips([savedTrip]);
          setTrip(savedTrip);
          setCurrentDayIndex(savedTrip.currentDay || 1);
          setFirebaseStatus('connected');
          setLoadedTripUserId(authUser.id);
          return;
        }
        void loadFromApi();
      })
      .catch(() => {
        if (!cancelled) void loadFromApi();
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || loadedTripUserId !== authUser.id) return;

    const timeout = window.setTimeout(() => {
      const saveTrip = async () => {
        if (db) {
          try {
            await setDoc(doc(db, 'trips', 'active'), normalizeTripData(trip));
            setFirebaseStatus('connected');
            return;
          } catch (error) {
            console.warn('Direct Firestore save error, trying API route:', error);
          }
        }

        try {
          const response = await authenticatedFetch('/api/trips/active', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(normalizeTripData(trip)),
          });
          if (!response.ok) throw new Error('Không thể lưu dữ liệu chuyến đi');
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
  const [isProjectDocsOpen, setIsProjectDocsOpen] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    window.setTimeout(() => {
      setToastMessage((current) => (current?.text === text ? null : current));
    }, 3200);
  };

  const saveTripToFirestore = async (updatedTrip: TripData, successMessage?: string) => {
    const normalizedTrip = normalizeTripData(updatedTrip);
    setTrip(normalizedTrip);
    setFirebaseStatus('loading');

    try {
      if (db) {
        await setDoc(doc(db, 'trips', 'active'), normalizedTrip);
        setFirebaseStatus('connected');
      } else {
        const response = await authenticatedFetch('/api/trips/active', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizedTrip),
        });
        const result = await safeJsonResponse(response);
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Lỗi lưu chuyến đi');
        }
        setFirebaseStatus('connected');
      }

      if (successMessage) showToast(successMessage, 'success');
    } catch (error) {
      console.error('All trip save methods failed:', error);
      setFirebaseStatus('error');
      showToast('Lỗi khi lưu chuyến đi, vui lòng thử lại', 'error');
    }
  };

  // Handler: Apply AI Optimization (Swap itinerary & resolve rain risk)
  const handleApplyAIOptimization = async (actionTitle?: string, actionReason?: string, costSaved?: string) => {
    const updatedDays = trip.days.map((day) => {
      if (day.dayIndex === 3) {
        const updatedActivities = day.activities.map((act) => {
          if (act.id === 'act-10') {
            return {
              ...act,
              title: actionTitle || 'Khởi hành đi Lăng Cô (Phương án an toàn)',
              status: 'Đã xác nhận' as const,
              details: actionReason || 'Đã chuyển sang khung giờ tránh mưa lớn 15:00-17:00 • Tài xế đã nhận lộ trình mới',
            };
          }
          return act;
        });

        return {
          ...day,
          hasWarning: false,
          confirmedCount: 6,
          pendingCount: 0,
          dispatcherNote: `Đã kích hoạt phương án Gemini AI: ${actionTitle || 'tránh vùng mưa Hải Vân - Lăng Cô'}${actionReason ? ` • ${actionReason}` : ', tiết kiệm 36 phút di chuyển.'}`,
          activities: updatedActivities,
        };
      }
      return day;
    });

    const remainingAlerts = trip.alerts.filter((a) => a.id !== 'alt-1');

    const updatedTrip: TripData = {
      ...trip,
      alerts: remainingAlerts,
      days: updatedDays,
      budgetRemaining: trip.budgetRemaining + (Number(costSaved?.replace(/\D/g, '')) || 0),
      aiSavingsEstimate: costSaved || trip.aiSavingsEstimate,
      confirmedActivities: trip.confirmedActivities + 1,
      pendingActivities: Math.max(0, trip.pendingActivities - 1),
    };

    setIsAIApplied(true);
    await saveTripToFirestore(updatedTrip, 'Đã kích hoạt giải pháp AI và lưu vào Firestore!');
  };

  // Handler: Add Activity
  const handleAddActivity = async (newAct: Activity) => {
    const updatedDays = trip.days.map((d) => {
      if (d.dayIndex === currentDayIndex) {
        return {
          ...d,
          activities: [...d.activities, newAct],
        };
      }
      return d;
    });

    const allActs = updatedDays.flatMap((d) => d.activities);
    const totalActivityCosts = allActs.reduce((sum, a) => sum + (a.cost || 0), 0);
    const newSpent = totalActivityCosts > 0 ? totalActivityCosts : trip.budgetUsed + (newAct.cost || 0);
    const newRemaining = Math.max(0, trip.budgetTotal - newSpent);
    const newPercent = Math.round((newSpent / trip.budgetTotal) * 100);

    const isConfirmed = newAct.status === 'Hoàn tất' || newAct.status === 'Đã xác nhận';
    const isPending = newAct.status === 'Cần xử lý' || newAct.status === 'Đang diễn ra';

    const updatedTrip: TripData = {
      ...trip,
      totalActivities: trip.totalActivities + 1,
      confirmedActivities: isConfirmed ? trip.confirmedActivities + 1 : trip.confirmedActivities,
      pendingActivities: isPending ? trip.pendingActivities + 1 : trip.pendingActivities,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
      days: updatedDays,
    };

    await saveTripToFirestore(updatedTrip, `Đã thêm hoạt động "${newAct.title}" vào Firestore!`);
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

  // Handler: Toggle Member Attendance
  const handleToggleMemberAttendance = async (id: string) => {
    const member = trip.members.find((item) => item.id === id);
    if (!member) return;

    const attendanceStatus: TripMember['attendanceStatus'] = member.attendanceStatus === 'Có mặt' ? 'Vắng mặt' : 'Có mặt';
    const updatedMembers = trip.members.map((item) => (item.id === id ? { ...item, attendanceStatus } : item));
    const presentCount = updatedMembers.filter((item) => item.attendanceStatus === 'Có mặt').length;
    const membersStatus = `${presentCount}/${updatedMembers.length} đã điểm danh`;

    const updatedTrip = {
      ...trip,
      members: updatedMembers,
      membersStatus,
    };

    await saveTripToFirestore(
      updatedTrip,
      `Đã lưu điểm danh: ${member.name} (${attendanceStatus}) trên Firestore!`
    );
  };

  // Handler: Update Trip Budget
  const handleUpdateTripBudget = async (updatedTrip: TripData) => {
    await saveTripToFirestore(updatedTrip, 'Đã cập nhật ngân sách chuyến đi trên Firestore!');
  };

  // Handler: Update Trip Members list (Add, Edit, Delete)
  const handleUpdateMembers = async (updatedMembers: TripMember[]) => {
    const presentCount = updatedMembers.filter((item) => item.attendanceStatus === 'Có mặt').length;
    const membersStatus = `${presentCount}/${updatedMembers.length} đã điểm danh`;
    const updatedTrip: TripData = {
      ...trip,
      members: updatedMembers,
      membersStatus,
      membersTotal: updatedMembers.length,
      membersOnline: updatedMembers.filter((m) => m.status === 'online').length,
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

    const savedTrip = sanitizeTripData(result.trip) as TripData;
    setTrips((prev) => [savedTrip, ...prev.filter((item) => item.id !== savedTrip.id)]);
    setTrip(savedTrip);
    setCurrentDayIndex(1);
    setIsAIApplied(false);
    showToast(`Đã tạo chuyến đi ${savedTrip.title} thành công!`, 'success');
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-300">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!authUser) {
    return <AuthScreen onMockLogin={setAuthUser} />;
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
          onLogout={() => {
            if (firebaseAuth) void signOut(firebaseAuth);
            else setAuthUser(null);
          }}
          isAdminMode={isAdminMode}
          isAIPlannerOpen={isAIPlannerOpen}
          setIsAIPlannerOpen={setIsAIPlannerOpen}
          isAIOptimizeOpen={isAIOptimizeOpen}
          setIsAIOptimizeOpen={setIsAIOptimizeOpen}
          isAddActivityOpen={isAddActivityOpen}
          setIsAddActivityOpen={setIsAddActivityOpen}
          isAlertsModalOpen={isAlertsModalOpen}
          setIsAlertsModalOpen={setIsAlertsModalOpen}
          isProjectDocsOpen={isProjectDocsOpen}
          setIsProjectDocsOpen={setIsProjectDocsOpen}
          selectedActivity={selectedActivity}
          setSelectedActivity={setSelectedActivity}
          handleSelectTab={handleSelectTab}
          handleApplyGeneratedTrip={handleApplyGeneratedTrip}
          handleApplyAIOptimization={handleApplyAIOptimization}
          handleAddActivity={handleAddActivity}
          handleUpdateActivityStatus={handleUpdateActivityStatus}
          handleToggleMemberAttendance={handleToggleMemberAttendance}
          handleUpdateMembers={handleUpdateMembers}
          handleUpdateTrip={handleUpdateTrip}
          handleDismissAlert={handleDismissAlert}
          handleUpdateTripBudget={handleUpdateTripBudget}
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
          onLogout={() => {
            if (firebaseAuth) void signOut(firebaseAuth);
            else setAuthUser(null);
          }}
          setCurrentTab={setCurrentTab}
          setSelectedActivity={setSelectedActivity}
          selectedActivity={selectedActivity}
          handleUpdateActivityStatus={handleUpdateActivityStatus}
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
          handleApplyGeneratedTrip={handleApplyGeneratedTrip}
          handleApplyAIOptimization={handleApplyAIOptimization}
          handleAddActivity={handleAddActivity}
          handleUpdateTripBudget={handleUpdateTripBudget}
        />
      )}

      {/* Floating Toast Notification for Firestore Actions */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold transition-all duration-300 backdrop-blur-md bg-slate-900/95 text-white border-slate-700 animate-in fade-in slide-in-from-bottom-2"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              toastMessage.type === 'error'
                ? 'bg-rose-500'
                : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <span>{toastMessage.text}</span>
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
  isProjectDocsOpen,
  setIsProjectDocsOpen,
  selectedActivity,
  setSelectedActivity,
  handleSelectTab,
  handleApplyGeneratedTrip,
  handleApplyAIOptimization,
  handleAddActivity,
  handleUpdateActivityStatus,
  handleToggleMemberAttendance,
  handleUpdateMembers,
  handleUpdateTrip,
  handleDismissAlert,
  handleUpdateTripBudget,
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
  isProjectDocsOpen: boolean;
  setIsProjectDocsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedActivity: Activity | null;
  setSelectedActivity: React.Dispatch<React.SetStateAction<Activity | null>>;
  handleSelectTab: (tab: string) => void;
  handleApplyGeneratedTrip: (newTrip: TripData) => Promise<void>;
  handleApplyAIOptimization: (actionTitle?: string, actionReason?: string, costSaved?: string) => void;
  handleAddActivity: (newAct: Activity) => void;
  handleUpdateActivityStatus: (id: string, newStatus: Activity['status']) => void;
  handleToggleMemberAttendance: (id: string) => Promise<void>;
  handleUpdateMembers: (members: TripMember[]) => Promise<void>;
  handleUpdateTrip: (trip: TripData, message?: string) => Promise<void>;
  handleDismissAlert: (id: string) => void;
  handleUpdateTripBudget: (updated: TripData) => Promise<void>;
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
        onOpenProjectDocs={() => setIsProjectDocsOpen(true)}
        onOpenAIPlanner={() => setIsAIPlannerOpen(true)}
      />

      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <Header
          trip={trip}
          role={authUser.role}
          onOpenCreateTripModal={() => setIsAIPlannerOpen(true)}
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

        <main className="flex-1 p-5 md:p-6 space-y-5 max-w-[1680px] w-full mx-auto">
          <div
            role="status"
            className={`text-xs font-semibold ${firebaseStatus === 'error' ? 'text-rose-600' : 'text-emerald-700'}`}
          >
            {firebaseStatus === 'loading' && 'Đang kết nối Firestore...'}
            {firebaseStatus === 'connected' && 'Đã kết nối Firestore'}
            {firebaseStatus === 'error' && 'Không thể đồng bộ Firestore'}
          </div>

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
          {currentTab === 'planning' && <AdminPlanningDataView trip={trip} />}
          {currentTab === 'rules' && <AdminDispatchRulesView />}
          {currentTab === 'ai' && <AdminAIManagementView />}
          {currentTab === 'monitoring' && <AdminScheduleMonitoringView trip={trip} />}
          {currentTab === 'system' && <AdminSystemManagementView trip={trip} />}
          {currentTab === 'locations' && <AdminPlanningDataView trip={trip} />}

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
                    onOpenApplyAIPlan={() => setIsAIOptimizeOpen(true)}
                    isAIApplied={isAIApplied}
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
              onOpenCreateModal={() => setIsAIPlannerOpen(true)}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
            />
          )}

          {currentTab === 'schedule' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Chi tiết Lịch trình Toàn bộ Hành trình</h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Xem và chỉnh sửa toàn bộ các chặng từ Ngày 1 đến Ngày {trip.totalDays}
                  </p>
                </div>
                <button
                  onClick={() => setIsAddActivityOpen(true)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
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
              />
            </div>
          )}

          {currentTab === 'map' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Bản đồ Tuyến đường Toàn cảnh & Telematics</h2>
                <p className="text-xs text-slate-500 font-medium">
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

      <AIPlannerModal isOpen={isAIPlannerOpen} onClose={() => setIsAIPlannerOpen(false)} onApplyPlan={handleApplyGeneratedTrip} />
      <AIOptimizeModal isOpen={isAIOptimizeOpen} onClose={() => setIsAIOptimizeOpen(false)} trip={trip} onApplyChanges={handleApplyAIOptimization} isApplied={isAIApplied} />
      <AddActivityModal isOpen={isAddActivityOpen} onClose={() => setIsAddActivityOpen(false)} dayIndex={currentDayIndex} onAdd={handleAddActivity} />
      <AlertsListModal
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
        alerts={trip.alerts}
        onDismissAlert={handleDismissAlert}
        onTriggerAI={() => {
          setIsAlertsModalOpen(false);
          setIsAIOptimizeOpen(true);
        }}
      />
      <ActivityDetailModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} onUpdateStatus={handleUpdateActivityStatus} />
      <ProjectArchitectureModal isOpen={isProjectDocsOpen} onClose={() => setIsProjectDocsOpen(false)} />
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
  handleToggleMemberAttendance,
  handleUpdateMembers,
  handleUpdateTrip,
  isAIPlannerOpen,
  setIsAIPlannerOpen,
  isAIOptimizeOpen,
  setIsAIOptimizeOpen,
  isAddActivityOpen,
  setIsAddActivityOpen,
  isAIApplied,
  handleApplyGeneratedTrip,
  handleApplyAIOptimization,
  handleAddActivity,
  handleUpdateTripBudget,
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
  handleToggleMemberAttendance: (id: string) => Promise<void>;
  handleUpdateMembers: (members: TripMember[]) => Promise<void>;
  handleUpdateTrip: (trip: TripData, message?: string) => Promise<void>;
  isAIPlannerOpen: boolean;
  setIsAIPlannerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAIOptimizeOpen: boolean;
  setIsAIOptimizeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAddActivityOpen: boolean;
  setIsAddActivityOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAIApplied: boolean;
  handleApplyGeneratedTrip: (newTrip: TripData) => Promise<void>;
  handleApplyAIOptimization: (actionTitle?: string, actionReason?: string, costSaved?: string) => void;
  handleAddActivity: (newAct: Activity) => void;
  handleUpdateTripBudget: (updated: TripData) => Promise<void>;
}) {
  const currentDay = trip.days.find((d) => d.dayIndex === currentDayIndex) || trip.days[0];
  const nextStop = currentDay?.activities?.[0];
  const totalActivities = trip.days.reduce((sum, day) => sum + day.activities.length, 0);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#ecfeff,#f0fdf4_20%,#f8fafc_55%,#edf6ff_100%)] text-slate-800">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),transparent_35%,rgba(16,185,129,0.12))]" />
      <div className="relative flex h-full w-full">
      <Sidebar
        currentTab={currentTab}
        userName={authUser.name}
        userRole={authUser.role}
        onLogout={onLogout}
        onSelectTab={(tab) => setCurrentTab(tab)}
        alertCount={trip.alerts.length}
        tripCount={trips.length}
        onOpenProjectDocs={() => undefined}
        onOpenAIPlanner={() => setIsAIPlannerOpen(true)}
      />

      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <Header
          trip={trip}
          role="user"
          onOpenCreateTripModal={() => setIsAIPlannerOpen(true)}
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

        <main className="flex-1 p-5 md:p-6 space-y-5 max-w-[1500px] w-full mx-auto">
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
              Chuyến đi: {trip.code}
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
                className="font-bold text-amber-800 hover:underline"
              >
                Xóa tìm kiếm
              </button>
            </div>
          )}

          {currentTab === 'dashboard' && <>
          <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <div className="rounded-3xl bg-gradient-to-r from-teal-600 to-emerald-500 p-6 text-white shadow-xl shadow-teal-900/20">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-100">User portal</p>
              <h2 className="mt-3 text-3xl font-black">Chào {authUser.name}</h2>
              <p className="mt-2 max-w-xl text-sm text-teal-50/90">Bạn đang theo dõi chuyến đi một cách trực quan, dễ dàng quản lý lịch trình, ngân sách và các hoạt động quan trọng từng ngày.</p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-white/15 px-3 py-1.5 font-semibold">{trip.code}</span>
                <span className="rounded-full bg-white/15 px-3 py-1.5 font-semibold">{trip.totalDays} ngày</span>
                <span className="rounded-full bg-white/15 px-3 py-1.5 font-semibold">{trip.status}</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Điểm đến tiếp theo (Ngày {currentDay.dayIndex})</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">{nextStop?.title || 'Mở lịch trình'}</h3>
              <p className="mt-2 text-sm text-slate-600">{nextStop?.details || 'Bạn có thể xem toàn bộ hoạt động trong phần Lịch trình.'}</p>
              <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 font-semibold">
                Thời gian: {nextStop ? `${nextStop.timeStart} — ${nextStop.timeEnd}` : 'Cập nhật sớm'}
              </div>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Hoạt động</p>
              <div className="mt-3 text-3xl font-black text-slate-900">{totalActivities}</div>
              <p className="text-sm text-slate-500">Tổng hoạt động trên tour</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Ngân sách còn</p>
              <div className="mt-3 text-3xl font-black text-slate-900">{trip.budgetRemaining.toLocaleString('vi-VN')}đ</div>
              <p className="text-sm text-slate-500">Còn lại trong kế hoạch ({trip.budgetUsedPercent}% đã dùng)</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tình trạng</p>
              <div className="mt-3 text-3xl font-black text-slate-900">{trip.confirmedActivities}/{trip.totalActivities}</div>
              <p className="text-sm text-slate-500">Hoạt động đã xác nhận</p>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">Lịch trình của bạn</h3>
                <button
                  onClick={() => setFilterMode(filterMode === 'timeline' ? 'all' : 'timeline')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  {filterMode === 'timeline' ? 'Hiện tất cả' : 'Chế độ timeline'}
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
              />
            </div>

            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-900">Thông tin tour</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                    <span>Điểm khởi hành</span>
                    <strong className="text-slate-900">{trip.originFull}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                    <span>Điểm đến</span>
                    <strong className="text-slate-900">{trip.destinationFull}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                    <span>Phương tiện</span>
                    <strong className="text-slate-900">{trip.vehicle}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-900">Tác vụ của bạn</h3>
                <div className="mt-4 grid gap-3">
                  <button
                    onClick={() => setIsAddActivityOpen(true)}
                    className="rounded-2xl bg-emerald-50 border border-emerald-200 px-3 py-3 text-left text-sm font-bold text-emerald-800 hover:bg-emerald-100 flex items-center justify-between"
                  >
                    <span>+ Thêm hoạt động vào Ngày {currentDayIndex}</span>
                  </button>
                  <button
                    onClick={() => setIsAIOptimizeOpen(true)}
                    className="rounded-2xl bg-teal-50 border border-teal-200 px-3 py-3 text-left text-sm font-bold text-teal-800 hover:bg-teal-100 flex items-center justify-between"
                  >
                    <span>Tối ưu lịch trình cùng Gemini AI</span>
                  </button>
                  <button
                    onClick={() => setIsAIPlannerOpen(true)}
                    className="rounded-2xl bg-violet-50 border border-violet-200 px-3 py-3 text-left text-sm font-bold text-violet-800 hover:bg-violet-100 flex items-center justify-between"
                  >
                    <span>AI tạo tour du lịch mới</span>
                  </button>
                  <button
                    onClick={() => setCurrentTab('budget')}
                    className="rounded-2xl bg-amber-50 border border-amber-200 px-3 py-3 text-left text-sm font-bold text-amber-800 hover:bg-amber-100"
                  >
                    Quản lý &amp; ghi nhận ngân sách
                  </button>
                </div>
              </div>
            </div>
          </section>
          </>}

          {currentTab === 'trips' && (
            <TripsListView
              trips={trips}
              currentTrip={trip}
              onSelectTrip={onSelectTrip}
              onOpenCreateModal={() => setIsAIPlannerOpen(true)}
              readOnly={false}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
            />
          )}

          {currentTab === 'schedule' && (
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
            />
          )}

          {currentTab === 'map' && (
            <LiveRouteMap
              trip={trip}
              onUpdateTrip={handleUpdateTrip}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
            />
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

      <AIPlannerModal isOpen={isAIPlannerOpen} onClose={() => setIsAIPlannerOpen(false)} onApplyPlan={handleApplyGeneratedTrip} />
      <AIOptimizeModal isOpen={isAIOptimizeOpen} onClose={() => setIsAIOptimizeOpen(false)} trip={trip} onApplyChanges={handleApplyAIOptimization} isApplied={isAIApplied} />
      <AddActivityModal isOpen={isAddActivityOpen} onClose={() => setIsAddActivityOpen(false)} dayIndex={currentDayIndex} onAdd={handleAddActivity} />
      <ActivityDetailModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} onUpdateStatus={handleUpdateActivityStatus} canEdit />
      </div>
    </div>
  );
}
