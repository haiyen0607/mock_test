using System.ComponentModel.DataAnnotations;

namespace QuizApp.Api.Dtos;

public record QuestionBankDto(int QuestionBankId, string Name, string? Description, bool IsPublic, int QuestionCount, DateTime CreatedAt);

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
