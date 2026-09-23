using System.ComponentModel.DataAnnotations;

namespace QuizApp.Api.Dtos;

/// <summary>UC07/UC08 – Quiz trả về cho người làm bài trước khi Submit, KHÔNG lộ đáp án đúng.</summary>
public record AttemptQuestionDto(int QuestionId, string Content, string QuestionType, List<AnswerOptionDto> Options);

public record AttemptContentDto(int AttemptId, int QuizId, string Title, int Duration, List<AttemptQuestionDto> Questions);

/// <summary>Một câu trả lời gửi lên khi Submit Quiz (UC09).</summary>
public class AttemptAnswerRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "QuestionId is required.")]
    public int QuestionId { get; set; }

    public int? AnswerId { get; set; }

    [StringLength(4000)]
    public string? ResponseText { get; set; }
}

public class SubmitAttemptRequest
{
    [Required]
    [MinLength(1, ErrorMessage = "At least one answer must be submitted.")]
    public List<AttemptAnswerRequest> Answers { get; set; } = new();
}

/// <summary>UC09 – kết quả ngay sau khi Submit.</summary>
public record SubmitAttemptResultDto(int AttemptId, int QuizId, DateTime SubmittedAt, int? Score, int TotalGradable, int PendingManualReview);

/// <summary>UC10 – View Quiz Result: lộ đáp án đúng và câu trả lời của User để đối chiếu.</summary>
public record AttemptResultAnswerDto(int QuestionId, string Content, string QuestionType,
    List<AnswerDto> Answers, List<int> SelectedAnswerIds, string? ResponseText, bool? IsCorrect);

public record AttemptResultDto(int AttemptId, int QuizId, string Title, DateTime StartedAt,
    DateTime? SubmittedAt, int? Score, List<AttemptResultAnswerDto> Questions);
