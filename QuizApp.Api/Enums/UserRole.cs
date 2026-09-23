namespace QuizApp.Api.Enums;

/// <summary>
/// Vai trò của tài khoản đã đăng nhập (SRS 1.3.1).
/// Guest không có bản ghi User — Guest là trạng thái "chưa đăng nhập".
/// Administrator kế thừa toàn bộ quyền của User (SRS 1.3.1).
/// </summary>
public enum UserRole
{
    User,
    Administrator
}
