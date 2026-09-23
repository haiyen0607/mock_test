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

    /// <summary>UC15 – danh sách Question Bank của User đang đăng nhập.</summary>
    [HttpGet("mine")]
    [Authorize]
    public async Task<ActionResult<List<QuestionBankDto>>> GetMyBanks()
    {
        var userId = User.GetUserId();
        var banks = await _db.QuestionBanks.AsNoTracking().Include(b => b.Questions)
            .Where(b => b.OwnerId == userId).OrderByDescending(b => b.CreatedAt).ToListAsync();

        return Ok(banks.Select(Mapper.ToQuestionBank).ToList());
    }

    /// <summary>UC16 – Search Public Questions: tìm câu hỏi thuộc các Question Bank công khai để tái sử dụng.</summary>
    [HttpGet("public-questions")]
    [AllowAnonymous]
    public async Task<ActionResult<List<PublicQuestionDto>>> SearchPublicQuestions([FromQuery] string? search)
    {
        var query = _db.Questions.AsNoTracking().Include(q => q.QuestionBank)
            .Where(q => q.QuestionBank!.IsPublic && q.Status == ContentStatus.Active);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(q => q.Content.Contains(search));

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
        if (bank is null)
            return Problem(detail: $"Question Bank {bankId} was not found.", statusCode: StatusCodes.Status404NotFound);

        // A4 – User attempts to modify another User's Question Bank
        if (bank.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this Question Bank.", statusCode: StatusCodes.Status403Forbidden);

        bank.Name = request.Name.Trim();
        bank.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        bank.IsPublic = request.IsPublic;

        await _db.SaveChangesAsync();
        return Ok(Mapper.ToQuestionBank(bank));
    }

    /// <summary>UC15 A3 – xoá Question Bank; chặn nếu còn Question đang được Quiz nào đó sử dụng.</summary>
    [HttpDelete("{bankId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteBank(int bankId)
    {
        var bank = await _db.QuestionBanks.FirstOrDefaultAsync(b => b.QuestionBankId == bankId);
        if (bank is null)
            return Problem(detail: $"Question Bank {bankId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (bank.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this Question Bank.", statusCode: StatusCodes.Status403Forbidden);

        var questionIds = await _db.Questions.Where(q => q.QuestionBankId == bankId).Select(q => q.QuestionId).ToListAsync();
        var inUse = await _db.QuizQuestions.AnyAsync(qq => questionIds.Contains(qq.QuestionId));
        if (inUse)
            return Problem(detail: "This Question Bank still has questions used by existing quizzes. Remove them from those quizzes first.", statusCode: StatusCodes.Status400BadRequest);

        await using var transaction = await _db.Database.BeginTransactionAsync();
        await _db.Answers.Where(a => questionIds.Contains(a.QuestionId)).ExecuteDeleteAsync();
        await _db.Questions.Where(q => q.QuestionBankId == bankId).ExecuteDeleteAsync();
        await _db.QuestionBanks.Where(b => b.QuestionBankId == bankId).ExecuteDeleteAsync();
        await transaction.CommitAsync();

        return NoContent();
    }

    /// <summary>UC15 – câu hỏi thuộc một Question Bank. Bank riêng tư chỉ chủ sở hữu xem được.</summary>
    [HttpGet("{bankId:int}/questions")]
    [AllowAnonymous]
    public async Task<ActionResult<List<QuestionDto>>> GetBankQuestions(int bankId)
    {
        var bank = await _db.QuestionBanks.AsNoTracking().FirstOrDefaultAsync(b => b.QuestionBankId == bankId);
        if (bank is null)
            return Problem(detail: $"Question Bank {bankId} was not found.", statusCode: StatusCodes.Status404NotFound);

        var isOwner = (User.Identity?.IsAuthenticated ?? false) && (bank.OwnerId == User.GetUserId() || User.IsAdministrator());
        if (!bank.IsPublic && !isOwner)
            return Problem(detail: $"Question Bank {bankId} was not found.", statusCode: StatusCodes.Status404NotFound);

        var questions = await _db.Questions.AsNoTracking().Include(q => q.Answers)
            .Where(q => q.QuestionBankId == bankId).OrderBy(q => q.QuestionId).ToListAsync();

        return Ok(questions.Select(Mapper.ToQuestion).ToList());
    }

    /// <summary>UC15 – thêm 1 Question (kèm Answer nếu có) vào Question Bank.</summary>
    [HttpPost("{bankId:int}/questions")]
    [Authorize]
    public async Task<ActionResult<QuestionDto>> AddQuestion(int bankId, [FromBody] QuestionAndAnswersRequest request)
    {
        var bank = await _db.QuestionBanks.FirstOrDefaultAsync(b => b.QuestionBankId == bankId);
        if (bank is null)
            return Problem(detail: $"Question Bank {bankId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (bank.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this Question Bank.", statusCode: StatusCodes.Status403Forbidden);

        var ruleError = ValidateAnswers(request.QuestionType!.Value, request.Answers);
        if (ruleError is not null)
            return Problem(detail: ruleError, statusCode: StatusCodes.Status400BadRequest);

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

        if (question is null)
            return Problem(detail: $"Question {questionId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (question.QuestionBank!.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this Question.", statusCode: StatusCodes.Status403Forbidden);

        var newType = request.QuestionType!.Value;

        // Đổi sang loại không dùng đáp án định nghĩa sẵn trong khi vẫn còn Answer sẽ để lại dữ liệu mồ côi.
        if (question.QuestionType != newType && question.Answers.Count > 0 && !QuestionTypeRules.UsesPredefinedAnswers(newType))
            return Problem(detail: $"Question {questionId} still has predefined answers. Remove them before changing the type to {newType}.", statusCode: StatusCodes.Status400BadRequest);

        question.Content = request.Content.Trim();
        question.QuestionType = newType;

        await _db.SaveChangesAsync();
        return Ok(Mapper.ToQuestion(question));
    }

    /// <summary>UC15 – xoá Question cùng Answer của nó. Chặn nếu đang được dùng trong Quiz nào đó.</summary>
    [HttpDelete("questions/{questionId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteQuestion(int questionId)
    {
        var question = await _db.Questions.Include(q => q.QuestionBank).FirstOrDefaultAsync(q => q.QuestionId == questionId);
        if (question is null)
            return Problem(detail: $"Question {questionId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (question.QuestionBank!.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this Question.", statusCode: StatusCodes.Status403Forbidden);

        var inUse = await _db.QuizQuestions.AnyAsync(qq => qq.QuestionId == questionId);
        if (inUse)
            return Problem(detail: "This question is used by one or more quizzes. Remove it from those quizzes first.", statusCode: StatusCodes.Status400BadRequest);

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

        if (question is null)
            return Problem(detail: $"Question {questionId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (question.QuestionBank!.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this Question.", statusCode: StatusCodes.Status403Forbidden);

        var ruleError = ValidateAgainstQuestionType(question, request.IsCorrect, currentAnswerId: null);
        if (ruleError is not null)
            return Problem(detail: ruleError, statusCode: StatusCodes.Status400BadRequest);

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

        if (answer is null)
            return Problem(detail: $"Answer {answerId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (answer.Question!.QuestionBank!.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this Answer.", statusCode: StatusCodes.Status403Forbidden);

        var ruleError = ValidateAgainstQuestionType(answer.Question, request.IsCorrect, currentAnswerId: answerId);
        if (ruleError is not null)
            return Problem(detail: ruleError, statusCode: StatusCodes.Status400BadRequest);

        answer.Content = request.Content.Trim();
        answer.IsCorrect = request.IsCorrect;

        await _db.SaveChangesAsync();
        return Ok(Mapper.ToAnswer(answer));
    }

    /// <summary>UC15 – xoá 1 Answer.</summary>
    [HttpDelete("answers/{answerId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteAnswer(int answerId)
    {
        var answer = await _db.Answers.Include(a => a.Question).ThenInclude(q => q!.QuestionBank)
            .FirstOrDefaultAsync(a => a.AnswerId == answerId);

        if (answer is null)
            return Problem(detail: $"Answer {answerId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (answer.Question!.QuestionBank!.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this Answer.", statusCode: StatusCodes.Status403Forbidden);

        await using var transaction = await _db.Database.BeginTransactionAsync();
        await _db.AttemptAnswers.Where(aa => aa.AnswerId == answerId).ExecuteUpdateAsync(s => s.SetProperty(aa => aa.AnswerId, (int?)null));
        await _db.Answers.Where(a => a.AnswerId == answerId).ExecuteDeleteAsync();
        await transaction.CommitAsync();

        return NoContent();
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
