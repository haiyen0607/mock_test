using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;
using QuizApp.Domain.Scoring;
using QuizApp.Domain.Tests.TestData;

namespace QuizApp.Domain.Tests.Scoring;

public class AttemptScorerTests
{
    private readonly AttemptScorer _sut = AttemptScorer.CreateDefault();

    // Đề mẫu: Q7 SingleChoice (20 đúng, 21 sai), Q5 MultipleChoice (10, 11 đúng; 12 sai), Q3 ShortAnswer
    private static readonly Question Single = QuestionBuilder.SingleChoice(7).WithCorrectAnswer(20).WithAnswer(21).Build();
    private static readonly Question Multi = QuestionBuilder.MultipleChoice(5).WithCorrectAnswer(10).WithCorrectAnswer(11).WithAnswer(12).Build();
    private static readonly Question Text = QuestionBuilder.ShortAnswer(3).Build();
    private static readonly Question[] Quiz = { Single, Multi, Text };

    // ---------- Constructor / CreateDefault ----------

    [Fact]
    public void CreateDefault_RegistersStrategyForEveryQuestionType()
    {
        foreach (var type in Enum.GetValues<QuestionType>())
            _sut.StrategyFor(type).Should().NotBeNull();
    }

    [Theory]
    [InlineData(QuestionType.SingleChoice, typeof(SingleChoiceScoring))]
    [InlineData(QuestionType.TrueFalse, typeof(SingleChoiceScoring))]
    [InlineData(QuestionType.MultipleChoice, typeof(MultipleChoiceScoring))]
    [InlineData(QuestionType.FillInTheBlanks, typeof(ManualGradingScoring))]
    [InlineData(QuestionType.ShortAnswer, typeof(ManualGradingScoring))]
    [InlineData(QuestionType.LongAnswer, typeof(ManualGradingScoring))]
    public void StrategyFor_DefaultScorer_ReturnsExpectedStrategy(QuestionType type, Type expected)
    {
        _sut.StrategyFor(type).Should().BeOfType(expected);
    }

    [Fact]
    public void Constructor_MissingStrategyForSomeTypes_ThrowsInvalidOperationException()
    {
        var act = () => new AttemptScorer(new IQuestionScoringStrategy[] { new SingleChoiceScoring(), new MultipleChoiceScoring() });

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("No scoring strategy registered for: FillInTheBlanks, ShortAnswer, LongAnswer.");
    }

    [Fact]
    public void Constructor_NoStrategies_Throws()
    {
        var act = () => new AttemptScorer(Array.Empty<IQuestionScoringStrategy>());

        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Constructor_DuplicateRegistrationForSameType_Throws()
    {
        var act = () => new AttemptScorer(new IQuestionScoringStrategy[]
        {
            new SingleChoiceScoring(), new MultipleChoiceScoring(), new ManualGradingScoring(), new SingleChoiceScoring()
        });

        act.Should().Throw<ArgumentException>();
    }

    // ---------- Validate ----------

    [Fact]
    public void Validate_ValidSubmission_ReturnsNoErrors()
    {
        var answers = new[]
        {
            new SubmittedAnswer(0, 7, 20, null),
            new SubmittedAnswer(1, 5, 10, null),
            new SubmittedAnswer(2, 5, 11, null),
            new SubmittedAnswer(3, 3, null, "text")
        };

        _sut.Validate(Quiz, answers).Should().BeEmpty();
    }

    [Fact]
    public void Validate_EmptySubmission_ReturnsNoErrors()
    {
        _sut.Validate(Quiz, Array.Empty<SubmittedAnswer>()).Should().BeEmpty();
    }

    [Fact]
    public void Validate_QuestionNotInQuiz_ReportsDoesNotBelong()
    {
        var errors = _sut.Validate(Quiz, new[] { new SubmittedAnswer(0, 99, 1, null) });

        errors.Should().Equal("answers[0]: question 99 does not belong to this quiz.");
    }

    [Fact]
    public void Validate_ChoiceWithoutAnswerId_ReportsAnswerIdRequired()
    {
        var errors = _sut.Validate(Quiz, new[] { new SubmittedAnswer(0, 5, null, null) });

        errors.Should().Equal("answers[0]: answerId is required for question type MultipleChoice.");
    }

    [Fact]
    public void Validate_AnswerOfAnotherQuestion_ReportsAnswerDoesNotBelong()
    {
        var errors = _sut.Validate(Quiz, new[] { new SubmittedAnswer(0, 7, 10, null) });

        errors.Should().Equal("answers[0]: answer 10 does not belong to question 7.");
    }

    [Fact]
    public void Validate_ResponseTextOnChoiceQuestion_ReportsNotAllowed()
    {
        var errors = _sut.Validate(Quiz, new[] { new SubmittedAnswer(0, 7, 20, "hello") });

        errors.Should().Equal("answers[0]: responseText is not allowed for question type SingleChoice.");
    }

    [Fact]
    public void Validate_SingleChoiceAnsweredTwice_ReportsOnlyOneSelectedAnswer()
    {
        var errors = _sut.Validate(Quiz, new[] { new SubmittedAnswer(0, 7, 20, null), new SubmittedAnswer(1, 7, 21, null) });

        errors.Should().Equal("answers[1]: question 7 accepts only one selected answer.");
    }

    [Fact]
    public void Validate_SameAnswerSelectedTwice_ReportsDuplicate()
    {
        var errors = _sut.Validate(Quiz, new[] { new SubmittedAnswer(0, 5, 10, null), new SubmittedAnswer(1, 5, 10, null) });

        errors.Should().Equal("answers[1]: duplicate answer 10 for question 5.");
    }

    [Fact]
    public void Validate_TextQuestionAnsweredTwice_ReportsOnlyOneResponse()
    {
        var errors = _sut.Validate(Quiz, new[] { new SubmittedAnswer(0, 3, null, "a"), new SubmittedAnswer(1, 3, null, "b") });

        errors.Should().Equal("answers[1]: question 3 accepts only one response.");
    }

    [Fact]
    public void Validate_AnswerIdOnTextQuestion_ReportsNotAllowed()
    {
        var errors = _sut.Validate(Quiz, new[] { new SubmittedAnswer(2, 3, 20, null) });

        errors.Should().Equal("answers[2]: answerId is not allowed for question type ShortAnswer.");
    }

    [Fact]
    public void Validate_SeveralInvalidLines_CollectsAllErrorsInOrder()
    {
        var errors = _sut.Validate(Quiz, new[]
        {
            new SubmittedAnswer(0, 99, null, null),
            new SubmittedAnswer(1, 7, null, "x")
        });

        errors.Should().Equal(
            "answers[0]: question 99 does not belong to this quiz.",
            "answers[1]: answerId is required for question type SingleChoice.",
            "answers[1]: responseText is not allowed for question type SingleChoice.");
    }

    // ---------- CreateAnswerRows ----------

    [Fact]
    public void CreateAnswerRows_EveryActiveQuestionGetsAtLeastOneRow()
    {
        var rows = _sut.CreateAnswerRows(Quiz, new[]
        {
            new SubmittedAnswer(0, 5, 10, null),
            new SubmittedAnswer(1, 5, 11, null)
        });

        rows.Should().HaveCount(4); // Q7 bỏ trống (1) + Q5 hai lựa chọn (2) + Q3 bỏ trống (1)
        rows.Where(r => r.QuestionId == 7).Should().ContainSingle().Which.IsCorrect.Should().BeFalse();
        rows.Where(r => r.QuestionId == 5).Should().HaveCount(2).And.OnlyContain(r => r.IsCorrect == true);
        rows.Where(r => r.QuestionId == 3).Should().ContainSingle().Which.ResponseText.Should().BeNull();
    }

    [Fact]
    public void CreateAnswerRows_IgnoresLinesForQuestionsNotInQuiz()
    {
        var rows = _sut.CreateAnswerRows(new[] { Single }, new[] { new SubmittedAnswer(0, 99, 1, null) });

        rows.Should().ContainSingle().Which.QuestionId.Should().Be(7);
    }

    // ---------- Score ----------

    private static QuestionType TypeOf(int questionId) => Quiz.Single(q => q.QuestionId == questionId).QuestionType;

    private static AttemptAnswer Row(int questionId, bool? isCorrect, int? answerId = null, string? text = null) =>
        new() { QuestionId = questionId, AnswerId = answerId, ResponseText = text, IsCorrect = isCorrect };

    [Fact]
    public void Score_AllChoiceCorrect_Returns100()
    {
        var attempt = new QuizAttempt { Answers = { Row(7, true, 20), Row(5, true, 10), Row(5, true, 11) } };

        _sut.Score(attempt, TypeOf);

        attempt.Score.Should().Be(100);
        attempt.CorrectCount.Should().Be(2);
        attempt.MaxScore.Should().Be(2);
        attempt.PendingCount.Should().Be(0);
    }

    [Fact]
    public void Score_TextAnswerPending_ExcludedFromMaxAndCountedAsPending()
    {
        var attempt = new QuizAttempt { Answers = { Row(7, true, 20), Row(5, false, 12), Row(3, null, text: "x") } };

        _sut.Score(attempt, TypeOf);

        attempt.Score.Should().Be(50);
        attempt.CorrectCount.Should().Be(1);
        attempt.MaxScore.Should().Be(2);
        attempt.PendingCount.Should().Be(1);
    }

    [Theory]
    [InlineData(true, 3, 3, 100)]
    [InlineData(false, 2, 3, 67)]
    public void Score_ManuallyGradedTextAnswer_CountsTowardScore(bool graded, int expectedCorrect, int expectedMax, int expectedScore)
    {
        // Q7 đúng, Q5 đúng, Q3 tự luận đã chấm (đúng/sai)
        var attempt = new QuizAttempt { Answers = { Row(7, true, 20), Row(5, true, 10), Row(5, true, 11), Row(3, graded, text: "x") } };

        _sut.Score(attempt, TypeOf);

        attempt.CorrectCount.Should().Be(expectedCorrect);
        attempt.MaxScore.Should().Be(expectedMax);
        attempt.PendingCount.Should().Be(0);
        attempt.Score.Should().Be(expectedScore);
    }

    [Fact]
    public void Score_UnansweredTextQuestion_NotCountedAnywhere()
    {
        var attempt = new QuizAttempt { Answers = { Row(7, false), Row(3, null) } };

        _sut.Score(attempt, TypeOf);

        attempt.Score.Should().Be(0);
        attempt.CorrectCount.Should().Be(0);
        attempt.MaxScore.Should().Be(1);
        attempt.PendingCount.Should().Be(0);
    }

    [Fact]
    public void Score_NothingGraded_ScoreIsNull()
    {
        var attempt = new QuizAttempt { Answers = { Row(3, null, text: "pending") } };

        _sut.Score(attempt, TypeOf);

        attempt.Score.Should().BeNull();
        attempt.MaxScore.Should().Be(0);
        attempt.CorrectCount.Should().Be(0);
        attempt.PendingCount.Should().Be(1);
    }

    [Fact]
    public void Score_NoAnswerRows_ScoreIsNull()
    {
        var attempt = new QuizAttempt();

        _sut.Score(attempt, TypeOf);

        attempt.Score.Should().BeNull();
        attempt.MaxScore.Should().Be(0);
    }

    [Theory]
    [InlineData(1, 3, 33)]   // 33.33 -> 33
    [InlineData(2, 3, 67)]   // 66.67 -> 67
    [InlineData(0, 4, 0)]
    [InlineData(4, 4, 100)]
    [InlineData(5, 7, 71)]   // 71.43 -> 71
    public void Score_RoundsPercentageToNearestInteger(int correct, int total, int expected)
    {
        // total câu SingleChoice độc lập, 'correct' câu đúng
        var attempt = new QuizAttempt();
        for (var i = 0; i < total; i++)
            attempt.Answers.Add(Row(100 + i, i < correct, answerId: 1));

        _sut.Score(attempt, _ => QuestionType.SingleChoice);

        attempt.Score.Should().Be(expected);
        attempt.CorrectCount.Should().Be(correct);
        attempt.MaxScore.Should().Be(total);
    }

    [Fact]
    public void Score_RecalculatesAndOverwritesPreviousValues()
    {
        var attempt = new QuizAttempt { Score = 99, CorrectCount = 9, MaxScore = 9, PendingCount = 9, Answers = { Row(7, false, 21) } };

        _sut.Score(attempt, TypeOf);

        attempt.Score.Should().Be(0);
        attempt.CorrectCount.Should().Be(0);
        attempt.MaxScore.Should().Be(1);
        attempt.PendingCount.Should().Be(0);
    }
}
