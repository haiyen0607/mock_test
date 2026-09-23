namespace QuizApp.Api.Entities;

/// <summary>
/// Một lần làm bài (SRS 1.4 "QuizAttempt"). UserId null nghĩa là lượt làm thử
/// của Guest (UC07); khi đó GuestIdentifier dùng để giới hạn số lượt trial (A1).
/// </summary>
public class QuizAttempt
{
    public int AttemptId { get; set; }
    public int QuizId { get; set; }

    /// <summary>null nếu đây là lượt trial của Guest (UC07).</summary>
    public int? UserId { get; set; }

    /// <summary>true = lượt Try Trial Quiz của Guest (UC07), false = Take Quiz của User (UC08).</summary>
    public bool IsTrial { get; set; }

    /// <summary>Định danh ẩn danh phía client, dùng để đếm số lượt trial mỗi Guest (UC07 A1).</summary>
    public string? GuestIdentifier { get; set; }

    public DateTime StartedAt { get; set; }

    /// <summary>null = đang làm bài, có giá trị = đã Submit (UC09).</summary>
    public DateTime? SubmittedAt { get; set; }

    /// <summary>Điểm số, tính trên các câu hỏi có thể chấm tự động (UC09).</summary>
    public int? Score { get; set; }

    public Quiz? Quiz { get; set; }
    public User? User { get; set; }
    public ICollection<AttemptAnswer> Answers { get; set; } = new List<AttemptAnswer>();
}
