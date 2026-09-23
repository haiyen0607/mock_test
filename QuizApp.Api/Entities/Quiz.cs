using QuizApp.Api.Enums;

namespace QuizApp.Api.Entities;

/// <summary>
/// Quiz thuộc sở hữu một User (SRS 1.4). IsPublished điều khiển việc hiển thị
/// công khai (UC14); Status dùng cho kiểm duyệt của Administrator (UC19/UC20).
/// </summary>
public class Quiz
{
    public int QuizId { get; set; }
    public int OwnerId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>Thời lượng làm bài, tính bằng phút.</summary>
    public int Duration { get; set; }

    /// <summary>true = Public (đã Publish), false = Private/draft (UC14).</summary>
    public bool IsPublished { get; set; }

    /// <summary>Trạng thái kiểm duyệt (UC19/UC20). Removed = Admin đã gỡ khỏi truy cập công khai.</summary>
    public ContentStatus Status { get; set; } = ContentStatus.Active;

    public DateTime CreatedAt { get; set; }

    public User? Owner { get; set; }

    // Danh sách câu hỏi của Quiz, có thứ tự, thông qua bảng nối QuizQuestion (UC13)
    public ICollection<QuizQuestion> QuizQuestions { get; set; } = new List<QuizQuestion>();

    public ICollection<QuizAttempt> Attempts { get; set; } = new List<QuizAttempt>();
}
