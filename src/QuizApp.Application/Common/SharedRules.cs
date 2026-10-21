using QuizApp.Application.Dtos;
using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Common;

/// <summary>Quy tắc dùng chung giữa nhiều use case (trước đây là static method nằm trong controller).</summary>
public static class SharedRules
{
    /// <summary>
    /// Kiểm tra danh sách Answer gửi kèm khi TẠO / THAY Question (Question Bank và Quiz Questions).
    /// Cho phép danh sách rỗng (User có thể thêm đáp án sau); điều kiện "đủ đáp án" được kiểm tra khi Publish (UC14 A1).
    /// Trả về null nếu hợp lệ, ngược lại là thông báo lỗi.
    /// </summary>
    public static string? ValidateAnswers(QuestionType type, IReadOnlyCollection<AnswerRequest> answers)
    {
        if (answers.Count == 0) return null;

        if (!QuestionTypeRules.UsesPredefinedAnswers(type))
            return $"Question type {type} does not support predefined answers.";

        if (QuestionTypeRules.AllowsOneSelectionOnly(type) && answers.Count(a => a.IsCorrect) > 1)
            return $"Question type {type} allows only one correct answer.";

        return null;
    }

    /// <summary>Sắp xếp danh sách Quiz: newest (mặc định) | oldest | title. Luôn kèm QuizId để phân trang ổn định.</summary>
    public static IQueryable<Quiz> SortQuizzes(this IQueryable<Quiz> query, string sortKey) => sortKey switch
    {
        "oldest" => query.OrderBy(q => q.CreatedAt).ThenBy(q => q.QuizId),
        "title" => query.OrderBy(q => q.Title).ThenBy(q => q.QuizId),
        _ => query.OrderByDescending(q => q.CreatedAt).ThenByDescending(q => q.QuizId)
    };
}
