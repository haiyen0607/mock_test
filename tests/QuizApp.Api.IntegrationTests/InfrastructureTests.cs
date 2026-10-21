using System.Net;
using QuizApp.Api.IntegrationTests.Infrastructure;

namespace QuizApp.Api.IntegrationTests;

/// <summary>Health check, route không tồn tại, chuyển hướng trang gốc tới tài liệu API.</summary>
public sealed class InfrastructureTests : ApiTestBase
{
    public InfrastructureTests(QuizApiFactory factory) : base(factory) { }

    [Fact]
    public async Task Health_live_returns_200_Healthy()
    {
        var body = await (await Api.Anonymous().GetAsync("/health/live")).ShouldBeJsonAsync(HttpStatusCode.OK);

        body["status"]!.GetValue<string>().Should().Be("Healthy");
    }

    [Fact]
    public async Task Health_ready_returns_200_with_healthy_database_check()
    {
        var body = await (await Api.Anonymous().GetAsync("/health/ready")).ShouldBeJsonAsync(HttpStatusCode.OK);

        body["status"]!.GetValue<string>().Should().Be("Healthy");
        body["checks"]!.AsArray().Should().ContainSingle(c =>
            c!["name"]!.GetValue<string>() == "database" && c["status"]!.GetValue<string>() == "Healthy");
    }

    [Theory]
    [InlineData("/api/does-not-exist")]
    [InlineData("/api/quizzes/not-a-number")]
    public async Task Unknown_route_returns_404_NOT_FOUND_problem(string url)
    {
        var response = await Api.Anonymous().GetAsync(url);

        await response.ShouldBeProblemAsync(HttpStatusCode.NotFound, "NOT_FOUND");
    }

    [Fact]
    public async Task Root_redirects_to_scalar_in_development()
    {
        var response = await Api.Anonymous(allowAutoRedirect: false).GetAsync("/");

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        response.Headers.Location!.OriginalString.Should().Be("/scalar");
    }
}
