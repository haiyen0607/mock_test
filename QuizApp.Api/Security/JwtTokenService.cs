using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using QuizApp.Api.Entities;

namespace QuizApp.Api.Security;

/// <summary>
/// Khoá ký JWT, đọc MỘT lần lúc khởi động (Program.cs) và dùng chung cho cả ký lẫn xác thực token.
/// Không đọc lại Jwt:Key từ IConfiguration mỗi lần ký: appsettings*.json được reload khi file thay đổi,
/// nếu key đổi trong lúc API đang chạy thì token mới ký sẽ không khớp key xác thực -> mọi request 401.
/// </summary>
public sealed record JwtSigningKey(SymmetricSecurityKey Key);

/// <summary>Sinh JWT access token dùng cho UC02 – Login.</summary>
public class JwtTokenService
{
    private readonly IConfiguration _config;
    private readonly JwtSigningKey _signingKey;

    public JwtTokenService(IConfiguration config, JwtSigningKey signingKey)
    {
        _config = config;
        _signingKey = signingKey;
    }

    public string GenerateToken(User user)
    {
        var jwtSection = _config.GetSection("Jwt");
        var credentials = new SigningCredentials(_signingKey.Key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role.ToString())
        };

        var expiresMinutes = int.Parse(jwtSection["ExpiresMinutes"] ?? "480");

        var token = new JwtSecurityToken(
            issuer: jwtSection["Issuer"],
            audience: jwtSection["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
