using Microsoft.EntityFrameworkCore;
using QuizApp.Application.Abstractions;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Services.QuestionBanks;

/// <summary>
/// UC15 – Manage Question Bank (Bank + Question + Answer thuộc về nó) và
/// UC16 – Search Public Questions.
/// </summary>
public interface IQuestionBankService
{
    /// <summary>UC15 – danh sách Question Bank của User đang đăng nhập (bỏ qua bank đã xoá mềm), phân trang.</summary>
    Task<Result<PagedResult<QuestionBankDto>>> GetMyBanksAsync(PageQuery paging, CancellationToken ct = default);

    /// <summary>UC16 – duyệt các Question Bank công khai, lọc theo tên bank hoặc tên người tạo, phân trang.</summary>
    Task<Result<PagedResult<QuestionBankInfoDto>>> GetPublicBanksAsync(string? search, PageQuery paging, CancellationToken ct = default);

    /// <summary>UC15/UC16 – thông tin 1 Question Bank. Bank riêng tư của người khác -> NotFound (BANK_NOT_FOUND).</summary>
    Task<Result<QuestionBankInfoDto>> GetBankAsync(int bankId, CancellationToken ct = default);

    /// <summary>UC16 – Search Public Questions (không lộ đáp án đúng).</summary>
    Task<Result<List<PublicQuestionDto>>> SearchPublicQuestionsAsync(string? search, CancellationToken ct = default);

    /// <summary>UC15 – tạo Question Bank mới.</summary>
    Task<Result<QuestionBankDto>> CreateBankAsync(QuestionBankRequest request, CancellationToken ct = default);

    /// <summary>UC15 – cập nhật thông tin Question Bank.</summary>
    Task<Result<QuestionBankDto>> UpdateBankAsync(int bankId, QuestionBankRequest request, CancellationToken ct = default);

    /// <summary>UC15 A3 – xoá Question Bank (xoá mềm nếu đã có lịch sử làm bài).</summary>
    Task<Result> DeleteBankAsync(int bankId, CancellationToken ct = default);

    /// <summary>
    /// UC15 – câu hỏi thuộc một Question Bank. Chủ sở hữu/Admin nhận <c>List&lt;QuestionDto&gt;</c>,
    /// người khác nhận <c>List&lt;PublicQuestionDto&gt;</c> (không có đáp án đúng).
    /// </summary>
    Task<Result<object>> GetBankQuestionsAsync(int bankId, CancellationToken ct = default);

    /// <summary>UC15 – thêm 1 Question (kèm Answer nếu có) vào Question Bank.</summary>
    Task<Result<QuestionDto>> AddQuestionAsync(int bankId, QuestionAndAnswersRequest request, CancellationToken ct = default);

    /// <summary>UC15 – cập nhật nội dung/loại Question.</summary>
    Task<Result<QuestionDto>> UpdateQuestionAsync(int questionId, QuestionRequest request, CancellationToken ct = default);

    /// <summary>UC15 – sửa Question kèm toàn bộ Answer trong 1 transaction.</summary>
    Task<Result<QuestionDto>> ReplaceQuestionAsync(int questionId, ReplaceQuestionRequest request, CancellationToken ct = default);

    /// <summary>UC15 – xoá Question cùng Answer của nó (xoá mềm nếu đã có lịch sử làm bài).</summary>
    Task<Result> DeleteQuestionAsync(int questionId, CancellationToken ct = default);

    /// <summary>UC15 – thêm 1 Answer định nghĩa sẵn cho Question.</summary>
    Task<Result<AnswerDto>> AddAnswerAsync(int questionId, AnswerRequest request, CancellationToken ct = default);

    /// <summary>UC15 – cập nhật 1 Answer.</summary>
    Task<Result<AnswerDto>> UpdateAnswerAsync(int answerId, AnswerRequest request, CancellationToken ct = default);

    /// <summary>UC15 – xoá 1 Answer (gỡ tham chiếu ở các lượt làm bài cũ).</summary>
    Task<Result> DeleteAnswerAsync(int answerId, CancellationToken ct = default);
}

public sealed class QuestionBankService : IQuestionBankService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public QuestionBankService(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<Result<PagedResult<QuestionBankDto>>> GetMyBanksAsync(PageQuery paging, CancellationToken ct = default)
    {
        var userId = _currentUser.RequireUserId();
        var query = _db.QuestionBanks.AsNoTracking().Where(b => b.OwnerId == userId && !b.IsDeleted);

        // sort = newest (mặc định) | oldest | title (theo Name)
        query = paging.SortKey switch
        {
            "oldest" => query.OrderBy(b => b.CreatedAt).ThenBy(b => b.QuestionBankId),
            "title" => query.OrderBy(b => b.Name).ThenBy(b => b.QuestionBankId),
            _ => query.OrderByDescending(b => b.CreatedAt).ThenByDescending(b => b.QuestionBankId)
        };

        return await query
            .Select(b => new QuestionBankDto(b.QuestionBankId, b.Name, b.Description, b.IsPublic,
                b.Questions.Count(q => q.Status != ContentStatus.Deleted), b.CreatedAt))
            .ToPagedResultAsync(paging, ct);
    }

    public async Task<Result<PagedResult<QuestionBankInfoDto>>> GetPublicBanksAsync(string? search, PageQuery paging, CancellationToken ct = default)
    {
        // Gồm cả bank của chính mình; bank không còn câu Active nào vẫn hiển thị (QuestionCount = 0)
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

        return await query
            .Select(b => new QuestionBankInfoDto(b.QuestionBankId, b.Name, b.Description, b.IsPublic,
                b.Questions.Count(q => q.Status == ContentStatus.Active), b.Owner!.Username,
                isAdmin || b.OwnerId == viewerId, b.CreatedAt))
            .ToPagedResultAsync(paging, ct);
    }

    public async Task<Result<QuestionBankInfoDto>> GetBankAsync(int bankId, CancellationToken ct = default)
    {
        // Chủ sở hữu/Admin xem mọi bank của mình, người khác chỉ xem bank công khai
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
            .FirstOrDefaultAsync(ct);

        // Bank riêng tư của người khác trả 404 (không tiết lộ là bank tồn tại)
        if (info is null || (!info.Dto.IsPublic && !info.Dto.CanManage))
            return BankNotFound(bankId);

        return info.Dto;
    }

    public async Task<Result<List<PublicQuestionDto>>> SearchPublicQuestionsAsync(string? search, CancellationToken ct = default)
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

        var questions = await query.OrderByDescending(q => q.CreatedAt).Take(100).ToListAsync(ct);
        return questions.Select(Mapper.ToPublicQuestion).ToList(); // A1 – danh sách rỗng nếu không có kết quả phù hợp
    }

    public async Task<Result<QuestionBankDto>> CreateBankAsync(QuestionBankRequest request, CancellationToken ct = default)
    {
        var bank = new QuestionBank
        {
            OwnerId = _currentUser.RequireUserId(),
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsPublic = request.IsPublic,
            CreatedAt = DateTime.UtcNow
        };

        _db.QuestionBanks.Add(bank);
        await _db.SaveChangesAsync(ct);

        return Mapper.ToQuestionBank(bank);
    }

    public async Task<Result<QuestionBankDto>> UpdateBankAsync(int bankId, QuestionBankRequest request, CancellationToken ct = default)
    {
        var bank = await _db.QuestionBanks.Include(b => b.Questions).FirstOrDefaultAsync(b => b.QuestionBankId == bankId, ct);
        if (bank is null || bank.IsDeleted)
            return BankNotFound(bankId);

        // A4 – User attempts to modify another User's Question Bank
        if (!_currentUser.CanManage(bank.OwnerId))
            return NotBankOwner();

        bank.Name = request.Name.Trim();
        bank.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        bank.IsPublic = request.IsPublic;

        await _db.SaveChangesAsync(ct);
        return Mapper.ToQuestionBank(bank);
    }

    public async Task<Result> DeleteBankAsync(int bankId, CancellationToken ct = default)
    {
        var bank = await _db.QuestionBanks.FirstOrDefaultAsync(b => b.QuestionBankId == bankId, ct);
        if (bank is null || bank.IsDeleted)
            return BankNotFound(bankId);

        if (!_currentUser.CanManage(bank.OwnerId))
            return NotBankOwner();

        // Chặn nếu còn Question đang được Quiz nào đó sử dụng
        var questionIds = await _db.Questions.Where(q => q.QuestionBankId == bankId).Select(q => q.QuestionId).ToListAsync(ct);
        var inUse = await _db.QuizQuestions.AnyAsync(qq => questionIds.Contains(qq.QuestionId), ct);
        if (inUse)
            return Error.Conflict(ErrorCodes.QuestionInUse, "This Question Bank still has questions used by existing quizzes. Remove them from those quizzes first.");

        // Có Question đã từng xuất hiện trong lượt làm bài (AttemptAnswer tham chiếu tới) thì KHÔNG xoá cứng được
        // (khoá ngoại Restrict -> lỗi 500, và làm mất kết quả cũ) -> xoá mềm (UC17 A4). Ngược lại xoá cứng.
        var hasAttemptHistory = await _db.AttemptAnswers.AnyAsync(aa => questionIds.Contains(aa.QuestionId), ct);

        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        if (hasAttemptHistory)
        {
            // Xoá mềm – giữ dữ liệu để các kết quả làm bài cũ vẫn hiển thị được
            await _db.Questions.Where(q => q.QuestionBankId == bankId)
                .ExecuteUpdateAsync(s => s.SetProperty(q => q.Status, ContentStatus.Deleted), ct);
            bank.IsDeleted = true;
            await _db.SaveChangesAsync(ct);
        }
        else
        {
            await _db.Answers.Where(a => questionIds.Contains(a.QuestionId)).ExecuteDeleteAsync(ct);
            await _db.Questions.Where(q => q.QuestionBankId == bankId).ExecuteDeleteAsync(ct);
            await _db.QuestionBanks.Where(b => b.QuestionBankId == bankId).ExecuteDeleteAsync(ct);
        }

        await transaction.CommitAsync(ct);
        return Result.Success();
    }

    public async Task<Result<object>> GetBankQuestionsAsync(int bankId, CancellationToken ct = default)
    {
        var bank = await _db.QuestionBanks.AsNoTracking().FirstOrDefaultAsync(b => b.QuestionBankId == bankId, ct);
        if (bank is null || bank.IsDeleted)
            return BankNotFound(bankId);

        var isOwner = _currentUser.CanManage(bank.OwnerId);
        if (!bank.IsPublic && !isOwner)
            return BankNotFound(bankId);

        var query = _db.Questions.AsNoTracking().Include(q => q.Answers).Include(q => q.QuestionBank)
            .Where(q => q.QuestionBankId == bankId);

        // Chủ sở hữu / Admin: xem đầy đủ (kể cả IsCorrect và câu bị Admin gỡ)
        if (isOwner)
        {
            var own = await query.Where(q => q.Status != ContentStatus.Deleted).OrderBy(q => q.QuestionId).ToListAsync(ct);
            return own.Select(Mapper.ToQuestion).ToList();
        }

        // Người khác (chỉ với bank công khai): chỉ thấy câu Active và KHÔNG thấy đáp án đúng
        var visible = await query.Where(q => q.Status == ContentStatus.Active).OrderBy(q => q.QuestionId).ToListAsync(ct);
        return visible.Select(Mapper.ToPublicQuestion).ToList();
    }

    public async Task<Result<QuestionDto>> AddQuestionAsync(int bankId, QuestionAndAnswersRequest request, CancellationToken ct = default)
    {
        var bank = await _db.QuestionBanks.FirstOrDefaultAsync(b => b.QuestionBankId == bankId, ct);
        if (bank is null || bank.IsDeleted)
            return BankNotFound(bankId);

        if (!_currentUser.CanManage(bank.OwnerId))
            return NotBankOwner();

        var ruleError = SharedRules.ValidateAnswers(request.QuestionType!.Value, request.Answers);
        if (ruleError is not null)
            return Error.Validation(ErrorCodes.InvalidRequest, ruleError);

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
        await _db.SaveChangesAsync(ct);

        return Mapper.ToQuestion(question);
    }

    public async Task<Result<QuestionDto>> UpdateQuestionAsync(int questionId, QuestionRequest request, CancellationToken ct = default)
    {
        var question = await _db.Questions.Include(q => q.QuestionBank).Include(q => q.Answers)
            .FirstOrDefaultAsync(q => q.QuestionId == questionId, ct);

        if (question is null || question.Status == ContentStatus.Deleted)
            return QuestionNotFound(questionId);

        if (!_currentUser.CanManage(question.QuestionBank!.OwnerId))
            return NotQuestionOwner();

        var newType = request.QuestionType!.Value;

        if (question.QuestionType != newType)
        {
            // Đổi sang loại không dùng đáp án định nghĩa sẵn trong khi vẫn còn Answer sẽ để lại dữ liệu mồ côi.
            if (question.Answers.Count > 0 && !QuestionTypeRules.UsesPredefinedAnswers(newType))
                return Error.Validation(ErrorCodes.InvalidRequest, $"Question {questionId} still has predefined answers. Remove them before changing the type to {newType}.");

            // Đổi sang SingleChoice/TrueFalse khi đang có nhiều hơn 1 đáp án đúng -> vi phạm quy tắc của loại mới.
            if (QuestionTypeRules.AllowsOneSelectionOnly(newType) && question.Answers.Count(a => a.IsCorrect) > 1)
                return Error.Validation(ErrorCodes.InvalidRequest, $"Question type {newType} allows only one correct answer. Question {questionId} currently has {question.Answers.Count(a => a.IsCorrect)}.");

            var playError = await CheckStillPlayableAsync(questionId, newType, question.Answers.Count, question.Answers.Count(a => a.IsCorrect), ct);
            if (playError is not null)
                return Error.Validation(ErrorCodes.InvalidRequest, playError);
        }

        question.Content = request.Content.Trim();
        question.QuestionType = newType;

        await _db.SaveChangesAsync(ct);
        return Mapper.ToQuestion(question);
    }

    public async Task<Result<QuestionDto>> ReplaceQuestionAsync(int questionId, ReplaceQuestionRequest request, CancellationToken ct = default)
    {
        // Sửa Question + toàn bộ Answer trong 1 transaction để không vướng quy tắc ở trạng thái trung gian
        // (vd đổi đáp án đúng duy nhất của SingleChoice từ A sang B).
        var question = await _db.Questions.Include(q => q.QuestionBank).Include(q => q.Answers)
            .FirstOrDefaultAsync(q => q.QuestionId == questionId, ct);

        if (question is null || question.Status == ContentStatus.Deleted)
            return QuestionNotFound(questionId);

        if (!_currentUser.CanManage(question.QuestionBank!.OwnerId))
            return NotQuestionOwner();

        var existingIds = question.Answers.Select(a => a.AnswerId).ToHashSet();
        var requestedIds = request.Answers.Where(a => a.AnswerId is not null).Select(a => a.AnswerId!.Value).ToList();
        if (requestedIds.Count != requestedIds.Distinct().Count() || requestedIds.Any(id => !existingIds.Contains(id)))
            return Error.Validation(ErrorCodes.InvalidRequest, "Answer ids must be unique and belong to this question.");

        var newType = request.QuestionType!.Value;
        var ruleError = SharedRules.ValidateAnswers(newType, request.Answers.Cast<AnswerRequest>().ToList());
        if (ruleError is not null)
            return Error.Validation(ErrorCodes.InvalidRequest, ruleError);

        var playError = await CheckStillPlayableAsync(questionId, newType, request.Answers.Count, request.Answers.Count(a => a.IsCorrect), ct);
        if (playError is not null)
            return Error.Validation(ErrorCodes.InvalidRequest, playError);

        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        question.Content = request.Content.Trim();
        question.QuestionType = newType;

        // Answer bị bỏ khỏi danh sách -> xoá; lượt làm bài cũ đã chọn nó được gỡ tham chiếu như DeleteAnswer
        var keep = requestedIds.ToHashSet();
        var removed = question.Answers.Where(a => !keep.Contains(a.AnswerId)).ToList();
        if (removed.Count > 0)
        {
            var removedIds = removed.Select(a => a.AnswerId).ToList();
            await _db.AttemptAnswers.Where(aa => aa.AnswerId != null && removedIds.Contains(aa.AnswerId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(aa => aa.AnswerId, (int?)null), ct);
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

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return Mapper.ToQuestion(question);
    }

    public async Task<Result> DeleteQuestionAsync(int questionId, CancellationToken ct = default)
    {
        var question = await _db.Questions.Include(q => q.QuestionBank).FirstOrDefaultAsync(q => q.QuestionId == questionId, ct);
        if (question is null || question.Status == ContentStatus.Deleted)
            return QuestionNotFound(questionId);

        if (!_currentUser.CanManage(question.QuestionBank!.OwnerId))
            return NotQuestionOwner();

        // Chặn nếu đang được dùng trong Quiz nào đó
        var inUse = await _db.QuizQuestions.AnyAsync(qq => qq.QuestionId == questionId, ct);
        if (inUse)
            return Error.Conflict(ErrorCodes.QuestionInUse, "This question is used by one or more quizzes. Remove it from those quizzes first.");

        // Đã có lịch sử làm bài -> xoá mềm thay vì xoá cứng, tránh lỗi khoá ngoại với AttemptAnswer
        // và giữ nguyên kết quả làm bài cũ (UC17 A4).
        var hasAttemptHistory = await _db.AttemptAnswers.AnyAsync(aa => aa.QuestionId == questionId, ct);
        if (hasAttemptHistory)
        {
            question.Status = ContentStatus.Deleted; // xoá mềm
            await _db.SaveChangesAsync(ct);
            return Result.Success();
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(ct);
        await _db.Answers.Where(a => a.QuestionId == questionId).ExecuteDeleteAsync(ct);
        await _db.Questions.Where(q => q.QuestionId == questionId).ExecuteDeleteAsync(ct);
        await transaction.CommitAsync(ct);

        return Result.Success();
    }

    public async Task<Result<AnswerDto>> AddAnswerAsync(int questionId, AnswerRequest request, CancellationToken ct = default)
    {
        var question = await _db.Questions.Include(q => q.QuestionBank).Include(q => q.Answers)
            .FirstOrDefaultAsync(q => q.QuestionId == questionId, ct);

        if (question is null || question.Status == ContentStatus.Deleted)
            return QuestionNotFound(questionId);

        if (!_currentUser.CanManage(question.QuestionBank!.OwnerId))
            return NotQuestionOwner();

        var ruleError = ValidateAgainstQuestionType(question, request.IsCorrect, currentAnswerId: null);
        if (ruleError is not null)
            return Error.Validation(ErrorCodes.InvalidRequest, ruleError);

        var answer = new Answer { QuestionId = questionId, Content = request.Content.Trim(), IsCorrect = request.IsCorrect };
        _db.Answers.Add(answer);
        await _db.SaveChangesAsync(ct);

        return Mapper.ToAnswer(answer);
    }

    public async Task<Result<AnswerDto>> UpdateAnswerAsync(int answerId, AnswerRequest request, CancellationToken ct = default)
    {
        var answer = await _db.Answers.Include(a => a.Question).ThenInclude(q => q!.QuestionBank)
            .Include(a => a.Question).ThenInclude(q => q!.Answers)
            .FirstOrDefaultAsync(a => a.AnswerId == answerId, ct);

        if (answer is null || answer.Question!.Status == ContentStatus.Deleted)
            return AnswerNotFound(answerId);

        if (!_currentUser.CanManage(answer.Question.QuestionBank!.OwnerId))
            return NotAnswerOwner();

        var ruleError = ValidateAgainstQuestionType(answer.Question, request.IsCorrect, currentAnswerId: answerId);
        if (ruleError is not null)
            return Error.Validation(ErrorCodes.InvalidRequest, ruleError);

        // Bỏ tick đáp án đúng duy nhất của câu đang nằm trong Quiz đã Publish -> câu không thể làm đúng nữa
        var correctAfter = answer.Question.Answers.Count(a => a.AnswerId != answerId && a.IsCorrect) + (request.IsCorrect ? 1 : 0);
        var playError = await CheckStillPlayableAsync(answer.QuestionId, answer.Question.QuestionType, answer.Question.Answers.Count, correctAfter, ct);
        if (playError is not null)
            return Error.Validation(ErrorCodes.InvalidRequest, playError);

        answer.Content = request.Content.Trim();
        answer.IsCorrect = request.IsCorrect;

        await _db.SaveChangesAsync(ct);
        return Mapper.ToAnswer(answer);
    }

    public async Task<Result> DeleteAnswerAsync(int answerId, CancellationToken ct = default)
    {
        var answer = await _db.Answers.Include(a => a.Question).ThenInclude(q => q!.QuestionBank)
            .Include(a => a.Question).ThenInclude(q => q!.Answers)
            .FirstOrDefaultAsync(a => a.AnswerId == answerId, ct);

        if (answer is null || answer.Question!.Status == ContentStatus.Deleted)
            return AnswerNotFound(answerId);

        if (!_currentUser.CanManage(answer.Question.QuestionBank!.OwnerId))
            return NotAnswerOwner();

        var question = answer.Question;
        var correctAfter = question.Answers.Count(a => a.AnswerId != answerId && a.IsCorrect);
        var playError = await CheckStillPlayableAsync(question.QuestionId, question.QuestionType, question.Answers.Count - 1, correctAfter, ct);
        if (playError is not null)
            return Error.Validation(ErrorCodes.InvalidRequest, playError);

        // Các lượt làm bài cũ đã chọn đáp án này được gỡ tham chiếu (AnswerId = null);
        // kết quả đúng/sai của chúng vẫn giữ nguyên nhờ AttemptAnswer.IsCorrect đã chốt lúc Submit.
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);
        await _db.AttemptAnswers.Where(aa => aa.AnswerId == answerId).ExecuteUpdateAsync(s => s.SetProperty(aa => aa.AnswerId, (int?)null), ct);
        await _db.Answers.Where(a => a.AnswerId == answerId).ExecuteDeleteAsync(ct);
        await transaction.CommitAsync(ct);

        return Result.Success();
    }

    /// <summary>Người xem hiện tại (null nếu là Guest) và có phải Admin không — dùng trong projection SQL.</summary>
    private (int? ViewerId, bool IsAdmin) Viewer() =>
        _currentUser.IsAuthenticated ? (_currentUser.UserId, _currentUser.IsAdministrator) : (null, false);

    /// <summary>
    /// Nếu Question đang nằm trong ít nhất 1 Quiz đã Publish (và chưa bị Admin gỡ), thì sau khi sửa nó vẫn
    /// phải đủ điều kiện làm bài như lúc Publish (UC14 A1). Tránh việc Quiz đã public chứa câu không thể làm đúng.
    /// Trả về null nếu hợp lệ.
    /// </summary>
    private async Task<string?> CheckStillPlayableAsync(int questionId, QuestionType typeAfter, int answerCountAfter, int correctCountAfter, CancellationToken ct)
    {
        var usedByPublishedQuiz = await _db.QuizQuestions.AnyAsync(qq =>
            qq.QuestionId == questionId && qq.Quiz!.IsPublished && qq.Quiz.Status == ContentStatus.Active, ct);

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

    private static Error BankNotFound(int bankId) =>
        Error.NotFound(ErrorCodes.BankNotFound, $"Question Bank {bankId} was not found.");

    private static Error QuestionNotFound(int questionId) =>
        Error.NotFound(ErrorCodes.QuestionNotFound, $"Question {questionId} was not found.");

    private static Error AnswerNotFound(int answerId) =>
        Error.NotFound(ErrorCodes.AnswerNotFound, $"Answer {answerId} was not found.");

    private static Error NotBankOwner() => Error.Forbidden(ErrorCodes.NotOwner, "You do not own this Question Bank.");

    private static Error NotQuestionOwner() => Error.Forbidden(ErrorCodes.NotOwner, "You do not own this Question.");

    private static Error NotAnswerOwner() => Error.Forbidden(ErrorCodes.NotOwner, "You do not own this Answer.");
}
