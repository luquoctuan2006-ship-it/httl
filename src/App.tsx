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

  const performMockLogin = (overrideEmail?: string, overrideRole?: AppRole, overrideName?: string) => {
    const normalizedEmail = (overrideEmail || email).trim() || 'admin@voyager.vn';
    const role: AppRole =
      overrideRole ||
      (normalizedEmail === 'luquoctuan2006@gmail.com' ||
      normalizedEmail.toLowerCase().includes('admin') ||
      normalizedEmail.toLowerCase().startsWith('admin@')
        ? 'admin'
        : 'user');
    const uid = `mock-${role}-${Date.now().toString().slice(-4)}`;
    const displayName =
      overrideName ||
      name.trim() ||
      (role === 'admin' ? 'Điều phối viên Admin' : normalizedEmail.split('@')[0] || 'Khách du lịch');
    
    const token = `mock-token:${uid}:${role}:${normalizedEmail}`;
    setMockAuthToken(token);

    // Lưu vào database users phía server
    try {
      void fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: displayName,
          email: normalizedEmail,
          phone: '0905 123 789',
          role: role === 'admin' ? 'Admin' : 'Khách du lịch',
        }),
      }).catch(() => {});
    } catch {}

    onMockLogin({
      id: uid,
      name: displayName,
      email: normalizedEmail,
      role,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firebaseAuth) {
      performMockLogin();
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
      const cleanEmail = email.trim().toLowerCase();
      const isVoyagerOrDemo =
        cleanEmail.endsWith('@voyager.vn') ||
        cleanEmail.includes('admin') ||
        cleanEmail.includes('demo') ||
        cleanEmail.includes('test');

      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation' ||
        code === 'auth/unauthorized-domain' ||
        code === 'auth/network-request-failed' ||
        (isVoyagerOrDemo &&
          (code === 'auth/invalid-credential' ||
            code === 'auth/user-not-found' ||
            code === 'auth/wrong-password'))
      ) {
        performMockLogin();
        return;
      }

      const messages: Record<string, string> = {
        'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
        'auth/user-not-found': 'Tài khoản chưa tồn tại. Vui lòng đăng ký mới.',
        'auth/wrong-password': 'Mật khẩu không chính xác.',
        'auth/email-already-in-use': 'Email này đã được đăng ký trong hệ thống.',
        'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự.',
        'auth/invalid-email': 'Định dạng email không hợp lệ.',
        'auth/too-many-requests': 'Có quá nhiều lần thử. Vui lòng thử lại sau giây lát.',
        'auth/operation-not-allowed': 'Firebase chưa bật Email/Password. Hệ thống sẽ tự động dùng chế độ Demo.',
        'auth/admin-restricted-operation': 'Firebase đang chặn đăng ký. Hệ thống chuyển sang Demo.',
        'auth/unauthorized-domain': 'Tên miền chưa được xác thực trong Firebase Console.',
        'auth/network-request-failed': 'Mạng yếu hoặc không kết nối được Firebase. Vui lòng thử lại.',
        'auth/invalid-api-key': 'Firebase API key không hợp lệ.',
        'auth/app-not-authorized': 'Ứng dụng chưa được cấp quyền cho Firebase project này.',
      };
      console.error('Firebase authentication failed:', code || error);
      setMessage(messages[code || ''] || `Lỗi xác thực: ${code || 'Vui lòng kiểm tra lại'}`);
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
              setEmail('admin@voyager.vn');
              setPassword('123456');
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
              placeholder={mode === 'register' ? 'vidu@voyager.vn hoặc email của bạn' : 'admin@voyager.vn'}
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

    const tripsCol = collection(db, 'trips');
    void getDocs(tripsCol)
      .then((snapshot) => {
        if (cancelled) return;
        if (!snapshot.empty) {
          const loadedTrips: TripData[] = [];
          let activeDocData: TripData | null = null;
          snapshot.forEach((item) => {
            const data = normalizeTripData(item.data());
            if (item.id === 'active') {
              activeDocData = data;
            } else {
              loadedTrips.push(data);
            }
          });
          const currentTrip = activeDocData || loadedTrips[0] || normalizeTripData(initialTripData);
          const allTrips = loadedTrips.length > 0
            ? (activeDocData ? [activeDocData, ...loadedTrips.filter((t) => t.id !== activeDocData?.id)] : loadedTrips)
            : [currentTrip];
          setTrips(allTrips);
          setTrip(currentTrip);
          setCurrentDayIndex(currentTrip.currentDay || 1);
          setFirebaseStatus('connected');
          setLoadedTripUserId(authUser.id);
          return;
        }
        void loadFromApi();
      })
      .catch((err) => {
        console.warn('Failed to load trips collection from Firestore, trying fallback:', err);
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
        if (normalizedTrip.id && normalizedTrip.id !== 'active') {
          await setDoc(doc(db, 'trips', normalizedTrip.id), normalizedTrip);
        }
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
    const targetDayIndex = trip.days.find((d) => d.hasWarning || d.pendingCount > 0)?.dayIndex ?? currentDayIndex;

    const updatedDays = trip.days.map((day) => {
      if (day.dayIndex === targetDayIndex) {
        let updatedAnActivity = false;
        const updatedActivities = day.activities.map((act) => {
          if (!updatedAnActivity && (act.status === 'Cần xử lý' || act.status === 'Đang diễn ra')) {
            updatedAnActivity = true;
            return {
              ...act,
              title: actionTitle || act.title,
              status: 'Đã xác nhận' as const,
              details: actionReason ? `${actionReason} • ${act.details}` : act.details,
            };
          }
          return act;
        });

        const finalActivities = updatedAnActivity
          ? updatedActivities
          : day.activities.length > 0
            ? [
                {
                  ...day.activities[0],
                  title: actionTitle || day.activities[0].title,
                  status: 'Đã xác nhận' as const,
                  details: actionReason ? `${actionReason} • ${day.activities[0].details}` : day.activities[0].details,
                },
                ...day.activities.slice(1),
              ]
            : day.activities;

        const confirmedCount = finalActivities.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length;
        const pendingCount = finalActivities.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;

        return {
          ...day,
          hasWarning: false,
          confirmedCount,
          pendingCount,
          dispatcherNote: `Đã kích hoạt phương án Gemini AI: ${actionTitle || 'Lộ trình tối ưu thuận tiện nhất'}${actionReason ? ` • ${actionReason}` : ''}`,
          activities: finalActivities,
        };
      }
      return day;
    });

    const allActs = updatedDays.flatMap((d) => d.activities);
    const confirmed = allActs.filter((a) => a.status === 'Đã xác nhận' || a.status === 'Hoàn tất').length;
    const pending = allActs.filter((a) => a.status === 'Cần xử lý' || a.status === 'Đang diễn ra').length;
    const remainingAlerts = trip.alerts.slice(1);

    const updatedTrip: TripData = {
      ...trip,
      alerts: remainingAlerts,
      days: updatedDays,
      budgetRemaining: trip.budgetRemaining + (Number(costSaved?.replace(/\D/g, '')) || 0),
      aiSavingsEstimate: costSaved || trip.aiSavingsEstimate,
      confirmedActivities: confirmed,
      pendingActivities: pending,
    };

    setIsAIApplied(true);
    await saveTripToFirestore(updatedTrip, 'Đã kích hoạt giải pháp AI và lưu vào Firestore!');
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
          onLogout={async () => {
            try {
              if (firebaseAuth && firebaseAuth.currentUser) {
                await signOut(firebaseAuth);
              }
            } catch (err) {
              console.warn('SignOut error:', err);
            } finally {
              setMockAuthToken('mock-token:mock-guest:user:guest@voyager.vn');
              setAuthUser(null);
            }
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
          onLogout={async () => {
            try {
              if (firebaseAuth && firebaseAuth.currentUser) {
                await signOut(firebaseAuth);
              }
            } catch (err) {
              console.warn('SignOut error:', err);
            } finally {
              setMockAuthToken('mock-token:mock-guest:user:guest@voyager.vn');
              setAuthUser(null);
            }
          }}
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
          {currentTab === 'ai' && <AdminAIManagementView onOpenAIPlanner={() => setIsAIPlannerOpen(true)} />}
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

      <AIPlannerModal isOpen={isAIPlannerOpen} onClose={() => setIsAIPlannerOpen(false)} onApplyPlan={handleApplyGeneratedTrip} />
      <AIOptimizeModal isOpen={isAIOptimizeOpen} onClose={() => setIsAIOptimizeOpen(false)} trip={trip} onApplyChanges={handleApplyAIOptimization} isApplied={isAIApplied} />
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
          setIsAIOptimizeOpen(true);
        }}
      />
      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onUpdateStatus={handleUpdateActivityStatus}
        onDeleteActivity={handleDeleteActivity}
        onEditActivity={handleEditActivity}
      />
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
  isAIApplied: boolean;
  handleApplyGeneratedTrip: (newTrip: TripData) => Promise<void>;
  handleApplyAIOptimization: (actionTitle?: string, actionReason?: string, costSaved?: string) => void;
  handleAddActivity: (newAct: Activity, targetDayIndex?: number) => void;
  handleUpdateTripBudget: (updated: TripData) => Promise<void>;
}) {
  const currentDay = trip.days.find((d) => d.dayIndex === currentDayIndex) || trip.days[0] || {
    dayIndex: 1,
    fullDate: 'Ngày 1',
    dayName: 'T2',
    dateNum: 1,
    activities: [],
    dispatcherNote: '',
  };
  const nextStop =
    currentDay?.activities?.find((a) => a.status === 'Đang diễn ra') ||
    currentDay?.activities?.find((a) => a.status !== 'Hoàn tất') ||
    currentDay?.activities?.[0];
  const allActs = trip.days.flatMap((day) => day.activities || []);
  const totalActivities = allActs.length;
  const confirmedActivitiesCount = allActs.filter((a) => a.status === 'Hoàn tất' || a.status === 'Đã xác nhận').length;

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

            <div
              onClick={() => {
                if (nextStop) {
                  setSelectedActivity(nextStop);
                  setCurrentDayIndex(currentDay.dayIndex);
                  setCurrentTab('schedule');
                }
              }}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Điểm đến tiếp theo (Ngày {currentDay.dayIndex})</p>
                <span className="text-[10px] font-bold text-teal-600 group-hover:underline">Xem chi tiết →</span>
              </div>
              <h3 className="mt-2 text-2xl font-black text-slate-900 group-hover:text-teal-700 transition">{nextStop?.title || 'Mở lịch trình'}</h3>
              <p className="mt-2 text-sm text-slate-600 line-clamp-2">{nextStop?.details || 'Bạn có thể xem toàn bộ hoạt động trong phần Lịch trình.'}</p>
              <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 font-semibold flex items-center justify-between">
                <span>Thời gian: {nextStop ? `${nextStop.timeStart} — ${nextStop.timeEnd}` : 'Cập nhật sớm'}</span>
                {nextStop?.location && <span className="text-xs text-emerald-800 font-normal truncate max-w-[180px]">{nextStop.location}</span>}
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
              <div className="mt-3 text-3xl font-black text-slate-900">{confirmedActivitiesCount}/{totalActivities}</div>
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
                onDeleteActivity={handleDeleteActivity}
                onEditActivity={handleEditActivity}
                onAddDay={handleAddDay}
                onDeleteDay={handleDeleteDay}
                onUpdateDayNote={handleUpdateDayNote}
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
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Chi tiết Lịch trình Chuyến đi</h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Hành trình {trip.title} • {trip.totalDays} ngày ({confirmedActivitiesCount}/{totalActivities} hoạt động đã xác nhận)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterMode(filterMode === 'timeline' ? 'all' : 'timeline')}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    {filterMode === 'timeline' ? 'Hiện toàn bộ ngày' : 'Chế độ timeline'}
                  </button>
                  <button
                    onClick={() => setIsAddActivityOpen(true)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
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
      <AddActivityModal
        isOpen={isAddActivityOpen}
        onClose={() => setIsAddActivityOpen(false)}
        dayIndex={currentDayIndex}
        days={trip.days}
        defaultLocation={trip.destinationFull}
        onAdd={handleAddActivity}
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
