using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Domain.Scoring;

/// <summary>Một dòng trả lời người làm bài gửi lên (giá trị Domain, tách khỏi DTO của API).</summary>
/// <param name="Index">Vị trí trong danh sách gửi lên — dùng trong thông báo lỗi ("answers[i]: ...").</param>
/// <param name="QuestionId">Câu hỏi được trả lời.</param>
/// <param name="AnswerId">Lựa chọn đã chọn (câu trắc nghiệm).</param>
/// <param name="ResponseText">Câu trả lời văn bản (câu tự luận).</param>
public sealed record SubmittedAnswer(int Index, int QuestionId, int? AnswerId, string? ResponseText);

/// <summary>Kết quả của MỘT câu hỏi trong một lượt làm bài, suy ra từ các dòng AttemptAnswer đã chốt.</summary>
public enum QuestionOutcome
{
    Correct,
    Incorrect,
    /// <summary>Câu tự luận có trả lời, đang chờ chủ Quiz chấm (UC09 A3).</summary>
    PendingManualGrading,
    /// <summary>Câu tự luận bỏ trống — không tính vào điểm.</summary>
    Unanswered
}

/// <summary>Trạng thái dùng chung khi kiểm tra cả bài nộp (phát hiện trả lời trùng giữa các dòng).</summary>
public sealed class SubmissionValidationContext
{
    /// <summary>Câu hỏi đã nhận 1 câu trả lời (câu chỉ cho phép 1 lựa chọn / 1 câu trả lời văn bản).</summary>
    public HashSet<int> AnsweredQuestions { get; } = new();

    /// <summary>Cặp (câu hỏi, lựa chọn) đã gặp — chặn gửi trùng 1 lựa chọn.</summary>
    public HashSet<(int QuestionId, int AnswerId)> SeenSelections { get; } = new();
}

/// <summary>
/// Strategy pattern: mỗi nhóm loại câu hỏi có cách kiểm tra câu trả lời, chốt kết quả và đánh giá đúng/sai riêng.
/// Thêm loại câu hỏi mới = thêm 1 class strategy, không phải sửa code chấm điểm (Open/Closed Principle).
/// </summary>
public interface IQuestionScoringStrategy
{
    /// <summary>Các loại câu hỏi strategy này xử lý.</summary>
    IReadOnlyCollection<QuestionType> SupportedTypes { get; }

    /// <summary>Kiểm tra 1 dòng trả lời của <paramref name="question"/>; thêm thông báo lỗi vào <paramref name="errors"/>.</summary>
    void ValidateLine(Question question, SubmittedAnswer line, SubmissionValidationContext context, ICollection<string> errors);

    /// <summary>
    /// Chốt kết quả lúc nộp bài: tạo các dòng AttemptAnswer (kèm IsCorrect) cho câu hỏi từ các dòng đã gửi.
    /// Mọi câu hỏi đều có ít nhất 1 dòng (câu bỏ trống = dòng rỗng) để kết quả không phụ thuộc trạng thái Quiz sau này.
    /// </summary>
    IReadOnlyList<AttemptAnswer> CreateAnswerRows(Question question, IReadOnlyList<SubmittedAnswer> lines);

    /// <summary>Đánh giá kết quả của câu hỏi từ các dòng AttemptAnswer đã chốt.</summary>
    QuestionOutcome Evaluate(IReadOnlyCollection<AttemptAnswer> rows);
}
