using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using QuizApp.Application.Abstractions;
using QuizApp.Domain.Entities;

namespace QuizApp.Infrastructure.Security;

/// <summary>
/// Khoá ký JWT, đọc MỘT lần lúc khởi động (Program.cs) và dùng chung cho cả ký lẫn xác thực token.
/// Không đọc lại Jwt:Key từ IConfiguration mỗi lần ký: appsettings*.json được reload khi file thay đổi,
/// nếu key đổi trong lúc API đang chạy thì token mới ký sẽ không khớp key xác thực -> mọi request 401.
/// </summary>
public sealed record JwtSigningKey(SymmetricSecurityKey Key)
{
    /// <summary>
    /// A1 – Jwt:Key KHÔNG nằm trong appsettings.json: lấy từ user-secrets / biến môi trường (Jwt__Key);
    /// Development có key dev riêng trong appsettings.Development.json. Thiếu / quá ngắn / còn placeholder -> dừng khởi động.
    /// </summary>
    public static JwtSigningKey FromConfiguration(IConfiguration configuration)
    {
        var key = configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(key)
            || Encoding.UTF8.GetByteCount(key) < 32
            || key.Contains("CHANGE_THIS", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Jwt:Key is missing, shorter than 32 bytes, or still a placeholder. " +
                "Set it with `dotnet user-secrets set \"Jwt:Key\" \"<random 32+ chars>\"` or the Jwt__Key environment variable.");
        }

        return new JwtSigningKey(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)));
    }
}

/// <summary>Sinh JWT access token dùng cho UC02 – Login.</summary>
public class JwtTokenService : IJwtTokenService
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
