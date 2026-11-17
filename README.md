# Voyager — Bảng điều phối du lịch thông minh

Voyager là ứng dụng web hỗ trợ lập kế hoạch và điều phối chuyến du lịch. Người dùng có thể tạo chuyến bằng AI hoặc thủ công, quản lý lịch trình, thành viên, ngân sách và hóa đơn; theo dõi tuyến đường, thời tiết và cảnh báo. Ứng dụng dùng Firebase/Firestore, có giao diện cài đặt dạng PWA và hỗ trợ một số dữ liệu ngoại tuyến.

## Chức năng chính

### Người dùng

- Tạo, sửa, nhân bản và tham gia chuyến bằng mã mời.
- Quản lý lịch trình, thành viên, điểm danh, ngân sách và hóa đơn.
- Xem bản đồ tuyến đường, thời tiết dọc tuyến và cảnh báo vận hành.
- Lập lịch bằng AI Gemini hoặc nhập thủ công.

### Quản trị viên

Menu quản trị có bốn mục chính: **Tổng quan**, **Quản lý người dùng**, **Quản lý chuyến đi** và **Quản lý AI**. Trong quản lý chuyến đi có danh sách chuyến, giám sát lịch trình và dữ liệu hoạch định.

## Công nghệ

- React, TypeScript, Vite, Tailwind CSS và Leaflet.
- Express cho API; Firebase Authentication, Cloud Firestore và Firebase Admin cho xác thực/dữ liệu.
- Gemini cho lập kế hoạch và tối ưu lịch trình.
- Open-Meteo cho thời tiết; OSRM để lấy tuyến đường bộ; CARTO/OpenStreetMap cho bản đồ đường phố.
- `vite-plugin-pwa` tạo manifest và service worker.

## Yêu cầu

- Node.js 20 trở lên và npm.
- Firebase project đã bật Email/Password Authentication và Cloud Firestore.
- Gemini API key nếu sử dụng chức năng AI.
- Firebase service account cho server khi cần truy cập Firestore bằng Firebase Admin.

## Cài đặt và chạy

1. Cài dependencies:

   ```sh
   npm install
   ```

2. Tạo file `.env` từ `.env.example`.

   ```powershell
   Copy-Item .env.example .env
   ```

   Trên macOS/Linux:

   ```sh
   cp .env.example .env
   ```

3. Cấu hình môi trường:

   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` và `VITE_FIREBASE_DATABASE_ID` dùng cho Firebase client. Nếu không đặt, client đọc giá trị trong `firebase-applet-config.json`.
   - `GEMINI_API_KEY` chỉ dùng phía server; không đổi thành `VITE_*` và không đưa vào mã client.
   - Đặt Firebase Admin service account ở `secrets/firebase-service-account.json`, hoặc chỉ định đường dẫn bằng `FIREBASE_SERVICE_ACCOUNT_PATH`.
   - `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_CACHE_TTL_MS` và `GEMINI_TIMEOUT_MS` là tùy chọn. Mặc định lần lượt là `gemini-3.5-flash`, `gemini-3.1-flash-lite`, `300000` ms và `30000` ms.

   Không commit `.env`, service account hoặc dữ liệu runtime trong `data/`. Không chia sẻ API key và thông tin xác thực.

4. Bật Email/Password trong Firebase Authentication và tạo Firestore database.

5. Chạy môi trường phát triển:

   ```sh
   npm run dev
   ```

   Express phục vụ API và tích hợp Vite middleware. Mặc định mở `http://localhost:3000`; có thể đổi cổng bằng `PORT`.

6. Build và chạy production:

   ```sh
   npm run build
   npm start
   ```

   Build được tạo trong `dist/`; production server phục vụ các file này.

### Cấp quyền quản trị

Đăng ký người dùng, lấy Firebase Authentication UID và chạy lệnh từ môi trường tin cậy có service account:

```sh
npm run set:role -- <firebase-user-uid> admin
```

Thu hồi quyền quản trị:

```sh
npm run set:role -- <firebase-user-uid> user
```

Người dùng cần đăng nhập lại sau khi thay đổi role.

### Gán chủ sở hữu cho chuyến cũ

Xem trước thay đổi trước khi chạy thật:

```sh
npm run migrate:owner -- <owner-uid> --dry-run
```

Lệnh này thay đổi dữ liệu Firestore; hãy xác minh UID và sao lưu dữ liệu trước khi bỏ `--dry-run`.

## Cấu trúc dự án

```text
.
├── public/                         # Biểu tượng PWA và tài nguyên tĩnh
├── scripts/                        # Lệnh cấp role và migration dữ liệu
├── src/
│   ├── components/
│   │   ├── admin/                  # Tổng quan, người dùng, chuyến đi, AI
│   │   │   └── planning-data/      # Tab, modal, hook dữ liệu hoạch định
│   │   ├── auth/                   # Đăng nhập và đăng ký
│   │   ├── common/                 # Form field và modal dùng chung
│   │   ├── dashboard/              # Dashboard người dùng và thành phần chung
│   │   │   └── live-route-map/     # Bản đồ, tuyến, thời tiết và điều khiển
│   │   ├── guest/                  # Giao diện khách tham gia chuyến
│   │   ├── modals/                 # Modal cấp ứng dụng
│   │   │   └── trip-planner/       # Tạo chuyến thủ công và bằng AI
│   │   └── trips/                  # Danh sách chuyến, thành viên, ngân sách
│   │       └── budget/             # Chi tiết ngân sách, hóa đơn, báo cáo
│   ├── data/                       # Dữ liệu mẫu và chuẩn hóa TripData
│   ├── hooks/                      # Hook xác thực, đồng bộ và trạng thái
│   ├── server/
│   │   ├── errors/                 # Lỗi nghiệp vụ phía server
│   │   ├── middleware/             # Xác thực và rate limiting
│   │   ├── routes/                 # API theo nhóm chức năng
│   │   ├── services/               # Firebase, Gemini, cấu hình và nhật ký
│   │   └── types/                  # Kiểu dữ liệu server
│   ├── types/                      # Kiểu dữ liệu dùng chung phía client
│   ├── utils/                      # Cảnh báo, lịch trình, ngân sách, offline
│   ├── App.tsx                     # Kết nối màn hình và state cấp ứng dụng
│   ├── api.ts                      # Client gọi API
│   ├── firebase.ts                 # Firebase client
│   ├── index.css                   # CSS toàn cục
│   └── main.tsx                    # Điểm khởi chạy React
├── tests/                          # Unit test và test tích hợp
├── data/                           # Dữ liệu runtime cục bộ; không commit
├── secrets/                        # Credential cục bộ; không commit
├── server.ts                       # Khởi tạo Express và đăng ký API
├── firebase.json                   # Cấu hình Firebase CLI/Emulator
├── firestore.rules                 # Quy tắc truy cập Firestore
├── firebase-applet-config.json     # Cấu hình Firebase client
├── package.json                    # Dependencies và scripts
├── vite.config.ts                  # Vite, Tailwind và PWA
└── README.md
```

### Các module quan trọng

- `src/components/admin/AdminDashboard.tsx`: điều phối giao diện và bốn mục quản trị.
- `src/components/admin/AdminTripsManagementView.tsx`: gom danh sách chuyến, giám sát và dữ liệu hoạch định.
- `src/components/dashboard/UserDashboard.tsx`: dashboard người dùng.
- `src/components/dashboard/LiveRouteMap.tsx`: bản đồ tuyến đường; các hook và thành phần con ở `live-route-map/`.
- `src/components/modals/trip-planner/`: tạo chuyến thủ công, gọi AI và chuẩn hóa kết quả.
- `src/components/trips/budget/`: tính toán, cập nhật ngân sách, hóa đơn và báo cáo.
- `src/data/normalizeTripData.ts`: kiểm tra và chuẩn hóa dữ liệu chuyến trước khi sử dụng.
- `src/utils/alertDetector.ts` và `src/utils/budgetAlerts.ts`: phát hiện cảnh báo lịch trình, thời tiết và ngân sách.
- `src/server/routes/`: API cho chuyến đi, người dùng, quản trị, Gemini, phương tiện, routing và guest.
- `server.ts`: cấu hình Express, middleware, Firebase Admin và đăng ký các route.

## Scripts

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy Express và Vite ở chế độ phát triển |
| `npm run build` | Build client production và tạo tài nguyên PWA |
| `npm start` | Chạy server production, phục vụ `dist/` |
| `npm run preview` | Xem trước build bằng Vite |
| `npm run lint` | Kiểm tra TypeScript bằng `tsc --noEmit` |
| `npm test` | Chạy toàn bộ test tự động |
| `npm run test:emulator` | Chạy riêng test cần Firestore Emulator |
| `npm run set:role -- <uid> <admin\|user>` | Cấp hoặc thu hồi role admin |
| `npm run migrate:owner -- <uid> --dry-run` | Xem trước migration owner |

Chạy test với Firestore Emulator:

```sh
firebase emulators:exec --project demo-httl-server-tests --only firestore "npm run test:emulator"
```

Test emulator sẽ bị bỏ qua nếu chưa cấu hình `FIRESTORE_EMULATOR_HOST`; các unit test thông thường vẫn chạy bằng `npm test`.

## Phân công thành viên

Tên thành viên được giữ theo danh sách hiện có; phạm vi và file kiểm thử được cập nhật theo cấu trúc mã nguồn hiện tại.

| Thành viên | Phạm vi phụ trách | Mã nguồn chính | Kiểm thử liên quan |
| --- | --- | --- | --- |
| **TV1 — Tín Phát** | Lập chuyến và lịch trình bằng Gemini | `TripPlannerModal.tsx`, `trip-planner/`, `routes/gemini.ts`, `routes/geminiJobs.ts`, `vietnamGeo.ts` | `aiGeneratedTrip.test.ts`, `tripCreationConnections.test.ts`, `geminiJson.test.ts` |
| **TV2 — Phạm Huy** | Tối ưu và xác thực lịch trình bằng AI | `AIOptimizeModal.tsx`, `scheduleOptimizer.ts`, `scheduleValidator.ts`, `applyOptimization.ts` | `applyOptimizationAndDiff.test.ts`, `scheduleOptimizer.test.ts`, `scheduleValidator.test.ts` |
| **TV3 — Gia Khánh** | Bản đồ tuyến đường, định tuyến và thời tiết | `LiveRouteMap.tsx`, `live-route-map/`, `routeProgress.ts`, `weatherParser.ts`, `routes/routing.ts` | `routeProgress.test.ts`, `weatherParser.test.ts`, `tripData.test.ts` |
| **TV4 — Quốc Tuấn** | Thành viên, điểm danh, tham gia và mã mời | `MembersView.tsx`, `tripJoinHelpers.ts`, `useTripActions.ts`, `routes/tripManagement.ts` | `tripJoinAndGuest.test.ts`, `tripConcurrencyAndValidation.test.ts`, `tripSyncHelpers.test.ts` |
| **TV5 — Minh Tuấn** | Ngân sách, hóa đơn và báo cáo chi phí | `BudgetView.tsx`, `trips/budget/`, `budgetAlerts.ts`, `routes/trips.ts` | `budgetAndMembersIntegrity.test.ts`, `newFeatures.test.ts`, `tripData.test.ts` |

`App.tsx`, `api.ts`, `server.ts`, `src/types/travel.ts` và `normalizeTripData.ts` là các phần dùng chung; thay đổi các file này cần phối hợp với thành viên phụ trách use case liên quan.

## Gợi ý phát triển tiếp

1. **Thiết lập CI và Firestore Emulator ổn định**: chạy lint, toàn bộ unit test và test API trên pull request; giữ emulator test tách biệt nhưng không để bị bỏ qua trong pipeline.
2. **Thay dữ liệu mẫu trong trang quản trị bằng trạng thái thực**: một số dashboard/log hiện có giá trị khởi tạo minh họa. Nên phân biệt rõ dữ liệu demo với dữ liệu API, đồng thời hiển thị loading, lỗi và trạng thái chưa có dữ liệu.
3. **Bổ sung kiểm thử luồng người dùng end-to-end**: đăng nhập, tạo chuyến, chuyển chuyến, đổi mã mời, cập nhật thành viên và ngân sách; ưu tiên kiểm thử trên màn hình nhỏ.
4. **Tiếp tục chuẩn hóa dữ liệu đầu vào**: kiểm tra ngày, trùng mã chuyến/thành viên, số lượng thành viên, chi phí và tọa độ ở cả API lẫn client; giữ server là nguồn dữ liệu chuẩn.
5. **Theo dõi độ tin cậy của dịch vụ ngoài**: có trạng thái lỗi/rate limit và phương án dự phòng cho Gemini, OSRM, Open-Meteo và CARTO; tránh hiển thị dữ liệu lỗi như dữ liệu mới.
6. **Chia nhỏ các route server lớn**: tách `tripManagement.ts` theo miền chức năng (thành viên, mã mời, lịch trình) khi tiếp tục phát triển để dễ kiểm thử và bảo trì.
7. **Rà soát bảo mật trước khi triển khai**: kiểm tra Firestore rules, phân quyền admin, rate limit, log chứa dữ liệu cá nhân và đảm bảo `.env`/`secrets/` không được commit.

## PWA và file sinh tự động

`vite.config.ts` cấu hình manifest, cache tài nguyên và service worker. Ứng dụng cache một số tài nguyên tĩnh và tile bản đồ đường phố; bản đồ và dữ liệu thời tiết/định tuyến từ dịch vụ ngoài vẫn cần kết nối mạng để cập nhật. Sửa mã nguồn hoặc cấu hình rồi chạy build thay vì sửa thủ công các file trong `dist/` hoặc `dev-dist/`.
