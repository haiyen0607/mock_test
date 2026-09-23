namespace QuizApp.Api.Entities;

/// <summary>
/// Question Bank cá nhân của một User (SRS 1.4 Entities Description, UC15).
/// Question luôn thuộc về đúng 1 QuestionBank; Quiz tham chiếu Question qua
/// bảng nối QuizQuestion nên 1 Question có thể được tái sử dụng ở nhiều Quiz (UC17).
/// </summary>
public class QuestionBank
{
    public int QuestionBankId { get; set; }
    public int OwnerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>Question Bank công khai có thể được User khác tìm và tái sử dụng câu hỏi (UC16).</summary>
    public bool IsPublic { get; set; }

    public DateTime CreatedAt { get; set; }

    public User? Owner { get; set; }
    public ICollection<Question> Questions { get; set; } = new List<Question>();
}
