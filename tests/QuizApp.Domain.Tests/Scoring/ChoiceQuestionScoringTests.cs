using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;
using QuizApp.Domain.Scoring;
using QuizApp.Domain.Tests.TestData;

namespace QuizApp.Domain.Tests.Scoring;

/// <summary>
/// ChoiceQuestionScoring (qua 2 lớp con SingleChoiceScoring / MultipleChoiceScoring).
/// Quy tắc: câu đúng khi tập lựa chọn TRÙNG KHỚP tập đáp án đúng; bỏ trống = sai.
/// </summary>
public class ChoiceQuestionScoringTests
{
    private readonly SingleChoiceScoring _single = new();
    private readonly MultipleChoiceScoring _multiple = new();

    // Câu nhiều đáp án: 10, 11 đúng; 12 sai
    private static Question MultiQuestion() =>
        QuestionBuilder.MultipleChoice(5).WithCorrectAnswer(10).WithCorrectAnswer(11).WithAnswer(12).Build();

    private static Question SingleQuestion() =>
        QuestionBuilder.SingleChoice(7).WithCorrectAnswer(20).WithAnswer(21).Build();

    [Fact]
    public void SupportedTypes_SingleChoiceScoring_CoversSingleChoiceAndTrueFalse()
    {
        _single.SupportedTypes.Should().BeEquivalentTo(new[] { QuestionType.SingleChoice, QuestionType.TrueFalse });
    }

    [Fact]
    public void SupportedTypes_MultipleChoiceScoring_CoversMultipleChoiceOnly()
    {
        _multiple.SupportedTypes.Should().BeEquivalentTo(new[] { QuestionType.MultipleChoice });
    }

    // ---------- CreateAnswerRows ----------

    [Fact]
    public void CreateAnswerRows_SingleChoiceCorrectPick_ReturnsOneCorrectRow()
    {
        var rows = _single.CreateAnswerRows(SingleQuestion(), new[] { Submitted.Choice(7, 20) });

        rows.Should().ContainSingle();
        rows[0].QuestionId.Should().Be(7);
        rows[0].AnswerId.Should().Be(20);
        rows[0].IsCorrect.Should().BeTrue();
        rows[0].ResponseText.Should().BeNull();
    }

    [Fact]
    public void CreateAnswerRows_SingleChoiceWrongPick_ReturnsOneIncorrectRow()
    {
        var rows = _single.CreateAnswerRows(SingleQuestion(), new[] { Submitted.Choice(7, 21) });

        rows.Should().ContainSingle().Which.IsCorrect.Should().BeFalse();
    }

    [Fact]
    public void CreateAnswerRows_MultipleChoiceAllCorrectPicked_AllRowsCorrect()
    {
        var rows = _multiple.CreateAnswerRows(MultiQuestion(),
            new[] { Submitted.Choice(5, 10), Submitted.Choice(5, 11, index: 1) });

        rows.Should().HaveCount(2);
        rows.Select(r => r.AnswerId).Should().BeEquivalentTo(new int?[] { 10, 11 });
        rows.Should().OnlyContain(r => r.IsCorrect == true && r.QuestionId == 5);
    }

    [Fact]
    public void CreateAnswerRows_MultipleChoicePartialPick_AllRowsIncorrect()
    {
        // Chỉ chọn 1 trong 2 đáp án đúng -> không trùng khớp -> sai
        var rows = _multiple.CreateAnswerRows(MultiQuestion(), new[] { Submitted.Choice(5, 10) });

        rows.Should().ContainSingle().Which.IsCorrect.Should().BeFalse();
    }

    [Fact]
    public void CreateAnswerRows_MultipleChoiceExtraWrongPick_AllRowsIncorrect()
    {
        var rows = _multiple.CreateAnswerRows(MultiQuestion(),
            new[] { Submitted.Choice(5, 10), Submitted.Choice(5, 11), Submitted.Choice(5, 12) });

        rows.Should().HaveCount(3);
        rows.Should().OnlyContain(r => r.IsCorrect == false);
    }

    [Fact]
    public void CreateAnswerRows_NoSelection_ReturnsSingleEmptyIncorrectRow()
    {
        var rows = _multiple.CreateAnswerRows(MultiQuestion(), Array.Empty<SubmittedAnswer>());

        var row = rows.Should().ContainSingle().Subject;
        row.QuestionId.Should().Be(5);
        row.AnswerId.Should().BeNull();
        row.ResponseText.Should().BeNull();
        row.IsCorrect.Should().BeFalse();
    }

    [Fact]
    public void CreateAnswerRows_LinesWithNullAnswerId_TreatedAsNoSelection()
    {
        var rows = _single.CreateAnswerRows(SingleQuestion(), new[] { Submitted.Choice(7, null) });

        rows.Should().ContainSingle().Which.Should().Match<AttemptAnswer>(r => r.AnswerId == null && r.IsCorrect == false);
    }

    [Fact]
    public void CreateAnswerRows_DuplicateSelectedIds_OneRowPerDistinctId()
    {
        var rows = _multiple.CreateAnswerRows(MultiQuestion(),
            new[] { Submitted.Choice(5, 10), Submitted.Choice(5, 10), Submitted.Choice(5, 11) });

        rows.Select(r => r.AnswerId).Should().BeEquivalentTo(new int?[] { 10, 11 });
        rows.Should().OnlyContain(r => r.IsCorrect == true);
    }

    [Fact]
    public void CreateAnswerRows_QuestionWithoutCorrectAnswer_NeverCorrect()
    {
        var question = QuestionBuilder.SingleChoice(1).WithAnswer(1).WithAnswer(2).Build();

        var rows = _single.CreateAnswerRows(question, new[] { Submitted.Choice(1, 1) });

        rows.Should().ContainSingle().Which.IsCorrect.Should().BeFalse();
    }

    // ---------- Evaluate ----------

    [Theory]
    [InlineData(true, QuestionOutcome.Correct)]
    [InlineData(false, QuestionOutcome.Incorrect)]
    public void Evaluate_SingleRow_ReturnsOutcomeFromIsCorrect(bool isCorrect, QuestionOutcome expected)
    {
        var outcome = _single.Evaluate(new[] { new AttemptAnswer { QuestionId = 1, AnswerId = 1, IsCorrect = isCorrect } });

        outcome.Should().Be(expected);
    }

    [Fact]
    public void Evaluate_EmptyRow_ReturnsIncorrect()
    {
        _multiple.Evaluate(new[] { new AttemptAnswer { QuestionId = 1, IsCorrect = false } })
            .Should().Be(QuestionOutcome.Incorrect);
    }

    [Fact]
    public void Evaluate_NoRows_ReturnsIncorrect()
    {
        _multiple.Evaluate(Array.Empty<AttemptAnswer>()).Should().Be(QuestionOutcome.Incorrect);
    }

    // ---------- ValidateLine ----------

    [Fact]
    public void ValidateLine_ValidPick_NoErrors()
    {
        var errors = new List<string>();

        _single.ValidateLine(SingleQuestion(), Submitted.Choice(7, 20), new SubmissionValidationContext(), errors);

        errors.Should().BeEmpty();
    }

    [Fact]
    public void ValidateLine_MissingAnswerId_ReportsRequired()
    {
        var errors = new List<string>();

        _single.ValidateLine(SingleQuestion(), Submitted.Choice(7, null, index: 2), new SubmissionValidationContext(), errors);

        errors.Should().Equal("answers[2]: answerId is required for question type SingleChoice.");
    }

    [Fact]
    public void ValidateLine_ResponseTextOnChoiceQuestion_ReportsNotAllowed()
    {
        var errors = new List<string>();

        _multiple.ValidateLine(MultiQuestion(), new SubmittedAnswer(1, 5, 10, "text"), new SubmissionValidationContext(), errors);

        errors.Should().Equal("answers[1]: responseText is not allowed for question type MultipleChoice.");
    }

    [Fact]
    public void ValidateLine_MultipleChoiceDifferentPicks_NoErrors()
    {
        var context = new SubmissionValidationContext();
        var errors = new List<string>();

        _multiple.ValidateLine(MultiQuestion(), Submitted.Choice(5, 10, 0), context, errors);
        _multiple.ValidateLine(MultiQuestion(), Submitted.Choice(5, 11, 1), context, errors);

        errors.Should().BeEmpty();
    }
}
