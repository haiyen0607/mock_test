import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AttemptService } from '../../core/services/attempt.service';
import { AuthService } from '../../core/services/auth.service';
import { AttemptResult, AttemptResultQuestion, usesPredefinedAnswers } from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { extractError } from '../../core/errors';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule, RouterModule, EmptyStateComponent, SkeletonComponent],
  template: `
<div class="page-container-narrow">
  <a routerLink="/quiz/browse" class="back-link">
    <i class="bi bi-arrow-left" aria-hidden="true"></i> Quay lại danh sách
  </a>

  <!-- Loading -->
  <app-skeleton *ngIf="isLoading" variant="detail"></app-skeleton>

  <!-- Error -->
  <div *ngIf="errorMessage" class="surface">
    <app-empty-state tone="danger" icon="bi-exclamation-triangle"
                     title="Không thể tải kết quả" [message]="errorMessage">
      <a routerLink="/quiz/browse" class="btn btn-light"><i class="bi bi-arrow-left" aria-hidden="true"></i> Quay lại danh sách</a>
    </app-empty-state>
  </div>

  <!-- Content -->
  <div *ngIf="result && !isLoading" class="stagger">
    <!-- Score header -->
    <section class="score-card surface">
      <div class="score-ring" [style.--p]="percentage" role="img"
           [attr.aria-label]="gradableCount > 0 ? 'Điểm ' + percentage + ' phần trăm' : 'Đang chờ chấm'">
        <div class="score-inner">
          <span class="score-value tabular">{{ gradableCount > 0 ? percentage : '—' }}<small *ngIf="gradableCount > 0">%</small></span>
          <span class="score-caption">{{ gradableCount > 0 ? 'chính xác' : 'chờ chấm' }}</span>
        </div>
      </div>

      <div class="score-copy">
        <p class="score-eyebrow">Kết quả bài làm</p>
        <h1 class="score-title">{{ result.title }}</h1>
        <p class="verdict">
          <i class="bi" [ngClass]="verdictIcon" aria-hidden="true"></i>
          {{ getScoreMessage(percentage) }}
        </p>
        <p class="submitted">
          <i class="bi bi-calendar-check" aria-hidden="true"></i> Nộp lúc {{ formatDateTime(result.submittedAt) }}
        </p>
      </div>
    </section>

    <!-- Stats -->
    <section class="stats" aria-label="Thống kê">
      <div class="stat-tile">
        <div class="stat-label"><i class="bi bi-check-circle text-success" aria-hidden="true"></i> Đúng</div>
        <div class="stat-value">{{ correctCount }}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-label"><i class="bi bi-x-circle text-danger" aria-hidden="true"></i> Sai</div>
        <div class="stat-value">{{ wrongCount }}</div>
      </div>
      <div *ngIf="pendingCount > 0" class="stat-tile">
        <div class="stat-label"><i class="bi bi-hourglass-split text-warning" aria-hidden="true"></i> Chờ chấm</div>
        <div class="stat-value">{{ pendingCount }}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-label"><i class="bi bi-stopwatch" aria-hidden="true"></i> Thời gian làm</div>
        <div class="stat-value">{{ durationText }}</div>
      </div>
    </section>

    <!-- Actions -->
    <div class="actions">
      <button type="button" class="btn btn-primary btn-lg" (click)="retake()">
        <i class="bi bi-arrow-repeat" aria-hidden="true"></i> {{ isLoggedIn ? 'Làm lại' : 'Làm thử lại' }}
      </button>
      <a class="btn btn-light btn-lg" routerLink="/quiz/browse">
        <i class="bi bi-compass" aria-hidden="true"></i> Về trang khám phá
      </a>
      <button type="button" class="btn btn-light btn-lg" (click)="copyLink()">
        <i class="bi bi-link-45deg" aria-hidden="true"></i> Sao chép liên kết
      </button>
    </div>

    <!-- Guest: answers hidden -->
    <aside *ngIf="result.answersHidden" class="callout surface">
      <span class="icon-tile callout-icon"><i class="bi bi-lock" aria-hidden="true"></i></span>
      <div class="callout-copy">
        <p class="callout-title">Tạo tài khoản để xem đáp án đúng và lưu lịch sử</p>
        <p class="callout-text">Với lượt làm thử, bạn chỉ thấy câu nào đúng hoặc sai.</p>
      </div>
      <a class="btn btn-primary" routerLink="/auth/register" [queryParams]="{ returnUrl: currentUrl }">Tạo tài khoản</a>
    </aside>

    <!-- Review -->
    <section aria-labelledby="review-title">
      <h2 id="review-title" class="section-title">Chi tiết từng câu</h2>

      <div class="review-list">
        <article *ngFor="let q of result.questions; let i = index" class="review-card surface">
          <header class="review-head">
            <span class="q-index tabular">Câu {{ i + 1 }}</span>
            <span *ngIf="q.isCorrect === true" class="chip chip-success"><i class="bi bi-check-lg" aria-hidden="true"></i> Đúng</span>
            <span *ngIf="q.isCorrect === false" class="chip chip-danger"><i class="bi bi-x-lg" aria-hidden="true"></i> Sai</span>
            <span *ngIf="isPending(q)" class="chip chip-warning"><i class="bi bi-hourglass-split" aria-hidden="true"></i> Chờ chấm</span>
            <span *ngIf="q.isCorrect === null && !isPending(q)" class="chip"><i class="bi bi-dash-circle" aria-hidden="true"></i> Bỏ trống</span>
          </header>

          <h3 class="review-question">{{ q.content }}</h3>

          <!-- Choice questions -->
          <ng-container *ngIf="hasOptions(q)">
            <ul class="answer-list">
              <li *ngFor="let a of q.answers; let j = index"
                  class="answer"
                  [class.is-correct]="!result.answersHidden && a.isCorrect === true"
                  [class.is-wrong]="!result.answersHidden && a.isCorrect !== true && isSelected(q, a.answerId)"
                  [class.is-picked]="result.answersHidden && isSelected(q, a.answerId)">
                <span class="answer-letter" aria-hidden="true">{{ letter(j) }}</span>
                <span class="answer-text">{{ a.content }}</span>
                <span *ngIf="isSelected(q, a.answerId)" class="answer-tag">Bạn chọn</span>
                <ng-container *ngIf="!result.answersHidden">
                  <i *ngIf="a.isCorrect === true" class="bi bi-check-circle-fill answer-icon" role="img" aria-label="Đáp án đúng"></i>
                  <i *ngIf="a.isCorrect !== true && isSelected(q, a.answerId)" class="bi bi-x-circle-fill answer-icon" role="img" aria-label="Lựa chọn sai"></i>
                </ng-container>
              </li>
            </ul>
            <p *ngIf="q.selectedAnswerIds.length === 0" class="note">
              <i class="bi bi-dash-circle" aria-hidden="true"></i> Bạn đã bỏ trống câu này
            </p>
          </ng-container>

          <!-- Text questions -->
          <ng-container *ngIf="!hasOptions(q)">
            <p class="response-label">Bạn trả lời</p>
            <div class="response" [class.empty]="!q.responseText">{{ q.responseText || 'Để trống' }}</div>
            <p *ngIf="isPending(q)" class="note">
              <i class="bi bi-hourglass-split" aria-hidden="true"></i> Đang chờ chấm thủ công
            </p>
          </ng-container>
        </article>

        <div *ngIf="result.questions.length === 0" class="surface">
          <app-empty-state tone="neutral" icon="bi-card-list" [compact]="true"
                           title="Không có dữ liệu câu trả lời"></app-empty-state>
        </div>
      </div>
    </section>
  </div>
</div>
  `,
  styles: [
    `
      .stagger > * + * { margin-top: 1.25rem; }

      /* Score header */
      .score-card {
        display: flex; align-items: center; gap: 1.75rem;
        padding: 1.75rem;
        box-shadow: var(--shadow-sm);
      }
      @media (max-width: 575.98px) {
        .score-card { flex-direction: column; text-align: center; padding: 1.5rem 1.25rem; }
        .verdict, .submitted { justify-content: center; }
      }

      .score-ring {
        --p: 0;
        flex-shrink: 0;
        width: 148px; height: 148px;
        border-radius: 50%;
        background: conic-gradient(var(--brand-500) calc(var(--p) * 1%), var(--surface-3) 0);
        display: grid; place-items: center;
      }
      .score-inner {
        width: calc(100% - 22px); height: calc(100% - 22px);
        border-radius: 50%;
        background: var(--surface);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
      }
      .score-value {
        font-family: var(--font-display); font-weight: 800;
        font-size: 2.6rem; line-height: 1; color: var(--text);
        letter-spacing: -0.02em;
      }
      .score-value small { font-size: 1.1rem; font-weight: 800; color: var(--text-2); margin-left: 1px; }
      .score-caption { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-top: 0.25rem; }

      .score-copy { min-width: 0; }
      .score-eyebrow { margin: 0 0 0.25rem; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
      .score-title { font-size: clamp(1.35rem, 1.1rem + 1vw, 1.75rem); margin: 0 0 0.6rem; }
      .verdict { display: flex; align-items: center; gap: 0.45rem; font-weight: 700; font-size: 1.05rem; color: var(--brand-600); margin: 0 0 0.5rem; }
      .submitted { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--text-2); margin: 0; }

      /* Stats */
      .stats { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
      .stats .stat-label { display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.25rem; }

      /* Actions */
      .actions { display: flex; flex-wrap: wrap; gap: 0.6rem; }

      /* Review */
      .review-list { display: flex; flex-direction: column; gap: 0.9rem; }
      .review-card { padding: 1.25rem 1.35rem; }
      .review-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.6rem; }
      .q-index { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); }
      .review-question { font-size: 1.05rem; font-weight: 800; line-height: 1.45; margin: 0 0 1rem; white-space: pre-line; }

      .answer-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
      .answer {
        display: flex; align-items: center; gap: 0.75rem;
        padding: 0.65rem 0.85rem;
        border-radius: var(--radius-input);
        border: 1.5px solid var(--border);
        background: var(--surface);
        color: var(--text);
      }
      .answer-letter {
        flex-shrink: 0;
        width: 1.8rem; height: 1.8rem;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: var(--radius-pill);
        background: var(--surface-2);
        color: var(--text-2);
        font-family: var(--font-display); font-weight: 800; font-size: 0.8rem;
      }
      .answer-text { flex: 1; min-width: 0; font-weight: 500; line-height: 1.45; }
      .answer-tag {
        flex-shrink: 0;
        font-size: 0.72rem; font-weight: 700;
        padding: 0.15rem 0.55rem;
        border-radius: var(--radius-pill);
        background: var(--surface);
        border: 1px solid currentColor;
        color: var(--text-2);
      }
      .answer-icon { flex-shrink: 0; font-size: 1.1rem; }

      .answer.is-correct { background: var(--success-soft); border-color: color-mix(in srgb, var(--success) 35%, transparent); }
      .answer.is-correct .answer-letter { background: var(--success); color: var(--surface); }
      .answer.is-correct .answer-icon, .answer.is-correct .answer-tag { color: var(--success); }
      .answer.is-wrong { background: var(--danger-soft); border-color: color-mix(in srgb, var(--danger) 35%, transparent); }
      .answer.is-wrong .answer-letter { background: var(--danger); color: var(--surface); }
      .answer.is-wrong .answer-icon, .answer.is-wrong .answer-tag { color: var(--danger); }

      .response-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin: 0 0 0.35rem; }
      .response {
        padding: 0.8rem 1rem;
        border-radius: var(--radius-input);
        background: var(--surface-2);
        color: var(--text);
        white-space: pre-line;
      }
      .response.empty { color: var(--text-muted); font-style: italic; }

      .answer.is-picked { background: var(--brand-soft); border-color: var(--brand-300); }
      .answer.is-picked .answer-tag { color: var(--brand-soft-text); }

      /* Guest callout */
      .callout {
        display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
        padding: 1.1rem 1.25rem;
        background: var(--brand-soft);
        border-color: transparent;
      }
      .callout-icon { background: var(--surface); flex-shrink: 0; }
      .callout-copy { flex: 1; min-width: 12rem; }
      .callout-title { margin: 0; font-weight: 700; color: var(--text); }
      .callout-text { margin: 0.15rem 0 0; font-size: 0.85rem; color: var(--text-2); }

      .note { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--text-2); margin: 0.75rem 0 0; }
    `
  ]
})
export class ResultComponent implements OnInit, OnDestroy {
  private dialog = inject(DialogService);
  result: AttemptResult | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  isLoggedIn = false;

  // Số liệu lấy từ API (correctCount / maxScore / pendingCount / score)
  correctCount = 0;
  gradableCount = 0; // maxScore: số câu đã được chấm
  pendingCount = 0;  // số câu tự luận chờ chấm thủ công
  percentage = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private attemptService: AttemptService,
    private authService: AuthService
  ) {
    this.isLoggedIn = this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const attemptId = parseInt(params['id'], 10);
      this.loadResult(attemptId);
    });
  }

  loadResult(attemptId: number): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.attemptService
      .getResult(attemptId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.result = data;
          this.computeStats(data);
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = extractError(err, 'Không thể tải kết quả.');
          console.error(err);
        }
      });
  }

  private computeStats(result: AttemptResult): void {
    this.correctCount = result.correctCount;
    this.gradableCount = result.maxScore;
    this.pendingCount = result.pendingCount;
    this.percentage = result.score ?? 0;
  }

  get currentUrl(): string {
    return this.router.url;
  }

  hasOptions(q: AttemptResultQuestion): boolean {
    return usesPredefinedAnswers(q.questionType);
  }

  /** Câu tự luận có trả lời nhưng chưa được chấm */
  isPending(q: AttemptResultQuestion): boolean {
    return q.isCorrect === null && !this.hasOptions(q) && !!q.responseText?.trim();
  }

  /** Làm lại: vào thẳng trang làm bài, trang đó bắt đầu lượt mới (guest dùng lượt làm thử) */
  retake(): void {
    if (!this.result) return;
    try {
      // Cùng khóa với AttemptComponent (activeAttemptKey)
      sessionStorage.removeItem(`quizapp-active-attempt-${this.result.quizId}`);
    } catch {
      /* bỏ qua */
    }
    this.router.navigate(['/quiz/attempt', this.result.quizId]);
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(location.href);
      this.dialog.toast('Đã sao chép liên kết kết quả.');
    } catch {
      this.dialog.toast('Không sao chép được liên kết. Hãy sao chép từ thanh địa chỉ.', 'danger');
    }
  }

  getScoreMessage(percentage: number): string {
    if (this.gradableCount === 0) return 'Bài của bạn đang chờ chấm thủ công';
    if (percentage >= 90) return 'Tuyệt vời, bạn nắm bài rất chắc';
    if (percentage >= 80) return 'Tốt lắm';
    if (percentage >= 70) return 'Khá tốt';
    if (percentage >= 50) return 'Cần cải thiện thêm';
    return 'Tiếp tục cố gắng nhé';
  }

  formatDateTime(date: string | null): string {
    return date ? new Date(date).toLocaleString('vi-VN') : '-';
  }

  // ===== Presentational helpers =====

  get wrongCount(): number {
    return Math.max(this.gradableCount - this.correctCount, 0);
  }

  get verdictIcon(): string {
    if (this.gradableCount === 0) return 'bi-hourglass-split';
    if (this.percentage >= 80) return 'bi-stars';
    if (this.percentage >= 50) return 'bi-graph-up-arrow';
    return 'bi-lightning-charge';
  }

  /** Thời gian làm bài (startedAt → submittedAt) */
  get durationText(): string {
    if (!this.result?.submittedAt || !this.result.startedAt) return '—';
    const ms = new Date(this.result.submittedAt).getTime() - new Date(this.result.startedAt).getTime();
    if (!isFinite(ms) || ms < 0) return '—';
    const total = Math.round(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + s.toString().padStart(2, '0');
  }

  isSelected(q: AttemptResultQuestion, answerId: number): boolean {
    return q.selectedAnswerIds.includes(answerId);
  }

  letter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
