using System.ComponentModel.DataAnnotations;

namespace QuizApp.Api.Dtos;

/// <summary>UC04/UC05 – một dòng trong danh sách Quiz công khai, hoặc trong "My Quizzes".</summary>
public record QuizListItemDto(int QuizId, string Title, string? Description, int Duration,
    bool IsPublished, string Status, int QuestionCount, string OwnerUsername, DateTime CreatedAt);

/// <summary>UC06 – chi tiết Quiz kèm danh sách câu hỏi (chưa lộ đáp án đúng).</summary>
public record QuizDetailDto(int QuizId, string Title, string? Description, int Duration,
    bool IsPublished, string Status, string OwnerUsername, List<QuestionSummaryDto> Questions);

/// <summary>Một câu hỏi trong Quiz, hiển thị ở màn quản lý (UC13) — không lộ IsCorrect.</summary>
public record QuestionSummaryDto(int QuestionId, int OrderIndex, string Content, string QuestionType, int AnswerCount);

/// <summary>UC11/UC12 – payload tạo/sửa thông tin cơ bản của Quiz.</summary>
public class QuizRequest
{
    [Required(ErrorMessage = "Title is required.")]
    [StringLength(255, ErrorMessage = "Title must not exceed 255 characters.")]
    public string Title { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    [Range(1, 600, ErrorMessage = "Duration must be between 1 and 600 minutes.")]
    public int Duration { get; set; }
}

/// <summary>UC14 – Publish/Unpublish Quiz.</summary>
public class PublishQuizRequest
{
    public bool Publish { get; set; }
}
