namespace QuizApp.Application.Common;

/// <summary>Một trang kết quả. Page bắt đầu từ 1; Total = tổng số bản ghi khớp bộ lọc (mọi trang).</summary>
public record PagedResult<T>(List<T> Items, int Page, int PageSize, int Total);

/// <summary>
/// Tham số phân trang/sắp xếp dùng chung, bind từ query string: ?page=1&amp;pageSize=20&amp;sort=newest.
/// Giá trị ngoài khoảng được tự điều chỉnh (page &lt; 1 -> 1, pageSize &gt; 50 -> 50); sort lạ -> newest.
/// </summary>
public class PageQuery
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 50;

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = DefaultPageSize;

    /// <summary>newest | oldest | title (danh sách user: newest | oldest | username).</summary>
    public string? Sort { get; set; }

    public int SafePage => Page < 1 ? 1 : Page;
    public int SafePageSize => PageSize < 1 ? DefaultPageSize : Math.Min(PageSize, MaxPageSize);

    /// <summary>Sort đã chuẩn hoá về chữ thường; null/rỗng -> "newest".</summary>
    public string SortKey => string.IsNullOrWhiteSpace(Sort) ? "newest" : Sort.Trim().ToLowerInvariant();
}
