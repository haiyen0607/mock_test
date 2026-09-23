namespace QuizApp.Api.Enums;

/// <summary>
/// Trạng thái nội dung công khai (Quiz / Question), dùng cho UC19/UC20 –
/// Administrator kiểm duyệt nội dung. "Removed" nghĩa là bị gỡ khỏi truy cập
/// công khai nhưng dữ liệu vẫn được giữ lại (soft-delete) để không phá vỡ
/// các Quiz/Attempt đã tồn tại.
/// </summary>
public enum ContentStatus
{
    Active,
    Removed
}
