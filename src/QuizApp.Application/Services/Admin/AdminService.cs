using Microsoft.EntityFrameworkCore;
using QuizApp.Application.Abstractions;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Services.Admin;

/// <summary>
/// UC18 – Manage Users, UC19 – Manage System Quizzes, UC20 – Moderate Content (actor Administrator).
/// </summary>
public interface IAdminService
{
    /// <summary>UC18 – danh sách tài khoản (phân trang). sort = newest (mặc định) | oldest | username.</summary>
    Task<Result<PagedResult<UserDto>>> GetUsersAsync(string? search, PageQuery paging, CancellationToken ct = default);

    /// <summary>UC18 – khoá/mở khoá tài khoản. INVALID_STATUS / USER_NOT_FOUND / INVALID_REQUEST.</summary>
    Task<Result<UserDto>> UpdateUserStatusAsync(int userId, UpdateUserStatusRequest request, CancellationToken ct = default);

    /// <summary>UC19 – danh sách Quiz trong hệ thống (Active + Removed) để kiểm duyệt.</summary>
    Task<Result<PagedResult<QuizListItemDto>>> GetAllQuizzesAsync(string? search, string? status, PageQuery paging, CancellationToken ct = default);

    /// <summary>UC19/UC20 – đổi trạng thái kiểm duyệt của 1 Quiz (Active/Removed).</summary>
    Task<Result<QuizListItemDto>> ModerateQuizAsync(int quizId, UpdateContentStatusRequest request, CancellationToken ct = default);

    /// <summary>UC20 bước 2–3 – danh sách câu hỏi để kiểm duyệt (tối đa 200, mới nhất trước).</summary>
    Task<Result<List<AdminQuestionDto>>> GetQuestionsAsync(string? search, string? status, CancellationToken ct = default);

    /// <summary>UC20 – đổi trạng thái kiểm duyệt của 1 Question. Trả về QuestionDto.</summary>
    Task<Result<QuestionDto>> ModerateQuestionAsync(int questionId, UpdateContentStatusRequest request, CancellationToken ct = default);
}

public sealed class AdminService : IAdminService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public AdminService(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result<PagedResult<UserDto>>> GetUsersAsync(string? search, PageQuery paging, CancellationToken ct = default)
    {
        var query = _db.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var key = search.Trim();
            query = query.Where(u => u.Username.Contains(key) || u.Email.Contains(key));
        }

        query = paging.SortKey switch
        {
            "oldest" => query.OrderBy(u => u.CreatedAt).ThenBy(u => u.UserId),
            "username" => query.OrderBy(u => u.Username),
            _ => query.OrderByDescending(u => u.CreatedAt).ThenByDescending(u => u.UserId)
        };

        return await query
            .Select(u => new UserDto(u.UserId, u.Username, u.Email, u.Role.ToString(), u.Status.ToString(), u.CreatedAt))
            .ToPagedResultAsync(paging, ct);
    }

    public async Task<Result<UserDto>> UpdateUserStatusAsync(int userId, UpdateUserStatusRequest request, CancellationToken ct = default)
    {
        // Enum.TryParse nhận cả chuỗi số ("5") -> phải kiểm tra thêm IsDefined
        if (int.TryParse(request.Status, out _)
            || !Enum.TryParse<AccountStatus>(request.Status, ignoreCase: true, out var status)
            || !Enum.IsDefined(status))
            return Error.Validation(ErrorCodes.InvalidStatus, "Status must be Active or Blocked.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId, ct);
        if (user is null)
            return Error.NotFound(ErrorCodes.UserNotFound, $"User {userId} was not found."); // A4

        // Không cho Admin tự khoá chính mình (sẽ mất quyền quản trị ngay lập tức)
        if (user.UserId == _currentUser.RequireUserId())
            return Error.Validation(ErrorCodes.InvalidRequest, "You cannot change the status of your own account.");

        // Không cho khoá tài khoản Administrator khác qua API này
        if (status == AccountStatus.Blocked && user.Role == UserRole.Administrator)
            return Error.Validation(ErrorCodes.InvalidRequest, "Administrator accounts cannot be blocked.");

        user.Status = status;
        await _db.SaveChangesAsync(ct);

        return Mapper.ToUser(user);
    }

    public async Task<Result<PagedResult<QuizListItemDto>>> GetAllQuizzesAsync(string? search, string? status, PageQuery paging, CancellationToken ct = default)
    {
        // Quiz chủ sở hữu đã xoá (Deleted) không hiển thị
        var query = _db.Quizzes.AsNoTracking().Where(q => q.Status != ContentStatus.Deleted);

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!ContentStatusRules.TryParseModeration(status, out var statusFilter))
                return Error.Validation(ErrorCodes.InvalidStatus, "Status must be Active or Removed.");
            query = query.Where(q => q.Status == statusFilter);
        }

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(q => q.Title.Contains(search.Trim()));

        return await query.SortQuizzes(paging.SortKey)
            .Select(Mapper.ListItemProjection)
            .ToPagedResultAsync(paging, ct);
    }

    public async Task<Result<QuizListItemDto>> ModerateQuizAsync(int quizId, UpdateContentStatusRequest request, CancellationToken ct = default)
    {
        if (!ContentStatusRules.TryParseModeration(request.Status, out var status))
            return Error.Validation(ErrorCodes.InvalidStatus, "Status must be Active or Removed.");

        var quiz = await _db.Quizzes.Include(q => q.Owner).Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question)
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted, ct);

        if (quiz is null)
            return Error.NotFound(ErrorCodes.QuizNotFound, $"Quiz {quizId} was not found."); // A4 – Content no longer exists

        quiz.Status = status; // A2 – Removed gỡ khỏi truy cập công khai (GetPublicQuizzes lọc theo Status Active)
        await _db.SaveChangesAsync(ct);

        return Mapper.ToListItem(quiz);
    }

    public async Task<Result<List<AdminQuestionDto>>> GetQuestionsAsync(string? search, string? status, CancellationToken ct = default)
    {
        // Thuộc MỌI Question Bank (kể cả câu chưa nằm trong Quiz nào); câu đã bị chủ sở hữu xoá (Deleted) không hiển thị
        var query = _db.Questions.AsNoTracking()
            .Include(q => q.QuestionBank).ThenInclude(b => b!.Owner)
            .Include(q => q.Answers)
            .Include(q => q.QuizQuestions)
            .Where(q => q.Status != ContentStatus.Deleted);

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!ContentStatusRules.TryParseModeration(status, out var filter))
                return Error.Validation(ErrorCodes.InvalidStatus, "Status must be Active or Removed.");
            query = query.Where(q => q.Status == filter);
        }

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(q => q.Content.Contains(search.Trim()));

        var questions = await query.OrderByDescending(q => q.CreatedAt).Take(200).ToListAsync(ct);
        return questions.Select(Mapper.ToAdminQuestion).ToList();
    }

    public async Task<Result<QuestionDto>> ModerateQuestionAsync(int questionId, UpdateContentStatusRequest request, CancellationToken ct = default)
    {
        if (!ContentStatusRules.TryParseModeration(request.Status, out var status))
            return Error.Validation(ErrorCodes.InvalidStatus, "Status must be Active or Removed.");

        var question = await _db.Questions.Include(q => q.Answers).FirstOrDefaultAsync(q => q.QuestionId == questionId, ct);
        // Câu đã bị chủ sở hữu xoá (Deleted) coi như không còn tồn tại – A4
        if (question is null || question.Status == ContentStatus.Deleted)
            return Error.NotFound(ErrorCodes.QuestionNotFound, $"Question {questionId} was not found.");

        question.Status = status;
        await _db.SaveChangesAsync(ct);

        return Mapper.ToQuestion(question);
    }
}
