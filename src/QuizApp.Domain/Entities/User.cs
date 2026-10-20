using QuizApp.Domain.Enums;

namespace QuizApp.Domain.Entities;

/// <summary>
/// Tài khoản đã đăng ký (actor User / Administrator trong SRS 1.3.1).
/// Guest không có bản ghi ở đây — Guest là người dùng chưa xác thực.
/// </summary>
public class User
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    // Lưu dạng "iterations.salt.hash" (base64) — xem Security/PasswordHasher.cs
    public string PasswordHash { get; set; } = string.Empty;

    public UserRole Role { get; set; } = UserRole.User;
    public AccountStatus Status { get; set; } = AccountStatus.Active;
    public DateTime CreatedAt { get; set; }

    public ICollection<QuestionBank> QuestionBanks { get; set; } = new List<QuestionBank>();
    public ICollection<Quiz> Quizzes { get; set; } = new List<Quiz>();
    public ICollection<QuizAttempt> Attempts { get; set; } = new List<QuizAttempt>();
}
