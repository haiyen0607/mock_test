using QuizApp.Domain.Enums;

namespace QuizApp.Application.Dtos;

/// <summary>Câu hỏi trả về khi chủ sở hữu xem/quản lý Question Bank (UC15) — có Answers đầy đủ.</summary>
public record QuestionDto(int QuestionId, int QuestionBankId, string Content, string QuestionType, string Status, List<AnswerDto> Answers);

/// <summary>
/// Câu hỏi công khai (UC16/UC17) — dùng khi tìm câu hỏi để tái sử dụng và khi người KHÔNG phải
/// chủ sở hữu xem 1 Question Bank công khai. Có danh sách lựa chọn để review (UC17 bước 4)
/// nhưng KHÔNG BAO GIỜ lộ IsCorrect (nếu lộ, ai cũng xem được đáp án của các Quiz dùng câu này).
/// </summary>
public record PublicQuestionDto(int QuestionId, int QuestionBankId, string QuestionBankName, string Content, string QuestionType,
    List<AnswerOptionDto> Options);

/// <summary>UC15 – payload tạo/sửa một Question trong Question Bank.</summary>
public class QuestionRequest
{
    public string Content { get; set; } = string.Empty;

    // Nullable cố ý: nếu để non-nullable enum, thiếu field sẽ tự nhận giá trị mặc định (MultipleChoice)
    // và validator không phát hiện được client quên gửi field.
    public QuestionType? QuestionType { get; set; }
}

/// <summary>UC15 – tạo Question kèm luôn danh sách Answer định nghĩa sẵn (nếu loại câu hỏi hỗ trợ) trong 1 lần gọi.</summary>
public class QuestionAndAnswersRequest : QuestionRequest
{
    public List<AnswerRequest> Answers { get; set; } = new();
}

/// <summary>
/// UC15 – sửa Question kèm TOÀN BỘ danh sách Answer trong 1 lần (PUT questions/{id}/full):
/// Answer có AnswerId -> sửa; không có AnswerId -> thêm mới; Answer hiện có nhưng không còn trong danh sách -> xoá.
/// Quy tắc loại câu hỏi được kiểm tra trên trạng thái CUỐI, tránh lỗi ở trạng thái trung gian khi sửa từng đáp án.
/// </summary>
public class ReplaceQuestionRequest : QuestionRequest
{
    public List<EditAnswerRequest> Answers { get; set; } = new();
}
