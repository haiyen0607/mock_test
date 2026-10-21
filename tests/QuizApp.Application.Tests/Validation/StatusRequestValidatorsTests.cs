using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;

namespace QuizApp.Application.Tests.Validation;

/// <summary>
/// UpdateUserStatusRequestValidator và UpdateContentStatusRequestValidator: chỉ kiểm tra bắt buộc;
/// giá trị cụ thể (Active/Blocked/Removed) do service kiểm tra (INVALID_STATUS).
/// </summary>
public class StatusRequestValidatorsTests
{
    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void UpdateUserStatus_BlankStatus_ReportsRequired(string status)
    {
        new UpdateUserStatusRequestValidator().TestValidate(new UpdateUserStatusRequest { Status = status })
            .ShouldHaveValidationErrorFor(x => x.Status).WithErrorMessage("Status is required.");
    }

    [Fact]
    public void UpdateUserStatus_AnyNonBlankStatus_IsValid()
    {
        new UpdateUserStatusRequestValidator().TestValidate(new UpdateUserStatusRequest { Status = "Whatever" })
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public void UpdateContentStatus_BlankStatus_ReportsRequired(string status)
    {
        new UpdateContentStatusRequestValidator().TestValidate(new UpdateContentStatusRequest { Status = status })
            .ShouldHaveValidationErrorFor(x => x.Status).WithErrorMessage("Status is required.");
    }

    [Fact]
    public void UpdateContentStatus_NonBlankStatus_IsValid()
    {
        new UpdateContentStatusRequestValidator().TestValidate(new UpdateContentStatusRequest { Status = "Removed" })
            .ShouldNotHaveAnyValidationErrors();
    }
}
