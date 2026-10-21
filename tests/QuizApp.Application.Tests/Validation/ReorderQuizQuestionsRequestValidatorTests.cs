using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;

namespace QuizApp.Application.Tests.Validation;

public class ReorderQuizQuestionsRequestValidatorTests
{
    private readonly ReorderQuizQuestionsRequestValidator _validator = new();

    private static ReorderQuizQuestionsRequest WithIds(int count) =>
        new() { QuestionIds = Enumerable.Range(1, count).ToList() };

    [Theory]
    [InlineData(1)]
    [InlineData(500)]
    public void Validate_CountInRange_HasNoErrors(int count)
    {
        _validator.TestValidate(WithIds(count)).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyList_ReportsMinLength()
    {
        _validator.TestValidate(WithIds(0)).ShouldHaveValidationErrorFor(x => x.QuestionIds)
            .WithErrorMessage("The field QuestionIds must be a string or array type with a minimum length of '1'.");
    }

    [Fact]
    public void Validate_TooManyIds_ReportsMaxLength()
    {
        _validator.TestValidate(WithIds(501)).ShouldHaveValidationErrorFor(x => x.QuestionIds)
            .WithErrorMessage("The field QuestionIds must be a string or array type with a maximum length of '500'.");
    }

    [Fact]
    public void Validate_NullList_ReportsRequired()
    {
        _validator.TestValidate(new ReorderQuizQuestionsRequest { QuestionIds = null! })
            .ShouldHaveValidationErrorFor(x => x.QuestionIds)
            .WithErrorMessage("The QuestionIds field is required.");
    }
}
