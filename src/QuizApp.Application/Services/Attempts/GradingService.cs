using Microsoft.EntityFrameworkCore;
using QuizApp.Application.Abstractions;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using QuizApp.Domain.Enums;
using QuizApp.Domain.Scoring;

namespace QuizApp.Application.Services.Attempts;

/// <summary>A5 / UC09 A3 – chấm bài tự luận và thống kê Quiz cho chủ sở hữu/Admin.</summary>
public interface IGradingService
{
    /// <summary>
    /// Danh sách câu trả lời văn bản cần chấm thủ công của 1 Quiz, phân trang.
    /// Mặc định chỉ câu chờ chấm (IsCorrect = null); <paramref name="includeGraded"/> = true để lấy cả câu đã chấm.
    /// </summary>
    Task<Result<PagedResult<GradingItemDto>>> GetGradingQueueAsync(int quizId, PageQuery paging, bool includeGraded, CancellationToken ct = default);

    /// <summary>Chấm 1 câu trả lời văn bản (đúng/sai) rồi tính lại điểm của lượt làm bài. Câu đã chấm có thể chấm lại.</summary>
    Task<Result<GradeResultDto>> GradeAnswerAsync(int attemptAnswerId, GradeAnswerRequest request, CancellationToken ct = default);

    /// <summary>Thống kê Quiz: số lượt, số người, điểm trung bình, số câu chờ chấm và tỉ lệ đúng từng câu.</summary>
    Task<Result<QuizStatsDto>> GetQuizStatsAsync(int quizId, CancellationToken ct = default);
}

public sealed class GradingService : IGradingService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly AttemptScorer _scorer;

    public GradingService(IApplicationDbContext db, ICurrentUser currentUser, AttemptScorer scorer)
    {
        _db = db;
        _currentUser = currentUser;
        _scorer = scorer;
    }

    public async Task<Result<PagedResult<GradingItemDto>>> GetGradingQueueAsync(int quizId, PageQuery paging, bool includeGraded, CancellationToken ct = default)
    {
        var access = await CheckQuizManagerAsync(quizId, ct);
        if (access is not null) return access;

        // Chỉ lượt đã nộp, không gồm trial
        var query = _db.AttemptAnswers.AsNoTracking()
            .Where(aa => aa.Attempt!.QuizId == quizId && !aa.Attempt.IsTrial && aa.Attempt.SubmittedAt != null
                         && aa.ResponseText != null);

        if (!includeGraded)
            query = query.Where(aa => aa.IsCorrect == null);

        // sort = newest (mặc định) | oldest (theo SubmittedAt)
        query = paging.SortKey == "oldest"
            ? query.OrderBy(aa => aa.Attempt!.SubmittedAt).ThenBy(aa => aa.AttemptAnswerId)
            : query.OrderByDescending(aa => aa.Attempt!.SubmittedAt).ThenByDescending(aa => aa.AttemptAnswerId);

        return await query
            .Select(aa => new GradingItemDto(aa.AttemptAnswerId, aa.AttemptId, aa.QuestionId, aa.Question!.Content,
                aa.Question.QuestionType.ToString(), aa.ResponseText!, aa.Attempt!.User!.Username,
                aa.Attempt.SubmittedAt!.Value, aa.IsCorrect))
            .ToPagedResultAsync(paging, ct);
    }

    public async Task<Result<GradeResultDto>> GradeAnswerAsync(int attemptAnswerId, GradeAnswerRequest request, CancellationToken ct = default)
    {
        var row = await _db.AttemptAnswers
            .Include(aa => aa.Question)
            .Include(aa => aa.Attempt).ThenInclude(a => a!.Quiz)
            .FirstOrDefaultAsync(aa => aa.AttemptAnswerId == attemptAnswerId, ct);

        if (row is null)
            return Error.NotFound(ErrorCodes.AnswerNotFound, $"Attempt answer {attemptAnswerId} was not found.");

        var attempt = row.Attempt!;
        if (!_currentUser.CanManage(attempt.Quiz!.OwnerId))
            return Error.Forbidden(ErrorCodes.NotOwner, "You do not own this quiz.");

        if (attempt.SubmittedAt is null || row.ResponseText is null
            || QuestionTypeRules.UsesPredefinedAnswers(row.Question!.QuestionType))
            return Error.Validation(ErrorCodes.NotGradable, "Only submitted, non-empty text answers can be graded manually.");

        row.IsCorrect = request.IsCorrect!.Value;

        // Nạp toàn bộ dòng trả lời của lượt làm bài để tính lại điểm (dùng chung AttemptScorer với Submit)
        await _db.QuizAttempts.Entry(attempt).Collection(a => a.Answers).Query().Include(aa => aa.Question).LoadAsync(ct);
        var types = attempt.Answers.GroupBy(aa => aa.QuestionId).ToDictionary(g => g.Key, g => g.First().Question!.QuestionType);
        _scorer.Score(attempt, id => types[id]);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Error.Conflict(ErrorCodes.ConcurrencyConflict, "This attempt was updated by another request. Please reload and try again.");
        }

        return new GradeResultDto(attempt.AttemptId, attempt.Score, attempt.CorrectCount, attempt.MaxScore, attempt.PendingCount);
    }

    public async Task<Result<QuizStatsDto>> GetQuizStatsAsync(int quizId, CancellationToken ct = default)
    {
        var access = await CheckQuizManagerAsync(quizId, ct);
        if (access is not null) return access;

        // Chỉ tính lượt đã nộp, không gồm trial. Tổng hợp bằng GroupBy trong SQL.
        var attempts = _db.QuizAttempts.AsNoTracking()
            .Where(a => a.QuizId == quizId && !a.IsTrial && a.SubmittedAt != null);

        var attemptCount = await attempts.CountAsync(ct);
        var uniqueUsers = await attempts.Select(a => a.UserId).Distinct().CountAsync(ct);
        var averageScore = await attempts.Where(a => a.Score != null).AverageAsync(a => (double?)a.Score, ct) ?? 0;
        var pendingCount = await attempts.SumAsync(a => a.PendingCount, ct);

        // Mỗi câu: số lượt đã trả lời, số lượt đúng, số lượt đã được chấm (mẫu số của tỉ lệ đúng)
        var perQuestion = await _db.AttemptAnswers.AsNoTracking()
            .Where(aa => aa.Attempt!.QuizId == quizId && !aa.Attempt.IsTrial && aa.Attempt.SubmittedAt != null)
            .GroupBy(aa => aa.QuestionId)
            .Select(g => new
            {
                QuestionId = g.Key,
                Answered = g.Where(x => x.AnswerId != null || x.ResponseText != null).Select(x => x.AttemptId).Distinct().Count(),
                Correct = g.Where(x => x.IsCorrect == true).Select(x => x.AttemptId).Distinct().Count(),
                Graded = g.Where(x => x.IsCorrect != null).Select(x => x.AttemptId).Distinct().Count()
            })
            .ToListAsync(ct);

        // Danh sách câu: theo thứ tự hiện tại của Quiz, rồi các câu chỉ còn trong lịch sử (đã gỡ khỏi Quiz)
        var currentOrder = await _db.QuizQuestions.AsNoTracking()
            .Where(qq => qq.QuizId == quizId).OrderBy(qq => qq.OrderIndex).Select(qq => qq.QuestionId).ToListAsync(ct);
        var questionIds = currentOrder.Concat(perQuestion.Select(p => p.QuestionId).OrderBy(id => id)).Distinct().ToList();

        var questionInfo = await _db.Questions.AsNoTracking()
            .Where(q => questionIds.Contains(q.QuestionId))
            .Select(q => new { q.QuestionId, q.Content, q.QuestionType })
            .ToDictionaryAsync(q => q.QuestionId, ct);
        var statsById = perQuestion.ToDictionary(p => p.QuestionId);

        var questions = questionIds.Where(questionInfo.ContainsKey).Select(id =>
        {
            var info = questionInfo[id];
            statsById.TryGetValue(id, out var stat);
            var answered = stat?.Answered ?? 0;
            var correct = stat?.Correct ?? 0;
            var graded = stat?.Graded ?? 0;
            var rate = graded > 0 ? Math.Round(correct * 100.0 / graded, 1) : 0;
            return new QuestionStatDto(id, info.Content, info.QuestionType.ToString(), answered, correct, rate);
        }).ToList();

        return new QuizStatsDto(attemptCount, uniqueUsers, Math.Round(averageScore, 1), pendingCount, questions);
    }

    /// <summary>Quiz tồn tại (chưa xoá) và người gọi là chủ sở hữu/Admin; null nếu hợp lệ, ngược lại là lỗi.</summary>
    private async Task<Error?> CheckQuizManagerAsync(int quizId, CancellationToken ct)
    {
        var ownerId = await _db.Quizzes.AsNoTracking()
            .Where(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted)
            .Select(q => (int?)q.OwnerId)
            .FirstOrDefaultAsync(ct);

        if (ownerId is null)
            return Error.NotFound(ErrorCodes.QuizNotFound, $"Quiz {quizId} was not found.");

        if (!_currentUser.CanManage(ownerId.Value))
            return Error.Forbidden(ErrorCodes.NotOwner, "You do not own this quiz.");

        return null;
    }
}
