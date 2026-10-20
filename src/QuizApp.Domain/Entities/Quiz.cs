using QuizApp.Domain.Enums;

namespace QuizApp.Domain.Entities;

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

public static class QuizExtensions
{
    /// <summary>
    /// Các câu hỏi của Quiz mà người làm bài được thấy: chưa bị Admin gỡ (UC20 A2), theo đúng thứ tự.
    /// Yêu cầu đã Include(QuizQuestions).ThenInclude(Question).
    /// </summary>
    public static List<QuizQuestion> ActiveQuestions(this Quiz quiz) =>
        quiz.QuizQuestions
            .Where(qq => qq.Question is not null && qq.Question.Status == ContentStatus.Active)
            .OrderBy(qq => qq.OrderIndex)
            .ToList();
}
