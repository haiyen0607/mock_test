// File khởi động của API
// Bật server lên, khai báo những thứ API cần dùng

using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;   // giao diện tài liệu API (thay cho Swagger UI)

// tạo web API - tạo 1 ứng dụng ASP.NET Core
var builder = WebApplication.CreateBuilder(args);

// đăng ký Controller
// Project này có Controller, hãy load chúng
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        // Question types are exchanged as strings ("SingleChoice", "TrueFalse", ...).
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Lỗi bất ngờ (mất kết nối DB, lỗi SQL...) trả về JSON chuẩn RFC 7807 (status 500)
// thay vì response rỗng - đáp ứng các alternative flow "data cannot be retrieved / processed" trong SRS.
// Mọi ProblemDetails đều có extensions["code"] (A2): lỗi validate -> VALIDATION_FAILED,
// lỗi chưa gắn code (401 của JWT, 404 route, 500...) -> mã mặc định theo status (ErrorCodes.ForStatus).
// Controller gắn code cụ thể qua this.ApiProblem(...) — code đó ghi đè mã mặc định ở đây.
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        var problem = context.ProblemDetails;
        if (problem.Extensions.ContainsKey("code")) return;

        problem.Extensions["code"] = problem is HttpValidationProblemDetails
            ? ErrorCodes.ValidationFailed
            : ErrorCodes.ForStatus(problem.Status ?? context.HttpContext.Response.StatusCode);
    };
});

// A1 – Rate limiting theo IP (built-in Microsoft.AspNetCore.RateLimiting):
// - "auth" : login/register, 5 request / phút / IP (chống dò mật khẩu).
// - "trial": POST quizzes/{id}/trial, 10 request / giờ / IP (Guest đổi X-Guest-Id cũng không làm thử vô hạn).
// Bị chặn -> 429 + ProblemDetails code RATE_LIMITED + header Retry-After (giây).
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    static string ClientIp(HttpContext http) => http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    options.AddPolicy("auth", http => RateLimitPartition.GetFixedWindowLimiter(ClientIp(http),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    options.AddPolicy("trial", http => RateLimitPartition.GetFixedWindowLimiter(ClientIp(http),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromHours(1), QueueLimit = 0 }));

    options.OnRejected = async (context, cancellationToken) =>
    {
        var http = context.HttpContext;
        http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            http.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();

        var problemDetails = http.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problemDetails.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails =
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Too Many Requests",
                Detail = "Too many requests. Please try again later.",
                Extensions = { ["code"] = ErrorCodes.RateLimited }
            }
        });
    };
});

// Swashbuckle vẫn SINH file OpenAPI (mô tả các endpoint); giao diện hiển thị là Scalar (xem bên dưới)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    // Đưa các comment /// <summary>UC01 - ...</summary> trong Controller vào tài liệu API
    var xmlFile = Path.Combine(AppContext.BaseDirectory, "QuizApp.Api.xml");
    if (File.Exists(xmlFile))
        options.IncludeXmlComments(xmlFile, includeControllerXmlComments: true);

    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Nhập JWT nhận được từ POST /api/auth/login"
    });
});

// Khoá JWT: đọc + kiểm tra 1 lần lúc khởi động (thiếu / quá ngắn / placeholder -> dừng khởi động).
// Cùng MỘT khoá cho ký (JwtTokenService) và xác thực (JwtBearer) — xem JwtSigningKey.
var signingKey = JwtSigningKey.FromConfiguration(builder.Configuration);

// Tầng Infrastructure: DbContext (SQL Server), JwtTokenService, khoá JWT
builder.Services.AddInfrastructure(builder.Configuration, signingKey);

// Xác thực bằng JWT Bearer (UC01/UC02/UC03) — issuer/audience trong appsettings.json -> Jwt.
var jwtSection = builder.Configuration.GetSection("Jwt");
builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = signingKey.Key
        };

        // UC18 – JWT là stateless nên token cấp TRƯỚC khi bị khoá vẫn còn hạn (tới 480 phút).
        // Mỗi request có token, đọc lại trạng thái tài khoản trong DB: bị khoá / không còn tồn tại -> 401 ngay.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var idClaim = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(idClaim, out var userId))
                {
                    context.Fail("Invalid token.");
                    return;
                }

                var db = context.HttpContext.RequestServices.GetRequiredService<QuizDbContext>();
                var status = await db.Users.AsNoTracking()
                    .Where(u => u.UserId == userId)
                    .Select(u => (AccountStatus?)u.Status)
                    .FirstOrDefaultAsync();

                if (status is null)
                    context.Fail("Account no longer exists.");
                else if (status == AccountStatus.Blocked)
                    context.Fail("This account has been blocked by an administrator.");
            }
        };
    });

builder.Services.AddAuthorization();

// A1 – danh sách origin được phép đọc từ cấu hình Cors:Origins (mảng); Development mặc định http://localhost:4200.
var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularClient", policy => policy
        .WithOrigins(corsOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .WithExposedHeaders("Retry-After"));
});

// Build the application
// API sẵn sàng chạy
var app = builder.Build();

// Bắt mọi exception chưa xử lý -> trả ProblemDetails (đi cùng AddProblemDetails ở trên)
app.UseExceptionHandler();
// Response lỗi không có body (401/403 của JWT, 404 route không tồn tại, 405...) -> ProblemDetails có code
app.UseStatusCodePages();

// Áp dụng EF Migrations; seed dữ liệu mẫu CHỈ ở Development
app.Services.InitializeDatabase(app.Configuration, seedSampleData: app.Environment.IsDevelopment(), app.Logger);

if (app.Environment.IsDevelopment())
{
    // File OpenAPI JSON tại /openapi/v1.json (đường dẫn mặc định Scalar tìm)
    app.MapSwagger("/openapi/{documentName}.json");

    // Giao diện tài liệu + test API tại /scalar
    app.MapScalarApiReference(options =>
        options.WithTitle("Quiz Application API (ANG.P.L001)"));

    // Mở thẳng địa chỉ gốc của API (http://localhost:5080/) -> chuyển tới tài liệu API thay vì 404
    app.MapGet("/", () => Results.Redirect("/scalar")).ExcludeFromDescription();

    // In rõ các địa chỉ cần dùng sau khi API đã lắng nghe (API khác với giao diện web Angular)
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        var apiUrl = app.Urls.FirstOrDefault() ?? "http://localhost:5080";
        var webUrl = corsOrigins.FirstOrDefault() ?? "http://localhost:4200";
        app.Logger.LogInformation(
            // ASCII (không dấu) để hiển thị đúng trên mọi code page của console Windows
            "\n  API (JSON):     {ApiUrl}/api\n  API reference:  {ApiUrl}/scalar\n  Web UI:         {WebUrl}  (run separately: `npm start` in src/quizapp-frontend)",
            apiUrl, apiUrl, webUrl);
    });
}

app.UseCors("AngularClient");

// Rate limiting theo policy gắn trên endpoint ([EnableRateLimiting("auth")] / ("trial"))
app.UseRateLimiter();

// Xác thực trước, phân quyền sau — bắt buộc theo đúng thứ tự middleware của ASP.NET Core
app.UseAuthentication();
app.UseAuthorization();

// Cho phép URL đi vào Controller
app.MapControllers();

app.Run();
