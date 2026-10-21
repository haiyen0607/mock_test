using Microsoft.EntityFrameworkCore;
using QuizApp.Application.Abstractions;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Services.Quizzes;

/// <summary>
/// UC13 – Manage Quiz Questions (thêm/xoá/sắp xếp câu hỏi trong 1 Quiz) và
/// UC17 – Reuse Question (thêm 1 Question có sẵn từ Question Bank vào Quiz).
/// Chỉ chủ sở hữu Quiz (hoặc Administrator) mới được thao tác.
/// </summary>
public interface IQuizQuestionService
{
    /// <summary>UC13 – thêm 1 câu hỏi vào Quiz: tạo mới trong 1 Question Bank, hoặc tái sử dụng (UC17).</summary>
    Task<Result<QuestionSummaryDto>> AddQuestionAsync(int quizId, AddQuizQuestionRequest request, CancellationToken ct = default);

    /// <summary>UC13 – sắp xếp lại thứ tự câu hỏi trong Quiz.</summary>
    Task<Result<List<QuestionSummaryDto>>> ReorderAsync(int quizId, ReorderQuizQuestionsRequest request, CancellationToken ct = default);

    /// <summary>UC13 A3 – gỡ 1 câu hỏi khỏi Quiz. Không xoá Question gốc trong Question Bank.</summary>
    Task<Result> RemoveQuestionAsync(int quizId, int questionId, CancellationToken ct = default);
}

public sealed class QuizQuestionService : IQuizQuestionService
{
    /// <summary>Tên bank mặc định chứa câu hỏi tạo trực tiếp trong Quiz mà không chọn bank.</summary>
    internal const string DefaultBankName = "Câu hỏi tạo trong quiz";

    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public QuizQuestionService(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result<QuestionSummaryDto>> AddQuestionAsync(int quizId, AddQuizQuestionRequest request, CancellationToken ct = default)
    {
        var quiz = await _db.Quizzes.Include(q => q.QuizQuestions)
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted, ct);
        if (quiz is null)
            return QuizNotFound(quizId);

        // A4 – User does not own the Quiz
        if (!_currentUser.CanManage(quiz.OwnerId))
            return NotOwner();

        // Chỉ được chọn 1 trong 2 cách: reuse (questionId) HOẶC tạo mới (newQuestion, questionBankId tuỳ chọn)
        var wantsReuse = request.QuestionId is not null;
        var wantsCreate = request.NewQuestion is not null || request.QuestionBankId is not null;
        if (wantsReuse && wantsCreate)
            return Error.Validation(ErrorCodes.InvalidRequest, "Provide either questionId (reuse) or newQuestion (create), not both.");

        Question question;

        if (request.QuestionId is int reuseId)
        {
            // UC17 – Reuse Question
            var existing = await _db.Questions.Include(q => q.QuestionBank).Include(q => q.Answers)
                .FirstOrDefaultAsync(q => q.QuestionId == reuseId, ct);

            if (existing is null || existing.Status != ContentStatus.Active)
                return Error.NotFound(ErrorCodes.QuestionNotFound, "No matching Question is found."); // A1

            // A2 – Question is not accessible (private bank owned by another User)
            var accessible = existing.QuestionBank!.IsPublic || _currentUser.CanManage(existing.QuestionBank.OwnerId);
            if (!accessible)
                return Error.Forbidden(ErrorCodes.Forbidden, "This question belongs to a private Question Bank.");

            // A3 – Question already exists in the Quiz
            if (quiz.QuizQuestions.Any(qq => qq.QuestionId == existing.QuestionId))
                return Error.Validation(ErrorCodes.InvalidRequest, "This question is already part of the quiz.");

            question = existing;
        }
        else if (request.NewQuestion is not null)
        {
            QuestionBank bank;
            if (request.QuestionBankId is int bankId)
            {
                var chosen = await _db.QuestionBanks.FirstOrDefaultAsync(b => b.QuestionBankId == bankId, ct);
                if (chosen is null || chosen.IsDeleted)
                    return Error.NotFound(ErrorCodes.BankNotFound, $"Question Bank {bankId} was not found.");

                if (!_currentUser.CanManage(chosen.OwnerId))
                    return Error.Forbidden(ErrorCodes.NotOwner, "You do not own this Question Bank.");

                bank = chosen;
            }
            else
            {
                // Không chọn bank -> lưu vào bank mặc định (riêng tư) của CHỦ QUIZ (Question bắt buộc thuộc 1 bank).
                bank = await GetOrCreateDefaultBankAsync(quiz.OwnerId, ct);
            }

            if (string.IsNullOrWhiteSpace(request.NewQuestion.Content))
                return Error.Validation(ErrorCodes.InvalidRequest, "Content is required for a new question.");

            // A1 – dùng chung quy tắc với UC15: loại câu hỏi văn bản không được có Answer,
            // SingleChoice/TrueFalse tối đa 1 đáp án đúng.
            var ruleError = SharedRules.ValidateAnswers(request.NewQuestion.QuestionType!.Value, request.NewQuestion.Answers);
            if (ruleError is not null)
                return Error.Validation(ErrorCodes.InvalidRequest, ruleError);

            question = new Question
            {
                QuestionBank = bank, // bank mặc định có thể chưa có Id -> gán navigation, EF lưu cả hai
                Content = request.NewQuestion.Content.Trim(),
                QuestionType = request.NewQuestion.QuestionType.Value,
                Status = ContentStatus.Active,
                CreatedAt = DateTime.UtcNow,
                Answers = request.NewQuestion.Answers.Select(a => new Answer { Content = a.Content.Trim(), IsCorrect = a.IsCorrect }).ToList()
            };

            _db.Questions.Add(question);
        }
        else
        {
            return Error.Validation(ErrorCodes.InvalidRequest, "Provide either questionId (reuse) or newQuestion (create).");
        }

        // Quiz đang Public thì câu mới thêm vào phải đủ nội dung ngay (cùng điều kiện với UC14 Publish),
        // nếu không người làm bài sẽ gặp câu không thể trả lời đúng.
        if (quiz.IsPublished)
        {
            var reason = QuestionTypeRules.ValidateForPlay(question.QuestionType,
                question.Answers.Count, question.Answers.Count(a => a.IsCorrect));
            if (reason is not null)
                return Error.Validation(ErrorCodes.InvalidRequest, $"This quiz is published, so the question must be complete: {reason}");
        }

        var nextOrder = quiz.QuizQuestions.Count == 0 ? 1 : quiz.QuizQuestions.Max(qq => qq.OrderIndex) + 1;
        var link = new QuizQuestion { QuizId = quizId, QuestionId = question.QuestionId, OrderIndex = nextOrder };

        // Transaction: tạo Question + tạo liên kết QuizQuestion phải cùng thành công hoặc cùng rollback,
        // để không bao giờ có Question "mồ côi" khi bước 2 lỗi (SRS UC13 – quan hệ phải nhất quán).
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        // question.QuestionId chưa có giá trị nếu là câu hỏi mới -> SaveChanges lần 1 để DB cấp Id.
        if (question.QuestionId == 0)
        {
            await _db.SaveChangesAsync(ct);
            link.QuestionId = question.QuestionId;
        }

        _db.QuizQuestions.Add(link);
        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return new QuestionSummaryDto(question.QuestionId, link.OrderIndex, question.Content, question.QuestionType.ToString(),
            question.Answers.Count, question.Status.ToString());
    }

    public async Task<Result<List<QuestionSummaryDto>>> ReorderAsync(int quizId, ReorderQuizQuestionsRequest request, CancellationToken ct = default)
    {
        var quiz = await _db.Quizzes
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted, ct);

        if (quiz is null)
            return QuizNotFound(quizId);

        if (!_currentUser.CanManage(quiz.OwnerId))
            return NotOwner();

        var currentIds = quiz.QuizQuestions.Select(qq => qq.QuestionId).ToHashSet();
        // Phải đủ số lượng VÀ không trùng: SetEquals bỏ qua phần tử trùng nên [1,1,2] vẫn "bằng" {1,2}
        if (request.QuestionIds.Count != currentIds.Count
            || request.QuestionIds.Distinct().Count() != request.QuestionIds.Count
            || !request.QuestionIds.ToHashSet().SetEquals(currentIds))
            return Error.Validation(ErrorCodes.InvalidRequest, "The submitted list must contain exactly the quiz's current questions.");

        for (var i = 0; i < request.QuestionIds.Count; i++)
        {
            var link = quiz.QuizQuestions.First(qq => qq.QuestionId == request.QuestionIds[i]);
            link.OrderIndex = i + 1;
        }

        await _db.SaveChangesAsync(ct);
        return quiz.QuizQuestions.OrderBy(qq => qq.OrderIndex).Select(Mapper.ToQuestionSummary).ToList();
    }

    public async Task<Result> RemoveQuestionAsync(int quizId, int questionId, CancellationToken ct = default)
    {
        var quiz = await _db.Quizzes.FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted, ct);
        if (quiz is null)
            return QuizNotFound(quizId);

        if (!_currentUser.CanManage(quiz.OwnerId))
            return NotOwner();

        var link = await _db.QuizQuestions.FirstOrDefaultAsync(qq => qq.QuizId == quizId && qq.QuestionId == questionId, ct);
        if (link is null)
            return Error.NotFound(ErrorCodes.QuestionNotFound, "This question is not part of the quiz.");

        _db.QuizQuestions.Remove(link);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }

    /// <summary>
    /// Bank mặc định (riêng tư) của <paramref name="ownerId"/>: tìm theo tên, chưa có thì tạo.
    /// Được thêm vào DbContext nhưng chưa SaveChanges — lưu cùng Question trong AddQuestionAsync.
    /// </summary>
    private async Task<QuestionBank> GetOrCreateDefaultBankAsync(int ownerId, CancellationToken ct)
    {
        var existing = await _db.QuestionBanks
            .Where(b => b.OwnerId == ownerId && !b.IsDeleted && b.Name == DefaultBankName)
            .OrderBy(b => b.QuestionBankId)
            .FirstOrDefaultAsync(ct);
        if (existing is not null) return existing;

        var bank = new QuestionBank
        {
            OwnerId = ownerId,
            Name = DefaultBankName,
            Description = "Tự động tạo để lưu các câu hỏi được thêm thẳng vào quiz mà không chọn ngân hàng.",
            IsPublic = false,
            CreatedAt = DateTime.UtcNow
        };
        _db.QuestionBanks.Add(bank);
        return bank;
    }

    private static Error QuizNotFound(int quizId) =>
        Error.NotFound(ErrorCodes.QuizNotFound, $"Quiz {quizId} was not found.");

    private static Error NotOwner() =>
        Error.Forbidden(ErrorCodes.NotOwner, "You do not own this quiz.");
}
