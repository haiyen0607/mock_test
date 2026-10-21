using Microsoft.EntityFrameworkCore;
using QuizApp.Application.Abstractions;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;
using QuizApp.Domain.Scoring;

namespace QuizApp.Application.Services.Attempts;

/// <summary>
/// UC07 – Try Trial Quiz (Guest), UC08 – Take Quiz (User), UC09 – Submit Quiz,
/// UC10 – View Quiz Result; A5 – Lịch sử làm bài.
/// </summary>
public interface IAttemptService
{
    /// <summary>
    /// UC07 – Guest bắt đầu 1 lượt làm thử (định danh qua <paramref name="guestId"/> = header X-Guest-Id).
    /// Thiếu/quá dài -> INVALID_REQUEST; quá số lượt -> Forbidden TRIAL_LIMIT.
    /// </summary>
    Task<Result<AttemptContentDto>> StartTrialAsync(int quizId, string? guestId, CancellationToken ct = default);

    /// <summary>UC08 – User đã đăng nhập bắt đầu làm 1 Quiz công khai.</summary>
    Task<Result<AttemptContentDto>> StartAttemptAsync(int quizId, CancellationToken ct = default);

    /// <summary>UC08/UC09 – nội dung Quiz đang làm (không lộ đáp án đúng). Đã nộp -> Conflict ATTEMPT_SUBMITTED.</summary>
    Task<Result<AttemptContentDto>> GetContentAsync(int attemptId, string? guestId, CancellationToken ct = default);

    /// <summary>UC09 – Submit Quiz: chấm tự động câu trắc nghiệm, câu văn bản chờ chấm thủ công (A3).</summary>
    Task<Result<SubmitAttemptResultDto>> SubmitAsync(int attemptId, string? guestId, SubmitAttemptRequest request, CancellationToken ct = default);

    /// <summary>UC10 – View Quiz Result (chỉ sau khi đã Submit).</summary>
    Task<Result<AttemptResultDto>> GetResultAsync(int attemptId, string? guestId, CancellationToken ct = default);

    /// <summary>A5 – "Bài đã làm": các lượt ĐÃ NỘP của User đang đăng nhập (không gồm trial), phân trang.</summary>
    Task<Result<PagedResult<AttemptHistoryItemDto>>> GetMyAttemptsAsync(PageQuery paging, CancellationToken ct = default);
}

public sealed class AttemptService : IAttemptService
{
    /// <summary>Số lượt trial tối đa cho mỗi Guest (định danh qua header X-Guest-Id) – SRS UC07 A1.</summary>
    private const int GuestTrialLimit = 3;

    /// <summary>
    /// Số giây cho phép nộp trễ so với Duration (bù độ trễ mạng / thời gian client gửi request khi hết giờ).
    /// Quá thời gian này, Submit bị từ chối (UC08 A3 – kiểm tra phía server, không tin timer của client).
    /// </summary>
    private const int SubmitGraceSeconds = 30;

    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly AttemptScorer _scorer;

    public AttemptService(IApplicationDbContext db, ICurrentUser currentUser, AttemptScorer scorer)
    {
        _db = db;
        _currentUser = currentUser;
        _scorer = scorer;
    }

    public async Task<Result<AttemptContentDto>> StartTrialAsync(int quizId, string? guestId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(guestId) || guestId.Length > 100)
            return Error.Validation(ErrorCodes.InvalidRequest, "Header X-Guest-Id (max 100 characters) is required to start a trial quiz.");

        var loaded = await LoadPlayableQuizAsync(quizId, ct); // A2 – Quiz is no longer available
        if (!loaded.IsSuccess) return loaded.Error!;
        var quiz = loaded.Value;

        // A1 – Trial limit reached
        var usedTrials = await _db.QuizAttempts.CountAsync(a => a.IsTrial && a.GuestIdentifier == guestId, ct);
        if (usedTrials >= GuestTrialLimit)
            return Error.Forbidden(ErrorCodes.TrialLimit, "Trial limit reached. Please register or log in to continue.");

        var attempt = new QuizAttempt
        {
            QuizId = quizId,
            UserId = null,
            IsTrial = true,
            GuestIdentifier = guestId,
            StartedAt = DateTime.UtcNow,
            DurationMinutes = quiz.Duration
        };

        _db.QuizAttempts.Add(attempt);
        await _db.SaveChangesAsync(ct);

        return Mapper.ToAttemptContent(attempt, quiz);
    }

    public async Task<Result<AttemptContentDto>> StartAttemptAsync(int quizId, CancellationToken ct = default)
    {
        var loaded = await LoadPlayableQuizAsync(quizId, ct); // A1 – Quiz is unavailable
        if (!loaded.IsSuccess) return loaded.Error!;
        var quiz = loaded.Value;

        var attempt = new QuizAttempt
        {
            QuizId = quizId,
            UserId = _currentUser.RequireUserId(),
            IsTrial = false,
            StartedAt = DateTime.UtcNow,
            DurationMinutes = quiz.Duration // chốt thời lượng lúc bắt đầu (UC08 A3)
        };

        _db.QuizAttempts.Add(attempt);
        await _db.SaveChangesAsync(ct);

        return Mapper.ToAttemptContent(attempt, quiz);
    }

    public async Task<Result<AttemptContentDto>> GetContentAsync(int attemptId, string? guestId, CancellationToken ct = default)
    {
        var attempt = await _db.QuizAttempts
            .AsNoTracking()
            .Include(a => a.Quiz).ThenInclude(q => q!.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.AttemptId == attemptId, ct);

        if (attempt is null || !OwnsAttempt(attempt, guestId))
            return AttemptNotFound(attemptId);

        if (attempt.SubmittedAt is not null)
            return AttemptAlreadySubmitted();

        return Mapper.ToAttemptContent(attempt, attempt.Quiz!);
    }

    public async Task<Result<SubmitAttemptResultDto>> SubmitAsync(int attemptId, string? guestId, SubmitAttemptRequest request, CancellationToken ct = default)
    {
        var attempt = await _db.QuizAttempts
            .Include(a => a.Quiz).ThenInclude(q => q!.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.AttemptId == attemptId, ct);

        if (attempt is null || !OwnsAttempt(attempt, guestId))
            return AttemptNotFound(attemptId);

        // Preconditions – "The User has an active Quiz Attempt"
        if (attempt.SubmittedAt is not null)
            return AttemptAlreadySubmitted();

        var quiz = attempt.Quiz!;

        // Quiz bị Admin gỡ / chủ sở hữu xoá trong lúc đang làm -> không nhận bài nữa (UC20 A2).
        // (Quiz bị chủ sở hữu Unpublish thì vẫn cho nộp: UC14 A4 chỉ chặn lượt làm MỚI.)
        if (quiz.Status != ContentStatus.Active)
            return Error.Forbidden(ErrorCodes.QuizNotAvailable, "This quiz is no longer available and can no longer be submitted.");

        // UC08 A3 – hết thời gian làm bài (kiểm tra phía server, theo thời lượng đã chốt lúc bắt đầu)
        var deadline = attempt.StartedAt.AddMinutes(attempt.DurationMinutes).AddSeconds(SubmitGraceSeconds);
        if (DateTime.UtcNow > deadline)
            return Error.Validation(ErrorCodes.AttemptExpired, "The time limit for this attempt has expired.");

        // Chỉ câu còn Active mới được trả lời và tính điểm (câu bị Admin gỡ không còn trong đề – UC20 A2)
        var activeQuestions = quiz.ActiveQuestions().Select(qq => qq.Question!).ToList();
        var submitted = request.Answers
            .Select((a, i) => new SubmittedAnswer(i, a.QuestionId, a.AnswerId, a.ResponseText))
            .ToList();

        var errors = _scorer.Validate(activeQuestions, submitted);
        if (errors.Count > 0) // A2 – Submission data is invalid
            return Error.Fields("answers", errors);

        // Chấm theo TỪNG CÂU HỎI của Quiz, không theo từng dòng trả lời (chi tiết từng loại câu: Domain/Scoring):
        // - MỌI câu Active đều có ít nhất 1 dòng AttemptAnswer (câu bỏ trống = dòng rỗng) để kết quả,
        //   lịch sử và chấm lại (A5) không phụ thuộc vào trạng thái hiện tại của Quiz;
        // - câu trắc nghiệm đúng khi tập đáp án đã chọn TRÙNG KHỚP tập đáp án đúng; bỏ trống = sai;
        // - câu văn bản có trả lời chờ chấm thủ công (IsCorrect = null, UC09 A3).
        var types = activeQuestions.ToDictionary(q => q.QuestionId, q => q.QuestionType);

        attempt.SubmittedAt = DateTime.UtcNow;
        attempt.Answers = _scorer.CreateAnswerRows(activeQuestions, submitted);
        _scorer.Score(attempt, id => types[id]);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Request Submit khác của cùng attempt đã được lưu trước (RowVersion đã đổi)
            return AttemptAlreadySubmitted();
        }

        return new SubmitAttemptResultDto(attempt.AttemptId, quiz.QuizId, attempt.SubmittedAt.Value, attempt.Score,
            attempt.MaxScore, attempt.PendingCount, attempt.CorrectCount);
    }

    public async Task<Result<AttemptResultDto>> GetResultAsync(int attemptId, string? guestId, CancellationToken ct = default)
    {
        var attempt = await _db.QuizAttempts
            .AsNoTracking()
            .Include(a => a.Quiz).ThenInclude(q => q!.QuizQuestions)
            .Include(a => a.Answers).ThenInclude(aa => aa.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.AttemptId == attemptId, ct);

        if (attempt is null || !OwnsAttempt(attempt, guestId))
            return AttemptNotFound(attemptId);

        if (attempt.SubmittedAt is null)
            return Error.Validation(ErrorCodes.AttemptNotSubmitted, "This attempt has not been submitted yet.");

        var quiz = attempt.Quiz!;
        // Guest (lượt trial): không lộ đáp án đúng — chỉ thấy điểm và đúng/sai từng câu.
        var hideAnswers = attempt.IsTrial;
        var order = quiz.QuizQuestions.ToDictionary(qq => qq.QuestionId, qq => qq.OrderIndex);

        // Dựng kết quả từ các dòng ĐÃ CHỐT lúc Submit (mỗi câu có ≥ 1 dòng), không từ trạng thái Quiz hiện tại.
        // Thứ tự theo OrderIndex hiện tại (nếu câu còn trong Quiz), sau đó theo QuestionId.
        // Câu bị Admin gỡ (Removed) không hiển thị (UC20 A2) nhưng điểm đã chốt vẫn giữ nguyên.
        var questions = attempt.Answers
            .GroupBy(aa => aa.QuestionId)
            .Select(g => (Rows: g.ToList(), Question: g.First().Question!))
            .Where(x => x.Question.Status != ContentStatus.Removed)
            .OrderBy(x => order.TryGetValue(x.Question.QuestionId, out var index) ? index : int.MaxValue)
            .ThenBy(x => x.Question.QuestionId)
            .Select(x =>
            {
                var question = x.Question;
                var selectedIds = x.Rows.Where(a => a.AnswerId is not null).Select(a => a.AnswerId!.Value).ToList();
                var responseText = x.Rows.Select(a => a.ResponseText).FirstOrDefault(t => t is not null);

                var options = question.Answers.OrderBy(a => a.AnswerId)
                    .Select(a => new ResultAnswerOptionDto(a.AnswerId, a.QuestionId, a.Content, hideAnswers ? null : a.IsCorrect))
                    .ToList();

                // Đúng/sai lấy từ kết quả ĐÃ CHỐT (AttemptAnswer.IsCorrect), không tính lại theo đáp án hiện tại.
                return new AttemptResultAnswerDto(question.QuestionId, question.Content, question.QuestionType.ToString(),
                    options, selectedIds, responseText, x.Rows[0].IsCorrect);
            })
            .ToList();

        return new AttemptResultDto(attempt.AttemptId, quiz.QuizId, quiz.Title, attempt.StartedAt, attempt.SubmittedAt,
            attempt.Score, questions, hideAnswers, attempt.CorrectCount, attempt.MaxScore, attempt.PendingCount);
    }

    public async Task<Result<PagedResult<AttemptHistoryItemDto>>> GetMyAttemptsAsync(PageQuery paging, CancellationToken ct = default)
    {
        var userId = _currentUser.RequireUserId();
        var query = _db.QuizAttempts.AsNoTracking()
            .Where(a => a.UserId == userId && !a.IsTrial && a.SubmittedAt != null);

        // sort = newest (mặc định, theo SubmittedAt) | oldest | title (theo tên Quiz)
        query = paging.SortKey switch
        {
            "oldest" => query.OrderBy(a => a.SubmittedAt).ThenBy(a => a.AttemptId),
            "title" => query.OrderBy(a => a.Quiz!.Title).ThenByDescending(a => a.SubmittedAt),
            _ => query.OrderByDescending(a => a.SubmittedAt).ThenByDescending(a => a.AttemptId)
        };

        // Quiz đã xoá vẫn hiện (QuizDeleted = true)
        return await query
            .Select(a => new AttemptHistoryItemDto(a.AttemptId, a.QuizId, a.Quiz!.Title, a.Quiz.Status == ContentStatus.Deleted,
                a.StartedAt, a.SubmittedAt, a.Score, a.CorrectCount, a.MaxScore, a.PendingCount))
            .ToPagedResultAsync(paging, ct);
    }

    /// <summary>
    /// Quiz "khả dụng để tham gia" = tồn tại (chưa xoá), đã Public, chưa bị Admin gỡ, và có ít nhất 1 câu hỏi Active.
    /// Lỗi: 404 QUIZ_NOT_FOUND / 403 QUIZ_NOT_AVAILABLE / 400 QUIZ_NO_QUESTIONS.
    /// </summary>
    private async Task<Result<Quiz>> LoadPlayableQuizAsync(int quizId, CancellationToken ct)
    {
        var quiz = await _db.Quizzes
            .AsNoTracking()
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted, ct);

        if (quiz is null)
            return Error.NotFound(ErrorCodes.QuizNotFound, $"Quiz {quizId} was not found.");

        if (!quiz.IsPublished || quiz.Status != ContentStatus.Active)
            return Error.Forbidden(ErrorCodes.QuizNotAvailable, $"Quiz {quizId} is not available.");

        // Chỉ tính câu còn Active: quiz mà mọi câu đều bị Admin gỡ thì không còn làm được (UC20 A2)
        if (quiz.ActiveQuestions().Count == 0)
            return Error.Validation(ErrorCodes.QuizNoQuestions, $"Quiz {quizId} has no available questions.");

        return quiz;
    }

    private static Error AttemptNotFound(int attemptId) =>
        Error.NotFound(ErrorCodes.AttemptNotFound, $"Attempt {attemptId} was not found.");

    private static Error AttemptAlreadySubmitted() =>
        Error.Conflict(ErrorCodes.AttemptSubmitted, "This attempt has already been submitted.");

    /// <summary>Guest chỉ truy cập được attempt của chính mình (khớp GuestIdentifier); User chỉ truy cập attempt của chính mình.</summary>
    private bool OwnsAttempt(QuizAttempt attempt, string? guestId)
    {
        if (attempt.IsTrial)
            return !string.IsNullOrWhiteSpace(guestId) && attempt.GuestIdentifier == guestId;

        return _currentUser.IsAuthenticated && attempt.UserId == _currentUser.UserId;
    }
}
