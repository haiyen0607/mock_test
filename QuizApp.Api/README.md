# Quiz Application API (ANG.P.L001)

REST API cho SRS mới nhất của Quiz Application: 3 actor **Guest / User /
Administrator**, Quiz Discovery & Participation, Quiz Management, Question
Bank (tái sử dụng câu hỏi), và System Administration.

- **Stack:** ASP.NET Core 8 Web API + Entity Framework Core 8 (SQL Server) + JWT Bearer Auth
- **Docs:** Scalar API reference tại `/scalar` trong Development (OpenAPI JSON tại `/openapi/v1.json`)

## Chạy thử

```bash
cd QuizApp.Api
dotnet restore
dotnet run
```

URL mặc định: `http://localhost:5080` (API reference tại `http://localhost:5080/scalar`).

Database (`QuizAppDb` trên LocalDB) được tạo tự động khi khởi động qua
`EnsureCreated()` và seed sẵn:
- Administrator: `admin` / `Admin@123`
- User: `hoanganh` / `User@123`
- 1 Question Bank công khai "Angular Fundamentals" (4 câu hỏi)
- 1 Quiz đã publish "Angular Fundamentals Quiz"

Đổi connection string trong `appsettings.json` nếu dùng SQL Server đầy đủ.
**Nhớ đổi `Jwt:Key` trong `appsettings.json` trước khi deploy thật.**

### Dùng migrations thay vì EnsureCreated

```bash
dotnet tool install --global dotnet-ef
dotnet ef migrations add InitialCreate
dotnet ef database update
```

Sau đó thay `db.Database.EnsureCreated()` bằng `db.Database.Migrate()` trong `Program.cs`.

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

| UC | Actor | Method | Route |
|----|-------|--------|-------|
| UC01 | Guest | POST | `/api/auth/register` |
| UC02 | Guest/User/Admin | POST | `/api/auth/login` |
| UC03 | User/Admin | POST | `/api/auth/logout` |
| UC04 | Guest/User | GET | `/api/quizzes` |
| UC05 | Guest/User | GET | `/api/quizzes?search=` |
| UC06 | Guest/User | GET | `/api/quizzes/{quizId}` |
| UC07 | Guest | POST | `/api/quizzes/{quizId}/trial` |
| UC08 | User | POST | `/api/quizzes/{quizId}/attempts` |
| UC08/UC09 | Guest/User | GET | `/api/attempts/{attemptId}/content` |
| UC09 | Guest/User | POST | `/api/attempts/{attemptId}/submit` |
| UC10 | Guest/User | GET | `/api/attempts/{attemptId}/result` |
| UC11 | User | POST | `/api/quizzes` |
| UC12 | User | GET | `/api/quizzes/mine` |
| UC12 | User | PUT / DELETE | `/api/quizzes/{quizId}` |
| UC13 | User | POST | `/api/quizzes/{quizId}/questions` (tạo mới hoặc `questionId` để reuse — UC17) |
| UC13 | User | PUT | `/api/quizzes/{quizId}/questions/order` |
| UC13 | User | DELETE | `/api/quizzes/{quizId}/questions/{questionId}` |
| UC15 | User | GET | `/api/question-banks/mine` |
| UC15 | User | POST / PUT / DELETE | `/api/question-banks`, `/api/question-banks/{bankId}` |
| UC15 | Guest/User | GET | `/api/question-banks/{bankId}/questions` |
| UC15 | User | POST/PUT/DELETE | `/api/question-banks/{bankId}/questions`, `/api/question-banks/questions/{questionId}` |
| UC15 | User | POST/PUT/DELETE | `/api/question-banks/questions/{questionId}/answers`, `/api/question-banks/answers/{answerId}` |
| UC16 | Guest/User | GET | `/api/question-banks/public-questions?search=` |
| UC18 | Admin | GET | `/api/admin/users` |
| UC18 | Admin | PUT | `/api/admin/users/{userId}/status` |
| UC19 | Admin | GET | `/api/admin/quizzes` |
| UC19/UC20 | Admin | PUT | `/api/admin/quizzes/{quizId}/status` |
| UC20 | Admin | PUT | `/api/admin/questions/{questionId}/status` |

Xem `QuizApp.Api.http` để có ví dụ gọi đầy đủ theo đúng thứ tự (register →
login → create quiz → create question bank → add/reuse question → publish →
trial/take → submit → result → admin moderation).

## Business rules chính

- **Ownership:** chỉ chủ sở hữu (hoặc Administrator) mới sửa/xoá/publish Quiz,
  Question Bank, Question, Answer của mình (UC12/UC14/UC15 – alt. flow "does
  not own").
- **Publish:** một Quiz chỉ publish được khi có ít nhất 1 câu hỏi (UC14 A1).
- **Reuse Question (UC17):** thêm 1 Question có sẵn vào Quiz không copy dữ
  liệu — chỉ tạo liên kết `QuizQuestion`; xoá liên kết không xoá Question gốc
  trong Question Bank (UC13 A3).
- **Question Bank riêng tư** chỉ chủ sở hữu xem/tái sử dụng được; **Question
  Bank công khai** thì ai cũng tìm và reuse được (UC16, UC17 A2).
- **Xoá có ràng buộc:** không xoá được Question Bank/Question đang được ít
  nhất 1 Quiz sử dụng — phải gỡ khỏi Quiz trước (UC15 A3).
- **Chấm điểm (UC09):** câu hỏi có đáp án định nghĩa sẵn (MultipleChoice/
  SingleChoice/TrueFalse) được chấm tự động; câu hỏi dạng văn bản
  (FillInTheBlanks/ShortAnswer/LongAnswer) được lưu lại chờ chấm thủ công (A3)
  và không tính vào điểm tự động.
- **Kiểm duyệt (UC19/UC20):** Administrator đổi `Status` của Quiz/Question
  sang `Removed` — nội dung biến mất khỏi kết quả công khai (`Status =
  Active` là điều kiện lọc ở mọi endpoint Guest/User) nhưng dữ liệu vẫn được
  giữ lại (soft-delete), không phá vỡ các Attempt đã tồn tại.

## Question types

`MultipleChoice`, `SingleChoice`, `TrueFalse`, `FillInTheBlanks`, `ShortAnswer`, `LongAnswer`

| Type | Đáp án định nghĩa sẵn | Payload khi trả lời |
|------|------------------------|----------------------|
| MultipleChoice | có | 1 dòng `answerId` cho mỗi lựa chọn (nhiều dòng) |
| SingleChoice / TrueFalse | có | đúng 1 `answerId` |
| FillInTheBlanks / ShortAnswer / LongAnswer | không | 1 `responseText` |

## Status codes

| Code | Ý nghĩa |
|------|---------|
| 200 | Lấy / cập nhật thành công |
| 201 | Tạo mới thành công (user, quiz, question, attempt...) |
| 204 | Xoá thành công |
| 400 | Dữ liệu không hợp lệ – trả về RFC 7807 `ValidationProblemDetails` |
| 401 | Chưa xác thực / sai thông tin đăng nhập / tài khoản bị khoá |
| 403 | Đã xác thực nhưng không có quyền (không sở hữu, bank riêng tư...) |
| 404 | Không tìm thấy Quiz/Question/Answer/Attempt/User |
| 500 | Lỗi không mong muốn – trả về RFC 7807 `ProblemDetails` |

## Data model

Bảng theo ERD ở SRS mục 1.4: `USER`, `QUESTION_BANK`, `QUIZ`, `QUESTION`,
`ANSWER`, `QUIZ_QUESTION` (bảng nối n-n giữ thứ tự câu hỏi trong Quiz),
`QUIZ_ATTEMPT`, `ATTEMPT_ANSWER`.

Hầu hết khoá ngoại dùng `Restrict`; `QUIZ_QUESTION → QUIZ` và
`ATTEMPT_ANSWER → QUIZ_ATTEMPT` dùng `Cascade` (xoá Quiz kéo theo xoá liên kết
câu hỏi của nó; xoá Attempt kéo theo xoá câu trả lời của nó). Xoá Quiz/Question
Bank/Question/Answer vẫn thực hiện tường minh trong transaction để không để
lại dữ liệu mồ côi và tôn trọng các ràng buộc "đang được sử dụng" (UC13 A3,
UC15 A3).

## Project layout

```
QuizApp.Api/
  Program.cs                  startup, DbContext, JWT auth, ProblemDetails, Scalar, CORS
  Controllers/                AuthController, QuizzesController, QuizQuestionsController,
                               QuestionBanksController, QuizAttemptsController, AdminController
  Data/                        QuizDbContext (ERD mapping), DbSeeder
  Dtos/                        request/response contracts + Mapper
  Entities/                    User, QuestionBank, Question, Answer, Quiz, QuizQuestion,
                               QuizAttempt, AttemptAnswer
  Enums/                       QuestionType, UserRole, AccountStatus, ContentStatus
  Security/                    PasswordHasher (PBKDF2), JwtTokenService, CurrentUserExtensions
  QuizApp.Api.http             ví dụ gọi API đầy đủ cho từng use case
```

## Ghi chú

Bản SRS này (Guest/User/Administrator, UC01–UC20, có Question Bank) đã thay
thế hoàn toàn bản model **Trainer/Trainee** trước đó — toàn bộ code trong
thư mục này được viết lại từ đầu để khớp với SRS mới, không còn tương thích
ngược với dữ liệu/API của bản cũ.
