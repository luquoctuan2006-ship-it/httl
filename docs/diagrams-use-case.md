# Bộ sơ đồ Use Case, Activity và Sequence

Các sơ đồ dưới đây mô tả 5 chức năng theo phân công thành viên. “User diagram” được hiểu là **Use Case diagram**. Use Case và Activity được biểu diễn bằng Mermaid `flowchart`; Sequence dùng Mermaid `sequenceDiagram`.

## TV1 — Tín Phát: Tạo lịch trình du lịch tự động bằng Gemini AI

### Use Case diagram

```mermaid
flowchart LR
    leader["Người dùng / Trưởng đoàn"]
    gemini["Gemini AI"]
    subgraph voyager["Hệ thống Voyager"]
        input(("Nhập điểm đến và tiêu chí chuyến đi"))
        generate(("Yêu cầu tạo lịch trình"))
        review(("Xem trước lịch trình AI"))
        apply(("Chấp nhận và lưu chuyến đi"))
    end
    leader --- input
    leader --- generate
    leader --- review
    leader --- apply
    gemini --- generate
    generate --> review
    review --> apply
```

### Activity diagram

```mermaid
flowchart TD
    start([Bắt đầu])
    form["Nhập điểm đến, số ngày, ngày đi, ngân sách,<br/>phong cách, nhóm khách và sở thích"]
    valid{"Đã nhập điểm đến?"}
    fix["Hiển thị yêu cầu nhập điểm đến"]
    request["Gửi yêu cầu tạo lịch trình"]
    cached{"Có kết quả đã lưu trong cache?"}
    poll["Theo dõi tiến trình tạo lịch trình"]
    result{"Gemini tạo lịch thành công?"}
    preview["Chuẩn hóa dữ liệu và hiển thị bản xem trước"]
    accept{"Người dùng chấp nhận?"}
    build["Tạo dữ liệu chuyến đi, hoạt động,<br/>điểm dừng, thành viên và ngân sách"]
    save["Lưu chuyến đi"]
    done([Hoàn tất])
    error["Hiển thị lỗi hoặc cho phép thử lại"]

    start --> form --> valid
    valid -- "Không" --> fix --> form
    valid -- "Có" --> request --> cached
    cached -- "Có" --> preview
    cached -- "Không" --> poll --> result
    result -- "Không" --> error --> form
    result -- "Có" --> preview
    preview --> accept
    accept -- "Không" --> done
    accept -- "Có" --> build --> save --> done
```

### Sequence diagram

```mermaid
sequenceDiagram
    actor User as Người dùng
    participant UI as Màn hình tạo lịch
    participant API as Voyager API
    participant Gemini as Gemini AI
    participant Jobs as Kho tiến trình
    participant Trips as API chuyến đi

    User->>UI: Nhập tiêu chí và yêu cầu tạo lịch
    UI->>UI: Kiểm tra điểm đến
    UI->>API: POST /api/gemini/generate-itinerary
    API->>Jobs: Tạo hoặc tra cứu job
    alt Có kết quả cache
        Jobs-->>API: Trả kết quả đã tạo
        API-->>UI: Trả dữ liệu lịch trình
    else Cần tạo mới
        API-->>UI: Trả jobId
        API->>Gemini: Tạo lịch theo tiêu chí
        Gemini-->>Jobs: Lưu kết quả hoặc lỗi
        loop Poll mỗi 1.5 giây đến khi có kết quả
            UI->>API: GET /api/gemini/jobs/{jobId}
            API->>Jobs: Đọc trạng thái job
            Jobs-->>API: Trạng thái và kết quả
            API-->>UI: Trả tiến độ
        end
    end
    UI-->>User: Hiển thị bản xem trước
    User->>UI: Chấp nhận lịch trình
    UI->>UI: Chuẩn hóa hoạt động, ngân sách và điểm dừng
    UI->>Trips: POST /api/trips
    Trips-->>UI: Trả chuyến đi đã tạo
    UI-->>User: Thông báo tạo chuyến thành công
```

## TV2 — Phạm Huy: Tối ưu lịch trình bằng AI theo yêu cầu

### Use Case diagram

```mermaid
flowchart LR
    leader["Trưởng đoàn"]
    gemini["Gemini AI"]
    subgraph voyager["Hệ thống Voyager"]
        inspect(("Chọn chuyến cần tối ưu"))
        analyze(("Phân tích lịch trình và cảnh báo"))
        compare(("Xem phương án và phần chênh lệch"))
        choose(("Chọn phương án phù hợp"))
        apply(("Áp dụng và lưu phương án"))
    end
    leader --- inspect
    leader --- compare
    leader --- choose
    leader --- apply
    inspect --> analyze
    gemini --- analyze
    analyze --> compare
    compare --> choose
    choose --> apply
```

### Activity diagram

```mermaid
flowchart TD
    start([Bắt đầu])
    open["Mở chức năng tối ưu cho chuyến đi"]
    collect["Thu thập lịch trình, ngân sách và cảnh báo"]
    request["Gửi dữ liệu đến dịch vụ tối ưu AI"]
    result{"Có kết quả phân tích?"}
    feasible{"Có phương án vượt kiểm tra khả thi?"}
    showError["Thông báo lỗi hoặc không có phương án an toàn"]
    showOptions["Hiển thị đề xuất, lý do và mức tiết kiệm"]
    select["Chọn một đề xuất"]
    confirm{"Người dùng áp dụng?"}
    apply["Áp dụng thay đổi vào lịch trình"]
    save["Lưu chuyến đi và cập nhật trạng thái"]
    done([Hoàn tất])

    start --> open --> collect --> request --> result
    result -- "Không" --> showError --> done
    result -- "Có" --> feasible
    feasible -- "Không" --> showError
    feasible -- "Có" --> showOptions --> select --> confirm
    confirm -- "Không" --> done
    confirm -- "Có" --> apply --> save --> done
```

### Sequence diagram

```mermaid
---
id: 522e31c5-7749-4fb5-be08-e392aca1d962
---
sequenceDiagram
    actor User as Trưởng đoàn
    participant UI as Màn hình tối ưu
    participant API as Voyager API
    participant Gemini as Gemini AI
    participant Jobs as Kho tiến trình
    participant Trips as API chuyến đi

    User->>UI: Mở chức năng tối ưu
    UI->>API: POST /api/gemini/optimize-schedule
    Note right of UI: Gửi lịch trình rút gọn,<br/>cảnh báo và mục tiêu tối ưu
    API->>Jobs: Tạo job phân tích
    API-->>UI: Trả jobId hoặc kết quả tức thời
    opt Job chạy nền
        API->>Gemini: Phân tích và đề xuất phương án
        Gemini-->>Jobs: Lưu đề xuất
        loop Poll đến khi job hoàn tất
            UI->>API: GET /api/gemini/jobs/{jobId}
            API->>Jobs: Đọc trạng thái
            Jobs-->>API: Tiến độ hoặc kết quả
            API-->>UI: Trả trạng thái
        end
    end
    API-->>UI: Trả đề xuất đã kiểm tra tính khả thi
    UI-->>User: Hiển thị đề xuất và chênh lệch
    User->>UI: Chọn và áp dụng phương án
    UI->>UI: Tính thay đổi lịch trình
    UI->>Trips: PUT /api/trips/{tripId}
    Trips-->>UI: Xác nhận đã lưu
    UI-->>User: Thông báo cập nhật thành công
```

## TV3 — Gia Khánh: Quản lý bản đồ và tiến độ lịch trình

### Use Case diagram

```mermaid
flowchart LR
    traveler["Thành viên đoàn"]
    leader["Trưởng đoàn"]
    osrm["Dịch vụ định tuyến OSRM"]
    subgraph voyager["Hệ thống Voyager"]
        view(("Xem bản đồ và điểm dừng"))
        filter(("Lọc lịch trình theo ngày"))
        route(("Tính quãng đường và thời gian"))
        status(("Cập nhật tiến độ điểm dừng"))
        optimize(("Xem hoặc áp dụng tuyến tối ưu"))
    end
    traveler --- view
    traveler --- filter
    traveler --- status
    leader --- optimize
    osrm --- route
    view --> route
    filter --> view
    status --> view
    optimize --> route
```

### Activity diagram

```mermaid
flowchart TD
    start([Bắt đầu])
    open["Mở bản đồ chuyến đi"]
    build["Tổng hợp điểm dừng và trạng thái theo ngày"]
    enough{"Có ít nhất hai điểm có tọa độ?"}
    estimate["Hiển thị tuyến và khoảng cách ước tính"]
    osrm["Yêu cầu tuyến đường bộ OSRM"]
    road{"OSRM trả tuyến thành công?"}
    fallback["Dùng khoảng cách ước tính"]
    display["Hiển thị bản đồ, tuyến và tiến độ"]
    action{"Người dùng chọn thao tác"}
    filter["Lọc theo ngày hoặc chọn điểm dừng"]
    update["Đổi trạng thái điểm dừng"]
    save["Lưu lịch trình đã cập nhật"]
    optimize["Xem trước hoặc áp dụng tuyến tối ưu"]
    done([Hoàn tất])

    start --> open --> build --> enough
    enough -- "Không" --> estimate --> display
    enough -- "Có" --> osrm --> road
    road -- "Không" --> fallback --> display
    road -- "Có" --> display
    display --> action
    action -- "Lọc hoặc xem điểm" --> filter --> display
    action -- "Cập nhật tiến độ" --> update --> save --> display
    action -- "Tối ưu tuyến" --> optimize --> save
    action -- "Thoát" --> done
```

### Sequence diagram

```mermaid
sequenceDiagram
    actor User as Thành viên đoàn
    participant Map as Bản đồ lịch trình
    participant Route as Bộ tính tiến độ và tuyến
    participant API as Voyager API
    participant OSRM as Dịch vụ OSRM
    participant Trips as API chuyến đi

    User->>Map: Mở bản đồ hoặc chọn ngày
    Map->>Route: Tổng hợp các điểm dừng
    Route->>API: POST /api/routing/road
    API->>OSRM: Tính tuyến giữa các tọa độ
    alt Có tuyến đường bộ
        OSRM-->>API: Khoảng cách và thời gian từng chặng
        API-->>Route: Dữ liệu tuyến đường
    else OSRM không khả dụng
        API-->>Route: Không có dữ liệu tuyến
        Route->>Route: Ước tính từ tọa độ
    end
    Route-->>Map: Bản đồ, quãng đường và tiến độ
    Map-->>User: Hiển thị tuyến và trạng thái điểm dừng
    User->>Map: Cập nhật trạng thái một điểm dừng
    Map->>Route: Tạo lịch trình với trạng thái mới
    Route->>Trips: PUT /api/trips/{tripId}
    Trips-->>Route: Xác nhận lưu
    Route-->>Map: Cập nhật tiến độ mới
    Note over User,Map: Tiến độ dựa trên trạng thái điểm dừng,<br/>không theo dõi GPS xe
```

## TV4 — Quốc Tuấn: Quản lý thành viên và điểm danh đoàn du lịch

### Use Case diagram

```mermaid
flowchart LR
    leader["Trưởng đoàn"]
    member["Thành viên / Khách"]
    subgraph voyager["Hệ thống Voyager"]
        invite(("Tạo hoặc quản lý mã mời"))
        manage(("Thêm, sửa hoặc xóa thành viên"))
        join(("Tham gia chuyến bằng mã"))
        attendance(("Điểm danh thành viên"))
        summary(("Xem tổng số có mặt"))
    end
    leader --- invite
    leader --- manage
    leader --- attendance
    leader --- summary
    member --- join
    member --- attendance
    attendance --> summary
```

### Activity diagram

```mermaid
flowchart TD
    start([Bắt đầu])
    open["Mở danh sách thành viên"]
    action{"Chọn thao tác"}
    edit["Thêm, sửa hoặc xóa thành viên"]
    join["Tạo, đổi hoặc bật/tắt mã mời"]
    mark["Chọn trạng thái điểm danh"]
    allowed{"Người dùng có quyền cập nhật?"}
    validate["Kiểm tra dữ liệu và phiên bản chuyến"]
    conflict{"Dữ liệu có xung đột phiên bản?"}
    resolve["Tải dữ liệu mới và yêu cầu chọn phiên bản giữ lại"]
    save["Lưu thay đổi thành viên hoặc điểm danh"]
    count["Cập nhật tổng số thành viên và số có mặt"]
    error["Hiển thị lỗi quyền hoặc dữ liệu"]
    done([Hoàn tất])

    start --> open --> action
    action -- "Quản lý hồ sơ" --> edit --> save
    action -- "Mã mời" --> join --> save
    action -- "Điểm danh" --> mark --> allowed
    allowed -- "Không" --> error --> done
    allowed -- "Có" --> validate --> conflict
    conflict -- "Có" --> resolve --> done
    conflict -- "Không" --> save
    save --> count --> done
```

### Sequence diagram

```mermaid
sequenceDiagram
    actor Owner as Trưởng đoàn
    participant UI as Màn hình thành viên
    participant Actions as Bộ xử lý chuyến đi
    participant API as Voyager API
    participant Store as Firestore

    Owner->>UI: Chọn trạng thái điểm danh thành viên
    UI->>Actions: Gửi memberId và trạng thái mới
    Actions->>Actions: Cập nhật giao diện tạm thời
    Actions->>API: PATCH /api/trips/{tripId}/members/{memberId}/attendance
    API->>API: Kiểm tra quyền, trạng thái và version
    alt Hợp lệ
        API->>Store: Cập nhật điểm danh và version
        Store-->>API: Xác nhận lưu
        API-->>Actions: Trả trạng thái và version mới
        Actions->>Actions: Cập nhật số người có mặt
        Actions-->>UI: Hiển thị dữ liệu đã lưu
        UI-->>Owner: Thông báo thành công
    else Xung đột phiên bản
        API-->>Actions: Trả lỗi 409
        Actions->>API: Tải snapshot chuyến mới nhất
        API-->>Actions: Trả dữ liệu máy chủ
        Actions-->>UI: Hiển thị lựa chọn xử lý xung đột
    else Không đủ quyền hoặc dữ liệu không hợp lệ
        API-->>Actions: Trả lỗi
        Actions-->>UI: Hiển thị thông báo lỗi
    end
```

## TV5 — Minh Tuấn: Quản lý ngân sách và ghi nhận hóa đơn chuyến đi

### Use Case diagram

```mermaid
flowchart LR
    leader["Trưởng đoàn"]
    subgraph voyager["Hệ thống Voyager"]
        total(("Thiết lập tổng ngân sách"))
        allocation(("Phân bổ ngân sách theo hạng mục"))
        invoice(("Ghi nhận hoặc chỉnh sửa hóa đơn"))
        receipt(("Đính kèm ảnh chứng từ"))
        expense(("Theo dõi khoản chi và số dư"))
        report(("Xem hoặc xuất báo cáo chi phí"))
    end
    leader --- total
    leader --- allocation
    leader --- invoice
    leader --- expense
    leader --- report
    invoice --> receipt
    invoice --> expense
    total --> expense
    allocation --> expense
    expense --> report
```

### Activity diagram

```mermaid
flowchart TD
    start([Bắt đầu])
    open["Mở quản lý ngân sách"]
    action{"Chọn thao tác"}
    settings["Nhập tổng ngân sách hoặc phân bổ hạng mục"]
    invoice["Nhập nội dung, số tiền, ngày và hạng mục hóa đơn"]
    valid{"Thông tin hóa đơn hợp lệ?"}
    invalid["Báo lỗi và yêu cầu kiểm tra lại"]
    attach{"Có ảnh chứng từ?"}
    online{"Đang có kết nối mạng?"}
    upload["Nén ảnh và tải lên máy chủ nếu có mạng"]
    keep["Giữ ảnh trong dữ liệu hóa đơn để đồng bộ sau"]
    save["Lưu hóa đơn hoặc cấu hình ngân sách"]
    recalc["Tính lại đã chi, còn lại và cảnh báo hạn mức"]
    report["Xem báo cáo hoặc xuất CSV"]
    done([Hoàn tất])

    start --> open --> action
    action -- "Sửa ngân sách" --> settings --> save
    action -- "Ghi nhận hóa đơn" --> invoice --> valid
    valid -- "Không" --> invalid --> invoice
    valid -- "Có" --> attach
    attach -- "Có" --> online
    online -- "Có" --> upload --> save
    online -- "Không" --> keep --> save
    attach -- "Không" --> save
    save --> recalc --> action
    action -- "Báo cáo" --> report --> done
    action -- "Đóng" --> done
```

### Sequence diagram

```mermaid
sequenceDiagram
    actor Owner as Trưởng đoàn
    participant UI as Màn hình ngân sách
    participant Actions as Bộ xử lý ngân sách
    participant ReceiptAPI as API chứng từ
    participant Trips as API chuyến đi
    participant Store as Firestore

    Owner->>UI: Nhập hóa đơn và chọn ảnh chứng từ
    UI->>Actions: Gửi dữ liệu hóa đơn và ảnh
    Actions->>Actions: Kiểm tra dữ liệu và nén ảnh
    alt Có ảnh và đang trực tuyến
        Actions->>ReceiptAPI: POST /api/trips/{tripId}/receipts
        ReceiptAPI->>Store: Lưu ảnh chứng từ
        Store-->>ReceiptAPI: Trả receiptId
        ReceiptAPI-->>Actions: Trả receiptId
    else Không có mạng hoặc tải ảnh thất bại
        Actions->>Actions: Giữ ảnh inline để đồng bộ cùng chuyến đi
    end
    Actions->>Actions: Tạo hóa đơn và tính lại số dư
    Actions->>Trips: PUT /api/trips/{tripId}
    Trips->>Store: Lưu hóa đơn và ngân sách chuyến đi
    Store-->>Trips: Xác nhận lưu
    Trips-->>Actions: Trả dữ liệu đã cập nhật
    Actions-->>UI: Cập nhật sổ chi phí và cảnh báo
    UI-->>Owner: Hiển thị hóa đơn và ngân sách mới
```
