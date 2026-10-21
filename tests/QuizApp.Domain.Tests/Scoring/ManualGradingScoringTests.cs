using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;
using QuizApp.Domain.Scoring;
using QuizApp.Domain.Tests.TestData;

namespace QuizApp.Domain.Tests.Scoring;

public class ManualGradingScoringTests
{
    private readonly ManualGradingScoring _sut = new();
    private readonly Question _question = QuestionBuilder.ShortAnswer(3).Build();

    [Fact]
    public void SupportedTypes_CoversAllTextQuestionTypes()
    {
        _sut.SupportedTypes.Should().BeEquivalentTo(new[]
        {
            QuestionType.FillInTheBlanks, QuestionType.ShortAnswer, QuestionType.LongAnswer
        });
    }

    // ---------- CreateAnswerRows ----------

    [Fact]
    public void CreateAnswerRows_TextAnswer_ReturnsSingleTrimmedPendingRow()
    {
        var rows = _sut.CreateAnswerRows(_question, new[] { Submitted.Text(3, "  Hà Nội  ") });

        var row = rows.Should().ContainSingle().Subject;
        row.QuestionId.Should().Be(3);
        row.ResponseText.Should().Be("Hà Nội");
        row.AnswerId.Should().BeNull();
        row.IsCorrect.Should().BeNull();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void CreateAnswerRows_BlankText_ReturnsRowWithNullResponseText(string? text)
    {
        var rows = _sut.CreateAnswerRows(_question, new[] { Submitted.Text(3, text) });

        rows.Should().ContainSingle().Which.ResponseText.Should().BeNull();
    }

    [Fact]
    public void CreateAnswerRows_Unanswered_ReturnsSingleEmptyRow()
    {
        var rows = _sut.CreateAnswerRows(_question, Array.Empty<SubmittedAnswer>());

        var row = rows.Should().ContainSingle().Subject;
        row.QuestionId.Should().Be(3);
        row.ResponseText.Should().BeNull();
        row.IsCorrect.Should().BeNull();
    }

    [Fact]
    public void CreateAnswerRows_FirstLineBlank_UsesFirstNonBlankText()
    {
        var rows = _sut.CreateAnswerRows(_question, new[] { Submitted.Text(3, " "), Submitted.Text(3, "answer") });

        rows.Should().ContainSingle().Which.ResponseText.Should().Be("answer");
    }

    // ---------- Evaluate ----------

    [Fact]
    public void Evaluate_NoResponseText_ReturnsUnanswered()
    {
        _sut.Evaluate(new[] { new AttemptAnswer { QuestionId = 3 } }).Should().Be(QuestionOutcome.Unanswered);
    }

    [Theory]
    [InlineData(null, QuestionOutcome.PendingManualGrading)]
    [InlineData(true, QuestionOutcome.Correct)]
    [InlineData(false, QuestionOutcome.Incorrect)]
    public void Evaluate_WithResponseText_ReturnsOutcomeFromGrade(bool? isCorrect, QuestionOutcome expected)
    {
        var rows = new[] { new AttemptAnswer { QuestionId = 3, ResponseText = "x", IsCorrect = isCorrect } };

        _sut.Evaluate(rows).Should().Be(expected);
    }

    // ---------- ValidateLine ----------

    [Fact]
    public void ValidateLine_TextOnly_NoErrors()
    {
        var errors = new List<string>();

        _sut.ValidateLine(_question, Submitted.Text(3, "abc"), new SubmissionValidationContext(), errors);

        errors.Should().BeEmpty();
    }

    [Fact]
    public void ValidateLine_EmptyText_IsAllowed()
    {
        // Được phép bỏ trống khi nộp (UC09 A1 chỉ cảnh báo)
        var errors = new List<string>();

        _sut.ValidateLine(_question, Submitted.Text(3, null), new SubmissionValidationContext(), errors);

        errors.Should().BeEmpty();
    }

    [Fact]
    public void ValidateLine_AnswerIdOnTextQuestion_ReportsNotAllowed()
    {
        var errors = new List<string>();

        _sut.ValidateLine(_question, new SubmittedAnswer(4, 3, 99, null), new SubmissionValidationContext(), errors);

        errors.Should().Equal("answers[4]: answerId is not allowed for question type ShortAnswer.");
    }

    [Fact]
    public void ValidateLine_SecondResponseForSameQuestion_ReportsOnlyOneResponse()
    {
        var context = new SubmissionValidationContext();
        var errors = new List<string>();

        _sut.ValidateLine(_question, Submitted.Text(3, "a", 0), context, errors);
        _sut.ValidateLine(_question, Submitted.Text(3, "b", 1), context, errors);

        errors.Should().Equal("answers[1]: question 3 accepts only one response.");
    }
}
