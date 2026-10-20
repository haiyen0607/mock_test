using System.ComponentModel.DataAnnotations;

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

    /// <summary>
    /// Thời lượng (phút) chốt lúc BẮT ĐẦU làm bài (UC08 A3). Hạn nộp = StartedAt + DurationMinutes;
    /// chủ Quiz sửa Duration giữa chừng không làm thay đổi hạn của lượt đang làm.
    /// </summary>
    public int DurationMinutes { get; set; }

    /// <summary>null = đang làm bài, có giá trị = đã Submit (UC09).</summary>
    public DateTime? SubmittedAt { get; set; }

    /// <summary>
    /// Điểm phần trăm (0–100) = CorrectCount / MaxScore (UC09). null khi chưa có câu nào được chấm
    /// (vd. quiz chỉ có câu tự luận đang chờ chấm). Tính lại mỗi khi chủ Quiz chấm câu tự luận.
    /// </summary>
    public int? Score { get; set; }

    /// <summary>Số câu đúng trong các câu đã được chấm (tự động hoặc thủ công).</summary>
    public int CorrectCount { get; set; }

    /// <summary>Số câu đã được chấm = câu trắc nghiệm + câu tự luận đã chấm (mẫu số của Score).</summary>
    public int MaxScore { get; set; }

    /// <summary>Số câu tự luận có trả lời đang chờ chấm thủ công (UC09 A3).</summary>
    public int PendingCount { get; set; }

    /// <summary>Concurrency token (SQL Server rowversion) – chặn Submit 2 lần đồng thời.</summary>
    [Timestamp]
    public byte[]? RowVersion { get; set; }

    public Quiz? Quiz { get; set; }
    public User? User { get; set; }
    public ICollection<AttemptAnswer> Answers { get; set; } = new List<AttemptAnswer>();
}
