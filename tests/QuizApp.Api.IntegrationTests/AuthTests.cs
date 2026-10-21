using System.Net;
using QuizApp.Api.IntegrationTests.Infrastructure;
using QuizApp.Application.Dtos;

namespace QuizApp.Api.IntegrationTests;

/// <summary>UC01–UC03: đăng ký, đăng nhập, thông tin tài khoản hiện tại.</summary>
public sealed class AuthTests : ApiTestBase
{
    public AuthTests(QuizApiFactory factory) : base(factory) { }

    [Fact]
    public async Task Login_with_wrong_password_returns_401_INVALID_CREDENTIALS()
    {
        var response = await Api.Anonymous().PostJsonAsync("/api/auth/login",
            new { usernameOrEmail = ApiClient.SeedUser, password = "nope" });

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized, "INVALID_CREDENTIALS");
    }

    [Theory]
    [InlineData(ApiClient.SeedUser, ApiClient.SeedUserPassword, "User")]
    [InlineData(ApiClient.SeedAdmin, ApiClient.SeedAdminPassword, "Administrator")]
    public async Task Login_seeded_accounts_returns_token_and_role(string username, string password, string role)
    {
        var response = await Api.Anonymous().PostJsonAsync("/api/auth/login", new { usernameOrEmail = username, password });

        var auth = await response.ShouldBeAsync<AuthResponseDto>(HttpStatusCode.OK);
        auth.Token.Should().NotBeNullOrWhiteSpace();
        auth.User.Username.Should().Be(username);
        auth.User.Role.Should().Be(role);
    }

    [Fact]
    public async Task Login_by_email_succeeds()
    {
        var user = await Api.RegisterAsync();

        var token = await Api.LoginAsync(user.Email, user.Password);

        token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Register_with_empty_fields_returns_400_with_field_errors()
    {
        var response = await Api.Anonymous().PostJsonAsync("/api/auth/register", new { username = "", email = "x", password = "1" });

        var problem = await response.ShouldBeProblemAsync(HttpStatusCode.BadRequest, "VALIDATION_FAILED");
        problem.Errors.Keys.Should().BeEquivalentTo("Email", "Password", "Username");
    }

    [Fact]
    public async Task Register_returns_201_with_token_and_user()
    {
        var username = TestData.Unique("reg");

        var response = await Api.Anonymous().PostJsonAsync("/api/auth/register",
            new { username, email = $"{username}@it.test", password = "Other@123" });

        var auth = await response.ShouldBeAsync<AuthResponseDto>(HttpStatusCode.Created);
        auth.Token.Should().NotBeNullOrWhiteSpace();
        auth.User.Username.Should().Be(username);
        auth.User.Role.Should().Be("User");
        auth.User.Status.Should().Be("Active");
    }

    [Fact]
    public async Task Register_duplicate_username_returns_409_USERNAME_TAKEN()
    {
        var existing = await Api.RegisterAsync();

        var response = await Api.Anonymous().PostJsonAsync("/api/auth/register",
            new { username = existing.Username, email = $"{TestData.Unique("o2")}@it.test", password = "Other@123" });

        await response.ShouldBeProblemAsync(HttpStatusCode.Conflict, "USERNAME_TAKEN");
    }

    [Fact]
    public async Task Register_duplicate_email_returns_409_EMAIL_TAKEN()
    {
        var existing = await Api.RegisterAsync();

        var response = await Api.Anonymous().PostJsonAsync("/api/auth/register",
            new { username = TestData.Unique("other"), email = existing.Email, password = "Other@123" });

        await response.ShouldBeProblemAsync(HttpStatusCode.Conflict, "EMAIL_TAKEN");
    }

    [Fact]
    public async Task Me_with_token_returns_current_user()
    {
        var user = await Api.LoginSeedUserAsync();

        var me = await user.Client.GetOkAsync<UserDto>("/api/auth/me");

        me.Username.Should().Be(ApiClient.SeedUser);
    }

    [Fact]
    public async Task Me_anonymous_returns_401_UNAUTHORIZED()
    {
        var response = await Api.Anonymous().GetAsync("/api/auth/me");

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized, "UNAUTHORIZED");
    }

    [Fact]
    public async Task Me_with_malformed_token_returns_401_UNAUTHORIZED()
    {
        var response = await Api.AuthorizedClient("abc.def.ghi").GetAsync("/api/auth/me");

        await response.ShouldBeProblemAsync(HttpStatusCode.Unauthorized, "UNAUTHORIZED");
    }
}
