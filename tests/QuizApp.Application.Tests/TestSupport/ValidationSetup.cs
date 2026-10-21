using System.Runtime.CompilerServices;
using FluentValidation;

namespace QuizApp.Application.Tests.TestSupport;

/// <summary>
/// Giống cấu hình trong AddApplication(): {PropertyName} = tên property C# ("UsernameOrEmail"),
/// để thông báo lỗi khớp đúng câu chữ khi chạy production. Chạy 1 lần khi nạp assembly test,
/// trước mọi test (kể cả khi các test class chạy song song).
/// </summary>
internal static class ValidationSetup
{
    [ModuleInitializer]
    internal static void Initialize() =>
        ValidatorOptions.Global.DisplayNameResolver = (_, member, _) => member?.Name;
}
