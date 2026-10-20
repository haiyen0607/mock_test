namespace QuizApp.Domain.Enums;

/// <summary>
/// Trạng thái nội dung (Quiz / Question).
/// - Active  : bình thường.
/// - Removed : Administrator gỡ do vi phạm (UC19/UC20). Dữ liệu vẫn giữ lại, Admin có thể khôi phục.
/// - Deleted : chủ sở hữu đã xoá Question nhưng Question này đã có lịch sử làm bài
///             nên không xoá cứng được (UC17 A4 – giữ nhất quán dữ liệu). Chỉ dùng cho Question,
///             không hiển thị ở bất kỳ đâu và Admin không khôi phục được.
/// Lưu dạng string trong DB nên thêm giá trị mới KHÔNG cần đổi cấu trúc bảng.
/// </summary>
public enum ContentStatus
{
    Active,
    Removed,
    Deleted
}

public static class ContentStatusRules
{
    /// <summary>
    /// Parse trạng thái kiểm duyệt do Admin gửi lên. Chỉ chấp nhận "Active" hoặc "Removed".
    /// (Enum.TryParse một mình sẽ nhận cả chuỗi số như "5" và cả "Deleted" — không được phép.)
    /// </summary>
    public static bool TryParseModeration(string? value, out ContentStatus status)
    {
        status = ContentStatus.Active;
        if (string.IsNullOrWhiteSpace(value) || int.TryParse(value, out _)) return false;
        if (!Enum.TryParse(value.Trim(), ignoreCase: true, out status)) return false;
        return status is ContentStatus.Active or ContentStatus.Removed;
    }
}
