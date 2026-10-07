/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
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
  LocationsManagementView,
  SystemDataManagementView,
  UsersManagementView,
} from './components/AdminManagementViews';
import { initialTripData } from './data/mockData';
import { TripData, Activity, TripMember } from './types/travel';
import { authenticatedFetch } from './api';
import { firebaseAuth, firebaseAuthConfigured } from './firebase';

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
    if (!firebaseAuth) {
      setMessage('Firebase chưa được cấu hình. Hãy thiết lập các biến VITE_FIREBASE_* trong tệp .env.');
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
        'auth/operation-not-allowed': 'Firebase chưa bật phương thức Email/Password. Hãy bật tại Firebase Console > Authentication > Sign-in method.',
        'auth/admin-restricted-operation': 'Firebase đang chặn đăng ký Email/Password. Hãy kiểm tra Authentication settings trong Firebase Console.',
        'auth/unauthorized-domain': 'Tên miền hiện tại chưa được cho phép trong Firebase Authentication > Settings > Authorized domains.',
        'auth/network-request-failed': 'Không kết nối được Firebase. Hãy kiểm tra mạng và thử lại.',
        'auth/invalid-api-key': 'Firebase API key không hợp lệ. Hãy kiểm tra VITE_FIREBASE_API_KEY trong .env.',
        'auth/app-not-authorized': 'Ứng dụng chưa được cấp quyền cho Firebase project này. Hãy kiểm tra cấu hình Web app.',
      };
      console.error('Firebase authentication failed:', code || error);
      setMessage(messages[code || ''] || `Firebase trả về lỗi${code ? ` (${code})` : ''}. Hãy kiểm tra cấu hình Firebase và thử lại.`);
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

          <button type="submit" disabled={isSubmitting || !firebaseAuthConfigured} className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? 'Đang xác thực...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>

        {!firebaseAuthConfigured && <p className="mt-4 text-sm text-amber-300">Firebase Authentication chưa được cấu hình.</p>}
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
        setAuthUser({
          id: user.uid,
          name: user.displayName || user.email || 'Người dùng',
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
    if (!isAdminMode && ['locations', 'users', 'system'].includes(currentTab)) {
      setCurrentTab('dashboard');
    }
  }, [isAdminMode, currentTab]);

  const handleSelectTab = (tab: string) => {
    if (!isAdminMode && ['locations', 'users', 'system'].includes(tab)) {
      setCurrentTab('dashboard');
      return;
    }

    setCurrentTab(tab);
  };

  useEffect(() => {
    let cancelled = false;

    if (!authUser) return;
    setFirebaseStatus('loading');
    authenticatedFetch('/api/trips')
      .then(async (response) => {
        if (!response.ok) throw new Error('Không thể tải dữ liệu chuyến đi');
        return response.json();
      })
      .then(({ activeTrip: savedTrip, trips: savedTrips }) => {
        if (cancelled || !savedTrip) return;
        const correctedTrip = sanitizeTripData(savedTrip) as TripData;
        const correctedTrips = Array.isArray(savedTrips)
          ? savedTrips.map((saved: TripData) => sanitizeTripData(saved) as TripData)
          : [correctedTrip];
        setTrips(correctedTrips);
        setTrip(correctedTrip);
        setCurrentDayIndex(correctedTrip.currentDay || 1);
        setFirebaseStatus('connected');
        setLoadedTripUserId(authUser.id);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Firebase sync error:', error);
        setFirebaseStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || authUser.role !== 'admin' || loadedTripUserId !== authUser.id) return;

    const timeout = window.setTimeout(() => {
      authenticatedFetch('/api/trips/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trip),
      })
        .then((response) => {
          if (!response.ok) throw new Error('Không thể lưu dữ liệu chuyến đi');
          setFirebaseStatus('connected');
        })
        .catch((error) => {
          console.error('Firebase sync error:', error);
          setFirebaseStatus('error');
        });
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

  // Handler: Apply AI Optimization (Swap itinerary & resolve rain risk)
  const handleApplyAIOptimization = (actionTitle?: string, actionReason?: string, costSaved?: string) => {
    setTrip((prev) => {
      const updatedDays = prev.days.map((day) => {
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

      // Filter or update alert
      const remainingAlerts = prev.alerts.filter((a) => a.id !== 'alt-1');

      return {
        ...prev,
        alerts: remainingAlerts,
        days: updatedDays,
        budgetRemaining: prev.budgetRemaining + (Number(costSaved?.replace(/\D/g, '')) || 0),
        aiSavingsEstimate: costSaved || prev.aiSavingsEstimate,
        confirmedActivities: prev.confirmedActivities + 1,
        pendingActivities: Math.max(0, prev.pendingActivities - 1),
      };
    });

    setIsAIApplied(true);
  };

  // Handler: Add Activity
  const handleAddActivity = (newAct: Activity) => {
    setTrip((prev) => {
      const updatedDays = prev.days.map((d) => {
        if (d.dayIndex === currentDayIndex) {
          return {
            ...d,
            activities: [...d.activities, newAct],
          };
        }
        return d;
      });

      return {
        ...prev,
        totalActivities: prev.totalActivities + 1,
        days: updatedDays,
      };
    });
  };

  // Handler: Update Activity status
  const handleUpdateActivityStatus = (id: string, newStatus: Activity['status']) => {
    setTrip((prev) => {
      const updatedDays = prev.days.map((d) => ({
        ...d,
        activities: d.activities.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
      }));

      return {
        ...prev,
        days: updatedDays,
      };
    });
  };

  const handleToggleMemberAttendance = async (id: string) => {
    const member = trip.members.find((item) => item.id === id);
    if (!member) return;

    const attendanceStatus: TripMember['attendanceStatus'] = member.attendanceStatus === 'Có mặt' ? 'Vắng mặt' : 'Có mặt';
    if (!isAdminMode) {
      try {
        const response = await authenticatedFetch(`/api/trips/${encodeURIComponent(trip.id)}/members/${encodeURIComponent(id)}/attendance`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendanceStatus }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Không thể lưu trạng thái điểm danh');
        }

        setTrip((prev) => ({
          ...prev,
          members: prev.members.map((item) => item.id === id ? result.member : item),
          membersStatus: result.membersStatus,
        }));
        setFirebaseStatus('connected');
      } catch (error) {
        setFirebaseStatus('error');
        throw error;
      }
      return;
    }

    setTrip((prev) => {
      const members = prev.members.map((item) => item.id === id ? { ...item, attendanceStatus } : item);
      const presentCount = members.filter((item) => item.attendanceStatus === 'Có mặt').length;
      return {
        ...prev,
        members,
        membersStatus: `${presentCount}/${members.length} đã điểm danh`,
      };
    });
  };

  // Handler: Dismiss Alert
  const handleDismissAlert = (id: string) => {
    setTrip((prev) => ({
      ...prev,
      alerts: prev.alerts.filter((a) => a.id !== id),
    }));
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
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Không thể lưu chuyến đi mới');
    }

    const savedTrip = sanitizeTripData(result.trip) as TripData;
    setTrips((prev) => [savedTrip, ...prev.filter((item) => item.id !== savedTrip.id)]);
    setTrip(savedTrip);
    setCurrentDayIndex(1);
    setIsAIApplied(false);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-300">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  if (authUser.role === 'admin') {
    return (
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
        handleDismissAlert={handleDismissAlert}
      />
    );
  }

  return (
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
      authUser={authUser}
      onLogout={() => {
        if (firebaseAuth) void signOut(firebaseAuth);
      }}
      setCurrentTab={setCurrentTab}
      setSelectedActivity={setSelectedActivity}
      selectedActivity={selectedActivity}
      handleUpdateActivityStatus={handleUpdateActivityStatus}
      handleToggleMemberAttendance={handleToggleMemberAttendance}
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
    />
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
  handleDismissAlert,
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
  handleDismissAlert: (id: string) => void;
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
            <AdminDashboardView trip={trip} firebaseStatus={firebaseStatus} />
          )}

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
                  <LiveRouteMap trip={trip} onSelectWaypoint={(wp) => console.log('Selected waypoint:', wp.name)} />
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
              />
            </>
          )}

          {currentTab === 'locations' && <LocationsManagementView trip={trip} />}
          {currentTab === 'users' && <UsersManagementView trip={trip} />}
          {currentTab === 'system' && <SystemDataManagementView firebaseStatus={firebaseStatus} />}

          {currentTab === 'trips' && (
            <TripsListView
              trips={trips}
              currentTrip={trip}
              onSelectTrip={onSelectTrip}
              onOpenCreateModal={() => setIsAIPlannerOpen(true)}
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
              <LiveRouteMap trip={trip} />
            </div>
          )}

          {currentTab === 'members' && (
            <MembersView members={trip.members} onToggleStatus={handleToggleMemberAttendance} />
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
  authUser,
  onLogout,
  setCurrentTab,
  setSelectedActivity,
  selectedActivity,
  handleUpdateActivityStatus,
  handleToggleMemberAttendance,
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
  authUser: AuthUser;
  onLogout: () => void;
  setCurrentTab: React.Dispatch<React.SetStateAction<string>>;
  setSelectedActivity: React.Dispatch<React.SetStateAction<Activity | null>>;
  selectedActivity: Activity | null;
  handleUpdateActivityStatus: (id: string, newStatus: Activity['status']) => void;
  handleToggleMemberAttendance: (id: string) => Promise<void>;
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
}) {
  const nextStop = trip.days[currentDayIndex]?.activities?.[0];
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
        />

        <main className="flex-1 p-5 md:p-6 space-y-5 max-w-[1500px] w-full mx-auto">
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
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Điểm đến tiếp theo</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">{nextStop?.title || 'Mở lịch trình'}</h3>
              <p className="mt-2 text-sm text-slate-600">{nextStop?.details || 'Bạn có thể xem toàn bộ hoạt động trong phần Lịch trình.'}</p>
              <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 font-semibold">
                Thời gian: {nextStop ? '08:30 - 11:00' : 'Cập nhật sớm'}
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
              <p className="text-sm text-slate-500">Còn lại trong kế hoạch</p>
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
                  <button onClick={() => setCurrentTab('schedule')} className="rounded-2xl bg-teal-50 border border-teal-200 px-3 py-3 text-left text-sm font-bold text-teal-800 hover:bg-teal-100">Nhập điểm đến và ngày</button>
                  <button onClick={() => setIsAIPlannerOpen(true)} className="rounded-2xl bg-violet-50 border border-violet-200 px-3 py-3 text-left text-sm font-bold text-violet-800 hover:bg-violet-100">AI tạo lịch trình</button>
                  <button onClick={() => setCurrentTab('map')} className="rounded-2xl bg-sky-50 border border-sky-200 px-3 py-3 text-left text-sm font-bold text-sky-800 hover:bg-sky-100">Xem bản đồ tuyến</button>
                  <button onClick={() => setCurrentTab('budget')} className="rounded-2xl bg-amber-50 border border-amber-200 px-3 py-3 text-left text-sm font-bold text-amber-800 hover:bg-amber-100">Quản lý ngân sách</button>
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
            />
          )}

          {currentTab === 'map' && <LiveRouteMap trip={trip} />}

          {currentTab === 'members' && <MembersView members={trip.members} onToggleStatus={handleToggleMemberAttendance} />}

          {currentTab === 'budget' && <BudgetView trip={trip} />}
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
