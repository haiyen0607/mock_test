using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;

namespace QuizApp.Application.Tests.Validation;

public class LoginRequestValidatorTests
{
    private readonly LoginRequestValidator _validator = new();

    [Fact]
    public void Validate_ValidRequest_HasNoErrors()
    {
        _validator.TestValidate(new LoginRequest { UsernameOrEmail = "alice", Password = "x" }).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_BlankFields_ReportsRequiredMessages()
    {
        var result = _validator.TestValidate(new LoginRequest { UsernameOrEmail = " ", Password = "" });

        result.ShouldHaveValidationErrorFor(x => x.UsernameOrEmail).WithErrorMessage("Username or email is required.");
        result.ShouldHaveValidationErrorFor(x => x.Password).WithErrorMessage("Password is required.");
    }

    [Fact]
    public void Validate_TooLongFields_ReportsMaxLengthWithPropertyName()
    {
        // {PropertyName} = "UsernameOrEmail" (không tách thành "Username Or Email")
        var result = _validator.TestValidate(new LoginRequest
        {
            UsernameOrEmail = new string('u', 256),
            Password = new string('p', 101)
        });

        result.ShouldHaveValidationErrorFor(x => x.UsernameOrEmail)
            .WithErrorMessage("The field UsernameOrEmail must be a string with a maximum length of 255.");
        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("The field Password must be a string with a maximum length of 100.");
    }
}
