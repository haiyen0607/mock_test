using Microsoft.EntityFrameworkCore;
using Moq;
using QuizApp.Application.Abstractions;
using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;
using QuizApp.Infrastructure.Persistence;

namespace QuizApp.Application.Tests.TestSupport;

/// <summary>
/// QuizDbContext thật trên EF Core InMemory, mỗi instance 1 database riêng (tên ngẫu nhiên) -> các test độc lập.
/// Dùng <see cref="CreateContext"/> nhiều lần để seed / chạy service / kiểm tra bằng các context khác nhau
/// (tránh việc đọc lại entity còn nằm trong change tracker).
/// </summary>
public sealed class TestDatabase
{
    private readonly DbContextOptions<QuizDbContext> _options = new DbContextOptionsBuilder<QuizDbContext>()
        .UseInMemoryDatabase($"quizapp-tests-{Guid.NewGuid():N}")
        .Options;

    public QuizDbContext CreateContext() => new(_options);

    /// <summary>Thêm entity vào database bằng 1 context riêng, trả về entity (đã có Id).</summary>
    public T Seed<T>(T entity) where T : class
    {
        using var db = CreateContext();
        db.Add(entity);
        db.SaveChanges();
        return entity;
    }

    public User SeedUser(string username = "alice", string? email = null, AccountStatus status = AccountStatus.Active,
        string passwordHash = "stored-hash") =>
        Seed(new User
        {
            Username = username,
            Email = email ?? $"{username}@example.com",
            PasswordHash = passwordHash,
            Role = UserRole.User,
            Status = status,
            CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });
}

/// <summary>Mock ICurrentUser theo quy tắc sở hữu thật: CanManage = (là chủ sở hữu) hoặc Administrator.</summary>
public static class CurrentUserMock
{
    public static Mock<ICurrentUser> For(int? userId, bool isAdministrator = false)
    {
        var mock = new Mock<ICurrentUser>();
        mock.SetupGet(u => u.UserId).Returns(userId);
        mock.SetupGet(u => u.IsAuthenticated).Returns(userId is not null);
        mock.SetupGet(u => u.IsAdministrator).Returns(isAdministrator);
        mock.Setup(u => u.CanManage(It.IsAny<int>()))
            .Returns<int>(ownerId => userId is not null && (isAdministrator || ownerId == userId));
        return mock;
    }

    public static Mock<ICurrentUser> Guest() => For(null);
}
