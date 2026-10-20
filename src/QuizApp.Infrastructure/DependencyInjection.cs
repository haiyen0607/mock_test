using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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

        services.AddSingleton(signingKey);
        services.AddScoped<JwtTokenService>();

        return services;
    }
}
