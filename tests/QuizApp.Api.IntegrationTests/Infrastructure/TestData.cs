using System.Net;
using QuizApp.Application.Dtos;

namespace QuizApp.Api.IntegrationTests.Infrastructure;

/// <summary>Sinh dữ liệu duy nhất cho từng test (tên user/quiz/bank) và dựng nhanh các kịch bản hay dùng.</summary>
public static class TestData
{
    /// <summary>prefix + 12 ký tự hex ngẫu nhiên (đủ ngắn cho username ≤ 100, đủ duy nhất giữa các test).</summary>
    public static string Unique(string prefix) => $"{prefix}-{Guid.NewGuid():N}"[..(prefix.Length + 13)];

    public static object Answer(string content, bool isCorrect) => new { content, isCorrect };

    public static async Task<QuizDetailDto> CreateQuizAsync(HttpClient owner, string? title = null, int duration = 15)
    {
        var response = await owner.PostJsonAsync("/api/quizzes",
            new { title = title ?? Unique("Quiz"), description = "integration test", duration });
        return await response.ShouldBeAsync<QuizDetailDto>(HttpStatusCode.Created);
    }

    public static async Task<QuestionBankDto> CreateBankAsync(HttpClient owner, bool isPublic = true, string? name = null)
    {
        var response = await owner.PostJsonAsync("/api/question-banks",
            new { name = name ?? Unique("Bank"), description = "integration test", isPublic });
        return await response.ShouldBeAsync<QuestionBankDto>(HttpStatusCode.Created);
    }

    public static async Task<QuestionDto> AddBankQuestionAsync(HttpClient owner, int bankId, string content, string questionType,
        params object[] answers)
    {
        var response = await owner.PostJsonAsync($"/api/question-banks/{bankId}/questions",
            new { content, questionType, answers });
        return await response.ShouldBeAsync<QuestionDto>(HttpStatusCode.Created);
    }

    public static async Task<QuestionSummaryDto> AddNewQuizQuestionAsync(HttpClient owner, int quizId, string content,
        string questionType, params object[] answers)
    {
        var response = await owner.PostJsonAsync($"/api/quizzes/{quizId}/questions",
            new { newQuestion = new { content, questionType, answers } });
        return await response.ShouldBeAsync<QuestionSummaryDto>(HttpStatusCode.Created);
    }

    public static async Task PublishAsync(HttpClient owner, int quizId, bool publish = true)
    {
        var response = await owner.PutJsonAsync($"/api/quizzes/{quizId}/publish", new { publish });
        var quiz = await response.ShouldBeAsync<QuizDetailDto>(HttpStatusCode.OK);
        quiz.IsPublished.Should().Be(publish);
    }

    /// <summary>
    /// Quiz đã publish gồm 3 câu (giống kịch bản regression):
    /// MultipleChoice (X, Y đúng; Z sai) – SingleChoice (Yes đúng; No sai) – LongAnswer (chấm tay).
    /// </summary>
    public static async Task<ScoringQuiz> CreateScoringQuizAsync(TestUser owner)
    {
        var quiz = await CreateQuizAsync(owner.Client);
        var mc = await AddNewQuizQuestionAsync(owner.Client, quiz.QuizId, "Pick X and Y", "MultipleChoice",
            Answer("X", true), Answer("Y", true), Answer("Z", false));
        var sc = await AddNewQuizQuestionAsync(owner.Client, quiz.QuizId, "Pick Yes", "SingleChoice",
            Answer("Yes", true), Answer("No", false));
        var text = await AddNewQuizQuestionAsync(owner.Client, quiz.QuizId, "Explain something", "LongAnswer");
        await PublishAsync(owner.Client, quiz.QuizId);
        return new ScoringQuiz(quiz.QuizId, mc.QuestionId, sc.QuestionId, text.QuestionId);
    }

    public static async Task<AttemptContentDto> StartAttemptAsync(HttpClient client, int quizId)
    {
        var response = await client.PostAsync($"/api/quizzes/{quizId}/attempts", null);
        return await response.ShouldBeAsync<AttemptContentDto>(HttpStatusCode.Created);
    }

    /// <summary>Id của lựa chọn có nội dung <paramref name="content"/> trong câu <paramref name="questionId"/>.</summary>
    public static int Option(this AttemptContentDto attempt, int questionId, string content) =>
        attempt.Questions.Single(q => q.QuestionId == questionId).Options.Single(o => o.Content == content).AnswerId;
}

public sealed record ScoringQuiz(int QuizId, int MultipleChoiceId, int SingleChoiceId, int LongAnswerId);
