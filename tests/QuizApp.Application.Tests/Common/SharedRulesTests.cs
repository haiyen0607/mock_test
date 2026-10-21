using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Tests.Common;

public class SharedRulesTests
{
    private static AnswerRequest[] Answers(params bool[] isCorrect) =>
        isCorrect.Select((c, i) => new AnswerRequest { Content = $"A{i}", IsCorrect = c }).ToArray();

    // ---------- ValidateAnswers ----------

    /// <summary>Danh sách rỗng luôn hợp lệ (User có thể thêm đáp án sau; đủ đáp án kiểm tra khi Publish).</summary>
    [Theory]
    [InlineData(QuestionType.MultipleChoice)]
    [InlineData(QuestionType.SingleChoice)]
    [InlineData(QuestionType.ShortAnswer)]
    [InlineData(QuestionType.LongAnswer)]
    public void ValidateAnswers_EmptyList_ReturnsNull(QuestionType type)
    {
        SharedRules.ValidateAnswers(type, Array.Empty<AnswerRequest>()).Should().BeNull();
    }

    [Theory]
    [InlineData(QuestionType.FillInTheBlanks)]
    [InlineData(QuestionType.ShortAnswer)]
    [InlineData(QuestionType.LongAnswer)]
    public void ValidateAnswers_TextTypeWithAnswers_ReturnsNotSupported(QuestionType type)
    {
        SharedRules.ValidateAnswers(type, Answers(false))
            .Should().Be($"Question type {type} does not support predefined answers.");
    }

    [Theory]
    [InlineData(QuestionType.SingleChoice)]
    [InlineData(QuestionType.TrueFalse)]
    public void ValidateAnswers_OneSelectionTypeWithTwoCorrect_ReturnsOnlyOneCorrect(QuestionType type)
    {
        SharedRules.ValidateAnswers(type, Answers(true, true))
            .Should().Be($"Question type {type} allows only one correct answer.");
    }

    [Theory]
    [InlineData(QuestionType.MultipleChoice, new[] { true, true, false })]
    [InlineData(QuestionType.SingleChoice, new[] { true, false })]
    [InlineData(QuestionType.SingleChoice, new[] { false, false })] // chưa có đáp án đúng: kiểm tra lúc Publish
    [InlineData(QuestionType.TrueFalse, new[] { false })]
    public void ValidateAnswers_ValidCombination_ReturnsNull(QuestionType type, bool[] correctFlags)
    {
        SharedRules.ValidateAnswers(type, Answers(correctFlags)).Should().BeNull();
    }

    // ---------- SortQuizzes ----------

    private static readonly DateTime Jan = new(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Feb = new(2025, 2, 1, 0, 0, 0, DateTimeKind.Utc);

    private static IQueryable<Quiz> Quizzes() => new[]
    {
        new Quiz { QuizId = 1, Title = "Charlie", CreatedAt = Jan },
        new Quiz { QuizId = 2, Title = "Bravo", CreatedAt = Feb },
        new Quiz { QuizId = 3, Title = "Bravo", CreatedAt = Jan },
        new Quiz { QuizId = 4, Title = "Alpha", CreatedAt = Jan }
    }.AsQueryable();

    [Theory]
    [InlineData("newest")]
    [InlineData("unknown")] // sort lạ -> newest
    public void SortQuizzes_Newest_OrdersByCreatedAtDescThenIdDesc(string sortKey)
    {
        Quizzes().SortQuizzes(sortKey).Select(q => q.QuizId).Should().Equal(2, 4, 3, 1);
    }

    [Fact]
    public void SortQuizzes_Oldest_OrdersByCreatedAtThenId()
    {
        Quizzes().SortQuizzes("oldest").Select(q => q.QuizId).Should().Equal(1, 3, 4, 2);
    }

    [Fact]
    public void SortQuizzes_Title_OrdersByTitleThenId()
    {
        Quizzes().SortQuizzes("title").Select(q => q.QuizId).Should().Equal(4, 2, 3, 1);
    }
}
