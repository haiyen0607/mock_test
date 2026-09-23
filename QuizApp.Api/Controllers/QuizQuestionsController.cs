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
/// UC13 – Manage Quiz Questions (thêm/xoá/sắp xếp câu hỏi trong 1 Quiz) và
/// UC17 – Reuse Question (thêm 1 Question có sẵn từ Question Bank vào Quiz).
/// Chỉ chủ sở hữu Quiz (hoặc Administrator) mới được thao tác.
/// </summary>
[ApiController]
[Route("api/quizzes/{quizId:int}/questions")]
[Authorize]
[Produces("application/json")]
public class QuizQuestionsController : ControllerBase
{
    private readonly QuizDbContext _db;

    public QuizQuestionsController(QuizDbContext db) => _db = db;

    /// <summary>UC13 – thêm 1 câu hỏi vào Quiz: tạo mới trong 1 Question Bank, hoặc tái sử dụng (UC17).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(QuestionSummaryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QuestionSummaryDto>> AddQuestion(int quizId, [FromBody] AddQuizQuestionRequest request)
    {
        var quiz = await _db.Quizzes.Include(q => q.QuizQuestions).FirstOrDefaultAsync(q => q.QuizId == quizId);
        if (quiz is null)
            return Problem(detail: $"Quiz {quizId} was not found.", statusCode: StatusCodes.Status404NotFound);

        // A4 – User does not own the Quiz
        if (quiz.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this quiz.", statusCode: StatusCodes.Status403Forbidden);

        Question question;

        if (request.QuestionId is not null)
        {
            // UC17 – Reuse Question
            var existing = await _db.Questions.Include(q => q.QuestionBank).Include(q => q.Answers)
                .FirstOrDefaultAsync(q => q.QuestionId == request.QuestionId.Value);

            if (existing is null || existing.Status != ContentStatus.Active)
                return Problem(detail: "No matching Question is found.", statusCode: StatusCodes.Status404NotFound); // A1

            // A2 – Question is not accessible (private bank owned by another User)
            var accessible = existing.QuestionBank!.IsPublic || existing.QuestionBank.OwnerId == User.GetUserId() || User.IsAdministrator();
            if (!accessible)
                return Problem(detail: "This question belongs to a private Question Bank.", statusCode: StatusCodes.Status403Forbidden);

            // A3 – Question already exists in the Quiz
            if (quiz.QuizQuestions.Any(qq => qq.QuestionId == existing.QuestionId))
                return Problem(detail: "This question is already part of the quiz.", statusCode: StatusCodes.Status400BadRequest);

            question = existing;
        }
        else if (request.NewQuestion is not null && request.QuestionBankId is not null)
        {
            var bank = await _db.QuestionBanks.FirstOrDefaultAsync(b => b.QuestionBankId == request.QuestionBankId.Value);
            if (bank is null)
                return Problem(detail: $"Question Bank {request.QuestionBankId} was not found.", statusCode: StatusCodes.Status404NotFound);

            if (bank.OwnerId != User.GetUserId() && !User.IsAdministrator())
                return Problem(detail: "You do not own this Question Bank.", statusCode: StatusCodes.Status403Forbidden);

            if (string.IsNullOrWhiteSpace(request.NewQuestion.Content))
                return Problem(detail: "Content is required for a new question.", statusCode: StatusCodes.Status400BadRequest);

            // A1 – dùng chung quy tắc với UC15: loại câu hỏi văn bản không được có Answer,
            // SingleChoice/TrueFalse tối đa 1 đáp án đúng.
            var ruleError = QuestionBanksController.ValidateAnswers(request.NewQuestion.QuestionType!.Value, request.NewQuestion.Answers);
            if (ruleError is not null)
                return Problem(detail: ruleError, statusCode: StatusCodes.Status400BadRequest);

            question = new Question
            {
                QuestionBankId = bank.QuestionBankId,
                Content = request.NewQuestion.Content.Trim(),
                QuestionType = request.NewQuestion.QuestionType.Value,
                Status = ContentStatus.Active,
                CreatedAt = DateTime.UtcNow,
                Answers = request.NewQuestion.Answers.Select(a => new Answer { Content = a.Content.Trim(), IsCorrect = a.IsCorrect }).ToList()
            };

            _db.Questions.Add(question);
        }
        else
        {
            return Problem(detail: "Provide either questionId (reuse) or questionBankId + newQuestion (create).", statusCode: StatusCodes.Status400BadRequest);
        }

        var nextOrder = quiz.QuizQuestions.Count == 0 ? 1 : quiz.QuizQuestions.Max(qq => qq.OrderIndex) + 1;
        var link = new QuizQuestion { QuizId = quizId, QuestionId = question.QuestionId, OrderIndex = nextOrder };

        // Transaction: tạo Question + tạo liên kết QuizQuestion phải cùng thành công hoặc cùng rollback,
        // để không bao giờ có Question "mồ côi" khi bước 2 lỗi (SRS UC13 – quan hệ phải nhất quán).
        await using var transaction = await _db.Database.BeginTransactionAsync();

        // question.QuestionId chưa có giá trị nếu là câu hỏi mới -> SaveChanges lần 1 để DB cấp Id.
        if (question.QuestionId == 0)
        {
            await _db.SaveChangesAsync();
            link.QuestionId = question.QuestionId;
        }

        _db.QuizQuestions.Add(link);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        var summary = new QuestionSummaryDto(question.QuestionId, link.OrderIndex, question.Content, question.QuestionType.ToString(), question.Answers?.Count ?? 0);
        return StatusCode(StatusCodes.Status201Created, summary);
    }

    /// <summary>UC13 – sắp xếp lại thứ tự câu hỏi trong Quiz.</summary>
    [HttpPut("order")]
    [ProducesResponseType(typeof(List<QuestionSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<List<QuestionSummaryDto>>> Reorder(int quizId, [FromBody] ReorderQuizQuestionsRequest request)
    {
        var quiz = await _db.Quizzes
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question)
            .FirstOrDefaultAsync(q => q.QuizId == quizId);

        if (quiz is null)
            return Problem(detail: $"Quiz {quizId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (quiz.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this quiz.", statusCode: StatusCodes.Status403Forbidden);

        var currentIds = quiz.QuizQuestions.Select(qq => qq.QuestionId).ToHashSet();
        if (!request.QuestionIds.ToHashSet().SetEquals(currentIds))
            return Problem(detail: "The submitted list must contain exactly the quiz's current questions.", statusCode: StatusCodes.Status400BadRequest);

        for (var i = 0; i < request.QuestionIds.Count; i++)
        {
            var link = quiz.QuizQuestions.First(qq => qq.QuestionId == request.QuestionIds[i]);
            link.OrderIndex = i + 1;
        }

        await _db.SaveChangesAsync();
        return Ok(quiz.QuizQuestions.OrderBy(qq => qq.OrderIndex).Select(Mapper.ToQuestionSummary).ToList());
    }

    /// <summary>UC13 A3 – gỡ 1 câu hỏi khỏi Quiz. Không xoá Question gốc trong Question Bank.</summary>
    [HttpDelete("{questionId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveQuestion(int quizId, int questionId)
    {
        var quiz = await _db.Quizzes.FirstOrDefaultAsync(q => q.QuizId == quizId);
        if (quiz is null)
            return Problem(detail: $"Quiz {quizId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (quiz.OwnerId != User.GetUserId() && !User.IsAdministrator())
            return Problem(detail: "You do not own this quiz.", statusCode: StatusCodes.Status403Forbidden);

        var link = await _db.QuizQuestions.FirstOrDefaultAsync(qq => qq.QuizId == quizId && qq.QuestionId == questionId);
        if (link is null)
            return Problem(detail: "This question is not part of the quiz.", statusCode: StatusCodes.Status404NotFound);

        _db.QuizQuestions.Remove(link);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
