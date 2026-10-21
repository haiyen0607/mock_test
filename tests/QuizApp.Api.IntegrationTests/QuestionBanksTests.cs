using System.Net;
using System.Text.Json.Nodes;
using QuizApp.Api.IntegrationTests.Infrastructure;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using static QuizApp.Api.IntegrationTests.Infrastructure.TestData;

namespace QuizApp.Api.IntegrationTests;

/// <summary>UC15–UC16: Question Bank, câu hỏi và đáp án trong bank, tìm câu hỏi công khai.</summary>
public sealed class QuestionBanksTests : ApiTestBase
{
    public QuestionBanksTests(QuizApiFactory factory) : base(factory) { }

    [Fact]
    public async Task Create_bank_returns_201_public_and_empty()
    {
        var user = await Api.RegisterAsync();

        var response = await user.Client.PostJsonAsync("/api/question-banks", new { name = Unique("Bank"), description = "b", isPublic = true });

        var bank = await response.ShouldBeAsync<QuestionBankDto>(HttpStatusCode.Created);
        bank.IsPublic.Should().BeTrue();
        bank.QuestionCount.Should().Be(0);
    }

    [Fact]
    public async Task Create_bank_invalid_returns_400_Name_error()
    {
        var user = await Api.RegisterAsync();

        var response = await user.Client.PostJsonAsync("/api/question-banks", new { name = "" });

        var problem = await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "VALIDATION_FAILED");
        problem.Errors.Keys.Should().BeEquivalentTo("Name");
    }

    [Fact]
    public async Task Update_bank_by_owner_renames_it()
    {
        var user = await Api.RegisterAsync();
        var bank = await CreateBankAsync(user.Client);
        var name = Unique("Renamed");

        var response = await user.Client.PutJsonAsync($"/api/question-banks/{bank.QuestionBankId}",
            new { name, description = (string?)null, isPublic = true });

        (await response.ShouldBeAsync<QuestionBankDto>(HttpStatusCode.OK)).Name.Should().Be(name);
    }

    [Fact]
    public async Task Update_bank_by_other_user_returns_403_NOT_OWNER()
    {
        var owner = await Api.RegisterAsync();
        var other = await Api.RegisterAsync();
        var bank = await CreateBankAsync(owner.Client);

        var response = await other.Client.PutJsonAsync($"/api/question-banks/{bank.QuestionBankId}", new { name = "x", isPublic = false });

        await response.ShouldBeProblemAsync(HttpStatusCode.Forbidden, "NOT_OWNER");
    }

    [Fact]
    public async Task My_banks_and_public_banks_reflect_ownership()
    {
        var owner = await Api.RegisterAsync();
        var other = await Api.RegisterAsync();
        var bank = await CreateBankAsync(owner.Client);

        var mine = await owner.Client.GetOkAsync<PagedResult<QuestionBankDto>>("/api/question-banks/mine");
        mine.Total.Should().Be(1);
        mine.Items.Should().ContainSingle(b => b.QuestionBankId == bank.QuestionBankId);

        var publicBanks = await other.Client.GetOkAsync<PagedResult<QuestionBankInfoDto>>(
            $"/api/question-banks/public?search={Uri.EscapeDataString(bank.Name)}");
        publicBanks.Items.Should().ContainSingle(b => b.QuestionBankId == bank.QuestionBankId)
            .Which.CanManage.Should().BeFalse();

        var info = await other.Client.GetOkAsync<QuestionBankInfoDto>($"/api/question-banks/{bank.QuestionBankId}");
        info.CanManage.Should().BeFalse();
        info.OwnerUsername.Should().Be(owner.Username);
    }

    [Fact]
    public async Task Private_bank_of_other_user_is_hidden()
    {
        var owner = await Api.RegisterAsync();
        var other = await Api.RegisterAsync();
        var bank = await CreateBankAsync(owner.Client, isPublic: false);

        var response = await other.Client.GetAsync($"/api/question-banks/{bank.QuestionBankId}");

        await response.ShouldBeProblemAsync(HttpStatusCode.NotFound, "BANK_NOT_FOUND");
    }

    [Fact]
    public async Task Add_single_choice_question_returns_201_with_answers()
    {
        var user = await Api.RegisterAsync();
        var bank = await CreateBankAsync(user.Client);

        var question = await AddBankQuestionAsync(user.Client, bank.QuestionBankId, "Bank SC", "SingleChoice",
            Answer("A", true), Answer("B", false));

        question.Answers.Should().HaveCount(2);
        question.QuestionType.Should().Be("SingleChoice");
    }

    [Fact]
    public async Task Add_single_choice_question_with_two_correct_answers_returns_400_INVALID_REQUEST()
    {
        var user = await Api.RegisterAsync();
        var bank = await CreateBankAsync(user.Client);

        var response = await user.Client.PostJsonAsync($"/api/question-banks/{bank.QuestionBankId}/questions",
            new { content = "bad", questionType = "SingleChoice", answers = new[] { Answer("A", true), Answer("B", true) } });

        await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "INVALID_REQUEST");
    }

    [Fact]
    public async Task Add_text_question_with_answers_returns_400_INVALID_REQUEST()
    {
        var user = await Api.RegisterAsync();
        var bank = await CreateBankAsync(user.Client);

        var response = await user.Client.PostJsonAsync($"/api/question-banks/{bank.QuestionBankId}/questions",
            new { content = "bad", questionType = "LongAnswer", answers = new[] { Answer("A", true) } });

        await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "INVALID_REQUEST");
    }

    [Fact]
    public async Task Bank_questions_show_IsCorrect_to_owner_but_only_options_to_others()
    {
        var owner = await Api.RegisterAsync();
        var other = await Api.RegisterAsync();
        var bank = await CreateBankAsync(owner.Client);
        await AddBankQuestionAsync(owner.Client, bank.QuestionBankId, "Bank SC", "SingleChoice", Answer("A", true), Answer("B", false));
        var url = $"/api/question-banks/{bank.QuestionBankId}/questions";

        var ownerView = (await (await owner.Client.GetAsync(url)).ShouldBeJsonAsync(HttpStatusCode.OK)).AsArray();
        ownerView.Should().HaveCount(1);
        ownerView[0]!["answers"]!.AsArray()[0]!.AsObject().ContainsKey("isCorrect").Should().BeTrue();

        var otherView = (await (await other.Client.GetAsync(url)).ShouldBeJsonAsync(HttpStatusCode.OK)).AsArray();
        otherView.Should().HaveCount(1);
        otherView[0]!["options"].Should().BeOfType<JsonArray>();
        otherView[0]!.AsObject().ContainsKey("answers").Should().BeFalse();
        otherView[0]!.ToJsonString().Should().NotContain("isCorrect");
    }

    [Fact]
    public async Task Question_and_answer_edits_follow_type_rules()
    {
        var user = await Api.RegisterAsync();
        var bank = await CreateBankAsync(user.Client);
        var question = await AddBankQuestionAsync(user.Client, bank.QuestionBankId, "Bank SC", "SingleChoice",
            Answer("A", true), Answer("B", false));
        var qid = question.QuestionId;

        var edited = await (await user.Client.PutJsonAsync($"/api/question-banks/questions/{qid}",
            new { content = "Bank SC edited", questionType = "SingleChoice" })).ShouldBeAsync<QuestionDto>(HttpStatusCode.OK);
        edited.Content.Should().Be("Bank SC edited");

        var answer = await (await user.Client.PostJsonAsync($"/api/question-banks/questions/{qid}/answers",
            new { content = "C", isCorrect = false })).ShouldBeAsync<AnswerDto>(HttpStatusCode.Created);
        answer.IsCorrect.Should().BeFalse();

        // SingleChoice chỉ được có 1 đáp án đúng
        var secondCorrect = await user.Client.PostJsonAsync($"/api/question-banks/questions/{qid}/answers",
            new { content = "D", isCorrect = true });
        await secondCorrect.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "INVALID_REQUEST");

        var updated = await (await user.Client.PutJsonAsync($"/api/question-banks/answers/{answer.AnswerId}",
            new { content = "C2", isCorrect = false })).ShouldBeAsync<AnswerDto>(HttpStatusCode.OK);
        updated.Content.Should().Be("C2");

        var deleted = await user.Client.DeleteAsync($"/api/question-banks/answers/{answer.AnswerId}");
        await deleted.ShouldHaveStatusAsync(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Replace_question_full_changes_type_and_answers()
    {
        var owner = await Api.RegisterAsync();
        var other = await Api.RegisterAsync();
        var bank = await CreateBankAsync(owner.Client);
        var question = await AddBankQuestionAsync(owner.Client, bank.QuestionBankId, "Bank SC", "SingleChoice",
            Answer("A", true), Answer("B", false));
        var url = $"/api/question-banks/questions/{question.QuestionId}/full";

        var replaced = await (await owner.Client.PutJsonAsync(url, new
        {
            content = "Bank MC",
            questionType = "MultipleChoice",
            answers = new[] { Answer("X", true), Answer("Y", true), Answer("Z", false) }
        })).ShouldBeAsync<QuestionDto>(HttpStatusCode.OK);
        replaced.QuestionType.Should().Be("MultipleChoice");
        replaced.Answers.Select(a => a.Content).Should().BeEquivalentTo("X", "Y", "Z");

        var notOwner = await other.Client.PutJsonAsync(url, new { content = "x", questionType = "LongAnswer", answers = Array.Empty<object>() });
        await notOwner.ShouldBeProblemAsync(HttpStatusCode.Forbidden, "NOT_OWNER");
    }

    [Fact]
    public async Task Public_questions_search_finds_questions_of_public_banks_without_correct_flags()
    {
        var owner = await Api.RegisterAsync();
        var bank = await CreateBankAsync(owner.Client, name: Unique("SearchBank"));
        await AddBankQuestionAsync(owner.Client, bank.QuestionBankId, "Bank MC", "MultipleChoice",
            Answer("X", true), Answer("Y", true), Answer("Z", false));

        var response = await Api.Anonymous().GetAsync($"/api/question-banks/public-questions?search={Uri.EscapeDataString(bank.Name)}");

        var results = await response.ShouldBeAsync<List<PublicQuestionDto>>(HttpStatusCode.OK);
        results.Should().ContainSingle().Which.Options.Should().HaveCount(3);
        (await response.Content.ReadAsStringAsync()).Should().NotContain("isCorrect");
    }

    [Fact]
    public async Task Delete_bank_returns_204()
    {
        var owner = await Api.RegisterAsync();
        var bank = await CreateBankAsync(owner.Client);

        var response = await owner.Client.DeleteAsync($"/api/question-banks/{bank.QuestionBankId}");

        await response.ShouldHaveStatusAsync(HttpStatusCode.NoContent);
        (await owner.Client.GetOkAsync<PagedResult<QuestionBankDto>>("/api/question-banks/mine")).Total.Should().Be(0);
    }
}
