using System.Security.Claims;

namespace QuizApp.Api.Security;

/// <summary>Tiện ích đọc thông tin User hiện tại từ JWT claims trong Controller.</summary>
public static class CurrentUserExtensions
{
    public static int GetUserId(this ClaimsPrincipal user) =>
        int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static bool IsAdministrator(this ClaimsPrincipal user) =>
        user.IsInRole("Administrator");
}
