using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using QuizApp.Domain.Entities;

namespace QuizApp.Application.Abstractions;

/// <summary>
/// Cổng truy cập dữ liệu cho tầng Application. Service làm việc qua interface này thay vì
/// QuizDbContext cụ thể (cài đặt ở Infrastructure) — dễ thay provider và dễ viết unit test.
/// </summary>
public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<QuestionBank> QuestionBanks { get; }
    DbSet<Question> Questions { get; }
    DbSet<Answer> Answers { get; }
    DbSet<Quiz> Quizzes { get; }
    DbSet<QuizQuestion> QuizQuestions { get; }
    DbSet<QuizAttempt> QuizAttempts { get; }
    DbSet<AttemptAnswer> AttemptAnswers { get; }

    /// <summary>Transaction (BeginTransactionAsync) cho thao tác nhiều bước.</summary>
    DatabaseFacade Database { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
