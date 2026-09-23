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
/// UC07 – Try Trial Quiz (Guest), UC08 – Take Quiz (User), UC09 – Submit Quiz,
/// UC10 – View Quiz Result.
/// </summary>
[ApiController]
[Produces("application/json")]
public class QuizAttemptsController : ControllerBase
{
    private readonly QuizDbContext _db;

    /// <summary>Số lượt trial tối đa cho mỗi Guest (định danh qua header X-Guest-Id) – SRS UC07 A1.</summary>
    private const int GuestTrialLimit = 3;

    public QuizAttemptsController(QuizDbContext db) => _db = db;

    /// <summary>UC07 – Guest bắt đầu 1 lượt làm thử. Yêu cầu header "X-Guest-Id" do client tự sinh (vd. một GUID lưu ở trình duyệt).</summary>
    [HttpPost("api/quizzes/{quizId:int}/trial")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AttemptContentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AttemptContentDto>> StartTrial(int quizId, [FromHeader(Name = "X-Guest-Id")] string? guestId)
    {
        if (string.IsNullOrWhiteSpace(guestId))
            return Problem(detail: "Header X-Guest-Id is required to start a trial quiz.", statusCode: StatusCodes.Status400BadRequest);

        var quiz = await LoadPlayableQuiz(quizId);
        if (quiz is null) // A2 – Quiz is no longer available
            return Problem(detail: $"Quiz {quizId} cannot be accessed.", statusCode: StatusCodes.Status404NotFound);

        // A1 – Trial limit reached
        var usedTrials = await _db.QuizAttempts.CountAsync(a => a.IsTrial && a.GuestIdentifier == guestId);
        if (usedTrials >= GuestTrialLimit)
            return Problem(detail: "Trial limit reached. Please register or log in to continue.", statusCode: StatusCodes.Status403Forbidden);

        var attempt = new QuizAttempt
        {
            QuizId = quizId,
            UserId = null,
            IsTrial = true,
            GuestIdentifier = guestId,
            StartedAt = DateTime.UtcNow
        };

        _db.QuizAttempts.Add(attempt);
        await _db.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, Mapper.ToAttemptContent(attempt, quiz));
    }

    /// <summary>UC08 – User đã đăng nhập bắt đầu làm 1 Quiz công khai.</summary>
    [HttpPost("api/quizzes/{quizId:int}/attempts")]
    [Authorize]
    [ProducesResponseType(typeof(AttemptContentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AttemptContentDto>> StartAttempt(int quizId)
    {
        var quiz = await LoadPlayableQuiz(quizId);
        if (quiz is null) // A1 – Quiz is unavailable
            return Problem(detail: $"Quiz {quizId} cannot be started.", statusCode: StatusCodes.Status404NotFound);

        var attempt = new QuizAttempt
        {
            QuizId = quizId,
            UserId = User.GetUserId(),
            IsTrial = false,
            StartedAt = DateTime.UtcNow
        };

        _db.QuizAttempts.Add(attempt);
        await _db.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, Mapper.ToAttemptContent(attempt, quiz));
    }

    /// <summary>UC08/UC09 (bước 1-3) – lấy lại nội dung Quiz đang làm, không lộ đáp án đúng.</summary>
    [HttpGet("api/attempts/{attemptId:int}/content")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AttemptContentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AttemptContentDto>> GetContent(int attemptId, [FromHeader(Name = "X-Guest-Id")] string? guestId)
    {
        var attempt = await _db.QuizAttempts
            .Include(a => a.Quiz).ThenInclude(q => q!.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .FirstOrDefaultAsync(a => a.AttemptId == attemptId);

        if (attempt is null || !OwnsAttempt(attempt, guestId))
            return Problem(detail: $"Attempt {attemptId} was not found.", statusCode: StatusCodes.Status404NotFound);

        return Ok(Mapper.ToAttemptContent(attempt, attempt.Quiz!));
    }

    /// <summary>UC09 – Submit Quiz: chấm tự động các câu có đáp án định nghĩa sẵn, các câu dạng văn bản chờ chấm thủ công (A3).</summary>
    [HttpPost("api/attempts/{attemptId:int}/submit")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(SubmitAttemptResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SubmitAttemptResultDto>> Submit(int attemptId, [FromHeader(Name = "X-Guest-Id")] string? guestId, [FromBody] SubmitAttemptRequest request)
    {
        var attempt = await _db.QuizAttempts
            .Include(a => a.Quiz).ThenInclude(q => q!.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .FirstOrDefaultAsync(a => a.AttemptId == attemptId);

        if (attempt is null || !OwnsAttempt(attempt, guestId))
            return Problem(detail: $"Attempt {attemptId} was not found.", statusCode: StatusCodes.Status404NotFound);

        // Preconditions – "The User has an active Quiz Attempt"
        if (attempt.SubmittedAt is not null)
            return Problem(detail: "This attempt has already been submitted.", statusCode: StatusCodes.Status400BadRequest);

        var quiz = attempt.Quiz!;
        var errors = ValidateSubmission(quiz, request);
        if (errors.Count > 0) // A2 – Submission data is invalid
        {
            foreach (var error in errors) ModelState.AddModelError("answers", error);
            return ValidationProblem(ModelState);
        }

        // Lưu các dòng trả lời (mỗi lựa chọn của câu MultipleChoice là 1 dòng riêng).
        var answers = request.Answers.Select(item => new AttemptAnswer
        {
            QuestionId = item.QuestionId,
            AnswerId = item.AnswerId,
            ResponseText = string.IsNullOrWhiteSpace(item.ResponseText) ? null : item.ResponseText.Trim()
        }).ToList();

        // Chấm theo TỪNG CÂU HỎI của Quiz, không theo từng dòng trả lời:
        // - mẫu số = tổng số câu chấm tự động được của Quiz (câu bỏ trống vẫn tính, và tính là sai);
        // - câu đúng khi tập đáp án đã chọn TRÙNG KHỚP tập đáp án đúng (không thiếu, không thừa).
        var answersByQuestion = answers.ToLookup(a => a.QuestionId);
        var correctCount = 0;
        var gradableCount = 0;
        var pendingReview = 0;

        foreach (var qq in quiz.QuizQuestions)
        {
            var question = qq.Question!;

            if (QuestionTypeRules.UsesPredefinedAnswers(question.QuestionType))
            {
                gradableCount++;

                var selectedIds = answersByQuestion[question.QuestionId]
                    .Where(a => a.AnswerId is not null)
                    .Select(a => a.AnswerId!.Value)
                    .ToHashSet();

                var correctIds = question.Answers.Where(a => a.IsCorrect).Select(a => a.AnswerId).ToHashSet();

                if (correctIds.Count > 0 && selectedIds.SetEquals(correctIds))
                    correctCount++;
            }
            else if (answersByQuestion[question.QuestionId].Any())
            {
                pendingReview++; // A3 – câu dạng văn bản có trả lời thì chờ chấm thủ công
            }
        }

        attempt.SubmittedAt = DateTime.UtcNow;
        attempt.Answers = answers;
        attempt.Score = gradableCount > 0 ? (int)Math.Round(correctCount * 100.0 / gradableCount) : null;

        await _db.SaveChangesAsync();

        return Ok(new SubmitAttemptResultDto(attempt.AttemptId, quiz.QuizId, attempt.SubmittedAt.Value, attempt.Score, gradableCount, pendingReview));
    }

    /// <summary>UC10 – View Quiz Result: chỉ xem được sau khi đã Submit; lộ đáp án đúng để đối chiếu.</summary>
    [HttpGet("api/attempts/{attemptId:int}/result")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AttemptResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AttemptResultDto>> GetResult(int attemptId, [FromHeader(Name = "X-Guest-Id")] string? guestId)
    {
        var attempt = await _db.QuizAttempts
            .Include(a => a.Quiz).ThenInclude(q => q!.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .Include(a => a.Answers)
            .FirstOrDefaultAsync(a => a.AttemptId == attemptId);

        if (attempt is null || !OwnsAttempt(attempt, guestId))
            return Problem(detail: $"Attempt {attemptId} was not found.", statusCode: StatusCodes.Status404NotFound);

        if (attempt.SubmittedAt is null)
            return Problem(detail: "This attempt has not been submitted yet.", statusCode: StatusCodes.Status400BadRequest);

        var quiz = attempt.Quiz!;
        // ToLookup thay cho ToDictionary: 1 câu MultipleChoice có nhiều dòng AttemptAnswer
        // (mỗi lựa chọn 1 dòng) nên khoá QuestionId có thể lặp — ToDictionary sẽ ném exception.
        var answersByQuestion = attempt.Answers.ToLookup(a => a.QuestionId);

        var questions = quiz.QuizQuestions.OrderBy(qq => qq.OrderIndex).Select(qq =>
        {
            var question = qq.Question!;
            var given = answersByQuestion[question.QuestionId].ToList();

            var selectedIds = given.Where(a => a.AnswerId is not null).Select(a => a.AnswerId!.Value).ToList();
            var responseText = given.Select(a => a.ResponseText).FirstOrDefault(t => t is not null);

            // Đúng/sai tính theo TẬP đáp án: chọn đủ và không thừa mới là đúng
            // (cùng quy tắc với phần chấm điểm ở Submit — lỗi 2).
            bool? isCorrect = null;
            if (QuestionTypeRules.UsesPredefinedAnswers(question.QuestionType))
            {
                var correctIds = question.Answers.Where(a => a.IsCorrect).Select(a => a.AnswerId).ToHashSet();
                isCorrect = correctIds.Count > 0 && correctIds.SetEquals(selectedIds);
            }

            return new AttemptResultAnswerDto(question.QuestionId, question.Content, question.QuestionType.ToString(),
                question.Answers.OrderBy(a => a.AnswerId).Select(Mapper.ToAnswer).ToList(),
                selectedIds, responseText, isCorrect);
        }).ToList();

        return Ok(new AttemptResultDto(attempt.AttemptId, quiz.QuizId, quiz.Title, attempt.StartedAt, attempt.SubmittedAt, attempt.Score, questions));
    }

    /// <summary>Quiz "khả dụng để tham gia" = đã Public, chưa bị Admin gỡ, và có ít nhất 1 câu hỏi.</summary>
    private async Task<Quiz?> LoadPlayableQuiz(int quizId)
    {
        var quiz = await _db.Quizzes
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .FirstOrDefaultAsync(q => q.QuizId == quizId);

        if (quiz is null || !quiz.IsPublished || quiz.Status != ContentStatus.Active || quiz.QuizQuestions.Count == 0)
            return null;

        return quiz;
    }

    /// <summary>Guest chỉ truy cập được attempt của chính mình (khớp GuestIdentifier); User chỉ truy cập attempt của chính mình.</summary>
    private bool OwnsAttempt(QuizAttempt attempt, string? guestId)
    {
        if (attempt.IsTrial)
            return !string.IsNullOrWhiteSpace(guestId) && attempt.GuestIdentifier == guestId;

        return (User.Identity?.IsAuthenticated ?? false) && attempt.UserId == User.GetUserId();
    }

    /// <summary>UC09 A3 – kiểm tra câu trả lời gửi lên khớp với cấu trúc Quiz và loại từng câu hỏi.</summary>
    private static List<string> ValidateSubmission(Quiz quiz, SubmitAttemptRequest request)
    {
        var errors = new List<string>();
        var questionsById = quiz.QuizQuestions.Select(qq => qq.Question!).ToDictionary(q => q.QuestionId);
        var answeredOnce = new HashSet<int>();
        var seenSelections = new HashSet<(int QuestionId, int AnswerId)>(); // chặn gửi trùng 1 lựa chọnQuestionTypeRules.UsesPredefinedAnswers

        for (var i = 0; i < request.Answers.Count; i++)
        {
            var item = request.Answers[i];

            if (!questionsById.TryGetValue(item.QuestionId, out var question))
            {
                errors.Add($"answers[{i}]: question {item.QuestionId} does not belong to this quiz.");
                continue;
            }

            var hasText = !string.IsNullOrWhiteSpace(item.ResponseText);

            if (QuestionTypeRules.UsesPredefinedAnswers(question.QuestionType))
            {
                if (item.AnswerId is null)
                    errors.Add($"answers[{i}]: answerId is required for question type {question.QuestionType}.");
                else if (question.Answers.All(a => a.AnswerId != item.AnswerId))
                    errors.Add($"answers[{i}]: answer {item.AnswerId} does not belong to question {question.QuestionId}.");

                if (hasText)
                    errors.Add($"answers[{i}]: responseText is not allowed for question type {question.QuestionType}.");

                if (QuestionTypeRules.AllowsOneSelectionOnly(question.QuestionType) && !answeredOnce.Add(question.QuestionId))
                    errors.Add($"answers[{i}]: question {question.QuestionId} accepts only one selected answer.");
            }
            else
            {
                if (item.AnswerId is not null)
                    errors.Add($"answers[{i}]: answerId is not allowed for question type {question.QuestionType}.");

                if (item.AnswerId is not null && !seenSelections.Add((question.QuestionId, item.AnswerId.Value)))
                    errors.Add($"answers[{i}]: duplicate answer {item.AnswerId} for question {question.QuestionId}.");

                if (!answeredOnce.Add(question.QuestionId))
                    errors.Add($"answers[{i}]: question {question.QuestionId} accepts only one response.");
                // Lưu ý: không bắt buộc hasText — câu hỏi có thể bị bỏ trống khi Submit (UC09 A1 chỉ cảnh báo, không chặn).
            }
        }

        return errors;
    }
}
