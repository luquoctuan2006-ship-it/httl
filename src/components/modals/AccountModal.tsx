import React, { useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { X, User, KeyRound, Mail, CheckCircle2, AlertCircle, Shield, Trash2 } from 'lucide-react';
import { authenticatedFetch, safeJsonResponse } from '../../api';
import { firebaseAuth } from '../../firebase';
import { AuthUser } from '../../types/auth';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser;
  onProfileUpdated: (newName: string) => void;
  onAccountDeleted?: () => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  authUser,
  onProfileUpdated,
  onAccountDeleted,
  onShowToast,
}) => {
  const [displayName, setDisplayName] = useState(authUser.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(authUser.name);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowDeleteConfirm(false);
    setDeletePassword('');
    setDeleteConfirmText('');
    setFeedback(null);
  }, [isOpen, authUser.name]);

  if (!isOpen) return null;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', text: 'Vui lòng nhập tên hiển thị hợp lệ.' });
      return;
    }
    if (!firebaseAuth?.currentUser) {
      setFeedback({ type: 'error', text: 'Chưa xác thực tài khoản Firebase.' });
      return;
    }

    setSavingProfile(true);
    setFeedback(null);
    try {
      await updateProfile(firebaseAuth.currentUser, { displayName: trimmed });
      onProfileUpdated(trimmed);
      setFeedback({ type: 'success', text: 'Đã cập nhật tên hiển thị thành công!' });
      onShowToast?.('Đã cập nhật hồ sơ tài khoản.', 'success');
    } catch (error: any) {
      setFeedback({ type: 'error', text: error?.message || 'Không thể cập nhật tên hiển thị.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseAuth?.currentUser || !firebaseAuth.currentUser.email) {
      setFeedback({ type: 'error', text: 'Không tìm thấy phiên đăng nhập email/mật khẩu.' });
      return;
    }
    if (newPassword.length < 6) {
      setFeedback({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }

    setSavingPassword(true);
    setFeedback(null);
    try {
      const credential = EmailAuthProvider.credential(firebaseAuth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseAuth.currentUser, credential);
      await updatePassword(firebaseAuth.currentUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ type: 'success', text: 'Đã đổi mật khẩu thành công!' });
      onShowToast?.('Đã đổi mật khẩu thành công!', 'success');
    } catch (error: any) {
      const code = error?.code || '';
      const msg =
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Mật khẩu hiện tại không đúng.'
          : code === 'auth/too-many-requests'
            ? 'Thử sai quá nhiều lần. Vui lòng thử lại sau.'
            : error?.message || 'Không thể đổi mật khẩu.';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!firebaseAuth || !authUser.email) {
      setFeedback({ type: 'error', text: 'Không tìm thấy địa chỉ email tài khoản.' });
      return;
    }
    setSendingReset(true);
    setFeedback(null);
    try {
      await sendPasswordResetEmail(firebaseAuth, authUser.email);
      setFeedback({
        type: 'success',
        text: `Đã gửi liên kết đặt lại mật khẩu tới ${authUser.email}. Vui lòng kiểm tra hộp thư.`,
      });
    } catch (error: any) {
      setFeedback({ type: 'error', text: error?.message || 'Không thể gửi email đặt lại mật khẩu.' });
    } finally {
      setSendingReset(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmText.trim().toUpperCase() !== 'XOA') {
      setFeedback({ type: 'error', text: 'Vui lòng nhập chính xác chữ XOA để xác nhận xóa vĩnh viễn tài khoản.' });
      return;
    }

    setDeletingAccount(true);
    setFeedback(null);
    try {
      const currentUser = firebaseAuth?.currentUser;
      const usesPassword = currentUser?.providerData?.some((p) => p.providerId === 'password');
      if (usesPassword && currentUser?.email) {
        if (!deletePassword) {
          setFeedback({ type: 'error', text: 'Vui lòng nhập mật khẩu hiện tại để xác minh danh tính.' });
          setDeletingAccount(false);
          return;
        }
        const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);
        await reauthenticateWithCredential(currentUser, credential);
      }

      const response = await authenticatedFetch('/api/account/me', {
        method: 'DELETE',
      });
      const result = await safeJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Không thể xóa tài khoản');
      }

      onShowToast?.('Đã xóa vĩnh viễn tài khoản và toàn bộ dữ liệu cá nhân.', 'success');
      onAccountDeleted?.();
    } catch (error: any) {
      const code = error?.code || '';
      const msg =
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Mật khẩu xác minh không chính xác.'
          : error?.message || 'Không thể xóa tài khoản.';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden text-slate-800 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">Quản lý Tài khoản</h3>
              <p className="text-[11px] text-slate-400">{authUser.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 font-semibold ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Thông tin hồ sơ */}
          <form onSubmit={handleSaveName} className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-teal-600" />
                <span>Thông tin cá nhân</span>
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                {authUser.role === 'admin' ? 'Quản trị viên (Admin)' : 'Người dùng (User)'}
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tên hiển thị *</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-teal-500 outline-none"
                placeholder="Nhập họ tên..."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition disabled:opacity-50"
              >
                {savingProfile ? 'Đang lưu...' : 'Lưu tên hiển thị'}
              </button>
            </div>
          </form>

          {/* Đổi mật khẩu */}
          <form onSubmit={handleChangePassword} className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-teal-600" />
              <span>Đổi mật khẩu</span>
            </h4>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Mật khẩu hiện tại *</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-teal-500 outline-none"
                placeholder="••••••••"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-teal-500 outline-none"
                  placeholder="Ít nhất 6 ký tự"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-teal-500 outline-none"
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={handleSendResetEmail}
                disabled={sendingReset}
                className="inline-flex items-center gap-1.5 text-teal-700 hover:text-teal-800 font-bold hover:underline disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{sendingReset ? 'Đang gửi email...' : 'Gửi email đặt lại mật khẩu'}</span>
              </button>

              <button
                type="submit"
                disabled={savingPassword}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition disabled:opacity-50"
              >
                {savingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
            </div>
          </form>

          {/* Vùng nguy hiểm: Tự xóa tài khoản và toàn bộ dữ liệu cá nhân */}
          <div className="space-y-3 p-4 rounded-2xl bg-rose-50/70 border border-rose-200">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-rose-900 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Xóa vĩnh viễn tài khoản</span>
                </h4>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Toàn bộ chuyến đi, hóa đơn và hồ sơ cá nhân của bạn sẽ bị xóa sạch khỏi hệ thống và không thể khôi phục.
                </p>
              </div>
              {!showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 font-bold shrink-0 transition"
                >
                  Xóa tài khoản
                </button>
              )}
            </div>

            {showDeleteConfirm && (
              <form onSubmit={handleDeleteAccount} className="space-y-3 pt-2 border-t border-rose-200">
                {firebaseAuth?.currentUser?.providerData?.some((p) => p.providerId === 'password') && (
                  <div>
                    <label className="block font-bold text-rose-900 mb-1">Mật khẩu hiện tại *</label>
                    <input
                      type="password"
                      required
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-slate-900 focus:border-rose-500 outline-none"
                      placeholder="Nhập mật khẩu để xác nhận"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-rose-900 mb-1">
                    Nhập chữ <span className="font-black underline">XOA</span> để xác nhận *
                  </label>
                  <input
                    type="text"
                    required
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-slate-900 focus:border-rose-500 outline-none"
                    placeholder="XOA"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword('');
                      setDeleteConfirmText('');
                    }}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={deletingAccount}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition disabled:opacity-50"
                  >
                    {deletingAccount ? 'Đang xóa dữ liệu...' : 'Xác nhận xóa vĩnh viễn'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
