using Microsoft.EntityFrameworkCore;

namespace QuizApp.Application.Common;

/// <summary>Phân trang IQueryable bằng EF Core: đếm tổng + lấy 1 trang ngay trong SQL.</summary>
public static class PagingExtensions
{
    /// <summary>Đếm tổng + lấy 1 trang ngay trong SQL (query phải đã được sắp xếp).</summary>
    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(this IQueryable<T> query, PageQuery paging,
        CancellationToken ct = default)
    {
        var page = paging.SafePage;
        var size = paging.SafePageSize;
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return new PagedResult<T>(items, page, size, total);
    }
}
