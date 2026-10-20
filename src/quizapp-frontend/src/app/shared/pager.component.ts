import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Pagination bar for PagedResult lists.
 *
 * <app-pager [page]="page" [pageSize]="pageSize" [total]="total" (pageChange)="load($event)"></app-pager>
 *
 * Hidden when everything fits on one page.
 */
@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="pager" *ngIf="pageCount > 1" aria-label="Phân trang">
      <span class="pager-info tabular">{{ from }}–{{ to }} / {{ total }}</span>
      <div class="pager-buttons">
        <button type="button" class="btn btn-light btn-icon" [disabled]="page <= 1 || disabled"
                (click)="go(page - 1)" aria-label="Trang trước">
          <i class="bi bi-chevron-left" aria-hidden="true"></i>
        </button>
        <ng-container *ngFor="let p of pages">
          <span *ngIf="p === 0" class="pager-gap" aria-hidden="true">…</span>
          <button *ngIf="p !== 0" type="button" class="btn btn-icon tabular"
                  [class.btn-primary]="p === page" [class.btn-light]="p !== page"
                  [attr.aria-current]="p === page ? 'page' : null" [disabled]="disabled"
                  (click)="go(p)" [attr.aria-label]="'Trang ' + p">{{ p }}</button>
        </ng-container>
        <button type="button" class="btn btn-light btn-icon" [disabled]="page >= pageCount || disabled"
                (click)="go(page + 1)" aria-label="Trang sau">
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </nav>
  `,
  styles: [`
    .pager { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.25rem; }
    .pager-info { color: var(--text-2); font-size: 0.85rem; }
    .pager-buttons { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
    .pager-gap { width: 1.5rem; text-align: center; color: var(--text-muted); }
  `]
})
export class PagerComponent {
  @Input() page = 1;
  @Input() pageSize = 20;
  @Input() total = 0;
  @Input() disabled = false;
  @Output() pageChange = new EventEmitter<number>();

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get from(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get to(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  /** Page numbers with 0 as an ellipsis marker: 1 … 4 5 6 … 12 */
  get pages(): number[] {
    const n = this.pageCount;
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    const set = new Set([1, n, this.page - 1, this.page, this.page + 1]);
    const sorted = [...set].filter((p) => p >= 1 && p <= n).sort((a, b) => a - b);
    const out: number[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) out.push(0);
      out.push(p);
    });
    return out;
  }

  go(p: number): void {
    if (p < 1 || p > this.pageCount || p === this.page) return;
    this.pageChange.emit(p);
  }
}
