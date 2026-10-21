# Lộ trình: QuizApp → dự án portfolio xin việc .NET

Mục tiêu: biến QuizApp thành dự án thể hiện đủ các yêu cầu thường gặp của vị trí .NET Developer (mảng ERP / quản trị doanh nghiệp): C#, OOP, ASP.NET Core RESTful API, ASP.NET MVC, SQL Server / PostgreSQL, JavaScript / HTML5 / CSS3, Kendo UI, Git, phối hợp BA / Tester.

## Đối chiếu yêu cầu tuyển dụng

| Yêu cầu | Hiện trạng | Còn thiếu |
|---|---|---|
| C#, OOP | Có, nhưng logic dồn trong controller | Kiến trúc phân lớp, interface, SOLID, design pattern |
| RESTful API ASP.NET Core | Mạnh: JWT, phân trang, mã lỗi, migrations, rate limit | Test, logging, caching |
| ASP.NET MVC | Chưa có (frontend là Angular) | Phân hệ Razor MVC |
| JavaScript / HTML5 / CSS3 | Có (Angular, CSS thuần) | JS/jQuery trong view MVC |
| Kendo UI | Chưa có | Dùng trong phân hệ MVC |
| SQL Server / MySQL / PostgreSQL | Chỉ SQL Server, chỉ qua EF | Hỗ trợ PostgreSQL, SQL tay (view, stored procedure) |
| Nghiệp vụ ERP | Ứng dụng quiz chung | Định vị thành module doanh nghiệp |
| Phối hợp BA/Tester, Git | Có Git, có use case UC01–UC20 | CI, quy trình PR, test case, tài liệu tiếng Anh |
| Khách hàng Việt Nam / Singapore | Chỉ tiếng Việt | Song ngữ Anh–Việt |

## Định vị dự án

**"Phân hệ Đánh giá năng lực nhân sự" (Employee Assessment Module) trong hệ thống ERP**: doanh nghiệp tạo bài đánh giá, giao cho phòng ban / nhân viên, theo dõi kết quả và báo cáo. Đây là mảng HRM có thật trong các ERP (Odoo, SAP SuccessFactors, MISA AMIS) và giải thích tự nhiên các tính năng phòng ban, giao bài, hạn nộp, báo cáo.

## Các giai đoạn

### Giai đoạn 1 — Tái cấu trúc backend theo Clean Architecture (1,5–2 tuần) · quan trọng nhất · ✅ hoàn thành
- [x] Sắp xếp repo: `QuizApp.sln`, `src/`, `docs/`
- [x] Tách solution thành `QuizApp.Domain` / `QuizApp.Application` / `QuizApp.Infrastructure` / `QuizApp.Api`
- [x] Tầng Service (`IAuthService`, `IQuizService`, `IQuizQuestionService`, `IQuestionBankService`, `IAttemptService`, `IGradingService`, `IAdminService`) dùng `IApplicationDbContext`; controller chỉ nhận request và gọi service (~2.000 → ~650 dòng)
- [x] OOP: chấm điểm theo loại câu hỏi bằng **Strategy pattern** (`IQuestionScoringStrategy`: `SingleChoiceScoring`, `MultipleChoiceScoring` kế thừa `ChoiceQuestionScoring`; `ManualGradingScoring`; điều phối bởi `AttemptScorer`)
- [x] Result pattern cho lỗi nghiệp vụ (`Result<T>`, `Error`), ánh xạ sang ProblemDetails ở tầng Api
- [x] `ICurrentUser`, `IPasswordHasher`, `IJwtTokenService`: tầng Application không phụ thuộc ASP.NET
- [x] FluentValidation thay DataAnnotations (`Application/Validation`, chạy qua `FluentValidationFilter`; giữ nguyên câu chữ thông báo lỗi)
- [x] Serilog (console + file `logs/quizapp-<ngày>.log`, 1 dòng log mỗi request), `GlobalExceptionHandler` (500 `INTERNAL_ERROR` + traceId), health checks `/health/live` và `/health/ready` (kiểm tra database)

### Giai đoạn 2 — Kiểm thử & CI (1 tuần)
- [ ] Unit test: xUnit + Moq + FluentAssertions cho chấm điểm và quy tắc nghiệp vụ
- [ ] Integration test: `WebApplicationFactory` + Testcontainers (SQL Server trong Docker)
- [ ] GitHub Actions: build + test mỗi PR, badge trong README
- [ ] Làm việc theo branch + Pull Request, Conventional Commits, GitHub Issues / Projects

### Giai đoạn 3 — Nghiệp vụ ERP (1,5–2 tuần)
- [ ] Thực thể **Phòng ban**, **Nhân viên**; vai trò **HR Manager** (bên cạnh Admin / Nhân viên)
- [ ] **Giao bài đánh giá** cho phòng ban / nhân viên: hạn nộp, điểm đạt, trạng thái (Chưa làm / Đạt / Không đạt / Quá hạn)
- [ ] **Báo cáo**: tỉ lệ đạt theo phòng ban, nhân viên chưa hoàn thành, xu hướng điểm theo tháng
- [ ] **Xuất Excel** (ClosedXML) và **nhập danh sách nhân viên từ Excel**
- [ ] **Background job** (Hangfire hoặc `BackgroundService`): đánh dấu quá hạn, gửi email nhắc

### Giai đoạn 4 — Cổng quản trị ASP.NET MVC + Kendo UI (1,5 tuần)
- [ ] Project `QuizApp.Backoffice` (ASP.NET Core MVC, Razor Views, cookie auth), dùng chung tầng Application
- [ ] Màn hình HR: quản lý phòng ban / nhân viên, giao bài, báo cáo (Angular giữ cho nhân viên làm bài)
- [ ] **Kendo UI Core** (miễn phí: DropDownList, DatePicker, Window, Validator, TabStrip) cho form; bảng dữ liệu bằng jQuery + AJAX gọi API
- [ ] Lưu ý: Kendo **Grid / Chart** thuộc bản trả phí (trial 30 ngày) — chỉ dùng trial khi demo ở máy, không commit license

### Giai đoạn 5 — Cơ sở dữ liệu & hiệu năng (1 tuần)
- [ ] Hỗ trợ **PostgreSQL** song song SQL Server: chọn provider qua cấu hình, bộ migrations riêng, `docker-compose` cho cả hai
- [ ] **SQL tay** cho báo cáo bằng Dapper: view, stored procedure, CTE
- [ ] Tối ưu có số liệu: seed ~100.000 lượt làm bài, đo trước/sau khi thêm index, cache (`IMemoryCache` / Redis), `AsNoTracking`; ghi lại vào `docs/performance.md`

### Giai đoạn 6 — Đóng gói & trình bày (1 tuần)
- [ ] Dockerfile cho API, Backoffice, Angular; `docker compose up` chạy toàn bộ
- [ ] Deploy demo (Render / Railway / Azure free tier) + tài khoản demo
- [ ] Song ngữ Anh–Việt (i18n)
- [ ] README tiếng Anh: ảnh chụp, sơ đồ kiến trúc, ERD, quyết định thiết kế, hướng dẫn chạy, link demo
- [ ] `docs/`: use case (UC01–UC20), ERD, test case mẫu
- [ ] Đổi tên repo `mock_test` → tên có ý nghĩa (vd. `erp-assessment-module`) và ghim lên GitHub profile

**Tổng: ~7–9 tuần (part-time).** Nếu cần nộp đơn sớm: ưu tiên giai đoạn **1 → 2 → 4 → 6**.

## Lưu ý khi phỏng vấn

Phần lớn code được viết với sự hỗ trợ của AI. Nhà tuyển dụng sẽ hỏi sâu (vì sao xóa mềm? rate limiter hoạt động thế nào? vì sao từng gặp lỗi JWT signature? migration là gì?). Ở mỗi giai đoạn:
- Tự viết lại hoặc sửa ít nhất một phần.
- Đọc hiểu mọi đoạn code trước khi commit.
- Ghi lại "tại sao làm vậy" bằng lời của mình vào `docs/decisions/`.
