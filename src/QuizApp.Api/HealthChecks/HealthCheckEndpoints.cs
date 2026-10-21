using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace QuizApp.Api.HealthChecks;

/// <summary>
/// Endpoint health check cho giám sát / load balancer / Docker:
/// - GET /health/live  : tiến trình API còn sống (không kiểm tra phụ thuộc);
/// - GET /health/ready : sẵn sàng phục vụ (kiểm tra kết nối database).
/// Trả 200 khi Healthy, 503 khi Unhealthy, kèm JSON chi tiết từng check.
/// </summary>
public static class HealthCheckEndpoints
{
    public const string ReadyTag = "ready";

    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = _ => false, // không chạy check nào: chỉ xác nhận tiến trình đang chạy
            ResponseWriter = WriteJsonAsync
        });

        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains(ReadyTag),
            ResponseWriter = WriteJsonAsync
        });

        return app;
    }

    private static Task WriteJsonAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";
        var body = new
        {
            status = report.Status.ToString(),
            totalDurationMs = Math.Round(report.TotalDuration.TotalMilliseconds, 1),
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                durationMs = Math.Round(e.Value.Duration.TotalMilliseconds, 1),
                error = e.Value.Exception?.Message
            })
        };
        return context.Response.WriteAsync(JsonSerializer.Serialize(body, new JsonSerializerOptions { WriteIndented = true }));
    }
}
