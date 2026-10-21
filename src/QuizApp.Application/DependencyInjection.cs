using System.Reflection;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using QuizApp.Domain.Scoring;

namespace QuizApp.Application;

/// <summary>Đăng ký các dịch vụ của tầng Application vào DI container (gọi từ Program.cs của Api).</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // FluentValidation: mọi AbstractValidator<T> trong assembly (Validation/RequestValidators.cs).
        // {PropertyName} trong thông báo = tên property C# ("UsernameOrEmail"), không tách thành "Username Or Email",
        // để câu chữ giống hệt DataAnnotations trước đây (frontend dịch lỗi theo câu này).
        ValidatorOptions.Global.DisplayNameResolver = (_, member, _) => member?.Name;
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        // Chấm điểm (Strategy pattern, Domain): stateless -> singleton
        services.AddSingleton<IQuestionScoringStrategy, SingleChoiceScoring>();
        services.AddSingleton<IQuestionScoringStrategy, MultipleChoiceScoring>();
        services.AddSingleton<IQuestionScoringStrategy, ManualGradingScoring>();
        services.AddSingleton<AttemptScorer>();

        // Use case: mọi class "XxxService" trong namespace QuizApp.Application.Services.* cài đặt "IXxxService"
        // được đăng ký Scoped (cùng vòng đời với DbContext) — thêm service mới không cần sửa file này.
        var serviceTypes = Assembly.GetExecutingAssembly().GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false }
                        && t.Namespace?.StartsWith("QuizApp.Application.Services", StringComparison.Ordinal) == true
                        && t.Name.EndsWith("Service", StringComparison.Ordinal));

        foreach (var implementation in serviceTypes)
        {
            var contract = implementation.GetInterface("I" + implementation.Name);
            if (contract is not null)
                services.AddScoped(contract, implementation);
        }

        return services;
    }
}
