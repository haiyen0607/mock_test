import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { AuthService } from '../../core/services/auth.service';
import { QuizDetail } from '../../core/models';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { extractError } from '../../core/errors';
import { isAxiosError } from 'axios';

@Component({
  selector: 'app-quiz-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, EmptyStateComponent, SkeletonComponent],
  template: `
    <div class="page-container animate-fade-up">
      <a routerLink="/quiz/browse" class="back-link">
        <i class="bi bi-arrow-left" aria-hidden="true"></i>Quay lại danh sách
      </a>

      <app-skeleton *ngIf="isLoading" variant="detail"></app-skeleton>

      <app-empty-state
        *ngIf="!isLoading && errorMessage"
        [icon]="notFound ? 'bi-journal-x' : 'bi-exclamation-triangle'"
        [tone]="notFound ? 'neutral' : 'danger'"
        [title]="notFound ? 'Quiz không còn khả dụng' : 'Không tải được quiz'"
        [message]="errorMessage">
        <button *ngIf="!notFound" type="button" class="btn btn-primary" (click)="loadQuizDetail()">
          <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
        </button>
        <a routerLink="/quiz/browse" class="btn btn-light">Về danh sách quiz</a>
      </app-empty-state>

      <div *ngIf="quiz && !isLoading" class="detail-grid">
        <div class="main-col">
          <section class="hero surface">
            <span class="icon-tile hero-icon"><i class="bi bi-patch-question" aria-hidden="true"></i></span>
            <h1 class="quiz-title">{{ quiz.title }}</h1>
            <p class="quiz-desc" [class.is-empty]="!quiz.description">{{ quiz.description || 'Chưa có mô tả.' }}</p>

            <div class="stats">
              <div class="stat-tile">
                <div class="stat-label"><i class="bi bi-file-earmark-text me-1" aria-hidden="true"></i>Câu hỏi</div>
                <div class="stat-value">{{ quiz.questions.length }}</div>
              </div>
              <div class="stat-tile">
                <div class="stat-label"><i class="bi bi-stopwatch me-1" aria-hidden="true"></i>Thời gian</div>
                <div class="stat-value">{{ quiz.duration }}<span class="unit">phút</span></div>
              </div>
              <div class="stat-tile">
                <div class="stat-label"><i class="bi bi-person me-1" aria-hidden="true"></i>Tác giả</div>
                <div class="stat-value owner text-truncate" [title]="quiz.ownerUsername">{{ quiz.ownerUsername }}</div>
              </div>
            </div>
          </section>

          <section class="questions" aria-labelledby="q-heading">
            <h2 id="q-heading" class="section-title">
              <i class="bi bi-card-list me-2" aria-hidden="true"></i>Danh sách câu hỏi
            </h2>
            <ol class="q-list surface" *ngIf="quiz.questions.length > 0">
              <li *ngFor="let q of quiz.questions; let i = index" class="q-row">
                <span class="q-index tabular">{{ i + 1 }}</span>
                <span class="q-content">{{ q.content }}</span>
                <span class="chip flex-shrink-0">{{ typeLabel(q.questionType) }}</span>
              </li>
            </ol>
            <div class="surface" *ngIf="quiz.questions.length === 0">
              <app-empty-state
                [compact]="true"
                tone="neutral"
                icon="bi-inbox"
                title="Chưa có câu hỏi"
                message="Quiz này chưa có câu hỏi nào.">
              </app-empty-state>
            </div>
          </section>
        </div>

        <aside class="side-col">
          <div class="cta-card surface">
            <h2 class="cta-title">Sẵn sàng chưa?</h2>
            <p class="cta-text">
              Bạn sẽ trả lời <strong>{{ quiz.questions.length }} câu hỏi</strong> trong
              <strong>{{ quiz.duration }} phút</strong>. Kết quả hiển thị ngay sau khi nộp bài.
            </p>
            <div class="d-grid gap-2">
              <button type="button" class="btn btn-primary btn-lg" (click)="startQuiz()"
                      [disabled]="quiz.questions.length === 0">
                <i class="bi bi-play-fill me-1" aria-hidden="true"></i>{{ ctaLabel }}
              </button>
              <a routerLink="/quiz/browse" class="btn btn-light">Xem quiz khác</a>
            </div>
            <div *ngIf="!isLoggedIn" class="guest-note">
              <i class="bi bi-info-circle" aria-hidden="true"></i>
              <p>
                Khách được làm thử tối đa <strong>3 lượt</strong>.
                <a routerLink="/auth/register" [queryParams]="{ returnUrl: '/quiz/detail/' + quiz.quizId }">Tạo tài khoản</a> để làm không giới hạn và lưu lịch sử.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .detail-grid { display: grid; gap: 1.5rem; grid-template-columns: 1fr; align-items: start; }
    @media (min-width: 992px) { .detail-grid { grid-template-columns: minmax(0, 1fr) 340px; } }

    .main-col { display: flex; flex-direction: column; gap: 1.75rem; min-width: 0; }

    .hero { padding: 1.75rem 1.5rem; box-shadow: var(--shadow-sm); }
    @media (min-width: 576px) { .hero { padding: 2.25rem 2.25rem; } }
    .hero-icon { margin-bottom: 1rem; }
    .quiz-title { font-size: clamp(1.5rem, 1.2rem + 1.2vw, 2.1rem); margin: 0 0 0.6rem; }
    .quiz-desc { color: var(--text-2); font-size: 1.02rem; line-height: 1.7; margin: 0 0 1.75rem; max-width: 65ch; }
    .quiz-desc.is-empty { color: var(--text-muted); font-style: italic; }

    .stats { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
    .stats .stat-tile { background: var(--surface-2); border-color: transparent; min-width: 0; }
    .stats .stat-label { margin-bottom: 0.25rem; }
    .stats .unit { font-size: 0.9rem; font-weight: 700; color: var(--text-2); margin-left: 0.3rem; }
    .stats .owner { font-size: 1.15rem; line-height: 1.6; }

    .q-list { list-style: none; margin: 0; padding: 0; overflow: hidden; }
    .q-row {
      display: flex; align-items: flex-start; gap: 0.85rem;
      padding: 0.9rem 1.15rem; border-bottom: 1px solid var(--border);
      transition: background-color var(--transition);
    }
    .q-row:last-child { border-bottom: 0; }
    .q-row:hover { background: var(--surface-2); }
    .q-index {
      width: 1.75rem; height: 1.75rem; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: var(--radius-pill);
      background: var(--brand-soft); color: var(--brand-soft-text);
      font-size: 0.78rem; font-weight: 700;
    }
    .q-content { flex: 1; min-width: 0; color: var(--text); font-weight: 500; padding-top: 0.1rem; }

    .cta-card { padding: 1.5rem; box-shadow: var(--shadow-md); }
    @media (min-width: 992px) { .cta-card { position: sticky; top: 5.5rem; } }
    .cta-title { font-size: 1.25rem; margin: 0 0 0.5rem; }
    .cta-text { color: var(--text-2); font-size: 0.9rem; margin: 0 0 1.25rem; }
    .cta-text strong { color: var(--text); }

    .guest-note {
      display: flex; gap: 0.6rem; align-items: flex-start;
      margin-top: 1.25rem; padding: 0.85rem 1rem;
      background: var(--warning-soft); color: var(--warning);
      border-radius: var(--radius-input); font-size: 0.85rem;
    }
    .guest-note p { margin: 0; color: var(--text); }
    .guest-note a { font-weight: 700; }
  `]
})
export class QuizDetailComponent implements OnInit, OnDestroy {
  quiz: QuizDetail | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  isLoggedIn = false;
  /** Quiz không tồn tại / đã xóa / không mở: không hiện nút "Thử lại" */
  notFound = false;
  private destroy$ = new Subject<void>();
  private quizId!: number;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private quizService: QuizService,
    private authService: AuthService
  ) {
    this.isLoggedIn = this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.quizId = parseInt(params['id'], 10);
      this.loadQuizDetail();
    });
  }

  loadQuizDetail(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.notFound = false;

    this.quizService
      .getQuizDetail(this.quizId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.quiz = data;
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = extractError(err, 'Không thể tải chi tiết quiz.');
          const status = isAxiosError(err) ? err.response?.status : undefined;
          this.notFound = status === 404 || status === 403;
          console.error(err);
        }
      });
  }

  /** Có lượt làm đang dở trong tab này (xem AttemptComponent) */
  get hasActiveAttempt(): boolean {
    try {
      return !!sessionStorage.getItem(`quizapp-active-attempt-${this.quizId}`);
    } catch {
      return false;
    }
  }

  get ctaLabel(): string {
    if (this.hasActiveAttempt) return 'Tiếp tục bài đang làm';
    return this.isLoggedIn ? 'Bắt đầu làm bài' : 'Làm thử';
  }

  startQuiz(): void {
    this.router.navigate(['/quiz/attempt', this.quizId]);
  }

  typeLabel(type: string): string {
    const map: { [key: string]: string } = {
      MultipleChoice: 'Chọn nhiều',
      SingleChoice: 'Chọn 1',
      TrueFalse: 'Đúng / Sai',
      FillInTheBlanks: 'Điền trống',
      ShortAnswer: 'Ngắn',
      LongAnswer: 'Tự luận'
    };
    return map[type] || type;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
