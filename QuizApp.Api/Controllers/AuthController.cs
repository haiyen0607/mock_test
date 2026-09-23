using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizApp.Api.Data;
using QuizApp.Api.Dtos;
using QuizApp.Api.Entities;
using QuizApp.Api.Enums;
using QuizApp.Api.Security;

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

    /// <summary>UC01 – Register Account. Guest tạo tài khoản User mới.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterRequest request)
    {
        var username = request.Username.Trim();
        // (1) chuẩn hóa dữ liệu 
        // Ví dụ: để coi Anh@Gmail.com và anh@gmail.com là một thì cần phải chuẩn hóa trước khi so trùng và lưu

        var email = request.Email.Trim().ToLowerInvariant();  

        // (2) check trùng
        var exists = await _db.Users.AnyAsync(u => u.Username == username || u.Email == email);
        if (exists)
        {
            ModelState.AddModelError("username", "Username or email already exists.");
            
            // trả về 400, format RFC 7807 giống lỗi validate tự động 

            return ValidationProblem(ModelState);
        }

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
        await _db.SaveChangesAsync(); // (5) INSERT vào bảng USER

        var token = _jwt.GenerateToken(user); // cập nhật JWT luôn

        return StatusCode(StatusCodes.Status201Created, new AuthResponseDto(token, Mapper.ToUser(user)));
    }

    /// <summary>UC02 – Login. Dùng cho cả User và Administrator (Guest không có tài khoản).</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginRequest request)
    {
        var key = request.UsernameOrEmail.Trim().ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == key || u.Email == key);

        // A2 – Incorrect credentials
        if (user is null || !PasswordHasher.Verify(request.Password, user.PasswordHash))
            return Problem(detail: "Invalid username/email or password.", statusCode: StatusCodes.Status401Unauthorized);

        // A3 – Account is inactive or blocked
        if (user.Status == AccountStatus.Blocked)
            return Problem(detail: "This account has been blocked by an administrator.", statusCode: StatusCodes.Status401Unauthorized);

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
