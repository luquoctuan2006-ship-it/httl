# Voyager — Bảng điều phối du lịch thông minh

Voyager là ứng dụng web quản lý chuyến du lịch: lập và tối ưu lịch trình, theo dõi tuyến đường và phương tiện, quản lý thành viên, ngân sách và hóa đơn. Ứng dụng có chế độ lưu ngoại tuyến (PWA), xác thực Firebase, dữ liệu chuyến đi trên Cloud Firestore và các chức năng AI dùng Gemini.

## Yêu cầu

- Node.js 20 trở lên
- npm
- Một dự án Firebase có bật Authentication (Email/Password) và Cloud Firestore
- Gemini API key nếu cần dùng các chức năng AI

## Cài đặt và chạy

1. Cài dependency:

   ```sh
   npm install
   ```

2. Tạo `.env` từ `.env.example` (trên PowerShell dùng `Copy-Item .env.example .env`; trên macOS/Linux dùng `cp .env.example .env`).

3. Điền cấu hình Firebase và Gemini:
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` và `VITE_FIREBASE_DATABASE_ID` dành cho Firebase client. Nếu để trống, client dùng giá trị tương ứng trong `firebase-applet-config.json`.
   - `GEMINI_API_KEY` được dùng ở server; không đổi thành biến `VITE_*` và không đưa vào mã client.
   - Đặt Firebase Admin service-account JSON tại `secrets/firebase-service-account.json`, hoặc cấu hình `FIREBASE_SERVICE_ACCOUNT_PATH`.
   - `VITE_CARTO_API_KEY` là tùy chọn cho bản đồ.
   - `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_CACHE_TTL_MS` và `GEMINI_TIMEOUT_MS` là tùy chọn; mặc định lần lượt là `gemini-3.5-flash`, `gemini-3.1-flash-lite`, 300000 ms và 30000 ms.

   `.env`, thư mục `secrets/` và dữ liệu runtime không được commit. Không chia sẻ service account hoặc Gemini API key.

4. Bật Email/Password trong Firebase Authentication và tạo Firestore database.

5. Chạy ở chế độ phát triển:

   ```sh
   npm run dev
   ```

   Server Express phục vụ API và tích hợp Vite middleware trong môi trường phát triển. Mặc định ứng dụng chạy tại `http://localhost:3000`; có thể đổi cổng bằng biến `PORT`.

6. Build và chạy production:

   ```sh
   npm run build
   npm start
   ```

   Production server phục vụ nội dung trong `dist/`.

### Cấp quyền quản trị

Đăng ký người dùng trong ứng dụng, lấy Firebase Authentication UID và chạy lệnh từ môi trường tin cậy có service account:

```sh
npm run set:role -- <firebase-user-uid> admin
```

Thu hồi quyền admin:

```sh
npm run set:role -- <firebase-user-uid> user
```

Người dùng cần đăng nhập lại sau khi thay đổi role.

## Cấu trúc dự án

```text
.
├── public/                         # Biểu tượng ứng dụng và tài nguyên tĩnh
├── scripts/                        # Lệnh quản trị/migration Firebase
├── src/
│   ├── components/
│   │   ├── admin/                  # Dashboard và màn hình quản trị
│   │   │   └── planning-data/      # Tab, modal, hook dữ liệu địa điểm/phương tiện
│   │   ├── auth/                   # Đăng nhập và đăng ký
│   │   ├── dashboard/              # Dashboard người dùng và thành phần dùng chung
│   │   │   └── live-route-map/     # Bản đồ trực tiếp, GPS, dữ liệu tuyến và modal xe
│   │   ├── modals/                 # Các hộp thoại cấp ứng dụng
│   │   │   └── trip-planner/       # Luồng lập chuyến thủ công và bằng AI
│   │   └── trips/                  # Danh sách chuyến, thành viên và ngân sách
│   │       └── budget/             # UI, tính toán và thao tác ngân sách/hóa đơn
│   ├── data/                       # Dữ liệu mẫu và chuẩn hóa TripData
│   ├── hooks/                      # Hook dùng chung
│   ├── server/
│   │   ├── errors/                 # Lỗi nghiệp vụ phía server
│   │   ├── middleware/             # Middleware và tích hợp giới hạn tần suất
│   │   ├── routes/                 # Đăng ký API theo nhóm chức năng
│   │   ├── services/               # Dịch vụ dùng chung phía server
│   │   └── types/                  # Kiểu cấu hình server
│   ├── types/                      # Kiểu dữ liệu dùng chung của client
│   ├── utils/                      # Lịch trình, đồng bộ, offline và tiện ích chuyến đi
│   ├── App.tsx                     # State cấp ứng dụng và kết nối các màn hình
│   ├── api.ts                      # Gọi API backend
│   ├── firebase.ts                 # Firebase client và Authentication
│   ├── index.css                   # CSS toàn cục
│   └── main.tsx                    # Điểm khởi chạy React
├── tests/                          # Unit test và test tích hợp Firestore Emulator
├── data/                           # Dữ liệu runtime cục bộ; không commit
├── secrets/                        # Service account cục bộ; không commit
├── server.ts                       # Khởi tạo Express, xác thực và kết nối các route
├── firebase.json                   # Cấu hình Firebase CLI/Firestore Emulator
├── firestore.rules                 # Quy tắc truy cập Firestore
├── firebase-applet-config.json     # Cấu hình Firebase client
├── package.json                    # Dependency và lệnh npm
├── tsconfig.json                   # Cấu hình TypeScript
├── vite.config.ts                  # Vite, Tailwind và PWA
└── README.md
```

### Nhóm giao diện và chức năng

#### Quản trị

- `src/components/admin/AdminDashboard.tsx` điều phối màn hình quản trị.
- `AdminDashboardView.tsx`, `AdminSystemManagementView.tsx`, `AdminUsersManagementView.tsx`, `AdminAIManagementView.tsx`, `AdminScheduleMonitoringView.tsx` và `AdminDispatchRulesView.tsx` đảm nhiệm các màn hình tổng quan, hệ thống, người dùng, AI, lịch trình và quy tắc điều phối.
- `AdminPlanningDataView.tsx` là điểm ghép các tab dữ liệu hoạch định. Các tab, modal, kiểu và hook của phần này nằm trong `src/components/admin/planning-data/`.
- `AdminManagementViews.tsx` gom các view quản trị để tái sử dụng.

#### Dashboard và bản đồ tuyến đường

- `src/components/dashboard/UserDashboard.tsx` hiển thị dashboard người dùng.
- `Header.tsx`, `Sidebar.tsx`, `MetricCards.tsx`, `TimelineSchedule.tsx`, `OperationsPanel.tsx`, `OfflineIndicator.tsx` và `PWAInstallButton.tsx` là các phần giao diện dashboard.
- `LiveRouteMap.tsx` ghép giao diện bản đồ. Canvas, header, modal telematics, helper bản đồ và hook điều khiển nằm trong `src/components/dashboard/live-route-map/`.

#### Lập chuyến và hộp thoại

- `src/components/modals/TripPlannerModal.tsx` ghép luồng lập chuyến thủ công và AI.
- `src/components/modals/trip-planner/` chứa các tab, form, danh sách hoạt động, hook và helper riêng cho hai luồng.
- Các modal độc lập khác như chỉnh sửa chuyến, chi tiết hoạt động, thêm hoạt động, tự sắp xếp, tối ưu AI và xử lý xung đột nằm trực tiếp trong `src/components/modals/`.

#### Thành viên và ngân sách

- `src/components/trips/MembersView.tsx` quản lý thành viên chuyến đi và điểm danh.
- `src/components/trips/TripsListView.tsx` hiển thị và thao tác với danh sách chuyến đi.
- `src/components/trips/BudgetView.tsx` ghép màn hình ngân sách. Các component và hook về tổng quan, sổ chi tiêu, hóa đơn, báo cáo, modal, phép tính và cập nhật dữ liệu nằm trong `src/components/trips/budget/`.
- `src/components/trips/budget/ReceiptImage.tsx` quản lý hiển thị ảnh chứng từ và xem trước ảnh.

### Backend và dữ liệu dùng chung

- `server.ts` khởi tạo Express, cấu hình bảo mật, Firebase Admin, xác thực và các dependency dùng chung; sau đó đăng ký các nhóm route.
- `src/server/routes/tripManagement.ts` đăng ký API quản lý chuyến đi.
- `src/server/routes/trips.ts` chứa các thao tác API chuyến đi và hóa đơn.
- `src/server/routes/gemini.ts` và `geminiJobs.ts` phục vụ tác vụ AI và quản lý job Gemini.
- `src/server/routes/adminUsers.ts`, `adminConfig.ts`, `adminMonitoring.ts` và `fleet.ts` phục vụ người dùng, cấu hình, giám sát và phương tiện.
- `src/server/middleware/firestoreRateLimitStore.ts` lưu trạng thái giới hạn tần suất bằng Firestore.
- `src/server/services/systemLogs.ts` xử lý nhật ký hệ thống, kiểm toán và AI.
- `src/api.ts` là lớp gọi API từ client; `src/firebase.ts` khởi tạo Firebase client.
- `src/types/travel.ts` và `src/types/auth.ts` định nghĩa kiểu dữ liệu chuyến đi và xác thực.
- `src/data/normalizeTripData.ts` chuẩn hóa dữ liệu chuyến; `src/data/mockData.ts` cung cấp dữ liệu mẫu.
- `src/utils/` chứa các helper về cảnh báo, tối ưu và kiểm tra lịch trình, dữ liệu địa lý, đồng bộ/offline, repository chuyến đi và xuất báo cáo.

## Lệnh thường dùng

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy Express và Vite ở chế độ phát triển |
| `npm run build` | Build client production |
| `npm start` | Chạy server production, phục vụ `dist/` |
| `npm run preview` | Mở bản build bằng Vite preview |
| `npm run lint` | Kiểm tra TypeScript (`tsc --noEmit`) |
| `npm test` | Chạy toàn bộ test tự động |
| `npm run test:emulator` | Chạy riêng test route cần Firestore Emulator |
| `npm run set:role -- <uid> <admin\|user>` | Cấp hoặc thu hồi quyền admin |
| `npm run migrate:owner -- <uid> --dry-run` | Xem trước việc gán owner cho chuyến cũ |

Để chạy test emulator:

```sh
firebase emulators:exec --project demo-httl-server-tests --only firestore "npm run test:emulator"
```

Test emulator bị bỏ qua khi `FIRESTORE_EMULATOR_HOST` chưa được cấu hình. Các test thông thường vẫn chạy bằng `npm test`.

## Kiểm thử

Các file trong `tests/` bao phủ tạo và chuẩn hóa dữ liệu chuyến đi, đồng bộ offline, cạnh tranh phiên bản, phân quyền, AI JSON, tối ưu và xác thực lịch trình, cảnh báo, và các helper liên quan ngân sách. `tests/serverRoutes.emulator.test.ts` là test tích hợp cần Firestore Emulator.

## Phân công thành viên và file theo chức năng

Danh sách dưới đây ghi các file chính liên quan từng use case; những file dùng chung như `App.tsx`, `api.ts`, `server.ts` và `src/types/travel.ts` có thể được nhiều thành viên cùng chạm tới.

### TV1 — Tín Phát: Lập lịch trình du lịch tự động bằng Gemini AI

- UI và luồng lập chuyến: `src/components/modals/TripPlannerModal.tsx`, `src/components/modals/trip-planner/`.
- API Gemini và job: `src/server/routes/gemini.ts`, `src/server/routes/geminiJobs.ts`, đăng ký từ `server.ts`.
- Xử lý địa lý và dữ liệu chuyến: `src/utils/vietnamGeo.ts`, `src/types/travel.ts`, `src/api.ts`.
- Kiểm thử: `tests/newFeatures.test.ts`, `tests/tripData.test.ts`.

### TV2 — Phạm Huy: Tối ưu lịch trình bằng AI

- UI: `src/components/modals/AIOptimizeModal.tsx`.
- Tối ưu, xác thực và áp dụng đề xuất: `src/utils/scheduleOptimizer.ts`, `src/utils/scheduleValidator.ts`, `src/utils/applyOptimization.ts`.
- Đồng bộ và API: `src/utils/tripSyncHelpers.ts`, `src/api.ts`, `src/server/routes/gemini.ts`, `src/server/routes/geminiJobs.ts`.
- Kiểm thử: `tests/applyOptimizationAndDiff.test.ts`, `tests/scheduleOptimizer.test.ts`, `tests/scheduleValidator.test.ts`.

### TV3 — Gia Khánh: Theo dõi bản đồ tuyến đường và trạng thái xe

- UI và logic bản đồ: `src/components/dashboard/LiveRouteMap.tsx`, `src/components/dashboard/live-route-map/`.
- Hiển thị dashboard: `src/components/dashboard/UserDashboard.tsx`.
- Kiểu, dữ liệu và helper: `src/types/travel.ts`, `src/utils/tripRepository.ts`, `src/utils/tripHelpers.ts`.
- Kiểm thử dữ liệu liên quan bản đồ: `tests/tripData.test.ts`, `tests/newFeatures.test.ts`.

### TV4 — Quốc Tuấn: Quản lý thành viên và điểm danh đoàn

- UI: `src/components/trips/MembersView.tsx`, `src/components/dashboard/UserDashboard.tsx`.
- State, lưu dữ liệu và API: `src/App.tsx`, `src/api.ts`, `src/utils/tripRepository.ts`, `src/server/routes/trips.ts`.
- Kiểu dữ liệu: `src/types/travel.ts`.
- Kiểm thử đồng bộ và dữ liệu: `tests/tripSyncHelpers.test.ts`, `tests/tripConcurrencyAndValidation.test.ts`.

### TV5 — Minh Tuấn: Quản lý ngân sách và hóa đơn chuyến đi

- UI: `src/components/trips/BudgetView.tsx`, `src/components/trips/budget/`.
- Ảnh chứng từ: `src/components/trips/budget/ReceiptImage.tsx`.
- API, dữ liệu và báo cáo: `src/api.ts`, `src/server/routes/trips.ts`, `src/utils/tripHelpers.ts`, `src/types/travel.ts`.
- Kiểm thử báo cáo và dữ liệu chuyến: `tests/newFeatures.test.ts`, `tests/tripData.test.ts`.

## PWA và file sinh tự động

`vite.config.ts` cấu hình manifest, cache tài nguyên bản đồ/font và service worker. Biểu tượng nằm trong `public/`. Các file trong `dist/` và `dev-dist/` là đầu ra build/PWA; thông thường không chỉnh sửa thủ công, hãy sửa cấu hình hoặc mã nguồn tương ứng rồi build lại.
