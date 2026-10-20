namespace QuizApp.Api.Entities;

/// <summary>Câu trả lời của người dùng cho một câu hỏi trong một QuizAttempt (SRS 1.4).</summary>
public class AttemptAnswer
{
    public int AttemptAnswerId { get; set; }
    public int AttemptId { get; set; }
    public int QuestionId { get; set; }

    /// <summary>Dùng cho câu hỏi có đáp án định nghĩa sẵn (MultipleChoice/SingleChoice/TrueFalse).</summary>
    public int? AnswerId { get; set; }

    /// <summary>Dùng cho câu hỏi dạng văn bản (FillInTheBlanks/ShortAnswer/LongAnswer).</summary>
    public string? ResponseText { get; set; }

    /// <summary>
    /// Kết quả đúng/sai của CÂU HỎI này, chốt tại thời điểm Submit (UC09).
    /// null = câu dạng văn bản đang chờ chấm thủ công (UC09 A3).
    /// Lưu lại để UC10 hiển thị đúng kết quả lúc nộp, kể cả khi sau đó đáp án/câu hỏi bị sửa.
    /// </summary>
    public bool? IsCorrect { get; set; }

    public QuizAttempt? Attempt { get; set; }
    public Question? Question { get; set; }
    public Answer? Answer { get; set; }
}
