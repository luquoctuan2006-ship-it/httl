
## Run Locally

**Prerequisites:**  Node.js (v20+)

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` in the project root and replace the `GEMINI_API_KEY` placeholder with your key from Google AI Studio. Keep the key server-side; do not use a `VITE_*` variable or commit `.env`.
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

## Tests

- Run unit tests with `npm test`.
- Route and Firestore synchronization integration tests require the Firestore emulator and run with:
  `firebase emulators:exec --project demo-httl-server-tests --only firestore "npm run test:emulator"`

The emulator tests create and remove their own test documents. They are skipped when `FIRESTORE_EMULATOR_HOST` is not set.

