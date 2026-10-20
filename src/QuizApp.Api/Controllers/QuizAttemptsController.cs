using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace QuizApp.Api.Controllers;

/// <summary>
/// UC07 – Try Trial Quiz (Guest), UC08 – Take Quiz (User), UC09 – Submit Quiz,
/// UC10 – View Quiz Result; A5 – Lịch sử làm bài, Chấm bài tự luận, Thống kê Quiz.
/// </summary>
[ApiController]
[Produces("application/json")]
public class QuizAttemptsController : ControllerBase
{
    private readonly QuizDbContext _db;

    /// <summary>Số lượt trial tối đa cho mỗi Guest (định danh qua header X-Guest-Id) – SRS UC07 A1.</summary>
    private const int GuestTrialLimit = 3;

    /// <summary>
    /// Số giây cho phép nộp trễ so với Duration (bù độ trễ mạng / thời gian client gửi request khi hết giờ).
    /// Quá thời gian này, Submit bị từ chối (UC08 A3 – kiểm tra phía server, không tin timer của client).
    /// </summary>
    private const int SubmitGraceSeconds = 30;

    public QuizAttemptsController(QuizDbContext db) => _db = db;

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
    public async Task<ActionResult<AttemptContentDto>> StartTrial(int quizId, [FromHeader(Name = "X-Guest-Id")] string? guestId)
    {
        if (string.IsNullOrWhiteSpace(guestId) || guestId.Length > 100)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRequest, "Header X-Guest-Id (max 100 characters) is required to start a trial quiz.");

        var (quiz, error) = await LoadPlayableQuiz(quizId); // A2 – Quiz is no longer available
        if (error is not null) return error;

        // A1 – Trial limit reached
        var usedTrials = await _db.QuizAttempts.CountAsync(a => a.IsTrial && a.GuestIdentifier == guestId);
        if (usedTrials >= GuestTrialLimit)
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.TrialLimit, "Trial limit reached. Please register or log in to continue.");

        var attempt = new QuizAttempt
        {
            QuizId = quizId,
            UserId = null,
            IsTrial = true,
            GuestIdentifier = guestId,
            StartedAt = DateTime.UtcNow,
            DurationMinutes = quiz!.Duration
        };

        _db.QuizAttempts.Add(attempt);
        await _db.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, Mapper.ToAttemptContent(attempt, quiz));
    }

    /// <summary>UC08 – User đã đăng nhập bắt đầu làm 1 Quiz công khai.</summary>
    [HttpPost("api/quizzes/{quizId:int}/attempts")]
    [Authorize]
    [ProducesResponseType(typeof(AttemptContentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AttemptContentDto>> StartAttempt(int quizId)
    {
        var (quiz, error) = await LoadPlayableQuiz(quizId); // A1 – Quiz is unavailable
        if (error is not null) return error;

        var attempt = new QuizAttempt
        {
            QuizId = quizId,
            UserId = User.GetUserId(),
            IsTrial = false,
            StartedAt = DateTime.UtcNow,
            DurationMinutes = quiz!.Duration // chốt thời lượng lúc bắt đầu (UC08 A3)
        };

        _db.QuizAttempts.Add(attempt);
        await _db.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, Mapper.ToAttemptContent(attempt, quiz));
    }

    /// <summary>
    /// UC08/UC09 (bước 1-3) – lấy lại nội dung Quiz đang làm (khi tải lại trang), không lộ đáp án đúng.
    /// Trả kèm StartedAt/ExpiresAt để client khôi phục đồng hồ. Attempt đã nộp -> 409 ATTEMPT_SUBMITTED.
    /// </summary>
    [HttpGet("api/attempts/{attemptId:int}/content")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AttemptContentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AttemptContentDto>> GetContent(int attemptId, [FromHeader(Name = "X-Guest-Id")] string? guestId)
    {
        var attempt = await _db.QuizAttempts
            .AsNoTracking()
            .Include(a => a.Quiz).ThenInclude(q => q!.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.AttemptId == attemptId);

        if (attempt is null || !OwnsAttempt(attempt, guestId))
            return AttemptNotFound(attemptId);

        if (attempt.SubmittedAt is not null)
            return this.ApiProblem(StatusCodes.Status409Conflict, ErrorCodes.AttemptSubmitted, "This attempt has already been submitted.");

        return Ok(Mapper.ToAttemptContent(attempt, attempt.Quiz!));
    }

    /// <summary>UC09 – Submit Quiz: chấm tự động các câu có đáp án định nghĩa sẵn, các câu dạng văn bản chờ chấm thủ công (A3).</summary>
    [HttpPost("api/attempts/{attemptId:int}/submit")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(SubmitAttemptResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<SubmitAttemptResultDto>> Submit(int attemptId, [FromHeader(Name = "X-Guest-Id")] string? guestId, [FromBody] SubmitAttemptRequest request)
    {
        var attempt = await _db.QuizAttempts
            .Include(a => a.Quiz).ThenInclude(q => q!.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.AttemptId == attemptId);

        if (attempt is null || !OwnsAttempt(attempt, guestId))
            return AttemptNotFound(attemptId);

        // Preconditions – "The User has an active Quiz Attempt"
        if (attempt.SubmittedAt is not null)
            return AttemptAlreadySubmitted();

        var quiz = attempt.Quiz!;

        // Quiz bị Admin gỡ / chủ sở hữu xoá trong lúc đang làm -> không nhận bài nữa (UC20 A2).
        // (Quiz bị chủ sở hữu Unpublish thì vẫn cho nộp: UC14 A4 chỉ chặn lượt làm MỚI.)
        if (quiz.Status != ContentStatus.Active)
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.QuizNotAvailable, "This quiz is no longer available and can no longer be submitted.");

        // UC08 A3 – hết thời gian làm bài (kiểm tra phía server, theo thời lượng đã chốt lúc bắt đầu)
        var deadline = attempt.StartedAt.AddMinutes(attempt.DurationMinutes).AddSeconds(SubmitGraceSeconds);
        if (DateTime.UtcNow > deadline)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.AttemptExpired, "The time limit for this attempt has expired.");

        var errors = ValidateSubmission(quiz, request);
        if (errors.Count > 0) // A2 – Submission data is invalid
        {
            foreach (var error in errors) ModelState.AddModelError("answers", error);
            return ValidationProblem(ModelState);
        }

        // Chấm theo TỪNG CÂU HỎI của Quiz, không theo từng dòng trả lời:
        // - chỉ tính các câu còn Active (câu bị Admin gỡ không được tính điểm – UC20 A2);
        // - MỌI câu Active đều có ít nhất 1 dòng AttemptAnswer (câu bỏ trống = dòng rỗng) để kết quả,
        //   lịch sử và chấm lại (A5) không phụ thuộc vào trạng thái hiện tại của Quiz;
        // - câu trắc nghiệm đúng khi tập đáp án đã chọn TRÙNG KHỚP tập đáp án đúng; bỏ trống = sai;
        // - câu văn bản có trả lời chờ chấm thủ công (IsCorrect = null, UC09 A3).
        var givenByQuestion = request.Answers.ToLookup(a => a.QuestionId);
        var rows = new List<AttemptAnswer>();
        var types = new Dictionary<int, QuestionType>();

        foreach (var qq in quiz.ActiveQuestions())
        {
            var question = qq.Question!;
            var given = givenByQuestion[question.QuestionId].ToList();
            types[question.QuestionId] = question.QuestionType;

            if (QuestionTypeRules.UsesPredefinedAnswers(question.QuestionType))
            {
                var selectedIds = given.Where(a => a.AnswerId is not null).Select(a => a.AnswerId!.Value).ToHashSet();
                var correctIds = question.Answers.Where(a => a.IsCorrect).Select(a => a.AnswerId).ToHashSet();
                var isCorrect = correctIds.Count > 0 && selectedIds.SetEquals(correctIds);

                // Chốt kết quả vào từng dòng trả lời -> UC10 đọc lại đúng kết quả lúc nộp, kể cả khi đáp án bị sửa.
                if (selectedIds.Count == 0)
                    rows.Add(new AttemptAnswer { QuestionId = question.QuestionId, IsCorrect = false });
                else
                    rows.AddRange(selectedIds.Select(id => new AttemptAnswer { QuestionId = question.QuestionId, AnswerId = id, IsCorrect = isCorrect }));
            }
            else
            {
                var text = given.Select(a => a.ResponseText).FirstOrDefault(t => !string.IsNullOrWhiteSpace(t))?.Trim();
                rows.Add(new AttemptAnswer { QuestionId = question.QuestionId, ResponseText = text, IsCorrect = null });
            }
        }

        attempt.SubmittedAt = DateTime.UtcNow;
        attempt.Answers = rows;
        ScoreAttempt(attempt, id => types[id]);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // Request Submit khác của cùng attempt đã được lưu trước (RowVersion đã đổi)
            return AttemptAlreadySubmitted();
        }

        return Ok(new SubmitAttemptResultDto(attempt.AttemptId, quiz.QuizId, attempt.SubmittedAt.Value, attempt.Score,
            attempt.MaxScore, attempt.PendingCount, attempt.CorrectCount));
    }

    /// <summary>
    /// UC09 / A5 – tính điểm 1 lượt làm bài từ các dòng AttemptAnswer ĐÃ CHỐT (dùng chung cho Submit và chấm tự luận).
    /// - Câu trắc nghiệm: luôn được chấm (MaxScore +1), đúng nếu dòng có IsCorrect = true.
    /// - Câu văn bản có trả lời: IsCorrect null -> chờ chấm (PendingCount +1); đã chấm -> tính như câu trắc nghiệm.
    /// - Câu văn bản bỏ trống: không tính.
    /// Score = round(CorrectCount * 100 / MaxScore), null khi MaxScore = 0.
    /// </summary>
    internal static void ScoreAttempt(QuizAttempt attempt, Func<int, QuestionType> questionType)
    {
        int correct = 0, max = 0, pending = 0;

        foreach (var group in attempt.Answers.GroupBy(a => a.QuestionId))
        {
            if (QuestionTypeRules.UsesPredefinedAnswers(questionType(group.Key)))
            {
                max++;
                if (group.Any(r => r.IsCorrect == true)) correct++;
                continue;
            }

            var row = group.FirstOrDefault(r => r.ResponseText is not null);
            if (row is null) continue;             // bỏ trống

            if (row.IsCorrect is null) pending++;  // chờ chấm thủ công
            else
            {
                max++;
                if (row.IsCorrect == true) correct++;
            }
        }

        attempt.CorrectCount = correct;
        attempt.MaxScore = max;
        attempt.PendingCount = pending;
        attempt.Score = max > 0 ? (int)Math.Round(correct * 100.0 / max) : null;
    }

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
    public async Task<ActionResult<AttemptResultDto>> GetResult(int attemptId, [FromHeader(Name = "X-Guest-Id")] string? guestId)
    {
        var attempt = await _db.QuizAttempts
            .AsNoTracking()
            .Include(a => a.Quiz).ThenInclude(q => q!.QuizQuestions)
            .Include(a => a.Answers).ThenInclude(aa => aa.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.AttemptId == attemptId);

        if (attempt is null || !OwnsAttempt(attempt, guestId))
            return AttemptNotFound(attemptId);

        if (attempt.SubmittedAt is null)
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.AttemptNotSubmitted, "This attempt has not been submitted yet.");

        var quiz = attempt.Quiz!;
        var hideAnswers = attempt.IsTrial;
        var order = quiz.QuizQuestions.ToDictionary(qq => qq.QuestionId, qq => qq.OrderIndex);

        // Dựng kết quả từ các dòng ĐÃ CHỐT lúc Submit (mỗi câu có ≥ 1 dòng), không từ trạng thái Quiz hiện tại.
        // Thứ tự theo OrderIndex hiện tại (nếu câu còn trong Quiz), sau đó theo QuestionId.
        // Câu bị Admin gỡ (Removed) không hiển thị (UC20 A2) nhưng điểm đã chốt vẫn giữ nguyên.
        var questions = attempt.Answers
            .GroupBy(aa => aa.QuestionId)
            .Select(g => (Rows: g.ToList(), Question: g.First().Question!))
            .Where(x => x.Question.Status != ContentStatus.Removed)
            .OrderBy(x => order.TryGetValue(x.Question.QuestionId, out var index) ? index : int.MaxValue)
            .ThenBy(x => x.Question.QuestionId)
            .Select(x =>
            {
                var question = x.Question;
                var selectedIds = x.Rows.Where(a => a.AnswerId is not null).Select(a => a.AnswerId!.Value).ToList();
                var responseText = x.Rows.Select(a => a.ResponseText).FirstOrDefault(t => t is not null);

                var options = question.Answers.OrderBy(a => a.AnswerId)
                    .Select(a => new ResultAnswerOptionDto(a.AnswerId, a.QuestionId, a.Content, hideAnswers ? null : a.IsCorrect))
                    .ToList();

                // Đúng/sai lấy từ kết quả ĐÃ CHỐT (AttemptAnswer.IsCorrect), không tính lại theo đáp án hiện tại.
                return new AttemptResultAnswerDto(question.QuestionId, question.Content, question.QuestionType.ToString(),
                    options, selectedIds, responseText, x.Rows[0].IsCorrect);
            })
            .ToList();

        return Ok(new AttemptResultDto(attempt.AttemptId, quiz.QuizId, quiz.Title, attempt.StartedAt, attempt.SubmittedAt,
            attempt.Score, questions, hideAnswers, attempt.CorrectCount, attempt.MaxScore, attempt.PendingCount));
    }

    /// <summary>
    /// A5 – "Bài đã làm": các lượt ĐÃ NỘP của User đang đăng nhập (không gồm trial), phân trang.
    /// sort = newest (mặc định, theo SubmittedAt) | oldest | title (theo tên Quiz). Quiz đã xoá vẫn hiện (QuizDeleted = true).
    /// </summary>
    [HttpGet("api/attempts/mine")]
    [Authorize]
    [ProducesResponseType(typeof(PagedResult<AttemptHistoryItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<AttemptHistoryItemDto>>> GetMyAttempts([FromQuery] PageQuery paging)
    {
        var userId = User.GetUserId();
        var query = _db.QuizAttempts.AsNoTracking()
            .Where(a => a.UserId == userId && !a.IsTrial && a.SubmittedAt != null);

        query = paging.SortKey switch
        {
            "oldest" => query.OrderBy(a => a.SubmittedAt).ThenBy(a => a.AttemptId),
            "title" => query.OrderBy(a => a.Quiz!.Title).ThenByDescending(a => a.SubmittedAt),
            _ => query.OrderByDescending(a => a.SubmittedAt).ThenByDescending(a => a.AttemptId)
        };

        return Ok(await query
            .Select(a => new AttemptHistoryItemDto(a.AttemptId, a.QuizId, a.Quiz!.Title, a.Quiz.Status == ContentStatus.Deleted,
                a.StartedAt, a.SubmittedAt, a.Score, a.CorrectCount, a.MaxScore, a.PendingCount))
            .ToPagedResultAsync(paging));
    }

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
    public async Task<ActionResult<PagedResult<GradingItemDto>>> GetGradingQueue(int quizId, [FromQuery] PageQuery paging, [FromQuery] bool includeGraded = false)
    {
        var access = await CheckQuizManagerAsync(quizId);
        if (access is not null) return access;

        var query = _db.AttemptAnswers.AsNoTracking()
            .Where(aa => aa.Attempt!.QuizId == quizId && !aa.Attempt.IsTrial && aa.Attempt.SubmittedAt != null
                         && aa.ResponseText != null);

        if (!includeGraded)
            query = query.Where(aa => aa.IsCorrect == null);

        query = paging.SortKey == "oldest"
            ? query.OrderBy(aa => aa.Attempt!.SubmittedAt).ThenBy(aa => aa.AttemptAnswerId)
            : query.OrderByDescending(aa => aa.Attempt!.SubmittedAt).ThenByDescending(aa => aa.AttemptAnswerId);

        return Ok(await query
            .Select(aa => new GradingItemDto(aa.AttemptAnswerId, aa.AttemptId, aa.QuestionId, aa.Question!.Content,
                aa.Question.QuestionType.ToString(), aa.ResponseText!, aa.Attempt!.User!.Username,
                aa.Attempt.SubmittedAt!.Value, aa.IsCorrect))
            .ToPagedResultAsync(paging));
    }

    /// <summary>
    /// A5 / UC09 A3 – chủ Quiz/Admin chấm 1 câu trả lời văn bản (đúng/sai), rồi tính lại điểm của lượt làm bài
    /// bằng <see cref="ScoreAttempt"/>. Câu đã chấm có thể chấm lại.
    /// </summary>
    [HttpPut("api/attempt-answers/{attemptAnswerId:int}/grade")]
    [Authorize]
    [ProducesResponseType(typeof(GradeResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<GradeResultDto>> GradeAnswer(int attemptAnswerId, [FromBody] GradeAnswerRequest request)
    {
        var row = await _db.AttemptAnswers
            .Include(aa => aa.Question)
            .Include(aa => aa.Attempt).ThenInclude(a => a!.Quiz)
            .FirstOrDefaultAsync(aa => aa.AttemptAnswerId == attemptAnswerId);

        if (row is null)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.AnswerNotFound, $"Attempt answer {attemptAnswerId} was not found.");

        var attempt = row.Attempt!;
        if (!User.CanManage(attempt.Quiz!.OwnerId))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this quiz.");

        if (attempt.SubmittedAt is null || row.ResponseText is null
            || QuestionTypeRules.UsesPredefinedAnswers(row.Question!.QuestionType))
            return this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.NotGradable,
                "Only submitted, non-empty text answers can be graded manually.");

        row.IsCorrect = request.IsCorrect!.Value;

        // Nạp toàn bộ dòng trả lời của lượt làm bài để tính lại điểm
        await _db.Entry(attempt).Collection(a => a.Answers).Query().Include(aa => aa.Question).LoadAsync();
        var types = attempt.Answers.GroupBy(aa => aa.QuestionId).ToDictionary(g => g.Key, g => g.First().Question!.QuestionType);
        ScoreAttempt(attempt, id => types[id]);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return this.ApiProblem(StatusCodes.Status409Conflict, ErrorCodes.ConcurrencyConflict,
                "This attempt was updated by another request. Please reload and try again.");
        }

        return Ok(new GradeResultDto(attempt.AttemptId, attempt.Score, attempt.CorrectCount, attempt.MaxScore, attempt.PendingCount));
    }

    /// <summary>
    /// A5 – thống kê Quiz cho chủ sở hữu/Admin: số lượt, số người, điểm trung bình, số câu chờ chấm và tỉ lệ đúng từng câu.
    /// Chỉ tính lượt đã nộp, không gồm trial. Tổng hợp bằng GroupBy trong SQL.
    /// </summary>
    [HttpGet("api/quizzes/{quizId:int}/stats")]
    [Authorize]
    [ProducesResponseType(typeof(QuizStatsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QuizStatsDto>> GetQuizStats(int quizId)
    {
        var access = await CheckQuizManagerAsync(quizId);
        if (access is not null) return access;

        var attempts = _db.QuizAttempts.AsNoTracking()
            .Where(a => a.QuizId == quizId && !a.IsTrial && a.SubmittedAt != null);

        var attemptCount = await attempts.CountAsync();
        var uniqueUsers = await attempts.Select(a => a.UserId).Distinct().CountAsync();
        var averageScore = await attempts.Where(a => a.Score != null).AverageAsync(a => (double?)a.Score) ?? 0;
        var pendingCount = await attempts.SumAsync(a => a.PendingCount);

        // Mỗi câu: số lượt đã trả lời, số lượt đúng, số lượt đã được chấm (mẫu số của tỉ lệ đúng)
        var perQuestion = await _db.AttemptAnswers.AsNoTracking()
            .Where(aa => aa.Attempt!.QuizId == quizId && !aa.Attempt.IsTrial && aa.Attempt.SubmittedAt != null)
            .GroupBy(aa => aa.QuestionId)
            .Select(g => new
            {
                QuestionId = g.Key,
                Answered = g.Where(x => x.AnswerId != null || x.ResponseText != null).Select(x => x.AttemptId).Distinct().Count(),
                Correct = g.Where(x => x.IsCorrect == true).Select(x => x.AttemptId).Distinct().Count(),
                Graded = g.Where(x => x.IsCorrect != null).Select(x => x.AttemptId).Distinct().Count()
            })
            .ToListAsync();

        // Danh sách câu: theo thứ tự hiện tại của Quiz, rồi các câu chỉ còn trong lịch sử (đã gỡ khỏi Quiz)
        var currentOrder = await _db.QuizQuestions.AsNoTracking()
            .Where(qq => qq.QuizId == quizId).OrderBy(qq => qq.OrderIndex).Select(qq => qq.QuestionId).ToListAsync();
        var questionIds = currentOrder.Concat(perQuestion.Select(p => p.QuestionId).OrderBy(id => id)).Distinct().ToList();

        var questionInfo = await _db.Questions.AsNoTracking()
            .Where(q => questionIds.Contains(q.QuestionId))
            .Select(q => new { q.QuestionId, q.Content, q.QuestionType })
            .ToDictionaryAsync(q => q.QuestionId);
        var statsById = perQuestion.ToDictionary(p => p.QuestionId);

        var questions = questionIds.Where(questionInfo.ContainsKey).Select(id =>
        {
            var info = questionInfo[id];
            statsById.TryGetValue(id, out var stat);
            var answered = stat?.Answered ?? 0;
            var correct = stat?.Correct ?? 0;
            var graded = stat?.Graded ?? 0;
            var rate = graded > 0 ? Math.Round(correct * 100.0 / graded, 1) : 0;
            return new QuestionStatDto(id, info.Content, info.QuestionType.ToString(), answered, correct, rate);
        }).ToList();

        return Ok(new QuizStatsDto(attemptCount, uniqueUsers, Math.Round(averageScore, 1), pendingCount, questions));
    }

    /// <summary>Quiz tồn tại (chưa xoá) và người gọi là chủ sở hữu/Admin; null nếu hợp lệ, ngược lại là response lỗi.</summary>
    private async Task<ObjectResult?> CheckQuizManagerAsync(int quizId)
    {
        var ownerId = await _db.Quizzes.AsNoTracking()
            .Where(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted)
            .Select(q => (int?)q.OwnerId)
            .FirstOrDefaultAsync();

        if (ownerId is null)
            return this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.QuizNotFound, $"Quiz {quizId} was not found.");

        if (!User.CanManage(ownerId.Value))
            return this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "You do not own this quiz.");

        return null;
    }

    /// <summary>
    /// Quiz "khả dụng để tham gia" = tồn tại (chưa xoá), đã Public, chưa bị Admin gỡ, và có ít nhất 1 câu hỏi Active.
    /// Trả về (quiz, null) nếu hợp lệ; ngược lại (null, lỗi): 404 QUIZ_NOT_FOUND / 403 QUIZ_NOT_AVAILABLE / 400 QUIZ_NO_QUESTIONS.
    /// </summary>
    private async Task<(Quiz? Quiz, ObjectResult? Error)> LoadPlayableQuiz(int quizId)
    {
        var quiz = await _db.Quizzes
            .AsNoTracking()
            .Include(q => q.QuizQuestions).ThenInclude(qq => qq.Question).ThenInclude(q => q!.Answers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(q => q.QuizId == quizId && q.Status != ContentStatus.Deleted);

        if (quiz is null)
            return (null, this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.QuizNotFound, $"Quiz {quizId} was not found."));

        if (!quiz.IsPublished || quiz.Status != ContentStatus.Active)
            return (null, this.ApiProblem(StatusCodes.Status403Forbidden, ErrorCodes.QuizNotAvailable, $"Quiz {quizId} is not available."));

        // Chỉ tính câu còn Active: quiz mà mọi câu đều bị Admin gỡ thì không còn làm được (UC20 A2)
        if (quiz.ActiveQuestions().Count == 0)
            return (null, this.ApiProblem(StatusCodes.Status400BadRequest, ErrorCodes.QuizNoQuestions, $"Quiz {quizId} has no available questions."));

        return (quiz, null);
    }

    private ObjectResult AttemptNotFound(int attemptId) =>
        this.ApiProblem(StatusCodes.Status404NotFound, ErrorCodes.AttemptNotFound, $"Attempt {attemptId} was not found.");

    private ObjectResult AttemptAlreadySubmitted() =>
        this.ApiProblem(StatusCodes.Status409Conflict, ErrorCodes.AttemptSubmitted, "This attempt has already been submitted.");

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
        // Chỉ câu còn Active mới được trả lời (câu bị Admin gỡ không còn trong đề – UC20 A2)
        var questionsById = quiz.ActiveQuestions().Select(qq => qq.Question!).ToDictionary(q => q.QuestionId);
        var answeredOnce = new HashSet<int>();
        var seenSelections = new HashSet<(int QuestionId, int AnswerId)>(); // chặn gửi trùng 1 lựa chọn (MultipleChoice)

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

                // Chặn gửi cùng 1 lựa chọn 2 lần (trước đây đoạn này nằm nhầm ở nhánh câu văn bản nên không bao giờ chạy)
                if (item.AnswerId is not null && !seenSelections.Add((question.QuestionId, item.AnswerId.Value)))
                    errors.Add($"answers[{i}]: duplicate answer {item.AnswerId} for question {question.QuestionId}.");
            }
            else
            {
                if (item.AnswerId is not null)
                    errors.Add($"answers[{i}]: answerId is not allowed for question type {question.QuestionType}.");

                if (!answeredOnce.Add(question.QuestionId))
                    errors.Add($"answers[{i}]: question {question.QuestionId} accepts only one response.");
                // Lưu ý: không bắt buộc hasText — câu hỏi có thể bị bỏ trống khi Submit (UC09 A1 chỉ cảnh báo, không chặn).
            }
        }

        return errors;
    }
}
