using Microsoft.EntityFrameworkCore;
using QuizApp.Application.Common;

namespace QuizApp.Infrastructure.Persistence;

/// <summary>Phân trang IQueryable bằng EF Core (đặt ở Infrastructure để tầng Application không phụ thuộc EF Core).</summary>
public static class PagingExtensions
{
    /// <summary>Đếm tổng + lấy 1 trang ngay trong SQL (query phải đã được sắp xếp).</summary>
    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(this IQueryable<T> query, PageQuery paging)
    {
        var page = paging.SafePage;
        var size = paging.SafePageSize;
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * size).Take(size).ToListAsync();
        return new PagedResult<T>(items, page, size, total);
    }
}
