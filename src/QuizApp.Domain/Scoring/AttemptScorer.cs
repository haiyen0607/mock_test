using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Domain.Scoring;

/// <summary>
/// Điều phối chấm điểm 1 lượt làm bài: chọn strategy theo loại câu hỏi và tổng hợp điểm.
/// Không biết chi tiết từng loại câu hỏi — phần đó nằm trong các <see cref="IQuestionScoringStrategy"/>.
/// </summary>
public sealed class AttemptScorer
{
    private readonly Dictionary<QuestionType, IQuestionScoringStrategy> _strategies;

    public AttemptScorer(IEnumerable<IQuestionScoringStrategy> strategies)
    {
        _strategies = new Dictionary<QuestionType, IQuestionScoringStrategy>();
        foreach (var strategy in strategies)
            foreach (var type in strategy.SupportedTypes)
                _strategies.Add(type, strategy); // trùng loại câu hỏi -> lỗi cấu hình, báo ngay khi khởi tạo

        var missing = Enum.GetValues<QuestionType>().Where(t => !_strategies.ContainsKey(t)).ToList();
        if (missing.Count > 0)
            throw new InvalidOperationException($"No scoring strategy registered for: {string.Join(", ", missing)}.");
    }

    /// <summary>Bộ strategy mặc định của ứng dụng.</summary>
    public static AttemptScorer CreateDefault() =>
        new(new IQuestionScoringStrategy[] { new SingleChoiceScoring(), new MultipleChoiceScoring(), new ManualGradingScoring() });

    public IQuestionScoringStrategy StrategyFor(QuestionType type) => _strategies[type];

    /// <summary>
    /// UC09 A3 – kiểm tra bài nộp khớp cấu trúc Quiz. <paramref name="activeQuestions"/>: chỉ câu còn Active
    /// (câu bị Admin gỡ không còn trong đề – UC20 A2). Trả về danh sách lỗi (rỗng = hợp lệ).
    /// </summary>
    public List<string> Validate(IReadOnlyCollection<Question> activeQuestions, IReadOnlyList<SubmittedAnswer> answers)
    {
        var errors = new List<string>();
        var questionsById = activeQuestions.ToDictionary(q => q.QuestionId);
        var context = new SubmissionValidationContext();

        foreach (var line in answers)
        {
            if (!questionsById.TryGetValue(line.QuestionId, out var question))
            {
                errors.Add($"answers[{line.Index}]: question {line.QuestionId} does not belong to this quiz.");
                continue;
            }

            StrategyFor(question.QuestionType).ValidateLine(question, line, context, errors);
        }

        return errors;
    }

    /// <summary>Chốt kết quả lúc nộp: mỗi câu hỏi Active có ít nhất 1 dòng AttemptAnswer.</summary>
    public List<AttemptAnswer> CreateAnswerRows(IReadOnlyCollection<Question> activeQuestions, IReadOnlyList<SubmittedAnswer> answers)
    {
        var linesByQuestion = answers.ToLookup(a => a.QuestionId);
        return activeQuestions
            .SelectMany(q => StrategyFor(q.QuestionType).CreateAnswerRows(q, linesByQuestion[q.QuestionId].ToList()))
            .ToList();
    }

    /// <summary>
    /// UC09 / A5 – tính điểm từ các dòng AttemptAnswer ĐÃ CHỐT (dùng chung cho Submit và chấm tự luận):
    /// Score = round(CorrectCount * 100 / MaxScore), null khi MaxScore = 0.
    /// </summary>
    /// <param name="attempt">Lượt làm bài, đã có Answers.</param>
    /// <param name="questionType">Tra loại câu hỏi theo QuestionId.</param>
    public void Score(QuizAttempt attempt, Func<int, QuestionType> questionType)
    {
        int correct = 0, max = 0, pending = 0;

        foreach (var group in attempt.Answers.GroupBy(a => a.QuestionId))
        {
            switch (StrategyFor(questionType(group.Key)).Evaluate(group.ToList()))
            {
                case QuestionOutcome.Correct:
                    max++;
                    correct++;
                    break;
                case QuestionOutcome.Incorrect:
                    max++;
                    break;
                case QuestionOutcome.PendingManualGrading:
                    pending++;
                    break;
                case QuestionOutcome.Unanswered:
                    break;
            }
        }

        attempt.CorrectCount = correct;
        attempt.MaxScore = max;
        attempt.PendingCount = pending;
        attempt.Score = max > 0 ? (int)Math.Round(correct * 100.0 / max) : null;
    }
}
