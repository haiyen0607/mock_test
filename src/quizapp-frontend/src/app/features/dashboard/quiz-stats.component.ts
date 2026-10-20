// "Thống kê quiz" – số liệu lượt làm và tỉ lệ đúng từng câu (GET /quizzes/{id}/stats)

import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QuizService } from '../../core/services/quiz.service';
import { QuestionStat, QuizStats } from '../../core/models';
import { extractError } from '../../core/errors';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';

interface StatRow extends QuestionStat {
  order: number;
}

@Component({
  selector: 'app-quiz-stats',
  standalone: true,
  imports: [CommonModule, RouterModule, EmptyStateComponent, SkeletonComponent],
  template: `
    <div class="page-container animate-fade-up">
      <a routerLink="/dashboard/my-quizzes" class="back-link">
        <i class="bi bi-arrow-left" aria-hidden="true"></i> Quiz của tôi
      </a>

      <header class="page-header">
        <div class="min-w-0">
          <h1>Thống kê quiz</h1>
          <p class="page-subtitle">
            <ng-container *ngIf="quizTitle; else noTitle">{{ quizTitle }}</ng-container>
            <ng-template #noTitle>Số liệu từ các lượt làm bài đã nộp.</ng-template>
          </p>
        </div>
      </header>

      <app-skeleton *ngIf="isLoading" variant="list" [count]="5"></app-skeleton>

      <div *ngIf="!isLoading && errorMessage" class="surface">
        <app-empty-state tone="danger" icon="bi-exclamation-triangle"
                         title="Không thể tải thống kê" [message]="errorMessage">
          <button type="button" class="btn btn-primary" (click)="load()">
            <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
          </button>
          <a class="btn btn-light" routerLink="/dashboard/my-quizzes">Quiz của tôi</a>
        </app-empty-state>
      </div>

      <div *ngIf="!isLoading && !errorMessage && stats && stats.attemptCount === 0" class="surface">
        <app-empty-state icon="bi-bar-chart" title="Chưa có lượt làm bài nào"
                         message="Thống kê sẽ xuất hiện khi có người nộp bài cho quiz này.">
          <a class="btn btn-light" [routerLink]="['/quiz/detail', quizId]">
            <i class="bi bi-eye me-1" aria-hidden="true"></i>Xem trang quiz
          </a>
        </app-empty-state>
      </div>

      <ng-container *ngIf="!isLoading && !errorMessage && stats && stats.attemptCount > 0">
        <section class="stats-row mb-4 stagger" aria-label="Tổng quan">
          <div class="stat-tile">
            <div class="stat-value">{{ stats.attemptCount }}</div>
            <div class="stat-label">Lượt làm</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">{{ stats.uniqueUsers }}</div>
            <div class="stat-label">Người làm</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">{{ pct(stats.averageScorePercent) }}<small>%</small></div>
            <div class="stat-label">Điểm trung bình</div>
          </div>
          <div class="stat-tile" [class.is-pending]="stats.pendingGradingCount > 0">
            <div class="stat-value">{{ stats.pendingGradingCount }}</div>
            <div class="stat-label">
              <a *ngIf="stats.pendingGradingCount > 0; else nonePending" [routerLink]="['/dashboard/quiz-grading', quizId]" class="tile-link">
                Chờ chấm<i class="bi bi-arrow-right ms-1" aria-hidden="true"></i>
              </a>
              <ng-template #nonePending>Chờ chấm</ng-template>
            </div>
          </div>
        </section>

        <div class="table-toolbar">
          <h2 class="section-title m-0">Từng câu hỏi</h2>
          <div class="form-check form-switch m-0">
            <input class="form-check-input" type="checkbox" role="switch" id="sortByRate"
                   [checked]="sortByRate" (change)="sortByRate = !sortByRate">
            <label class="form-check-label" for="sortByRate">Sắp xếp theo tỉ lệ đúng tăng dần</label>
          </div>
        </div>

        <div *ngIf="rows.length === 0" class="surface">
          <app-empty-state [compact]="true" tone="neutral" icon="bi-list-check" title="Quiz chưa có câu hỏi"></app-empty-state>
        </div>

        <div *ngIf="rows.length > 0" class="table-wrap">
          <div class="table-responsive">
            <table class="table align-middle mb-0 stats-table">
              <thead>
                <tr>
                  <th scope="col" class="col-num">#</th>
                  <th scope="col">Câu hỏi</th>
                  <th scope="col" class="col-answered text-end">Đã trả lời</th>
                  <th scope="col" class="col-rate">Tỉ lệ đúng</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of sortedRows; trackBy: trackById">
                  <td class="col-num tabular">{{ r.order }}</td>
                  <td>
                    <div class="q-content" [title]="r.content">{{ r.content }}</div>
                    <span class="chip chip-sm mt-1">
                      <i class="bi" [ngClass]="typeIcon(r.questionType)" aria-hidden="true"></i>{{ typeLabel(r.questionType) }}
                    </span>
                  </td>
                  <td class="col-answered text-end tabular">{{ r.answeredCount }}</td>
                  <td class="col-rate">
                    <div class="rate">
                      <div class="rate-track" role="img"
                           [attr.aria-label]="'Tỉ lệ đúng ' + pct(r.correctRatePercent) + ' phần trăm'">
                        <div class="rate-fill" [ngClass]="rateTone(r.correctRatePercent)"
                             [style.width.%]="clamp(r.correctRatePercent)"></div>
                      </div>
                      <span class="rate-num tabular">{{ pct(r.correctRatePercent) }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .min-w-0 { min-width: 0; }
    .page-subtitle { overflow-wrap: anywhere; }

    .stats-row {
      display: grid; gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
    .stat-value small { font-size: 0.95rem; color: var(--text-2); margin-left: 1px; }
    .stat-tile.is-pending { border-color: color-mix(in srgb, var(--warning) 40%, var(--border)); background: var(--warning-soft); }
    .stat-tile.is-pending .stat-value { color: var(--warning); }
    .tile-link { color: var(--warning); font-weight: 600; text-decoration: none; }
    .tile-link:hover { text-decoration: underline; }

    .table-toolbar {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 0.5rem 1rem; margin-bottom: 0.75rem;
    }
    .form-check-label { font-size: 0.88rem; color: var(--text-2); }

    .stats-table th { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
    .stats-table td { padding-top: 0.85rem; padding-bottom: 0.85rem; }
    .col-num { width: 3rem; color: var(--text-muted); font-weight: 600; }
    .col-answered { width: 6.5rem; }
    .col-rate { width: 14rem; }

    .q-content {
      font-weight: 600; color: var(--text);
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; overflow-wrap: anywhere;
    }
    .chip-sm { font-size: 0.72rem; padding: 0.1rem 0.5rem; }

    .rate { display: flex; align-items: center; gap: 0.6rem; }
    .rate-track { flex: 1; height: 8px; min-width: 60px; background: var(--surface-3); border-radius: var(--radius-pill); overflow: hidden; }
    .rate-fill { height: 100%; border-radius: var(--radius-pill); background: var(--brand-500); transition: width 400ms var(--ease); }
    .rate-fill.is-warn { background: var(--warning); }
    .rate-fill.is-low { background: var(--danger); }
    .rate-num { width: 3.4rem; text-align: right; font-weight: 700; font-size: 0.88rem; color: var(--text); }

    /* Màn hẹp: chuyển bảng thành danh sách thẻ */
    @media (max-width: 575.98px) {
      .stats-table thead { display: none; }
      .stats-table, .stats-table tbody, .stats-table tr, .stats-table td { display: block; width: 100%; }
      .stats-table tr { position: relative; padding: 0.85rem 1rem 0.85rem 2.75rem; border-bottom: 1px solid var(--border); }
      .stats-table tr:last-child { border-bottom: 0; }
      .stats-table td { padding: 0; border: 0; text-align: left !important; }
      .stats-table .col-num { position: absolute; left: 1rem; top: 0.85rem; width: auto; }
      .stats-table .col-answered { margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-muted); }
      .stats-table .col-answered::before { content: 'Đã trả lời: '; }
      .stats-table .col-rate { margin-top: 0.35rem; }
    }
  `]
})
export class QuizStatsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private quizService = inject(QuizService);
  private destroyRef = inject(DestroyRef);

  quizId = 0;
  quizTitle: string | null = null;
  stats: QuizStats | null = null;
  rows: StatRow[] = [];
  sortByRate = false;
  isLoading = false;
  errorMessage: string | null = null;

  get sortedRows(): StatRow[] {
    if (!this.sortByRate) return this.rows;
    return [...this.rows].sort((a, b) => a.correctRatePercent - b.correctRatePercent || a.order - b.order);
  }

  ngOnInit(): void {
    this.quizId = Number(this.route.snapshot.paramMap.get('id'));
    this.quizService
      .getQuizDetail(this.quizId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (q) => (this.quizTitle = q.title), error: () => {} });
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.quizService
      .getStats(this.quizId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.stats = s;
          this.rows = s.questions.map((q, i) => ({ ...q, order: i + 1 }));
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = extractError(err, 'Không thể tải thống kê quiz.');
        }
      });
  }

  rateTone(p: number): string {
    if (p < 30) return 'is-low';
    if (p < 50) return 'is-warn';
    return '';
  }

  /** 62.5 → "62,5"; 60 → "60" */
  pct(p: number): string {
    return (Math.round(p * 10) / 10).toString().replace('.', ',');
  }

  clamp(p: number): number {
    return Math.max(0, Math.min(100, p));
  }

  trackById(_: number, r: StatRow): number {
    return r.questionId;
  }

  typeIcon(type: string): string {
    const map: { [key: string]: string } = {
      MultipleChoice: 'bi-ui-checks',
      SingleChoice: 'bi-ui-radios',
      TrueFalse: 'bi-toggle-on',
      FillInTheBlanks: 'bi-input-cursor-text',
      ShortAnswer: 'bi-chat-left-text',
      LongAnswer: 'bi-text-paragraph'
    };
    return map[type] || 'bi-question-circle';
  }

  typeLabel(type: string): string {
    const map: { [key: string]: string } = {
      MultipleChoice: 'Chọn nhiều',
      SingleChoice: 'Chọn 1',
      TrueFalse: 'Đúng / Sai',
      FillInTheBlanks: 'Điền chỗ trống',
      ShortAnswer: 'Trả lời ngắn',
      LongAnswer: 'Tự luận'
    };
    return map[type] || type;
  }
}
