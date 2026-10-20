using System.Security.Claims;

namespace QuizApp.Api.Security;

/// <summary>Tiện ích đọc thông tin User hiện tại từ JWT claims trong Controller.</summary>
public static class CurrentUserExtensions
{
    public static int GetUserId(this ClaimsPrincipal user) =>
        int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static bool IsAdministrator(this ClaimsPrincipal user) =>
        user.IsInRole("Administrator");

    /// <summary>
    /// Quy tắc sở hữu dùng chung (UC12/UC13/UC14/UC15 – alt. flow "does not own"):
    /// đã đăng nhập VÀ (là chủ sở hữu HOẶC là Administrator).
    /// </summary>
    public static bool CanManage(this ClaimsPrincipal user, int ownerId) =>
        (user.Identity?.IsAuthenticated ?? false) && (user.GetUserId() == ownerId || user.IsAdministrator());
}
