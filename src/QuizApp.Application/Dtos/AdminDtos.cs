// Dtos/ Trả lời câu hỏi "Dữ liệu đi qua API có hình dạng như thế nào?"
// Là bản hợp đòng giữa Client và server: client được gửi lên những field gì? 


namespace QuizApp.Application.Dtos;

/// <summary>UC20 – 1 dòng trong danh sách câu hỏi Admin kiểm duyệt (mọi Question Bank, public lẫn private).</summary>
public record AdminQuestionDto(int QuestionId, int QuestionBankId, string QuestionBankName, bool QuestionBankIsPublic,
    string OwnerUsername, string Content, string QuestionType, string Status, int UsedInQuizCount, DateTime CreatedAt,
    List<AnswerDto> Answers);

/// <summary>UC19/UC20 – Administrator đổi trạng thái kiểm duyệt của Quiz hoặc Question.</summary>
public class UpdateContentStatusRequest
{
    public string Status { get; set; } = string.Empty; // "Active" | "Removed"
}
