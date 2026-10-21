using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;

namespace QuizApp.Application.Tests.Validation;

public class GradeAnswerRequestValidatorTests
{
    private readonly GradeAnswerRequestValidator _validator = new();

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Validate_IsCorrectProvided_HasNoErrors(bool isCorrect)
    {
        _validator.TestValidate(new GradeAnswerRequest { IsCorrect = isCorrect }).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_IsCorrectMissing_ReportsRequired()
    {
        _validator.TestValidate(new GradeAnswerRequest()).ShouldHaveValidationErrorFor(x => x.IsCorrect)
            .WithErrorMessage("IsCorrect is required.");
    }
}
