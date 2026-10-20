using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace QuizApp.Api.Controllers;

/// <summary>Authentication cho actor Guest/User/Administrator (UC01 – UC03).</summary>
[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly QuizDbContext _db;
    private readonly JwtTokenService _jwt;

    public AuthController(QuizDbContext db, JwtTokenService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    /// <summary>
    /// UC01 – Register Account. Guest tạo tài khoản User mới.
    /// Trùng username -> 409 USERNAME_TAKEN, trùng email -> 409 EMAIL_TAKEN (kể cả khi 2 request đăng ký đồng thời
    /// vượt qua bước kiểm tra và bị unique index chặn lại). Rate limit "auth" (5 request/phút/IP).
    /// </summary>
    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterRequest request)
    {
        var username = request.Username.Trim();
        // (1) chuẩn hóa dữ liệu 
        // Ví dụ: để coi Anh@Gmail.com và anh@gmail.com là một thì cần phải chuẩn hóa trước khi so trùng và lưu

        var email = request.Email.Trim().ToLowerInvariant();  

        // (2) check trùng (collation mặc định của SQL Server không phân biệt hoa/thường)
        var conflict = await FindDuplicateAsync(username, email);
        if (conflict is not null)
            return conflict;

        var user = new User
        {
            Username = username,
            Email = email,

            // (3) băm mật khẩu

            PasswordHash = PasswordHasher.Hash(request.Password),
            
            // role gán cứng = User

            Role = UserRole.User,
            Status = AccountStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        try
        {
            await _db.SaveChangesAsync(); // (5) INSERT vào bảng USER
        }
        catch (DbUpdateException)
        {
            // 2 request cùng username/email chạy song song: cả 2 qua bước (2), request sau bị unique index chặn.
            _db.Entry(user).State = EntityState.Detached;
            var duplicate = await FindDuplicateAsync(username, email);
            if (duplicate is not null) return duplicate;
            throw;
        }

        var token = _jwt.GenerateToken(user); // cập nhật JWT luôn

        return StatusCode(StatusCodes.Status201Created, new AuthResponseDto(token, Mapper.ToUser(user)));
    }

    /// <summary>
    /// UC02 – Login. Dùng cho cả User và Administrator (Guest không có tài khoản).
    /// Sai thông tin -> 401 INVALID_CREDENTIALS; tài khoản bị khoá -> 403 ACCOUNT_BLOCKED. Rate limit "auth".
    /// </summary>
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginRequest request)
    {
        // Không ToLower(): collation CI của SQL Server đã so sánh không phân biệt hoa/thường,
        // và ToLower() trên cột làm mất khả năng dùng unique index.
        var key = request.UsernameOrEmail.Trim();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == key || u.Email == key);

        // A2 – Incorrect credentials. Không tìm thấy user vẫn chạy PBKDF2 giả để thời gian phản hồi như nhau.
        var passwordOk = user is null
            ? PasswordHasher.VerifyDummy(request.Password)
            : PasswordHasher.Verify(request.Password, user.PasswordHash);
        if (user is null || !passwordOk)
            return this.ApiProblem(StatusCodes.Status401Unauthorized, ErrorCodes.InvalidCredentials, "Invalid username/email or password.");

        // A3 – Account is inactive or blocked
        if (user.Status == AccountStatus.Blocked)
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.AccountBlocked, "This account has been blocked by an administrator.");

        var token = _jwt.GenerateToken(user);
        return Ok(new AuthResponseDto(token, Mapper.ToUser(user)));
    }

    /// <summary>
    /// UC03 – Logout. Token JWT không có trạng thái phía server nên hành động thật sự là
    /// client xoá token đang lưu; endpoint này chỉ xác nhận và tồn tại cho đầy đủ luồng UC03.
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout() => NoContent();

    /// <summary>409 USERNAME_TAKEN / EMAIL_TAKEN nếu username hoặc email đã được dùng; null nếu không trùng.</summary>
    private async Task<ActionResult?> FindDuplicateAsync(string username, string email)
    {
        if (await _db.Users.AnyAsync(u => u.Username == username))
            return this.ApiProblem(StatusCodes.Status409Conflict, ErrorCodes.UsernameTaken, "Username already exists.");

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return this.ApiProblem(StatusCodes.Status409Conflict, ErrorCodes.EmailTaken, "Email already exists.");

        return null;
    }

    /// <summary>Trả về thông tin tài khoản đang đăng nhập.</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserDto>> Me()
    {
        var user = await _db.Users.AsNoTracking().FirstAsync(u => u.UserId == User.GetUserId());
        return Ok(Mapper.ToUser(user));
    }
}
