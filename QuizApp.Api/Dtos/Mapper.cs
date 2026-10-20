// Cầu nối giữa Entity (dùng để làm việc với DB) và DTO (dùng để giao tiếp API <-> Client).
using System.Linq.Expressions;
using QuizApp.Api.Entities;
using QuizApp.Api.Enums;

namespace QuizApp.Api.Dtos;

public static class Mapper
{
    public static UserDto ToUser(User user) =>
        new(user.UserId, user.Username, user.Email, user.Role.ToString(), user.Status.ToString(), user.CreatedAt);

    public static QuestionBankDto ToQuestionBank(QuestionBank bank) =>
        new(bank.QuestionBankId, bank.Name, bank.Description, bank.IsPublic,
            bank.Questions.Count(q => q.Status != ContentStatus.Deleted), bank.CreatedAt);

    public static AnswerDto ToAnswer(Answer answer) =>
        new(answer.AnswerId, answer.QuestionId, answer.Content, answer.IsCorrect);

    public static QuestionDto ToQuestion(Question question) =>
        new(question.QuestionId, question.QuestionBankId, question.Content, question.QuestionType.ToString(),
            question.Status.ToString(), question.Answers.OrderBy(a => a.AnswerId).Select(ToAnswer).ToList());

    public static PublicQuestionDto ToPublicQuestion(Question question) =>
        new(question.QuestionId, question.QuestionBankId, question.QuestionBank?.Name ?? string.Empty,
            question.Content, question.QuestionType.ToString(), ToOptions(question));

    /// <summary>Danh sách lựa chọn KHÔNG có IsCorrect (dùng khi làm bài và khi xem câu hỏi công khai).</summary>
    public static List<AnswerOptionDto> ToOptions(Question question) =>
        QuestionTypeRules.UsesPredefinedAnswers(question.QuestionType)
            ? question.Answers.OrderBy(a => a.AnswerId).Select(a => new AnswerOptionDto(a.AnswerId, a.Content)).ToList()
            : new List<AnswerOptionDto>();

    /// <summary>
    /// QuestionCount chỉ đếm câu còn Active (câu bị Admin gỡ không làm được – UC20 A2).
    /// Yêu cầu đã Include(QuizQuestions).ThenInclude(Question) và Include(Owner).
    /// </summary>
    public static QuizListItemDto ToListItem(Quiz quiz) =>
        new(quiz.QuizId, quiz.Title, quiz.Description, quiz.Duration, quiz.IsPublished, quiz.Status.ToString(),
            quiz.QuizQuestions.Count(qq => qq.Question != null && qq.Question.Status == ContentStatus.Active),
            quiz.Owner?.Username ?? string.Empty, quiz.CreatedAt);

    /// <summary>Cùng nội dung với <see cref="ToListItem"/> nhưng dịch sang SQL (đếm câu bằng sub-query, không Include) – A4.</summary>
    public static readonly Expression<Func<Quiz, QuizListItemDto>> ListItemProjection = quiz =>
        new QuizListItemDto(quiz.QuizId, quiz.Title, quiz.Description, quiz.Duration, quiz.IsPublished, quiz.Status.ToString(),
            quiz.QuizQuestions.Count(qq => qq.Question!.Status == ContentStatus.Active),
            quiz.Owner!.Username, quiz.CreatedAt);

    public static QuestionSummaryDto ToQuestionSummary(QuizQuestion qq) => ToQuestionSummary(qq, includeAnswers: false);

    /// <param name="qq">Liên kết Quiz–Question (đã Include Question và Answers).</param>
    /// <param name="includeAnswers">true chỉ khi người xem là chủ sở hữu/Admin — kèm đáp án và IsCorrect.</param>
    /// <param name="canEdit">Người xem có quyền sửa Question này (quản lý bank chứa nó).</param>
    public static QuestionSummaryDto ToQuestionSummary(QuizQuestion qq, bool includeAnswers, bool canEdit = false) =>
        new(qq.Question!.QuestionId, qq.OrderIndex, qq.Question.Content, qq.Question.QuestionType.ToString(),
            qq.Question.Answers.Count, qq.Question.Status.ToString(),
            includeAnswers ? qq.Question.Answers.OrderBy(a => a.AnswerId).Select(ToAnswer).ToList() : null,
            canEdit);

    /// <param name="quiz">Quiz đã Include Owner và QuizQuestions → Question → Answers (và → QuestionBank nếu dùng canManageBank).</param>
    /// <param name="includeRemoved">
    /// true cho chủ sở hữu/Admin (thấy cả câu bị gỡ để biết mà xử lý, và thấy đáp án đúng);
    /// false cho Guest/User khác — câu bị Admin gỡ không được hiển thị (UC20 A2), không lộ đáp án.
    /// </param>
    /// <param name="canManageBank">
    /// Kiểm tra người xem có quản lý được bank (theo OwnerId của bank) -> đặt CanEdit cho từng câu.
    /// Câu tái sử dụng từ bank công khai của người khác thì không sửa được.
    /// </param>
    public static QuizDetailDto ToDetail(Quiz quiz, bool includeRemoved = true, Func<int, bool>? canManageBank = null) =>
        new(quiz.QuizId, quiz.Title, quiz.Description, quiz.Duration, quiz.IsPublished, quiz.Status.ToString(),
            quiz.Owner?.Username ?? string.Empty,
            (includeRemoved ? quiz.QuizQuestions.OrderBy(qq => qq.OrderIndex).ToList() : quiz.ActiveQuestions())
                .Select(qq => ToQuestionSummary(qq, includeAnswers: includeRemoved,
                    canEdit: includeRemoved && canManageBank is not null && qq.Question!.QuestionBank is { } bank
                             && qq.Question.Status != ContentStatus.Deleted && canManageBank(bank.OwnerId)))
                .ToList());

    /// <summary>UC07/UC08 – nội dung Quiz khi làm bài, KHÔNG lộ IsCorrect.</summary>
    public static AttemptQuestionDto ToAttemptQuestion(Question question) =>
        new(question.QuestionId, question.Content, question.QuestionType.ToString(), ToOptions(question));

    /// <summary>Duration/ExpiresAt lấy theo thời lượng đã chốt lúc bắt đầu (QuizAttempt.DurationMinutes).</summary>
    public static AttemptContentDto ToAttemptContent(QuizAttempt attempt, Quiz quiz) =>
        new(attempt.AttemptId, quiz.QuizId, quiz.Title, attempt.DurationMinutes,
            attempt.StartedAt, attempt.StartedAt.AddMinutes(attempt.DurationMinutes),
            quiz.ActiveQuestions().Select(qq => ToAttemptQuestion(qq.Question!)).ToList()); // bỏ câu bị Admin gỡ (UC20 A2)

    public static AdminQuestionDto ToAdminQuestion(Question question) =>
        new(question.QuestionId, question.QuestionBankId, question.QuestionBank?.Name ?? string.Empty,
            question.QuestionBank?.IsPublic ?? false, question.QuestionBank?.Owner?.Username ?? string.Empty,
            question.Content, question.QuestionType.ToString(), question.Status.ToString(),
            question.QuizQuestions.Count, question.CreatedAt,
            question.Answers.OrderBy(a => a.AnswerId).Select(ToAnswer).ToList());
}
