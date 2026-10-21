using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;

namespace QuizApp.Application.Tests.Validation;

public class RegisterRequestValidatorTests
{
    private readonly RegisterRequestValidator _validator = new();

    private static RegisterRequest Valid() => new() { Username = "alice", Email = "alice@example.com", Password = "secret1" };

    [Fact]
    public void Validate_ValidRequest_HasNoErrors()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_BlankUsername_ReportsRequired(string username)
    {
        var model = Valid();
        model.Username = username;

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Username).WithErrorMessage("Username is required.");
    }

    [Theory]
    [InlineData(2)]
    [InlineData(101)]
    public void Validate_UsernameLengthOutOfRange_ReportsLengthMessage(int length)
    {
        var model = Valid();
        model.Username = new string('a', length);

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Username)
            .WithErrorMessage("The field Username must be a string with a minimum length of 3 and a maximum length of 100.");
    }

    [Theory]
    [InlineData(3)]
    [InlineData(100)]
    public void Validate_UsernameLengthAtBoundary_IsValid(int length)
    {
        var model = Valid();
        model.Username = new string('a', length);

        _validator.TestValidate(model).ShouldNotHaveValidationErrorFor(x => x.Username);
    }

    [Fact]
    public void Validate_BlankEmail_ReportsRequired()
    {
        var model = Valid();
        model.Email = "";

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Email).WithErrorMessage("Email is required.");
    }

    [Theory]
    [InlineData("alice")]
    [InlineData("@example.com")]
    [InlineData("alice@")]
    [InlineData("a@b@c")]
    [InlineData("alice@exa\nmple.com")]
    public void Validate_InvalidEmail_ReportsInvalidEmail(string email)
    {
        var model = Valid();
        model.Email = email;

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("The Email field is not a valid e-mail address.");
    }

    [Fact]
    public void Validate_EmailTooLong_ReportsMaxLength()
    {
        var model = Valid();
        model.Email = new string('a', 250) + "@x.com"; // 256 ký tự

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("The field Email must be a string with a maximum length of 255.");
    }

    [Fact]
    public void Validate_BlankPassword_ReportsRequired()
    {
        var model = Valid();
        model.Password = "";

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Password).WithErrorMessage("Password is required.");
    }

    [Theory]
    [InlineData(5)]
    [InlineData(101)]
    public void Validate_PasswordLengthOutOfRange_ReportsCustomMessage(int length)
    {
        var model = Valid();
        model.Password = new string('p', length);

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password must be at least 6 characters.");
    }
}
