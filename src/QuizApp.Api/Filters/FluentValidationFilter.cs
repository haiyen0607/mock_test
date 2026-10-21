using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace QuizApp.Api.Filters;

/// <summary>
/// Chạy FluentValidation cho mọi tham số action có validator đăng ký (IValidator&lt;T&gt;), trước khi vào controller.
/// Lỗi -> cùng response như model validation mặc định của [ApiController]:
/// ValidationProblem (400, errors theo field, code VALIDATION_FAILED).
/// </summary>
public sealed class FluentValidationFilter : IAsyncActionFilter
{
    private readonly IServiceProvider _services;
    private readonly ApiBehaviorOptions _apiBehavior;

    public FluentValidationFilter(IServiceProvider services, IOptions<ApiBehaviorOptions> apiBehavior)
    {
        _services = services;
        _apiBehavior = apiBehavior.Value;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;

            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (_services.GetService(validatorType) is not IValidator validator) continue;

            var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            foreach (var failure in result.Errors)
                context.ModelState.AddModelError(failure.PropertyName, failure.ErrorMessage);
        }

        if (!context.ModelState.IsValid)
        {
            context.Result = _apiBehavior.InvalidModelStateResponseFactory(context);
            return;
        }

        await next();
    }
}
