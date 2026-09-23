//Controllers/ trả lời câu hỏi: "Khi request đến thì làm gì, theo trình tự nào?"
// Nhận request -> gọi DB -> quyểt định trả về 200, 402 hay 404
// -> Là người điều phối luồng xử lý


using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizApp.Api.Data;
using QuizApp.Api.Dtos;
using QuizApp.Api.Enums;

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

    /// <summary>UC18 – danh sách toàn bộ tài khoản.</summary>
    [HttpGet("users")]
    public async Task<ActionResult<List<UserDto>>> GetUsers()
    {
        var users = await _db.Users.AsNoTracking().OrderBy(u => u.UserId).ToListAsync();
        return Ok(users.Select(Mapper.ToUser).ToList());
    }

    /// <summary>UC18 – khoá/mở khoá tài khoản.</summary>
    [HttpPut("users/{userId:int}/status")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserDto>> UpdateUserStatus(int userId, [FromBody] UpdateUserStatusRequest request)
    {
        if (!Enum.TryParse<AccountStatus>(request.Status, ignoreCase: true, out var status))
            return Problem(detail: "Status must be Active or Blocked.", statusCode: StatusCodes.Status400BadRequest);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId);
        if (user is null)
            return Problem(detail: $"User {userId} was not found.", statusCode: StatusCodes.Status404NotFound); // A4

        user.Status = status;
        await _db.SaveChangesAsync();

        return Ok(Mapper.ToUser(user));
    }

    /// <summary>UC19 – danh sách toàn bộ Quiz trong hệ thống (mọi trạng thái) để kiểm duyệt.</summary>
    [HttpGet("quizzes")]
    public async Task<ActionResult<List<QuizListItemDto>>> GetAllQuizzes()
    {
        var quizzes = await _db.Quizzes.AsNoTracking()
            .Include(q => q.Owner).Include(q => q.QuizQuestions)
            .OrderByDescending(q => q.CreatedAt).ToListAsync();

        return Ok(quizzes.Select(Mapper.ToListItem).ToList());
    }

    /// <summary>UC19/UC20 – đổi trạng thái kiểm duyệt của 1 Quiz (Active/Removed).</summary>
    [HttpPut("quizzes/{quizId:int}/status")]
    [ProducesResponseType(typeof(QuizListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QuizListItemDto>> ModerateQuiz(int quizId, [FromBody] UpdateContentStatusRequest request)
    {
        if (!Enum.TryParse<ContentStatus>(request.Status, ignoreCase: true, out var status))
            return Problem(detail: "Status must be Active or Removed.", statusCode: StatusCodes.Status400BadRequest);

        var quiz = await _db.Quizzes.Include(q => q.Owner).Include(q => q.QuizQuestions)
            .FirstOrDefaultAsync(q => q.QuizId == quizId);

        if (quiz is null)
            return Problem(detail: $"Quiz {quizId} was not found.", statusCode: StatusCodes.Status404NotFound); // A4 – Content no longer exists

        quiz.Status = status; // A2 – Removed gỡ khỏi truy cập công khai (GetPublicQuizzes lọc theo Status Active)
        await _db.SaveChangesAsync();

        return Ok(Mapper.ToListItem(quiz));
    }

    /// <summary>UC20 – đổi trạng thái kiểm duyệt của 1 Question.</summary>
    [HttpPut("questions/{questionId:int}/status")]
    [ProducesResponseType(typeof(QuestionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QuestionDto>> ModerateQuestion(int questionId, [FromBody] UpdateContentStatusRequest request)
    {
        if (!Enum.TryParse<ContentStatus>(request.Status, ignoreCase: true, out var status))
            return Problem(detail: "Status must be Active or Removed.", statusCode: StatusCodes.Status400BadRequest);

        var question = await _db.Questions.Include(q => q.Answers).FirstOrDefaultAsync(q => q.QuestionId == questionId);
        if (question is null)
            return Problem(detail: $"Question {questionId} was not found.", statusCode: StatusCodes.Status404NotFound);

        question.Status = status;
        await _db.SaveChangesAsync();

        return Ok(Mapper.ToQuestion(question));
    }
}
