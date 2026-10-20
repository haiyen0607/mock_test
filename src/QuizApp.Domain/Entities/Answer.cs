namespace QuizApp.Domain.Entities;

/// <summary>Đáp án định nghĩa sẵn cho các loại câu hỏi trắc nghiệm (SRS 1.4).</summary>
public class Answer
{
    public int AnswerId { get; set; }
    public int QuestionId { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }

    public Question? Question { get; set; }
}
