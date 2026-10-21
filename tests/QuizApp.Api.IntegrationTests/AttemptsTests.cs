using System.Net;
using QuizApp.Api.IntegrationTests.Infrastructure;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using static QuizApp.Api.IntegrationTests.Infrastructure.TestData;

namespace QuizApp.Api.IntegrationTests;

/// <summary>
/// UC07–UC10: làm bài, nộp bài và chấm điểm end-to-end (Strategy chấm theo loại câu hỏi),
/// xem kết quả, lịch sử; Guest làm thử (đáp án bị ẩn).
/// Quiz chuẩn: MultipleChoice (X, Y đúng) – SingleChoice (Yes đúng) – LongAnswer (chấm tay).
/// </summary>
public sealed class AttemptsTests : ApiTestBase
{
    public AttemptsTests(QuizApiFactory factory) : base(factory) { }

    private static object Choice(int questionId, int answerId) => new { questionId, answerId };

    private static object Text(int questionId, string responseText) => new { questionId, responseText };

    private static async Task<SubmitAttemptResultDto> SubmitAsync(HttpClient client, int attemptId, params object[] answers) =>
        await (await client.PostJsonAsync($"/api/attempts/{attemptId}/submit", new { answers }))
            .ShouldBeAsync<SubmitAttemptResultDto>(HttpStatusCode.OK);

    [Fact]
    public async Task Start_attempt_returns_questions_without_correct_flags_and_expiry()
    {
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);

        var response = await taker.Client.PostAsync($"/api/quizzes/{quiz.QuizId}/attempts", null);

        var attempt = await response.ShouldBeAsync<AttemptContentDto>(HttpStatusCode.Created);
        attempt.Questions.Should().HaveCount(3);
        attempt.ExpiresAt.Should().BeAfter(attempt.StartedAt);
        (await response.Content.ReadAsStringAsync()).Should().NotContain("isCorrect");

        var content = await taker.Client.GetOkAsync<AttemptContentDto>($"/api/attempts/{attempt.AttemptId}/content");
        content.Questions.Should().HaveCount(3);
    }

    [Fact]
    public async Task Start_attempt_anonymous_returns_401()
    {
        var owner = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);

        var response = await Api.Anonymous().PostAsync($"/api/quizzes/{quiz.QuizId}/attempts", null);

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized, "UNAUTHORIZED");
    }

    [Fact]
    public async Task Attempt_of_another_user_is_not_found_and_result_requires_submit()
    {
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var attempt = await StartAttemptAsync(taker.Client, quiz.QuizId);

        await (await owner.Client.GetAsync($"/api/attempts/{attempt.AttemptId}/content"))
            .ShouldBeProblemAsync(HttpStatusCode.NotFound, "ATTEMPT_NOT_FOUND");

        await (await taker.Client.GetAsync($"/api/attempts/{attempt.AttemptId}/result"))
            .ShouldBeProblemAsync(HttpStatusCode.BadRequest, "ATTEMPT_NOT_SUBMITTED");
    }

    [Fact]
    public async Task Submit_with_answer_of_another_question_returns_400_answers_error()
    {
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var attempt = await StartAttemptAsync(taker.Client, quiz.QuizId);

        var response = await taker.Client.PostJsonAsync($"/api/attempts/{attempt.AttemptId}/submit",
            new { answers = new[] { Choice(quiz.MultipleChoiceId, 999999) } });

        var problem = await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "VALIDATION_FAILED");
        problem.Errors.Keys.Should().BeEquivalentTo("answers");
    }

    [Fact]
    public async Task Submit_scores_exact_multiple_choice_wrong_single_choice_and_leaves_text_pending()
    {
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var attempt = await StartAttemptAsync(taker.Client, quiz.QuizId);

        var result = await SubmitAsync(taker.Client, attempt.AttemptId,
            Choice(quiz.MultipleChoiceId, attempt.Option(quiz.MultipleChoiceId, "X")),
            Choice(quiz.MultipleChoiceId, attempt.Option(quiz.MultipleChoiceId, "Y")),
            Choice(quiz.SingleChoiceId, attempt.Option(quiz.SingleChoiceId, "No")),
            Text(quiz.LongAnswerId, "My essay"));

        result.Score.Should().Be(50);
        result.CorrectCount.Should().Be(1);
        result.TotalGradable.Should().Be(2);
        result.PendingManualReview.Should().Be(1);

        // Nộp lại / lấy lại nội dung sau khi đã nộp -> 409
        await (await taker.Client.PostJsonAsync($"/api/attempts/{attempt.AttemptId}/submit", new { answers = Array.Empty<object>() }))
            .ShouldBeProblemAsync(HttpStatusCode.Conflict, "ATTEMPT_SUBMITTED");
        await (await taker.Client.GetAsync($"/api/attempts/{attempt.AttemptId}/content"))
            .ShouldBeProblemAsync(HttpStatusCode.Conflict, "ATTEMPT_SUBMITTED");

        var view = await taker.Client.GetOkAsync<AttemptResultDto>($"/api/attempts/{attempt.AttemptId}/result");
        view.Score.Should().Be(50);
        view.AnswersHidden.Should().BeFalse();
        view.Questions.Should().HaveCount(3);
        view.PendingCount.Should().Be(1);
        view.Questions.Single(q => q.QuestionId == quiz.MultipleChoiceId).IsCorrect.Should().BeTrue();
        view.Questions.Single(q => q.QuestionId == quiz.SingleChoiceId).IsCorrect.Should().BeFalse();
        view.Questions.Single(q => q.QuestionId == quiz.LongAnswerId).IsCorrect.Should().BeNull();
        view.Questions.Single(q => q.QuestionId == quiz.SingleChoiceId).Answers
            .Should().Contain(a => a.Content == "Yes" && a.IsCorrect == true);

        await (await owner.Client.GetAsync($"/api/attempts/{attempt.AttemptId}/result"))
            .ShouldBeProblemAsync(HttpStatusCode.NotFound, "ATTEMPT_NOT_FOUND");

        var history = await taker.Client.GetOkAsync<PagedResult<AttemptHistoryItemDto>>("/api/attempts/mine");
        history.Total.Should().Be(1);
        history.Items[0].PendingCount.Should().Be(1);
    }

    [Fact]
    public async Task Submit_all_correct_scores_100()
    {
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var attempt = await StartAttemptAsync(taker.Client, quiz.QuizId);

        var result = await SubmitAsync(taker.Client, attempt.AttemptId,
            Choice(quiz.MultipleChoiceId, attempt.Option(quiz.MultipleChoiceId, "X")),
            Choice(quiz.MultipleChoiceId, attempt.Option(quiz.MultipleChoiceId, "Y")),
            Choice(quiz.SingleChoiceId, attempt.Option(quiz.SingleChoiceId, "Yes")));

        result.Score.Should().Be(100);
        result.CorrectCount.Should().Be(2);
        result.TotalGradable.Should().Be(2);
    }

    [Fact]
    public async Task Partially_selected_multiple_choice_is_graded_wrong()
    {
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var attempt = await StartAttemptAsync(taker.Client, quiz.QuizId);

        var result = await SubmitAsync(taker.Client, attempt.AttemptId,
            Choice(quiz.MultipleChoiceId, attempt.Option(quiz.MultipleChoiceId, "X")),
            Choice(quiz.SingleChoiceId, attempt.Option(quiz.SingleChoiceId, "Yes")));

        result.Score.Should().Be(50);
        result.CorrectCount.Should().Be(1);

        var view = await taker.Client.GetOkAsync<AttemptResultDto>($"/api/attempts/{attempt.AttemptId}/result");
        view.Questions.Single(q => q.QuestionId == quiz.MultipleChoiceId).IsCorrect.Should().BeFalse();
    }

    [Fact]
    public async Task Multiple_choice_with_a_wrong_extra_option_is_graded_wrong()
    {
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var attempt = await StartAttemptAsync(taker.Client, quiz.QuizId);

        var result = await SubmitAsync(taker.Client, attempt.AttemptId,
            Choice(quiz.MultipleChoiceId, attempt.Option(quiz.MultipleChoiceId, "X")),
            Choice(quiz.MultipleChoiceId, attempt.Option(quiz.MultipleChoiceId, "Y")),
            Choice(quiz.MultipleChoiceId, attempt.Option(quiz.MultipleChoiceId, "Z")),
            Choice(quiz.SingleChoiceId, attempt.Option(quiz.SingleChoiceId, "Yes")));

        result.Score.Should().Be(50);
        result.CorrectCount.Should().Be(1);
    }

    [Fact]
    public async Task Empty_submit_scores_zero()
    {
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var attempt = await StartAttemptAsync(taker.Client, quiz.QuizId);

        var result = await SubmitAsync(taker.Client, attempt.AttemptId);

        result.Score.Should().Be(0);
        result.CorrectCount.Should().Be(0);
    }

    [Fact]
    public async Task Guest_trial_result_hides_correct_answers()
    {
        var owner = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var guestId = Unique("guest");
        var guest = Api.GuestClient(guestId);

        var trial = await (await guest.PostAsync($"/api/quizzes/{quiz.QuizId}/trial", null))
            .ShouldBeAsync<AttemptContentDto>(HttpStatusCode.Created);
        trial.Questions.Should().HaveCount(3);

        var answers = trial.Questions.Where(q => q.Options.Count > 0)
            .Select(q => Choice(q.QuestionId, q.Options[0].AnswerId)).ToArray();
        await SubmitAsync(guest, trial.AttemptId, answers);

        var result = await guest.GetOkAsync<AttemptResultDto>($"/api/attempts/{trial.AttemptId}/result");
        result.AnswersHidden.Should().BeTrue();
        result.Questions.SelectMany(q => q.Answers).Should().OnlyContain(a => a.IsCorrect == null);

        await (await Api.GuestClient("someone-else").GetAsync($"/api/attempts/{trial.AttemptId}/result"))
            .ShouldBeProblemAsync(HttpStatusCode.NotFound, "ATTEMPT_NOT_FOUND");
    }

    [Fact]
    public async Task History_keeps_attempts_of_deleted_quiz()
    {
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);
        var attempt = await StartAttemptAsync(taker.Client, quiz.QuizId);
        await SubmitAsync(taker.Client, attempt.AttemptId);

        await (await owner.Client.DeleteAsync($"/api/quizzes/{quiz.QuizId}")).ShouldHaveStatusAsync(HttpStatusCode.NoContent);

        var history = await taker.Client.GetOkAsync<PagedResult<AttemptHistoryItemDto>>("/api/attempts/mine");
        history.Items.Should().ContainSingle(i => i.AttemptId == attempt.AttemptId).Which.QuizDeleted.Should().BeTrue();
        // Kết quả vẫn xem được sau khi Quiz bị chủ sở hữu xoá
        (await taker.Client.GetOkAsync<AttemptResultDto>($"/api/attempts/{attempt.AttemptId}/result")).Score.Should().Be(0);
    }
}
