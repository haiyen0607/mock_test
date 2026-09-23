// DTO cho Answer. AnswerDto lộ IsCorrect (dùng cho chủ sở hữu quản lý Question Bank);
// AnswerOptionDto ẩn IsCorrect (dùng khi User đang làm bài — UC08).
using System.ComponentModel.DataAnnotations;

namespace QuizApp.Api.Dtos;

public record AnswerDto(int AnswerId, int QuestionId, string Content, bool IsCorrect);

/// <summary>Answer hiển thị khi đang làm bài — không bao giờ lộ IsCorrect.</summary>
public record AnswerOptionDto(int AnswerId, string Content);

/// <summary>UC15 – payload thêm/sửa một Answer định nghĩa sẵn.</summary>
public class AnswerRequest
{
    [Required(ErrorMessage = "Content is required.")]
    [StringLength(2000)]
    public string Content { get; set; } = string.Empty;

    public bool IsCorrect { get; set; }
}
