using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;

namespace QuizApp.Application.Tests.Validation;

public class QuestionBankRequestValidatorTests
{
    private readonly QuestionBankRequestValidator _validator = new();

    [Fact]
    public void Validate_ValidRequest_HasNoErrors()
    {
        _validator.TestValidate(new QuestionBankRequest { Name = "Bank" }).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_BlankName_ReportsRequired()
    {
        _validator.TestValidate(new QuestionBankRequest { Name = "" })
            .ShouldHaveValidationErrorFor(x => x.Name).WithErrorMessage("Name is required.");
    }

    [Fact]
    public void Validate_TooLongFields_ReportsMaxLength()
    {
        var result = _validator.TestValidate(new QuestionBankRequest { Name = new string('n', 256), Description = new string('d', 2001) });

        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("The field Name must be a string with a maximum length of 255.");
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("The field Description must be a string with a maximum length of 2000.");
    }
}
