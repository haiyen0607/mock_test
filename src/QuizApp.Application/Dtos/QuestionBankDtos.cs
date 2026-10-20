using System.ComponentModel.DataAnnotations;

namespace QuizApp.Application.Dtos;

public record QuestionBankDto(int QuestionBankId, string Name, string? Description, bool IsPublic, int QuestionCount, DateTime CreatedAt);

/// <summary>
/// UC16 – thông tin 1 Question Bank khi duyệt bank công khai hoặc mở chi tiết bank.
/// QuestionCount: câu hiển thị được với người xem (chủ sở hữu: mọi câu chưa xoá; người khác: câu Active).
/// CanManage: người xem là chủ sở hữu hoặc Admin (được sửa bank và thấy đáp án đúng).
/// </summary>
public record QuestionBankInfoDto(int QuestionBankId, string Name, string? Description, bool IsPublic, int QuestionCount,
    string OwnerUsername, bool CanManage, DateTime CreatedAt);

/// <summary>UC15 – tạo/sửa Question Bank.</summary>
public class QuestionBankRequest
{
    [Required(ErrorMessage = "Name is required.")]
    [StringLength(255)]
    public string Name { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    public bool IsPublic { get; set; }
}
