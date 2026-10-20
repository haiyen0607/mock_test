using System.ComponentModel.DataAnnotations;
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
    [Required(ErrorMessage = "Content is required.")]
    [StringLength(4000)]
    public string Content { get; set; } = string.Empty;

    // Nullable cố ý (xem chú thích ở QuestionRequest): enum non-nullable sẽ tự nhận
    // giá trị mặc định MultipleChoice khi client quên gửi field, khiến [Required] vô tác dụng.
    [Required(ErrorMessage = "QuestionType is required.")]
    [EnumDataType(typeof(QuestionType), ErrorMessage = "QuestionType is not supported.")]
    public QuestionType? QuestionType { get; set; }

    public List<AnswerRequest> Answers { get; set; } = new();
}

/// <summary>UC13 – sắp xếp lại thứ tự câu hỏi trong Quiz. Danh sách QuestionId theo đúng thứ tự mong muốn.</summary>
public class ReorderQuizQuestionsRequest
{
    [Required]
    [MinLength(1)]
    [MaxLength(500)]
    public List<int> QuestionIds { get; set; } = new();
}
