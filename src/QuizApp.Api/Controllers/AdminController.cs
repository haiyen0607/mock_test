//Controllers/ trả lời câu hỏi: "Khi request đến thì làm gì, theo trình tự nào?"
// Nhận request -> gọi DB -> quyểt định trả về 200, 402 hay 404
// -> Là người điều phối luồng xử lý


using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace QuizApp.Api.Controllers;

/// <summary>
/// UC18 – Manage Users, UC19 – Manage System Quizzes, UC20 – Moderate Content.
/// Toàn bộ endpoint chỉ dành cho actor Administrator.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Administrator")]
[Produces("application/json")]
public class AdminController : ControllerBase
{
    private readonly QuizDbContext _db;

    public AdminController(QuizDbContext db) => _db = db;

    /// <summary>
    /// UC18 – danh sách tài khoản (phân trang). search lọc theo username hoặc email;
    /// sort = newest (mặc định) | oldest | username.
    /// </summary>
    [HttpGet("users")]
    [ProducesResponseType(typeof(PagedResult<UserDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<UserDto>>> GetUsers([FromQuery] string? search, [FromQuery] PageQuery paging)
    {
        var query = _db.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var key = search.Trim();
            query = query.Where(u => u.Username.Contains(key) || u.Email.Contains(key));
        }

        query = paging.SortKey switch
        {
            "oldest" => query.OrderBy(u => u.CreatedAt).ThenBy(u => u.UserId),
            "username" => query.OrderBy(u => u.Username),
            _ => query.OrderByDescending(u => u.CreatedAt).ThenByDescending(u => u.UserId)
        };

        return Ok(await query
            .Select(u => new UserDto(u.UserId, u.Username, u.Email, u.Role.ToString(), u.Status.ToString(), u.CreatedAt))
            .ToPagedResultAsync(paging));
    }

    /// <summary>UC18 – khoá/mở khoá tài khoản.</summary>
    [HttpPut("users/{userId:int}/status")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserDto>> UpdateUserStatus(int userId, [FromBody] UpdateUserStatusRequest request)
    {
        // Enum.TryParse nhận cả chuỗi số ("5") -> phải kiểm tra thêm IsDefined
        if (int.TryParse(request.Status, out _)
            || !Enum.TryParse<AccountStatus>(request.Status, ignoreCase: true, out var status)
            || !Enum.IsDefined(status))
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidStatus, "Status must be Active or Blocked.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId);
        if (user is null)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.UserNotFound, $"User {userId} was not found."); // A4

        // Không cho Admin tự khoá chính mình (sẽ mất quyền quản trị ngay lập tức)
        if (user.UserId == User.GetUserId())
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, "You cannot change the status of your own account.");

        // Không cho khoá tài khoản Administrator khác qua API này
        if (status == AccountStatus.Blocked && user.Role == UserRole.Administrator)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, "Administrator accounts cannot be blocked.");

        user.Status = status;
        await _db.SaveChangesAsync();

        return Ok(Mapper.ToUser(user));
    }

    /// <summary>
    /// UC19 – danh sách Quiz trong hệ thống (Active + Removed; Quiz chủ sở hữu đã xoá không hiển thị) để kiểm duyệt.
    /// search lọc theo tiêu đề; status = Active | Removed (bỏ trống = cả hai); phân trang, sort = newest | oldest | title.
    /// </summary>
    [HttpGet("quizzes")]
    [ProducesResponseType(typeof(PagedResult<QuizListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PagedResult<QuizListItemDto>>> GetAllQuizzes([FromQuery] string? search, [FromQuery] string? status, [FromQuery] PageQuery paging)
    {
        var query = _db.Quizzes.AsNoTracking().Where(q => q.Status != ContentStatus.Deleted);

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!ContentStatusRules.TryParseModeration(status, out var statusFilter))
                return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidStatus, "Status must be Active or Removed.");
            query = query.Where(q => q.Status == statusFilter);
        }

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(q => q.Title.Contains(search.Trim()));

        return Ok(await QuizzesController.SortQuizzes(query, paging.SortKey)
            .Select(Mapper.ListItemProjection)
            .ToPagedResultAsync(paging));
    }

    /// <summary>UC19/UC20 – đổi trạng thái kiểm duyệt của 1 Quiz (Active/Removed).</summary>
    [HttpPut("quizzes/{quizId:int}/status")]
    [ProducesResponseType(typeof(QuizListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QuizListItemDto>> ModerateQuiz(int quizId, [FromBody] UpdateContentStatusRequest request)
    {
        if (!ContentStatusRules.TryParseModeration(request.Status, out var status))
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidStatus, "Status must be Active or Removed.");

        var quiz = await _db.Quizzes.Include(q => q.Owner).Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question)
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted);

        if (quiz is null)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.QuizNotFound, $"Quiz {quizId} was not found."); // A4 – Content no longer exists

        quiz.Status = status; // A2 – Removed gỡ khỏi truy cập công khai (GetPublicQuizzes lọc theo Status Active)
        await _db.SaveChangesAsync();

        return Ok(Mapper.ToListItem(quiz));
    }

    /// <summary>
    /// UC20 bước 2–3 – danh sách câu hỏi để kiểm duyệt, thuộc MỌI Question Bank (kể cả câu chưa nằm trong Quiz nào).
    /// search lọc theo nội dung; status = Active | Removed (mặc định: cả hai). Câu đã bị chủ sở hữu xoá (Deleted) không hiển thị.
    /// </summary>
    [HttpGet("questions")]
    [ProducesResponseType(typeof(List<AdminQuestionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<AdminQuestionDto>>> GetQuestions([FromQuery] string? search, [FromQuery] string? status)
    {
        var query = _db.Questions.AsNoTracking()
            .Include(q => q.QuestionBank).ThenInclude(b => b!.Owner)
            .Include(q => q.Answers)
            .Include(q => q.QuizQuestions)
            .Where(q => q.Status != ContentStatus.Deleted);

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!ContentStatusRules.TryParseModeration(status, out var filter))
                return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidStatus, "Status must be Active or Removed.");
            query = query.Where(q => q.Status == filter);
        }

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(q => q.Content.Contains(search.Trim()));

        var questions = await query.OrderByDescending(q => q.CreatedAt).Take(200).ToListAsync();
        return Ok(questions.Select(Mapper.ToAdminQuestion).ToList());
    }

    /// <summary>UC20 – đổi trạng thái kiểm duyệt của 1 Question. Trả về QuestionDto (không phải AdminQuestionDto).</summary>
    [HttpPut("questions/{questionId:int}/status")]
    [ProducesResponseType(typeof(QuestionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QuestionDto>> ModerateQuestion(int questionId, [FromBody] UpdateContentStatusRequest request)
    {
        if (!ContentStatusRules.TryParseModeration(request.Status, out var status))
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidStatus, "Status must be Active or Removed.");

        var question = await _db.Questions.Include(q => q.Answers).FirstOrDefaultAsync(q => q.QuestionId == questionId);
        // Câu đã bị chủ sở hữu xoá (Deleted) coi như không còn tồn tại – A4
        if (question is null || question.Status == ContentStatus.Deleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.QuestionNotFound, $"Question {questionId} was not found.");

        question.Status = status;
        await _db.SaveChangesAsync();

        return Ok(Mapper.ToQuestion(question));
    }
}
