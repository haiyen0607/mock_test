using QuizApp.Application.Common;

namespace QuizApp.Application.Tests.Common;

public class PageQueryTests
{
    [Theory]
    [InlineData(1, 1)]
    [InlineData(5, 5)]
    [InlineData(0, 1)]
    [InlineData(-3, 1)]
    public void SafePage_ClampsToAtLeastOne(int page, int expected)
    {
        new PageQuery { Page = page }.SafePage.Should().Be(expected);
    }

    [Theory]
    [InlineData(10, 10)]
    [InlineData(50, 50)]
    [InlineData(51, PageQuery.MaxPageSize)]
    [InlineData(0, PageQuery.DefaultPageSize)]
    [InlineData(-1, PageQuery.DefaultPageSize)]
    public void SafePageSize_ClampsToAllowedRange(int pageSize, int expected)
    {
        new PageQuery { PageSize = pageSize }.SafePageSize.Should().Be(expected);
    }

    [Theory]
    [InlineData(null, "newest")]
    [InlineData("", "newest")]
    [InlineData("   ", "newest")]
    [InlineData(" Title ", "title")]
    [InlineData("OLDEST", "oldest")]
    public void SortKey_NormalizesValue(string? sort, string expected)
    {
        new PageQuery { Sort = sort }.SortKey.Should().Be(expected);
    }
}
