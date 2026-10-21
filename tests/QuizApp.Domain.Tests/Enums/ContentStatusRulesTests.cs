using QuizApp.Domain.Enums;

namespace QuizApp.Domain.Tests.Enums;

public class ContentStatusRulesTests
{
    [Theory]
    [InlineData("Active", ContentStatus.Active)]
    [InlineData("removed", ContentStatus.Removed)]
    [InlineData("  REMOVED ", ContentStatus.Removed)]
    public void TryParseModeration_ActiveOrRemoved_ReturnsTrue(string value, ContentStatus expected)
    {
        ContentStatusRules.TryParseModeration(value, out var status).Should().BeTrue();
        status.Should().Be(expected);
    }

    /// <summary>"Deleted" và chuỗi số không phải trạng thái kiểm duyệt hợp lệ.</summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Deleted")]
    [InlineData("1")]
    [InlineData("5")]
    [InlineData("Unknown")]
    public void TryParseModeration_InvalidValue_ReturnsFalse(string? value)
    {
        ContentStatusRules.TryParseModeration(value, out _).Should().BeFalse();
    }
}
