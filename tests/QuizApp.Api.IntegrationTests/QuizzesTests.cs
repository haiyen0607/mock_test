using System.Net;
using QuizApp.Api.IntegrationTests.Infrastructure;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;

namespace QuizApp.Api.IntegrationTests;

/// <summary>UC04–UC06, UC11–UC14: duyệt/tìm Quiz công khai, chi tiết Quiz, tạo/sửa/publish/xoá Quiz.</summary>
public sealed class QuizzesTests : ApiTestBase
{
    private const string SeedQuizTitle = "Angular Fundamentals Quiz";

    public QuizzesTests(QuizApiFactory factory) : base(factory) { }

    private async Task<int> SeedQuizIdAsync()
    {
        var page = await Api.Anonymous().GetOkAsync<PagedResult<QuizListItemDto>>(
            $"/api/quizzes?search={Uri.EscapeDataString(SeedQuizTitle)}");
        return page.Items.Single(q => q.Title == SeedQuizTitle).QuizId;
    }

    [Fact]
    public async Task Public_quizzes_contain_seeded_published_quiz()
    {
        var page = await Api.Anonymous().GetOkAsync<PagedResult<QuizListItemDto>>("/api/quizzes?pageSize=50");

        page.Total.Should().BeGreaterThanOrEqualTo(1);
        page.Items.Should().Contain(q => q.Title == SeedQuizTitle && q.IsPublished && q.QuestionCount == 4);
        page.Items.Should().OnlyContain(q => q.IsPublished);
    }

    [Fact]
    public async Task Public_quizzes_search_without_match_returns_empty_page()
    {
        var page = await Api.Anonymous().GetOkAsync<PagedResult<QuizListItemDto>>(
            $"/api/quizzes?search={TestData.Unique("zzzz")}");

        page.Total.Should().Be(0);
        page.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Quiz_detail_for_anonymous_hides_answers()
    {
        var quizId = await SeedQuizIdAsync();

        var detail = await Api.Anonymous().GetOkAsync<QuizDetailDto>($"/api/quizzes/{quizId}");

        detail.Questions.Should().HaveCount(4);
        detail.Questions.Should().OnlyContain(q => q.Answers == null && !q.CanEdit);
    }

    [Fact]
    public async Task Quiz_detail_for_owner_shows_answers_and_can_edit()
    {
        var quizId = await SeedQuizIdAsync();
        var owner = await Api.LoginSeedUserAsync();

        var detail = await owner.Client.GetOkAsync<QuizDetailDto>($"/api/quizzes/{quizId}");

        detail.Questions[0].Answers.Should().HaveCount(3);
        detail.Questions[0].CanEdit.Should().BeTrue();
    }

    [Fact]
    public async Task Quiz_detail_unknown_id_returns_404_QUIZ_NOT_FOUND()
    {
        var response = await Api.Anonymous().GetAsync("/api/quizzes/999999");

        await response.ShouldBeProblemAsync(HttpStatusCode.NotFound, "QUIZ_NOT_FOUND");
    }

    [Fact]
    public async Task Create_quiz_returns_201_active_and_unpublished()
    {
        var user = await Api.RegisterAsync();
        var title = TestData.Unique("Quiz");

        var response = await user.Client.PostJsonAsync("/api/quizzes", new { title, description = "d", duration = 15 });

        var quiz = await response.ShouldBeAsync<QuizDetailDto>(HttpStatusCode.Created);
        quiz.Title.Should().Be(title);
        quiz.Status.Should().Be("Active");
        quiz.IsPublished.Should().BeFalse();
        quiz.OwnerUsername.Should().Be(user.Username);
    }

    [Fact]
    public async Task Create_quiz_invalid_returns_400_with_Title_and_Duration_errors()
    {
        var user = await Api.RegisterAsync();

        var response = await user.Client.PostJsonAsync("/api/quizzes", new { title = "", duration = 0 });

        var problem = await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "VALIDATION_FAILED");
        problem.Errors.Keys.Should().BeEquivalentTo("Duration", "Title");
    }

    [Fact]
    public async Task Create_quiz_anonymous_returns_401()
    {
        var response = await Api.Anonymous().PostJsonAsync("/api/quizzes", new { title = "t", duration = 5 });

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized, "UNAUTHORIZED");
    }

    [Fact]
    public async Task Update_quiz_by_owner_changes_title_and_duration()
    {
        var user = await Api.RegisterAsync();
        var quiz = await TestData.CreateQuizAsync(user.Client);
        var newTitle = TestData.Unique("Renamed");

        var response = await user.Client.PutJsonAsync($"/api/quizzes/{quiz.QuizId}",
            new { title = newTitle, description = (string?)null, duration = 20 });

        var updated = await response.ShouldBeAsync<QuizDetailDto>(HttpStatusCode.OK);
        updated.Title.Should().Be(newTitle);
        updated.Duration.Should().Be(20);
        updated.Description.Should().BeNull();
    }

    [Fact]
    public async Task Update_quiz_by_other_user_returns_403_NOT_OWNER()
    {
        var owner = await Api.RegisterAsync();
        var other = await Api.RegisterAsync();
        var quiz = await TestData.CreateQuizAsync(owner.Client);

        var response = await other.Client.PutJsonAsync($"/api/quizzes/{quiz.QuizId}", new { title = "x", duration = 5 });

        await response.ShouldBeProblemAsync(HttpStatusCode.Forbidden, "NOT_OWNER");
    }

    [Fact]
    public async Task Publish_quiz_without_questions_returns_400_questions_error()
    {
        var user = await Api.RegisterAsync();
        var quiz = await TestData.CreateQuizAsync(user.Client);

        var response = await user.Client.PutJsonAsync($"/api/quizzes/{quiz.QuizId}/publish", new { publish = true });

        var problem = await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "VALIDATION_FAILED");
        problem.Errors.Keys.Should().BeEquivalentTo("questions");
    }

    [Fact]
    public async Task Unpublished_quiz_is_not_listed_publicly_until_published()
    {
        var user = await Api.RegisterAsync();
        var quiz = await TestData.CreateQuizAsync(user.Client);
        await TestData.AddNewQuizQuestionAsync(user.Client, quiz.QuizId, "Q", "SingleChoice",
            TestData.Answer("A", true), TestData.Answer("B", false));
        var searchUrl = $"/api/quizzes?search={Uri.EscapeDataString(quiz.Title)}";

        (await Api.Anonymous().GetOkAsync<PagedResult<QuizListItemDto>>(searchUrl)).Total.Should().Be(0);

        await TestData.PublishAsync(user.Client, quiz.QuizId);

        var page = await Api.Anonymous().GetOkAsync<PagedResult<QuizListItemDto>>(searchUrl);
        page.Items.Should().ContainSingle(q => q.QuizId == quiz.QuizId);
    }

    [Fact]
    public async Task My_quizzes_lists_only_own_quizzes()
    {
        var user = await Api.RegisterAsync();
        var quiz = await TestData.CreateQuizAsync(user.Client);

        var page = await user.Client.GetOkAsync<PagedResult<QuizListItemDto>>("/api/quizzes/mine?pageSize=5");

        page.Total.Should().Be(1);
        page.Items.Should().ContainSingle(q => q.QuizId == quiz.QuizId);
    }

    [Fact]
    public async Task Delete_quiz_by_other_user_returns_403_NOT_OWNER()
    {
        var owner = await Api.RegisterAsync();
        var other = await Api.RegisterAsync();
        var quiz = await TestData.CreateQuizAsync(owner.Client);

        var response = await other.Client.DeleteAsync($"/api/quizzes/{quiz.QuizId}");

        await response.ShouldBeProblemAsync(HttpStatusCode.Forbidden, "NOT_OWNER");
    }

    [Fact]
    public async Task Delete_quiz_returns_204_and_quiz_is_gone()
    {
        var owner = await Api.RegisterAsync();
        var quiz = await TestData.CreateQuizAsync(owner.Client);

        var response = await owner.Client.DeleteAsync($"/api/quizzes/{quiz.QuizId}");
        await response.ShouldHaveStatusAsync(HttpStatusCode.NoContent);

        var detail = await owner.Client.GetAsync($"/api/quizzes/{quiz.QuizId}");
        await detail.ShouldBeProblemAsync(HttpStatusCode.NotFound, "QUIZ_NOT_FOUND");
        (await owner.Client.GetOkAsync<PagedResult<QuizListItemDto>>("/api/quizzes/mine")).Total.Should().Be(0);
    }
}
