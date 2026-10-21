using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Testing;
using QuizApp.Application.Dtos;

namespace QuizApp.Api.IntegrationTests.Infrastructure;

/// <summary>Tài khoản dùng trong test: Token + HttpClient đã gắn Bearer.</summary>
public sealed record TestUser(int UserId, string Username, string Email, string Password, string Token, HttpClient Client);

/// <summary>
/// Bọc HttpClient của <see cref="QuizApiFactory"/>: tạo client ẩn danh / có token / Guest,
/// đăng ký – đăng nhập lấy token, gửi JSON.
/// </summary>
public sealed class ApiClient
{
    public const string SeedAdmin = "admin";
    public const string SeedAdminPassword = "Admin@123";
    public const string SeedUser = "hoanganh";
    public const string SeedUserPassword = "User@123";

    public static readonly JsonSerializerOptions Json = CreateJsonOptions();

    private readonly QuizApiFactory _factory;

    public ApiClient(QuizApiFactory factory) => _factory = factory;

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }

    /// <summary>Client không đăng nhập.</summary>
    public HttpClient Anonymous(bool allowAutoRedirect = true) =>
        _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = allowAutoRedirect });

    /// <summary>Client gửi kèm header Authorization: Bearer {token}.</summary>
    public HttpClient AuthorizedClient(string token)
    {
        var client = Anonymous();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>Client của Guest (làm thử) gửi kèm header X-Guest-Id.</summary>
    public HttpClient GuestClient(string? guestId = null)
    {
        var client = Anonymous();
        client.DefaultRequestHeaders.Add("X-Guest-Id", guestId ?? TestData.Unique("guest"));
        return client;
    }

    public async Task<string> LoginAsync(string usernameOrEmail, string password)
    {
        var response = await Anonymous().PostJsonAsync("/api/auth/login", new { usernameOrEmail, password });
        var auth = await response.ShouldBeAsync<AuthResponseDto>(HttpStatusCode.OK);
        auth.Token.Should().NotBeNullOrWhiteSpace();
        return auth.Token;
    }

    public async Task<TestUser> LoginSeedUserAsync() => await LoginAsTestUserAsync(SeedUser, SeedUserPassword);

    public async Task<TestUser> LoginSeedAdminAsync() => await LoginAsTestUserAsync(SeedAdmin, SeedAdminPassword);

    private async Task<TestUser> LoginAsTestUserAsync(string username, string password)
    {
        var response = await Anonymous().PostJsonAsync("/api/auth/login", new { usernameOrEmail = username, password });
        var auth = await response.ShouldBeAsync<AuthResponseDto>(HttpStatusCode.OK);
        return new TestUser(auth.User.UserId, auth.User.Username, auth.User.Email, password, auth.Token, AuthorizedClient(auth.Token));
    }

    /// <summary>Đăng ký 1 tài khoản mới với username/email duy nhất.</summary>
    public async Task<TestUser> RegisterAsync(string prefix = "user", string password = "Test@1234")
    {
        var username = TestData.Unique(prefix);
        var email = $"{username}@it.test";
        var response = await Anonymous().PostJsonAsync("/api/auth/register", new { username, email, password });
        var auth = await response.ShouldBeAsync<AuthResponseDto>(HttpStatusCode.Created);
        auth.User.Username.Should().Be(username);
        return new TestUser(auth.User.UserId, username, email, password, auth.Token, AuthorizedClient(auth.Token));
    }
}

/// <summary>Helper gửi JSON và kiểm tra response.</summary>
public static class HttpTestExtensions
{
    public static Task<HttpResponseMessage> PostJsonAsync(this HttpClient client, string url, object? body = null) =>
        client.SendJsonAsync(HttpMethod.Post, url, body);

    public static Task<HttpResponseMessage> PutJsonAsync(this HttpClient client, string url, object? body) =>
        client.SendJsonAsync(HttpMethod.Put, url, body);

    public static async Task<HttpResponseMessage> SendJsonAsync(this HttpClient client, HttpMethod method, string url, object? body)
    {
        using var request = new HttpRequestMessage(method, url);
        if (body is string raw)
            request.Content = new StringContent(raw, Encoding.UTF8, "application/json");
        else if (body is not null)
            request.Content = JsonContent.Create(body, body.GetType(), options: ApiClient.Json);
        return await client.SendAsync(request);
    }

    /// <summary>Gửi GET, kiểm tra status 200 và đọc body thành <typeparamref name="T"/>.</summary>
    public static async Task<T> GetOkAsync<T>(this HttpClient client, string url) =>
        await (await client.GetAsync(url)).ShouldBeAsync<T>(HttpStatusCode.OK);

    /// <summary>Kiểm tra status code (kèm body trong thông báo lỗi để dễ debug).</summary>
    public static async Task ShouldHaveStatusAsync(this HttpResponseMessage response, HttpStatusCode expected)
    {
        if (response.StatusCode != expected)
        {
            var body = await response.Content.ReadAsStringAsync();
            response.StatusCode.Should().Be(expected,
                "{0} {1} returned body: {2}", response.RequestMessage?.Method, response.RequestMessage?.RequestUri, body);
        }
    }

    public static async Task<T> ShouldBeAsync<T>(this HttpResponseMessage response, HttpStatusCode expected)
    {
        await response.ShouldHaveStatusAsync(expected);
        var value = await response.Content.ReadFromJsonAsync<T>(ApiClient.Json);
        value.Should().NotBeNull();
        return value!;
    }

    public static async Task<JsonNode> ShouldBeJsonAsync(this HttpResponseMessage response, HttpStatusCode expected)
    {
        await response.ShouldHaveStatusAsync(expected);
        var node = JsonNode.Parse(await response.Content.ReadAsStringAsync());
        node.Should().NotBeNull();
        return node!;
    }

    /// <summary>Response phải là ProblemDetails (RFC 7807) với đúng status và extensions["code"].</summary>
    public static async Task<Problem> ShouldBeProblemAsync(this HttpResponseMessage response, HttpStatusCode expected, string code)
    {
        await response.ShouldHaveStatusAsync(expected);
        // Controller có [Produces("application/json")] nên ProblemDetails có thể mang 1 trong 2 media type
        response.Content.Headers.ContentType?.MediaType.Should().BeOneOf("application/problem+json", "application/json");
        var problem = Problem.Parse(await response.Content.ReadAsStringAsync());
        problem.Status.Should().Be((int)expected);
        problem.Code.Should().Be(code);
        return problem;
    }
}

/// <summary>ProblemDetails đã parse: status, code, detail và errors (field -> messages) nếu là lỗi validate.</summary>
public sealed record Problem(int? Status, string? Code, string? Detail, IReadOnlyDictionary<string, string[]> Errors)
{
    public static Problem Parse(string json)
    {
        var node = JsonNode.Parse(json)!.AsObject();
        var errors = new Dictionary<string, string[]>();
        if (node["errors"] is JsonObject errs)
            foreach (var (key, value) in errs)
                errors[key] = value!.AsArray().Select(m => m!.GetValue<string>()).ToArray();

        return new Problem(node["status"]?.GetValue<int>(), node["code"]?.GetValue<string>(),
            node["detail"]?.GetValue<string>(), errors);
    }
}
