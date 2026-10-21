using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Tests.Validation;

public class ReplaceQuestionRequestValidatorTests
{
    private readonly ReplaceQuestionRequestValidator _validator = new();

    private static ReplaceQuestionRequest WithAnswers(int count) => new()
    {
        Content = "Question",
        QuestionType = QuestionType.MultipleChoice,
        Answers = Enumerable.Range(1, count).Select(i => new EditAnswerRequest { AnswerId = i, Content = $"A{i}" }).ToList()
    };

    [Theory]
    [InlineData(0)]
    [InlineData(50)]
    public void Validate_UpTo50Answers_HasNoErrors(int count)
    {
        _validator.TestValidate(WithAnswers(count)).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_MoreThan50Answers_ReportsMaxCount()
    {
        _validator.TestValidate(WithAnswers(51)).ShouldHaveValidationErrorFor(x => x.Answers)
            .WithErrorMessage("A question can have at most 50 answers.");
    }

    [Fact]
    public void Validate_NullAnswers_ReportsRequired()
    {
        var model = WithAnswers(1);
        model.Answers = null!;

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Answers)
            .WithErrorMessage("The Answers field is required.");
    }

    [Fact]
    public void Validate_BlankEditAnswerContent_ReportsErrorWithIndexedKey()
    {
        var model = WithAnswers(2);
        model.Answers[0].Content = " ";

        _validator.TestValidate(model).ShouldHaveValidationErrorFor("Answers[0].Content")
            .WithErrorMessage("Content is required.");
    }

    [Fact]
    public void Validate_MissingQuestionType_ReportsRequired()
    {
        var model = WithAnswers(1);
        model.QuestionType = null;

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.QuestionType)
            .WithErrorMessage("QuestionType is required.");
    }
}
