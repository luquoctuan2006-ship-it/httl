import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '../firebase';
import type { AuthUser } from '../types/auth';
import {
  clearPendingRegisteredDisplayName,
  getPendingRegisteredDisplayName,
  PROFILE_UPDATED_EVENT,
} from '../utils/trip/tripSyncHelpers';

export function useAuthSession() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      setAuthLoading(false);
      return;
    }

    const handleProfileUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ uid?: string; displayName?: string }>;
      const uid = custom.detail?.uid;
      const displayName = custom.detail?.displayName;
      if (!uid || !displayName) return;
      setAuthUser((prev) => (prev && prev.id === uid ? { ...prev, name: displayName } : prev));
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setAuthLoading(false);
        return;
      }

      try {
        // Quyền admin chỉ lấy từ custom claim `role` đã được Firebase ký.
        const token = await user.getIdTokenResult();
        const pendingName = getPendingRegisteredDisplayName(user.uid);
        const resolvedName =
          user.displayName || pendingName || user.email?.split('@')[0] || 'Người dùng';
        if (user.displayName) {
          clearPendingRegisteredDisplayName(user.uid);
        }
        setAuthUser({
          id: user.uid,
          name: resolvedName,
          email: user.email || '',
          role: token.claims.role === 'admin' ? 'admin' : 'user',
        });
      } catch {
        setAuthUser(null);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
      unsubscribe();
    };
  }, []);

  const clearAuthUser = useCallback(() => {
    setAuthUser(null);
  }, []);

  const updateAuthUserName = useCallback((newName: string) => {
    setAuthUser((prev) => (prev ? { ...prev, name: newName } : prev));
  }, []);

  return {
    authUser,
    authUserId: authUser?.id || null,
    authLoading,
    clearAuthUser,
    updateAuthUserName,
  };
}
