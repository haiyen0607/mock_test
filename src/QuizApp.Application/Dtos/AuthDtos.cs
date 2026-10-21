// xác định các DTO liên quan đến xác thực (Authentication) và đăng nhập/đăng ký tài khoản trong ứng dụng QuizApp. Các lớp này được sử dụng để nhận dữ liệu từ client khi người dùng thực hiện các hành động như đăng ký tài khoản,
// đăng nhập và nhận thông tin người dùng hiện tại.

namespace QuizApp.Application.Dtos;

/// <summary>UC01 – Register Account.</summary>
public class RegisterRequest
{
    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}

/// <summary>UC02 – Login.</summary>
public class LoginRequest
{
    public string UsernameOrEmail { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}

public record AuthResponseDto(string Token, UserDto User);
