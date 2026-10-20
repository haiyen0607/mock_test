using System.ComponentModel.DataAnnotations;

namespace QuizApp.Application.Dtos;

/// <summary>UC07/UC08 – Quiz trả về cho người làm bài trước khi Submit, KHÔNG lộ đáp án đúng.</summary>
public record AttemptQuestionDto(int QuestionId, string Content, string QuestionType, List<AnswerOptionDto> Options);

/// <summary>
/// UC07/UC08 – nội dung lượt làm bài. Duration là thời lượng đã chốt lúc bắt đầu;
/// StartedAt/ExpiresAt (UTC) để client khôi phục đúng đồng hồ đếm ngược khi tải lại trang.
/// </summary>
public record AttemptContentDto(int AttemptId, int QuizId, string Title, int Duration,
    DateTime StartedAt, DateTime ExpiresAt, List<AttemptQuestionDto> Questions);

/// <summary>Một câu trả lời gửi lên khi Submit Quiz (UC09).</summary>
public class AttemptAnswerRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "QuestionId is required.")]
    public int QuestionId { get; set; }

    public int? AnswerId { get; set; }

    [StringLength(4000)]
    public string? ResponseText { get; set; }
}

/// <summary>
/// UC09 – nộp bài. Cho phép danh sách rỗng (nộp bài trắng -> 0 điểm; UC09 A1 chỉ cảnh báo phía client, không chặn).
/// </summary>
public class SubmitAttemptRequest
{
    [Required]
    [MaxLength(200, ErrorMessage = "Too many answers in one submission.")]
    public List<AttemptAnswerRequest> Answers { get; set; } = new();
}

/// <summary>UC09 – kết quả ngay sau khi Submit. Score = phần trăm (0–100), TotalGradable = số câu được chấm.</summary>
public record SubmitAttemptResultDto(int AttemptId, int QuizId, DateTime SubmittedAt, int? Score, int TotalGradable,
    int PendingManualReview, int CorrectCount);

/// <summary>
/// Lựa chọn của 1 câu hỏi trong màn kết quả (UC10). IsCorrect = null khi đáp án bị ẩn
/// (lượt trial của Guest – chỉ được xem điểm, không được xem đáp án đúng).
/// </summary>
public record ResultAnswerOptionDto(int AnswerId, int QuestionId, string Content, bool? IsCorrect);

/// <summary>
/// UC10 – 1 câu hỏi trong kết quả. IsCorrect = kết quả câu trả lời của người làm bài
/// (true/false; null = câu tự luận chờ chấm hoặc bỏ trống) — luôn trả về, kể cả khi AnswersHidden.
/// </summary>
public record AttemptResultAnswerDto(int QuestionId, string Content, string QuestionType,
    List<ResultAnswerOptionDto> Answers, List<int> SelectedAnswerIds, string? ResponseText, bool? IsCorrect);

/// <summary>
/// UC10 – View Quiz Result. AnswersHidden = true với lượt trial của Guest: Answers[].IsCorrect luôn null.
/// Score = phần trăm (0–100); CorrectCount / MaxScore = số câu đúng / số câu đã chấm; PendingCount = câu tự luận chờ chấm.
/// </summary>
public record AttemptResultDto(int AttemptId, int QuizId, string Title, DateTime StartedAt,
    DateTime? SubmittedAt, int? Score, List<AttemptResultAnswerDto> Questions,
    bool AnswersHidden, int CorrectCount, int MaxScore, int PendingCount);

/// <summary>A5 – 1 dòng trong "Bài đã làm" (GET api/attempts/mine).</summary>
public record AttemptHistoryItemDto(int AttemptId, int QuizId, string QuizTitle, bool QuizDeleted,
    DateTime StartedAt, DateTime? SubmittedAt, int? Score, int CorrectCount, int MaxScore, int PendingCount);

/// <summary>A5 – 1 câu trả lời văn bản cần chủ Quiz chấm thủ công (UC09 A3).</summary>
public record GradingItemDto(int AttemptAnswerId, int AttemptId, int QuestionId, string QuestionContent,
    string QuestionType, string ResponseText, string Username, DateTime SubmittedAt, bool? IsCorrect);

/// <summary>A5 – body của PUT api/attempt-answers/{id}/grade.</summary>
public class GradeAnswerRequest
{
    [Required(ErrorMessage = "IsCorrect is required.")]
    public bool? IsCorrect { get; set; }
}

/// <summary>A5 – điểm của lượt làm bài sau khi chấm lại.</summary>
public record GradeResultDto(int AttemptId, int? Score, int CorrectCount, int MaxScore, int PendingCount);

/// <summary>A5 – thống kê 1 câu hỏi của Quiz (chỉ lượt đã nộp, không tính trial).</summary>
public record QuestionStatDto(int QuestionId, string Content, string QuestionType,
    int AnsweredCount, int CorrectCount, double CorrectRatePercent);

/// <summary>A5 – thống kê Quiz cho chủ sở hữu/Admin (GET api/quizzes/{id}/stats).</summary>
public record QuizStatsDto(int AttemptCount, int UniqueUsers, double AverageScorePercent,
    int PendingGradingCount, List<QuestionStatDto> Questions);
