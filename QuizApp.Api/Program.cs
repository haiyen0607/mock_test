// File khởi động của API
// Bật server lên, khai báo những thứ API cần dùng

using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QuizApp.Api.Data;
using QuizApp.Api.Security;
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
// thay vì response rỗng - đáp ứng các alternative flow "data cannot be retrieved / processed" trong SRS
builder.Services.AddProblemDetails();

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

// đăng ký DbContext với SQL Server
// nó tạo liên kết API -> QuizDbContext -> SQL Server
builder.Services.AddDbContext<QuizDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("QuizDb")));

// Xác thực bằng JWT Bearer (UC01/UC02/UC03) — cấu hình khoá/issuer/audience trong appsettings.json -> Jwt
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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Key"]!))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddScoped<JwtTokenService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularClient", policy => policy
        .WithOrigins("http://localhost:4200")
        .AllowAnyHeader()
        .AllowAnyMethod());
});

// Build the application
// API sẵn sàng chạy
var app = builder.Build();

// Bắt mọi exception chưa xử lý -> trả ProblemDetails (đi cùng AddProblemDetails ở trên)
app.UseExceptionHandler();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<QuizDbContext>();

    // Tạo database và toàn bộ bảng nếu chưa tồn tại
    db.Database.EnsureCreated();
    // Seed dữ liệu mẫu (admin/user/question bank/quiz) nếu database trống
    DbSeeder.Seed(db);
}

if (app.Environment.IsDevelopment())
{
    // File OpenAPI JSON tại /openapi/v1.json (đường dẫn mặc định Scalar tìm)
    app.MapSwagger("/openapi/{documentName}.json");

    // Giao diện tài liệu + test API tại /scalar
    app.MapScalarApiReference(options =>
        options.WithTitle("Quiz Application API (ANG.P.L001)"));
}

app.UseCors("AngularClient");

// Xác thực trước, phân quyền sau — bắt buộc theo đúng thứ tự middleware của ASP.NET Core
app.UseAuthentication();
app.UseAuthorization();

// Cho phép URL đi vào Controller
app.MapControllers();

app.Run();
