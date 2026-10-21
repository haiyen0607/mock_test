## Mô tả / Description

**Thay đổi gì / What:**
<!-- Tóm tắt ngắn gọn thay đổi. Briefly summarize the change. -->

**Tại sao / Why:**
<!-- Lý do, issue / use case liên quan (vd. UC08). Motivation, related issue / use case. -->

## Cách kiểm thử / How tested

<!-- Các bước đã kiểm thử, test đã thêm/sửa. Steps taken, tests added or updated. -->
- [ ] Unit tests (`tests/QuizApp.Domain.Tests`, `tests/QuizApp.Application.Tests`)
- [ ] Integration tests (`tests/QuizApp.Api.IntegrationTests`)
- [ ] Kiểm thử thủ công / Manual testing (API Scalar `/scalar` hoặc giao diện / or UI)

## Ảnh chụp màn hình / Screenshots (UI)

<!-- Bắt buộc nếu thay đổi giao diện: trước / sau. Required for UI changes: before / after. -->

## Checklist

- [ ] `dotnet build QuizApp.sln -c Release` thành công / passes
- [ ] `dotnet test QuizApp.sln -c Release` thành công / passes
- [ ] `npx ng build` (src/quizapp-frontend) thành công / passes (nếu sửa frontend / if frontend changed)
- [ ] Tiêu đề PR theo Conventional Commits / PR title follows Conventional Commits (`feat: ...`, `fix: ...`, `refactor: ...`, `test: ...`, `ci: ...`, `docs: ...`)
- [ ] Đã cập nhật migration / tài liệu nếu cần / Migrations and docs updated if needed
- [ ] Không commit secret (Jwt:Key, connection string thật...) / No secrets committed
