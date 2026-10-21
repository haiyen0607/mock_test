using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using QuizApp.Application.Services.Auth;

namespace QuizApp.Api.Controllers;

/// <summary>
/// Authentication cho actor Guest/User/Administrator (UC01 – UC03).
/// Controller chỉ nhận request, gọi <see cref="IAuthService"/> và chuyển Result thành HTTP response.
/// </summary>
[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

    /// <summary>
    /// UC01 – Register Account. Guest tạo tài khoản User mới.
    /// Trùng username -> 409 USERNAME_TAKEN, trùng email -> 409 EMAIL_TAKEN. Rate limit "auth".
    /// </summary>
    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct) =>
        this.ToActionResult(await _auth.RegisterAsync(request, ct),
            response => StatusCode(StatusCodes.Status201Created, response));

    /// <summary>
    /// UC02 – Login. Dùng cho cả User và Administrator (Guest không có tài khoản).
    /// Sai thông tin -> 401 INVALID_CREDENTIALS; tài khoản bị khoá -> 403 ACCOUNT_BLOCKED. Rate limit "auth".
    /// </summary>
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct) =>
        this.ToOk(await _auth.LoginAsync(request, ct));

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
    public async Task<IActionResult> Me(CancellationToken ct) =>
        this.ToOk(await _auth.GetCurrentUserAsync(ct));
}
