using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;

namespace QuizApp.Application.Tests.Validation;

public class QuizRequestValidatorTests
{
    private readonly QuizRequestValidator _validator = new();

    private static QuizRequest Valid() => new() { Title = "Quiz", Description = null, Duration = 10 };

    [Fact]
    public void Validate_ValidRequest_HasNoErrors()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_BlankTitle_ReportsRequired()
    {
        var model = Valid();
        model.Title = "  ";

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Title).WithErrorMessage("Title is required.");
    }

    [Fact]
    public void Validate_TitleTooLong_ReportsCustomMaxLength()
    {
        var model = Valid();
        model.Title = new string('t', 256);

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Title)
            .WithErrorMessage("Title must not exceed 255 characters.");
    }

    [Fact]
    public void Validate_DescriptionTooLong_ReportsMaxLength()
    {
        var model = Valid();
        model.Description = new string('d', 2001);

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("The field Description must be a string with a maximum length of 2000.");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(601)]
    public void Validate_DurationOutOfRange_ReportsDurationMessage(int duration)
    {
        var model = Valid();
        model.Duration = duration;

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Duration)
            .WithErrorMessage("Duration must be between 1 and 600 minutes.");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(600)]
    public void Validate_DurationAtBoundary_IsValid(int duration)
    {
        var model = Valid();
        model.Duration = duration;

        _validator.TestValidate(model).ShouldNotHaveValidationErrorFor(x => x.Duration);
    }
}
