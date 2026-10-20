// "Bài đã làm" – lịch sử các lượt làm bài đã nộp (GET /api/attempts/mine)

import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AttemptService } from '../../core/services/attempt.service';
import { AttemptHistoryItem } from '../../core/models';
import { extractError } from '../../core/errors';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { PagerComponent } from '../../shared/pager.component';

@Component({
  selector: 'app-attempt-history',
  standalone: true,
  imports: [CommonModule, RouterModule, EmptyStateComponent, SkeletonComponent, PagerComponent],
  template: `
    <div class="page-container animate-fade-up">
      <header class="page-header">
        <div>
          <h1>Bài đã làm</h1>
          <p class="page-subtitle">Các lượt làm bài bạn đã nộp, kèm điểm và trạng thái chấm.</p>
        </div>
      </header>

      <app-skeleton *ngIf="isLoading" variant="list" [count]="5"></app-skeleton>

      <div *ngIf="!isLoading && errorMessage" class="surface">
        <app-empty-state tone="danger" icon="bi-exclamation-triangle"
                         title="Không thể tải lịch sử làm bài" [message]="errorMessage">
          <button type="button" class="btn btn-primary" (click)="load(page)">
            <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
          </button>
        </app-empty-state>
      </div>

      <div *ngIf="!isLoading && !errorMessage && total === 0" class="surface">
        <app-empty-state icon="bi-clock-history" title="Bạn chưa làm bài nào"
                         message="Chọn một quiz để bắt đầu. Kết quả các lần làm bài sẽ được lưu ở đây.">
          <a class="btn btn-primary" routerLink="/quiz/browse">
            <i class="bi bi-compass me-1" aria-hidden="true"></i>Khám phá quiz
          </a>
        </app-empty-state>
      </div>

      <ng-container *ngIf="!isLoading && !errorMessage && total > 0">
        <ul class="history-list stagger" aria-label="Danh sách bài đã làm">
          <li *ngFor="let a of items; trackBy: trackById" class="history-row">
            <div class="mini-ring" [style.--p]="a.score ?? 0" [class.is-pending]="a.score === null" role="img"
                 [attr.aria-label]="a.score === null ? 'Chưa có điểm' : 'Điểm ' + a.score + ' phần trăm'">
              <span class="mini-ring-inner tabular">
                <ng-container *ngIf="a.score !== null; else noScore">{{ a.score }}<small>%</small></ng-container>
                <ng-template #noScore>—</ng-template>
              </span>
            </div>

            <div class="history-main">
              <div class="history-title-row">
                <h2 class="history-title" [class.is-deleted]="a.quizDeleted">{{ a.quizTitle }}</h2>
                <span *ngIf="a.quizDeleted" class="chip chip-outline">
                  <i class="bi bi-trash3" aria-hidden="true"></i>Quiz đã xóa
                </span>
                <span *ngIf="a.pendingCount > 0" class="chip chip-warning">
                  <i class="bi bi-hourglass-split" aria-hidden="true"></i>{{ a.pendingCount }} câu chờ chấm
                </span>
              </div>
              <div class="history-meta tabular">
                <span><i class="bi bi-calendar-check" aria-hidden="true"></i>{{ formatDateTime(a.submittedAt ?? a.startedAt) }}</span>
                <span *ngIf="a.maxScore > 0"><i class="bi bi-check2-circle" aria-hidden="true"></i>Đúng {{ a.correctCount }}/{{ a.maxScore }} câu</span>
              </div>
            </div>

            <div class="history-actions">
              <a class="btn btn-light btn-sm" [routerLink]="['/quiz/result', a.attemptId]">
                <i class="bi bi-bar-chart-line me-1" aria-hidden="true"></i>Xem kết quả
              </a>
              <a *ngIf="!a.quizDeleted" class="btn btn-outline-primary btn-sm" [routerLink]="['/quiz/detail', a.quizId]"
                 [attr.aria-label]="'Làm lại quiz ' + a.quizTitle">
                <i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>Làm lại
              </a>
            </div>
          </li>
        </ul>

        <app-pager [page]="page" [pageSize]="pageSize" [total]="total" [disabled]="isLoading"
                   (pageChange)="load($event)"></app-pager>
      </ng-container>
    </div>
  `,
  styles: [`
    .history-list {
      list-style: none; margin: 0; padding: 0;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card);
      overflow: hidden;
    }
    .history-row {
      display: flex; align-items: center; gap: 1rem;
      padding: 1rem 1.15rem;
      border-bottom: 1px solid var(--border);
    }
    .history-row:last-child { border-bottom: 0; }

    .mini-ring {
      --p: 0;
      flex-shrink: 0;
      width: 52px; height: 52px; border-radius: 50%;
      background: conic-gradient(var(--brand-500) calc(var(--p) * 1%), var(--surface-3) 0);
      display: grid; place-items: center;
    }
    .mini-ring.is-pending { background: var(--surface-3); }
    .mini-ring-inner {
      width: 42px; height: 42px; border-radius: 50%;
      background: var(--surface);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-weight: 800; font-size: 0.9rem; color: var(--text);
    }
    .mini-ring-inner small { font-size: 0.6rem; color: var(--text-2); margin-left: 1px; }
    .mini-ring.is-pending .mini-ring-inner { color: var(--text-muted); }

    .history-main { flex: 1; min-width: 0; }
    .history-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.6rem; }
    .history-title {
      font-size: 1rem; font-weight: 700; margin: 0;
      overflow-wrap: anywhere;
    }
    .history-title.is-deleted { color: var(--text-muted); }
    .history-meta {
      display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin-top: 0.3rem;
      color: var(--text-muted); font-size: 0.82rem; font-weight: 500;
    }
    .history-meta i { margin-right: 0.35rem; }

    .history-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; flex-shrink: 0; }

    @media (max-width: 575.98px) {
      .history-row { flex-wrap: wrap; align-items: flex-start; }
      .history-main { flex-basis: calc(100% - 52px - 1rem); }
      .history-actions { width: 100%; padding-left: calc(52px + 1rem); }
    }
    @media (max-width: 400px) {
      .history-actions { padding-left: 0; }
      .history-actions .btn { flex: 1; }
    }
  `]
})
export class AttemptHistoryComponent implements OnInit {
  private attemptService = inject(AttemptService);
  private destroyRef = inject(DestroyRef);

  readonly pageSize = 10;
  items: AttemptHistoryItem[] = [];
  page = 1;
  total = 0;
  isLoading = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.load(1);
  }

  load(page: number): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.attemptService
      .getMyAttempts({ page, pageSize: this.pageSize, sort: 'newest' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          // Trang vượt quá cuối (ví dụ sau khi dữ liệu thay đổi) → quay về trang cuối có dữ liệu.
          if (res.items.length === 0 && res.total > 0 && page > 1) {
            this.load(Math.max(1, Math.ceil(res.total / this.pageSize)));
            return;
          }
          this.items = res.items;
          this.page = res.page;
          this.total = res.total;
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = extractError(err, 'Không thể tải lịch sử làm bài.');
        }
      });
  }

  trackById(_: number, a: AttemptHistoryItem): number {
    return a.attemptId;
  }

  formatDateTime(date: string | null): string {
    return date
      ? new Date(date).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
      : '-';
  }
}
