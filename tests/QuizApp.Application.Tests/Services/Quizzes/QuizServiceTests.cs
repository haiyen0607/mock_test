using Microsoft.EntityFrameworkCore;
using QuizApp.Application.Abstractions;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using QuizApp.Application.Services.Quizzes;
using QuizApp.Application.Tests.TestSupport;
using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Tests.Services.Quizzes;

/// <summary>
/// QuizService trên EF Core InMemory. Bỏ qua nhánh xoá thành công (dùng transaction + ExecuteDelete,
/// InMemory không hỗ trợ) — đã có integration test với SQL Server.
/// </summary>
public class QuizServiceTests
{
    private readonly TestDatabase _database = new();
    private readonly User _owner;
    private readonly User _otherUser;

    public QuizServiceTests()
    {
        _owner = _database.SeedUser("owner");
        _otherUser = _database.SeedUser("stranger");
    }

    private QuizService CreateSut(int? currentUserId, bool isAdministrator = false) =>
        new(_database.CreateContext(), CurrentUserMock.For(currentUserId, isAdministrator).Object);

    private QuizService CreateSut(ICurrentUser currentUser) => new(_database.CreateContext(), currentUser);

    private Quiz SeedQuiz(string title = "Quiz", bool isPublished = false, ContentStatus status = ContentStatus.Active,
        DateTime? createdAt = null) =>
        _database.Seed(new Quiz
        {
            OwnerId = _owner.UserId,
            Title = title,
            Duration = 10,
            IsPublished = isPublished,
            Status = status,
            CreatedAt = createdAt ?? new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });

    /// <summary>Thêm 1 câu hỏi (kèm đáp án) vào Quiz. answers: danh sách IsCorrect của từng đáp án.</summary>
    private Question SeedQuestion(Quiz quiz, QuestionType type, bool[] answers, int orderIndex = 1,
        ContentStatus status = ContentStatus.Active)
    {
        using var db = _database.CreateContext();
        var bank = db.QuestionBanks.FirstOrDefault(b => b.OwnerId == _owner.UserId)
                   ?? db.QuestionBanks.Add(new QuestionBank { OwnerId = _owner.UserId, Name = "Bank" }).Entity;

        var question = new Question { QuestionBank = bank, Content = "Q", QuestionType = type, Status = status };
        foreach (var isCorrect in answers)
            question.Answers.Add(new Answer { Content = "A", IsCorrect = isCorrect });

        db.Questions.Add(question);
        db.QuizQuestions.Add(new QuizQuestion { QuizId = quiz.QuizId, Question = question, OrderIndex = orderIndex });
        db.SaveChanges();
        return question;
    }

    private async Task<Quiz> ReloadQuizAsync(int quizId)
    {
        await using var db = _database.CreateContext();
        return await db.Quizzes.SingleAsync(q => q.QuizId == quizId);
    }

    // ---------- CreateQuizAsync ----------

    [Fact]
    public async Task CreateQuizAsync_ValidRequest_CreatesPrivateQuizOwnedByCurrentUser()
    {
        var request = new QuizRequest { Title = "  Toán lớp 5  ", Description = "   ", Duration = 15 };

        var result = await CreateSut(_owner.UserId).CreateQuizAsync(request);

        result.IsSuccess.Should().BeTrue();
        result.Value.Title.Should().Be("Toán lớp 5");
        result.Value.Description.Should().BeNull();
        result.Value.Duration.Should().Be(15);
        result.Value.IsPublished.Should().BeFalse();
        result.Value.Status.Should().Be(nameof(ContentStatus.Active));
        result.Value.OwnerUsername.Should().Be("owner");
        result.Value.Questions.Should().BeEmpty();

        var saved = await ReloadQuizAsync(result.Value.QuizId);
        saved.OwnerId.Should().Be(_owner.UserId);
        saved.IsPublished.Should().BeFalse();
    }

    [Fact]
    public async Task CreateQuizAsync_Guest_ThrowsInvalidOperationException()
    {
        var act = () => CreateSut(CurrentUserMock.Guest().Object).CreateQuizAsync(new QuizRequest { Title = "T", Duration = 5 });

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    // ---------- UpdateQuizAsync ----------

    [Fact]
    public async Task UpdateQuizAsync_Owner_UpdatesBasicInfo()
    {
        var quiz = SeedQuiz("Old");

        var result = await CreateSut(_owner.UserId)
            .UpdateQuizAsync(quiz.QuizId, new QuizRequest { Title = " New ", Description = " Desc ", Duration = 30 });

        result.IsSuccess.Should().BeTrue();
        result.Value.Title.Should().Be("New");
        result.Value.Description.Should().Be("Desc");
        result.Value.Duration.Should().Be(30);

        var saved = await ReloadQuizAsync(quiz.QuizId);
        saved.Title.Should().Be("New");
        saved.Duration.Should().Be(30);
    }

    [Fact]
    public async Task UpdateQuizAsync_Administrator_CanUpdateQuizOfOtherUser()
    {
        var quiz = SeedQuiz("Old");

        var result = await CreateSut(_otherUser.UserId, isAdministrator: true)
            .UpdateQuizAsync(quiz.QuizId, new QuizRequest { Title = "By admin", Duration = 5 });

        result.IsSuccess.Should().BeTrue();
        (await ReloadQuizAsync(quiz.QuizId)).Title.Should().Be("By admin");
    }

    [Fact]
    public async Task UpdateQuizAsync_NotOwner_ReturnsForbiddenNotOwnerAndKeepsData()
    {
        var quiz = SeedQuiz("Old");

        var result = await CreateSut(_otherUser.UserId)
            .UpdateQuizAsync(quiz.QuizId, new QuizRequest { Title = "Hacked", Duration = 5 });

        result.IsSuccess.Should().BeFalse();
        result.Error!.Type.Should().Be(ErrorType.Forbidden);
        result.Error.Code.Should().Be(ErrorCodes.NotOwner);
        (await ReloadQuizAsync(quiz.QuizId)).Title.Should().Be("Old");
    }

    [Fact]
    public async Task UpdateQuizAsync_UnknownQuiz_ReturnsNotFound()
    {
        var result = await CreateSut(_owner.UserId).UpdateQuizAsync(999, new QuizRequest { Title = "T", Duration = 5 });

        result.Error!.Type.Should().Be(ErrorType.NotFound);
        result.Error.Code.Should().Be(ErrorCodes.QuizNotFound);
    }

    [Fact]
    public async Task UpdateQuizAsync_DeletedQuiz_ReturnsNotFound()
    {
        var quiz = SeedQuiz(status: ContentStatus.Deleted);

        var result = await CreateSut(_owner.UserId).UpdateQuizAsync(quiz.QuizId, new QuizRequest { Title = "T", Duration = 5 });

        result.Error!.Code.Should().Be(ErrorCodes.QuizNotFound);
    }

    // ---------- DeleteQuizAsync (chỉ các nhánh trả lỗi trước khi mở transaction) ----------

    [Fact]
    public async Task DeleteQuizAsync_NotOwner_ReturnsForbiddenNotOwner()
    {
        var quiz = SeedQuiz();

        var result = await CreateSut(_otherUser.UserId).DeleteQuizAsync(quiz.QuizId);

        result.Error!.Type.Should().Be(ErrorType.Forbidden);
        result.Error.Code.Should().Be(ErrorCodes.NotOwner);
        (await ReloadQuizAsync(quiz.QuizId)).Status.Should().Be(ContentStatus.Active);
    }

    [Fact]
    public async Task DeleteQuizAsync_UnknownQuiz_ReturnsNotFound()
    {
        var result = await CreateSut(_owner.UserId).DeleteQuizAsync(999);

        result.Error!.Code.Should().Be(ErrorCodes.QuizNotFound);
    }

    // ---------- SetPublishAsync ----------

    [Fact]
    public async Task SetPublishAsync_QuizWithoutQuestions_ReturnsFieldErrorOnQuestions()
    {
        var quiz = SeedQuiz();

        var result = await CreateSut(_owner.UserId).SetPublishAsync(quiz.QuizId, new PublishQuizRequest { Publish = true });

        result.IsSuccess.Should().BeFalse();
        result.Error!.Type.Should().Be(ErrorType.Validation);
        result.Error.Code.Should().Be(ErrorCodes.ValidationFailed);
        result.Error.FieldErrors.Should().ContainKey("questions")
            .WhoseValue.Should().Equal("A quiz must have at least one active question before it can be published.");
        (await ReloadQuizAsync(quiz.QuizId)).IsPublished.Should().BeFalse();
    }

    [Fact]
    public async Task SetPublishAsync_OnlyRemovedQuestions_ReturnsNoActiveQuestionError()
    {
        var quiz = SeedQuiz();
        SeedQuestion(quiz, QuestionType.SingleChoice, new[] { true, false }, status: ContentStatus.Removed);

        var result = await CreateSut(_owner.UserId).SetPublishAsync(quiz.QuizId, new PublishQuizRequest { Publish = true });

        result.Error!.FieldErrors!["questions"].Should()
            .Equal("A quiz must have at least one active question before it can be published.");
    }

    [Fact]
    public async Task SetPublishAsync_IncompleteQuestions_ListsEachInvalidQuestion()
    {
        var quiz = SeedQuiz();
        SeedQuestion(quiz, QuestionType.SingleChoice, new[] { true, false }, orderIndex: 1); // câu hợp lệ: không báo lỗi
        var oneAnswer = SeedQuestion(quiz, QuestionType.MultipleChoice, new[] { true }, orderIndex: 2);
        var twoCorrect = SeedQuestion(quiz, QuestionType.TrueFalse, new[] { true, true }, orderIndex: 3);

        var result = await CreateSut(_owner.UserId).SetPublishAsync(quiz.QuizId, new PublishQuizRequest { Publish = true });

        result.Error!.Code.Should().Be(ErrorCodes.ValidationFailed);
        result.Error.FieldErrors!["questions"].Should().Equal(
            $"Question 2 (id {oneAnswer.QuestionId}): needs at least 2 answers.",
            $"Question 3 (id {twoCorrect.QuestionId}): must have exactly 1 correct answer (type TrueFalse).");
    }

    [Fact]
    public async Task SetPublishAsync_ValidQuiz_PublishesQuiz()
    {
        var quiz = SeedQuiz();
        SeedQuestion(quiz, QuestionType.SingleChoice, new[] { true, false });
        SeedQuestion(quiz, QuestionType.ShortAnswer, Array.Empty<bool>(), orderIndex: 2);
        // Câu bị Admin gỡ không chặn việc publish
        SeedQuestion(quiz, QuestionType.MultipleChoice, Array.Empty<bool>(), orderIndex: 3, status: ContentStatus.Removed);

        var result = await CreateSut(_owner.UserId).SetPublishAsync(quiz.QuizId, new PublishQuizRequest { Publish = true });

        result.IsSuccess.Should().BeTrue();
        result.Value.IsPublished.Should().BeTrue();
        (await ReloadQuizAsync(quiz.QuizId)).IsPublished.Should().BeTrue();
    }

    [Fact]
    public async Task SetPublishAsync_Unpublish_SkipsContentValidation()
    {
        var quiz = SeedQuiz(isPublished: true); // không có câu hỏi nhưng vẫn unpublish được

        var result = await CreateSut(_owner.UserId).SetPublishAsync(quiz.QuizId, new PublishQuizRequest { Publish = false });

        result.IsSuccess.Should().BeTrue();
        result.Value.IsPublished.Should().BeFalse();
        (await ReloadQuizAsync(quiz.QuizId)).IsPublished.Should().BeFalse();
    }

    [Fact]
    public async Task SetPublishAsync_NotOwner_ReturnsForbiddenNotOwner()
    {
        var quiz = SeedQuiz();
        SeedQuestion(quiz, QuestionType.SingleChoice, new[] { true, false });

        var result = await CreateSut(_otherUser.UserId).SetPublishAsync(quiz.QuizId, new PublishQuizRequest { Publish = true });

        result.Error!.Type.Should().Be(ErrorType.Forbidden);
        result.Error.Code.Should().Be(ErrorCodes.NotOwner);
        (await ReloadQuizAsync(quiz.QuizId)).IsPublished.Should().BeFalse();
    }

    // ---------- GetQuizAsync ----------

    [Fact]
    public async Task GetQuizAsync_PrivateQuizViewedByOtherUser_ReturnsNotFound()
    {
        var quiz = SeedQuiz(isPublished: false);

        var result = await CreateSut(_otherUser.UserId).GetQuizAsync(quiz.QuizId);

        result.Error!.Type.Should().Be(ErrorType.NotFound);
        result.Error.Code.Should().Be(ErrorCodes.QuizNotFound);
    }

    [Fact]
    public async Task GetQuizAsync_PublishedQuizViewedByGuest_HidesRemovedQuestionsAndAnswers()
    {
        var quiz = SeedQuiz(isPublished: true);
        var active = SeedQuestion(quiz, QuestionType.SingleChoice, new[] { true, false }, orderIndex: 1);
        SeedQuestion(quiz, QuestionType.SingleChoice, new[] { true, false }, orderIndex: 2, status: ContentStatus.Removed);

        var result = await CreateSut(CurrentUserMock.Guest().Object).GetQuizAsync(quiz.QuizId);

        result.IsSuccess.Should().BeTrue();
        result.Value.OwnerUsername.Should().Be("owner");
        var question = result.Value.Questions.Should().ContainSingle().Subject;
        question.QuestionId.Should().Be(active.QuestionId);
        question.Answers.Should().BeNull();
        question.CanEdit.Should().BeFalse();
    }

    [Fact]
    public async Task GetQuizAsync_Owner_SeesAllQuestionsWithAnswers()
    {
        var quiz = SeedQuiz(isPublished: false);
        SeedQuestion(quiz, QuestionType.SingleChoice, new[] { true, false }, orderIndex: 1);
        SeedQuestion(quiz, QuestionType.SingleChoice, new[] { true, false }, orderIndex: 2, status: ContentStatus.Removed);

        var result = await CreateSut(_owner.UserId).GetQuizAsync(quiz.QuizId);

        result.IsSuccess.Should().BeTrue();
        result.Value.Questions.Should().HaveCount(2);
        result.Value.Questions.Should().OnlyContain(q => q.Answers != null && q.Answers.Count == 2);
        result.Value.Questions[0].CanEdit.Should().BeTrue();
        result.Value.Questions[1].Status.Should().Be(nameof(ContentStatus.Removed));
    }

    // ---------- GetPublicQuizzesAsync ----------

    [Fact]
    public async Task GetPublicQuizzesAsync_ReturnsOnlyPublishedActiveQuizzesWithActiveQuestions()
    {
        var visible = SeedQuiz("Visible", isPublished: true);
        SeedQuestion(visible, QuestionType.SingleChoice, new[] { true, false });
        SeedQuiz("Draft", isPublished: false);
        SeedQuiz("Empty", isPublished: true); // không có câu hỏi -> không làm được
        var removedQuiz = SeedQuiz("Removed by admin", isPublished: true, status: ContentStatus.Removed);
        SeedQuestion(removedQuiz, QuestionType.SingleChoice, new[] { true, false });
        var allRemoved = SeedQuiz("All questions removed", isPublished: true);
        SeedQuestion(allRemoved, QuestionType.SingleChoice, new[] { true, false }, status: ContentStatus.Removed);

        var result = await CreateSut(CurrentUserMock.Guest().Object).GetPublicQuizzesAsync(null, new PageQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value.Total.Should().Be(1);
        var item = result.Value.Items.Should().ContainSingle().Subject;
        item.QuizId.Should().Be(visible.QuizId);
        item.QuestionCount.Should().Be(1);
        item.OwnerUsername.Should().Be("owner");
    }

    [Fact]
    public async Task GetPublicQuizzesAsync_WithSearchAndTitleSort_FiltersAndOrders()
    {
        foreach (var title in new[] { "Math B", "History", "Math A" })
            SeedQuestion(SeedQuiz(title, isPublished: true), QuestionType.SingleChoice, new[] { true, false });

        var result = await CreateSut(CurrentUserMock.Guest().Object)
            .GetPublicQuizzesAsync("  Math ", new PageQuery { Sort = "title" });

        result.Value.Items.Select(i => i.Title).Should().Equal("Math A", "Math B");
        result.Value.Total.Should().Be(2);
    }

    // ---------- GetMyQuizzesAsync ----------

    [Fact]
    public async Task GetMyQuizzesAsync_ReturnsOwnNonDeletedQuizzesNewestFirst()
    {
        SeedQuiz("Older", createdAt: new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        SeedQuiz("Newer", createdAt: new DateTime(2025, 2, 1, 0, 0, 0, DateTimeKind.Utc));
        SeedQuiz("Deleted", status: ContentStatus.Deleted);

        var result = await CreateSut(_owner.UserId).GetMyQuizzesAsync(new PageQuery());

        result.Value.Items.Select(i => i.Title).Should().Equal("Newer", "Older");

        var strangerResult = await CreateSut(_otherUser.UserId).GetMyQuizzesAsync(new PageQuery());
        strangerResult.Value.Items.Should().BeEmpty();
    }
}
