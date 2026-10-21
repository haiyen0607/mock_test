namespace QuizApp.Application.Dtos;

/// <summary>UC04/UC05 – một dòng trong danh sách Quiz công khai, hoặc trong "My Quizzes".</summary>
public record QuizListItemDto(int QuizId, string Title, string? Description, int Duration,
    bool IsPublished, string Status, int QuestionCount, string OwnerUsername, DateTime CreatedAt);

/// <summary>UC06 – chi tiết Quiz kèm danh sách câu hỏi (chưa lộ đáp án đúng).</summary>
public record QuizDetailDto(int QuizId, string Title, string? Description, int Duration,
    bool IsPublished, string Status, string OwnerUsername, List<QuestionSummaryDto> Questions);

/// <summary>
/// Một câu hỏi trong Quiz, hiển thị ở màn quản lý (UC13).
/// Status cho chủ sở hữu/Admin biết câu nào đã bị Admin gỡ (Removed) – UC20.
/// Answers (kèm IsCorrect) chỉ có khi người xem là chủ sở hữu/Admin; với Guest/User khác luôn null.
/// </summary>
public record QuestionSummaryDto(int QuestionId, int OrderIndex, string Content, string QuestionType, int AnswerCount, string Status,
    List<AnswerDto>? Answers = null, bool CanEdit = false);

/// <summary>UC11/UC12 – payload tạo/sửa thông tin cơ bản của Quiz.</summary>
public class QuizRequest
{
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int Duration { get; set; }
}

/// <summary>UC14 – Publish/Unpublish Quiz.</summary>
public class PublishQuizRequest
{
    public bool Publish { get; set; }
}
