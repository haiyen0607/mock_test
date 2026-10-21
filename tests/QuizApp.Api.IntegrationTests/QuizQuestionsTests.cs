using System.Net;
using QuizApp.Api.IntegrationTests.Infrastructure;
using QuizApp.Application.Dtos;
using static QuizApp.Api.IntegrationTests.Infrastructure.TestData;

namespace QuizApp.Api.IntegrationTests;

/// <summary>UC13/UC17: thêm câu hỏi vào Quiz (tạo mới hoặc tái sử dụng từ bank), sắp xếp, gỡ câu hỏi.</summary>
public sealed class QuizQuestionsTests : ApiTestBase
{
    public QuizQuestionsTests(QuizApiFactory factory) : base(factory) { }

    private sealed record Setup(TestUser Owner, int QuizId, int BankId, int BankQuestionId);

    private async Task<Setup> CreateQuizAndBankQuestionAsync()
    {
        var owner = await Api.RegisterAsync();
        var quiz = await CreateQuizAsync(owner.Client);
        var bank = await CreateBankAsync(owner.Client);
        var question = await AddBankQuestionAsync(owner.Client, bank.QuestionBankId, "Bank MC", "MultipleChoice",
            Answer("X", true), Answer("Y", true), Answer("Z", false));
        return new Setup(owner, quiz.QuizId, bank.QuestionBankId, question.QuestionId);
    }

    [Fact]
    public async Task Reuse_bank_question_then_reuse_again_is_rejected()
    {
        var s = await CreateQuizAndBankQuestionAsync();
        var url = $"/api/quizzes/{s.QuizId}/questions";

        var added = await (await s.Owner.Client.PostJsonAsync(url, new { questionId = s.BankQuestionId }))
            .ShouldBeAsync<QuestionSummaryDto>(HttpStatusCode.Created);
        added.OrderIndex.Should().Be(1);

        var again = await s.Owner.Client.PostJsonAsync(url, new { questionId = s.BankQuestionId });
        await again.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "INVALID_REQUEST");
    }

    [Fact]
    public async Task Add_new_questions_get_increasing_order_and_detail_lists_types()
    {
        var s = await CreateQuizAndBankQuestionAsync();
        var url = $"/api/quizzes/{s.QuizId}/questions";

        (await (await s.Owner.Client.PostJsonAsync(url, new { questionId = s.BankQuestionId }))
            .ShouldBeAsync<QuestionSummaryDto>(HttpStatusCode.Created)).OrderIndex.Should().Be(1);

        var noBank = await (await s.Owner.Client.PostJsonAsync(url, new
        {
            newQuestion = new { content = "Quiz SC", questionType = "SingleChoice", answers = new[] { Answer("Yes", true), Answer("No", false) } }
        })).ShouldBeAsync<QuestionSummaryDto>(HttpStatusCode.Created);
        noBank.OrderIndex.Should().Be(2);

        var text = await (await s.Owner.Client.PostJsonAsync(url, new
        {
            questionBankId = s.BankId,
            newQuestion = new { content = "Explain", questionType = "LongAnswer", answers = Array.Empty<object>() }
        })).ShouldBeAsync<QuestionSummaryDto>(HttpStatusCode.Created);
        text.OrderIndex.Should().Be(3);

        var detail = await s.Owner.Client.GetOkAsync<QuizDetailDto>($"/api/quizzes/{s.QuizId}");
        detail.Questions.Select(q => q.QuestionType).Should().Equal("MultipleChoice", "SingleChoice", "LongAnswer");
    }

    [Fact]
    public async Task Add_question_by_other_user_returns_403_NOT_OWNER()
    {
        var s = await CreateQuizAndBankQuestionAsync();
        var other = await Api.RegisterAsync();

        var response = await other.Client.PostJsonAsync($"/api/quizzes/{s.QuizId}/questions", new { questionId = s.BankQuestionId });

        await response.ShouldBeProblemAsync(HttpStatusCode.Forbidden, "NOT_OWNER");
    }

    [Fact]
    public async Task Add_question_with_both_reuse_and_new_returns_400_INVALID_REQUEST()
    {
        var s = await CreateQuizAndBankQuestionAsync();

        var response = await s.Owner.Client.PostJsonAsync($"/api/quizzes/{s.QuizId}/questions", new
        {
            questionId = s.BankQuestionId,
            newQuestion = new { content = "x", questionType = "LongAnswer", answers = Array.Empty<object>() }
        });

        await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "INVALID_REQUEST");
    }

    [Fact]
    public async Task Reorder_reverses_questions_and_partial_list_is_rejected()
    {
        var s = await CreateQuizAndBankQuestionAsync();
        await s.Owner.Client.PostJsonAsync($"/api/quizzes/{s.QuizId}/questions", new { questionId = s.BankQuestionId });
        await AddNewQuizQuestionAsync(s.Owner.Client, s.QuizId, "Quiz SC", "SingleChoice", Answer("Yes", true), Answer("No", false));
        await AddNewQuizQuestionAsync(s.Owner.Client, s.QuizId, "Explain", "LongAnswer");
        var ids = (await s.Owner.Client.GetOkAsync<QuizDetailDto>($"/api/quizzes/{s.QuizId}")).Questions.Select(q => q.QuestionId).ToList();
        var url = $"/api/quizzes/{s.QuizId}/questions/order";

        var reordered = await (await s.Owner.Client.PutJsonAsync(url, new { questionIds = Enumerable.Reverse(ids).ToArray() }))
            .ShouldBeAsync<List<QuestionSummaryDto>>(HttpStatusCode.OK);
        reordered[0].QuestionType.Should().Be("LongAnswer");
        reordered.Select(q => q.QuestionId).Should().Equal(Enumerable.Reverse(ids));

        var invalid = await s.Owner.Client.PutJsonAsync(url, new { questionIds = new[] { ids[0] } });
        await invalid.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "INVALID_REQUEST");
    }

    [Fact]
    public async Task Publish_quiz_with_questions_succeeds()
    {
        var s = await CreateQuizAndBankQuestionAsync();
        await s.Owner.Client.PostJsonAsync($"/api/quizzes/{s.QuizId}/questions", new { questionId = s.BankQuestionId });

        var response = await s.Owner.Client.PutJsonAsync($"/api/quizzes/{s.QuizId}/publish", new { publish = true });

        (await response.ShouldBeAsync<QuizDetailDto>(HttpStatusCode.OK)).IsPublished.Should().BeTrue();
    }

    [Fact]
    public async Task Question_used_in_quiz_cannot_be_deleted_until_removed_from_quiz()
    {
        var s = await CreateQuizAndBankQuestionAsync();
        await s.Owner.Client.PostJsonAsync($"/api/quizzes/{s.QuizId}/questions", new { questionId = s.BankQuestionId });

        var inUse = await s.Owner.Client.DeleteAsync($"/api/question-banks/questions/{s.BankQuestionId}");
        await inUse.ShouldBeProblemAsync(HttpStatusCode.Conflict, "QUESTION_IN_USE");

        var removed = await s.Owner.Client.DeleteAsync($"/api/quizzes/{s.QuizId}/questions/{s.BankQuestionId}");
        await removed.ShouldHaveStatusAsync(HttpStatusCode.NoContent);
        (await s.Owner.Client.GetOkAsync<QuizDetailDto>($"/api/quizzes/{s.QuizId}")).Questions.Should().BeEmpty();

        var deleted = await s.Owner.Client.DeleteAsync($"/api/question-banks/questions/{s.BankQuestionId}");
        await deleted.ShouldHaveStatusAsync(HttpStatusCode.NoContent);
    }
}
