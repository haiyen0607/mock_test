namespace QuizApp.Domain.Entities;

/// <summary>
/// Bảng nối n-n giữa Quiz và Question, giữ thứ tự câu hỏi trong Quiz (SRS 1.4
/// "QuizQuestion" — cho phép 1 Question được tái sử dụng ở nhiều Quiz, UC13/UC17).
/// Khoá chính kép (QuizId, QuestionId).
/// </summary>
public class QuizQuestion
{
    public int QuizId { get; set; }
    public int QuestionId { get; set; }

    /// <summary>Vị trí hiển thị của câu hỏi trong Quiz, bắt đầu từ 1.</summary>
    public int OrderIndex { get; set; }

    public Quiz? Quiz { get; set; }
    public Question? Question { get; set; }
}
