# Quiz Application API (ANG.P.L001)

REST API cho SRS mới nhất của Quiz Application: 3 actor **Guest / User /
Administrator**, Quiz Discovery & Participation, Quiz Management, Question
Bank (tái sử dụng câu hỏi), và System Administration.

- **Stack:** ASP.NET Core 8 Web API + Entity Framework Core 8 (SQL Server) + JWT Bearer Auth
- **Docs:** Scalar API reference tại `/scalar` trong Development (OpenAPI JSON tại `/openapi/v1.json`)

## Chạy thử

```bash
# (1 lần) khôi phục công cụ dotnet-ef (local tool, khai báo trong dotnet-tools.json ở thư mục gốc repo)
cd <thư mục gốc repo>
dotnet tool restore

cd QuizApp.Api
dotnet restore
dotnet run
```

URL mặc định: `http://localhost:5080` (API reference tại `http://localhost:5080/scalar`).

### Database – EF Core Migrations

Database (`QuizAppDb` trên LocalDB) được tạo/cập nhật tự động khi khởi động bằng
`db.Database.Migrate()` (migration đầu tiên: `Migrations/*_InitialCreate`).

> **Một lần duy nhất khi nâng cấp từ bản cũ (dùng `EnsureCreated`)**: DB cũ không có bảng
> `__EFMigrationsHistory` nên phải xoá DB rồi chạy lại API:
>
> ```bash
> cd QuizApp.Api
> dotnet ef database drop -f
> dotnet run
> ```

Thêm thay đổi cấu trúc về sau: `dotnet ef migrations add <Ten>` (API tự áp dụng khi khởi động).

Ở môi trường **Development** (và chỉ ở đó) DB trống được seed dữ liệu mẫu:
- Administrator: `admin` / mật khẩu = `Seed:AdminPassword` (mặc định dev `Admin@123`)
- User: `hoanganh` / mật khẩu = `Seed:UserPassword` (mặc định dev `User@123`)
- 1 Question Bank công khai "Angular Fundamentals" (4 câu hỏi), 1 Quiz đã publish

### Cấu hình & bí mật

| Khoá | Ở đâu | Ghi chú |
|------|-------|---------|
| `Jwt:Key` | user-secrets / biến môi trường `Jwt__Key` | **Bắt buộc**, ≥ 32 byte. API không khởi động nếu thiếu/ngắn/placeholder. Development có key dev trong `appsettings.Development.json`. |
| `Seed:AdminPassword`, `Seed:UserPassword` | `appsettings.Development.json` / user-secrets | Chỉ dùng khi seed ở Development. |
| `Cors:Origins` | appsettings / env (`Cors__Origins__0`) | Mảng origin frontend; Development: `http://localhost:4200`. |
| `ConnectionStrings:QuizDb` | `appsettings.json` | Đổi nếu dùng SQL Server đầy đủ. |

```bash
cd QuizApp.Api
dotnet user-secrets set "Jwt:Key" "<chuỗi ngẫu nhiên >= 32 ký tự>"
dotnet user-secrets set "Seed:AdminPassword" "<mật khẩu admin dev>"
```

### Rate limiting

- `POST /api/auth/login`, `POST /api/auth/register`: 5 request / phút / IP.
- `POST /api/quizzes/{id}/trial`: 10 request / giờ / IP.
- Vượt giới hạn -> `429` + header `Retry-After` + ProblemDetails `code = RATE_LIMITED`.

## Authentication

Tất cả endpoint cần đăng nhập dùng JWT Bearer:

```
Authorization: Bearer <token>
```

`token` lấy từ response của `POST /api/auth/login`. Guest (chưa đăng nhập)
vẫn dùng được các endpoint công khai (browse/search quiz, xem chi tiết quiz
đã publish, trial quiz) mà không cần token.

Lượt **Try Trial Quiz** của Guest (UC07) cần header `X-Guest-Id` do client tự
sinh và lưu lại (ví dụ 1 GUID trong localStorage) để hệ thống giới hạn số lượt
trial mỗi Guest (mặc định 3 lượt — `GuestTrialLimit` trong `QuizAttemptsController`).

## Endpoints theo Use Case

Danh sách có phân trang trả `PagedResult` `{ items, page, pageSize, total }` với query
`page` (từ 1), `pageSize` (mặc định 20, tối đa 50), `sort`. Chi tiết hình dạng JSON và mã lỗi: **`API_CHANGES.md`**.

| UC | Actor | Method | Route |
|----|-------|--------|-------|
| UC01 | Guest | POST | `/api/auth/register` |
| UC02 | Guest/User/Admin | POST | `/api/auth/login` |
| UC03 | User/Admin | POST | `/api/auth/logout` |
| – | User/Admin | GET | `/api/auth/me` |
| UC04/UC05 | Guest/User | GET | `/api/quizzes?search=&page=&pageSize=&sort=` (phân trang) |
| UC06 | Guest/User | GET | `/api/quizzes/{quizId}` |
| UC07 | Guest | POST | `/api/quizzes/{quizId}/trial` (header `X-Guest-Id`) |
| UC08 | User | POST | `/api/quizzes/{quizId}/attempts` |
| UC08/UC09 | Guest/User | GET | `/api/attempts/{attemptId}/content` |
| UC09 | Guest/User | POST | `/api/attempts/{attemptId}/submit` |
| UC10 | Guest/User | GET | `/api/attempts/{attemptId}/result` |
| A5 | User | GET | `/api/attempts/mine` (Bài đã làm, phân trang) |
| A5 | Chủ Quiz/Admin | GET | `/api/quizzes/{quizId}/grading` (câu tự luận chờ chấm, phân trang) |
| A5 | Chủ Quiz/Admin | PUT | `/api/attempt-answers/{attemptAnswerId}/grade` |
| A5 | Chủ Quiz/Admin | GET | `/api/quizzes/{quizId}/stats` |
| UC11 | User | POST | `/api/quizzes` |
| UC12 | User | GET | `/api/quizzes/mine` (phân trang) |
| UC12 | User | PUT / DELETE | `/api/quizzes/{quizId}` (DELETE = xoá mềm) |
| UC14 | User | PUT | `/api/quizzes/{quizId}/publish` |
| UC13 | User | POST | `/api/quizzes/{quizId}/questions` (tạo mới hoặc `questionId` để reuse — UC17) |
| UC13 | User | PUT | `/api/quizzes/{quizId}/questions/order` |
| UC13 | User | DELETE | `/api/quizzes/{quizId}/questions/{questionId}` |
| UC15 | User | GET | `/api/question-banks/mine` (phân trang) |
| UC15 | User | POST / PUT / DELETE | `/api/question-banks`, `/api/question-banks/{bankId}` |
| UC15 | Guest/User | GET | `/api/question-banks/{bankId}/questions` |
| UC15 | User | POST/PUT/DELETE | `/api/question-banks/{bankId}/questions`, `/api/question-banks/questions/{questionId}` |
| UC15 | User | POST/PUT/DELETE | `/api/question-banks/questions/{questionId}/answers`, `/api/question-banks/answers/{answerId}` |
| UC16 | Guest/User | GET | `/api/question-banks/public-questions?search=` |
| UC18 | Admin | GET | `/api/admin/users?search=&page=&pageSize=&sort=` (phân trang) |
| UC18 | Admin | PUT | `/api/admin/users/{userId}/status` |
| UC19 | Admin | GET | `/api/admin/quizzes?search=&status=&page=&pageSize=&sort=` (phân trang) |
| UC19/UC20 | Admin | PUT | `/api/admin/quizzes/{quizId}/status` |
| UC20 | Admin | GET | `/api/admin/questions?search=&status=` |
| UC20 | Admin | PUT | `/api/admin/questions/{questionId}/status` |

Xem `QuizApp.Api.http` để có ví dụ gọi đầy đủ theo đúng thứ tự (register →
login → create quiz → create question bank → add/reuse question → publish →
trial/take → submit → result → admin moderation).

## Business rules chính

- **Ownership:** chỉ chủ sở hữu (hoặc Administrator) mới sửa/xoá/publish Quiz,
  Question Bank, Question, Answer của mình (UC12/UC14/UC15 – alt. flow "does
  not own").
- **Publish (UC14 A1):** Quiz phải có ít nhất 1 câu hỏi còn Active, và từng câu
  trắc nghiệm phải có ≥ 2 đáp án, ≥ 1 đáp án đúng (SingleChoice/TrueFalse: đúng 1).
  Lỗi trả về liệt kê rõ câu nào cần bổ sung. Khi Quiz đã Public, mọi thay đổi làm
  câu hỏi "không còn làm được" (xoá đáp án, bỏ tick đáp án đúng, đổi loại...) bị từ chối.
- **Reuse Question (UC17):** thêm 1 Question có sẵn vào Quiz không copy dữ
  liệu — chỉ tạo liên kết `QuizQuestion`; xoá liên kết không xoá Question gốc
  trong Question Bank (UC13 A3).
- **Question Bank riêng tư** chỉ chủ sở hữu xem/tái sử dụng được; **Question
  Bank công khai** thì ai cũng tìm và reuse được (UC16, UC17 A2).
- **Xoá có ràng buộc:** không xoá được Question Bank/Question đang được ít
  nhất 1 Quiz sử dụng — phải gỡ khỏi Quiz trước (UC15 A3). Nếu Question đã có
  lịch sử làm bài thì bị **xoá mềm** (`Status = Deleted`, bank `IsDeleted = true`)
  thay vì xoá cứng, để kết quả làm bài cũ vẫn còn nguyên (UC17 A4).
- **Thời gian làm bài (UC08 A3):** thời lượng được chốt vào `QuizAttempt.DurationMinutes` lúc bắt đầu;
  server từ chối Submit (`ATTEMPT_EXPIRED`) nếu quá `StartedAt + DurationMinutes` + 30 giây.
- **Nộp bài:** cho phép nộp bài trống (0 điểm). Nộp 2 lần -> `409 ATTEMPT_SUBMITTED` (kể cả 2 request
  đồng thời — `QuizAttempt.RowVersion` là concurrency token).
- **Xoá Quiz = xoá mềm:** `Status = Deleted`, ẩn khỏi mọi danh sách/chi tiết; lịch sử và kết quả làm bài vẫn còn.
- **Guest (trial):** kết quả chỉ có điểm và đúng/sai từng câu — không lộ đáp án đúng (`answersHidden = true`).
- **Kết quả đã chốt (UC10):** đúng/sai của từng câu được lưu vào
  `ATTEMPT_ANSWER.is_correct` lúc Submit; sửa đáp án về sau không làm đổi kết quả cũ.
- **Tài khoản bị khoá (UC18):** login trả `403 ACCOUNT_BLOCKED`; mỗi request có token đều kiểm tra lại trạng thái
  trong DB — bị khoá là nhận 401 ngay, không phải đợi token hết hạn.
- **Chấm điểm (UC09):** câu hỏi có đáp án định nghĩa sẵn (MultipleChoice/
  SingleChoice/TrueFalse) được chấm tự động; câu hỏi dạng văn bản
  (FillInTheBlanks/ShortAnswer/LongAnswer) được lưu lại chờ chấm thủ công (A3):
  chủ Quiz chấm qua `PUT /api/attempt-answers/{id}/grade`, điểm được tính lại
  (`score` = % đúng trên các câu đã chấm).
- **Kiểm duyệt (UC19/UC20):** Administrator đổi `Status` của Quiz/Question
  sang `Removed` — nội dung biến mất khỏi kết quả công khai (`Status =
  Active` là điều kiện lọc ở mọi endpoint Guest/User) nhưng dữ liệu vẫn được
  giữ lại (soft-delete), không phá vỡ các Attempt đã tồn tại.

## Thay đổi ở bản v4 (sửa theo rà soát SRS)

| # | Vấn đề | Đã sửa ở |
|---|--------|----------|
| 1 | `GET /question-banks/{id}/questions` lộ `isCorrect` cho Guest/User khác | `QuestionBanksController.GetBankQuestions` – người không phải chủ nhận `PublicQuestionDto` (không có đáp án đúng) |
| 2 | Xoá Question/Bank đã có lượt làm bài -> lỗi 500 do khoá ngoại | `DeleteQuestion`, `DeleteBank` – xoá mềm khi có lịch sử |
| 3 | Câu bị Admin gỡ vẫn hiện khi làm quiz (UC20 A2) | `Quiz.ActiveQuestions()` dùng ở LoadPlayableQuiz, Submit, GetResult, GetQuiz, Browse, Mapper |
| 4 | Publish chỉ kiểm tra "có ≥ 1 câu" (UC14 A1) | `QuizzesController.ValidateForPublish` + `QuestionTypeRules.ValidateForPlay` |
| 5 | Không kiểm tra thời gian làm bài phía server (UC08 A3) | `QuizAttemptsController.Submit` |
| 6 | Đổi loại câu hỏi phá quy tắc 1 đáp án đúng | `QuestionBanksController.UpdateQuestion` |
| 7 | Tài khoản bị khoá vẫn dùng token cũ (UC18) | `Program.cs` – `JwtBearerEvents.OnTokenValidated` |
| 8 | Admin tự khoá mình / khoá Admin khác | `AdminController.UpdateUserStatus` |
| 9 | Admin không có danh sách câu hỏi để kiểm duyệt (UC20 bước 2–3) | `GET /api/admin/questions?search=&status=`, thêm `?search=` cho users/quizzes |
| 10 | Chặn chọn trùng đáp án nằm nhầm nhánh | `QuizAttemptsController.ValidateSubmission` |
| 11 | Reorder chấp nhận ID trùng | `QuizQuestionsController.Reorder` |
| 12 | Nộp được bài của Quiz đã bị Admin gỡ | `QuizAttemptsController.Submit` |
| 13 | `AddQuestion` nhận cả `questionId` lẫn `newQuestion` | `QuizQuestionsController.AddQuestion` |
| + | Kết quả cũ mâu thuẫn với Score khi đáp án bị sửa | `AttemptAnswer.IsCorrect` chốt lúc Submit |
| + | `Enum.TryParse` nhận chuỗi số / "Deleted" khi Admin đổi status | `ContentStatusRules.TryParseModeration` |
| + | `answerCount` trong chi tiết Quiz luôn = 0 (thiếu Include Answers) | `QuizzesController` |

Thay đổi hợp đồng API (thêm field, frontend cũ vẫn chạy): `QuestionSummaryDto.status`,
`PublicQuestionDto.options`.

### ⚠️ Bản cũ -> bản dùng Migrations

Bản v4 dùng `EnsureCreated()`. Từ bản này API dùng EF Migrations, nên cần xoá DB cũ **một lần**
(`dotnet ef database drop -f` trong `QuizApp.Api`, hoặc qua SSMS / sqlcmd), rồi `dotnet run`.

## Question types

`MultipleChoice`, `SingleChoice`, `TrueFalse`, `FillInTheBlanks`, `ShortAnswer`, `LongAnswer`

| Type | Đáp án định nghĩa sẵn | Payload khi trả lời |
|------|------------------------|----------------------|
| MultipleChoice | có | 1 dòng `answerId` cho mỗi lựa chọn (nhiều dòng) |
| SingleChoice / TrueFalse | có | đúng 1 `answerId` |
| FillInTheBlanks / ShortAnswer / LongAnswer | không | 1 `responseText` |

## Status codes & mã lỗi

Mọi response lỗi là RFC 7807 ProblemDetails có thêm `code` (chuỗi cố định, frontend dịch sang tiếng Việt).
Lỗi validate là `ValidationProblemDetails` (`errors` theo field) với `code = VALIDATION_FAILED`.
Bảng đầy đủ mã lỗi: `API_CHANGES.md`.

| Code | Ý nghĩa |
|------|---------|
| 200 | Lấy / cập nhật thành công |
| 201 | Tạo mới thành công (user, quiz, question, attempt...) |
| 204 | Xoá thành công |
| 400 | Dữ liệu không hợp lệ / vi phạm quy tắc nghiệp vụ |
| 401 | Chưa xác thực / token hết hạn / sai thông tin đăng nhập |
| 403 | Không có quyền (không sở hữu, bank riêng tư, tài khoản bị khoá, hết lượt trial...) |
| 404 | Không tìm thấy Quiz/Question/Answer/Attempt/User |
| 409 | Xung đột (username/email đã dùng, đã nộp bài, câu hỏi đang được dùng) |
| 429 | Vượt giới hạn tần suất (rate limit) |
| 500 | Lỗi không mong muốn (`INTERNAL_ERROR`) |

## Data model

Bảng theo ERD ở SRS mục 1.4: `USER`, `QUESTION_BANK`, `QUIZ`, `QUESTION`,
`ANSWER`, `QUIZ_QUESTION` (bảng nối n-n giữ thứ tự câu hỏi trong Quiz),
`QUIZ_ATTEMPT`, `ATTEMPT_ANSWER`.

Hầu hết khoá ngoại dùng `Restrict`; `QUIZ_QUESTION → QUIZ` và
`ATTEMPT_ANSWER → QUIZ_ATTEMPT` dùng `Cascade`. Quiz được xoá mềm (giữ lịch sử làm bài);
Question Bank/Question/Answer xoá tường minh trong transaction để không để
lại dữ liệu mồ côi và tôn trọng các ràng buộc "đang được sử dụng" (UC13 A3,
UC15 A3). Index bổ sung: `QUIZ(is_published, status, created_at)`,
`QUIZ_ATTEMPT(user_id, submitted_at)`, `QUIZ_ATTEMPT(is_trial, guest_identifier)`, `QUESTION(status)`.
Mọi thời điểm (`createdAt`, `startedAt`, `expiresAt`...) là UTC, ISO 8601 có hậu tố `Z`.

## Project layout

```
QuizApp.Api/
  Program.cs                  startup, DbContext, JWT auth, ProblemDetails (+code), rate limiting, Scalar, CORS
  Controllers/                AuthController, QuizzesController, QuizQuestionsController,
                               QuestionBanksController, QuizAttemptsController, AdminController,
                               ApiProblem (helper lỗi có code), ErrorCodes
  Migrations/                  EF Core migrations (InitialCreate)
  Data/                        QuizDbContext (ERD mapping), DbSeeder
  Dtos/                        request/response contracts + Mapper
  Entities/                    User, QuestionBank, Question, Answer, Quiz, QuizQuestion,
                               QuizAttempt, AttemptAnswer
  Enums/                       QuestionType, UserRole, AccountStatus, ContentStatus
  Security/                    PasswordHasher (PBKDF2), JwtTokenService, CurrentUserExtensions (CanManage)
  QuizApp.Api.http             ví dụ gọi API đầy đủ cho từng use case
```

## Ghi chú

Bản SRS này (Guest/User/Administrator, UC01–UC20, có Question Bank) đã thay
thế hoàn toàn bản model **Trainer/Trainee** trước đó — toàn bộ code trong
thư mục này được viết lại từ đầu để khớp với SRS mới, không còn tương thích
ngược với dữ liệu/API của bản cũ.
