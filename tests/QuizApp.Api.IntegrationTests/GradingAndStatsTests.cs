using System.Net;
using QuizApp.Api.IntegrationTests.Infrastructure;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using static QuizApp.Api.IntegrationTests.Infrastructure.TestData;

namespace QuizApp.Api.IntegrationTests;

/// <summary>A5: chủ Quiz chấm câu tự luận (cập nhật lại điểm) và xem thống kê Quiz.</summary>
public sealed class GradingAndStatsTests : ApiTestBase
{
    public GradingAndStatsTests(QuizApiFactory factory) : base(factory) { }

    [Fact]
    public async Task Owner_grades_pending_text_answer_and_stats_reflect_it()
    {
        var owner = await Api.RegisterAsync();
        var taker = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);

        // Lượt 1: MC đúng, SC sai, tự luận chờ chấm -> 50 điểm
        var attempt = await StartAttemptAsync(taker.Client, quiz.QuizId);
        var submitted = await (await taker.Client.PostJsonAsync($"/api/attempts/{attempt.AttemptId}/submit", new
        {
            answers = new object[]
            {
                new { questionId = quiz.MultipleChoiceId, answerId = attempt.Option(quiz.MultipleChoiceId, "X") },
                new { questionId = quiz.MultipleChoiceId, answerId = attempt.Option(quiz.MultipleChoiceId, "Y") },
                new { questionId = quiz.SingleChoiceId, answerId = attempt.Option(quiz.SingleChoiceId, "No") },
                new { questionId = quiz.LongAnswerId, responseText = "My essay" }
            }
        })).ShouldBeAsync<SubmitAttemptResultDto>(HttpStatusCode.OK);
        submitted.Score.Should().Be(50);

        // Lượt 2: nộp trắng -> 0 điểm
        var empty = await StartAttemptAsync(taker.Client, quiz.QuizId);
        await (await taker.Client.PostJsonAsync($"/api/attempts/{empty.AttemptId}/submit", new { answers = Array.Empty<object>() }))
            .ShouldHaveStatusAsync(HttpStatusCode.OK);

        var gradingUrl = $"/api/quizzes/{quiz.QuizId}/grading";
        var grading = await owner.Client.GetOkAsync<PagedResult<GradingItemDto>>(gradingUrl);
        grading.Total.Should().Be(1);
        var item = grading.Items.Single();
        item.ResponseText.Should().Be("My essay");
        item.Username.Should().Be(taker.Username);

        await (await taker.Client.GetAsync(gradingUrl)).ShouldBeProblemAsync(HttpStatusCode.Forbidden, "NOT_OWNER");

        var graded = await (await owner.Client.PutJsonAsync($"/api/attempt-answers/{item.AttemptAnswerId}/grade", new { isCorrect = true }))
            .ShouldBeAsync<GradeResultDto>(HttpStatusCode.OK);
        graded.Score.Should().Be(67);
        graded.PendingCount.Should().Be(0);
        graded.CorrectCount.Should().Be(2);
        graded.MaxScore.Should().Be(3);

        await (await taker.Client.PutJsonAsync($"/api/attempt-answers/{item.AttemptAnswerId}/grade", new { isCorrect = false }))
            .ShouldBeProblemAsync(HttpStatusCode.Forbidden, "NOT_OWNER");

        (await owner.Client.GetOkAsync<PagedResult<GradingItemDto>>(gradingUrl)).Total.Should().Be(0);

        var stats = await owner.Client.GetOkAsync<QuizStatsDto>($"/api/quizzes/{quiz.QuizId}/stats");
        stats.AttemptCount.Should().Be(2);
        stats.UniqueUsers.Should().Be(1);
        stats.AverageScorePercent.Should().Be(33.5);
        stats.PendingGradingCount.Should().Be(0);
        stats.Questions.Should().HaveCount(3);

        await (await taker.Client.GetAsync($"/api/quizzes/{quiz.QuizId}/stats"))
            .ShouldBeProblemAsync(HttpStatusCode.Forbidden, "NOT_OWNER");

        // Người làm bài thấy điểm mới
        var result = await taker.Client.GetOkAsync<AttemptResultDto>($"/api/attempts/{attempt.AttemptId}/result");
        result.Score.Should().Be(67);
        result.PendingCount.Should().Be(0);
    }

    [Fact]
    public async Task Stats_of_quiz_without_attempts_are_zero()
    {
        var owner = await Api.RegisterAsync();
        var quiz = await CreateScoringQuizAsync(owner);

        var stats = await owner.Client.GetOkAsync<QuizStatsDto>($"/api/quizzes/{quiz.QuizId}/stats");

        stats.AttemptCount.Should().Be(0);
        stats.UniqueUsers.Should().Be(0);
        stats.PendingGradingCount.Should().Be(0);
    }
}
