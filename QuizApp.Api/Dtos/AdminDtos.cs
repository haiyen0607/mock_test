// Dtos/ Trả lời câu hỏi "Dữ liệu đi qua API có hình dạng như thế nào?"
// Là bản hợp đòng giữa Client và server: client được gửi lên những field gì? 


using System.ComponentModel.DataAnnotations;

namespace QuizApp.Api.Dtos;

/// <summary>UC19/UC20 – Administrator đổi trạng thái kiểm duyệt của Quiz hoặc Question.</summary>
public class UpdateContentStatusRequest
{
    [Required(ErrorMessage = "Status is required.")]
    public string Status { get; set; } = string.Empty; // "Active" | "Removed"
}
