using QuizApp.Domain.Entities;

namespace QuizApp.Application.Abstractions;

/// <summary>Băm và kiểm tra mật khẩu (cài đặt PBKDF2 ở Infrastructure).</summary>
public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string storedHash);

    /// <summary>
    /// Chạy một lần verify giả khi không tìm thấy user, để thời gian phản hồi không tiết lộ
    /// username có tồn tại hay không (chống timing attack). Luôn trả false.
    /// </summary>
    bool VerifyDummy(string password);
}

/// <summary>Sinh JWT access token cho User (cài đặt ở Infrastructure).</summary>
public interface IJwtTokenService
{
    string GenerateToken(User user);
}
