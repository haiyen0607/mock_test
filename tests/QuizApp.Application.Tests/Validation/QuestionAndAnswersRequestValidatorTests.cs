using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Tests.Validation;

/// <summary>Bao gồm các rule của QuestionRequestValidator (Include) + danh sách Answers.</summary>
public class QuestionAndAnswersRequestValidatorTests
{
    private readonly QuestionAndAnswersRequestValidator _validator = new();

    private static QuestionAndAnswersRequest Valid() => new()
    {
        Content = "2 + 2 = ?",
        QuestionType = QuestionType.SingleChoice,
        Answers = new List<AnswerRequest> { new() { Content = "4", IsCorrect = true }, new() { Content = "5" } }
    };

    [Fact]
    public void Validate_ValidRequest_HasNoErrors()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_BlankContent_ReportsRequired()
    {
        var model = Valid();
        model.Content = " ";

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Content).WithErrorMessage("Content is required.");
    }

    [Fact]
    public void Validate_ContentTooLong_ReportsMaxLength()
    {
        var model = Valid();
        model.Content = new string('c', 4001);

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Content)
            .WithErrorMessage("The field Content must be a string with a maximum length of 4000.");
    }

    [Fact]
    public void Validate_MissingQuestionType_ReportsRequired()
    {
        var model = Valid();
        model.QuestionType = null;

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.QuestionType)
            .WithErrorMessage("QuestionType is required.");
    }

    [Fact]
    public void Validate_UndefinedQuestionType_ReportsNotSupported()
    {
        var model = Valid();
        model.QuestionType = (QuestionType)99;

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.QuestionType)
            .WithErrorMessage("QuestionType is not supported.");
    }

    [Fact]
    public void Validate_NullAnswers_ReportsRequired()
    {
        var model = Valid();
        model.Answers = null!;

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Answers)
            .WithErrorMessage("The Answers field is required.");
    }

    [Fact]
    public void Validate_EmptyAnswers_IsValid()
    {
        var model = Valid();
        model.Answers = new List<AnswerRequest>();

        _validator.TestValidate(model).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_BlankAnswerContent_ReportsErrorWithIndexedKey()
    {
        var model = Valid();
        model.Answers[1].Content = "";

        var result = _validator.TestValidate(model);

        result.ShouldHaveValidationErrorFor("Answers[1].Content").WithErrorMessage("Content is required.");
        result.ShouldNotHaveValidationErrorFor("Answers[0].Content");
    }

    [Fact]
    public void Validate_AnswerContentTooLong_ReportsMaxLength()
    {
        var model = Valid();
        model.Answers[0].Content = new string('a', 2001);

        _validator.TestValidate(model).ShouldHaveValidationErrorFor("Answers[0].Content")
            .WithErrorMessage("The field Content must be a string with a maximum length of 2000.");
    }
}
