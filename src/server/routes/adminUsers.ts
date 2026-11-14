import type { Express, Request, RequestHandler, Response } from 'express';
import type { Auth as FirebaseAdminAuth, DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { ManagedUserRecord } from '../../types/auth';

type AuthenticatedRequest = Request & { authUser?: DecodedIdToken };

interface AdminUserRouteDependencies {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  firebaseAuth: FirebaseAdminAuth | null;
  firestore: Firestore | null;
  recordAuditLog: (user: string, action: string) => Promise<void>;
}

export function registerAdminUserRoutes(app: Express, dependencies: AdminUserRouteDependencies) {
  const { requireAuth, requireAdmin, firebaseAuth, firestore, recordAuditLog } = dependencies;
  app.get('/api/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    if (!firebaseAuth || !firestore) {
      return res.status(503).json({ success: false, error: 'Firebase Auth / Firestore chưa sẵn sàng' });
    }
    try {
      const pageToken = typeof req.query.pageToken === 'string' && req.query.pageToken.trim() ? req.query.pageToken.trim() : undefined;
      const pageSize = Math.min(Math.max(Number.parseInt(String(req.query.limit || req.query.pageSize || '100'), 10) || 100, 10), 1000);
  
      const page = await firebaseAuth.listUsers(pageSize, pageToken);
      const fetchedUsers = page.users;
      const nextPageToken = page.pageToken || undefined;
  
      const firestoreUsersMap: Record<string, any> = {};
      try {
        const snap = await firestore.collection('users').get();
        snap.docs.forEach((doc) => {
          firestoreUsersMap[doc.id] = doc.data();
        });
      } catch { /* ignored */ }
  
      const mappedUsers: ManagedUserRecord[] = fetchedUsers.map((u) => {
        const fsUser = firestoreUsersMap[u.uid] || {};
        // Xác thực quyền Admin từ Custom Claims hoặc Firestore, không dựa trên email cố định
        const isAdmin = u.customClaims?.role === 'admin' || fsUser.role === 'Admin';
        const role = isAdmin ? 'Admin' : 'Khách du lịch';
        const createdDate = u.metadata.creationTime ? new Date(u.metadata.creationTime).toLocaleDateString('vi-VN') : 'Mới tạo';
        const lastLogin = u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toLocaleString('vi-VN') : 'Chưa đăng nhập';
        return {
          id: u.uid,
          name: u.displayName || fsUser.name || u.email?.split('@')[0] || 'Người dùng',
          email: u.email || '',
          phone: u.phoneNumber || fsUser.phone || '',
          role,
          isLocked: !!u.disabled,
          createdAt: createdDate,
          lastLogin,
        };
      });
  
      return res.json({
        success: true,
        users: mappedUsers,
        ...(nextPageToken ? { nextPageToken } : {}),
      });
    } catch (err: unknown) {
      console.error('[Users] Failed to fetch users from Firebase Auth:', err);
      return res.status(500).json({
        success: false,
        error: 'Lỗi máy chủ khi tải danh sách người dùng từ Firebase Auth',
      });
    }
  });
  
  // Add / Upsert Managed User
  app.post('/api/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    if (!firebaseAuth || !firestore) {
      return res.status(503).json({ success: false, error: 'Firebase Auth / Firestore chưa sẵn sàng' });
    }
    const { name, email, phone, role } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Thiếu tên hoặc email' });
    }
  
    const cleanEmail = String(email).trim().toLowerCase();
    const targetRole = role === 'Admin' ? 'Admin' : 'Khách du lịch';
    const roleClaim = targetRole === 'Admin' ? 'admin' : 'user';
  
    try {
      let userRecord: UserRecord | null = null;
      try {
        userRecord = await firebaseAuth.getUserByEmail(cleanEmail);
      } catch (lookupErr: any) {
        if (lookupErr.code !== 'auth/user-not-found') {
          throw lookupErr;
        }
      }
  
      let passwordResetLink: string | null = null;
      if (userRecord) {
        userRecord = await firebaseAuth.updateUser(userRecord.uid, {
          displayName: String(name).trim(),
        });
      } else {
        // Tạo tài khoản an toàn không mật khẩu, sinh link thiết lập mật khẩu gửi cho người dùng
        userRecord = await firebaseAuth.createUser({
          email: cleanEmail,
          displayName: String(name).trim(),
        });
        try {
          passwordResetLink = await firebaseAuth.generatePasswordResetLink(cleanEmail);
        } catch (linkErr) {
          console.warn('[Users] Không thể tạo password reset link:', linkErr);
        }
      }
  
      // Hợp nhất (merge) claims thay vì ghi đè mất claims khác
      await firebaseAuth.setCustomUserClaims(userRecord.uid, {
        ...(userRecord.customClaims || {}),
        role: roleClaim,
      });
      await firebaseAuth.revokeRefreshTokens(userRecord.uid);
  
      await firestore.collection('users').doc(userRecord.uid).set({
        name: String(name).trim(),
        email: cleanEmail,
        phone: String(phone || '').trim(),
        role: targetRole,
        isLocked: !!userRecord.disabled,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
  
      recordAuditLog(req.authUser?.email || 'Admin', `Thêm/Cập nhật tài khoản Auth: ${name} (${cleanEmail}) - Vai trò: ${targetRole}`);
  
      const createdDate = userRecord.metadata?.creationTime ? new Date(userRecord.metadata.creationTime).toLocaleDateString('vi-VN') : 'Hôm nay';
      const createdUser: ManagedUserRecord = {
        id: userRecord.uid,
        name: String(name).trim(),
        email: cleanEmail,
        phone: String(phone || '').trim(),
        role: targetRole,
        isLocked: !!userRecord.disabled,
        createdAt: createdDate,
        lastLogin: 'Chưa đăng nhập',
      };
      return res.json({
        success: true,
        user: createdUser,
        ...(passwordResetLink ? { resetLink: passwordResetLink } : {}),
      });
    } catch (err: unknown) {
      console.error('[Users] Error creating user in Firebase Auth:', err);
      const msg = err instanceof Error ? err.message : 'Không thể tạo tài khoản trên Firebase Auth';
      return res.status(500).json({ success: false, error: msg });
    }
  });
  
  async function countOtherActiveAdmins(authClient: FirebaseAdminAuth, excludeUid: string): Promise<number> {
    let count = 0;
    let pageToken: string | undefined = undefined;
    do {
      const list = await authClient.listUsers(1000, pageToken);
      for (const u of list.users) {
        if (u.uid !== excludeUid && u.customClaims?.role === 'admin' && !u.disabled) {
          count++;
          return count; // Early return as soon as another active admin is found
        }
      }
      pageToken = list.pageToken;
    } while (pageToken);
    return count;
  }
  
  // Update User (Lock/Unlock, Role)
  app.patch('/api/admin/users/:userId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    if (!firebaseAuth || !firestore) {
      return res.status(503).json({ success: false, error: 'Firebase Auth / Firestore chưa sẵn sàng' });
    }
    const { userId } = req.params;
    const { isLocked, role } = req.body;
  
    // 1. Chống tự khóa hoặc tự hạ quyền tài khoản của chính mình
    if (req.authUser?.uid === userId) {
      if (isLocked === true) {
        return res.status(400).json({ success: false, error: 'Không thể tự khóa tài khoản của chính mình.' });
      }
      if (role && role !== 'Admin') {
        return res.status(400).json({ success: false, error: 'Không thể tự hạ quyền Admin của chính mình.' });
      }
    }
  
    try {
      let targetUser: UserRecord;
      try {
        targetUser = await firebaseAuth.getUser(userId);
      } catch (getErr: any) {
        if (getErr.code === 'auth/user-not-found') {
          return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng trong Firebase Auth' });
        }
        throw getErr;
      }
  
      // 2. Chống khóa hoặc hạ quyền Admin duy nhất còn hoạt động trong hệ thống
      const isTargetAdmin = targetUser.customClaims?.role === 'admin';
      if (isTargetAdmin && (isLocked === true || (role && role !== 'Admin'))) {
        const otherActiveAdmins = await countOtherActiveAdmins(firebaseAuth, userId);
        if (otherActiveAdmins === 0) {
          return res.status(400).json({
            success: false,
            error: 'Không thể khóa hoặc hạ quyền Admin duy nhất còn hoạt động trong hệ thống.',
          });
        }
      }
  
      const updates: { disabled?: boolean } = {};
      if (typeof isLocked === 'boolean') {
        updates.disabled = isLocked;
      }
      if (Object.keys(updates).length > 0) {
        await firebaseAuth.updateUser(userId, updates);
        if (isLocked) {
          await firebaseAuth.revokeRefreshTokens(userId);
        }
      }
  
      if (role && typeof role === 'string') {
        const roleClaim = role === 'Admin' ? 'admin' : 'user';
        // Hợp nhất (merge) claims
        await firebaseAuth.setCustomUserClaims(userId, {
          ...(targetUser.customClaims || {}),
          role: roleClaim,
        });
        await firebaseAuth.revokeRefreshTokens(userId);
      }
  
      const docUpdates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (typeof isLocked === 'boolean') docUpdates.isLocked = isLocked;
      if (role) docUpdates.role = role;
      await firestore.collection('users').doc(userId).set(docUpdates, { merge: true });
  
      const updatedRecord = await firebaseAuth.getUser(userId);
      const auditMsg = `${typeof isLocked === 'boolean' ? (isLocked ? 'Khóa' : 'Mở khóa') : ''} ${role ? `Đổi vai trò -> ${role}` : ''} cho tài khoản ${updatedRecord.email}`;
      recordAuditLog(req.authUser?.email || 'Admin', auditMsg.trim());
  
      const finalRole: 'Admin' | 'Khách du lịch' = updatedRecord.customClaims?.role === 'admin' ? 'Admin' : 'Khách du lịch';
      return res.json({
        success: true,
        user: {
          id: updatedRecord.uid,
          name: updatedRecord.displayName || updatedRecord.email?.split('@')[0] || 'User',
          email: updatedRecord.email || '',
          phone: updatedRecord.phoneNumber || '',
          role: finalRole,
          isLocked: !!updatedRecord.disabled,
          createdAt: updatedRecord.metadata?.creationTime ? new Date(updatedRecord.metadata.creationTime).toLocaleDateString('vi-VN') : '',
          lastLogin: updatedRecord.metadata?.lastSignInTime ? new Date(updatedRecord.metadata.lastSignInTime).toLocaleString('vi-VN') : '',
        },
      });
    } catch (err: unknown) {
      console.error('[Users] Error updating Firebase user:', err);
      const errMsg = err instanceof Error ? err.message : 'Lỗi cập nhật người dùng trên Firebase Auth';
      return res.status(500).json({ success: false, error: errMsg });
    }
  });
  
  // Dọn dẹp toàn bộ dữ liệu Firestore gắn với userId TRƯỚC khi xóa Firebase Auth để tránh dữ liệu mồ côi
  async function cleanupUserFirestoreData(db: Firestore, userId: string): Promise<void> {
    const deleteByField = async (collectionName: string, fieldName: string) => {
      const snap = await db.collection(collectionName).where(fieldName, '==', userId).get();
      if (!snap.empty) {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
          const chunk = snap.docs.slice(i, i + CHUNK_SIZE);
          const batch = db.batch();
          chunk.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }
    };
  
    await deleteByField('trips', 'ownerId');
    await deleteByField('trip_receipts', 'ownerId');
    await deleteByField('gemini_jobs', 'ownerUid');
  
    const metaBatch = db.batch();
    metaBatch.delete(db.collection('users').doc(userId));
    metaBatch.delete(db.collection('user_metadata').doc(userId));
    await metaBatch.commit();
  }
  
  // Người dùng tự xóa tài khoản và toàn bộ dữ liệu của chính mình (Self-service Account Deletion)
  app.delete('/api/account/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!firebaseAuth || !firestore) {
      return res.status(503).json({ success: false, error: 'Firebase Auth / Firestore chưa sẵn sàng' });
    }
  
    const uid = req.authUser!.uid;
    try {
      const targetUser = await firebaseAuth.getUser(uid);
      if (targetUser.customClaims?.role === 'admin') {
        const otherActiveAdmins = await countOtherActiveAdmins(firebaseAuth, uid);
        if (otherActiveAdmins === 0) {
          return res.status(400).json({
            success: false,
            error: 'Không thể tự xóa tài khoản Admin duy nhất còn hoạt động trong hệ thống.',
          });
        }
      }
  
      // Dọn dẹp toàn bộ dữ liệu Firestore trước rồi mới xóa Auth để tránh mồ côi dữ liệu
      await cleanupUserFirestoreData(firestore, uid);
      await firebaseAuth.deleteUser(uid);
      recordAuditLog(
        targetUser.email || uid,
        `Người dùng tự xóa tài khoản và toàn bộ dữ liệu cá nhân (${targetUser.email || uid})`
      );
      return res.json({ success: true, message: 'Đã xóa vĩnh viễn tài khoản và toàn bộ dữ liệu của bạn.' });
    } catch (err: unknown) {
      console.error('[Account] Error self-deleting user:', err);
      const errMsg = err instanceof Error ? err.message : 'Không thể xóa tài khoản lúc này';
      return res.status(500).json({ success: false, error: errMsg });
    }
  });
  
  // Delete User (Admin)
  app.delete('/api/admin/users/:userId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    if (!firebaseAuth || !firestore) {
      return res.status(503).json({ success: false, error: 'Firebase Auth / Firestore chưa sẵn sàng' });
    }
    const { userId } = req.params;
  
    // 1. Chống tự xóa tài khoản của chính mình qua route Admin (nên dùng tự xóa riêng)
    if (req.authUser?.uid === userId) {
      return res.status(400).json({ success: false, error: 'Không thể tự xóa tài khoản của chính mình tại màn hình quản trị.' });
    }
  
    try {
      let targetUser: UserRecord;
      try {
        targetUser = await firebaseAuth.getUser(userId);
      } catch (getErr: any) {
        if (getErr.code === 'auth/user-not-found') {
          return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng trong Firebase Auth' });
        }
        throw getErr;
      }
  
      // 2. Chống xóa Admin duy nhất còn hoạt động trong hệ thống
      if (targetUser.customClaims?.role === 'admin') {
        const otherActiveAdmins = await countOtherActiveAdmins(firebaseAuth, userId);
        if (otherActiveAdmins === 0) {
          return res.status(400).json({
            success: false,
            error: 'Không thể xóa Admin duy nhất còn hoạt động trong hệ thống.',
          });
        }
      }
  
      // 3. Dọn dẹp toàn bộ Firestore (trips, gemini_jobs, users, user_metadata) TRƯỚC khi xóa Auth
      await cleanupUserFirestoreData(firestore, userId);
      await firebaseAuth.deleteUser(userId);
      recordAuditLog(req.authUser?.email || 'Admin', `Đã xóa tài khoản Firebase Auth và dọn sạch dữ liệu: ${targetUser.displayName || targetUser.email} (${targetUser.email})`);
      return res.json({ success: true, message: 'Đã dọn sạch dữ liệu và xóa tài khoản thành công' });
    } catch (err: unknown) {
      console.error('[Users] Error deleting user safely:', err);
      const errMsg = err instanceof Error ? err.message : 'Lỗi xóa người dùng và dọn dẹp dữ liệu';
      return res.status(500).json({ success: false, error: errMsg });
    }
  });
  
  // CRITICAL: Protect all /api routes from falling through to Vite SPA html fallback!
}
