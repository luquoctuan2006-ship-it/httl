/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { KeyRound } from 'lucide-react';
import { safeJsonResponse } from '../../api';
import { firebaseAuth } from '../../firebase';
import type { GuestTripData } from '../../types/travel';
import { isValidJoinCodeFormat, normalizeJoinCode } from '../../utils/trip/tripJoinHelpers';
import { mapFirebaseAuthError, setPendingRegisteredDisplayName } from '../../utils/trip/tripSyncHelpers';

interface AuthScreenProps {
  initialGuestCode?: string;
  onEnterGuestTrip?: (payload: { joinCode: string; guestName: string; trip: GuestTripData }) => void;
}

export function AuthScreen({ initialGuestCode = '', onEnterGuestTrip }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset' | 'guest'>(
    initialGuestCode ? 'guest' : 'login',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guestCode, setGuestCode] = useState(initialGuestCode);
  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialGuestCode) {
      setGuestCode(initialGuestCode);
      setMode('guest');
    }
  }, [initialGuestCode]);

  const handleGuestSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setSuccessMessage('');

    const cleanCode = normalizeJoinCode(guestCode);
    if (!isValidJoinCodeFormat(cleanCode)) {
      setMessage('Vui lòng nhập mã chuyến đi hợp lệ (5–12 ký tự chữ hoặc số).');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/guest/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          joinCode: cleanCode,
          guestName: guestName.trim() || undefined,
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
        throw new Error(result?.error || 'Không thể vào chuyến đi bằng mã này.');
      }

      onEnterGuestTrip?.({
        joinCode: result.joinCode || cleanCode,
        guestName: result.guestName || guestName.trim() || 'Hành khách',
        trip: result.trip,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể kết nối máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'guest') {
      await handleGuestSubmit(event);
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setSuccessMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setMessage('Vui lòng nhập định dạng email hợp lệ.');
      setIsSubmitting(false);
      return;
    }

    if (mode !== 'reset' && cleanPassword.length < 6) {
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
      } else if (mode === 'register') {
        const cleanName = name.trim();
        const credential = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, cleanPassword);
        setPendingRegisteredDisplayName(credential.user.uid, cleanName);
        try {
          await updateProfile(credential.user, { displayName: cleanName });
          await credential.user.reload().catch(() => {});
          setPendingRegisteredDisplayName(credential.user.uid, cleanName);
        } catch {}
      } else {
        await sendPasswordResetEmail(firebaseAuth, cleanEmail);
        setSuccessMessage(`Đã gửi liên kết đặt lại mật khẩu tới ${cleanEmail}. Vui lòng kiểm tra hộp thư (kể cả mục Spam).`);
      }
    } catch (error: any) {
      console.warn('Firebase auth failed:', error?.code);
      setMessage(mapFirebaseAuthError(error?.code, mode));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/60">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-xl font-black text-white shadow-lg shadow-teal-600/30">
            V
          </div>
          <h1 className="text-2xl font-black text-white">Voyager Travel Ops</h1>
          <p className="mt-2 text-sm text-slate-400">
            {mode === 'login'
              ? 'Đăng nhập vào hệ thống'
              : mode === 'register'
                ? 'Tạo tài khoản mới'
                : mode === 'guest'
                  ? 'Xem lịch trình đoàn dành cho Hành khách (không cần tài khoản)'
                  : 'Khôi phục mật khẩu qua email'}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-3 rounded-xl bg-slate-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setPassword('');
              setMessage('');
              setSuccessMessage('');
            }}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition ${mode === 'login' || mode === 'reset' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-300 hover:text-white'}`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setName('');
              setPassword('');
              setMessage('');
              setSuccessMessage('');
            }}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition ${mode === 'register' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-300 hover:text-white'}`}
          >
            Đăng ký
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('guest');
              setMessage('');
              setSuccessMessage('');
            }}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition ${mode === 'guest' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-300 hover:text-white'}`}
          >
            Vào bằng mã
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'guest' ? (
            <>
              <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 text-xs text-teal-200 flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <span>
                  Nhập <strong>Mã chuyến đi</strong> do trưởng đoàn hoặc người thân cung cấp để xem lịch trình, bản đồ và liên hệ đoàn ngay lập tức.
                </span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Mã tham gia chuyến đi *
                </label>
                <input
                  type="text"
                  value={guestCode}
                  onChange={(e) => setGuestCode(e.target.value.toUpperCase())}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-mono font-bold tracking-[0.2em] uppercase text-white outline-none placeholder:text-slate-500 focus:border-teal-500"
                  placeholder="V8K4M2"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Tên hiển thị của hành khách (tùy chọn)
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-teal-500"
                  placeholder="Ví dụ: Cô Lan (Người thân anh Bình)"
                />
              </div>
            </>
          ) : (
            <>
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
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Mật khẩu</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('reset');
                          setPassword('');
                          setMessage('');
                          setSuccessMessage('');
                        }}
                        className="text-xs font-semibold text-teal-400 hover:text-teal-300 hover:underline"
                      >
                        Quên mật khẩu?
                      </button>
                    )}
                  </div>
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
              )}
            </>
          )}

          {message && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-300 flex items-start gap-2">
              <span>⚠️</span>
              <span>{message}</span>
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-300 flex items-start gap-2">
              <span>✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-teal-900/30 active:scale-98"
          >
            {isSubmitting
              ? 'Đang xử lý...'
              : mode === 'guest'
                ? 'Vào xem chuyến đi (Không cần tài khoản)'
                : mode === 'login'
                  ? 'Đăng nhập vào hệ thống'
                  : mode === 'register'
                    ? 'Tạo tài khoản & Đăng nhập'
                    : 'Gửi email đặt lại mật khẩu'}
          </button>

          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setMessage('');
                setSuccessMessage('');
              }}
              className="w-full text-center text-xs font-semibold text-slate-400 hover:text-white pt-1"
            >
              ← Quay lại đăng nhập
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
