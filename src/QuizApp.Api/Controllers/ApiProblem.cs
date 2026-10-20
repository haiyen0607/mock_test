using Microsoft.AspNetCore.Mvc;

namespace QuizApp.Api.Controllers;

/// <summary>
/// Helper tạo ProblemDetails (RFC 7807) kèm extensions["code"] – thay cho Problem(detail: ...) trước đây.
/// Là static extension, không phải service layer. Ví dụ:
/// <c>return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.QuizNotFound, $"Quiz {id} was not found.");</c>
/// </summary>
public static class ApiProblemExtensions
{
    public static ObjectResult ApiProblem(this ControllerBase controller, int statusCode, string code, string detail)
    {
        var problem = controller.ProblemDetailsFactory.CreateProblemDetails(
            controller.HttpContext, statusCode: statusCode, detail: detail);
        problem.Extensions["code"] = code;

        return new ObjectResult(problem)
        {
            StatusCode = statusCode,
            ContentTypes = { "application/problem+json" }
        };
    }
}
