using System.Security.Cryptography;
using QuizApp.Application.Abstractions;

namespace QuizApp.Infrastructure.Security;

/// <summary>
/// Băm mật khẩu bằng PBKDF2 (System.Security.Cryptography có sẵn trong .NET,
/// không cần thêm package ngoài). Chuỗi lưu trong DB có dạng:
/// "{iterations}.{saltBase64}.{hashBase64}".
/// </summary>
public sealed class PasswordHasher : IPasswordHasher
{
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const int Iterations = 100_000;

    /// <summary>Hash giả, dùng để "verify" khi username không tồn tại (xem <see cref="VerifyDummy"/>).</summary>
    private static readonly Lazy<string> DummyHash = new(() => new PasswordHasher().Hash(Guid.NewGuid().ToString()));

    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return $"{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public bool Verify(string password, string stored)
    {
        var parts = stored.Split('.', 3);
        if (parts.Length != 3) return false;

        var iterations = int.Parse(parts[0]);
        var salt = Convert.FromBase64String(parts[1]);
        var expected = Convert.FromBase64String(parts[2]);

        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    /// <summary>
    /// UC02 – chống dò tài khoản qua thời gian phản hồi (timing attack): khi không tìm thấy user vẫn chạy
    /// PBKDF2 với cùng số vòng lặp, để "sai username" và "sai mật khẩu" tốn thời gian như nhau. Luôn trả false.
    /// </summary>
    public bool VerifyDummy(string password)
    {
        Verify(password, DummyHash.Value);
        return false;
    }
}
