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
}
