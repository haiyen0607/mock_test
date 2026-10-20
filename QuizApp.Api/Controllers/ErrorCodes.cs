namespace QuizApp.Api.Controllers;

/// <summary>
/// Mã lỗi máy đọc được, trả trong ProblemDetails.extensions["code"] của MỌI response lỗi.
/// Frontend dựa vào mã này để hiển thị thông báo tiếng Việt (không hiển thị thẳng "detail" tiếng Anh).
/// Danh sách đầy đủ + HTTP status tương ứng: xem API_CHANGES.md.
/// </summary>
public static class ErrorCodes
{
    // Xác thực / tài khoản (UC01/UC02/UC18)
    public const string InvalidCredentials = "INVALID_CREDENTIALS";   // 401
    public const string AccountBlocked = "ACCOUNT_BLOCKED";           // 403
    public const string UsernameTaken = "USERNAME_TAKEN";             // 409
    public const string EmailTaken = "EMAIL_TAKEN";                   // 409
    public const string Unauthorized = "UNAUTHORIZED";                // 401 – thiếu/hết hạn token

    // Quyền
    public const string NotOwner = "NOT_OWNER";                       // 403
    public const string Forbidden = "FORBIDDEN";                      // 403

    // Không tìm thấy (404)
    public const string QuizNotFound = "QUIZ_NOT_FOUND";
    public const string QuestionNotFound = "QUESTION_NOT_FOUND";
    public const string BankNotFound = "BANK_NOT_FOUND";
    public const string AnswerNotFound = "ANSWER_NOT_FOUND";
    public const string AttemptNotFound = "ATTEMPT_NOT_FOUND";
    public const string UserNotFound = "USER_NOT_FOUND";
    public const string NotFound = "NOT_FOUND";                       // 404 – route không tồn tại

    // Làm bài (UC07–UC10)
    public const string QuizNotAvailable = "QUIZ_NOT_AVAILABLE";      // 403
    public const string QuizNoQuestions = "QUIZ_NO_QUESTIONS";        // 400
    public const string TrialLimit = "TRIAL_LIMIT";                   // 403
    public const string AttemptSubmitted = "ATTEMPT_SUBMITTED";       // 409
    public const string AttemptNotSubmitted = "ATTEMPT_NOT_SUBMITTED";// 400
    public const string AttemptExpired = "ATTEMPT_EXPIRED";           // 400
    public const string NotGradable = "NOT_GRADABLE";                 // 400

    // Nội dung
    public const string QuestionInUse = "QUESTION_IN_USE";            // 409
    public const string InvalidStatus = "INVALID_STATUS";             // 400

    // Chung
    public const string InvalidRequest = "INVALID_REQUEST";           // 400
    public const string ValidationFailed = "VALIDATION_FAILED";       // 400 (ValidationProblem có "errors")
    public const string ConcurrencyConflict = "CONCURRENCY_CONFLICT"; // 409
    public const string RateLimited = "RATE_LIMITED";                 // 429
    public const string InternalError = "INTERNAL_ERROR";             // 500

    /// <summary>Mã mặc định theo HTTP status, dùng khi response lỗi chưa gắn code (401 của JWT, 404 route, 500...).</summary>
    public static string ForStatus(int status) => status switch
    {
        StatusCodes.Status401Unauthorized => Unauthorized,
        StatusCodes.Status403Forbidden => Forbidden,
        StatusCodes.Status404NotFound => NotFound,
        StatusCodes.Status409Conflict => ConcurrencyConflict,
        StatusCodes.Status429TooManyRequests => RateLimited,
        >= 500 => InternalError,
        _ => InvalidRequest
    };
}
