using QuizApp.Api.Enums;

namespace QuizApp.Api.Entities;

/// <summary>
/// Câu hỏi thuộc về một QuestionBank (SRS 1.4). Được liên kết tới Quiz gián
/// tiếp qua QuizQuestion để cùng một Question có thể xuất hiện trong nhiều Quiz.
/// </summary>
public class Question
{
    public int QuestionId { get; set; }
    public int QuestionBankId { get; set; }
    public string Content { get; set; } = string.Empty;
    public QuestionType QuestionType { get; set; }

    /// <summary>Trạng thái kiểm duyệt (UC20). Removed = Admin đã gỡ do vi phạm.</summary>
    public ContentStatus Status { get; set; } = ContentStatus.Active;

    public DateTime CreatedAt { get; set; }

    public QuestionBank? QuestionBank { get; set; }
    public ICollection<Answer> Answers { get; set; } = new List<Answer>();
    public ICollection<QuizQuestion> QuizQuestions { get; set; } = new List<QuizQuestion>();
}
