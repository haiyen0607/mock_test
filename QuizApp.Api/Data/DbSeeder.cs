using QuizApp.Api.Entities;
using QuizApp.Api.Enums;
using QuizApp.Api.Security;

namespace QuizApp.Api.Data;

/// <summary>
/// Tạo dữ liệu mẫu: 1 Administrator, 1 User, 1 Question Bank công khai với vài
/// câu hỏi, và 1 Quiz đã publish — để có thể gọi thử API ngay sau khi khởi động.
/// CHỈ chạy ở môi trường Development (Program.cs). Mật khẩu lấy từ cấu hình
/// Seed:AdminPassword / Seed:UserPassword (appsettings.Development.json hoặc user-secrets),
/// không còn hardcode trong mã nguồn.
/// </summary>
public static class DbSeeder
{
    public static void Seed(QuizDbContext db, string adminPassword, string userPassword)
    {
        if (db.Users.Any()) return;

        var admin = new User
        {
            Username = "admin",
            Email = "admin@quizapp.local",
            PasswordHash = PasswordHasher.Hash(adminPassword),
            Role = UserRole.Administrator,
            Status = AccountStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        var trainer = new User
        {
            Username = "hoanganh",
            Email = "hoanganh@quizapp.local",
            PasswordHash = PasswordHasher.Hash(userPassword),
            Role = UserRole.User,
            Status = AccountStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        db.Users.AddRange(admin, trainer);
        db.SaveChanges();

        var bank = new QuestionBank
        {
            OwnerId = trainer.UserId,
            Name = "Angular Fundamentals",
            Description = "Câu hỏi cơ bản về Angular.",
            IsPublic = true,
            CreatedAt = DateTime.UtcNow,
            Questions = new List<Question>
            {
                new Question
                {
                    Content = "Which decorator declares an Angular component?",
                    QuestionType = QuestionType.SingleChoice,
                    Status = ContentStatus.Active,
                    CreatedAt = DateTime.UtcNow,
                    Answers = new List<Answer>
                    {
                        new Answer { Content = "@Component", IsCorrect = true },
                        new Answer { Content = "@Injectable", IsCorrect = false },
                        new Answer { Content = "@NgModule", IsCorrect = false }
                    }
                },
                new Question
                {
                    Content = "Which of the following are Angular structural directives?",
                    QuestionType = QuestionType.MultipleChoice,
                    Status = ContentStatus.Active,
                    CreatedAt = DateTime.UtcNow,
                    Answers = new List<Answer>
                    {
                        new Answer { Content = "*ngIf", IsCorrect = true },
                        new Answer { Content = "*ngFor", IsCorrect = true },
                        new Answer { Content = "ngModel", IsCorrect = false }
                    }
                },
                new Question
                {
                    Content = "An Angular service must always be provided in root.",
                    QuestionType = QuestionType.TrueFalse,
                    Status = ContentStatus.Active,
                    CreatedAt = DateTime.UtcNow,
                    Answers = new List<Answer>
                    {
                        new Answer { Content = "True", IsCorrect = false },
                        new Answer { Content = "False", IsCorrect = true }
                    }
                },
                new Question
                {
                    Content = "Explain the difference between a template-driven form and a reactive form.",
                    QuestionType = QuestionType.LongAnswer,
                    Status = ContentStatus.Active,
                    CreatedAt = DateTime.UtcNow
                }
            }
        };

        db.QuestionBanks.Add(bank);
        db.SaveChanges();

        var quiz = new Quiz
        {
            OwnerId = trainer.UserId,
            Title = "Angular Fundamentals Quiz",
            Description = "Basic knowledge assessment for the Angular training module.",
            Duration = 30,
            IsPublished = true,
            Status = ContentStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        db.Quizzes.Add(quiz);
        db.SaveChanges();

        var order = 1;
        foreach (var question in bank.Questions)
        {
            db.QuizQuestions.Add(new QuizQuestion
            {
                QuizId = quiz.QuizId,
                QuestionId = question.QuestionId,
                OrderIndex = order++
            });
        }

        db.SaveChanges();
    }
}
