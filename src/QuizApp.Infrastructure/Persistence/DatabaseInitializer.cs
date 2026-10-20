using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace QuizApp.Infrastructure.Persistence;

/// <summary>Khởi tạo database lúc API khởi động: áp dụng migrations và seed dữ liệu mẫu.</summary>
public static class DatabaseInitializer
{
    /// <param name="services">Root service provider của ứng dụng.</param>
    /// <param name="configuration">Đọc Seed:AdminPassword / Seed:UserPassword.</param>
    /// <param name="seedSampleData">true chỉ ở Development.</param>
    /// <param name="logger">Ghi cảnh báo khi thiếu cấu hình seed.</param>
    public static void InitializeDatabase(this IServiceProvider services, IConfiguration configuration,
        bool seedSampleData, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<QuizDbContext>();

        // A1 – áp dụng EF Migrations (thay cho EnsureCreated): tạo DB / cập nhật cấu trúc bảng tự động
        db.Database.Migrate();

        if (!seedSampleData) return;

        // Seed dữ liệu mẫu (admin/user/question bank/quiz) nếu database trống,
        // mật khẩu lấy từ cấu hình Seed:AdminPassword / Seed:UserPassword.
        var adminPassword = configuration["Seed:AdminPassword"];
        var userPassword = configuration["Seed:UserPassword"];
        if (string.IsNullOrWhiteSpace(adminPassword) || string.IsNullOrWhiteSpace(userPassword))
        {
            logger.LogWarning("Seed:AdminPassword / Seed:UserPassword is not configured - skipping sample data seeding.");
            return;
        }

        DbSeeder.Seed(db, adminPassword, userPassword);
    }
}
