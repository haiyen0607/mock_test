using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuizApp.Application.Services.Quizzes;

namespace QuizApp.Api.Controllers;

/// <summary>
/// UC13 – Manage Quiz Questions (thêm/xoá/sắp xếp câu hỏi trong 1 Quiz) và
/// UC17 – Reuse Question (thêm 1 Question có sẵn từ Question Bank vào Quiz).
/// Chỉ chủ sở hữu Quiz (hoặc Administrator) mới được thao tác.
/// Controller chỉ nhận request, gọi <see cref="IQuizQuestionService"/> và chuyển Result thành HTTP response.
/// </summary>
[ApiController]
[Route("api/quizzes/{quizId:int}/questions")]
[Authorize]
[Produces("application/json")]
public class QuizQuestionsController : ControllerBase
{
    private readonly IQuizQuestionService _quizQuestions;

    public QuizQuestionsController(IQuizQuestionService quizQuestions) => _quizQuestions = quizQuestions;

    /// <summary>UC13 – thêm 1 câu hỏi vào Quiz: tạo mới trong 1 Question Bank, hoặc tái sử dụng (UC17).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(QuestionSummaryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddQuestion(int quizId, [FromBody] AddQuizQuestionRequest request, CancellationToken ct) =>
        this.ToActionResult(await _quizQuestions.AddQuestionAsync(quizId, request, ct),
            summary => StatusCode(StatusCodes.Status201Created, summary));

    /// <summary>UC13 – sắp xếp lại thứ tự câu hỏi trong Quiz.</summary>
    [HttpPut("order")]
    [ProducesResponseType(typeof(List<QuestionSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reorder(int quizId, [FromBody] ReorderQuizQuestionsRequest request, CancellationToken ct) =>
        this.ToOk(await _quizQuestions.ReorderAsync(quizId, request, ct));

    /// <summary>UC13 A3 – gỡ 1 câu hỏi khỏi Quiz. Không xoá Question gốc trong Question Bank.</summary>
    [HttpDelete("{questionId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveQuestion(int quizId, int questionId, CancellationToken ct) =>
        this.ToNoContent(await _quizQuestions.RemoveQuestionAsync(quizId, questionId, ct));
}
