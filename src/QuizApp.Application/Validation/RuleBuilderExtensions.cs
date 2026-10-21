using FluentValidation;

namespace QuizApp.Application.Validation;

/// <summary>
/// Các rule dùng chung, giữ ĐÚNG hành vi và câu chữ thông báo của DataAnnotations trước đây
/// (frontend dịch lỗi sang tiếng Việt dựa trên các câu này):
/// - Required: null / rỗng / chỉ khoảng trắng đều không hợp lệ;
/// - các rule độ dài / định dạng bỏ qua giá trị null (để Required báo lỗi riêng).
/// {PropertyName} = tên property C# (cấu hình ở <see cref="DependencyInjection"/>).
/// </summary>
public static class RuleBuilderExtensions
{
    /// <summary>Bắt buộc có nội dung (tương đương [Required] cho string).</summary>
    public static IRuleBuilderOptions<T, string?> Required<T>(this IRuleBuilder<T, string?> rule, string message) =>
        rule.Must(value => !string.IsNullOrWhiteSpace(value)).WithMessage(message);

    /// <summary>Độ dài tối đa (tương đương [StringLength(max)]).</summary>
    public static IRuleBuilderOptions<T, string?> MaxLength<T>(this IRuleBuilder<T, string?> rule, int max, string? message = null) =>
        rule.Must(value => value is null || value.Length <= max)
            .WithMessage(message ?? $"The field {{PropertyName}} must be a string with a maximum length of {max}.");

    /// <summary>Độ dài trong khoảng (tương đương [StringLength(max, MinimumLength = min)]).</summary>
    public static IRuleBuilderOptions<T, string?> LengthBetween<T>(this IRuleBuilder<T, string?> rule, int min, int max, string? message = null) =>
        rule.Must(value => value is null || (value.Length >= min && value.Length <= max))
            .WithMessage(message ?? $"The field {{PropertyName}} must be a string with a minimum length of {min} and a maximum length of {max}.");

    /// <summary>
    /// Định dạng email (cùng thuật toán với [EmailAddress]): đúng 1 ký tự '@', không ở đầu/cuối, không xuống dòng.
    /// </summary>
    public static IRuleBuilderOptions<T, string?> EmailAddress<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(value =>
            {
                if (value is null) return true;
                if (value.Contains('\r') || value.Contains('\n')) return false;
                var at = value.IndexOf('@');
                return at > 0 && at != value.Length - 1 && at == value.LastIndexOf('@');
            })
            .WithMessage("The {PropertyName} field is not a valid e-mail address.");

    /// <summary>Số phần tử tối thiểu của danh sách (tương đương [MinLength(n)]).</summary>
    public static IRuleBuilderOptions<T, TList?> MinCount<T, TList>(this IRuleBuilder<T, TList?> rule, int min, string? message = null)
        where TList : System.Collections.ICollection =>
        rule.Must(list => list is null || list.Count >= min)
            .WithMessage(message ?? $"The field {{PropertyName}} must be a string or array type with a minimum length of '{min}'.");

    /// <summary>Số phần tử tối đa của danh sách (tương đương [MaxLength(n)]).</summary>
    public static IRuleBuilderOptions<T, TList?> MaxCount<T, TList>(this IRuleBuilder<T, TList?> rule, int max, string? message = null)
        where TList : System.Collections.ICollection =>
        rule.Must(list => list is null || list.Count <= max)
            .WithMessage(message ?? $"The field {{PropertyName}} must be a string or array type with a maximum length of '{max}'.");

    /// <summary>Giá trị enum hợp lệ (tương đương [EnumDataType]); null bỏ qua.</summary>
    public static IRuleBuilderOptions<T, TEnum?> DefinedEnum<T, TEnum>(this IRuleBuilder<T, TEnum?> rule, string message)
        where TEnum : struct, Enum =>
        rule.Must(value => value is null || Enum.IsDefined(value.Value)).WithMessage(message);
}
