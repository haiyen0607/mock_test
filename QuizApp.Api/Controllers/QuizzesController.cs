using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizApp.Api.Data;
using QuizApp.Api.Dtos;
using QuizApp.Api.Entities;
using QuizApp.Api.Enums;
using QuizApp.Api.Security;

namespace QuizApp.Api.Controllers;

/// <summary>
/// Quiz Discovery (UC04–UC06, Guest/User) và Quiz Management (UC11/UC12/UC14, User).
/// </summary>
[ApiController]
[Route("api/quizzes")]
[Produces("application/json")]
public class QuizzesController : ControllerBase
{
    private readonly QuizDbContext _db;

    public QuizzesController(QuizDbContext db) => _db = db;

    /// <summary>UC04/UC05 – Browse/Search Public Quizzes. search lọc theo Title (không phân biệt hoa/thường).</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(List<QuizListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<QuizListItemDto>>> GetPublicQuizzes([FromQuery] string? search)
    {
        var query = _db.Quizzes
            .AsNoTracking()
            .Include(q => q.Owner)
            .Include(q => q.QuizQuestions)
            .Where(q => q.IsPublished && q.Status == ContentStatus.Active);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(q => q.Title.Contains(search));

        var quizzes = await query.OrderByDescending(q => q.CreatedAt).ToListAsync();
        return Ok(quizzes.Select(Mapper.ToListItem).ToList());
    }

    /// <summary>UC12 – danh sách toàn bộ Quiz thuộc sở hữu của User đang đăng nhập, mọi trạng thái.</summary>
    [HttpGet("mine")]
    [Authorize]
    [ProducesResponseType(typeof(List<QuizListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<QuizListItemDto>>> GetMyQuizzes()
    {
        var userId = User.GetUserId();

        var quizzes = await _db.Quizzes
            .AsNoTracking()
            .Include(q => q.Owner)
            .Include(q => q.QuizQuestions)
            .Where(q => q.OwnerId == userId)
            .OrderByDescending(q => q.CreatedAt)
            .ToListAsync();

        return Ok(quizzes.Select(Mapper.ToListItem).ToList());
    }

    /// <summary>UC06 – View Quiz Details. Public nếu đã publish; nếu không, chỉ chủ sở hữu hoặc Admin mới xem được.</summary>
    [HttpGet("{quizId:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(QuizDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QuizDetailDto>> GetQuiz(int quizId)
    {
        var quiz = await _db.Quizzes
            .AsNoTracking()
            .Include(q => q.Owner)
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question)
            .FirstOrDefaultAsync(q => q.QuizId == quizId);

        if (quiz is null || !CanView(quiz))
            return Problem(detail: $"Quiz {quizId} was not found.", statusCode: StatusCodes.Status404NotFound);

        return Ok(Mapper.ToDetail(quiz));
    }

    /// <summary>UC11 – Create Quiz. Quiz mới luôn tạo ở trạng thái Private (chưa publish).</summary>
    [HttpPost]
    [Authorize]
    [ProducesResponseType(typeof(QuizDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<QuizDetailDto>> CreateQuiz([FromBody] QuizRequest request)
    {
        var quiz = new Quiz
        {
            OwnerId = User.GetUserId(),
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Duration = request.Duration,
            IsPublished = false,
            Status = ContentStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _db.Quizzes.Add(quiz);
        await _db.SaveChangesAsync();
        await _db.Entry(quiz).Reference(q => q.Owner).LoadAsync();

        return CreatedAtAction(nameof(GetQuiz), new { quizId = quiz.QuizId }, Mapper.ToDetail(quiz));
    }

    /// <summary>UC12 – Manage Own Quiz: cập nhật thông tin cơ bản. Chỉ chủ sở hữu được sửa.</summary>
    [HttpPut("{quizId:int}")]
    [Authorize]
    [ProducesResponseType(typeof(QuizDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QuizDetailDto>> UpdateQuiz(int quizId, [FromBody] QuizRequest request)
    {
        var quiz = await _db.Quizzes
            .Include(q => q.Owner)
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question)
            .FirstOrDefaultAsync(q => q.QuizId == quizId);

        if (quiz is null)
            return Problem(detail: $"Quiz {quizId} was not found.", statusCode: StatusCodes.Status404NotFound);

        // A4 – User does not own the Quiz
        if (quiz.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this quiz.", statusCode: StatusCodes.Status403Forbidden);

        quiz.Title = request.Title.Trim();
        quiz.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        quiz.Duration = request.Duration;

        await _db.SaveChangesAsync();
        return Ok(Mapper.ToDetail(quiz));
    }

    /// <summary>UC12 – Manage Own Quiz: xoá Quiz cùng toàn bộ liên kết câu hỏi và các lượt làm bài.</summary>
    [HttpDelete("{quizId:int}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteQuiz(int quizId)
    {
        var quiz = await _db.Quizzes.FirstOrDefaultAsync(q => q.QuizId == quizId);
        if (quiz is null)
            return Problem(detail: $"Quiz {quizId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (quiz.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this quiz.", statusCode: StatusCodes.Status403Forbidden);

        await using var transaction = await _db.Database.BeginTransactionAsync();

        // Không xoá Question gốc trong Question Bank — chỉ gỡ liên kết và dữ liệu thuộc về Quiz này.
        var attemptIds = await _db.QuizAttempts.Where(a => a.QuizId == quizId).Select(a => a.AttemptId).ToListAsync();
        await _db.AttemptAnswers.Where(aa => attemptIds.Contains(aa.AttemptId)).ExecuteDeleteAsync();
        await _db.QuizAttempts.Where(a => a.QuizId == quizId).ExecuteDeleteAsync();
        await _db.QuizQuestions.Where(qq => qq.QuizId == quizId).ExecuteDeleteAsync();
        await _db.Quizzes.Where(q => q.QuizId == quizId).ExecuteDeleteAsync();

        await transaction.CommitAsync();
        return NoContent();
    }

    /// <summary>UC14 – Publish/Unpublish Quiz. Publish yêu cầu Quiz có ít nhất 1 câu hỏi (A1).</summary>
    [HttpPut("{quizId:int}/publish")]
    [Authorize]
    [ProducesResponseType(typeof(QuizDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QuizDetailDto>> SetPublish(int quizId, [FromBody] PublishQuizRequest request)
    {
        var quiz = await _db.Quizzes
            .Include(q => q.Owner)
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question)
            .FirstOrDefaultAsync(q => q.QuizId == quizId);

        if (quiz is null)
            return Problem(detail: $"Quiz {quizId} was not found.", statusCode: StatusCodes.Status404NotFound);

        // A3 – User does not own the Quiz
        if (quiz.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this quiz.", statusCode: StatusCodes.Status403Forbidden);

        // A1 – Quiz does not contain valid content
        if (request.Publish && quiz.QuizQuestions.Count == 0)
            return Problem(detail: "A quiz must have at least one question before it can be published.", statusCode: StatusCodes.Status400BadRequest);

        quiz.IsPublished = request.Publish; // A4 – Unpublish khi request.Publish = false
        await _db.SaveChangesAsync();

        return Ok(Mapper.ToDetail(quiz));
    }

    /// <summary>Guest/User chỉ xem được Quiz đã Public và chưa bị Admin gỡ; chủ sở hữu/Admin xem được mọi trạng thái.</summary>
    private bool CanView(Quiz quiz)
    {
        var isPublicVisible = quiz.IsPublished && quiz.Status == ContentStatus.Active;
        if (isPublicVisible) return true;

        if (!(User.Identity?.IsAuthenticated ?? false)) return false;
        return quiz.OwnerId == User.GetUserId() || User.IsAdministrator();
    }
}
