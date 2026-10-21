using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace QuizApp.Api.IntegrationTests.Infrastructure;

/// <summary>
/// Chạy toàn bộ API trong bộ nhớ (TestServer) với môi trường Development (DbSeeder tạo admin / hoanganh /
/// "Angular Fundamentals Quiz") trên một database LocalDB RIÊNG cho mỗi lần chạy (QuizAppDb_IT_{guid}).
/// Database được tạo bằng EF migrations lúc API khởi động (DatabaseInitializer) và bị DROP khi xong.
/// Không bao giờ đụng tới database QuizAppDb của máy dev.
/// </summary>
public sealed class QuizApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string LocalDbServer = @"(localdb)\MSSQLLocalDB";

    public string DatabaseName { get; } = $"QuizAppDb_IT_{Guid.NewGuid():N}";

    private string ConnectionString =>
        $"Server={LocalDbServer};Database={DatabaseName};Trusted_Connection=True;TrustServerCertificate=True";

    private static string MasterConnectionString =>
        $"Server={LocalDbServer};Database=master;Trusted_Connection=True;TrustServerCertificate=True";

    /// <summary>Thư mục log Serilog (file sink) nằm trong %TEMP%, không ghi vào repo.</summary>
    private static string LogPath => Path.Combine(Path.GetTempPath(), "quizapp-integration-tests", "quizapp-.log");

    private Dictionary<string, string?> Settings => new()
    {
        ["ConnectionStrings:QuizDb"] = ConnectionString,
        // Mọi request của TestServer đến từ cùng 1 "IP" -> nới rate limit để test không bị 429
        ["RateLimiting:AuthPermitLimit"] = "1000",
        ["RateLimiting:TrialPermitLimit"] = "1000",
        // Log gọn: chỉ Warning trở lên; file sink (WriteTo:1) chuyển sang thư mục tạm
        ["Serilog:MinimumLevel:Default"] = "Warning",
        ["Serilog:MinimumLevel:Override:Microsoft.AspNetCore"] = "Warning",
        ["Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore"] = "Error",
        ["Serilog:WriteTo:1:Args:path"] = LogPath,
    };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        // UseSetting: giá trị có hiệu lực ngay cả với cấu hình đọc trong Program.cs trước builder.Build()
        foreach (var (key, value) in Settings)
            builder.UseSetting(key, value);

        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(Settings));
    }

    public async Task InitializeAsync()
    {
        // Khởi động host -> migrations + seed chạy ngay (một lần cho cả collection)
        using var client = CreateClient();
        using var response = await client.GetAsync("/health/live");
        response.EnsureSuccessStatusCode();

        // Chốt an toàn: database của test phải thực sự được tạo (không dùng nhầm QuizAppDb)
        if (!await DatabaseExistsAsync())
            throw new InvalidOperationException(
                $"Integration test database '{DatabaseName}' was not created - configuration override did not apply.");
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        SqlConnection.ClearAllPools();
        await DropDatabaseAsync();
    }

    private async Task<bool> DatabaseExistsAsync()
    {
        await using var connection = new SqlConnection(MasterConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand("SELECT COUNT(*) FROM sys.databases WHERE name = @name", connection);
        command.Parameters.AddWithValue("@name", DatabaseName);
        return (int)(await command.ExecuteScalarAsync() ?? 0) == 1;
    }

    private async Task DropDatabaseAsync()
    {
        await using var connection = new SqlConnection(MasterConnectionString);
        await connection.OpenAsync();
        // DatabaseName chỉ gồm chữ/số/underscore (tự sinh) nên ghép chuỗi an toàn
        var sql = $"""
            IF DB_ID(N'{DatabaseName}') IS NOT NULL
            BEGIN
                ALTER DATABASE [{DatabaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                DROP DATABASE [{DatabaseName}];
            END
            """;
        await using var command = new SqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}

/// <summary>Mọi class test API dùng chung 1 factory (1 database) — các test tự tạo dữ liệu riêng nên độc lập thứ tự.</summary>
[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<QuizApiFactory>
{
    public const string Name = "QuizApi";
}
