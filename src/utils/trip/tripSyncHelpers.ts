import type { TripData } from '../../types/travel';

/**
 * Lỗi chuyên biệt khi payload vượt giới hạn document 900 KiB của Firestore (HTTP 413).
 * Không được xem đây là lỗi mất mạng hay tự động đưa vào hàng chờ retry vô tận.
 */
export class PayloadTooLargeError extends Error {
  readonly status = 413;

  constructor(
    message = 'Dung lượng chuyến đi vượt giới hạn 900KB của Firestore (thường do quá nhiều ảnh chứng từ). Vui lòng giảm bớt hoặc nén ảnh hóa đơn.',
  ) {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

/**
 * Hàng đợi tuần tự hóa (single-flight FIFO): tại mỗi thời điểm chỉ có tối đa một request lưu chạy,
 * tránh 2 request PUT song song gây xung đột version 409 ở lượt đầu.
 */
export class SingleFlightQueue {
  private tail: Promise<void> = Promise.resolve();
  private activeCount = 0;

  get isBusy(): boolean {
    return this.activeCount > 0;
  }

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.activeCount += 1;
    const run = this.tail.then(task, task);
    this.tail = run.then(
      () => {
        this.activeCount = Math.max(0, this.activeCount - 1);
      },
      () => {
        this.activeCount = Math.max(0, this.activeCount - 1);
      },
    );
    return run;
  }
}

/**
 * Chỉ gộp alerts, weather và version mới từ kết quả quét cảnh báo máy chủ vào chuyến đi cục bộ,
 * tuyệt đối không ghi đè các chỉnh sửa cục bộ khác của người dùng.
 */
export function mergeAlertScanIntoTrip(prevTrip: TripData, scannedTrip: TripData): TripData {
  if (prevTrip.id !== scannedTrip.id) return prevTrip;
  return {
    ...prevTrip,
    alerts: Array.isArray(scannedTrip.alerts) ? scannedTrip.alerts : prevTrip.alerts,
    weather: scannedTrip.weather ? { ...scannedTrip.weather } : prevTrip.weather,
    ...(typeof scannedTrip.version === 'number' ? { version: scannedTrip.version } : {}),
  };
}

/**
 * Tự động chuyển các ảnh chứng từ inline (`receiptImage`) sang lưu riêng (`receiptId`)
 * để giữ document `trips/{id}` luôn gọn nhẹ, tránh chạm trần 1 MiB của Firestore.
 */
export async function offloadTripReceipts(
  trip: TripData,
  uploadReceipt: (tripId: string, dataUrl: string) => Promise<string | null>,
): Promise<TripData> {
  const invoices = trip.invoices;
  if (!Array.isArray(invoices) || invoices.length === 0) return trip;

  let changed = false;
  const updatedInvoices = await Promise.all(
    invoices.map(async (inv) => {
      if (inv.receiptImage && inv.receiptImage.startsWith('data:image/')) {
        try {
          const uploadedId = await uploadReceipt(trip.id, inv.receiptImage);
          if (uploadedId) {
            changed = true;
            const { receiptImage: _inline, ...rest } = inv;
            return { ...rest, receiptId: uploadedId };
          }
        } catch {
          // Nếu chưa tải lên được (ví dụ ngoại tuyến hoặc lỗi tạm thời), giữ nguyên inline
        }
      }
      return inv;
    }),
  );

  return changed ? { ...trip, invoices: updatedInvoices } : trip;
}

function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toIsoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Chuyển chuỗi ngày hiển thị (ví dụ "12/10/2026 - 18/10/2026" hoặc "12–18 THG 10, 2026")
 * thành cặp ISO YYYY-MM-DD cho bộ chọn <input type="date">.
 */
export function parseTripDatesRange(
  datesStr: string | undefined,
  totalDays = 1,
): { startDate: string; endDate: string } {
  const raw = (datesStr || '').trim();

  // 1. Khớp 2 ngày DD/MM/YYYY
  const dmyMatches = Array.from(raw.matchAll(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/g));
  if (dmyMatches.length >= 2) {
    const startDate = toIsoDate(Number(dmyMatches[0][3]), Number(dmyMatches[0][2]), Number(dmyMatches[0][1]));
    const endDate = toIsoDate(Number(dmyMatches[1][3]), Number(dmyMatches[1][2]), Number(dmyMatches[1][1]));
    return { startDate, endDate: endDate >= startDate ? endDate : startDate };
  }
  if (dmyMatches.length === 1) {
    const startDate = toIsoDate(Number(dmyMatches[0][3]), Number(dmyMatches[0][2]), Number(dmyMatches[0][1]));
    return { startDate, endDate: addDaysIso(startDate, Math.max(0, totalDays - 1)) };
  }

  // 2. Khớp ISO YYYY-MM-DD
  const isoMatches = Array.from(raw.matchAll(/(\d{4})-(\d{1,2})-(\d{1,2})/g));
  if (isoMatches.length >= 2) {
    const startDate = toIsoDate(Number(isoMatches[0][1]), Number(isoMatches[0][2]), Number(isoMatches[0][3]));
    const endDate = toIsoDate(Number(isoMatches[1][1]), Number(isoMatches[1][2]), Number(isoMatches[1][3]));
    return { startDate, endDate: endDate >= startDate ? endDate : startDate };
  }
  if (isoMatches.length === 1) {
    const startDate = toIsoDate(Number(isoMatches[0][1]), Number(isoMatches[0][2]), Number(isoMatches[0][3]));
    return { startDate, endDate: addDaysIso(startDate, Math.max(0, totalDays - 1)) };
  }

  // 3. Khớp dạng "12–18 THG 10, 2026"
  const vnMatch = raw.match(/(\d{1,2})\s*[–—-]\s*(\d{1,2})\s*THG\s*(\d{1,2}),?\s*(\d{4})/i);
  if (vnMatch) {
    const d1 = Number(vnMatch[1]);
    const d2 = Number(vnMatch[2]);
    const month = Number(vnMatch[3]);
    const year = Number(vnMatch[4]);
    const startDate = toIsoDate(year, month, d1);
    const endDate = d2 >= d1 ? toIsoDate(year, month, d2) : addDaysIso(startDate, Math.max(0, totalDays - 1));
    return { startDate, endDate };
  }

  // Fallback: hôm nay -> +(totalDays - 1)
  const now = new Date();
  const todayIso = toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return {
    startDate: todayIso,
    endDate: addDaysIso(todayIso, Math.max(0, totalDays - 1)),
  };
}

export function validateTripDateRange(startDate: string, endDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return 'Vui lòng chọn đầy đủ ngày khởi hành và ngày kết thúc hợp lệ.';
  }
  if (endDate < startDate) {
    return 'Ngày kết thúc phải bằng hoặc sau ngày khởi hành.';
  }
  return null;
}

export function formatTripDatesRange(startDate: string, endDate: string): string {
  const formatDmy = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  };
  if (!startDate) return '';
  if (!endDate || startDate === endDate) return formatDmy(startDate);
  return `${formatDmy(startDate)} - ${formatDmy(endDate)}`;
}

/**
 * Kiểm tra giờ bắt đầu và giờ kết thúc hoạt động (định dạng HH:mm, 00:00–23:59)
 * và bắt buộc giờ kết thúc phải sau giờ bắt đầu.
 */
export function validateActivityTimeRange(timeStart: string, timeEnd: string): string | null {
  const parseClock = (val: string): number | null => {
    const m = String(val || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isInteger(h) || !Number.isInteger(min) || h < 0 || h > 23 || min < 0 || min > 59) {
      return null;
    }
    return h * 60 + min;
  };

  const startMins = parseClock(timeStart);
  const endMins = parseClock(timeEnd);

  if (startMins === null) {
    return 'Giờ bắt đầu không hợp lệ (định dạng HH:mm, ví dụ 09:00).';
  }
  if (endMins === null) {
    return 'Giờ kết thúc không hợp lệ (định dạng HH:mm, ví dụ 11:00).';
  }
  if (endMins <= startMins) {
    return 'Giờ kết thúc phải sau giờ bắt đầu.';
  }
  return null;
}

/**
 * Ánh xạ mã lỗi Firebase Auth sang thông báo tiếng Việt chi tiết theo error.code.
 */
export function mapFirebaseAuthError(
  code: string | undefined,
  mode: 'login' | 'register' | 'reset',
): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return mode === 'reset'
        ? 'Không tìm thấy tài khoản gắn với email này.'
        : 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
    case 'auth/invalid-email':
      return 'Địa chỉ email không đúng định dạng.';
    case 'auth/missing-email':
      return 'Vui lòng nhập địa chỉ email.';
    case 'auth/email-already-in-use':
      return 'Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập hoặc dùng Quên mật khẩu.';
    case 'auth/weak-password':
      return 'Mật khẩu quá yếu. Vui lòng dùng ít nhất 6 ký tự (nên kết hợp chữ và số).';
    case 'auth/too-many-requests':
      return 'Bạn đã thử thao tác quá nhiều lần liên tiếp. Vui lòng đợi ít phút rồi thử lại.';
    case 'auth/user-disabled':
      return 'Tài khoản này đã bị tạm khóa bởi quản trị viên.';
    case 'auth/network-request-failed':
      return 'Lỗi kết nối mạng. Vui lòng kiểm tra Wi-Fi hoặc 4G và thử lại.';
    case 'auth/operation-not-allowed':
      return 'Phương thức đăng nhập bằng Email/Mật khẩu chưa được bật trên Firebase.';
    default:
      if (mode === 'reset') {
        return code
          ? `Không thể gửi email đặt lại mật khẩu (${code}). Vui lòng kiểm tra lại địa chỉ email.`
          : 'Không thể gửi email đặt lại mật khẩu. Vui lòng kiểm tra lại địa chỉ email.';
      }
      if (mode === 'register') {
        return code
          ? `Không thể tạo tài khoản mới (${code}). Vui lòng kiểm tra thông tin.`
          : 'Không thể tạo tài khoản mới. Vui lòng thử lại.';
      }
      return code
        ? `Đăng nhập thất bại (${code}). Vui lòng thử lại.`
        : 'Không thể đăng nhập lúc này. Vui lòng thử lại.';
  }
}

/**
 * Lỗi xác thực / phân quyền HTTP (401/403): không được phép rơi về dữ liệu cache ngoại tuyến.
 */
export class AuthSessionError extends Error {
  readonly status: number;

  constructor(status: number, message = 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa.') {
    super(message);
    this.name = 'AuthSessionError';
    this.status = status;
  }
}

export const PROFILE_UPDATED_EVENT = 'voyager:profile-updated';

const pendingRegisteredNameByUid = new Map<string, string>();

export function setPendingRegisteredDisplayName(uid: string, displayName: string): void {
  const trimmed = displayName.trim();
  if (!uid || !trimmed) return;
  pendingRegisteredNameByUid.set(uid, trimmed);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { uid, displayName: trimmed } }),
    );
  }
}

export function getPendingRegisteredDisplayName(uid: string): string | undefined {
  return pendingRegisteredNameByUid.get(uid);
}

export function clearPendingRegisteredDisplayName(uid: string): void {
  pendingRegisteredNameByUid.delete(uid);
}

/**
 * Tạo chữ ký đại diện cho lịch trình & cảnh báo của chuyến đi để modal tối ưu AI reset đúng khi đổi chuyến hoặc đổi lịch.
 */
export function buildTripScheduleSignature(trip: TripData | null | undefined): string {
  if (!trip?.id) return '';
  const daysSig = (trip.days || []).map((d) => ({
    dayIndex: d.dayIndex,
    activities: (d.activities || []).map((a) => [
      a.id,
      a.timeStart,
      a.timeEnd,
      a.title,
      a.location,
      a.status,
      a.cost || 0,
    ]),
  }));
  const alertsSig = (trip.alerts || []).map((a) => `${a.id}:${a.severity}:${a.title}`);
  return JSON.stringify({ id: trip.id, daysSig, alertsSig });
}
