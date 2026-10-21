using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuizApp.Application.Services.QuestionBanks;

namespace QuizApp.Api.Controllers;

/// <summary>
/// UC15 – Manage Question Bank (Bank + Question + Answer thuộc về nó) và
/// UC16 – Search Public Questions.
/// Controller chỉ nhận request, gọi <see cref="IQuestionBankService"/> và chuyển Result thành HTTP response.
/// </summary>
[ApiController]
[Route("api/question-banks")]
[Produces("application/json")]
public class QuestionBanksController : ControllerBase
{
    private readonly IQuestionBankService _banks;

    public QuestionBanksController(IQuestionBankService banks) => _banks = banks;

    /// <summary>
    /// UC15 – danh sách Question Bank của User đang đăng nhập (bỏ qua bank đã xoá mềm), phân trang.
    /// sort = newest (mặc định) | oldest | title (theo Name).
    /// </summary>
    [HttpGet("mine")]
    [Authorize]
    [ProducesResponseType(typeof(PagedResult<QuestionBankDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyBanks([FromQuery] PageQuery paging, CancellationToken ct) =>
        this.ToOk(await _banks.GetMyBanksAsync(paging, ct));

    /// <summary>
    /// UC16 – duyệt các Question Bank công khai (của mọi User, gồm cả của chính mình), phân trang.
    /// search lọc theo tên bank hoặc tên người tạo; sort = newest (mặc định) | oldest | title.
    /// Bank không còn câu Active nào vẫn hiển thị (QuestionCount = 0).
    /// </summary>
    [HttpGet("public")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<QuestionBankInfoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPublicBanks([FromQuery] string? search, [FromQuery] PageQuery paging, CancellationToken ct) =>
        this.ToOk(await _banks.GetPublicBanksAsync(search, paging, ct));

    /// <summary>
    /// UC15/UC16 – thông tin 1 Question Bank: chủ sở hữu/Admin xem mọi bank của mình, người khác chỉ xem bank công khai.
    /// Bank riêng tư của người khác trả 404 (không tiết lộ là bank tồn tại).
    /// </summary>
    [HttpGet("{bankId:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(QuestionBankInfoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBank(int bankId, CancellationToken ct) =>
        this.ToOk(await _banks.GetBankAsync(bankId, ct));

    /// <summary>
    /// UC16 – Search Public Questions: tìm câu hỏi thuộc các Question Bank công khai để tái sử dụng.
    /// Trả kèm danh sách lựa chọn để User review trước khi reuse (UC17 bước 4), KHÔNG lộ đáp án đúng.
    /// </summary>
    [HttpGet("public-questions")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(List<PublicQuestionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SearchPublicQuestions([FromQuery] string? search, CancellationToken ct) =>
        this.ToOk(await _banks.SearchPublicQuestionsAsync(search, ct));

    /// <summary>UC15 – tạo Question Bank mới.</summary>
    [HttpPost]
    [Authorize]
    [ProducesResponseType(typeof(QuestionBankDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateBank([FromBody] QuestionBankRequest request, CancellationToken ct) =>
        this.ToActionResult(await _banks.CreateBankAsync(request, ct),
            bank => CreatedAtAction(nameof(GetBankQuestions), new { bankId = bank.QuestionBankId }, bank));

    /// <summary>UC15 – cập nhật thông tin Question Bank.</summary>
    [HttpPut("{bankId:int}")]
    [Authorize]
    [ProducesResponseType(typeof(QuestionBankDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateBank(int bankId, [FromBody] QuestionBankRequest request, CancellationToken ct) =>
        this.ToOk(await _banks.UpdateBankAsync(bankId, request, ct));

    /// <summary>
    /// UC15 A3 – xoá Question Bank.
    /// - Chặn nếu còn Question đang được Quiz nào đó sử dụng.
    /// - Nếu có Question đã từng xuất hiện trong lượt làm bài (AttemptAnswer tham chiếu tới) thì
    ///   KHÔNG xoá cứng được (khoá ngoại Restrict -> lỗi 500, và làm mất kết quả cũ) -> xoá mềm:
    ///   bank.IsDeleted = true, mọi Question trong bank chuyển Status = Deleted (UC17 A4).
    /// - Ngược lại thì xoá cứng như bình thường.
    /// </summary>
    [HttpDelete("{bankId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteBank(int bankId, CancellationToken ct) =>
        this.ToNoContent(await _banks.DeleteBankAsync(bankId, ct));

    /// <summary>
    /// UC15 – câu hỏi thuộc một Question Bank.
    /// - Chủ sở hữu / Admin: xem đầy đủ (kể cả IsCorrect và câu bị Admin gỡ).
    /// - Người khác (chỉ với bank công khai): chỉ thấy câu Active và KHÔNG thấy đáp án đúng
    ///   (trước đây endpoint này lộ IsCorrect cho cả Guest -> xem được đáp án của mọi Quiz dùng câu hỏi public).
    /// </summary>
    [HttpGet("{bankId:int}/questions")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(List<QuestionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(List<PublicQuestionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBankQuestions(int bankId, CancellationToken ct) =>
        this.ToOk(await _banks.GetBankQuestionsAsync(bankId, ct));

    /// <summary>UC15 – thêm 1 Question (kèm Answer nếu có) vào Question Bank.</summary>
    [HttpPost("{bankId:int}/questions")]
    [Authorize]
    [ProducesResponseType(typeof(QuestionDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> AddQuestion(int bankId, [FromBody] QuestionAndAnswersRequest request, CancellationToken ct) =>
        this.ToActionResult(await _banks.AddQuestionAsync(bankId, request, ct),
            question => StatusCode(StatusCodes.Status201Created, question));

    /// <summary>UC15 – cập nhật nội dung/loại Question (Answer quản lý riêng ở dưới).</summary>
    [HttpPut("questions/{questionId:int}")]
    [Authorize]
    [ProducesResponseType(typeof(QuestionDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateQuestion(int questionId, [FromBody] QuestionRequest request, CancellationToken ct) =>
        this.ToOk(await _banks.UpdateQuestionAsync(questionId, request, ct));

    /// <summary>
    /// UC15 – sửa Question kèm toàn bộ Answer trong 1 transaction (xem ReplaceQuestionRequest).
    /// Dùng ở màn "Câu hỏi của quiz" để sửa từng câu mà không vướng quy tắc ở trạng thái trung gian
    /// (vd đổi đáp án đúng duy nhất của SingleChoice từ A sang B).
    /// </summary>
    [HttpPut("questions/{questionId:int}/full")]
    [Authorize]
    [ProducesResponseType(typeof(QuestionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReplaceQuestion(int questionId, [FromBody] ReplaceQuestionRequest request, CancellationToken ct) =>
        this.ToOk(await _banks.ReplaceQuestionAsync(questionId, request, ct));

    /// <summary>
    /// UC15 – xoá Question cùng Answer của nó.
    /// - Chặn nếu đang được dùng trong Quiz nào đó.
    /// - Nếu đã có lịch sử làm bài -> xoá mềm (Status = Deleted) thay vì xoá cứng, tránh lỗi khoá ngoại
    ///   với AttemptAnswer và giữ nguyên kết quả làm bài cũ (UC17 A4).
    /// </summary>
    [HttpDelete("questions/{questionId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteQuestion(int questionId, CancellationToken ct) =>
        this.ToNoContent(await _banks.DeleteQuestionAsync(questionId, ct));

    /// <summary>UC15 – thêm 1 Answer định nghĩa sẵn cho Question.</summary>
    [HttpPost("questions/{questionId:int}/answers")]
    [Authorize]
    [ProducesResponseType(typeof(AnswerDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> AddAnswer(int questionId, [FromBody] AnswerRequest request, CancellationToken ct) =>
        this.ToActionResult(await _banks.AddAnswerAsync(questionId, request, ct),
            answer => StatusCode(StatusCodes.Status201Created, answer));

    /// <summary>UC15 – cập nhật 1 Answer.</summary>
    [HttpPut("answers/{answerId:int}")]
    [Authorize]
    [ProducesResponseType(typeof(AnswerDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateAnswer(int answerId, [FromBody] AnswerRequest request, CancellationToken ct) =>
        this.ToOk(await _banks.UpdateAnswerAsync(answerId, request, ct));

    /// <summary>
    /// UC15 – xoá 1 Answer. Các lượt làm bài cũ đã chọn đáp án này được gỡ tham chiếu (AnswerId = null);
    /// kết quả đúng/sai của chúng vẫn giữ nguyên nhờ AttemptAnswer.IsCorrect đã chốt lúc Submit.
    /// </summary>
    [HttpDelete("answers/{answerId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteAnswer(int answerId, CancellationToken ct) =>
        this.ToNoContent(await _banks.DeleteAnswerAsync(answerId, ct));
}
