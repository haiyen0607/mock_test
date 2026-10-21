namespace QuizApp.Application.Abstractions;

/// <summary>
/// Người dùng của request hiện tại (đọc từ JWT ở tầng Api). Service dùng interface này thay vì
/// ClaimsPrincipal để không phụ thuộc ASP.NET Core.
/// </summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    /// <summary>null với Guest.</summary>
    int? UserId { get; }

    bool IsAdministrator { get; }

    /// <summary>
    /// Quy tắc sở hữu dùng chung (UC12/UC13/UC14/UC15 – alt. flow "does not own"):
    /// đã đăng nhập VÀ (là chủ sở hữu HOẶC là Administrator).
    /// </summary>
    bool CanManage(int ownerId);
}

public static class CurrentUserExtensions
{
    /// <summary>Id của User đã đăng nhập — chỉ gọi ở use case yêu cầu đăng nhập ([Authorize]).</summary>
    public static int RequireUserId(this ICurrentUser user) =>
        user.UserId ?? throw new InvalidOperationException("This operation requires an authenticated user.");
}
