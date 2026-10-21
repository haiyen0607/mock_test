using System.Net;
using QuizApp.Api.IntegrationTests.Infrastructure;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using static QuizApp.Api.IntegrationTests.Infrastructure.TestData;

namespace QuizApp.Api.IntegrationTests;

/// <summary>UC18–UC20: Administrator quản lý tài khoản và kiểm duyệt Quiz / Question.</summary>
public sealed class AdminTests : ApiTestBase
{
    public AdminTests(QuizApiFactory factory) : base(factory) { }

    [Fact]
    public async Task Admin_lists_users_and_regular_user_is_forbidden()
    {
        var admin = await Api.LoginSeedAdminAsync();
        var user = await Api.RegisterAsync();

        var page = await admin.Client.GetOkAsync<PagedResult<UserDto>>($"/api/admin/users?pageSize=10&search={user.Username}");
        page.Items.Should().ContainSingle(u => u.UserId == user.UserId);

        var all = await admin.Client.GetOkAsync<PagedResult<UserDto>>("/api/admin/users?pageSize=10");
        all.Total.Should().BeGreaterThanOrEqualTo(3);

        await (await user.Client.GetAsync("/api/admin/users")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "FORBIDDEN");
    }

    [Fact]
    public async Task Blocked_user_token_is_rejected_and_login_is_refused_until_unblocked()
    {
        var admin = await Api.LoginSeedAdminAsync();
        var user = await Api.RegisterAsync();
        var statusUrl = $"/api/admin/users/{user.UserId}/status";

        var blocked = await (await admin.Client.PutJsonAsync(statusUrl, new { status = "Blocked" })).ShouldBeAsync<UserDto>(HttpStatusCode.OK);
        blocked.Status.Should().Be("Blocked");

        // Token cấp trước khi bị khoá không còn dùng được
        await (await user.Client.GetAsync("/api/auth/me")).ShouldBeProblemAsync(HttpStatusCode.Unauthorized, "UNAUTHORIZED");
        await (await Api.Anonymous().PostJsonAsync("/api/auth/login", new { usernameOrEmail = user.Username, password = user.Password }))
            .ShouldBeProblemAsync(HttpStatusCode.Forbidden, "ACCOUNT_BLOCKED");

        var active = await (await admin.Client.PutJsonAsync(statusUrl, new { status = "Active" })).ShouldBeAsync<UserDto>(HttpStatusCode.OK);
        active.Status.Should().Be("Active");

        (await Api.LoginAsync(user.Username, user.Password)).Should().NotBeNullOrWhiteSpace();
        (await user.Client.GetOkAsync<UserDto>("/api/auth/me")).Username.Should().Be(user.Username);
    }

    [Fact]
    public async Task Admin_quizzes_with_unknown_status_filter_returns_400_INVALID_STATUS()
    {
        var admin = await Api.LoginSeedAdminAsync();

        var response = await admin.Client.GetAsync("/api/admin/quizzes?status=Foo");

        await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "INVALID_STATUS");
    }

    [Fact]
    public async Task Removed_quiz_is_hidden_publicly_and_filtered_by_status_until_restored()
    {
        var admin = await Api.LoginSeedAdminAsync();
        var owner = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var title = (await owner.Client.GetOkAsync<QuizDetailDto>($"/api/quizzes/{quiz.QuizId}")).Title;
        var search = Uri.EscapeDataString(title);
        var statusUrl = $"/api/admin/quizzes/{quiz.QuizId}/status";

        (await admin.Client.GetOkAsync<PagedResult<QuizListItemDto>>($"/api/admin/quizzes?search={search}"))
            .Items.Should().ContainSingle(q => q.QuizId == quiz.QuizId && q.Status == "Active");

        var removed = await (await admin.Client.PutJsonAsync(statusUrl, new { status = "Removed" }))
            .ShouldBeAsync<QuizListItemDto>(HttpStatusCode.OK);
        removed.Status.Should().Be("Removed");

        (await admin.Client.GetOkAsync<PagedResult<QuizListItemDto>>($"/api/admin/quizzes?status=Removed&search={search}"))
            .Items.Should().ContainSingle(q => q.QuizId == quiz.QuizId);
        (await admin.Client.GetOkAsync<PagedResult<QuizListItemDto>>($"/api/admin/quizzes?status=Active&search={search}"))
            .Total.Should().Be(0);
        await (await Api.Anonymous().GetAsync($"/api/quizzes/{quiz.QuizId}"))
            .ShouldBeProblemAsync(HttpStatusCode.NotFound, "QUIZ_NOT_FOUND");

        var restored = await (await admin.Client.PutJsonAsync(statusUrl, new { status = "Active" }))
            .ShouldBeAsync<QuizListItemDto>(HttpStatusCode.OK);
        restored.Status.Should().Be("Active");
        (await Api.Anonymous().GetOkAsync<QuizDetailDto>($"/api/quizzes/{quiz.QuizId}")).QuizId.Should().Be(quiz.QuizId);
    }

    [Fact]
    public async Task Removed_question_disappears_from_public_quiz_and_new_attempts()
    {
        var admin = await Api.LoginSeedAdminAsync();
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var content = Unique("Moderate me");
        var question = await AddNewQuizQuestionAsync(owner.Client, quiz.QuizId, content, "LongAnswer");

        var listed = await admin.Client.GetOkAsync<List<AdminQuestionDto>>($"/api/admin/questions?search={Uri.EscapeDataString(content)}");
        listed.Should().ContainSingle(q => q.QuestionId == question.QuestionId).Which.UsedInQuizCount.Should().Be(1);

        var removed = await (await admin.Client.PutJsonAsync($"/api/admin/questions/{question.QuestionId}/status", new { status = "Removed" }))
            .ShouldBeAsync<QuestionDto>(HttpStatusCode.OK);
        removed.Status.Should().Be("Removed");

        (await admin.Client.GetOkAsync<List<AdminQuestionDto>>($"/api/admin/questions?status=Removed&search={Uri.EscapeDataString(content)}"))
            .Should().ContainSingle(q => q.QuestionId == question.QuestionId);

        var publicDetail = await Api.Anonymous().GetOkAsync<QuizDetailDto>($"/api/quizzes/{quiz.QuizId}");
        publicDetail.Questions.Should().HaveCount(3).And.NotContain(q => q.QuestionId == question.QuestionId);

        var ownerDetail = await owner.Client.GetOkAsync<QuizDetailDto>($"/api/quizzes/{quiz.QuizId}");
        ownerDetail.Questions.Should().ContainSingle(q => q.QuestionId == question.QuestionId).Which.Status.Should().Be("Removed");

        var attempt = await StartAttemptAsync(taker.Client, quiz.QuizId);
        attempt.Questions.Should().HaveCount(3);
    }

    [Fact]
    public async Task Moderation_endpoints_are_forbidden_for_regular_users()
    {
        var user = await Api.RegisterAsync();

        await (await user.Client.GetAsync("/api/admin/quizzes")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "FORBIDDEN");
        await (await user.Client.GetAsync("/api/admin/questions")).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "FORBIDDEN");
        await (await Api.Anonymous().GetAsync("/api/admin/users")).ShouldBeProblemAsync(HttpStatusCode.Unauthorized, "UNAUTHORIZED");
    }
}
