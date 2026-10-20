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
/// UC15 – Manage Question Bank (Bank + Question + Answer thuộc về nó) và
/// UC16 – Search Public Questions.
/// </summary>
[ApiController]
[Route("api/question-banks")]
[Produces("application/json")]
public class QuestionBanksController : ControllerBase
{
    private readonly QuizDbContext _db;

    public QuestionBanksController(QuizDbContext db) => _db = db;

    /// <summary>
    /// UC15 – danh sách Question Bank của User đang đăng nhập (bỏ qua bank đã xoá mềm), phân trang.
    /// sort = newest (mặc định) | oldest | title (theo Name).
    /// </summary>
    [HttpGet("mine")]
    [Authorize]
    [ProducesResponseType(typeof(PagedResult<QuestionBankDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<QuestionBankDto>>> GetMyBanks([FromQuery] PageQuery paging)
    {
        var userId = User.GetUserId();
        var query = _db.QuestionBanks.AsNoTracking().Where(b => b.OwnerId == userId && !b.IsDeleted);

        query = paging.SortKey switch
        {
            "oldest" => query.OrderBy(b => b.CreatedAt).ThenBy(b => b.QuestionBankId),
            "title" => query.OrderBy(b => b.Name).ThenBy(b => b.QuestionBankId),
            _ => query.OrderByDescending(b => b.CreatedAt).ThenByDescending(b => b.QuestionBankId)
        };

        return Ok(await query
            .Select(b => new QuestionBankDto(b.QuestionBankId, b.Name, b.Description, b.IsPublic,
                b.Questions.Count(q => q.Status != ContentStatus.Deleted), b.CreatedAt))
            .ToPagedResultAsync(paging));
    }

    /// <summary>
    /// UC16 – duyệt các Question Bank công khai (của mọi User, gồm cả của chính mình), phân trang.
    /// search lọc theo tên bank hoặc tên người tạo; sort = newest (mặc định) | oldest | title.
    /// Bank không còn câu Active nào vẫn hiển thị (QuestionCount = 0).
    /// </summary>
    [HttpGet("public")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<QuestionBankInfoDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<QuestionBankInfoDto>>> GetPublicBanks([FromQuery] string? search, [FromQuery] PageQuery paging)
    {
        var (viewerId, isAdmin) = Viewer();
        var query = _db.QuestionBanks.AsNoTracking().Where(b => b.IsPublic && !b.IsDeleted);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(b => b.Name.Contains(term) || b.Owner!.Username.Contains(term));
        }

        query = paging.SortKey switch
        {
            "oldest" => query.OrderBy(b => b.CreatedAt).ThenBy(b => b.QuestionBankId),
            "title" => query.OrderBy(b => b.Name).ThenBy(b => b.QuestionBankId),
            _ => query.OrderByDescending(b => b.CreatedAt).ThenByDescending(b => b.QuestionBankId)
        };

        return Ok(await query
            .Select(b => new QuestionBankInfoDto(b.QuestionBankId, b.Name, b.Description, b.IsPublic,
                b.Questions.Count(q => q.Status == ContentStatus.Active), b.Owner!.Username,
                isAdmin || b.OwnerId == viewerId, b.CreatedAt))
            .ToPagedResultAsync(paging));
    }

    /// <summary>
    /// UC15/UC16 – thông tin 1 Question Bank: chủ sở hữu/Admin xem mọi bank của mình, người khác chỉ xem bank công khai.
    /// Bank riêng tư của người khác trả 404 (không tiết lộ là bank tồn tại).
    /// </summary>
    [HttpGet("{bankId:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(QuestionBankInfoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QuestionBankInfoDto>> GetBank(int bankId)
    {
        var (viewerId, isAdmin) = Viewer();
        var info = await _db.QuestionBanks.AsNoTracking()
            .Where(b => b.QuestionBankId == bankId && !b.IsDeleted)
            .Select(b => new
            {
                Dto = new QuestionBankInfoDto(b.QuestionBankId, b.Name, b.Description, b.IsPublic,
                    (isAdmin || b.OwnerId == viewerId)
                        ? b.Questions.Count(q => q.Status != ContentStatus.Deleted)
                        : b.Questions.Count(q => q.Status == ContentStatus.Active),
                    b.Owner!.Username, isAdmin || b.OwnerId == viewerId, b.CreatedAt)
            })
            .FirstOrDefaultAsync();

        if (info is null || (!info.Dto.IsPublic && !info.Dto.CanManage))
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.BankNotFound, $"Question Bank {bankId} was not found.");

        return Ok(info.Dto);
    }

    /// <summary>Người xem hiện tại (null nếu là Guest) và có phải Admin không — dùng trong projection SQL.</summary>
    private (int? ViewerId, bool IsAdmin) Viewer() =>
        (User.Identity?.IsAuthenticated ?? false) ? (User.GetUserId(), User.IsAdministrator()) : (null, false);

    /// <summary>
    /// UC16 – Search Public Questions: tìm câu hỏi thuộc các Question Bank công khai để tái sử dụng.
    /// Trả kèm danh sách lựa chọn để User review trước khi reuse (UC17 bước 4), KHÔNG lộ đáp án đúng.
    /// </summary>
    [HttpGet("public-questions")]
    [AllowAnonymous]
    public async Task<ActionResult<List<PublicQuestionDto>>> SearchPublicQuestions([FromQuery] string? search)
    {
        var query = _db.Questions.AsNoTracking().Include(q => q.QuestionBank).Include(q => q.Answers)
            .Where(q => q.QuestionBank!.IsPublic && !q.QuestionBank.IsDeleted && q.Status == ContentStatus.Active);

        // Khớp nội dung câu hỏi, tên bank hoặc tên người tạo bank
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(q => q.Content.Contains(term)
                || q.QuestionBank!.Name.Contains(term)
                || q.QuestionBank!.Owner!.Username.Contains(term));
        }

        var questions = await query.OrderByDescending(q => q.CreatedAt).Take(100).ToListAsync();
        return Ok(questions.Select(Mapper.ToPublicQuestion).ToList()); // A1 – danh sách rỗng nếu không có kết quả phù hợp
    }

    /// <summary>UC15 – tạo Question Bank mới.</summary>
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<QuestionBankDto>> CreateBank([FromBody] QuestionBankRequest request)
    {
        var bank = new QuestionBank
        {
            OwnerId = User.GetUserId(),
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsPublic = request.IsPublic,
            CreatedAt = DateTime.UtcNow
        };

        _db.QuestionBanks.Add(bank);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBankQuestions), new { bankId = bank.QuestionBankId }, Mapper.ToQuestionBank(bank));
    }

    /// <summary>UC15 – cập nhật thông tin Question Bank.</summary>
    [HttpPut("{bankId:int}")]
    [Authorize]
    public async Task<ActionResult<QuestionBankDto>> UpdateBank(int bankId, [FromBody] QuestionBankRequest request)
    {
        var bank = await _db.QuestionBanks.Include(b => b.Questions).FirstOrDefaultAsync(b => b.QuestionBankId == bankId);
        if (bank is null || bank.IsDeleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.BankNotFound, $"Question Bank {bankId} was not found.");

        // A4 – User attempts to modify another User's Question Bank
        if (!User.CanManage(bank.OwnerId))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this Question Bank.");

        bank.Name = request.Name.Trim();
        bank.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        bank.IsPublic = request.IsPublic;

        await _db.SaveChangesAsync();
        return Ok(Mapper.ToQuestionBank(bank));
    }

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
    public async Task<IActionResult> DeleteBank(int bankId)
    {
        var bank = await _db.QuestionBanks.FirstOrDefaultAsync(b => b.QuestionBankId == bankId);
        if (bank is null || bank.IsDeleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.BankNotFound, $"Question Bank {bankId} was not found.");

        if (!User.CanManage(bank.OwnerId))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this Question Bank.");

        var questionIds = await _db.Questions.Where(q => q.QuestionBankId == bankId).Select(q => q.QuestionId).ToListAsync();
        var inUse = await _db.QuizQuestions.AnyAsync(qq => questionIds.Contains(qq.QuestionId));
        if (inUse)
            return this.ApiProblem(StatusCodes.Status409Conflict, ErrorCodes.QuestionInUse, "This Question Bank still has questions used by existing quizzes. Remove them from those quizzes first.");

        var hasAttemptHistory = await _db.AttemptAnswers.AnyAsync(aa => questionIds.Contains(aa.QuestionId));

        await using var transaction = await _db.Database.BeginTransactionAsync();

        if (hasAttemptHistory)
        {
            // Xoá mềm – giữ dữ liệu để các kết quả làm bài cũ vẫn hiển thị được
            await _db.Questions.Where(q => q.QuestionBankId == bankId)
                .ExecuteUpdateAsync(s => s.SetProperty(q => q.Status, ContentStatus.Deleted));
            bank.IsDeleted = true;
            await _db.SaveChangesAsync();
        }
        else
        {
            await _db.Answers.Where(a => questionIds.Contains(a.QuestionId)).ExecuteDeleteAsync();
            await _db.Questions.Where(q => q.QuestionBankId == bankId).ExecuteDeleteAsync();
            await _db.QuestionBanks.Where(b => b.QuestionBankId == bankId).ExecuteDeleteAsync();
        }

        await transaction.CommitAsync();
        return NoContent();
    }

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
    public async Task<IActionResult> GetBankQuestions(int bankId)
    {
        var bank = await _db.QuestionBanks.AsNoTracking().FirstOrDefaultAsync(b => b.QuestionBankId == bankId);
        if (bank is null || bank.IsDeleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.BankNotFound, $"Question Bank {bankId} was not found.");

        var isOwner = User.CanManage(bank.OwnerId);
        if (!bank.IsPublic && !isOwner)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.BankNotFound, $"Question Bank {bankId} was not found.");

        var query = _db.Questions.AsNoTracking().Include(q => q.Answers).Include(q => q.QuestionBank)
            .Where(q => q.QuestionBankId == bankId);

        if (isOwner)
        {
            var own = await query.Where(q => q.Status != ContentStatus.Deleted).OrderBy(q => q.QuestionId).ToListAsync();
            return Ok(own.Select(Mapper.ToQuestion).ToList());
        }

        var visible = await query.Where(q => q.Status == ContentStatus.Active).OrderBy(q => q.QuestionId).ToListAsync();
        return Ok(visible.Select(Mapper.ToPublicQuestion).ToList());
    }

    /// <summary>UC15 – thêm 1 Question (kèm Answer nếu có) vào Question Bank.</summary>
    [HttpPost("{bankId:int}/questions")]
    [Authorize]
    public async Task<ActionResult<QuestionDto>> AddQuestion(int bankId, [FromBody] QuestionAndAnswersRequest request)
    {
        var bank = await _db.QuestionBanks.FirstOrDefaultAsync(b => b.QuestionBankId == bankId);
        if (bank is null || bank.IsDeleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.BankNotFound, $"Question Bank {bankId} was not found.");

        if (!User.CanManage(bank.OwnerId))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this Question Bank.");

        var ruleError = ValidateAnswers(request.QuestionType!.Value, request.Answers);
        if (ruleError is not null)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, ruleError);

        var question = new Question
        {
            QuestionBankId = bankId,
            Content = request.Content.Trim(),
            QuestionType = request.QuestionType.Value,
            Status = ContentStatus.Active,
            CreatedAt = DateTime.UtcNow,
            Answers = request.Answers.Select(a => new Answer { Content = a.Content.Trim(), IsCorrect = a.IsCorrect }).ToList()
        };

        _db.Questions.Add(question);
        await _db.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, Mapper.ToQuestion(question));
    }

    /// <summary>UC15 – cập nhật nội dung/loại Question (Answer quản lý riêng ở dưới).</summary>
    [HttpPut("questions/{questionId:int}")]
    [Authorize]
    public async Task<ActionResult<QuestionDto>> UpdateQuestion(int questionId, [FromBody] QuestionRequest request)
    {
        var question = await _db.Questions.Include(q => q.QuestionBank).Include(q => q.Answers)
            .FirstOrDefaultAsync(q => q.QuestionId == questionId);

        if (question is null || question.Status == ContentStatus.Deleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.QuestionNotFound, $"Question {questionId} was not found.");

        if (!User.CanManage(question.QuestionBank!.OwnerId))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this Question.");

        var newType = request.QuestionType!.Value;

        if (question.QuestionType != newType)
        {
            // Đổi sang loại không dùng đáp án định nghĩa sẵn trong khi vẫn còn Answer sẽ để lại dữ liệu mồ côi.
            if (question.Answers.Count > 0 && !QuestionTypeRules.UsesPredefinedAnswers(newType))
                return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, $"Question {questionId} still has predefined answers. Remove them before changing the type to {newType}.");

            // Đổi sang SingleChoice/TrueFalse khi đang có nhiều hơn 1 đáp án đúng -> vi phạm quy tắc của loại mới.
            if (QuestionTypeRules.AllowsOneSelectionOnly(newType) && question.Answers.Count(a => a.IsCorrect) > 1)
                return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, $"Question type {newType} allows only one correct answer. Question {questionId} currently has {question.Answers.Count(a => a.IsCorrect)}.");

            var playError = await CheckStillPlayableAsync(questionId, newType, question.Answers.Count, question.Answers.Count(a => a.IsCorrect));
            if (playError is not null)
                return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, playError);
        }

        question.Content = request.Content.Trim();
        question.QuestionType = newType;

        await _db.SaveChangesAsync();
        return Ok(Mapper.ToQuestion(question));
    }

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
    public async Task<ActionResult<QuestionDto>> ReplaceQuestion(int questionId, [FromBody] ReplaceQuestionRequest request)
    {
        var question = await _db.Questions.Include(q => q.QuestionBank).Include(q => q.Answers)
            .FirstOrDefaultAsync(q => q.QuestionId == questionId);

        if (question is null || question.Status == ContentStatus.Deleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.QuestionNotFound, $"Question {questionId} was not found.");

        if (!User.CanManage(question.QuestionBank!.OwnerId))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this Question.");

        var existingIds = question.Answers.Select(a => a.AnswerId).ToHashSet();
        var requestedIds = request.Answers.Where(a => a.AnswerId is not null).Select(a => a.AnswerId!.Value).ToList();
        if (requestedIds.Count != requestedIds.Distinct().Count() || requestedIds.Any(id => !existingIds.Contains(id)))
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, "Answer ids must be unique and belong to this question.");

        var newType = request.QuestionType!.Value;
        var ruleError = ValidateAnswers(newType, request.Answers.Cast<AnswerRequest>().ToList());
        if (ruleError is not null)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, ruleError);

        var playError = await CheckStillPlayableAsync(questionId, newType, request.Answers.Count, request.Answers.Count(a => a.IsCorrect));
        if (playError is not null)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, playError);

        await using var transaction = await _db.Database.BeginTransactionAsync();

        question.Content = request.Content.Trim();
        question.QuestionType = newType;

        // Answer bị bỏ khỏi danh sách -> xoá; lượt làm bài cũ đã chọn nó được gỡ tham chiếu như DeleteAnswer
        var keep = requestedIds.ToHashSet();
        var removed = question.Answers.Where(a => !keep.Contains(a.AnswerId)).ToList();
        if (removed.Count > 0)
        {
            var removedIds = removed.Select(a => a.AnswerId).ToList();
            await _db.AttemptAnswers.Where(aa => aa.AnswerId != null && removedIds.Contains(aa.AnswerId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(aa => aa.AnswerId, (int?)null));
            foreach (var a in removed) question.Answers.Remove(a);
            _db.Answers.RemoveRange(removed);
        }

        foreach (var item in request.Answers)
        {
            if (item.AnswerId is int id)
            {
                var answer = question.Answers.First(a => a.AnswerId == id);
                answer.Content = item.Content.Trim();
                answer.IsCorrect = item.IsCorrect;
            }
            else
            {
                question.Answers.Add(new Answer { Content = item.Content.Trim(), IsCorrect = item.IsCorrect });
            }
        }

        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(Mapper.ToQuestion(question));
    }

    /// <summary>
    /// UC15 – xoá Question cùng Answer của nó.
    /// - Chặn nếu đang được dùng trong Quiz nào đó.
    /// - Nếu đã có lịch sử làm bài -> xoá mềm (Status = Deleted) thay vì xoá cứng, tránh lỗi khoá ngoại
    ///   với AttemptAnswer và giữ nguyên kết quả làm bài cũ (UC17 A4).
    /// </summary>
    [HttpDelete("questions/{questionId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteQuestion(int questionId)
    {
        var question = await _db.Questions.Include(q => q.QuestionBank).FirstOrDefaultAsync(q => q.QuestionId == questionId);
        if (question is null || question.Status == ContentStatus.Deleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.QuestionNotFound, $"Question {questionId} was not found.");

        if (!User.CanManage(question.QuestionBank!.OwnerId))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this Question.");

        var inUse = await _db.QuizQuestions.AnyAsync(qq => qq.QuestionId == questionId);
        if (inUse)
            return this.ApiProblem(StatusCodes.Status409Conflict, ErrorCodes.QuestionInUse, "This question is used by one or more quizzes. Remove it from those quizzes first.");

        var hasAttemptHistory = await _db.AttemptAnswers.AnyAsync(aa => aa.QuestionId == questionId);
        if (hasAttemptHistory)
        {
            question.Status = ContentStatus.Deleted; // xoá mềm
            await _db.SaveChangesAsync();
            return NoContent();
        }

        await using var transaction = await _db.Database.BeginTransactionAsync();
        await _db.Answers.Where(a => a.QuestionId == questionId).ExecuteDeleteAsync();
        await _db.Questions.Where(q => q.QuestionId == questionId).ExecuteDeleteAsync();
        await transaction.CommitAsync();

        return NoContent();
    }

    /// <summary>UC15 – thêm 1 Answer định nghĩa sẵn cho Question.</summary>
    [HttpPost("questions/{questionId:int}/answers")]
    [Authorize]
    public async Task<ActionResult<AnswerDto>> AddAnswer(int questionId, [FromBody] AnswerRequest request)
    {
        var question = await _db.Questions.Include(q => q.QuestionBank).Include(q => q.Answers)
            .FirstOrDefaultAsync(q => q.QuestionId == questionId);

        if (question is null || question.Status == ContentStatus.Deleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.QuestionNotFound, $"Question {questionId} was not found.");

        if (!User.CanManage(question.QuestionBank!.OwnerId))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this Question.");

        var ruleError = ValidateAgainstQuestionType(question, request.IsCorrect, currentAnswerId: null);
        if (ruleError is not null)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, ruleError);

        var answer = new Answer { QuestionId = questionId, Content = request.Content.Trim(), IsCorrect = request.IsCorrect };
        _db.Answers.Add(answer);
        await _db.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, Mapper.ToAnswer(answer));
    }

    /// <summary>UC15 – cập nhật 1 Answer.</summary>
    [HttpPut("answers/{answerId:int}")]
    [Authorize]
    public async Task<ActionResult<AnswerDto>> UpdateAnswer(int answerId, [FromBody] AnswerRequest request)
    {
        var answer = await _db.Answers.Include(a => a.Question).ThenInclude(q => q!.QuestionBank)
            .Include(a => a.Question).ThenInclude(q => q!.Answers)
            .FirstOrDefaultAsync(a => a.AnswerId == answerId);

        if (answer is null || answer.Question!.Status == ContentStatus.Deleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.AnswerNotFound, $"Answer {answerId} was not found.");

        if (!User.CanManage(answer.Question.QuestionBank!.OwnerId))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this Answer.");

        var ruleError = ValidateAgainstQuestionType(answer.Question, request.IsCorrect, currentAnswerId: answerId);
        if (ruleError is not null)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, ruleError);

        // Bỏ tick đáp án đúng duy nhất của câu đang nằm trong Quiz đã Publish -> câu không thể làm đúng nữa
        var correctAfter = answer.Question.Answers.Count(a => a.AnswerId != answerId && a.IsCorrect) + (request.IsCorrect ? 1 : 0);
        var playError = await CheckStillPlayableAsync(answer.QuestionId, answer.Question.QuestionType, answer.Question.Answers.Count, correctAfter);
        if (playError is not null)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, playError);

        answer.Content = request.Content.Trim();
        answer.IsCorrect = request.IsCorrect;

        await _db.SaveChangesAsync();
        return Ok(Mapper.ToAnswer(answer));
    }

    /// <summary>
    /// UC15 – xoá 1 Answer. Các lượt làm bài cũ đã chọn đáp án này được gỡ tham chiếu (AnswerId = null);
    /// kết quả đúng/sai của chúng vẫn giữ nguyên nhờ AttemptAnswer.IsCorrect đã chốt lúc Submit.
    /// </summary>
    [HttpDelete("answers/{answerId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteAnswer(int answerId)
    {
        var answer = await _db.Answers.Include(a => a.Question).ThenInclude(q => q!.QuestionBank)
            .Include(a => a.Question).ThenInclude(q => q!.Answers)
            .FirstOrDefaultAsync(a => a.AnswerId == answerId);

        if (answer is null || answer.Question!.Status == ContentStatus.Deleted)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.AnswerNotFound, $"Answer {answerId} was not found.");

        if (!User.CanManage(answer.Question.QuestionBank!.OwnerId))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this Answer.");

        var question = answer.Question;
        var correctAfter = question.Answers.Count(a => a.AnswerId != answerId && a.IsCorrect);
        var playError = await CheckStillPlayableAsync(question.QuestionId, question.QuestionType, question.Answers.Count - 1, correctAfter);
        if (playError is not null)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, playError);

        await using var transaction = await _db.Database.BeginTransactionAsync();
        await _db.AttemptAnswers.Where(aa => aa.AnswerId == answerId).ExecuteUpdateAsync(s => s.SetProperty(aa => aa.AnswerId, (int?)null));
        await _db.Answers.Where(a => a.AnswerId == answerId).ExecuteDeleteAsync();
        await transaction.CommitAsync();

        return NoContent();
    }

    /// <summary>
    /// Nếu Question đang nằm trong ít nhất 1 Quiz đã Publish (và chưa bị Admin gỡ), thì sau khi sửa nó vẫn
    /// phải đủ điều kiện làm bài như lúc Publish (UC14 A1). Tránh việc Quiz đã public chứa câu không thể làm đúng.
    /// Trả về null nếu hợp lệ.
    /// </summary>
    private async Task<string?> CheckStillPlayableAsync(int questionId, QuestionType typeAfter, int answerCountAfter, int correctCountAfter)
    {
        var usedByPublishedQuiz = await _db.QuizQuestions.AnyAsync(qq =>
            qq.QuestionId == questionId && qq.Quiz!.IsPublished && qq.Quiz.Status == ContentStatus.Active);

        if (!usedByPublishedQuiz) return null;

        var reason = QuestionTypeRules.ValidateForPlay(typeAfter, answerCountAfter, correctCountAfter);
        return reason is null
            ? null
            : $"Question {questionId} is used by a published quiz, so this change is not allowed: the question {reason} Unpublish the quiz first or keep the question complete.";
    }

    /// <summary>Chỉ loại câu hỏi có đáp án định nghĩa sẵn mới được thêm Answer; SingleChoice/TrueFalse tối đa 1 đáp án đúng.</summary>
    private static string? ValidateAgainstQuestionType(Question question, bool isCorrect, int? currentAnswerId)
    {
        if (!QuestionTypeRules.UsesPredefinedAnswers(question.QuestionType))
            return $"Question type {question.QuestionType} does not support predefined answers.";

        if (isCorrect && QuestionTypeRules.AllowsOneSelectionOnly(question.QuestionType))
        {
            var hasAnotherCorrect = question.Answers.Any(a => a.IsCorrect && a.AnswerId != currentAnswerId);
            if (hasAnotherCorrect)
                return $"Question type {question.QuestionType} allows only one correct answer.";
        }

        return null;
    }

    /// <summary>
    /// Kiểm tra danh sách Answer gửi kèm khi TẠO Question. Cho phép danh sách rỗng (User có thể thêm đáp án sau);
    /// điều kiện "đủ đáp án" được kiểm tra khi Publish Quiz (UC14 A1).
    /// </summary>
    internal static string? ValidateAnswers(QuestionType type, List<AnswerRequest> answers)
    {
        if (answers.Count == 0) return null;

        if (!QuestionTypeRules.UsesPredefinedAnswers(type))
            return $"Question type {type} does not support predefined answers.";

        if (QuestionTypeRules.AllowsOneSelectionOnly(type) && answers.Count(a => a.IsCorrect) > 1)
            return $"Question type {type} allows only one correct answer.";

        return null;
    }
}
