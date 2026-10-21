using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Domain.Scoring;

/// <summary>
/// Cơ sở chung cho câu hỏi trắc nghiệm (có đáp án định nghĩa sẵn). Câu đúng khi tập lựa chọn
/// TRÙNG KHỚP tập đáp án đúng; bỏ trống = sai. Lớp con chỉ khác nhau ở số lựa chọn được phép.
/// </summary>
public abstract class ChoiceQuestionScoring : IQuestionScoringStrategy
{
    public abstract IReadOnlyCollection<QuestionType> SupportedTypes { get; }

    /// <summary>true nếu được chọn nhiều đáp án trong 1 câu (MultipleChoice).</summary>
    protected abstract bool AllowsMultipleSelections { get; }

    public void ValidateLine(Question question, SubmittedAnswer line, SubmissionValidationContext context, ICollection<string> errors)
    {
        var i = line.Index;

        if (line.AnswerId is null)
            errors.Add($"answers[{i}]: answerId is required for question type {question.QuestionType}.");
        else if (question.Answers.All(a => a.AnswerId != line.AnswerId))
            errors.Add($"answers[{i}]: answer {line.AnswerId} does not belong to question {question.QuestionId}.");

        if (!string.IsNullOrWhiteSpace(line.ResponseText))
            errors.Add($"answers[{i}]: responseText is not allowed for question type {question.QuestionType}.");

        if (!AllowsMultipleSelections && !context.AnsweredQuestions.Add(question.QuestionId))
            errors.Add($"answers[{i}]: question {question.QuestionId} accepts only one selected answer.");

        if (line.AnswerId is not null && !context.SeenSelections.Add((question.QuestionId, line.AnswerId.Value)))
            errors.Add($"answers[{i}]: duplicate answer {line.AnswerId} for question {question.QuestionId}.");
    }

    public IReadOnlyList<AttemptAnswer> CreateAnswerRows(Question question, IReadOnlyList<SubmittedAnswer> lines)
    {
        var selectedIds = lines.Where(l => l.AnswerId is not null).Select(l => l.AnswerId!.Value).ToHashSet();
        var correctIds = question.Answers.Where(a => a.IsCorrect).Select(a => a.AnswerId).ToHashSet();
        var isCorrect = correctIds.Count > 0 && selectedIds.SetEquals(correctIds);

        // Chốt kết quả vào từng dòng -> UC10 đọc lại đúng kết quả lúc nộp, kể cả khi đáp án bị sửa sau đó.
        if (selectedIds.Count == 0)
            return new[] { new AttemptAnswer { QuestionId = question.QuestionId, IsCorrect = false } };

        return selectedIds
            .Select(id => new AttemptAnswer { QuestionId = question.QuestionId, AnswerId = id, IsCorrect = isCorrect })
            .ToList();
    }

    /// <summary>Câu trắc nghiệm luôn được chấm: đúng nếu dòng đã chốt có IsCorrect = true.</summary>
    public QuestionOutcome Evaluate(IReadOnlyCollection<AttemptAnswer> rows) =>
        rows.Any(r => r.IsCorrect == true) ? QuestionOutcome.Correct : QuestionOutcome.Incorrect;
}

/// <summary>Chọn đúng 1 đáp án: SingleChoice, TrueFalse.</summary>
public sealed class SingleChoiceScoring : ChoiceQuestionScoring
{
    public override IReadOnlyCollection<QuestionType> SupportedTypes { get; } =
        new[] { QuestionType.SingleChoice, QuestionType.TrueFalse };

    protected override bool AllowsMultipleSelections => false;
}

/// <summary>Chọn một hoặc nhiều đáp án: MultipleChoice.</summary>
public sealed class MultipleChoiceScoring : ChoiceQuestionScoring
{
    public override IReadOnlyCollection<QuestionType> SupportedTypes { get; } = new[] { QuestionType.MultipleChoice };

    protected override bool AllowsMultipleSelections => true;
}
