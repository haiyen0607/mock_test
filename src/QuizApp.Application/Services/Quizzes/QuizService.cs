using Microsoft.EntityFrameworkCore;
using QuizApp.Application.Abstractions;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Services.Quizzes;

/// <summary>Quiz Discovery (UC04–UC06, Guest/User) và Quiz Management (UC11/UC12/UC14, User).</summary>
public interface IQuizService
{
    /// <summary>UC04/UC05 – Browse/Search Public Quizzes (phân trang, lọc theo Title, sort newest | oldest | title).</summary>
    Task<Result<PagedResult<QuizListItemDto>>> GetPublicQuizzesAsync(string? search, PageQuery paging, CancellationToken ct = default);

    /// <summary>UC12 – Quiz thuộc sở hữu của User đang đăng nhập (mọi trạng thái trừ đã xoá).</summary>
    Task<Result<PagedResult<QuizListItemDto>>> GetMyQuizzesAsync(PageQuery paging, CancellationToken ct = default);

    /// <summary>UC06 – View Quiz Details. Không xem được -> NotFound (QUIZ_NOT_FOUND).</summary>
    Task<Result<QuizDetailDto>> GetQuizAsync(int quizId, CancellationToken ct = default);

    /// <summary>UC11 – Create Quiz (luôn ở trạng thái Private).</summary>
    Task<Result<QuizDetailDto>> CreateQuizAsync(QuizRequest request, CancellationToken ct = default);

    /// <summary>UC12 – cập nhật thông tin cơ bản. Không phải chủ sở hữu -> Forbidden (NOT_OWNER).</summary>
    Task<Result<QuizDetailDto>> UpdateQuizAsync(int quizId, QuizRequest request, CancellationToken ct = default);

    /// <summary>UC12 – xoá MỀM Quiz.</summary>
    Task<Result> DeleteQuizAsync(int quizId, CancellationToken ct = default);

    /// <summary>UC14 – Publish/Unpublish Quiz. Không đủ nội dung -> lỗi theo field "questions".</summary>
    Task<Result<QuizDetailDto>> SetPublishAsync(int quizId, PublishQuizRequest request, CancellationToken ct = default);
}

public sealed class QuizService : IQuizService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public QuizService(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result<PagedResult<QuizListItemDto>>> GetPublicQuizzesAsync(string? search, PageQuery paging, CancellationToken ct = default)
    {
        // Quiz mà mọi câu hỏi đều đã bị Admin gỡ thì không còn làm được -> không hiển thị (UC20 A2)
        var query = _db.Quizzes
            .AsNoTracking()
            .Where(q => q.IsPublished && q.Status == ContentStatus.Active
                        && q.QuizQuestions.Any(qq => qq.Question!.Status == ContentStatus.Active));

        // Lọc/đếm hoàn toàn trong SQL (A4); collation CI nên không phân biệt hoa/thường
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(q => q.Title.Contains(search.Trim()));

        return await query.SortQuizzes(paging.SortKey).Select(Mapper.ListItemProjection).ToPagedResultAsync(paging, ct);
    }

    public async Task<Result<PagedResult<QuizListItemDto>>> GetMyQuizzesAsync(PageQuery paging, CancellationToken ct = default)
    {
        var userId = _currentUser.RequireUserId();

        var query = _db.Quizzes
            .AsNoTracking()
            .Where(q => q.OwnerId == userId && q.Status != ContentStatus.Deleted);

        return await query.SortQuizzes(paging.SortKey).Select(Mapper.ListItemProjection).ToPagedResultAsync(paging, ct);
    }

    public async Task<Result<QuizDetailDto>> GetQuizAsync(int quizId, CancellationToken ct = default)
    {
        var quiz = await _db.Quizzes
            .AsNoTracking()
            .Include(q => q.Owner)
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.QuestionBank)
            .AsSplitQuery()
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted, ct);

        if (quiz is null || !CanView(quiz))
            return QuizNotFound(quizId);

        // Chủ sở hữu/Admin thấy cả câu bị gỡ (kèm Status); người khác chỉ thấy câu còn Active (UC20 A2).
        // CanEdit: chỉ câu thuộc bank mà người xem quản lý (không sửa được câu tái sử dụng từ bank của người khác).
        return Mapper.ToDetail(quiz, includeRemoved: _currentUser.CanManage(quiz.OwnerId), canManageBank: _currentUser.CanManage);
    }

    public async Task<Result<QuizDetailDto>> CreateQuizAsync(QuizRequest request, CancellationToken ct = default)
    {
        var quiz = new Quiz
        {
            OwnerId = _currentUser.RequireUserId(),
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Duration = request.Duration,
            IsPublished = false, // Quiz mới luôn tạo ở trạng thái Private
            Status = ContentStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _db.Quizzes.Add(quiz);
        await _db.SaveChangesAsync(ct);
        await _db.Quizzes.Entry(quiz).Reference(q => q.Owner).LoadAsync(ct);

        return Mapper.ToDetail(quiz);
    }

    public async Task<Result<QuizDetailDto>> UpdateQuizAsync(int quizId, QuizRequest request, CancellationToken ct = default)
    {
        var quiz = await _db.Quizzes
            .Include(q => q.Owner)
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted, ct);

        if (quiz is null)
            return QuizNotFound(quizId);

        // A4 – User does not own the Quiz
        if (!_currentUser.CanManage(quiz.OwnerId))
            return NotOwner();

        quiz.Title = request.Title.Trim();
        quiz.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        quiz.Duration = request.Duration;

        await _db.SaveChangesAsync(ct);
        return Mapper.ToDetail(quiz);
    }

    public async Task<Result> DeleteQuizAsync(int quizId, CancellationToken ct = default)
    {
        var quiz = await _db.Quizzes.FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted, ct);
        if (quiz is null)
            return QuizNotFound(quizId);

        if (!_currentUser.CanManage(quiz.OwnerId))
            return NotOwner();

        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        // Lượt làm bài của mọi người vẫn được giữ để "Bài đã làm"/kết quả cũ vẫn xem được.
        // Không xoá Question gốc trong Question Bank — chỉ gỡ liên kết câu hỏi để Question/Bank
        // không bị coi là "đang được dùng" bởi Quiz đã xoá.
        await _db.QuizQuestions.Where(qq => qq.QuizId == quizId).ExecuteDeleteAsync(ct);
        quiz.Status = ContentStatus.Deleted;
        quiz.IsPublished = false;
        await _db.SaveChangesAsync(ct);

        await transaction.CommitAsync(ct);
        return Result.Success();
    }

    public async Task<Result<QuizDetailDto>> SetPublishAsync(int quizId, PublishQuizRequest request, CancellationToken ct = default)
    {
        var quiz = await _db.Quizzes
            .Include(q => q.Owner)
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted, ct);

        if (quiz is null)
            return QuizNotFound(quizId);

        // A3 – User does not own the Quiz
        if (!_currentUser.CanManage(quiz.OwnerId))
            return NotOwner();

        // A1 – Quiz does not contain valid content (bước 3: "System validates the Quiz and its questions")
        if (request.Publish)
        {
            var errors = ValidateForPublish(quiz);
            if (errors.Count > 0)
                return Error.Fields("questions", errors); // 400 – liệt kê rõ câu nào cần bổ sung
        }

        quiz.IsPublished = request.Publish; // A4 – Unpublish khi request.Publish = false
        await _db.SaveChangesAsync(ct);

        return Mapper.ToDetail(quiz);
    }

    /// <summary>Guest/User chỉ xem được Quiz đã Public và chưa bị Admin gỡ; chủ sở hữu/Admin xem được mọi trạng thái (trừ Deleted).</summary>
    private bool CanView(Quiz quiz)
    {
        var isPublicVisible = quiz.IsPublished && quiz.Status == ContentStatus.Active;
        return isPublicVisible || _currentUser.CanManage(quiz.OwnerId);
    }

    private static Error QuizNotFound(int quizId) =>
        Error.NotFound(ErrorCodes.QuizNotFound, $"Quiz {quizId} was not found.");

    private static Error NotOwner() =>
        Error.Forbidden(ErrorCodes.NotOwner, "You do not own this quiz.");

    /// <summary>
    /// UC14 A1 – điều kiện để Publish: có ít nhất 1 câu hỏi còn Active, và từng câu phải đủ nội dung
    /// (câu trắc nghiệm: ≥ 2 đáp án, ≥ 1 đáp án đúng; SingleChoice/TrueFalse: đúng 1 đáp án đúng).
    /// Câu bị Admin gỡ (Removed) không được tính và không chặn việc publish.
    /// </summary>
    internal static List<string> ValidateForPublish(Quiz quiz)
    {
        var errors = new List<string>();
        var active = quiz.ActiveQuestions();

        if (active.Count == 0)
        {
            errors.Add("A quiz must have at least one active question before it can be published.");
            return errors;
        }

        for (var i = 0; i < active.Count; i++)
        {
            var question = active[i].Question!;
            var reason = QuestionTypeRules.ValidateForPlay(question.QuestionType,
                question.Answers.Count, question.Answers.Count(a => a.IsCorrect));

            if (reason is not null)
                errors.Add($"Question {i + 1} (id {question.QuestionId}): {reason}");
        }

        return errors;
    }
}
