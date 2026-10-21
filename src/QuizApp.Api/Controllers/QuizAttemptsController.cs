using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using QuizApp.Application.Services.Attempts;

namespace QuizApp.Api.Controllers;

/// <summary>
/// UC07 – Try Trial Quiz (Guest), UC08 – Take Quiz (User), UC09 – Submit Quiz,
/// UC10 – View Quiz Result; A5 – Lịch sử làm bài, Chấm bài tự luận, Thống kê Quiz.
/// Controller chỉ nhận request, gọi <see cref="IAttemptService"/> / <see cref="IGradingService"/> và chuyển Result thành HTTP response.
/// </summary>
[ApiController]
[Produces("application/json")]
public class QuizAttemptsController : ControllerBase
{
    private readonly IAttemptService _attempts;
    private readonly IGradingService _grading;

    public QuizAttemptsController(IAttemptService attempts, IGradingService grading)
    {
        _attempts = attempts;
        _grading = grading;
    }

    /// <summary>
    /// UC07 – Guest bắt đầu 1 lượt làm thử. Yêu cầu header "X-Guest-Id" (≤ 100 ký tự) do client tự sinh
    /// (vd. một GUID lưu ở trình duyệt). Rate limit "trial" theo IP (10 lượt/giờ) để đổi X-Guest-Id không làm thử vô hạn.
    /// </summary>
    [HttpPost("api/quizzes/{quizId:int}/trial")]
    [AllowAnonymous]
    [EnableRateLimiting("trial")]
    [ProducesResponseType(typeof(AttemptContentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StartTrial(int quizId, [FromHeader(Name = "X-Guest-Id")] string? guestId, CancellationToken ct) =>
        this.ToActionResult(await _attempts.StartTrialAsync(quizId, guestId, ct),
            content => StatusCode(StatusCodes.Status201Created, content));

    /// <summary>UC08 – User đã đăng nhập bắt đầu làm 1 Quiz công khai.</summary>
    [HttpPost("api/quizzes/{quizId:int}/attempts")]
    [Authorize]
    [ProducesResponseType(typeof(AttemptContentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StartAttempt(int quizId, CancellationToken ct) =>
        this.ToActionResult(await _attempts.StartAttemptAsync(quizId, ct),
            content => StatusCode(StatusCodes.Status201Created, content));

    /// <summary>
    /// UC08/UC09 (bước 1-3) – lấy lại nội dung Quiz đang làm (khi tải lại trang), không lộ đáp án đúng.
    /// Trả kèm StartedAt/ExpiresAt để client khôi phục đồng hồ. Attempt đã nộp -> 409 ATTEMPT_SUBMITTED.
    /// </summary>
    [HttpGet("api/attempts/{attemptId:int}/content")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AttemptContentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> GetContent(int attemptId, [FromHeader(Name = "X-Guest-Id")] string? guestId, CancellationToken ct) =>
        this.ToOk(await _attempts.GetContentAsync(attemptId, guestId, ct));

    /// <summary>UC09 – Submit Quiz: chấm tự động các câu có đáp án định nghĩa sẵn, các câu dạng văn bản chờ chấm thủ công (A3).</summary>
    [HttpPost("api/attempts/{attemptId:int}/submit")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(SubmitAttemptResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Submit(int attemptId, [FromHeader(Name = "X-Guest-Id")] string? guestId, [FromBody] SubmitAttemptRequest request, CancellationToken ct) =>
        this.ToOk(await _attempts.SubmitAsync(attemptId, guestId, request, ct));

    /// <summary>
    /// UC10 – View Quiz Result: chỉ xem được sau khi đã Submit. Vẫn xem được khi Quiz đã bị chủ sở hữu xoá (xoá mềm).
    /// - User: lộ đáp án đúng để đối chiếu.
    /// - Guest (lượt trial): AnswersHidden = true, Answers[].IsCorrect = null — chỉ thấy điểm và đúng/sai từng câu.
    /// </summary>
    [HttpGet("api/attempts/{attemptId:int}/result")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AttemptResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetResult(int attemptId, [FromHeader(Name = "X-Guest-Id")] string? guestId, CancellationToken ct) =>
        this.ToOk(await _attempts.GetResultAsync(attemptId, guestId, ct));

    /// <summary>
    /// A5 – "Bài đã làm": các lượt ĐÃ NỘP của User đang đăng nhập (không gồm trial), phân trang.
    /// sort = newest (mặc định, theo SubmittedAt) | oldest | title (theo tên Quiz). Quiz đã xoá vẫn hiện (QuizDeleted = true).
    /// </summary>
    [HttpGet("api/attempts/mine")]
    [Authorize]
    [ProducesResponseType(typeof(PagedResult<AttemptHistoryItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyAttempts([FromQuery] PageQuery paging, CancellationToken ct) =>
        this.ToOk(await _attempts.GetMyAttemptsAsync(paging, ct));

    /// <summary>
    /// A5 / UC09 A3 – danh sách câu trả lời văn bản cần chấm thủ công của 1 Quiz (chủ sở hữu/Admin), phân trang.
    /// Mặc định chỉ câu chờ chấm (IsCorrect = null); includeGraded=true để lấy cả câu đã chấm (chấm lại).
    /// Chỉ lượt đã nộp, không gồm trial. sort = newest (mặc định) | oldest (theo SubmittedAt).
    /// </summary>
    [HttpGet("api/quizzes/{quizId:int}/grading")]
    [Authorize]
    [ProducesResponseType(typeof(PagedResult<GradingItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGradingQueue(int quizId, [FromQuery] PageQuery paging, CancellationToken ct, [FromQuery] bool includeGraded = false) =>
        this.ToOk(await _grading.GetGradingQueueAsync(quizId, paging, includeGraded, ct));

    /// <summary>
    /// A5 / UC09 A3 – chủ Quiz/Admin chấm 1 câu trả lời văn bản (đúng/sai), rồi tính lại điểm của lượt làm bài
    /// (AttemptScorer – dùng chung với Submit). Câu đã chấm có thể chấm lại.
    /// </summary>
    [HttpPut("api/attempt-answers/{attemptAnswerId:int}/grade")]
    [Authorize]
    [ProducesResponseType(typeof(GradeResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> GradeAnswer(int attemptAnswerId, [FromBody] GradeAnswerRequest request, CancellationToken ct) =>
        this.ToOk(await _grading.GradeAnswerAsync(attemptAnswerId, request, ct));

    /// <summary>
    /// A5 – thống kê Quiz cho chủ sở hữu/Admin: số lượt, số người, điểm trung bình, số câu chờ chấm và tỉ lệ đúng từng câu.
    /// Chỉ tính lượt đã nộp, không gồm trial. Tổng hợp bằng GroupBy trong SQL.
    /// </summary>
    [HttpGet("api/quizzes/{quizId:int}/stats")]
    [Authorize]
    [ProducesResponseType(typeof(QuizStatsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetQuizStats(int quizId, CancellationToken ct) =>
        this.ToOk(await _grading.GetQuizStatsAsync(quizId, ct));
}
