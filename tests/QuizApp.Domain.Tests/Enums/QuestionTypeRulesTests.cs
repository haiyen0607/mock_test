using QuizApp.Domain.Enums;

namespace QuizApp.Domain.Tests.Enums;

public class QuestionTypeRulesTests
{
    [Theory]
    [InlineData(QuestionType.MultipleChoice, true)]
    [InlineData(QuestionType.SingleChoice, true)]
    [InlineData(QuestionType.TrueFalse, true)]
    [InlineData(QuestionType.FillInTheBlanks, false)]
    [InlineData(QuestionType.ShortAnswer, false)]
    [InlineData(QuestionType.LongAnswer, false)]
    public void UsesPredefinedAnswers_ReturnsExpected(QuestionType type, bool expected)
    {
        QuestionTypeRules.UsesPredefinedAnswers(type).Should().Be(expected);
    }

    [Theory]
    [InlineData(QuestionType.MultipleChoice, false)]
    [InlineData(QuestionType.SingleChoice, true)]
    [InlineData(QuestionType.TrueFalse, true)]
    [InlineData(QuestionType.FillInTheBlanks, false)]
    [InlineData(QuestionType.ShortAnswer, false)]
    [InlineData(QuestionType.LongAnswer, false)]
    public void AllowsOneSelectionOnly_ReturnsExpected(QuestionType type, bool expected)
    {
        QuestionTypeRules.AllowsOneSelectionOnly(type).Should().Be(expected);
    }

    [Theory]
    [InlineData(QuestionType.MultipleChoice, 2, 1)]
    [InlineData(QuestionType.MultipleChoice, 4, 3)]
    [InlineData(QuestionType.SingleChoice, 4, 1)]
    [InlineData(QuestionType.TrueFalse, 2, 1)]
    [InlineData(QuestionType.FillInTheBlanks, 0, 0)]
    [InlineData(QuestionType.ShortAnswer, 0, 0)]
    [InlineData(QuestionType.LongAnswer, 0, 0)]
    public void ValidateForPlay_ValidQuestion_ReturnsNull(QuestionType type, int answerCount, int correctCount)
    {
        QuestionTypeRules.ValidateForPlay(type, answerCount, correctCount).Should().BeNull();
    }

    [Theory]
    [InlineData(QuestionType.MultipleChoice, 0, 0)]
    [InlineData(QuestionType.SingleChoice, 1, 1)]
    [InlineData(QuestionType.TrueFalse, 1, 0)]
    public void ValidateForPlay_LessThanTwoAnswers_ReturnsNeedsTwoAnswers(QuestionType type, int answerCount, int correctCount)
    {
        QuestionTypeRules.ValidateForPlay(type, answerCount, correctCount).Should().Be("needs at least 2 answers.");
    }

    [Theory]
    [InlineData(QuestionType.MultipleChoice)]
    [InlineData(QuestionType.SingleChoice)]
    [InlineData(QuestionType.TrueFalse)]
    public void ValidateForPlay_NoCorrectAnswer_ReturnsHasNoCorrectAnswer(QuestionType type)
    {
        QuestionTypeRules.ValidateForPlay(type, 3, 0).Should().Be("has no correct answer.");
    }

    [Theory]
    [InlineData(QuestionType.SingleChoice)]
    [InlineData(QuestionType.TrueFalse)]
    public void ValidateForPlay_OneSelectionTypeWithSeveralCorrect_ReturnsExactlyOne(QuestionType type)
    {
        QuestionTypeRules.ValidateForPlay(type, 3, 2).Should().Be($"must have exactly 1 correct answer (type {type}).");
    }

    [Theory]
    [InlineData(QuestionType.FillInTheBlanks)]
    [InlineData(QuestionType.ShortAnswer)]
    [InlineData(QuestionType.LongAnswer)]
    public void ValidateForPlay_TextTypeWithAnswers_ReturnsMustNotHaveAnswers(QuestionType type)
    {
        QuestionTypeRules.ValidateForPlay(type, 1, 0).Should().Be($"must not have predefined answers (type {type}).");
    }
}
