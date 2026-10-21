using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using QuizApp.Application.Abstractions;
using QuizApp.Infrastructure.Persistence;
using QuizApp.Infrastructure.Security;

namespace QuizApp.Infrastructure;

/// <summary>Đăng ký các dịch vụ của tầng Infrastructure vào DI container (gọi từ Program.cs của Api).</summary>
public static class DependencyInjection
{
    /// <param name="services">DI container.</param>
    /// <param name="configuration">Cấu hình ứng dụng (ConnectionStrings:QuizDb, Jwt:*).</param>
    /// <param name="signingKey">
    /// Khoá JWT đã tạo sẵn ở Program.cs — truyền vào để JwtBearer (xác thực) và JwtTokenService (ký)
    /// dùng đúng MỘT instance.
    /// </param>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services,
        IConfiguration configuration, JwtSigningKey signingKey)
    {
        // API -> QuizDbContext -> SQL Server
        services.AddDbContext<QuizDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("QuizDb")));
        // Tầng Application chỉ biết IApplicationDbContext; cùng instance (scoped) với QuizDbContext
        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<QuizDbContext>());

        // Health check: kết nối được tới database qua DbContext (tag "ready" -> GET /health/ready)
        services.AddHealthChecks().AddDbContextCheck<QuizDbContext>("database", tags: new[] { "ready" });

        services.AddSingleton(signingKey);
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();

        return services;
    }
}
