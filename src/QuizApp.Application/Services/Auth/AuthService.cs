using Microsoft.EntityFrameworkCore;
using QuizApp.Application.Abstractions;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Services.Auth;

/// <summary>Authentication cho actor Guest/User/Administrator (UC01 – UC03).</summary>
public interface IAuthService
{
    /// <summary>UC01 – Register Account. Trùng username/email -> Conflict (USERNAME_TAKEN / EMAIL_TAKEN).</summary>
    Task<Result<AuthResponseDto>> RegisterAsync(RegisterRequest request, CancellationToken ct = default);

    /// <summary>UC02 – Login. Sai thông tin -> INVALID_CREDENTIALS; tài khoản bị khoá -> ACCOUNT_BLOCKED.</summary>
    Task<Result<AuthResponseDto>> LoginAsync(LoginRequest request, CancellationToken ct = default);

    /// <summary>Thông tin tài khoản đang đăng nhập.</summary>
    Task<Result<UserDto>> GetCurrentUserAsync(CancellationToken ct = default);
}

public sealed class AuthService : IAuthService
{
    private readonly IApplicationDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;
    private readonly ICurrentUser _currentUser;

    public AuthService(IApplicationDbContext db, IPasswordHasher hasher, IJwtTokenService jwt, ICurrentUser currentUser)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
        _currentUser = currentUser;
    }

    public async Task<Result<AuthResponseDto>> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        // Chuẩn hoá trước khi so trùng và lưu: "Anh@Gmail.com" và "anh@gmail.com" là một
        var username = request.Username.Trim();
        var email = request.Email.Trim().ToLowerInvariant();

        // Collation mặc định của SQL Server không phân biệt hoa/thường
        var duplicate = await FindDuplicateAsync(username, email, ct);
        if (duplicate is not null)
            return duplicate;

        var user = new User
        {
            Username = username,
            Email = email,
            PasswordHash = _hasher.Hash(request.Password),
            Role = UserRole.User, // Guest tự đăng ký luôn là User
            Status = AccountStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // 2 request cùng username/email chạy song song: cả 2 qua bước kiểm tra, request sau bị unique index chặn
            _db.Users.Entry(user).State = EntityState.Detached;
            var raced = await FindDuplicateAsync(username, email, ct);
            if (raced is not null) return raced;
            throw;
        }

        return new AuthResponseDto(_jwt.GenerateToken(user), Mapper.ToUser(user));
    }

    public async Task<Result<AuthResponseDto>> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        // Không ToLower(): collation CI đã so sánh không phân biệt hoa/thường, và ToLower() trên cột làm mất unique index
        var key = request.UsernameOrEmail.Trim();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == key || u.Email == key, ct);

        // A2 – Incorrect credentials. Không tìm thấy user vẫn chạy PBKDF2 giả để thời gian phản hồi như nhau.
        var passwordOk = user is null
            ? _hasher.VerifyDummy(request.Password)
            : _hasher.Verify(request.Password, user.PasswordHash);
        if (user is null || !passwordOk)
            return Error.Unauthorized(ErrorCodes.InvalidCredentials, "Invalid username/email or password.");

        // A3 – Account is inactive or blocked
        if (user.Status == AccountStatus.Blocked)
            return Error.Forbidden(ErrorCodes.AccountBlocked, "This account has been blocked by an administrator.");

        return new AuthResponseDto(_jwt.GenerateToken(user), Mapper.ToUser(user));
    }

    public async Task<Result<UserDto>> GetCurrentUserAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.RequireUserId();
        var user = await _db.Users.AsNoTracking().FirstAsync(u => u.UserId == userId, ct);
        return Mapper.ToUser(user);
    }

    /// <summary>Conflict USERNAME_TAKEN / EMAIL_TAKEN nếu đã được dùng; null nếu không trùng.</summary>
    private async Task<Error?> FindDuplicateAsync(string username, string email, CancellationToken ct)
    {
        if (await _db.Users.AnyAsync(u => u.Username == username, ct))
            return Error.Conflict(ErrorCodes.UsernameTaken, "Username already exists.");

        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            return Error.Conflict(ErrorCodes.EmailTaken, "Email already exists.");

        return null;
    }
}
