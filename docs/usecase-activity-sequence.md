# Đặc tả Use Case, Activity Diagram và Sequence Diagram — Hệ thống Voyager

Tài liệu tổng hợp **5 Đặc tả Use Case** (kèm Use Case Diagram), **5 Activity Diagram** và **5 Sequence Diagram** cho 5 chức năng cốt lõi dựa trên mã nguồn thực tế của dự án **Voyager**.

---

## Mục lục

1. [TV1 — Tín Phát: Tạo lịch trình du lịch tự động bằng Gemini AI](#1-tv1--tín-phát-tạo-lịch-trình-du-lịch-tự-động-bằng-gemini-ai)
2. [TV2 — Phạm Huy: Tối ưu lịch trình bằng AI (theo yêu cầu)](#2-tv2--phạm-huy-tối-ưu-lịch-trình-bằng-ai-theo-yêu-cầu)
3. [TV3 — Gia Khánh: Quản lý bản đồ và tiến độ lịch trình](#3-tv3--gia-khánh-quản-lý-bản-đồ-và-tiến-độ-lịch-trình)
4. [TV4 — Quốc Tuấn: Quản lý thành viên & Điểm danh đoàn du lịch](#4-tv4--quốc-tuấn-quản-lý-thành-viên--điểm-danh-đoàn-du-lịch)
5. [TV5 — Minh Tuấn: Quản lý ngân sách & Ghi nhận hóa đơn chuyến đi](#5-tv5--minh-tuấn-quản-lý-ngân-sách--ghi-nhận-hóa-đơn-chuyến-đi)

---

## 1. TV1 — Tín Phát: Tạo lịch trình du lịch tự động bằng Gemini AI

### 1.1. Đặc tả Use Case (Use Case Specification)

| Thuộc tính | Nội dung chi tiết |
| :--- | :--- |
| **Mã Use Case** | `UC-01` |
| **Tên Use Case** | Tạo lịch trình du lịch tự động bằng Gemini AI |
| **Người phụ trách** | TV1 — Tín Phát |
| **Tác nhân chính** | Người dùng đã đăng nhập / Trưởng đoàn (`User`, `Admin`) |
| **Tác nhân phụ** | Gemini AI (`@google/genai`), Firestore / Bộ nhớ máy chủ |
| **Mô tả tóm tắt** | Cho phép người dùng nhập điểm đến và các tiêu chí chuyến đi (số ngày, ngày khởi hành, ngân sách, phong cách, nhóm khách, sở thích), hệ thống gọi Gemini AI sinh lịch trình JSON có cấu trúc, chuẩn hóa tọa độ/ngân sách/cảnh báo, hiển thị bản xem trước và lưu thành chuyến đi mới. |
| **Tiền điều kiện** | - Người dùng đã đăng nhập hợp lệ (có Firebase ID Token).<br>- Máy chủ có `GEMINI_API_KEY` khả dụng.<br>- Người dùng chưa vượt giới hạn `10 request / 5 phút` và chưa có quá `2` tác vụ AI đang chạy đồng thời. |
| **Hậu điều kiện** | - Nếu người dùng chấp nhận lưu: Chuyến đi mới được tạo trong hệ thống (`POST /api/trips`, `version = 1`), cấp `joinCode` duy nhất và đồng bộ lên danh sách chuyến đi đang hoạt động.<br>- Nếu hủy: Không lưu dữ liệu chuyến đi mới. |
| **Luồng sự kiện chính (Main Flow)** | 1. Người dùng mở hộp thoại Lập kế hoạch chuyến đi (`TripPlannerModal`) và chọn tab AI (`AiPlannerTab`).<br>2. Người dùng nhập: Điểm đến (có gợi ý địa danh), Số ngày (`2–7`), Ngày đi, Ngân sách, Phong cách, Nhóm khách và Sở thích.<br>3. Người dùng nhấn nút **"Tạo lịch trình bằng Gemini AI"** (`handleGenerateAI`).<br>4. Client kiểm tra đã nhập điểm đến, gửi `POST /api/gemini/generate-itinerary`.<br>5. Server xác thực token (`requireAuth`), kiểm tra rate limit (`aiRateLimiter`), kiểm tra số ngày `2–7` và tra cứu cache (`getCachedGeminiResult`).<br>6. Nếu chưa có cache, server đặt 1 slot xử lý (`gemini_job_slots`), tạo bản ghi tiến trình (`gemini_jobs`), trả về `202 Accepted` kèm `jobId`.<br>7. Server chạy bất đồng bộ gọi Gemini API (`generate-itinerary`), parse và sửa JSON (`parseGeminiJson`), kiểm tra đủ số ngày và mỗi ngày có `1–3` hoạt động.<br>8. Client polling `GET /api/gemini/jobs/{jobId}` mỗi `1.5 giây` (tối đa `90 giây`) cho đến khi `status === 'completed'`.<br>9. Client hiển thị bản xem trước lịch trình AI.<br>10. Người dùng nhấn **"Áp dụng & Tạo chuyến đi"** (`handleApplyAIPlan`).<br>11. Client chuẩn hóa ngày/hoạt động (`normalizeAiGeneratedDays`), ghép tọa độ điểm dừng (`buildAIPlanWaypoints`, `lookupCoordinates`), tính quãng đường (`computeEstimatedRouteKm`), phân bổ ngân sách (`computeTripBudgetSummaryFields`), sinh cảnh báo rủi ro (`createAiRiskAlerts`, `detectScheduleAndWeatherAlerts`).<br>12. Client gửi `POST /api/trips` để lưu chuyến đi và chuyển sang chuyến mới tạo. |
| **Luồng thay thế (Alternative Flow)** | - **A1 (Cache hit):** Ở bước 6, nếu server tìm thấy kết quả khớp `cacheKey` còn hạn (`GEMINI_CACHE_TTL_MS`), server trả ngay `200 OK` (`cached: true`) cùng dữ liệu, bỏ qua bước polling.<br>- **A2 (Thử lại model dự phòng):** Khi model chính lỗi `400/500/503/504`, `geminiService` tự thử lại với `GEMINI_FALLBACK_MODEL`. |
| **Luồng ngoại lệ (Exception Flow)** | - **E1 (Thiếu điểm đến):** Client chặn gửi và thông báo yêu cầu nhập điểm đến.<br>- **E2 (Sai số ngày):** Server trả `400 Bad Request` nếu số ngày ngoài khoảng `2–7`.<br>- **E3 (Vượt giới hạn AI):** Server trả `429 Too Many Requests` nếu vượt `10 req / 5 phút` hoặc đang chạy `2` job đồng thời (`ActiveGeminiJobLimitError`).<br>- **E4 (Thiếu `GEMINI_API_KEY`):** Server trả `503 Service Unavailable`.<br>- **E5 (Timeout / JSON lỗi):** Quá `90 giây` client dừng polling; hoặc Gemini trả JSON thiếu ngày/hoạt động, job chuyển `failed` và hiển thị lỗi cho người dùng tạo lại. |
| **Quy tắc nghiệp vụ & Mã nguồn** | - Số ngày hợp lệ: `2–7` ngày; mỗi ngày `1–3` hoạt động khi sinh mới.<br>- File liên quan: `AiPlannerTab.tsx`, `useAiTripPlanner.ts`, `helpers.ts`, `geminiJson.ts`, `src/server/routes/gemini.ts`, `src/server/routes/geminiJobs.ts`, `src/server/services/geminiService.ts`. |

#### Use Case Diagram — TV1

```mermaid
flowchart LR
    leader["Người dùng / Trưởng đoàn"]
    gemini["Gemini AI"]
    subgraph voyager["Hệ thống Voyager (TV1)"]
        uc1(("Nhập điểm đến và tiêu chí chuyến đi"))
        uc2(("Gửi yêu cầu sinh lịch trình AI"))
        uc3(("Theo dõi tiến trình xử lý Job"))
        uc4(("Xem trước & kiểm tra lịch trình"))
        uc5(("Chuẩn hóa & lưu chuyến đi mới"))
    end
    leader --- uc1
    leader --- uc2
    leader --- uc4
    leader --- uc5
    uc2 -.->|include| uc3
    gemini --- uc2
    uc2 --> uc4
    uc4 --> uc5
```

### 1.2. Activity Diagram — TV1

```mermaid
flowchart TD
    start([Bắt đầu])
    form["Nhập điểm đến, số ngày (2-7), ngày đi,<br/>ngân sách, phong cách, nhóm khách, sở thích"]
    validDest{"Đã nhập điểm đến?"}
    errDest["Hiển thị thông báo yêu cầu nhập điểm đến"]
    postApi["Gửi POST /api/gemini/generate-itinerary"]
    rateOk{"Hợp lệ quyền, rate limit & slot?"}
    errLimit["Hiển thị lỗi 400 / 429 / 503"]
    hasCache{"Có kết quả trong cache?"}
    createJob["Server tạo Job & gọi Gemini AI nền"]
    pollLoop["Client poll GET /api/gemini/jobs/:jobId (mỗi 1.5s, tối đa 90s)"]
    jobOk{"Job hoàn tất & JSON hợp lệ?"}
    errJob["Hiển thị lỗi xử lý hoặc quá thời gian"]
    preview["Hiển thị bản xem trước lịch trình AI"]
    accept{"Người dùng chọn lưu chuyến đi?"}
    normalize["Chuẩn hóa ngày, tọa độ Waypoints,<br/>ngân sách & quét cảnh báo rủi ro"]
    saveTrip["Gửi POST /api/trips lưu chuyến đi"]
    done([Hoàn tất])

    start --> form --> validDest
    validDest -- "Không" --> errDest --> form
    validDest -- "Có" --> postApi --> rateOk
    rateOk -- "Không" --> errLimit --> form
    rateOk -- "Có" --> hasCache
    hasCache -- "Có" --> preview
    hasCache -- "Không" --> createJob --> pollLoop --> jobOk
    jobOk -- "Không" --> errJob --> form
    jobOk -- "Có" --> preview
    preview --> accept
    accept -- "Không" --> done
    accept -- "Có" --> normalize --> saveTrip --> done
```

### 1.3. Sequence Diagram — TV1

```mermaid
sequenceDiagram
    actor User as Người dùng / Trưởng đoàn
    participant UI as TripPlannerModal / useAiTripPlanner
    participant GeminiAPI as Express /api/gemini/*
    participant Service as geminiService & JobStore
    participant Gemini as Google Gemini AI
    participant TripsAPI as Express /api/trips

    User->>UI: Nhập tiêu chí và nhấn Tạo lịch trình
    UI->>UI: Kiểm tra điểm đến không rỗng
    UI->>GeminiAPI: POST /api/gemini/generate-itinerary (Bearer Token)
    GeminiAPI->>GeminiAPI: requireAuth + aiRateLimiter + kiểm tra 2-7 ngày
    GeminiAPI->>Service: getCachedGeminiResult(cacheKey)
    alt Có kết quả Cache
        Service-->>GeminiAPI: Trả dữ liệu đã cache
        GeminiAPI-->>UI: 200 OK { cached: true, data }
    else Chưa có Cache
        GeminiAPI->>Service: createGeminiJob('generate-itinerary', ...)
        Service-->>GeminiAPI: Trả { id: jobId, status: 'queued' }
        GeminiAPI-->>UI: 202 Accepted { jobId }
        par Xử lý nền trên Server
            Service->>Gemini: generateContent(prompt, JSON schema)
            Gemini-->>Service: JSON lịch trình thô
            Service->>Service: parseGeminiJson() & kiểm tra số ngày/hoạt động
            Service->>Service: Cập nhật job status='completed', giải phóng slot
        and Client Polling (mỗi 1.5s, tối đa 90s)
            loop Đến khi completed / failed
                UI->>GeminiAPI: GET /api/gemini/jobs/{jobId}
                GeminiAPI->>Service: Đọc trạng thái job từ Firestore
                Service-->>GeminiAPI: Trả tiến độ / kết quả
                GeminiAPI-->>UI: 200 OK { job }
            end
        end
    end
    UI-->>User: Hiển thị bản xem trước lịch trình
    User->>UI: Nhấn Áp dụng & Tạo chuyến đi
    UI->>UI: normalizeAiGeneratedDays, buildAIPlanWaypoints, computeTripBudgetSummaryFields, createAiRiskAlerts
    UI->>TripsAPI: POST /api/trips (TripData)
    TripsAPI-->>UI: 201 Created { trip (version=1, joinCode) }
    UI-->>User: Đóng modal & mở dashboard chuyến đi mới
```

---

## 2. TV2 — Phạm Huy: Tối ưu lịch trình bằng AI (theo yêu cầu)

### 2.1. Đặc tả Use Case (Use Case Specification)

| Thuộc tính | Nội dung chi tiết |
| :--- | :--- |
| **Mã Use Case** | `UC-02` |
| **Tên Use Case** | Tối ưu lịch trình bằng AI (theo yêu cầu) |
| **Người phụ trách** | TV2 — Phạm Huy |
| **Tác nhân chính** | Chủ chuyến đi / Quản trị viên (`Owner`, `Admin`) |
| **Tác nhân phụ** | Gemini AI (`@google/genai`), Bộ kiểm tra khả thi (`scheduleValidator`), Bộ dự phòng quy tắc (`buildRuleBasedScheduleOptimization`) |
| **Mô tả tóm tắt** | Phân tích lịch trình hiện tại, cảnh báo vận hành và mục tiêu tối ưu của người dùng để đưa ra các phương án điều phối lại giờ giấc hợp lý. Mọi phương án do AI sinh ra đều bắt buộc đi qua **bộ kiểm tra khả thi theo quy tắc Admin** trước khi hiển thị bảng so sánh Trước/Sau (Diff) cho người dùng áp dụng hoặc hoàn tác (Undo). |
| **Tiền điều kiện** | - Người dùng đã đăng nhập và là Chủ chuyến đi (`ownerId === uid`) hoặc `Admin`.<br>- Chuyến đi có ít nhất 1 ngày chứa hoạt động (`days`). |
| **Hậu điều kiện** | - Nếu người dùng chọn áp dụng phương án: Lịch trình ngày mục tiêu được cập nhật theo đúng `activityId`, cảnh báo liên quan được gỡ có chọn lọc, lưu snapshot để hỗ trợ Hoàn tác (Undo) và đồng bộ lên server (`PUT /api/trips/{tripId}`).<br>- Nếu hủy hoặc không có phương án đạt chuẩn: Lịch trình gốc giữ nguyên. |
| **Luồng sự kiện chính (Main Flow)** | 1. Người dùng mở modal Tối ưu lịch trình (`AIOptimizeModal`).<br>2. Modal đóng gói dữ liệu rút gọn của chuyến đi (`compactTrip`), danh sách cảnh báo (`alertDetails`) và `userGoal`, gửi `POST /api/gemini/optimize-schedule`.<br>3. Server kiểm tra quyền sở hữu/admin (`buildOptimizePayload`), nạp cấu hình quy tắc vận hành (`rules`: khung giờ ngày, buffer tối thiểu, tốc độ di chuyển, kiểm tra chồng giờ/giờ mở cửa/nhận phòng sớm, ưu tiên tránh nắng trưa/người cao tuổi).<br>4. Server kiểm tra cache; nếu chưa có cache và có `GEMINI_API_KEY`, tạo job nền (`createGeminiJob`) và trả `202 Accepted` kèm `jobId`.<br>5. Server chạy `runOptimization`: dựng prompt kèm quy tắc bắt buộc (`buildOptimizePrompt`), gọi Gemini AI lấy danh sách đề xuất.<br>6. **Bộ kiểm tra khả thi (`validateOptimizationResult`)** mô phỏng từng đề xuất lên ngày mục tiêu, loại các đề xuất vi phạm quy tắc cứng (`OVERLAP`, `BUFFER_TOO_SHORT`, `TRANSIT_TOO_SHORT`, `OUT_OF_DAY_WINDOW`, `OUTSIDE_OPENING_HOURS`, `HOTEL_CHECKIN_EARLY`, `COMPLETED_ACTIVITY`) và gắn cảnh báo mềm (`HOT_NOON`, `ELDERLY_LONG_BLOCK`).<br>7. Client poll `GET /api/gemini/jobs/{jobId}` nhận về `recommendations` đã được lọc và thông tin `validation` (`accepted`, `rejected`).<br>8. Người dùng xem thẻ đề xuất hoặc chuyển sang chế độ **So sánh Trước / Sau (`computeOptimizationDiff`)**.<br>9. Người dùng chọn phương án và nhấn **"Áp dụng"**. Client dùng `applyScheduleChangesStrict` (chỉ ghép theo `activityId`), lọc cảnh báo đã xử lý (`filterAlertsByRecommendation`), lưu bản sao hoàn tác (`Undo`) và lưu lên server. |
| **Luồng thay thế (Alternative Flow)** | - **A1 (AI tự sửa 1 lần khi bị loại hết):** Nếu Gemini trả kết quả nhưng `accepted.length === 0 && rejected.length > 0`, server gửi kèm lý do vi phạm (`summarizeRejectionsForRetry`) để AI sửa lại 1 lần duy nhất.<br>- **A2 (Fallback thuần quy tắc khi AI lỗi hoặc thiếu API key):** Nếu `ai === null` hoặc gọi Gemini thất bại, `runOptimization` kích hoạt `buildRuleBasedScheduleOptimization` (xử lý cảnh báo thời tiết/đèo dốc, sửa buffer/overlap, tránh nắng trưa `11:30–13:30`) và vẫn đưa qua `validateOptimizationResult` (`source: 'fallback'`).<br>- **A3 (Hoàn tác / Undo):** Sau khi áp dụng, người dùng có thể nhấn Hoàn tác để khôi phục trạng thái lịch trình trước đó. |
| **Luồng ngoại lệ (Exception Flow)** | - **E1 (Không đủ quyền):** Nếu user không phải chủ chuyến/Admin, server trả `403 Forbidden`.<br>- **E2 (Không có phương án an toàn):** Toàn bộ đề xuất bị bộ kiểm tra loại; client hiển thị lý do bị loại (`validation.rejected`) và không cho áp dụng phương án lỗi.<br>- **E3 (Vượt giới hạn AI / Timeout):** Trả `429` khi vượt rate limit hoặc tối đa 2 job; timeout sau `90 giây`. |
| **Quy tắc nghiệp vụ & Mã nguồn** | - Tuyệt đối không ghép thay đổi theo tên hoạt động — bắt buộc khớp `activityId` chính xác.<br>- Không sửa hoạt động đã `"Hoàn tất"`.<br>- File liên quan: `AIOptimizeModal.tsx`, `scheduleOptimizer.ts`, `scheduleValidator.ts`, `applyOptimization.ts`, `src/server/routes/gemini.ts`, `src/server/services/geminiService.ts`. |

#### Use Case Diagram — TV2

```mermaid
flowchart LR
    leader["Chủ chuyến đi / Admin"]
    gemini["Gemini AI"]
    subgraph voyager["Hệ thống Voyager (TV2)"]
        uc1(("Phân tích lịch trình & cảnh báo"))
        uc2(("Kiểm tra khả thi theo quy tắc Admin"))
        uc3(("Xem đề xuất & so sánh Diff Trước/Sau"))
        uc4(("Áp dụng phương án tối ưu"))
        uc5(("Hoàn tác (Undo) thay đổi"))
    end
    leader --- uc1
    leader --- uc3
    leader --- uc4
    leader --- uc5
    gemini --- uc1
    uc1 -->|include| uc2
    uc2 --> uc3
    uc3 --> uc4
    uc5 -.->|extend| uc4
```

### 2.2. Activity Diagram — TV2

```mermaid
flowchart TD
    start([Bắt đầu])
    open["Mở AIOptimizeModal & gửi POST /api/gemini/optimize-schedule"]
    auth{"Đủ quyền Owner/Admin & hợp lệ payload?"}
    errAuth["Trả lỗi 400 / 403 / 429"]
    hasKey{"Server có GEMINI_API_KEY?"}
    callAi["Gọi Gemini AI sinh đề xuất JSON"]
    aiOk{"AI trả JSON hợp lệ?"}
    fallback["Chạy bộ dự phòng theo quy tắc<br/>(buildRuleBasedScheduleOptimization)"]
    validate["Chạy bộ kiểm tra khả thi<br/>(validateOptimizationResult)"]
    allRejected{"AI bị loại hết đề xuất<br/>và chưa thử lại?"}
    retryAi["Gửi lý do vi phạm để Gemini sửa 1 lần"]
    hasAccepted{"Có phương án đạt chuẩn?"}
    showEmpty["Hiển thị danh sách lý do bị loại"]
    showDiff["Hiển thị đề xuất, cảnh báo mềm<br/>& bảng Diff Trước/Sau"]
    applyChoice{"Người dùng chọn Áp dụng?"}
    applyStrict["Áp dụng theo activityId, lọc cảnh báo,<br/>lưu lịch sử Undo & PUT /api/trips/:id"]
    done([Hoàn tất])

    start --> open --> auth
    auth -- "Không" --> errAuth --> done
    auth -- "Có" --> hasKey
    hasKey -- "Không" --> fallback --> validate
    hasKey -- "Có" --> callAi --> aiOk
    aiOk -- "Không" --> fallback
    aiOk -- "Có" --> validate --> allRejected
    allRejected -- "Có" --> retryAi --> validate
    allRejected -- "Không" --> hasAccepted
    hasAccepted -- "Không" --> showEmpty --> done
    hasAccepted -- "Có" --> showDiff --> applyChoice
    applyChoice -- "Không" --> done
    applyChoice -- "Có" --> applyStrict --> done
```

### 2.3. Sequence Diagram — TV2

```mermaid
sequenceDiagram
    actor Owner as Chủ chuyến đi / Admin
    participant Modal as AIOptimizeModal
    participant API as Express /api/gemini/optimize-schedule
    participant Service as geminiService & scheduleOptimizer
    participant Gemini as Google Gemini AI
    participant Validator as scheduleValidator (Rule Engine)
    participant TripsAPI as Express /api/trips

    Owner->>Modal: Mở modal Tối ưu lịch trình
    Modal->>API: POST /api/gemini/optimize-schedule (compactTrip, alerts, userGoal)
    API->>Service: buildOptimizePayload(body, authUser)
    alt Có GEMINI_API_KEY & chưa có cache
        API->>Service: createGeminiJob('optimize-schedule', ...)
        API-->>Modal: 202 Accepted { jobId }
        Service->>Service: buildOptimizePrompt(payload, adminRules)
        Service->>Gemini: generateContent(prompt)
        alt Gemini trả đề xuất
            Gemini-->>Service: JSON recommendations
        else Gemini lỗi
            Service->>Service: buildRuleBasedScheduleOptimization(payload)
        end
        Service->>Validator: validateOptimizationResult(raw, trip, adminRules)
        Validator-->>Service: { accepted, rejected }
        opt source='gemini' và accepted=0 và rejected>0
            Service->>Gemini: Thử lại 1 lần kèm summarizeRejectionsForRetry
            Gemini-->>Service: JSON đã sửa
            Service->>Validator: validateOptimizationResult(retryRaw, trip, adminRules)
        end
        loop Client poll mỗi 1.5s
            Modal->>API: GET /api/gemini/jobs/{jobId}
            API-->>Modal: { status: 'completed', result: { recommendations, validation } }
        end
    else Không có GEMINI_API_KEY
        Service->>Service: buildRuleBasedScheduleOptimization + validateOptimizationResult
        API-->>Modal: 200 OK { data (source: 'fallback') }
    end
    Modal->>Modal: computeOptimizationDiff(trip, selectedRec)
    Modal-->>Owner: Hiển thị thẻ đề xuất & bảng Diff Trước/Sau
    Owner->>Modal: Nhấn Áp dụng phương án
    Modal->>Modal: applyScheduleChangesStrict + filterAlertsByRecommendation
    Modal->>TripsAPI: PUT /api/trips/{tripId}
    TripsAPI-->>Modal: 200 OK (version mới)
    Modal-->>Owner: Cập nhật lịch trình & bật tùy chọn Hoàn tác (Undo)
```

---

## 3. TV3 — Gia Khánh: Quản lý bản đồ và tiến độ lịch trình

### 3.1. Đặc tả Use Case (Use Case Specification)

| Thuộc tính | Nội dung chi tiết |
| :--- | :--- |
| **Mã Use Case** | `UC-03` |
| **Tên Use Case** | Quản lý bản đồ và tiến độ lịch trình |
| **Người phụ trách** | TV3 — Gia Khánh |
| **Tác nhân chính** | Thành viên đoàn (`User`, `Guest` ở chế độ chỉ đọc), Chủ chuyến đi / Quản trị viên (`Owner`, `Admin`) |
| **Tác nhân phụ** | Dịch vụ định tuyến OSRM (`router.project-osrm.org`), Dịch vụ thời tiết Open-Meteo (`api.open-meteo.com`), Bản đồ Leaflet / CARTO |
| **Mô tả tóm tắt** | Hiển thị bản đồ tuyến đường trực quan theo từng ngày hoặc toàn chuyến, tính khoảng cách/thời gian di chuyển thực tế qua OSRM (hoặc ước tính Haversine khi OSRM lỗi), đồng bộ thời tiết dọc tuyến từ Open-Meteo, theo dõi tiến độ theo trạng thái điểm dừng, cho phép cập nhật trạng thái điểm dừng và tối ưu thứ tự lộ trình ngắn nhất (TSP). |
| **Tiền điều kiện** | - Chuyến đi có danh sách ngày/hoạt động hoặc điểm dừng (`waypoints`).<br>- Người dùng đang xem Dashboard người dùng hoặc chế độ Hành khách (`GuestTripView`). |
| **Hậu điều kiện** | - Bản đồ, lộ trình từng chặng, phần trăm tiến độ và thời tiết dọc tuyến được hiển thị chính xác.<br>- Nếu cập nhật trạng thái điểm dừng hoặc áp dụng tối ưu tuyến TSP (với quyền chỉnh sửa): dữ liệu chuyến đi được đồng bộ và lưu lại (`PUT /api/trips/{tripId}`). |
| **Luồng sự kiện chính (Main Flow)** | 1. Người dùng mở tab/khối Bản đồ tuyến đường (`LiveRouteMap`).<br>2. Hệ thống tổng hợp danh sách điểm dừng và tiến độ (`buildRouteProgress`) theo bộ lọc ngày (`dayFilter`: toàn chuyến hoặc 1 ngày cụ thể).<br>3. Nếu có từ `2` điểm dừng có tọa độ hợp lệ trở lên và chưa có trong cache, hook `useRoadRouting` gọi `POST /api/routing/road` (hoặc `POST /api/guest/routing/road` nếu là khách).<br>4. Server gọi OSRM tính khoảng cách thực tế (`distanceKm`), thời gian di chuyển (`durationMinutes`) và hình học tuyến (`geometry`) cho từng chặng, trả về client.<br>5. Đồng thời, `useLiveRouteControls` gom các điểm có tọa độ (`collectRouteWeatherTargets`) gọi Open-Meteo (`buildBatchOpenMeteoUrl`) để hiển thị thời tiết dọc tuyến (có cache `5 phút` và tự làm mới `10 phút`).<br>6. `LiveMapCanvas` (Leaflet) vẽ marker điểm dừng theo trạng thái (`completed`, `current`, `upcoming`), vẽ polyline tuyến đường và hiển thị tiến độ ở `LiveMapHeader` & `RouteStopsPanel`.<br>7. Người dùng có thể lọc theo ngày, chọn điểm dừng để phóng to trên bản đồ, bấm làm mới thời tiết, cập nhật trạng thái hoàn thành của điểm dừng (`applyStopStatusUpdate`), hoặc xem trước/áp dụng tối ưu thứ tự tuyến đường TSP (`optimizeDayActivitiesByRoute` / `optimizeTripByRouteTSP`). |
| **Luồng thay thế (Alternative Flow)** | - **A1 (Chế độ Khách / Hành khách `readOnly`):** Khách xem được bản đồ, tuyến OSRM (`/api/guest/routing/road`), thời tiết và tiến độ, nhưng bị ẩn nút sửa trạng thái điểm dừng và nút tối ưu TSP.<br>- **A2 (Tối ưu lộ trình TSP):** Khi phát hiện thứ tự điểm dừng chưa tối ưu (tiết kiệm `>= 0.5 km`), hiển thị gợi ý TSP; khi chủ chuyến nhấn áp dụng, hệ thống sắp lại hoạt động/waypoints, gọi `fetchRealOsrmRouteSummary` cập nhật `totalKm` và lưu chuyến đi. |
| **Luồng ngoại lệ (Exception Flow)** | - **E1 (OSRM không khả dụng / timeout):** API trả `source: 'fallback'`; `buildRouteProgress` tự tính khoảng cách theo công thức Haversine × hệ số đường bộ và giữ giao diện hoạt động bình thường.<br>- **E2 (Thiếu tọa độ điểm dừng):** Điểm dừng không có tọa độ hợp lệ (hoặc tọa độ hash cũ) được bỏ qua khỏi định tuyến OSRM và hiển thị ghi chú thiếu tọa độ.<br>- **E3 (Lỗi Open-Meteo):** Hiển thị thông báo không tải được thời tiết mới, giữ dữ liệu thời tiết hiện có của chuyến đi. |
| **Quy tắc nghiệp vụ & Mã nguồn** | - Tiến độ lộ trình tính theo trạng thái hoạt động/điểm dừng (không dùng GPS xe trực tiếp).<br>- File liên quan: `LiveRouteMap.tsx`, `LiveMapCanvas.tsx`, `LiveMapHeader.tsx`, `RouteStopsPanel.tsx`, `useLiveRouteMap.ts`, `useRoadRouting.ts`, `useLiveRouteControls.ts`, `routeProgress.ts`, `routeTspOptimizer.ts`, `weatherParser.ts`, `src/server/routes/routing.ts`, `src/server/routes/guest.ts`. |

#### Use Case Diagram — TV3

```mermaid
flowchart LR
    member["Thành viên / Khách (Read-only)"]
    owner["Chủ chuyến đi / Admin"]
    osrm["Dịch vụ OSRM"]
    meteo["API thời tiết Open-Meteo"]
    subgraph voyager["Hệ thống Voyager (TV3)"]
        uc1(("Xem bản đồ & điểm dừng"))
        uc2(("Lọc tiến độ theo ngày"))
        uc3(("Tính tuyến đường bộ & quãng đường"))
        uc4(("Đồng bộ thời tiết dọc tuyến"))
        uc5(("Cập nhật trạng thái điểm dừng"))
        uc6(("Tối ưu thứ tự điểm dừng TSP"))
    end
    member --- uc1
    member --- uc2
    owner --- uc1
    owner --- uc2
    owner --- uc5
    owner --- uc6
    uc1 -->|include| uc3
    uc1 -->|include| uc4
    osrm --- uc3
    meteo --- uc4
    uc6 -.->|extend| uc3
```

### 3.2. Activity Diagram — TV3

```mermaid
flowchart TD
    start([Bắt đầu])
    open["Mở LiveRouteMap & chọn bộ lọc ngày"]
    build["Tổng hợp điểm dừng & tiến độ (buildRouteProgress)"]
    enough{"Có >= 2 điểm dừng có tọa độ?"}
    estimate["Ước tính quãng đường bằng Haversine"]
    callOsrm["Gọi POST /api/routing/road (hoặc /api/guest/routing/road)"]
    osrmOk{"OSRM trả tuyến thành công?"}
    fetchWeather["Gọi Open-Meteo lấy thời tiết dọc tuyến (cache 5 phút)"]
    renderMap["Vẽ bản đồ Leaflet, tuyến đường, thời tiết & % tiến độ"]
    action{"Thao tác người dùng"}
    filter["Đổi ngày lọc / Chọn điểm dừng trên panel"]
    toggleStop{"Có quyền sửa & chọn đổi trạng thái?"}
    updateStop["Cập nhật trạng thái điểm dừng (applyStopStatusUpdate)"]
    applyTsp["Chạy TSP sắp xếp điểm dừng & gọi OSRM tính lại km"]
    saveTrip["Đồng bộ lưu TripData (PUT /api/trips/:id)"]
    done([Hoàn tất])

    start --> open --> build --> enough
    enough -- "Không" --> estimate --> fetchWeather
    enough -- "Có" --> callOsrm --> osrmOk
    osrmOk -- "Không" --> estimate
    osrmOk -- "Có" --> fetchWeather
    fetchWeather --> renderMap --> action
    action -- "Lọc / Xem điểm" --> filter --> build
    action -- "Đổi trạng thái điểm dừng" --> toggleStop
    toggleStop -- "Có" --> updateStop --> saveTrip --> build
    toggleStop -- "Không (Read-only)" --> renderMap
    action -- "Tối ưu tuyến TSP" --> applyTsp --> saveTrip
    action -- "Rời màn hình" --> done
```

### 3.3. Sequence Diagram — TV3

```mermaid
sequenceDiagram
    actor User as Thành viên / Chủ chuyến đi
    participant Map as LiveRouteMap & Hooks
    participant Progress as routeProgress / routeTspOptimizer
    participant API as Express /api/routing/road
    participant OSRM as OSRM Server
    participant Meteo as Open-Meteo API
    participant TripsAPI as Express /api/trips

    User->>Map: Mở bản đồ hoặc đổi ngày lọc
    Map->>Progress: buildRouteProgress(trip, dayFilter)
    Progress-->>Map: Danh sách stops & % tiến độ
    opt Có >= 2 điểm dừng có tọa độ và chưa có cache
        Map->>API: POST /api/routing/road (points)
        API->>OSRM: Yêu cầu tuyến driving & geometry
        alt OSRM khả dụng
            OSRM-->>API: Trả legs (distanceKm, durationMinutes, geometry)
            API-->>Map: { source: 'osrm', legs }
        else OSRM lỗi / timeout
            API-->>Map: { source: 'fallback', legs: [] }
            Map->>Progress: Tự tính khoảng cách ước tính Haversine
        end
    end
    Map->>Meteo: GET forecast cho các tọa độ dọc tuyến
    Meteo-->>Map: Nhiệt độ, mã thời tiết, xác suất mưa
    Map-->>User: Hiển thị bản đồ Leaflet, đường nối, thời tiết & tiến độ
    alt Chủ chuyến đi cập nhật trạng thái điểm dừng hoặc áp dụng TSP
        User->>Map: Bấm hoàn tất điểm dừng / Áp dụng tối ưu TSP
        Map->>Progress: applyStopStatusUpdate() hoặc optimizeTripByRouteTSP()
        Map->>TripsAPI: PUT /api/trips/{tripId}
        TripsAPI-->>Map: 200 OK (lưu thành công)
        Map-->>User: Cập nhật bản đồ & tiến độ mới
    end
```

---

## 4. TV4 — Quốc Tuấn: Quản lý thành viên & Điểm danh đoàn du lịch

### 4.1. Đặc tả Use Case (Use Case Specification)

| Thuộc tính | Nội dung chi tiết |
| :--- | :--- |
| **Mã Use Case** | `UC-04` |
| **Tên Use Case** | Quản lý thành viên & Điểm danh đoàn du lịch |
| **Người phụ trách** | TV4 — Quốc Tuấn |
| **Tác nhân chính** | Chủ chuyến đi / Trưởng đoàn (`Owner`, `Admin`), Thành viên có tài khoản (`Participant / HK`), Hành khách không tài khoản (`Guest`) |
| **Tác nhân phụ** | Máy chủ Voyager API, Firestore |
| **Mô tả tóm tắt** | Quản lý danh sách thành viên đoàn (hành khách, hướng dẫn viên, tài xế, người thân đi cùng), tạo/xoay vòng/bật-tắt mã mời tham gia chuyến đi (`joinCode`), hỗ trợ thành viên tham gia bằng mã mời hoặc xem chế độ Hành khách không cần tài khoản, và thực hiện điểm danh trạng thái (`Có mặt`, `Vắng mặt`, `Chưa điểm danh`) có kiểm soát quyền và xung đột phiên bản (`version`). |
| **Tiền điều kiện** | - Đối với quản lý thành viên, mã mời, điểm danh người khác: Người dùng đăng nhập là Chủ chuyến đi hoặc Admin.<br>- Đối với tự điểm danh / thêm người thân đi cùng (`guest-companions`): Người dùng là thành viên đã tham gia chuyến đi (`participantUids`).<br>- Đối với xem lịch trình chế độ Khách: Có `joinCode` hợp lệ (`5–12` ký tự chữ/số) và đang được bật. |
| **Hậu điều kiện** | - Danh sách thành viên, mã mời, số lượng người online/điểm danh (`membersOnline`, `membersTotal`, `membersStatus`) được cập nhật đồng bộ giữa Client và Firestore.<br>- Nếu xóa thành viên có người thân đi cùng, hệ thống xử lý gỡ liên kết/cascade người thân đi kèm. |
| **Luồng sự kiện chính (Main Flow)** | 1. Chủ chuyến đi mở màn hình Thành viên (`MembersView`) để xem bộ lọc (Tất cả / Hành khách / Nhân sự / Khách đi cùng) và thống kê có mặt.<br>2. **Quản lý hồ sơ thành viên (Owner/Admin):** Thêm, sửa, hoặc xóa thành viên; đồng bộ danh sách qua `PUT /api/trips/{tripId}`.<br>3. **Quản lý mã mời (`joinCode`):** Chủ chuyến đi tạo mới, xoay mã (`rotate`) hoặc bật/tắt mã mời (`toggle`) qua `POST /api/trips/{tripId}/join-code`.<br>4. **Tham gia chuyến bằng mã (`JoinTripModal`):** Thành viên khác nhập mã mời → gọi `POST /api/trips/join` → server gán UID vào `participantUids`, thêm bản ghi thành viên `HK` và trả về chuyến đi đã lọc thông tin nhạy cảm (`sanitizeTripForParticipant`).<br>5. **Thêm người thân đi cùng không cần tài khoản:** Thành viên hoặc chủ chuyến gọi `POST /api/trips/{tripId}/guest-companions` (mỗi hành khách tối đa `MAX_GUEST_COMPANIONS_PER_PASSENGER` người thân).<br>6. **Điểm danh (`PATCH /api/trips/{tripId}/members/{memberId}/attendance`):**<br>   - Client cập nhật lạc quan (optimistic UI) và gửi kèm `attendanceStatus` + `expectedVersion`.<br>   - Server kiểm tra quyền (Owner/Admin được điểm danh mọi người; Thành viên tự điểm danh bản thân hoặc người thân do mình mời), kiểm tra trạng thái hợp lệ và chạy transaction tăng `version`.<br>   - Server trả về `membersStatus`, `version` mới; client đồng bộ thống kê có mặt. |
| **Luồng thay thế (Alternative Flow)** | - **A1 (Vào bằng mã cho Khách không tài khoản):** Tại `AuthScreen` (tab "Vào bằng mã") hoặc link `?guest=CODE`, khách gửi `POST /api/guest/access`; server trả `GuestTripData` đã ẩn chi phí/UID/SĐT hành khách (`sanitizeTripForGuest`) và lưu phiên vào `localStorage`.<br>- **A2 (Rời chuyến đi):** Thành viên đã tham gia có thể rời chuyến qua `POST /api/trips/{tripId}/leave`. |
| **Luồng ngoại lệ (Exception Flow)** | - **E1 (Xung đột phiên bản `409 Conflict`):** Khi điểm danh hoặc sửa thành viên bị lệch `version` với máy chủ, server trả `409`; client tải snapshot mới nhất và mở `SyncConflictModal` để người dùng chọn giữ bản máy chủ hay ghi đè.<br>- **E2 (Vượt giới hạn thử mã mời):** `joinCodeRateLimiter` chặn khi thử quá `40 lần / 5 phút` (`429`).<br>- **E3 (Mã mời bị khóa hoặc sai):** Trả `403` (mã đã tắt) hoặc `404` (không tìm thấy).<br>- **E4 (Vượt giới hạn người thân / Không đủ quyền):** Trả `400` / `403` và hoàn tác trạng thái lạc quan trên UI. |
| **Quy tắc nghiệp vụ & Mã nguồn** | - Phân quyền chặt chẽ giữa Owner/Admin, Participant (`sanitizeTripForParticipant`), và Guest (`sanitizeTripForGuest`).<br>- File liên quan: `MembersView.tsx`, `JoinTripModal.tsx`, `GuestTripView.tsx`, `useTripActions.ts`, `tripJoinHelpers.ts`, `guestSession.ts`, `src/server/routes/tripManagement.ts`, `src/server/routes/guest.ts`. |

#### Use Case Diagram — TV4

```mermaid
flowchart LR
    owner["Chủ chuyến đi / Admin"]
    participant["Thành viên đã tham gia"]
    guest["Hành khách (Không tài khoản)"]
    subgraph voyager["Hệ thống Voyager (TV4)"]
        uc1(("Thêm, sửa, xóa thành viên"))
        uc2(("Tạo, đổi, bật/tắt mã mời"))
        uc3(("Tham gia chuyến đi bằng mã"))
        uc4(("Thêm / xóa người thân đi cùng"))
        uc5(("Điểm danh thành viên"))
        uc6(("Xem lịch trình chế độ Khách"))
    end
    owner --- uc1
    owner --- uc2
    owner --- uc4
    owner --- uc5
    participant --- uc3
    participant --- uc4
    participant --- uc5
    guest --- uc6
    uc1 --> uc5
```

### 4.2. Activity Diagram — TV4

```mermaid
flowchart TD
    start([Bắt đầu])
    open["Mở tab Thành viên / Màn hình tham gia bằng mã"]
    roleAction{"Chọn nghiệp vụ"}
    crudMember["Thêm / Sửa / Xóa thành viên (PUT /api/trips/:id)"]
    manageCode["Tạo / Xoay / Khóa mã mời (POST .../join-code)"]
    joinTrip["Nhập mã mời tham gia chuyến (POST /api/trips/join)"]
    guestView["Vào bằng mã chế độ Khách (POST /api/guest/access)"]
    attendance["Chọn trạng thái điểm danh (Có mặt / Vắng mặt / Chưa điểm danh)"]
    checkPerm{"Có quyền điểm danh thành viên này?"}
    errPerm["Hiển thị lỗi 403 & hoàn tác UI"]
    sendPatch["Gửi PATCH .../members/:memberId/attendance (kèm expectedVersion)"]
    checkVer{"Version trên server khớp?"}
    conflict["Nhận 409 Conflict -> tải snapshot server -> mở SyncConflictModal"]
    saveOk["Cập nhật members, membersStatus & version mới"]
    done([Hoàn tất])

    start --> open --> roleAction
    roleAction -- "CRUD thành viên" --> crudMember --> checkVer
    roleAction -- "Mã mời" --> manageCode --> saveOk
    roleAction -- "Tham gia bằng mã" --> joinTrip --> saveOk
    roleAction -- "Xem chế độ Khách" --> guestView --> done
    roleAction -- "Điểm danh" --> attendance --> checkPerm
    checkPerm -- "Không" --> errPerm --> done
    checkPerm -- "Có" --> sendPatch --> checkVer
    checkVer -- "Không (409)" --> conflict --> done
    checkVer -- "Có (200)" --> saveOk --> done
```

### 4.3. Sequence Diagram — TV4

```mermaid
sequenceDiagram
    actor Leader as Trưởng đoàn / Thành viên
    participant UI as MembersView
    participant Actions as useTripActions
    participant API as Express /api/trips/*
    participant Store as Firestore (Transaction)

    Leader->>UI: Chọn trạng thái điểm danh cho memberId
    UI->>Actions: handleToggleMemberAttendance(memberId, nextStatus)
    Actions->>Actions: Lưu snapshot cũ & cập nhật Optimistic UI
    Actions->>API: PATCH /api/trips/{tripId}/members/{memberId}/attendance { attendanceStatus, expectedVersion }
    API->>Store: Đọc chuyến đi trong runTransaction()
    API->>API: Kiểm tra quyền (Owner/Admin hoặc tự điểm danh/người thân)
    alt Thiếu quyền hoặc trạng thái không hợp lệ
        API-->>Actions: 403 / 400 Error
        Actions->>Actions: Rollback UI về snapshot cũ
        Actions-->>UI: Hiển thị thông báo lỗi
    else Lệch phiên bản (expectedVersion != server.version)
        API-->>Actions: 409 Conflict
        Actions->>API: GET /api/trips/{tripId} (lấy bản mới nhất)
        API-->>Actions: Server snapshot
        Actions-->>UI: Mở SyncConflictModal để người dùng chọn giữ/ghi đè
    else Hợp lệ
        API->>Store: Ghi attendanceStatus, tính membersStatus & tăng version + 1
        Store-->>API: Commit thành công
        API-->>Actions: 200 OK { members, membersStatus, version }
        Actions->>Actions: Cập nhật state & cache offline
        Actions-->>UI: Hiển thị trạng thái & tổng số có mặt mới
    end
```

---

## 5. TV5 — Minh Tuấn: Quản lý ngân sách & Ghi nhận hóa đơn chuyến đi

### 5.1. Đặc tả Use Case (Use Case Specification)

| Thuộc tính | Nội dung chi tiết |
| :--- | :--- |
| **Mã Use Case** | `UC-05` |
| **Tên Use Case** | Quản lý ngân sách & Ghi nhận hóa đơn chuyến đi |
| **Người phụ trách** | TV5 — Minh Tuấn |
| **Tác nhân chính** | Chủ chuyến đi / Trưởng đoàn (`Owner`, `Admin`) |
| **Tác nhân phụ** | Máy chủ Voyager API, Firestore (`trips`, `trip_receipts`) |
| **Mô tả tóm tắt** | Cho phép thiết lập tổng ngân sách và phân bổ hạn mức cho 5 hạng mục (Vận chuyển, Lưu trú, Ẩm thực, Tham quan, Dự phòng), ghi nhận/chỉnh sửa/xóa hóa đơn thực tế, liên kết hóa đơn với hoạt động trong lịch trình (tránh tính trùng chi phí), đính kèm ảnh chứng từ có nén tự động, theo dõi cảnh báo vượt hạn mức và xem/xuất báo cáo chi tiêu CSV. |
| **Tiền điều kiện** | - Người dùng đã đăng nhập với quyền chỉnh sửa chuyến đi (`Owner` hoặc `Admin`).<br>- Đã chọn một chuyến đi hợp lệ; nếu thêm hóa đơn mới thì tổng số hóa đơn chưa vượt `MAX_INVOICES_PER_TRIP`. |
| **Hậu điều kiện** | - Ngân sách tổng, phân bổ hạng mục, danh sách hóa đơn (`invoices`), 4 chỉ số tổng hợp (`budgetTotal`, `budgetUsed`, `budgetRemaining`, `budgetUsedPercent`) và các cảnh báo ngân sách (`alert-budget-*`) được tính lại đồng bộ và lưu trên server (hoặc hàng đợi offline nếu mất mạng).<br>- Ảnh chứng từ tách lưu riêng ở collection `trip_receipts` (tối ưu dưới giới hạn 900KB của tài liệu Firestore chuyến đi). |
| **Luồng sự kiện chính (Main Flow)** | 1. Chủ chuyến đi mở tab Ngân sách (`BudgetView`).<br>2. Hệ thống tính toán số liệu qua `useBudgetCalculations` (`computeBudgetMetrics`): phân tách chi thực tế (hóa đơn + hoạt động `"Hoàn tất"` chưa gắn hóa đơn), chi dự kiến (hoạt động chưa hoàn tất/chưa hủy, bỏ qua hoạt động `"Chờ duyệt"`), và phần trăm từng hạng mục.<br>3. **Chỉnh sửa ngân sách (`BudgetEditModals`):** Nhập tổng ngân sách hoặc phân bổ chi tiết 5 hạng mục → tính lại 4 trường ngân sách và lưu qua `PUT /api/trips/{tripId}`.<br>4. **Ghi nhận / sửa hóa đơn (`InvoiceEditorModal` & `useBudgetActions`):**<br>   - Nhập tên khoản chi, số tiền (`> 0`), hạng mục, ngày/chỉ số ngày, nhà cung cấp, số hóa đơn, ghi chú, và có thể chọn hoạt động liên kết (`linkedActivityId`) để tự động điền ngày/hạng mục/chi phí.<br>   - Nếu đính kèm ảnh chứng từ: client kiểm tra định dạng ảnh (`JPG/PNG/WebP`), tự động resize tối đa `800px` và nén JPEG dưới `95–180KB` (`handleReceiptFileChange`).<br>   - Nhấn Lưu: nếu đang trực tuyến và có ảnh mới, client tải ảnh lên `POST /api/trips/{tripId}/receipts` để nhận `receiptId`.<br>   - Tạo/cập nhật bản ghi `ExpenseInvoice`, tính lại `computeTripBudgetSummaryFields`, cập nhật chuyến đi (`PUT /api/trips/{tripId}`).<br>   - Nếu sửa hóa đơn thay ảnh mới, client xóa chứng từ cũ (`DELETE /api/trips/{tripId}/receipts/{oldReceiptId}`).<br>5. `syncBudgetAlertsIntoTrip` tự động tạo/cập nhật/gỡ cảnh báo khi chi tiêu chạm ngưỡng `>= 85%` hoặc vượt `100%` tổng/hạng mục.<br>6. Người dùng có thể mở `ExpenseReportModal` để xem tổng hợp hoặc xuất file CSV (`handleExportCsv` → `buildExpenseReportCsv`). |
| **Luồng thay thế (Alternative Flow)** | - **A1 (Ngoại tuyến / Lỗi tải ảnh tạm thời):** Nếu mất mạng khi lưu hóa đơn có ảnh, ảnh nén được giữ tạm dạng `receiptImage` inline trong bản ghi hóa đơn và lưu vào hàng đợi offline (`offlineStorage`); khi đồng bộ lại (`offloadTripReceipts`), hệ thống tự tách ảnh upload lên `trip_receipts`.<br>- **A2 (Xóa hóa đơn):** Xóa hóa đơn khỏi danh sách, tính lại ngân sách và chỉ gọi `DELETE /api/trips/{tripId}/receipts/{receiptId}` sau khi đã lưu chuyến đi thành công (tránh mất ảnh nếu lưu thất bại). |
| **Luồng ngoại lệ (Exception Flow)** | - **E1 (Vượt số lượng hóa đơn tối đa):** Chặn tạo mới khi đạt `MAX_INVOICES_PER_TRIP`.<br>- **E2 (Ảnh quá lớn hoặc sai định dạng):** Báo lỗi nếu không phải tệp ảnh hoặc sau khi nén vẫn `> 180KB`.<br>- **E3 (Chạm giới hạn tài liệu Firestore 900KB):** Server trả `413 Payload Too Large` nếu dữ liệu chuyến đi quá lớn.<br>- **E4 (Xung đột version 409):** Mở `SyncConflictModal` để đối chiếu phiên bản. |
| **Quy tắc nghiệp vụ & Mã nguồn** | - Hoạt động đã liên kết với hóa đơn thực tế (`linkedActivityId`) chỉ tính tiền theo hóa đơn, không cộng trùng.<br>- Hoạt động `"Chờ duyệt"` không tính vào `budgetUsed`.<br>- Ngưỡng cảnh báo sớm: `BUDGET_NEAR_LIMIT_RATIO = 0.85` (85%).<br>- File liên quan: `BudgetView.tsx`, `BudgetSummary.tsx`, `BudgetEditModals.tsx`, `ExpenseLedger.tsx`, `InvoiceEditorModal.tsx`, `ExpenseReportModal.tsx`, `ReceiptImage.tsx`, `useBudgetActions.ts`, `useBudgetCalculations.ts`, `useBudgetSettings.ts`, `budgetAlerts.ts`, `tripSyncHelpers.ts`, `src/server/routes/tripManagement.ts`. |

#### Use Case Diagram — TV5

```mermaid
flowchart LR
    owner["Chủ chuyến đi / Admin"]
    subgraph voyager["Hệ thống Voyager (TV5)"]
        uc1(("Thiết lập tổng ngân sách & phân bổ hạng mục"))
        uc2(("Ghi nhận / Sửa / Xóa hóa đơn"))
        uc3(("Nén & tải ảnh chứng từ"))
        uc4(("Liên kết hóa đơn với hoạt động"))
        uc5(("Tính toán số dư & cảnh báo vượt mức"))
        uc6(("Xem & xuất báo cáo chi phí CSV"))
    end
    owner --- uc1
    owner --- uc2
    owner --- uc5
    owner --- uc6
    uc3 -.->|extend| uc2
    uc4 -.->|extend| uc2
    uc1 --> uc5
    uc2 --> uc5
    uc5 --> uc6
```

### 5.2. Activity Diagram — TV5

```mermaid
flowchart TD
    start([Bắt đầu])
    open["Mở tab Ngân sách (BudgetView)"]
    action{"Chọn thao tác"}
    editBudget["Chỉnh tổng ngân sách / phân bổ 5 hạng mục"]
    openInv["Mở form tạo/sửa hóa đơn"]
    linkAct{"Liên kết hoạt động?"}
    autofill["Tự điền ngày, hạng mục & số tiền dự kiến"]
    attachImg{"Đính kèm ảnh chứng từ?"}
    compress["Kiểm tra loại ảnh & nén Canvas <= 180KB"]
    imgOk{"Ảnh hợp lệ?"}
    errImg["Báo lỗi định dạng / dung lượng ảnh"]
    validInv{"Tên hợp lệ, số tiền > 0 & chưa vượt MAX_INVOICES?"}
    errInv["Hiển thị lỗi nhập liệu hóa đơn"]
    isOnline{"Đang trực tuyến?"}
    uploadReceipt["Upload ảnh lên POST /api/trips/:id/receipts lấy receiptId"]
    keepInline["Giữ ảnh inline tạm thời để đồng bộ sau"]
    recalc["Tính lại budgetUsed, budgetRemaining & cảnh báo (>=85% / >100%)"]
    saveTrip["Lưu chuyến đi (PUT /api/trips/:id hoặc hàng đợi offline)"]
    cleanupOld{"Có thay/xóa chứng từ cũ & lưu thành công?"}
    deleteOld["Gọi DELETE .../receipts/:oldReceiptId"]
    exportCsv["Xem ExpenseReportModal / Xuất file CSV"]
    done([Hoàn tất])

    start --> open --> action
    action -- "Sửa ngân sách" --> editBudget --> recalc
    action -- "Báo cáo CSV" --> exportCsv --> done
    action -- "Tạo/Sửa hóa đơn" --> openInv --> linkAct
    linkAct -- "Có" --> autofill --> attachImg
    linkAct -- "Không" --> attachImg
    attachImg -- "Không" --> validInv
    attachImg -- "Có" --> compress --> imgOk
    imgOk -- "Không" --> errImg --> openInv
    imgOk -- "Có" --> validInv
    validInv -- "Không" --> errInv --> openInv
    validInv -- "Có" --> isOnline
    isOnline -- "Có" --> uploadReceipt --> recalc
    isOnline -- "Không" --> keepInline --> recalc
    recalc --> saveTrip --> cleanupOld
    cleanupOld -- "Có" --> deleteOld --> done
    cleanupOld -- "Không" --> done
```

### 5.3. Sequence Diagram — TV5

```mermaid
sequenceDiagram
    actor Owner as Chủ chuyến đi / Admin
    participant UI as BudgetView & InvoiceEditorModal
    participant Hook as useBudgetActions & budgetAlerts
    participant ReceiptAPI as Express /api/trips/:id/receipts
    participant TripsAPI as Express /api/trips/:id
    participant Store as Firestore (trips & trip_receipts)

    Owner->>UI: Nhập thông tin hóa đơn & chọn ảnh chứng từ
    UI->>Hook: handleReceiptFileChange(file)
    Hook->>Hook: Resize tối đa 800px & nén JPEG <= 180KB
    Owner->>UI: Nhấn Lưu hóa đơn
    UI->>Hook: handleSaveInvoice()
    Hook->>Hook: Kiểm tra dữ liệu & MAX_INVOICES_PER_TRIP
    alt Có ảnh mới và đang trực tuyến
        Hook->>ReceiptAPI: POST /api/trips/{tripId}/receipts { dataUrl }
        ReceiptAPI->>Store: Lưu ảnh vào collection trip_receipts
        Store-->>ReceiptAPI: Trả receiptId
        ReceiptAPI-->>Hook: 201 Created { receiptId }
    else Ngoại tuyến hoặc lỗi tải ảnh tạm thời
        Hook->>Hook: Giữ receiptImage inline (chờ offloadTripReceipts)
    end
    Hook->>Hook: computeTripBudgetSummaryFields() (loại trừ trùng linkedActivityId & Chờ duyệt)
    Hook->>TripsAPI: PUT /api/trips/{tripId} (TripData mới + expectedVersion)
    TripsAPI->>Store: Lưu invoices, ngân sách & tăng version
    Store-->>TripsAPI: Commit thành công
    TripsAPI-->>Hook: 200 OK { trip }
    opt Thay thế ảnh cũ khi sửa và đã lưu thành công
        Hook->>ReceiptAPI: DELETE /api/trips/{tripId}/receipts/{oldReceiptId}
    end
    Hook-->>UI: syncBudgetAlertsIntoTrip() & hiển thị sổ chi phí mới
    UI-->>Owner: Cập nhật số dư, cảnh báo hạn mức (85% / 100%)
```
