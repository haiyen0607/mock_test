using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuizApp.Application.Services.Quizzes;

namespace QuizApp.Api.Controllers;

/// <summary>
/// Quiz Discovery (UC04–UC06, Guest/User) và Quiz Management (UC11/UC12/UC14, User).
/// Controller chỉ nhận request, gọi <see cref="IQuizService"/> và chuyển Result thành HTTP response.
/// </summary>
[ApiController]
[Route("api/quizzes")]
[Produces("application/json")]
public class QuizzesController : ControllerBase
{
    private readonly IQuizService _quizzes;

    public QuizzesController(IQuizService quizzes) => _quizzes = quizzes;

    /// <summary>
    /// UC04/UC05 – Browse/Search Public Quizzes (phân trang). search lọc theo Title (không phân biệt hoa/thường);
    /// sort = newest | oldest | title. Lọc/đếm hoàn toàn trong SQL (A4).
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<QuizListItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPublicQuizzes([FromQuery] string? search, [FromQuery] PageQuery paging, CancellationToken ct) =>
        this.ToOk(await _quizzes.GetPublicQuizzesAsync(search, paging, ct));

    /// <summary>UC12 – danh sách Quiz thuộc sở hữu của User đang đăng nhập (mọi trạng thái trừ đã xoá), phân trang.</summary>
    [HttpGet("mine")]
    [Authorize]
    [ProducesResponseType(typeof(PagedResult<QuizListItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyQuizzes([FromQuery] PageQuery paging, CancellationToken ct) =>
        this.ToOk(await _quizzes.GetMyQuizzesAsync(paging, ct));

    /// <summary>UC06 – View Quiz Details. Public nếu đã publish; nếu không, chỉ chủ sở hữu hoặc Admin mới xem được.</summary>
    [HttpGet("{quizId:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(QuizDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQuiz(int quizId, CancellationToken ct) =>
        this.ToOk(await _quizzes.GetQuizAsync(quizId, ct));

    /// <summary>UC11 – Create Quiz. Quiz mới luôn tạo ở trạng thái Private (chưa publish).</summary>
    [HttpPost]
    [Authorize]
    [ProducesResponseType(typeof(QuizDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateQuiz([FromBody] QuizRequest request, CancellationToken ct) =>
        this.ToActionResult(await _quizzes.CreateQuizAsync(request, ct),
            dto => CreatedAtAction(nameof(GetQuiz), new { quizId = dto.QuizId }, dto));

    /// <summary>UC12 – Manage Own Quiz: cập nhật thông tin cơ bản. Chỉ chủ sở hữu được sửa.</summary>
    [HttpPut("{quizId:int}")]
    [Authorize]
    [ProducesResponseType(typeof(QuizDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateQuiz(int quizId, [FromBody] QuizRequest request, CancellationToken ct) =>
        this.ToOk(await _quizzes.UpdateQuizAsync(quizId, request, ct));

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
    public async Task<IActionResult> DeleteQuiz(int quizId, CancellationToken ct) =>
        this.ToNoContent(await _quizzes.DeleteQuizAsync(quizId, ct));

    /// <summary>UC14 – Publish/Unpublish Quiz. Publish yêu cầu Quiz có ít nhất 1 câu hỏi (A1).</summary>
    [HttpPut("{quizId:int}/publish")]
    [Authorize]
    [ProducesResponseType(typeof(QuizDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetPublish(int quizId, [FromBody] PublishQuizRequest request, CancellationToken ct) =>
        this.ToOk(await _quizzes.SetPublishAsync(quizId, request, ct));
}
