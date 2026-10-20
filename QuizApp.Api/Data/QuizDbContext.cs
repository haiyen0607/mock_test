using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using QuizApp.Api.Entities;

namespace QuizApp.Api.Data;

public class QuizDbContext : DbContext
{
    public QuizDbContext(DbContextOptions<QuizDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<QuestionBank> QuestionBanks => Set<QuestionBank>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<Answer> Answers => Set<Answer>();
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<AttemptAnswer> AttemptAnswers => Set<AttemptAnswer>();

    /// <summary>
    /// Mọi cột DateTime lưu giờ UTC. SQL Server không lưu Kind nên khi đọc ra DateTime có Kind = Unspecified
    /// và bị serialize thiếu "Z" -> trình duyệt hiểu nhầm là giờ địa phương (timer làm bài lệch).
    /// Converter này gắn lại Kind = Utc khi đọc.
    /// </summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<UtcDateTimeConverter>();
    }

    private sealed class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
    {
        public UtcDateTimeConverter()
            : base(v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
                   v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
        {
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Tên bảng / cột theo ERD ở SRS mục 1.4.

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("USER");
            entity.HasKey(e => e.UserId);
            entity.Property(e => e.UserId).HasColumnName("user_id").ValueGeneratedOnAdd();
            entity.Property(e => e.Username).HasColumnName("username").HasMaxLength(100).IsRequired();
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash").IsRequired();
            entity.Property(e => e.Role).HasColumnName("role").HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();

            entity.HasIndex(e => e.Username).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique();
        });

        modelBuilder.Entity<QuestionBank>(entity =>
        {
            entity.ToTable("QUESTION_BANK");
            entity.HasKey(e => e.QuestionBankId);
            entity.Property(e => e.QuestionBankId).HasColumnName("question_bank_id").ValueGeneratedOnAdd();
            entity.Property(e => e.OwnerId).HasColumnName("owner_id").IsRequired();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.IsPublic).HasColumnName("is_public").IsRequired();
            entity.Property(e => e.IsDeleted).HasColumnName("is_deleted").IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();

            entity.HasOne(e => e.Owner)
                  .WithMany(u => u.QuestionBanks)
                  .HasForeignKey(e => e.OwnerId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Question>(entity =>
        {
            entity.ToTable("QUESTION");
            entity.HasKey(e => e.QuestionId);
            entity.Property(e => e.QuestionId).HasColumnName("question_id").ValueGeneratedOnAdd();
            entity.Property(e => e.QuestionBankId).HasColumnName("question_bank_id").IsRequired();
            entity.Property(e => e.Content).HasColumnName("content").IsRequired();
            entity.Property(e => e.QuestionType).HasColumnName("question_type").HasConversion<string>().HasMaxLength(50).IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();

            // Lọc theo trạng thái kiểm duyệt ở hầu hết truy vấn công khai (A4)
            entity.HasIndex(e => e.Status);

            entity.HasOne(e => e.QuestionBank)
                  .WithMany(b => b.Questions)
                  .HasForeignKey(e => e.QuestionBankId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Answer>(entity =>
        {
            entity.ToTable("ANSWER");
            entity.HasKey(e => e.AnswerId);
            entity.Property(e => e.AnswerId).HasColumnName("answer_id").ValueGeneratedOnAdd();
            entity.Property(e => e.QuestionId).HasColumnName("question_id").IsRequired();
            entity.Property(e => e.Content).HasColumnName("content").IsRequired();
            entity.Property(e => e.IsCorrect).HasColumnName("is_correct").IsRequired();

            entity.HasOne(e => e.Question)
                  .WithMany(q => q.Answers)
                  .HasForeignKey(e => e.QuestionId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Quiz>(entity =>
        {
            entity.ToTable("QUIZ");
            entity.HasKey(e => e.QuizId);
            entity.Property(e => e.QuizId).HasColumnName("quiz_id").ValueGeneratedOnAdd();
            entity.Property(e => e.OwnerId).HasColumnName("owner_id").IsRequired();
            entity.Property(e => e.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Duration).HasColumnName("duration").IsRequired();
            entity.Property(e => e.IsPublished).HasColumnName("is_published").IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();

            // UC04/UC05 – danh sách Quiz công khai lọc IsPublished + Status và sắp theo CreatedAt (A4)
            entity.HasIndex(e => new { e.IsPublished, e.Status, e.CreatedAt });

            entity.HasOne(e => e.Owner)
                  .WithMany(u => u.Quizzes)
                  .HasForeignKey(e => e.OwnerId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<QuizQuestion>(entity =>
        {
            entity.ToTable("QUIZ_QUESTION");
            entity.HasKey(e => new { e.QuizId, e.QuestionId });
            entity.Property(e => e.QuizId).HasColumnName("quiz_id");
            entity.Property(e => e.QuestionId).HasColumnName("question_id");
            entity.Property(e => e.OrderIndex).HasColumnName("order_index").IsRequired();

            entity.HasOne(e => e.Quiz)
                  .WithMany(q => q.QuizQuestions)
                  .HasForeignKey(e => e.QuizId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Question)
                  .WithMany(q => q.QuizQuestions)
                  .HasForeignKey(e => e.QuestionId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<QuizAttempt>(entity =>
        {
            entity.ToTable("QUIZ_ATTEMPT");
            entity.HasKey(e => e.AttemptId);
            entity.Property(e => e.AttemptId).HasColumnName("attempt_id").ValueGeneratedOnAdd();
            entity.Property(e => e.QuizId).HasColumnName("quiz_id").IsRequired();
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.IsTrial).HasColumnName("is_trial").IsRequired();
            entity.Property(e => e.GuestIdentifier).HasColumnName("guest_identifier").HasMaxLength(100);
            entity.Property(e => e.StartedAt).HasColumnName("started_at").IsRequired();
            entity.Property(e => e.SubmittedAt).HasColumnName("submitted_at");
            entity.Property(e => e.Score).HasColumnName("score");
            entity.Property(e => e.DurationMinutes).HasColumnName("duration_minutes").IsRequired();
            entity.Property(e => e.CorrectCount).HasColumnName("correct_count").IsRequired();
            entity.Property(e => e.MaxScore).HasColumnName("max_score").IsRequired();
            entity.Property(e => e.PendingCount).HasColumnName("pending_count").IsRequired();
            entity.Property(e => e.RowVersion).HasColumnName("row_version").IsRowVersion();

            // Lịch sử làm bài của User (A5) và đếm lượt trial của Guest (UC07 A1)
            entity.HasIndex(e => new { e.UserId, e.SubmittedAt });
            entity.HasIndex(e => new { e.IsTrial, e.GuestIdentifier });

            entity.HasOne(e => e.Quiz)
                  .WithMany(q => q.Attempts)
                  .HasForeignKey(e => e.QuizId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.User)
                  .WithMany(u => u.Attempts)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AttemptAnswer>(entity =>
        {
            entity.ToTable("ATTEMPT_ANSWER");
            entity.HasKey(e => e.AttemptAnswerId);
            entity.Property(e => e.AttemptAnswerId).HasColumnName("attempt_answer_id").ValueGeneratedOnAdd();
            entity.Property(e => e.AttemptId).HasColumnName("attempt_id").IsRequired();
            entity.Property(e => e.QuestionId).HasColumnName("question_id").IsRequired();
            entity.Property(e => e.AnswerId).HasColumnName("answer_id");
            entity.Property(e => e.ResponseText).HasColumnName("response_text");
            entity.Property(e => e.IsCorrect).HasColumnName("is_correct");

            entity.HasOne(e => e.Attempt)
                  .WithMany(a => a.Answers)
                  .HasForeignKey(e => e.AttemptId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Question)
                  .WithMany()
                  .HasForeignKey(e => e.QuestionId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Answer)
                  .WithMany()
                  .HasForeignKey(e => e.AnswerId)
                  .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
