namespace QuizApp.Api.Enums;

/// <summary>
/// Loại câu hỏi hỗ trợ trong Quiz Application (SRS 1.4).
/// Lưu dưới dạng string trong cột question_type.
/// </summary>
public enum QuestionType
{
    MultipleChoice,
    SingleChoice,
    TrueFalse,
    FillInTheBlanks,
    ShortAnswer,
    LongAnswer
}

/// <summary>Các quy tắc nghiệp vụ suy ra từ loại câu hỏi.</summary>
public static class QuestionTypeRules
{
    /// <summary>Loại câu hỏi được trả lời bằng cách chọn Answer đã định nghĩa sẵn.</summary>
    public static bool UsesPredefinedAnswers(QuestionType type) =>
        type is QuestionType.MultipleChoice or QuestionType.SingleChoice or QuestionType.TrueFalse;

    /// <summary>Loại câu hỏi chỉ cho phép chọn đúng 1 Answer trong 1 lần trả lời.</summary>
    public static bool AllowsOneSelectionOnly(QuestionType type) =>
        type is QuestionType.SingleChoice or QuestionType.TrueFalse;

    /// <summary>
    /// Kiểm tra một câu hỏi đã "đủ nội dung để làm bài" hay chưa (UC14 bước 3 – A1).
    /// Trả về null nếu hợp lệ, ngược lại trả về lý do.
    /// - Câu có đáp án định nghĩa sẵn: ít nhất 2 đáp án và ít nhất 1 đáp án đúng.
    /// - SingleChoice / TrueFalse: đúng 1 đáp án đúng.
    /// - Câu dạng văn bản: không được có đáp án định nghĩa sẵn.
    /// </summary>
    public static string? ValidateForPlay(QuestionType type, int answerCount, int correctCount)
    {
        if (!UsesPredefinedAnswers(type))
            return answerCount > 0 ? $"must not have predefined answers (type {type})." : null;

        if (answerCount < 2)
            return "needs at least 2 answers.";

        if (correctCount == 0)
            return "has no correct answer.";

        if (AllowsOneSelectionOnly(type) && correctCount > 1)
            return $"must have exactly 1 correct answer (type {type}).";

        return null;
    }
}
