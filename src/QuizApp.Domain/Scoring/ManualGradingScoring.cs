using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Domain.Scoring;

/// <summary>
/// Câu hỏi trả lời bằng văn bản (FillInTheBlanks, ShortAnswer, LongAnswer): không chấm tự động,
/// câu có trả lời chờ chủ Quiz chấm thủ công (UC09 A3, chấm qua PUT attempt-answers/{id}/grade).
/// </summary>
public sealed class ManualGradingScoring : IQuestionScoringStrategy
{
    public IReadOnlyCollection<QuestionType> SupportedTypes { get; } =
        new[] { QuestionType.FillInTheBlanks, QuestionType.ShortAnswer, QuestionType.LongAnswer };

    public void ValidateLine(Question question, SubmittedAnswer line, SubmissionValidationContext context, ICollection<string> errors)
    {
        var i = line.Index;

        if (line.AnswerId is not null)
            errors.Add($"answers[{i}]: answerId is not allowed for question type {question.QuestionType}.");

        if (!context.AnsweredQuestions.Add(question.QuestionId))
            errors.Add($"answers[{i}]: question {question.QuestionId} accepts only one response.");
        // Không bắt buộc có nội dung — câu hỏi được phép bỏ trống khi nộp (UC09 A1 chỉ cảnh báo, không chặn).
    }

    public IReadOnlyList<AttemptAnswer> CreateAnswerRows(Question question, IReadOnlyList<SubmittedAnswer> lines)
    {
        var text = lines.Select(l => l.ResponseText).FirstOrDefault(t => !string.IsNullOrWhiteSpace(t))?.Trim();
        return new[] { new AttemptAnswer { QuestionId = question.QuestionId, ResponseText = text, IsCorrect = null } };
    }

    public QuestionOutcome Evaluate(IReadOnlyCollection<AttemptAnswer> rows)
    {
        var row = rows.FirstOrDefault(r => r.ResponseText is not null);
        if (row is null) return QuestionOutcome.Unanswered;
        if (row.IsCorrect is null) return QuestionOutcome.PendingManualGrading;
        return row.IsCorrect == true ? QuestionOutcome.Correct : QuestionOutcome.Incorrect;
    }
}
