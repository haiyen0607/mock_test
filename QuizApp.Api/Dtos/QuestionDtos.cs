using System.ComponentModel.DataAnnotations;
using QuizApp.Api.Enums;

namespace QuizApp.Api.Dtos;

/// <summary>Câu hỏi trả về khi chủ sở hữu xem/quản lý Question Bank (UC15) — có Answers đầy đủ.</summary>
public record QuestionDto(int QuestionId, int QuestionBankId, string Content, string QuestionType, string Status, List<AnswerDto> Answers);

/// <summary>Câu hỏi trả về khi tìm kiếm câu hỏi công khai để tái sử dụng (UC16) — không lộ IsCorrect.</summary>
public record PublicQuestionDto(int QuestionId, int QuestionBankId, string QuestionBankName, string Content, string QuestionType);

/// <summary>UC15 – payload tạo/sửa một Question trong Question Bank.</summary>
public class QuestionRequest
{
    [Required(ErrorMessage = "Content is required.")]
    [StringLength(4000)]
    public string Content { get; set; } = string.Empty;

    // Nullable cố ý: nếu để non-nullable enum, thiếu field sẽ tự nhận giá trị mặc định
    // (MultipleChoice) khiến [Required] không bao giờ báo lỗi.
    [Required(ErrorMessage = "QuestionType is required.")]
    [EnumDataType(typeof(QuestionType), ErrorMessage = "QuestionType is not supported.")]
    public QuestionType? QuestionType { get; set; }
}

/// <summary>UC15 – tạo Question kèm luôn danh sách Answer định nghĩa sẵn (nếu loại câu hỏi hỗ trợ) trong 1 lần gọi.</summary>
public class QuestionAndAnswersRequest : QuestionRequest
{
    public List<AnswerRequest> Answers { get; set; } = new();
}
