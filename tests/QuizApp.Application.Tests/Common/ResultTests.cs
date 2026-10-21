using QuizApp.Application.Common;

namespace QuizApp.Application.Tests.Common;

public class ResultTests
{
    [Fact]
    public void Success_HasNoError()
    {
        var result = Result.Success();

        result.IsSuccess.Should().BeTrue();
        result.Error.Should().BeNull();
    }

    [Fact]
    public void Failure_KeepsError()
    {
        var error = Error.NotFound(ErrorCodes.QuizNotFound, "Quiz 1 was not found.");

        var result = Result.Failure(error);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().BeSameAs(error);
    }

    [Fact]
    public void ImplicitConversion_FromError_CreatesFailedResult()
    {
        Result result = Error.Conflict(ErrorCodes.UsernameTaken, "Username already exists.");

        result.IsSuccess.Should().BeFalse();
        result.Error!.Code.Should().Be(ErrorCodes.UsernameTaken);
    }

    [Fact]
    public void GenericSuccess_ExposesValue()
    {
        var result = Result.Success(42);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(42);
    }

    [Fact]
    public void GenericImplicitConversion_FromValue_CreatesSuccess()
    {
        Result<string> result = "ok";

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("ok");
    }

    [Fact]
    public void GenericImplicitConversion_FromError_CreatesFailure()
    {
        Result<string> result = Error.Forbidden(ErrorCodes.NotOwner, "You do not own this quiz.");

        result.IsSuccess.Should().BeFalse();
        result.Error!.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public void Value_OnFailedResult_ThrowsInvalidOperationException()
    {
        var result = Result<int>.Failure(Error.Validation(ErrorCodes.InvalidRequest, "bad"));

        var act = () => result.Value;

        act.Should().Throw<InvalidOperationException>().WithMessage("Cannot read the value of a failed result.");
    }

    [Fact]
    public void ErrorFactories_SetMatchingErrorType()
    {
        Error.Validation("C", "m").Type.Should().Be(ErrorType.Validation);
        Error.Unauthorized("C", "m").Type.Should().Be(ErrorType.Unauthorized);
        Error.Forbidden("C", "m").Type.Should().Be(ErrorType.Forbidden);
        Error.NotFound("C", "m").Type.Should().Be(ErrorType.NotFound);
        Error.Conflict("C", "m").Type.Should().Be(ErrorType.Conflict);
        Error.Conflict("C", "m").FieldErrors.Should().BeNull();
    }

    [Fact]
    public void ErrorFields_BuildsValidationErrorKeyedByField()
    {
        var error = Error.Fields("questions", new[] { "a", "b" });

        error.Type.Should().Be(ErrorType.Validation);
        error.Code.Should().Be(ErrorCodes.ValidationFailed);
        error.Message.Should().Be("One or more validation errors occurred.");
        error.FieldErrors.Should().ContainSingle();
        error.FieldErrors!["questions"].Should().Equal("a", "b");
    }
}
