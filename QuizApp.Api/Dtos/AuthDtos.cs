// xác định các DTO liên quan đến xác thực (Authentication) và đăng nhập/đăng ký tài khoản trong ứng dụng QuizApp. Các lớp này được sử dụng để nhận dữ liệu từ client khi người dùng thực hiện các hành động như đăng ký tài khoản,
// đăng nhập và nhận thông tin người dùng hiện tại.

using System.ComponentModel.DataAnnotations;

namespace QuizApp.Api.Dtos;

/// <summary>UC01 – Register Account.</summary>
public class RegisterRequest
{
    [Required(ErrorMessage = "Username is required.")]
    [StringLength(100, MinimumLength = 3)]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress]
    [StringLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "Password must be at least 6 characters.")]
    public string Password { get; set; } = string.Empty;
}

/// <summary>UC02 – Login.</summary>
public class LoginRequest
{
    [Required(ErrorMessage = "Username or email is required.")]
    [StringLength(255)]
    public string UsernameOrEmail { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [StringLength(100)]
    public string Password { get; set; } = string.Empty;
}

public record AuthResponseDto(string Token, UserDto User);
