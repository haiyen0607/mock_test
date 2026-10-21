using QuizApp.Domain.Enums;

namespace QuizApp.Application.Dtos;

/// <summary>
/// UC13 – thêm câu hỏi vào Quiz. Đúng theo SRS 2.3.2 bước 4: User có thể tạo Question mới
/// (điền NewQuestion, QuestionBankId tuỳ chọn) hoặc chọn Question có sẵn để tái sử dụng (UC17, điền QuestionId).
/// Chỉ được điền một trong hai.
/// </summary>
public class AddQuizQuestionRequest
{
    /// <summary>UC17 – tái sử dụng Question đã tồn tại (thuộc bank của chính User hoặc một bank public).</summary>
    public int? QuestionId { get; set; }

    /// <summary>Bank sẽ chứa Question mới tạo. Bỏ trống -> lưu vào bank mặc định riêng tư "Câu hỏi tạo trong quiz" của chủ Quiz (tự tạo nếu chưa có).</summary>
    public int? QuestionBankId { get; set; }

    public NewQuestionPayload? NewQuestion { get; set; }
}

public class NewQuestionPayload
{
    public string Content { get; set; } = string.Empty;

    // Nullable cố ý: client quên gửi field -> null -> validator báo "QuestionType is required."
    public QuestionType? QuestionType { get; set; }

    public List<AnswerRequest> Answers { get; set; } = new();
}

/// <summary>UC13 – sắp xếp lại thứ tự câu hỏi trong Quiz. Danh sách QuestionId theo đúng thứ tự mong muốn.</summary>
public class ReorderQuizQuestionsRequest
{
    public List<int> QuestionIds { get; set; } = new();
}
