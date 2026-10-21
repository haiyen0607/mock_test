using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace QuizApp.Api.ErrorHandling;

/// <summary>
/// Xử lý exception chưa được bắt ở bất kỳ đâu (mất kết nối DB, lỗi SQL, bug...):
/// ghi log đầy đủ (kèm TraceId để tra cứu) và trả ProblemDetails 500 code INTERNAL_ERROR
/// — không lộ stack trace / thông tin nội bộ ra client.
/// Lỗi nghiệp vụ dự đoán được KHÔNG đi qua đây: service trả Result/Error (Result pattern).
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails;
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(IProblemDetailsService problemDetails, ILogger<GlobalExceptionHandler> logger)
    {
        _problemDetails = problemDetails;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        // Client tự huỷ request (đóng tab, mất mạng): không phải lỗi server, chỉ ghi nhận
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            _logger.LogInformation("Request {Method} {Path} was cancelled by the client.",
                httpContext.Request.Method, httpContext.Request.Path);
            httpContext.Response.StatusCode = 499; // Client Closed Request (quy ước nginx)
            return true;
        }

        _logger.LogError(exception, "Unhandled exception for {Method} {Path} (RequestId {RequestId})",
            httpContext.Request.Method, httpContext.Request.Path, httpContext.TraceIdentifier);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred.",
                Detail = "The server could not process the request. Please try again later.",
                // traceId = RequestId trong log -> đối chiếu được response lỗi với dòng log chi tiết
                Extensions = { ["code"] = ErrorCodes.InternalError, ["traceId"] = httpContext.TraceIdentifier }
            }
        });
    }
}
