using System.ComponentModel.DataAnnotations;

namespace QuizApp.Application.Dtos;

public record UserDto(int UserId, string Username, string Email, string Role, string Status, DateTime CreatedAt);

/// <summary>UC18 – Manage Users: Administrator thay đổi trạng thái tài khoản.</summary>
public class UpdateUserStatusRequest
{
    [Required(ErrorMessage = "Status is required.")]
    public string Status { get; set; } = string.Empty; // "Active" | "Blocked"
}
