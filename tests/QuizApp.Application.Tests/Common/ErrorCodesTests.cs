using QuizApp.Application.Common;

namespace QuizApp.Application.Tests.Common;

public class ErrorCodesTests
{
    [Theory]
    [InlineData(401, ErrorCodes.Unauthorized)]
    [InlineData(403, ErrorCodes.Forbidden)]
    [InlineData(404, ErrorCodes.NotFound)]
    [InlineData(409, ErrorCodes.ConcurrencyConflict)]
    [InlineData(429, ErrorCodes.RateLimited)]
    [InlineData(500, ErrorCodes.InternalError)]
    [InlineData(503, ErrorCodes.InternalError)]
    [InlineData(400, ErrorCodes.InvalidRequest)]
    [InlineData(415, ErrorCodes.InvalidRequest)]
    public void ForStatus_ReturnsDefaultCodeForHttpStatus(int status, string expected)
    {
        ErrorCodes.ForStatus(status).Should().Be(expected);
    }
}
