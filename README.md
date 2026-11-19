# Voyager — Bảng điều phối du lịch thông minh

Voyager là ứng dụng web hỗ trợ lập kế hoạch và điều phối chuyến du lịch. Người dùng có thể tạo chuyến bằng AI hoặc thủ công, quản lý lịch trình, thành viên, ngân sách và hóa đơn; theo dõi tuyến đường, thời tiết và cảnh báo. Ứng dụng dùng Firebase/Firestore và hỗ trợ lưu tạm một số dữ liệu ngoại tuyến trên trình duyệt.

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
   - `VITE_CARTO_API_KEY` dùng để tải tile bản đồ CARTO; key này được gửi từ trình duyệt nên hãy giới hạn domain được phép sử dụng trong CARTO.
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
├── public/                         # Tài nguyên tĩnh, favicon
├── scripts/                        # Cấp role và gán owner cho chuyến cũ
├── src/
│   ├── components/
│   │   ├── admin/                  # Dashboard và màn hình quản trị
│   │   │   └── planning-data/      # Địa điểm, chi phí, giờ mở cửa, quãng đường
│   │   ├── auth/                   # Đăng nhập và đăng ký
│   │   ├── common/                 # Field, modal, autocomplete dùng chung
│   │   ├── dashboard/              # Dashboard người dùng và các panel
│   │   │   └── live-route-map/     # Leaflet, tuyến đường, thời tiết
│   │   ├── guest/                  # Màn hình chuyến dành cho khách
│   │   ├── modals/
│   │   │   └── trip-planner/       # Tạo chuyến thủ công hoặc bằng AI
│   │   └── trips/
│   │       └── budget/             # Ngân sách, giao dịch, hóa đơn, báo cáo
│   ├── hooks/                      # Hook xác thực, trạng thái mạng, chuyến đi
│   ├── server/
│   │   ├── errors/                 # Lỗi nghiệp vụ
│   │   ├── middleware/             # Xác thực và giới hạn request
│   │   ├── routes/                 # API admin, chuyến, guest, AI, routing
│   │   ├── services/               # Firebase, Gemini, lưu trữ, log, cấu hình
│   │   └── types/                  # Kiểu dữ liệu riêng của server
│   ├── types/                      # Kiểu dữ liệu auth và chuyến đi
│   ├── utils/
│   │   ├── client/                 # Lưu offline, guest session, JSON Gemini
│   │   ├── route/                  # Tuyến đường, tọa độ, tiến độ, thời tiết
│   │   ├── schedule/               # Tối ưu, sắp lịch, kiểm tra và cảnh báo
│   │   └── trip/                   # Chuẩn hóa, đồng bộ, thành viên, ngân sách
│   ├── App.tsx                     # Thành phần gốc của ứng dụng
│   ├── api.ts                      # Hàm gọi API server từ client
│   ├── firebase.ts                 # Khởi tạo Firebase client
│   ├── index.css                   # CSS toàn cục
│   └── main.tsx                    # Khởi chạy React
├── tests/                          # Unit test và test tích hợp
├── data/                           # Dữ liệu runtime cục bộ, không commit
├── secrets/                        # Service account cục bộ, không commit
├── server.ts                       # Khởi tạo Express, middleware và API
├── firebase.json                   # Cấu hình Firebase CLI/Emulator
├── firestore.rules                 # Quy tắc truy cập Firestore
├── firebase-applet-config.json     # Cấu hình Firebase client
├── .env.example                    # Mẫu biến môi trường
├── package.json                    # Dependencies và scripts
├── vite.config.ts                  # Cấu hình Vite và Tailwind
└── README.md
```

### Các module quan trọng

- `src/components/admin/`: dashboard quản trị, người dùng, chuyến đi, AI và dữ liệu hoạch định.
- `src/components/dashboard/`: dashboard người dùng; `live-route-map/` chứa canvas, layer, điều khiển và xử lý tuyến/thời tiết.
- `src/components/modals/trip-planner/`: quy trình tạo chuyến thủ công và tạo chuyến bằng Gemini.
- `src/components/trips/`: danh sách chuyến, thành viên và ngân sách; `budget/` chứa thao tác và các phần hiển thị chi phí.
- `src/hooks/`: phiên đăng nhập, trạng thái online, đồng bộ chuyến và quét cảnh báo.
- `src/utils/route/`, `src/utils/schedule/`, `src/utils/trip/`: logic nghiệp vụ dùng chung theo miền tuyến đường, lịch trình và chuyến đi.
- `src/server/routes/`: API theo nhóm quản trị, chuyến đi, guest, Gemini, routing và đội xe.
- `src/server/services/`: tích hợp Firebase Admin/Gemini và các dịch vụ lưu trữ, cấu hình, log.
- `server.ts`: cấu hình Express, middleware và đăng ký route API.

## Scripts

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy Express và Vite ở chế độ phát triển |
| `npm run build` | Build client production |
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

## Phân công nhiệm vụ

Mỗi thành viên phụ trách logic và kiểm thử của một nhóm chức năng. Đường dẫn mã nguồn trong bảng tính từ `src/`, còn tên test tính từ `tests/`. Các file dùng chung được ghi ở cuối bảng để chủ động phối hợp khi thay đổi.

| Thành viên | Nhiệm vụ | Mã nguồn chính | Kiểm thử liên quan |
| --- | --- | --- | --- |
| **TV1 — Tín Phát** | Tạo chuyến thủ công hoặc bằng AI; xử lý đầu ra Gemini thành dữ liệu chuyến | `components/modals/TripPlannerModal.tsx`, `components/modals/trip-planner/`, `server/routes/gemini.ts`, `server/routes/geminiJobs.ts`, `utils/route/vietnamGeo.ts` | `aiGeneratedTrip.test.ts`, `tripCreationConnections.test.ts`, `geminiJson.test.ts` |
| **TV2 — Phạm Huy** | Tối ưu, tự sắp xếp và xác thực lịch trình; áp dụng kết quả tối ưu vào chuyến | `components/modals/AIOptimizeModal.tsx`, `components/modals/AutoArrangeModal.tsx`, `utils/schedule/` | `applyOptimizationAndDiff.test.ts`, `scheduleAutoArranger.test.ts`, `scheduleOptimizer.test.ts`, `scheduleValidator.test.ts` |
| **TV3 — Gia Khánh** | Hiển thị bản đồ, tính/đồng bộ tuyến đường, tiến độ và thông tin thời tiết | `components/dashboard/LiveRouteMap.tsx`, `components/dashboard/live-route-map/`, `utils/route/`, `server/routes/routing.ts` | `routeProgress.test.ts`, `routeTspOptimizer.test.ts`, `weatherParser.test.ts` |
| **TV4 — Quốc Tuấn** | Quản lý thành viên, tham gia chuyến, mã mời và quyền truy cập của khách | `components/trips/MembersView.tsx`, `components/guest/GuestTripView.tsx`, `utils/trip/tripJoinHelpers.ts`, `hooks/useTripActions.ts`, `server/routes/tripManagement.ts`, `server/routes/guest.ts` | `tripJoinAndGuest.test.ts`, `tripConcurrencyAndValidation.test.ts`, `tripSyncHelpers.test.ts` |
| **TV5 — Minh Tuấn** | Quản lý ngân sách, khoản thu/chi, hóa đơn và báo cáo chi phí chuyến đi | `components/trips/BudgetView.tsx`, `components/trips/budget/`, `utils/trip/budgetAlerts.ts`, `server/routes/trips.ts` | `budgetAndMembersIntegrity.test.ts`, `newFeatures.test.ts`, `tripData.test.ts` |

`src/App.tsx`, `src/api.ts`, `server.ts`, `src/types/travel.ts` và `src/utils/trip/normalizeTripData.ts` là các phần dùng chung; thay đổi các file này cần phối hợp với thành viên phụ trách use case liên quan.

## Gợi ý phát triển tiếp

1. **Thiết lập CI và Firestore Emulator ổn định**: chạy lint, toàn bộ unit test và test API trên pull request; giữ emulator test tách biệt nhưng không để bị bỏ qua trong pipeline.
2. **Thay dữ liệu mẫu trong trang quản trị bằng trạng thái thực**: một số dashboard/log hiện có giá trị khởi tạo minh họa. Nên phân biệt rõ dữ liệu demo với dữ liệu API, đồng thời hiển thị loading, lỗi và trạng thái chưa có dữ liệu.
3. **Bổ sung kiểm thử luồng người dùng end-to-end**: đăng nhập, tạo chuyến, chuyển chuyến, đổi mã mời, cập nhật thành viên và ngân sách; ưu tiên kiểm thử trên màn hình nhỏ.
4. **Tiếp tục chuẩn hóa dữ liệu đầu vào**: kiểm tra ngày, trùng mã chuyến/thành viên, số lượng thành viên, chi phí và tọa độ ở cả API lẫn client; giữ server là nguồn dữ liệu chuẩn.
5. **Theo dõi độ tin cậy của dịch vụ ngoài**: có trạng thái lỗi/rate limit và phương án dự phòng cho Gemini, OSRM, Open-Meteo và CARTO; tránh hiển thị dữ liệu lỗi như dữ liệu mới.
6. **Chia nhỏ các route server lớn**: tách `tripManagement.ts` theo miền chức năng (thành viên, mã mời, lịch trình) khi tiếp tục phát triển để dễ kiểm thử và bảo trì.
7. **Rà soát bảo mật trước khi triển khai**: kiểm tra Firestore rules, phân quyền admin, rate limit, log chứa dữ liệu cá nhân và đảm bảo `.env`/`secrets/` không được commit.
