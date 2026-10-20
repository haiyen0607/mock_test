using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

    /// <summary>
    /// UC04/UC05 – Browse/Search Public Quizzes (phân trang). search lọc theo Title (không phân biệt hoa/thường);
    /// sort = newest | oldest | title. Lọc/đếm hoàn toàn trong SQL (A4).
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<QuizListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<QuizListItemDto>>> GetPublicQuizzes([FromQuery] string? search, [FromQuery] PageQuery paging)
    {
        // Quiz mà mọi câu hỏi đều đã bị Admin gỡ thì không còn làm được -> không hiển thị (UC20 A2)
        var query = _db.Quizzes
            .AsNoTracking()
            .Where(q => q.IsPublished && q.Status == ContentStatus.Active
                        && q.QuizQuestions.Any(qq => qq.Question!.Status == ContentStatus.Active));

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(q => q.Title.Contains(search.Trim()));

        return Ok(await SortQuizzes(query, paging.SortKey).Select(Mapper.ListItemProjection).ToPagedResultAsync(paging));
    }

    /// <summary>UC12 – danh sách Quiz thuộc sở hữu của User đang đăng nhập (mọi trạng thái trừ đã xoá), phân trang.</summary>
    [HttpGet("mine")]
    [Authorize]
    [ProducesResponseType(typeof(PagedResult<QuizListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<QuizListItemDto>>> GetMyQuizzes([FromQuery] PageQuery paging)
    {
        var userId = User.GetUserId();

        var query = _db.Quizzes
            .AsNoTracking()
            .Where(q => q.OwnerId == userId && q.Status != ContentStatus.Deleted);

        return Ok(await SortQuizzes(query, paging.SortKey).Select(Mapper.ListItemProjection).ToPagedResultAsync(paging));
    }

    /// <summary>Sắp xếp danh sách Quiz: newest (mặc định) | oldest | title. Luôn kèm QuizId để phân trang ổn định.</summary>
    internal static IQueryable<Quiz> SortQuizzes(IQueryable<Quiz> query, string sortKey) => sortKey switch
    {
        "oldest" => query.OrderBy(q => q.CreatedAt).ThenBy(q => q.QuizId),
        "title" => query.OrderBy(q => q.Title).ThenBy(q => q.QuizId),
        _ => query.OrderByDescending(q => q.CreatedAt).ThenByDescending(q => q.QuizId)
    };

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
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.QuestionBank)
            .AsSplitQuery()
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted);

        if (quiz is null || !CanView(quiz))
            return QuizNotFound(quizId);

        // Chủ sở hữu/Admin thấy cả câu bị gỡ (kèm Status); người khác chỉ thấy câu còn Active (UC20 A2).
        // CanEdit: chỉ câu thuộc bank mà người xem quản lý (không sửa được câu tái sử dụng từ bank của người khác).
        return Ok(Mapper.ToDetail(quiz, includeRemoved: User.CanManage(quiz.OwnerId), canManageBank: User.CanManage));
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
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted);

        if (quiz is null)
            return QuizNotFound(quizId);

        // A4 – User does not own the Quiz
        if (!User.CanManage(quiz.OwnerId))
            return NotOwner();

        quiz.Title = request.Title.Trim();
        quiz.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        quiz.Duration = request.Duration;

        await _db.SaveChangesAsync();
        return Ok(Mapper.ToDetail(quiz));
    }

    /// <summary>
    /// UC12 – Manage Own Quiz: xoá MỀM Quiz (Status = Deleted, IsPublished = false).
    /// Lượt làm bài của mọi người vẫn được giữ để "Bài đã làm"/kết quả cũ vẫn xem được; Quiz biến mất khỏi
    /// mọi danh sách/chi tiết/bắt đầu làm bài. Liên kết câu hỏi (QuizQuestion) được gỡ để Question/Bank
    /// không bị coi là "đang được dùng" bởi Quiz đã xoá.
    /// </summary>
    [HttpDelete("{quizId:int}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteQuiz(int quizId)
    {
        var quiz = await _db.Quizzes.FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted);
        if (quiz is null)
            return QuizNotFound(quizId);

        if (!User.CanManage(quiz.OwnerId))
            return NotOwner();

        await using var transaction = await _db.Database.BeginTransactionAsync();

        // Không xoá Question gốc trong Question Bank và không xoá lượt làm bài — chỉ gỡ liên kết câu hỏi.
        await _db.QuizQuestions.Where(qq => qq.QuizId == quizId).ExecuteDeleteAsync();
        quiz.Status = ContentStatus.Deleted;
        quiz.IsPublished = false;
        await _db.SaveChangesAsync();

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
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted);

        if (quiz is null)
            return QuizNotFound(quizId);

        // A3 – User does not own the Quiz
        if (!User.CanManage(quiz.OwnerId))
            return NotOwner();

        // A1 – Quiz does not contain valid content (bước 3: "System validates the Quiz and its questions")
        if (request.Publish)
        {
            var errors = ValidateForPublish(quiz);
            if (errors.Count > 0)
            {
                foreach (var error in errors) ModelState.AddModelError("questions", error);
                return ValidationProblem(ModelState); // 400 – liệt kê rõ câu nào cần bổ sung
            }
        }

        quiz.IsPublished = request.Publish; // A4 – Unpublish khi request.Publish = false
        await _db.SaveChangesAsync();

        return Ok(Mapper.ToDetail(quiz));
    }

    /// <summary>Guest/User chỉ xem được Quiz đã Public và chưa bị Admin gỡ; chủ sở hữu/Admin xem được mọi trạng thái (trừ Deleted).</summary>
    private bool CanView(Quiz quiz)
    {
        var isPublicVisible = quiz.IsPublished && quiz.Status == ContentStatus.Active;
        return isPublicVisible || User.CanManage(quiz.OwnerId);
    }

    private ObjectResult QuizNotFound(int quizId) =>
        this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.QuizNotFound, $"Quiz {quizId} was not found.");

    private ObjectResult NotOwner() =>
        this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this quiz.");

    /// <summary>
    /// UC14 A1 – điều kiện để Publish: có ít nhất 1 câu hỏi còn Active, và từng câu phải đủ nội dung
    /// (câu trắc nghiệm: ≥ 2 đáp án, ≥ 1 đáp án đúng; SingleChoice/TrueFalse: đúng 1 đáp án đúng).
    /// Câu bị Admin gỡ (Removed) không được tính và không chặn việc publish.
    /// </summary>
    internal static List<string> ValidateForPublish(Quiz quiz)
    {
        var errors = new List<string>();
        var active = quiz.ActiveQuestions();

        if (active.Count == 0)
        {
            errors.Add("A quiz must have at least one active question before it can be published.");
            return errors;
        }

        for (var i = 0; i < active.Count; i++)
        {
            var question = active[i].Question!;
            var reason = QuestionTypeRules.ValidateForPlay(question.QuestionType,
                question.Answers.Count, question.Answers.Count(a => a.IsCorrect));

            if (reason is not null)
                errors.Add($"Question {i + 1} (id {question.QuestionId}): {reason}");
        }

        return errors;
    }
}
