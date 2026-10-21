using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuizApp.Application.Services.Admin;

namespace QuizApp.Api.Controllers;

/// <summary>
/// UC18 – Manage Users, UC19 – Manage System Quizzes, UC20 – Moderate Content.
/// Toàn bộ endpoint chỉ dành cho actor Administrator.
/// Controller chỉ nhận request, gọi <see cref="IAdminService"/> và chuyển Result thành HTTP response.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Administrator")]
[Produces("application/json")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _admin;

    public AdminController(IAdminService admin) => _admin = admin;

    /// <summary>
    /// UC18 – danh sách tài khoản (phân trang). search lọc theo username hoặc email;
    /// sort = newest (mặc định) | oldest | username.
    /// </summary>
    [HttpGet("users")]
    [ProducesResponseType(typeof(PagedResult<UserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsers([FromQuery] string? search, [FromQuery] PageQuery paging, CancellationToken ct) =>
        this.ToOk(await _admin.GetUsersAsync(search, paging, ct));

    /// <summary>UC18 – khoá/mở khoá tài khoản.</summary>
    [HttpPut("users/{userId:int}/status")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUserStatus(int userId, [FromBody] UpdateUserStatusRequest request, CancellationToken ct) =>
        this.ToOk(await _admin.UpdateUserStatusAsync(userId, request, ct));

    /// <summary>
    /// UC19 – danh sách Quiz trong hệ thống (Active + Removed; Quiz chủ sở hữu đã xoá không hiển thị) để kiểm duyệt.
    /// search lọc theo tiêu đề; status = Active | Removed (bỏ trống = cả hai); phân trang, sort = newest | oldest | title.
    /// </summary>
    [HttpGet("quizzes")]
    [ProducesResponseType(typeof(PagedResult<QuizListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetAllQuizzes([FromQuery] string? search, [FromQuery] string? status, [FromQuery] PageQuery paging, CancellationToken ct) =>
        this.ToOk(await _admin.GetAllQuizzesAsync(search, status, paging, ct));

    /// <summary>UC19/UC20 – đổi trạng thái kiểm duyệt của 1 Quiz (Active/Removed).</summary>
    [HttpPut("quizzes/{quizId:int}/status")]
    [ProducesResponseType(typeof(QuizListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ModerateQuiz(int quizId, [FromBody] UpdateContentStatusRequest request, CancellationToken ct) =>
        this.ToOk(await _admin.ModerateQuizAsync(quizId, request, ct));

    /// <summary>
    /// UC20 bước 2–3 – danh sách câu hỏi để kiểm duyệt, thuộc MỌI Question Bank (kể cả câu chưa nằm trong Quiz nào).
    /// search lọc theo nội dung; status = Active | Removed (mặc định: cả hai). Câu đã bị chủ sở hữu xoá (Deleted) không hiển thị.
    /// </summary>
    [HttpGet("questions")]
    [ProducesResponseType(typeof(List<AdminQuestionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetQuestions([FromQuery] string? search, [FromQuery] string? status, CancellationToken ct) =>
        this.ToOk(await _admin.GetQuestionsAsync(search, status, ct));

    /// <summary>UC20 – đổi trạng thái kiểm duyệt của 1 Question. Trả về QuestionDto (không phải AdminQuestionDto).</summary>
    [HttpPut("questions/{questionId:int}/status")]
    [ProducesResponseType(typeof(QuestionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ModerateQuestion(int questionId, [FromBody] UpdateContentStatusRequest request, CancellationToken ct) =>
        this.ToOk(await _admin.ModerateQuestionAsync(questionId, request, ct));
}
