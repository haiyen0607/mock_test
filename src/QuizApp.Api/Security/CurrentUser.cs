using QuizApp.Application.Abstractions;

namespace QuizApp.Api.Security;

/// <summary>Cài đặt <see cref="ICurrentUser"/> từ JWT claims của HTTP request hiện tại.</summary>
public sealed class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

    private System.Security.Claims.ClaimsPrincipal? Principal => _accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public int? UserId => IsAuthenticated ? Principal!.GetUserId() : null;

    public bool IsAdministrator => IsAuthenticated && Principal!.IsAdministrator();

    public bool CanManage(int ownerId) => Principal?.CanManage(ownerId) ?? false;
}
