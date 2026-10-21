using Microsoft.AspNetCore.Mvc;
using QuizApp.Application.Common;

namespace QuizApp.Api.Controllers;

/// <summary>
/// Chuyển <see cref="Result"/> của tầng Application thành HTTP response.
/// Thành công -> <c>onSuccess</c>; lỗi -> ProblemDetails có "code" (hoặc ValidationProblem khi lỗi theo field).
/// </summary>
public static class ResultExtensions
{
    public static IActionResult ToActionResult<T>(this ControllerBase controller, Result<T> result, Func<T, IActionResult> onSuccess) =>
        result.IsSuccess ? onSuccess(result.Value) : controller.ToProblem(result.Error!);

    public static IActionResult ToActionResult(this ControllerBase controller, Result result, Func<IActionResult> onSuccess) =>
        result.IsSuccess ? onSuccess() : controller.ToProblem(result.Error!);

    /// <summary>200 OK với giá trị — trường hợp phổ biến nhất.</summary>
    public static IActionResult ToOk<T>(this ControllerBase controller, Result<T> result) =>
        controller.ToActionResult(result, value => controller.Ok(value));

    /// <summary>204 No Content khi thành công.</summary>
    public static IActionResult ToNoContent(this ControllerBase controller, Result result) =>
        controller.ToActionResult(result, controller.NoContent);

    public static IActionResult ToProblem(this ControllerBase controller, Error error)
    {
        if (error.FieldErrors is not null)
        {
            foreach (var (field, messages) in error.FieldErrors)
                foreach (var message in messages)
                    controller.ModelState.AddModelError(field, message);

            // code = VALIDATION_FAILED được gắn ở AddProblemDetails (Program.cs)
            return controller.ValidationProblem(controller.ModelState);
        }

        var status = error.Type switch
        {
            ErrorType.Validation => StatusCodes.Status400BadRequest,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };

        return controller.ApiProblem(status, error.Code, error.Message);
    }
}
