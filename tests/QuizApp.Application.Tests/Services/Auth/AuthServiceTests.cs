using Microsoft.EntityFrameworkCore;
using Moq;
using QuizApp.Application.Abstractions;
using QuizApp.Application.Common;
using QuizApp.Application.Dtos;
using QuizApp.Application.Services.Auth;
using QuizApp.Application.Tests.TestSupport;
using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Tests.Services.Auth;

public class AuthServiceTests
{
    private const string Token = "jwt-token";

    private readonly TestDatabase _database = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IJwtTokenService> _jwt = new();
    private readonly Mock<ICurrentUser> _currentUser = CurrentUserMock.Guest();

    public AuthServiceTests()
    {
        _hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns("hashed-password");
        _jwt.Setup(j => j.GenerateToken(It.IsAny<User>())).Returns(Token);
    }

    private AuthService CreateSut(ICurrentUser? currentUser = null) =>
        new(_database.CreateContext(), _hasher.Object, _jwt.Object, currentUser ?? _currentUser.Object);

    private static RegisterRequest Register(string username = "alice", string email = "alice@example.com", string password = "secret1") =>
        new() { Username = username, Email = email, Password = password };

    private static LoginRequest Login(string usernameOrEmail = "alice", string password = "secret1") =>
        new() { UsernameOrEmail = usernameOrEmail, Password = password };

    // ---------- RegisterAsync ----------

    [Fact]
    public async Task RegisterAsync_NewUser_CreatesNormalizedUserAndReturnsToken()
    {
        var result = await CreateSut().RegisterAsync(Register(username: "  alice  ", email: "  Alice@Example.COM "));

        result.IsSuccess.Should().BeTrue();
        result.Value.Token.Should().Be(Token);
        result.Value.User.Username.Should().Be("alice");
        result.Value.User.Email.Should().Be("alice@example.com");
        result.Value.User.Role.Should().Be(nameof(UserRole.User));
        result.Value.User.Status.Should().Be(nameof(AccountStatus.Active));

        await using var db = _database.CreateContext();
        var saved = await db.Users.SingleAsync();
        saved.Username.Should().Be("alice");
        saved.Email.Should().Be("alice@example.com");
        saved.PasswordHash.Should().Be("hashed-password");
        saved.Role.Should().Be(UserRole.User);
        saved.Status.Should().Be(AccountStatus.Active);
        result.Value.User.UserId.Should().Be(saved.UserId);
    }

    [Fact]
    public async Task RegisterAsync_NewUser_HashesPasswordAndGeneratesTokenOnce()
    {
        await CreateSut().RegisterAsync(Register(password: "secret1"));

        _hasher.Verify(h => h.Hash("secret1"), Times.Once);
        _jwt.Verify(j => j.GenerateToken(It.Is<User>(u => u.Username == "alice")), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_UsernameTaken_ReturnsConflictUsernameTaken()
    {
        _database.SeedUser("alice", "other@example.com");

        var result = await CreateSut().RegisterAsync(Register(username: " alice ", email: "new@example.com"));

        result.IsSuccess.Should().BeFalse();
        result.Error!.Type.Should().Be(ErrorType.Conflict);
        result.Error.Code.Should().Be(ErrorCodes.UsernameTaken);
        _hasher.Verify(h => h.Hash(It.IsAny<string>()), Times.Never);
        _jwt.Verify(j => j.GenerateToken(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task RegisterAsync_EmailTakenWithDifferentCase_ReturnsConflictEmailTaken()
    {
        _database.SeedUser("alice", "alice@example.com");

        var result = await CreateSut().RegisterAsync(Register(username: "bob", email: "ALICE@Example.com"));

        result.IsSuccess.Should().BeFalse();
        result.Error!.Type.Should().Be(ErrorType.Conflict);
        result.Error.Code.Should().Be(ErrorCodes.EmailTaken);

        await using var db = _database.CreateContext();
        (await db.Users.CountAsync()).Should().Be(1);
    }

    // ---------- LoginAsync ----------

    [Fact]
    public async Task LoginAsync_UnknownUser_ReturnsInvalidCredentialsAndRunsDummyVerify()
    {
        // Chống timing attack: không có user vẫn chạy verify giả để thời gian phản hồi như nhau
        var result = await CreateSut().LoginAsync(Login("nobody", "secret1"));

        result.IsSuccess.Should().BeFalse();
        result.Error!.Type.Should().Be(ErrorType.Unauthorized);
        result.Error.Code.Should().Be(ErrorCodes.InvalidCredentials);
        _hasher.Verify(h => h.VerifyDummy("secret1"), Times.Once);
        _hasher.Verify(h => h.Verify(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        _jwt.Verify(j => j.GenerateToken(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task LoginAsync_WrongPassword_ReturnsInvalidCredentials()
    {
        _database.SeedUser("alice", passwordHash: "stored-hash");
        _hasher.Setup(h => h.Verify("wrong", "stored-hash")).Returns(false);

        var result = await CreateSut().LoginAsync(Login("alice", "wrong"));

        result.IsSuccess.Should().BeFalse();
        result.Error!.Type.Should().Be(ErrorType.Unauthorized);
        result.Error.Code.Should().Be(ErrorCodes.InvalidCredentials);
        _hasher.Verify(h => h.Verify("wrong", "stored-hash"), Times.Once);
        _hasher.Verify(h => h.VerifyDummy(It.IsAny<string>()), Times.Never);
        _jwt.Verify(j => j.GenerateToken(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task LoginAsync_BlockedAccountWithCorrectPassword_ReturnsForbiddenAccountBlocked()
    {
        _database.SeedUser("alice", status: AccountStatus.Blocked, passwordHash: "stored-hash");
        _hasher.Setup(h => h.Verify("secret1", "stored-hash")).Returns(true);

        var result = await CreateSut().LoginAsync(Login("alice", "secret1"));

        result.IsSuccess.Should().BeFalse();
        result.Error!.Type.Should().Be(ErrorType.Forbidden);
        result.Error.Code.Should().Be(ErrorCodes.AccountBlocked);
        _jwt.Verify(j => j.GenerateToken(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task LoginAsync_BlockedAccountWithWrongPassword_ReturnsInvalidCredentials()
    {
        // Sai mật khẩu thì không tiết lộ trạng thái bị khoá
        _database.SeedUser("alice", status: AccountStatus.Blocked, passwordHash: "stored-hash");
        _hasher.Setup(h => h.Verify("wrong", "stored-hash")).Returns(false);

        var result = await CreateSut().LoginAsync(Login("alice", "wrong"));

        result.Error!.Code.Should().Be(ErrorCodes.InvalidCredentials);
    }

    [Theory]
    [InlineData("alice")]
    [InlineData("  alice  ")]
    [InlineData("alice@example.com")]
    public async Task LoginAsync_ValidCredentials_ReturnsTokenAndUser(string usernameOrEmail)
    {
        var user = _database.SeedUser("alice", "alice@example.com", passwordHash: "stored-hash");
        _hasher.Setup(h => h.Verify("secret1", "stored-hash")).Returns(true);

        var result = await CreateSut().LoginAsync(Login(usernameOrEmail, "secret1"));

        result.IsSuccess.Should().BeTrue();
        result.Value.Token.Should().Be(Token);
        result.Value.User.UserId.Should().Be(user.UserId);
        result.Value.User.Username.Should().Be("alice");
        _jwt.Verify(j => j.GenerateToken(It.Is<User>(u => u.UserId == user.UserId)), Times.Once);
        _hasher.Verify(h => h.VerifyDummy(It.IsAny<string>()), Times.Never);
    }

    // ---------- GetCurrentUserAsync ----------

    [Fact]
    public async Task GetCurrentUserAsync_AuthenticatedUser_ReturnsUserDto()
    {
        var user = _database.SeedUser("alice");

        var result = await CreateSut(CurrentUserMock.For(user.UserId).Object).GetCurrentUserAsync();

        result.IsSuccess.Should().BeTrue();
        result.Value.UserId.Should().Be(user.UserId);
        result.Value.Username.Should().Be("alice");
        result.Value.Email.Should().Be("alice@example.com");
    }

    [Fact]
    public async Task GetCurrentUserAsync_Guest_ThrowsInvalidOperationException()
    {
        var act = () => CreateSut(CurrentUserMock.Guest().Object).GetCurrentUserAsync();

        await act.Should().ThrowAsync<InvalidOperationException>();
    }
}
