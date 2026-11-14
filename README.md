
## Run Locally

**Prerequisites:**  Node.js (v20+)

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` in the project root and replace the `GEMINI_API_KEY` placeholder with your Gemini API key. Keep the key server-side; do not use a `VITE_*` variable or commit `.env`.
3. Set `GEMINI_MODEL` to the active model (default: `gemini-3.5-flash`) and optionally set `GEMINI_FALLBACK_MODEL` (default: `gemini-3.1-flash-lite`). The server automatically retries with the fallback model when the primary model is temporarily unavailable.
4. Set `GEMINI_CACHE_TTL_MS` to control the cache lifetime for equivalent itinerary and optimization requests (default: `300000`, or 5 minutes). The in-memory cache is scoped by authenticated user and is limited to 200 entries.
5. Set `GEMINI_TIMEOUT_MS` to control each Gemini request timeout. The default is `30000` milliseconds (minimum enforced: 30,000 ms to allow thorough multi-day schedule processing).
6. In Firebase Console, enable **Authentication > Email/Password**, register a Web app, and copy its `apiKey`, `authDomain`, `projectId`, and `appId` into the matching `VITE_FIREBASE_*` variables in `.env`.
7. Place the Firebase Admin service-account JSON at `secrets/firebase-service-account.json`, or set `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`. Keep this file private and server-side.
8. Enable Cloud Firestore in the Firebase project. Each signed-in user owns and can edit their own trips and call Gemini APIs; admins manage and monitor the system (users, rules, AI config, logs, all trips).
   AI jobs, per-user job slots, AI rate limits, and audit/AI logs are stored in Firestore so every server instance shares the same state. Configure all instances with the same Firebase project and Firestore database.
9. Register an account in the app, find its Firebase Authentication UID, and grant the admin claim from this trusted server environment:
   `npm run set:role -- <firebase-user-uid> admin`
   Use `npm run set:role -- <firebase-user-uid> user` to revoke admin access. The user must sign out and sign in again for the updated role to take effect.
10. Run the app in development:
    `npm run dev`
    Or build and run in production:
    `npm run build && npm start`

## Project Structure

```text
.
├── public/                 # Static assets and PWA icons
├── scripts/                # Admin and trip maintenance scripts
├── src/
│   ├── components/
│   │   ├── admin/          # Admin dashboard and management views
│   │   ├── auth/           # Authentication screens
│   │   ├── dashboard/      # User dashboard and shared dashboard UI
│   │   ├── modals/         # Account, trip-planning, and activity dialogs
│   │   └── trips/          # Trip lists, members, budget, and receipts
│   ├── data/               # Mock defaults and trip normalization
│   ├── hooks/              # Reusable React hooks
│   ├── server/             # Server middleware, routes, and services
│   ├── types/              # Shared TypeScript types
│   ├── utils/              # Trip, schedule, sync, and offline helpers
│   ├── App.tsx             # Application state and top-level composition
│   ├── api.ts              # Client API helpers
│   ├── firebase.ts         # Firebase client setup
│   └── main.tsx            # Browser entry point
├── tests/                  # Unit and emulator integration tests
├── server.ts               # Express server entry point
└── README.md
```

## Phân công chức năng và các file liên quan

- **TV1 – Tín Phát: Đặc tả Use Case “Tạo lịch trình du lịch tự động bằng Gemini AI”**
  - `src/components/modals/TripPlannerModal.tsx` – giao diện tạo lịch trình và xử lý kết quả Gemini.
  - `server.ts`, `src/server/routes/geminiJobs.ts` – API tạo lịch trình và theo dõi tác vụ Gemini.
  - `src/utils/vietnamGeo.ts` – tạo các điểm dừng trên tuyến từ lịch trình.
  - `src/api.ts`, `src/types/travel.ts` – gọi API có xác thực và kiểu dữ liệu chuyến đi.
  - `tests/aiGeneratedTrip.test.ts` – kiểm thử dữ liệu lịch trình do AI tạo.

- **TV2 – Phạm Huy: Đặc tả Use Case “Tối ưu lịch trình bằng AI (theo yêu cầu)”**
  - `src/components/modals/AIOptimizeModal.tsx` – giao diện yêu cầu tối ưu và áp dụng đề xuất.
  - `server.ts`, `src/server/routes/geminiJobs.ts` – API tối ưu lịch trình và theo dõi tác vụ Gemini.
  - `src/utils/applyOptimization.ts`, `src/utils/scheduleOptimizer.ts`, `src/utils/scheduleValidator.ts` – áp dụng, tối ưu và kiểm tra lịch trình.
  - `src/utils/tripSyncHelpers.ts`, `src/api.ts`, `src/types/travel.ts` – đồng bộ lịch trình, gọi API và kiểu dữ liệu.
  - `tests/applyOptimizationAndDiff.test.ts`, `tests/scheduleOptimizer.test.ts`, `tests/scheduleValidator.test.ts` – kiểm thử các phần tối ưu lịch trình.

- **TV3 – Gia Khánh: Đặc tả Use Case “Theo dõi bản đồ tuyến đường & Trạng thái xe”**
  - `src/components/dashboard/LiveRouteMap.tsx` – bản đồ tuyến đường, điểm dừng, thông tin xe và vị trí GPS.
  - `src/components/dashboard/UserDashboard.tsx` – hiển thị bản đồ trong dashboard.
  - `src/App.tsx`, `src/utils/tripRepository.ts`, `server.ts` – cập nhật và lưu dữ liệu chuyến đi.
  - `src/utils/tripHelpers.ts`, `src/types/travel.ts` – liên kết điểm dừng với hoạt động và định nghĩa dữ liệu tuyến/xe.

- **TV4 – Quốc Tuấn: Đặc tả Use Case “Quản lý thành viên & Điểm danh đoàn du lịch”**
  - `src/components/trips/MembersView.tsx` – giao diện quản lý thành viên và điểm danh.
  - `src/components/dashboard/UserDashboard.tsx` – kết nối màn hình thành viên với dashboard.
  - `src/App.tsx`, `src/api.ts`, `server.ts` – xử lý cập nhật điểm danh và API lưu dữ liệu.
  - `src/utils/tripRepository.ts`, `src/types/travel.ts` – lưu dữ liệu chuyến đi và định nghĩa thành viên.

- **TV5 – Minh Tuấn: Đặc tả Use Case “Quản lý ngân sách & Ghi nhận hóa đơn chuyến đi”**
  - `src/components/trips/BudgetView.tsx`, `src/components/trips/budget/ReceiptImage.tsx` – giao diện ngân sách, hóa đơn và ảnh chứng từ.
  - `src/components/dashboard/UserDashboard.tsx`, `src/App.tsx` – hiển thị và cập nhật ngân sách chuyến đi.
  - `src/api.ts`, `server.ts` – API lưu chuyến đi và tải lên/xem/xóa ảnh chứng từ.
  - `src/utils/tripRepository.ts`, `src/utils/tripHelpers.ts`, `src/types/travel.ts` – tính số liệu ngân sách, xuất báo cáo và định nghĩa hóa đơn.

## Mục đích các file còn lại

### Giao diện quản trị

- `src/components/admin/AdminAIManagementView.tsx` – xem và quản lý cấu hình, yêu cầu, nhật ký và lỗi liên quan đến AI.
- `src/components/admin/AdminDashboard.tsx` – điều phối màn hình quản trị, lịch trình toàn hệ thống và thao tác vận hành.
- `src/components/admin/AdminDashboardView.tsx` – bố cục dashboard quản trị và các thẻ tổng quan.
- `src/components/admin/AdminDispatchRulesView.tsx` – cấu hình quy tắc điều phối, giới hạn ngân sách và kiểm tra lịch trình.
- `src/components/admin/AdminManagementViews.tsx` – gom và xuất các màn hình quản trị để tái sử dụng.
- `src/components/admin/AdminPlanningDataView.tsx` – quản lý địa điểm, tuyến, phương tiện và dữ liệu hoạch định.
- `src/components/admin/AdminScheduleMonitoringView.tsx` – theo dõi lịch trình các chuyến và gửi cảnh báo vận hành.
- `src/components/admin/AdminSystemManagementView.tsx` – xem trạng thái hệ thống và nhật ký hoạt động.
- `src/components/admin/AdminUsersManagementView.tsx` – quản lý tài khoản, phân quyền, khóa và mở khóa người dùng.
- `src/components/auth/AuthScreen.tsx` – giao diện đăng nhập và đăng ký tài khoản.

### Giao diện dashboard, hộp thoại và chuyến đi

- `src/components/dashboard/Header.tsx` – thanh tiêu đề, thông tin chuyến, tìm kiếm và thao tác đồng bộ.
- `src/components/dashboard/MetricCards.tsx` – hiển thị các chỉ số tóm tắt của chuyến đi.
- `src/components/dashboard/OfflineIndicator.tsx` – báo trạng thái kết nối và khả năng làm việc ngoại tuyến.
- `src/components/dashboard/OperationsPanel.tsx` – danh sách cảnh báo và thao tác vận hành.
- `src/components/dashboard/PWAInstallButton.tsx` – hướng dẫn/cung cấp thao tác cài ứng dụng PWA.
- `src/components/dashboard/Sidebar.tsx` – điều hướng giữa các mục và mở cài đặt tài khoản.
- `src/components/dashboard/TimelineSchedule.tsx` – hiển thị và thao tác với lịch trình theo dòng thời gian.
- `src/components/modals/AccountModal.tsx` – xem và cập nhật thông tin tài khoản.
- `src/components/modals/ActivityDetailModal.tsx` – xem chi tiết và chỉnh sửa hoạt động trong lịch trình.
- `src/components/modals/AddActivityModal.tsx` – thêm hoạt động vào một ngày của chuyến đi.
- `src/components/modals/AlertsListModal.tsx` – xem danh sách cảnh báo vận hành.
- `src/components/modals/AutoArrangeModal.tsx` – xem và xác nhận thao tác tự động sắp xếp lịch.
- `src/components/modals/EditTripModal.tsx` – chỉnh sửa thông tin chung của chuyến đi.
- `src/components/modals/SyncConflictModal.tsx` – thông báo và xử lý xung đột khi đồng bộ dữ liệu.
- `src/components/trips/TripsListView.tsx` – danh sách chuyến đi, chọn chuyến và thao tác nhân bản/sửa/xóa.

### Dữ liệu, tiện ích và kiểu dùng chung

- `src/main.tsx` – điểm khởi chạy React và nạp stylesheet toàn cục.
- `src/index.css` – kiểu chữ và style nền dùng chung của ứng dụng.
- `src/firebase.ts` – khởi tạo Firebase client và cung cấp Firebase Authentication.
- `src/data/mockData.ts` – dữ liệu chuyến đi mẫu dùng làm dữ liệu khởi tạo.
- `src/data/normalizeTripData.ts` – kiểm tra, chuẩn hóa và giới hạn dữ liệu chuyến đi đầu vào.
- `src/hooks/useOnlineStatus.ts` – theo dõi trạng thái online/offline của trình duyệt.
- `src/hooks/usePWAInstall.ts` – phát hiện trạng thái cài đặt và xử lý lời nhắc cài PWA.
- `src/utils/alertDetector.ts` – phát hiện cảnh báo thời tiết, xung đột và rủi ro lịch trình.
- `src/utils/geminiJson.ts` – trích xuất và phân tích JSON từ phản hồi Gemini.
- `src/utils/offlineStorage.ts` – lưu cache chuyến đi và đánh dấu dữ liệu chờ đồng bộ ngoại tuyến.
- `src/utils/scheduleAutoArranger.ts` – phát hiện chồng giờ và tự sắp xếp hoạt động trong ngày/chuyến.
- `src/types/auth.ts` – định nghĩa kiểu người dùng, vai trò và bản ghi tài khoản.

### API máy chủ và ghi nhận hoạt động

- `src/server/routes/trips.ts` – định nghĩa API tạo/cập nhật chuyến đi và xử lý phiên bản đồng bộ.
- `src/server/middleware/firestoreRateLimitStore.ts` – lưu bộ đếm giới hạn tần suất yêu cầu AI trong Firestore.
- `src/server/services/systemLogs.ts` – ghi và đọc nhật ký kiểm toán, yêu cầu AI và lỗi AI.
- `server.ts` – khởi tạo Express, xác thực, kết nối Firestore và đăng ký các API của ứng dụng.

### Kiểm thử còn lại

- `tests/alertDetector.test.ts` – kiểm thử phát hiện cảnh báo lịch trình và thời tiết.
- `tests/geminiJson.test.ts` – kiểm thử phân tích JSON từ phản hồi Gemini.
- `tests/newFeatures.test.ts` – kiểm thử một số tiện ích mới như chuẩn hóa, nhân bản chuyến, lưu offline và xuất chi phí.
- `tests/scheduleAutoArranger.test.ts` – kiểm thử phát hiện xung đột và tự sắp xếp lịch trình.
- `tests/serverRoutes.emulator.test.ts` – kiểm thử API đồng bộ chuyến đi với Firestore Emulator.
- `tests/tripConcurrencyAndValidation.test.ts` – kiểm thử phân quyền, xung đột phiên bản và xác thực dữ liệu chuyến đi.
- `tests/tripData.test.ts` – kiểm thử dữ liệu mẫu và chuẩn hóa chuyến đi.
- `tests/tripSyncHelpers.test.ts` – kiểm thử hàng đợi đồng bộ, cache offline, xác thực và tiện ích đồng bộ.

### Cấu hình, công cụ và tài nguyên tĩnh

- `.editorconfig` – quy ước định dạng văn bản giữa các trình soạn thảo.
- `.env.example` – mẫu tên biến môi trường cần thiết; điền giá trị thật trong `.env` cục bộ.
- `.gitattributes` – thiết lập thuộc tính và cách xử lý file của Git.
- `.gitignore` – loại trừ dependency, file sinh ra, cấu hình riêng và dữ liệu runtime khỏi Git.
- `bun.lock` – khóa phiên bản dependency được cài đặt bằng Bun.
- `firebase-applet-config.json` – cấu hình Firebase phía ứng dụng web.
- `firebase.json` – cấu hình Firebase CLI và Firestore Emulator.
- `firestore.rules` – chặn truy cập Firestore trực tiếp từ client; dữ liệu được thao tác qua backend.
- `index.html` – trang HTML gốc, metadata trình duyệt và điểm nạp ứng dụng React.
- `metadata.json` – metadata tên, mô tả và khả năng của ứng dụng.
- `package.json` – khai báo dependency và các lệnh chạy, build, kiểm thử, quản trị.
- `tsconfig.json` – cấu hình TypeScript và kiểm tra kiểu.
- `vite.config.ts` – cấu hình Vite, React, Tailwind và tạo PWA/service worker.
- `scripts/assign-trip-owner.ts` – gán chủ sở hữu cho các chuyến cũ trong Firestore.
- `scripts/set-role.ts` – đặt hoặc thu hồi vai trò admin cho tài khoản Firebase.
- `public/apple-touch-icon.png` – biểu tượng khi thêm ứng dụng vào màn hình chính iOS.
- `public/favicon.png` – biểu tượng trang web trên trình duyệt.
- `public/pwa-192x192.png` – biểu tượng PWA kích thước 192×192.
- `public/pwa-512x512.png` – biểu tượng PWA kích thước 512×512.
- `public/pwa-maskable-512x512.png` – biểu tượng PWA maskable cho các launcher.
- `dev-dist/registerSW.js` – mã đăng ký service worker cho bản PWA phát triển.
- `dev-dist/sw.js` – service worker do công cụ PWA tạo cho môi trường phát triển.
- `dev-dist/workbox-afac4cd2.js` – runtime Workbox hỗ trợ cache/offline cho PWA.

## Tests

- Run unit tests with `npm test`.
- Route and Firestore synchronization integration tests require the Firestore emulator and run with:
  `firebase emulators:exec --project demo-httl-server-tests --only firestore "npm run test:emulator"`

The emulator tests create and remove their own test documents. They are skipped when `FIRESTORE_EMULATOR_HOST` is not set.

