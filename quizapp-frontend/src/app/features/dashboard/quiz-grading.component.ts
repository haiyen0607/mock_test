// "Chấm bài" – chủ quiz chấm các câu trả lời văn bản (GET /quizzes/{id}/grading, PUT /attempt-answers/{id}/grade)

import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QuizService } from '../../core/services/quiz.service';
import { DialogService } from '../../core/services/dialog.service';
import { GradeResult, GradingItem } from '../../core/models';
import { extractError } from '../../core/errors';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { PagerComponent } from '../../shared/pager.component';

type GradingTab = 'pending' | 'all';

@Component({
  selector: 'app-quiz-grading',
  standalone: true,
  imports: [CommonModule, RouterModule, EmptyStateComponent, SkeletonComponent, PagerComponent],
  template: `
    <div class="page-container animate-fade-up">
      <a routerLink="/dashboard/my-quizzes" class="back-link">
        <i class="bi bi-arrow-left" aria-hidden="true"></i> Quiz của tôi
      </a>

      <header class="page-header">
        <div class="min-w-0">
          <h1>Chấm bài</h1>
          <p class="page-subtitle">
            <ng-container *ngIf="quizTitle; else noTitle">{{ quizTitle }}</ng-container>
            <ng-template #noTitle>Chấm các câu trả lời điền chỗ trống, trả lời ngắn và tự luận.</ng-template>
          </p>
        </div>
        <a class="btn btn-light" [routerLink]="['/dashboard/quiz-stats', quizId]">
          <i class="bi bi-graph-up me-1" aria-hidden="true"></i>Thống kê
        </a>
      </header>

      <div class="seg" role="tablist" aria-label="Lọc câu trả lời">
        <button type="button" role="tab" [class.active]="tab === 'pending'" [attr.aria-selected]="tab === 'pending'"
                (click)="switchTab('pending')">
          <i class="bi bi-hourglass-split" aria-hidden="true"></i>Chờ chấm
          <span *ngIf="tab === 'pending' && !isLoading && !errorMessage" class="seg-count tabular">{{ total }}</span>
        </button>
        <button type="button" role="tab" [class.active]="tab === 'all'" [attr.aria-selected]="tab === 'all'"
                (click)="switchTab('all')">
          <i class="bi bi-check2-all" aria-hidden="true"></i>Tất cả, gồm đã chấm
        </button>
      </div>

      <app-skeleton *ngIf="isLoading" variant="list" [count]="4"></app-skeleton>

      <div *ngIf="!isLoading && errorMessage" class="surface">
        <app-empty-state tone="danger" icon="bi-exclamation-triangle"
                         title="Không thể tải bài cần chấm" [message]="errorMessage">
          <button type="button" class="btn btn-primary" (click)="load(page)">
            <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
          </button>
          <a class="btn btn-light" routerLink="/dashboard/my-quizzes">Quiz của tôi</a>
        </app-empty-state>
      </div>

      <div *ngIf="!isLoading && !errorMessage && items.length === 0" class="surface">
        <app-empty-state *ngIf="tab === 'pending'" icon="bi-check2-circle" title="Không còn bài nào chờ chấm"
                         message="Mọi câu trả lời văn bản của quiz này đều đã được chấm.">
          <button type="button" class="btn btn-light" (click)="switchTab('all')">Xem bài đã chấm</button>
        </app-empty-state>
        <app-empty-state *ngIf="tab === 'all'" tone="neutral" icon="bi-inbox" title="Chưa có câu trả lời văn bản"
                         message="Khi người học nộp bài có câu điền chỗ trống, trả lời ngắn hoặc tự luận, câu trả lời sẽ hiện ở đây.">
        </app-empty-state>
      </div>

      <ng-container *ngIf="!isLoading && !errorMessage && items.length > 0">
        <div class="grading-list stagger">
          <article *ngFor="let it of items; trackBy: trackById" class="surface grading-card">
            <div class="grading-head">
              <span class="chip chip-brand">
                <i class="bi" [ngClass]="typeIcon(it.questionType)" aria-hidden="true"></i>{{ typeLabel(it.questionType) }}
              </span>
              <span *ngIf="it.isCorrect === null" class="chip chip-warning">
                <i class="bi bi-hourglass-split" aria-hidden="true"></i>Chờ chấm
              </span>
              <span *ngIf="it.isCorrect === true" class="chip chip-success">
                <i class="bi bi-check-lg" aria-hidden="true"></i>Đúng
              </span>
              <span *ngIf="it.isCorrect === false" class="chip chip-danger">
                <i class="bi bi-x-lg" aria-hidden="true"></i>Sai
              </span>
            </div>

            <h2 class="question">{{ it.questionContent }}</h2>

            <div class="learner tabular">
              <span><i class="bi bi-person" aria-hidden="true"></i>{{ it.username }}</span>
              <span><i class="bi bi-calendar-check" aria-hidden="true"></i>Nộp lúc {{ formatDateTime(it.submittedAt) }}</span>
            </div>

            <div class="response" [attr.aria-label]="'Câu trả lời của ' + it.username">{{ it.responseText }}</div>

            <div class="grading-actions">
              <button type="button" class="btn btn-success btn-sm" [disabled]="busyId !== null"
                      (click)="grade(it, true)"
                      [attr.aria-label]="'Chấm đúng câu trả lời của ' + it.username">
                <span *ngIf="busyId === it.attemptAnswerId && busyValue === true" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                <i *ngIf="!(busyId === it.attemptAnswerId && busyValue === true)" class="bi bi-check-lg me-1" aria-hidden="true"></i>Đúng
              </button>
              <button type="button" class="btn btn-outline-danger btn-sm" [disabled]="busyId !== null"
                      (click)="grade(it, false)"
                      [attr.aria-label]="'Chấm sai câu trả lời của ' + it.username">
                <span *ngIf="busyId === it.attemptAnswerId && busyValue === false" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                <i *ngIf="!(busyId === it.attemptAnswerId && busyValue === false)" class="bi bi-x-lg me-1" aria-hidden="true"></i>Sai
              </button>
            </div>
          </article>
        </div>

        <app-pager [page]="page" [pageSize]="pageSize" [total]="total" [disabled]="busyId !== null"
                   (pageChange)="load($event)"></app-pager>
      </ng-container>
    </div>
  `,
  styles: [`
    .min-w-0 { min-width: 0; }
    .page-subtitle { overflow-wrap: anywhere; }

    .seg {
      display: inline-flex; gap: 2px; padding: 3px; margin-bottom: 1.25rem;
      background: var(--surface-2); border-radius: var(--radius-pill);
      max-width: 100%;
    }
    .seg button {
      border: 0; background: transparent; color: var(--text-2);
      border-radius: var(--radius-pill); padding: 0.45rem 0.95rem;
      font-size: 0.88rem; font-weight: 600;
      display: inline-flex; align-items: center; gap: 0.4rem; white-space: nowrap;
      transition: background-color var(--transition), color var(--transition);
    }
    .seg button:hover { color: var(--text); }
    .seg button.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
    .seg-count {
      min-width: 1.4rem; padding: 0 0.4rem; border-radius: var(--radius-pill);
      background: var(--brand-soft); color: var(--brand-soft-text); font-size: 0.75rem; text-align: center;
    }

    .grading-list { display: flex; flex-direction: column; gap: 0.9rem; }
    .grading-card { padding: 1.15rem 1.25rem; }
    .grading-head { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.6rem; }
    .question { font-size: 1rem; font-weight: 700; margin: 0 0 0.45rem; white-space: pre-wrap; overflow-wrap: anywhere; }
    .learner {
      display: flex; flex-wrap: wrap; gap: 0.25rem 1rem;
      color: var(--text-muted); font-size: 0.82rem; font-weight: 500; margin-bottom: 0.75rem;
    }
    .learner i { margin-right: 0.35rem; }
    .response {
      white-space: pre-wrap; overflow-wrap: anywhere;
      background: var(--surface-2); color: var(--text);
      border-radius: var(--radius-sm); padding: 0.8rem 0.95rem;
      font-size: 0.93rem; line-height: 1.55;
      max-height: 22rem; overflow-y: auto;
    }
    .grading-actions {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
      margin-top: 0.9rem;
    }
    .grading-actions .btn-success, .grading-actions .btn-outline-danger { min-width: 5.5rem; }

    @media (max-width: 400px) {
      .seg { display: flex; width: 100%; }
      .seg button { flex: 1; justify-content: center; padding: 0.45rem 0.5rem; font-size: 0.8rem; }
      .grading-card { padding: 1rem; }
      .grading-actions .btn-success, .grading-actions .btn-outline-danger { flex: 1; }
    }
  `]
})
export class QuizGradingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private quizService = inject(QuizService);
  private dialog = inject(DialogService);
  private destroyRef = inject(DestroyRef);

  readonly pageSize = 10;
  quizId = 0;
  quizTitle: string | null = null;
  tab: GradingTab = 'pending';
  items: GradingItem[] = [];
  page = 1;
  total = 0;
  isLoading = false;
  errorMessage: string | null = null;
  busyId: number | null = null;
  busyValue: boolean | null = null;

  ngOnInit(): void {
    this.quizId = Number(this.route.snapshot.paramMap.get('id'));
    // Tên quiz chỉ để hiển thị; lỗi quyền/không tồn tại được báo qua danh sách chấm.
    this.quizService
      .getQuizDetail(this.quizId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (q) => (this.quizTitle = q.title), error: () => {} });
    this.load(1);
  }

  switchTab(tab: GradingTab): void {
    if (this.tab === tab && !this.errorMessage) return;
    this.tab = tab;
    this.load(1);
  }

  load(page: number): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.quizService
      .getGrading(this.quizId, {
        page,
        pageSize: this.pageSize,
        sort: 'oldest',
        includeGraded: this.tab === 'all'
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
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
          this.errorMessage = extractError(err, 'Không thể tải danh sách câu trả lời.');
        }
      });
  }

  grade(item: GradingItem, isCorrect: boolean): void {
    if (this.busyId !== null) return;
    this.busyId = item.attemptAnswerId;
    this.busyValue = isCorrect;
    this.quizService
      .gradeAnswer(item.attemptAnswerId, isCorrect)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.busyId = null;
          this.busyValue = null;
          this.dialog.toast(this.toastMessage(item.username, res), 'success');
          if (this.tab === 'pending') {
            this.items = this.items.filter((i) => i.attemptAnswerId !== item.attemptAnswerId);
            this.total = Math.max(0, this.total - 1);
            // Trang hiện tại đã chấm hết nhưng vẫn còn bài ở trang khác → tải lại.
            if (this.items.length === 0 && this.total > 0) this.load(Math.min(this.page, Math.ceil(this.total / this.pageSize)));
          } else {
            item.isCorrect = isCorrect;
          }
        },
        error: (err) => {
          this.busyId = null;
          this.busyValue = null;
          this.dialog.toast(extractError(err, 'Chấm bài thất bại.'), 'danger');
        }
      });
  }

  private toastMessage(username: string, res: GradeResult): string {
    const score = res.score === null ? 'chưa có điểm' : 'điểm ' + res.score + '% (' + res.correctCount + '/' + res.maxScore + ')';
    const pending = res.pendingCount > 0 ? ', còn ' + res.pendingCount + ' câu chờ chấm' : '';
    return 'Đã chấm. Bài của ' + username + ': ' + score + pending + '.';
  }

  trackById(_: number, it: GradingItem): number {
    return it.attemptAnswerId;
  }

  formatDateTime(date: string | null): string {
    return date
      ? new Date(date).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
      : '-';
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
