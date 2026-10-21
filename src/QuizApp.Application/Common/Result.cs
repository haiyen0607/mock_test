namespace QuizApp.Application.Common;

/// <summary>Nhóm lỗi nghiệp vụ — tầng Api ánh xạ sang HTTP status.</summary>
public enum ErrorType
{
    /// <summary>400 – dữ liệu / quy tắc nghiệp vụ không hợp lệ.</summary>
    Validation,
    /// <summary>401 – chưa xác thực / sai thông tin đăng nhập.</summary>
    Unauthorized,
    /// <summary>403 – không có quyền.</summary>
    Forbidden,
    /// <summary>404 – không tìm thấy.</summary>
    NotFound,
    /// <summary>409 – xung đột trạng thái (trùng, đã nộp, đang được dùng).</summary>
    Conflict
}

/// <summary>
/// Lỗi nghiệp vụ trả về từ service (thay cho exception hay IActionResult).
/// <see cref="FieldErrors"/> có giá trị khi cần trả ValidationProblem theo từng field
/// (vd. "questions" khi Publish, "answers" khi Submit).
/// </summary>
public sealed record Error(ErrorType Type, string Code, string Message, IReadOnlyDictionary<string, string[]>? FieldErrors = null)
{
    public static Error Validation(string code, string message) => new(ErrorType.Validation, code, message);
    public static Error Unauthorized(string code, string message) => new(ErrorType.Unauthorized, code, message);
    public static Error Forbidden(string code, string message) => new(ErrorType.Forbidden, code, message);
    public static Error NotFound(string code, string message) => new(ErrorType.NotFound, code, message);
    public static Error Conflict(string code, string message) => new(ErrorType.Conflict, code, message);

    /// <summary>Lỗi validate theo field — Api trả ValidationProblem (code VALIDATION_FAILED).</summary>
    public static Error Fields(string field, IEnumerable<string> messages) =>
        new(ErrorType.Validation, ErrorCodes.ValidationFailed, "One or more validation errors occurred.",
            new Dictionary<string, string[]> { [field] = messages.ToArray() });
}

/// <summary>
/// Result pattern: use case trả về thành công hoặc <see cref="Error"/> thay vì ném exception
/// cho các lỗi nghiệp vụ dự đoán được. Exception chỉ dành cho lỗi bất ngờ (DB mất kết nối...).
/// </summary>
public class Result
{
    protected Result(Error? error) => Error = error;

    public Error? Error { get; }
    public bool IsSuccess => Error is null;

    public static Result Success() => new(null);
    public static Result Failure(Error error) => new(error);
    public static Result<T> Success<T>(T value) => Result<T>.Success(value);

    public static implicit operator Result(Error error) => Failure(error);
}

/// <summary>Kết quả có giá trị khi thành công.</summary>
public sealed class Result<T> : Result
{
    private readonly T? _value;

    private Result(T? value, Error? error) : base(error) => _value = value;

    /// <summary>Giá trị khi thành công; truy cập khi thất bại là lỗi lập trình.</summary>
    public T Value => IsSuccess ? _value! : throw new InvalidOperationException("Cannot read the value of a failed result.");

    public static Result<T> Success(T value) => new(value, null);
    public static new Result<T> Failure(Error error) => new(default, error);

    public static implicit operator Result<T>(T value) => Success(value);
    public static implicit operator Result<T>(Error error) => Failure(error);
}
