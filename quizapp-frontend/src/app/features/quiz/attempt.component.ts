import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { isAxiosError } from 'axios';
import { AttemptService } from '../../core/services/attempt.service';
import { AuthService } from '../../core/services/auth.service';
import {
  AttemptContent,
  AttemptQuestion,
  AttemptAnswerRequest,
  AnswerOption,
  usesPredefinedAnswers,
  allowsOneSelectionOnly
} from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { DialogService } from '../../core/services/dialog.service';
import { extractError } from '../../core/errors';
import { LeaveConfirmable } from '../../core/guards/leave-attempt.guard';

/** localStorage: câu trả lời đang làm, theo attemptId */
export const attemptStorageKey = (attemptId: number) => `quizapp-attempt-${attemptId}`;
/** sessionStorage: lượt làm đang mở của 1 quiz (để F5 thì tiếp tục, không tạo lượt mới) */
export const activeAttemptKey = (quizId: number) => `quizapp-active-attempt-${quizId}`;

interface SavedAttempt {
  single: { [questionId: number]: number };
  multi: { [questionId: number]: { [answerId: number]: boolean } };
  text: { [questionId: number]: string };
  index: number;
  /** Hạn nộp theo đồng hồ máy người dùng (ms) */
  deadline: number;
}

function errorCode(err: unknown): string | undefined {
  if (!isAxiosError(err)) return undefined;
  const code = (err.response?.data as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}

function storageGet(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function storageSet(storage: 'local' | 'session', key: string, value: string): void {
  try {
    (storage === 'local' ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* storage đầy hoặc bị chặn: bỏ qua */
  }
}

function storageRemove(storage: 'local' | 'session', key: string): void {
  try {
    (storage === 'local' ? localStorage : sessionStorage).removeItem(key);
  } catch {
    /* bỏ qua */
  }
}

@Component({
  selector: 'app-attempt',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, EmptyStateComponent, SkeletonComponent],
  template: `
<!-- Loading -->
<div *ngIf="isLoading" class="page-container-narrow">
  <app-skeleton variant="detail"></app-skeleton>
</div>

<!-- Error -->
<div *ngIf="errorMessage && !isLoading" class="page-container-narrow">
  <div class="surface">
    <app-empty-state tone="danger" [icon]="expired ? 'bi-hourglass-bottom' : 'bi-exclamation-triangle'"
                     [title]="errorTitle" [message]="errorMessage">
      <a routerLink="/quiz/browse" class="btn btn-light">
        <i class="bi bi-arrow-left" aria-hidden="true"></i> Quay lại danh sách
      </a>
      <button *ngIf="expired" type="button" class="btn btn-primary" (click)="restart()">
        <i class="bi bi-arrow-repeat" aria-hidden="true"></i> Bắt đầu lượt mới
      </button>
      <a *ngIf="!isLoggedIn && !expired" routerLink="/auth/register" class="btn btn-primary">Đăng ký tài khoản</a>
    </app-empty-state>
  </div>
</div>

<!-- Content -->
<div *ngIf="content && !isLoading && !errorMessage" class="attempt-shell">
  <!-- Sticky top bar -->
  <header class="attempt-bar">
    <div class="d-flex align-items-center justify-content-between gap-3">
      <div class="min-w-0">
        <p class="bar-eyebrow">Đang làm bài</p>
        <h1 class="bar-title text-truncate">{{ content.title }}</h1>
      </div>
      <span class="chip tabular timer flex-shrink-0"
            [ngClass]="timerChipClass"
            [attr.aria-label]="'Thời gian còn lại ' + formatTime(timeRemaining)">
        <i class="bi bi-stopwatch" aria-hidden="true"></i> {{ formatTime(timeRemaining) }}
      </span>
    </div>
    <div class="d-flex align-items-center gap-3 mt-2">
      <span class="bar-count tabular">Câu {{ currentIndex + 1 }}/{{ content.questions.length }}</span>
      <div class="progress flex-grow-1 bar-progress" role="progressbar"
           [attr.aria-valuenow]="currentIndex + 1" aria-valuemin="0"
           [attr.aria-valuemax]="content.questions.length" aria-label="Tiến độ">
        <div class="progress-bar" [style.width.%]="getProgress()"></div>
      </div>
      <span class="bar-count tabular d-none d-sm-inline">Đã trả lời {{ answeredCount() }}</span>
    </div>
  </header>

  <div class="attempt-grid">
    <!-- Question -->
    <section class="attempt-main">
      <article *ngIf="currentQuestion" class="question-card surface animate-fade-up">
        <div class="d-flex justify-content-between align-items-center gap-2 mb-3">
          <span class="chip chip-brand tabular">Câu {{ currentIndex + 1 }}</span>
          <span class="chip">{{ typeLabel(currentQuestion.questionType) }}</span>
        </div>

        <h2 class="question-text" [id]="'qtext-' + currentQuestion.questionId">{{ currentQuestion.content }}</h2>

        <!-- SingleChoice / TrueFalse -->
        <div *ngIf="isSingleSelect(currentQuestion)" class="options" role="radiogroup"
             [attr.aria-label]="'Đáp án câu ' + (currentIndex + 1) + ', chọn 1 đáp án'">
          <p class="hint"><span class="hint-shape radio" aria-hidden="true"></span> Chọn 1 đáp án</p>
          <label *ngFor="let option of currentQuestion.options; let i = index"
                 class="option"
                 [class.selected]="singleSelections[currentQuestion.questionId] === option.answerId">
            <input type="radio"
                   class="option-input"
                   [name]="'q' + currentQuestion.questionId"
                   [value]="option.answerId"
                   [(ngModel)]="singleSelections[currentQuestion.questionId]"
                   (ngModelChange)="persist()" />
            <span class="option-control radio" aria-hidden="true"></span>
            <span class="option-letter" aria-hidden="true">{{ letter(i) }}</span>
            <span class="option-text">{{ option.content }}</span>
          </label>
        </div>

        <!-- MultipleChoice -->
        <div *ngIf="isMultiSelect(currentQuestion)" class="options" role="group"
             [attr.aria-label]="'Đáp án câu ' + (currentIndex + 1) + ', có thể chọn nhiều'">
          <p class="hint"><span class="hint-shape checkbox" aria-hidden="true"></span> Chọn một hoặc nhiều đáp án</p>
          <label *ngFor="let option of currentQuestion.options; let i = index"
                 class="option"
                 [class.selected]="isChecked(currentQuestion.questionId, option.answerId)">
            <input type="checkbox"
                   class="option-input"
                   [checked]="isChecked(currentQuestion.questionId, option.answerId)"
                   (change)="toggleMulti(currentQuestion.questionId, option.answerId)" />
            <span class="option-control checkbox" aria-hidden="true"><i class="bi bi-check-lg"></i></span>
            <span class="option-letter square" aria-hidden="true">{{ letter(i) }}</span>
            <span class="option-text">{{ option.content }}</span>
          </label>
        </div>

        <!-- FillInTheBlanks / ShortAnswer -->
        <div *ngIf="isShortText(currentQuestion)">
          <input type="text"
                 class="form-control form-control-lg"
                 placeholder="Nhập câu trả lời của bạn"
                 aria-label="Câu trả lời"
                 [(ngModel)]="textResponses[currentQuestion.questionId]"
                 (ngModelChange)="persist()" />
        </div>

        <!-- LongAnswer -->
        <div *ngIf="currentQuestion.questionType === 'LongAnswer'">
          <textarea class="form-control" rows="7"
                    placeholder="Nhập bài làm của bạn"
                    aria-label="Bài làm"
                    [(ngModel)]="textResponses[currentQuestion.questionId]"
                    (ngModelChange)="persist()"></textarea>
          <p class="hint mt-2 mb-0"><i class="bi bi-pencil" aria-hidden="true"></i> Câu tự luận sẽ được chấm thủ công sau khi nộp.</p>
        </div>
      </article>

      <!-- Navigation -->
      <nav class="attempt-actions" aria-label="Điều hướng câu hỏi">
        <button type="button" class="btn btn-light"
                (click)="previousQuestion()" [disabled]="currentIndex === 0">
          <i class="bi bi-arrow-left" aria-hidden="true"></i> <span class="prev-label">Câu trước</span>
        </button>

        <div class="action-group">
          <button type="button" class="btn btn-outline-danger" (click)="abandonAttempt()" [disabled]="isSubmitting">
            Thoát
          </button>
          <button *ngIf="currentIndex < content.questions.length - 1"
                  type="button" class="btn btn-primary btn-lg"
                  (click)="nextQuestion()">
            Câu tiếp theo <i class="bi bi-arrow-right" aria-hidden="true"></i>
          </button>
          <button *ngIf="currentIndex === content.questions.length - 1"
                  type="button" class="btn btn-primary btn-lg"
                  (click)="submitAttempt()" [disabled]="isSubmitting">
            <span *ngIf="isSubmitting" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
            <i *ngIf="!isSubmitting" class="bi bi-send" aria-hidden="true"></i>
            {{ isSubmitting ? 'Đang nộp...' : 'Nộp bài' }}
          </button>
        </div>
      </nav>
      <p class="kbd-hint">
        <i class="bi bi-keyboard" aria-hidden="true"></i>
        Phím tắt: 1–9 chọn đáp án · ← → chuyển câu
      </p>
    </section>

    <!-- Question navigator -->
    <aside class="navigator surface" aria-label="Danh sách câu hỏi">
      <div class="d-flex justify-content-between align-items-baseline mb-3">
        <h2 class="section-title mb-0">Câu hỏi</h2>
        <span class="nav-count tabular">{{ answeredCount() }}/{{ content.questions.length }} đã trả lời</span>
      </div>
      <div class="nav-grid">
        <button *ngFor="let q of content.questions; let i = index"
                type="button"
                class="nav-dot tabular"
                [class.answered]="isQuestionAnswered(q)"
                [class.current]="i === currentIndex"
                [attr.aria-current]="i === currentIndex ? 'step' : null"
                [attr.aria-label]="'Câu ' + (i + 1) + (isQuestionAnswered(q) ? ', đã trả lời' : ', chưa trả lời')"
                (click)="goToQuestion(i)">
          {{ i + 1 }}
          <span *ngIf="isQuestionAnswered(q)" class="nav-mark" aria-hidden="true"><i class="bi bi-check"></i></span>
        </button>
      </div>
      <ul class="legend">
        <li><span class="legend-dot current"></span>Đang xem</li>
        <li><span class="legend-dot answered"><i class="bi bi-check" aria-hidden="true"></i></span>Đã trả lời</li>
        <li><span class="legend-dot"></span>Chưa trả lời</li>
      </ul>
    </aside>
  </div>
</div>
  `,
  styles: [
    `
      .attempt-shell { max-width: 760px; margin-inline: auto; width: 100%; }
      @media (min-width: 1200px) { .attempt-shell { max-width: 1080px; } }

      .attempt-bar {
        position: sticky; top: 3.75rem; z-index: 20;
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        backdrop-filter: blur(10px);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-sm);
        padding: 0.85rem 1.15rem;
        margin-bottom: 1.25rem;
      }
      @media (min-width: 992px) { .attempt-bar { top: 0.75rem; } }
      .min-w-0 { min-width: 0; }
      .bar-eyebrow { margin: 0; font-size: 0.72rem; font-weight: 600; color: var(--text-muted); }
      .bar-title { margin: 0; font-size: 1.05rem; font-weight: 800; }
      .bar-count { font-size: 0.8rem; font-weight: 600; color: var(--text-2); white-space: nowrap; }
      .bar-progress { height: 6px; }
      .timer { font-size: 0.95rem; padding: 0.4rem 0.9rem; }

      .attempt-grid { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 1200px) {
        .attempt-grid { grid-template-columns: minmax(0, 1fr) 260px; align-items: start; }
        .navigator { position: sticky; top: 9rem; }
      }

      .question-card { padding: 1.5rem; box-shadow: var(--shadow-sm); }
      @media (min-width: 768px) { .question-card { padding: 2rem 2.25rem; } }
      .question-text {
        font-family: var(--font-display);
        font-size: clamp(1.2rem, 1.05rem + 0.6vw, 1.5rem);
        font-weight: 800;
        line-height: 1.4;
        margin: 0 0 1.5rem;
        white-space: pre-line;
      }
      .hint { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--text-2); margin: 0 0 0.25rem; }

      .options { display: flex; flex-direction: column; gap: 0.75rem; }
      .option {
        position: relative;
        display: flex; align-items: center; gap: 0.9rem;
        width: 100%;
        padding: 0.9rem 1rem;
        min-height: 3.5rem;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: var(--radius-input);
        cursor: pointer;
        transition: all var(--transition);
      }
      .option:hover { background: var(--surface-2); border-color: var(--border-strong); }
      .option:has(.option-input:focus-visible) { box-shadow: var(--ring); border-color: var(--brand-500); }
      .option.selected { background: var(--brand-soft); border-color: var(--brand-500); }
      .option-input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
      .option-letter {
        flex-shrink: 0;
        width: 2.1rem; height: 2.1rem;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: var(--radius-pill);
        background: var(--surface-2);
        border: 1.5px solid var(--border-strong);
        color: var(--text-2);
        font-family: var(--font-display); font-weight: 800; font-size: 0.9rem;
        transition: all var(--transition);
      }
      .option-letter.square { border-radius: 6px; }
      .option.selected .option-letter { background: var(--brand-soft); border-color: var(--brand-300); color: var(--brand-soft-text); }
      .option-text { flex: 1; color: var(--text); font-weight: 500; line-height: 1.45; }

      /* Radio (tròn) = chọn 1 · Checkbox (vuông) = chọn nhiều — theo quy ước form quen thuộc */
      .option-control {
        flex-shrink: 0;
        width: 1.35rem; height: 1.35rem;
        display: inline-flex; align-items: center; justify-content: center;
        border: 2px solid var(--border-strong);
        background: var(--surface);
        transition: all var(--transition);
      }
      .option-control.radio { border-radius: 50%; }
      .option-control.radio::after {
        content: ''; width: 0.6rem; height: 0.6rem; border-radius: 50%;
        background: var(--brand-contrast); transform: scale(0); transition: transform var(--transition);
      }
      .option-control.checkbox { border-radius: 5px; color: var(--brand-contrast); font-size: 1rem; }
      .option-control.checkbox i { opacity: 0; transform: scale(0.6); transition: all var(--transition); }
      .option:hover .option-control { border-color: var(--brand-300); }
      .option.selected .option-control { background: var(--brand-500); border-color: var(--brand-500); }
      .option.selected .option-control.radio::after { transform: scale(1); }
      .option.selected .option-control.checkbox i { opacity: 1; transform: scale(1); }

      .hint-shape { display: inline-block; width: 0.85rem; height: 0.85rem; border: 2px solid var(--text-2); }
      .hint-shape.radio { border-radius: 50%; }
      .hint-shape.checkbox { border-radius: 3px; }

      .attempt-actions {
        display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;
        margin-top: 1.25rem;
      }

      .navigator { padding: 1.15rem; }
      .nav-count { font-size: 0.78rem; color: var(--text-muted); font-weight: 600; }
      .nav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr)); gap: 0.45rem; }
      .nav-dot {
        height: 2.5rem;
        border-radius: var(--radius-pill);
        border: 1.5px solid transparent;
        background: var(--surface-2);
        color: var(--text-2);
        font-weight: 700; font-size: 0.85rem;
        cursor: pointer;
        transition: all var(--transition);
      }
      .nav-dot:hover { border-color: var(--border-strong); color: var(--text); }
      .nav-dot.answered { background: var(--brand-soft); color: var(--brand-soft-text); }
      .nav-dot.current { background: var(--brand-500); color: var(--brand-contrast); border-color: var(--brand-500); }

      .legend { list-style: none; padding: 0; margin: 1rem 0 0; display: flex; flex-wrap: wrap; gap: 0.35rem 1rem; font-size: 0.78rem; color: var(--text-2); }
      .legend li { display: inline-flex; align-items: center; gap: 0.4rem; }
      .legend-dot { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--surface-3); }
      .legend-dot.answered { background: var(--brand-200); }
      .legend-dot.current { background: var(--brand-500); }

      .action-group { display: flex; gap: 0.5rem; align-items: center; }
      .kbd-hint {
        display: flex; align-items: center; gap: 0.4rem;
        margin: 0.85rem 0 0; font-size: 0.78rem; color: var(--text-muted);
      }
      @media (hover: none) { .kbd-hint { display: none; } }
      @media (min-width: 401px) and (max-width: 575.98px) { .prev-label { display: none; } }
      @media (max-width: 400px) {
        .attempt-actions { flex-direction: column-reverse; align-items: stretch; }
        .action-group { flex-direction: column-reverse; align-items: stretch; }
        .attempt-actions .btn { width: 100%; justify-content: center; }
      }

      .nav-dot { position: relative; }
      .nav-dot.current { outline: 2px solid var(--brand-300); outline-offset: 2px; }
      .nav-mark {
        position: absolute; top: -0.3rem; right: -0.3rem;
        width: 1rem; height: 1rem;
        display: grid; place-items: center;
        border-radius: 50%;
        background: var(--brand-600); color: var(--brand-contrast);
        font-size: 0.75rem; line-height: 1;
        box-shadow: 0 0 0 2px var(--surface);
      }
      .legend-dot.answered {
        display: inline-grid; place-items: center;
        width: 0.95rem; height: 0.95rem;
        background: var(--brand-600); color: var(--brand-contrast); font-size: 0.7rem;
      }
    `
  ]
})
export class AttemptComponent implements OnInit, OnDestroy, LeaveConfirmable {
  private dialog = inject(DialogService);
  content: AttemptContent | null = null;
  currentIndex = 0;
  isLoading = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  errorTitle = 'Không thể bắt đầu bài làm';
  /** Lượt làm đã hết giờ trước khi nộp được */
  expired = false;
  timeRemaining = 0; // giây
  isLoggedIn = false;

  // Trạng thái trả lời theo từng loại câu hỏi
  singleSelections: { [questionId: number]: number } = {};          // SingleChoice, TrueFalse
  multiSelections: { [questionId: number]: { [answerId: number]: boolean } } = {}; // MultipleChoice
  textResponses: { [questionId: number]: string } = {};             // Fill/Short/Long

  private quizId = 0;
  private deadline = 0; // ms, theo đồng hồ máy người dùng
  /** Đã nộp xong hoặc đã chủ động rời bài: không hỏi lại khi rời trang */
  private finished = false;
  private timerId: ReturnType<typeof setInterval> | null = null;
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
      this.quizId = parseInt(params['id'], 10);
      this.init();
    });
  }

  /** Đang làm bài: có nội dung, chưa nộp/đang nộp, chưa rời */
  get inProgress(): boolean {
    return !!this.content && !this.finished && !this.isSubmitting && !this.errorMessage;
  }

  private init(): void {
    this.reset();
    const activeId = Number(storageGet('session', activeAttemptKey(this.quizId)));
    if (activeId > 0) {
      this.resumeAttempt(activeId);
    } else {
      this.startNewAttempt();
    }
  }

  private reset(): void {
    this.stopTimer();
    this.content = null;
    this.currentIndex = 0;
    this.isSubmitting = false;
    this.errorMessage = null;
    this.expired = false;
    this.finished = false;
    this.singleSelections = {};
    this.multiSelections = {};
    this.textResponses = {};
  }

  // UC07 (guest) / UC08 (user) — response trả về luôn nội dung bài làm
  private startNewAttempt(): void {
    this.isLoading = true;
    this.errorMessage = null;

    const start$ = this.isLoggedIn
      ? this.attemptService.startAttempt(this.quizId)
      : this.attemptService.startTrial(this.quizId);

    start$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (content) => {
        this.isLoading = false;
        // Tính hạn nộp theo đồng hồ máy người dùng để tránh lệch giờ với server
        const span = Date.parse(content.expiresAt) - Date.parse(content.startedAt);
        const deadline = isFinite(span) ? Date.now() + span : Date.now() + content.duration * 60_000;
        this.begin(content, null, deadline);
      },
      error: (err) => {
        this.isLoading = false;
        this.showError('Không thể bắt đầu bài làm', extractError(err, 'Không thể bắt đầu quiz. Vui lòng thử lại.'));
        console.error(err);
      }
    });
  }

  // F5 / quay lại trang: lấy lại nội dung lượt đang làm, khôi phục câu trả lời đã lưu
  private resumeAttempt(attemptId: number): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.attemptService
      .getContent(attemptId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (content) => {
          this.isLoading = false;
          const saved = this.readSaved(attemptId);
          const deadline = saved?.deadline ?? Date.parse(content.expiresAt);
          this.begin(content, saved, deadline);
        },
        error: (err) => {
          const code = errorCode(err);
          if (code === 'ATTEMPT_SUBMITTED') {
            this.clearStorage(attemptId);
            this.finished = true;
            this.router.navigate(['/quiz/result', attemptId], { replaceUrl: true });
            return;
          }
          // Lượt cũ không còn truy cập được (vd. đổi tài khoản): bắt đầu lượt mới
          this.clearStorage(attemptId);
          if (code === 'ATTEMPT_NOT_FOUND') {
            this.startNewAttempt();
            return;
          }
          this.isLoading = false;
          this.showError('Không thể tải bài làm', extractError(err, 'Không thể tải bài làm. Vui lòng thử lại.'));
          console.error(err);
        }
      });
  }

  private begin(content: AttemptContent, saved: SavedAttempt | null, deadline: number): void {
    this.content = content;
    this.deadline = deadline;
    if (saved) {
      this.singleSelections = saved.single ?? {};
      this.multiSelections = saved.multi ?? {};
      this.textResponses = saved.text ?? {};
      this.currentIndex = Math.min(Math.max(saved.index ?? 0, 0), Math.max(content.questions.length - 1, 0));
    }
    storageSet('session', activeAttemptKey(this.quizId), String(content.attemptId));
    this.persist();
    this.startTimer();
  }

  /** Bắt đầu lại sau khi lượt cũ hết giờ */
  restart(): void {
    storageRemove('session', activeAttemptKey(this.quizId));
    this.reset();
    this.startNewAttempt();
  }

  private showError(title: string, message: string, expired = false): void {
    this.errorTitle = title;
    this.errorMessage = message;
    this.expired = expired;
  }

  // ===== Lưu tạm câu trả lời (localStorage) =====

  persist(): void {
    if (!this.content || this.finished) return;
    const data: SavedAttempt = {
      single: this.singleSelections,
      multi: this.multiSelections,
      text: this.textResponses,
      index: this.currentIndex,
      deadline: this.deadline
    };
    storageSet('local', attemptStorageKey(this.content.attemptId), JSON.stringify(data));
  }

  private readSaved(attemptId: number): SavedAttempt | null {
    const raw = storageGet('local', attemptStorageKey(attemptId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SavedAttempt;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private clearStorage(attemptId: number): void {
    storageRemove('local', attemptStorageKey(attemptId));
    storageRemove('session', activeAttemptKey(this.quizId));
  }

  // ===== Rời trang =====

  /** canDeactivate: hỏi trước khi rời khi bài đang làm */
  async canLeave(): Promise<boolean> {
    if (!this.inProgress) return true;
    const ok = await this.dialog.confirm({
      title: 'Rời khỏi bài làm?',
      message: 'Bài làm sẽ không được chấm và các câu trả lời hiện tại sẽ mất.',
      confirmText: 'Rời khỏi',
      cancelText: 'Làm tiếp',
      tone: 'danger',
      icon: 'bi-box-arrow-left'
    });
    if (!ok) return false;
    // Hết giờ và tự nộp trong lúc hộp thoại mở: cho rời bình thường
    if (!this.inProgress) return true;
    if (this.content) {
      this.finished = true;
      this.stopTimer();
      this.clearStorage(this.content.attemptId);
    }
    return true;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.inProgress) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // UC07/UC08 A3 – thoát trước khi nộp: guard canDeactivate hỏi xác nhận (1 lần)
  abandonAttempt(): void {
    this.router.navigate(['/quiz/browse']);
  }

  // ===== Phím tắt =====

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.inProgress || this.dialog.current()) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      const inputType = tag === 'INPUT' ? (target as HTMLInputElement).type : '';
      const isTextField =
        target.isContentEditable ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (tag === 'INPUT' && inputType !== 'radio' && inputType !== 'checkbox');
      if (isTextField) return;
    }

    const q = this.currentQuestion;
    if (!q) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previousQuestion();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextQuestion();
      return;
    }
    if (event.key === 'Enter') {
      // Enter trên nút/liên kết giữ hành vi mặc định
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'A')) return;
      event.preventDefault();
      this.nextQuestion();
      return;
    }

    let index = -1;
    if (/^[1-9]$/.test(event.key)) {
      index = Number(event.key) - 1;
    } else if (/^[a-i]$/i.test(event.key)) {
      index = event.key.toUpperCase().charCodeAt(0) - 65;
    }
    if (index < 0 || event.repeat || !usesPredefinedAnswers(q.questionType)) return;
    const option: AnswerOption | undefined = q.options[index];
    if (!option) return;

    event.preventDefault();
    if (this.isMultiSelect(q)) {
      this.toggleMulti(q.questionId, option.answerId);
    } else {
      this.singleSelections[q.questionId] = option.answerId;
      this.persist();
    }
  }

  get currentQuestion(): AttemptQuestion | null {
    return this.content?.questions[this.currentIndex] ?? null;
  }

  // ===== Phân loại câu hỏi =====

  isSingleSelect(q: AttemptQuestion): boolean {
    return allowsOneSelectionOnly(q.questionType);
  }

  isMultiSelect(q: AttemptQuestion): boolean {
    return q.questionType === 'MultipleChoice';
  }

  isShortText(q: AttemptQuestion): boolean {
    return q.questionType === 'FillInTheBlanks' || q.questionType === 'ShortAnswer';
  }

  // ===== MultipleChoice helpers =====

  isChecked(questionId: number, answerId: number): boolean {
    return !!this.multiSelections[questionId]?.[answerId];
  }

  toggleMulti(questionId: number, answerId: number): void {
    if (!this.multiSelections[questionId]) {
      this.multiSelections[questionId] = {};
    }
    this.multiSelections[questionId][answerId] = !this.multiSelections[questionId][answerId];
    this.persist();
  }

  // ===== Điều hướng =====

  nextQuestion(): void {
    if (this.content && this.currentIndex < this.content.questions.length - 1) {
      this.currentIndex++;
      this.persist();
    }
  }

  previousQuestion(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.persist();
    }
  }

  goToQuestion(index: number): void {
    if (this.content && index >= 0 && index < this.content.questions.length) {
      this.currentIndex = index;
      this.persist();
    }
  }

  // ===== Đếm số câu đã trả lời =====

  answeredCount(): number {
    if (!this.content) return 0;
    return this.content.questions.filter((q) => this.isAnswered(q)).length;
  }

  private isAnswered(q: AttemptQuestion): boolean {
    if (this.isSingleSelect(q)) {
      return this.singleSelections[q.questionId] != null;
    }
    if (this.isMultiSelect(q)) {
      const sel = this.multiSelections[q.questionId];
      return !!sel && Object.values(sel).some((v) => v);
    }
    return !!this.textResponses[q.questionId]?.trim();
  }

  isQuestionAnswered(q: AttemptQuestion): boolean {
    return this.isAnswered(q);
  }

  // ===== UC09 – Nộp bài =====

  async submitAttempt(): Promise<void> {
    if (!this.content) return;

    const total = this.content.questions.length;
    const answered = this.answeredCount();
    const unanswered = total - answered;
    const message =
      answered === 0
        ? 'Bạn chưa trả lời câu nào. Nếu nộp bây giờ, bài làm sẽ được 0 điểm.'
        : 'Bạn đã trả lời ' + answered + '/' + total + ' câu.' +
          (unanswered > 0 ? ' Còn ' + unanswered + ' câu chưa trả lời.' : '');

    const ok = await this.dialog.confirm({
      title: 'Nộp bài?',
      message,
      confirmText: 'Nộp bài',
      cancelText: 'Làm tiếp',
      tone: answered === 0 ? 'danger' : 'brand',
      icon: answered === 0 ? 'bi-exclamation-triangle' : 'bi-send-check'
    });
    // Hết giờ trong lúc hộp thoại mở thì bài đã được nộp tự động
    if (!ok || !this.inProgress) {
      return;
    }

    this.doSubmit(false);
  }

  private buildAnswers(content: AttemptContent): AttemptAnswerRequest[] {
    // - Chọn 1: 1 phần tử { questionId, answerId }
    // - Chọn nhiều: NHIỀU phần tử cùng questionId, mỗi phần tử 1 answerId
    // - Text: { questionId, responseText }
    const answers: AttemptAnswerRequest[] = [];
    for (const q of content.questions) {
      if (this.isSingleSelect(q)) {
        const answerId = this.singleSelections[q.questionId];
        if (answerId != null) {
          answers.push({ questionId: q.questionId, answerId });
        }
      } else if (this.isMultiSelect(q)) {
        const sel = this.multiSelections[q.questionId] || {};
        for (const [answerId, checked] of Object.entries(sel)) {
          if (checked) {
            answers.push({ questionId: q.questionId, answerId: Number(answerId) });
          }
        }
      } else {
        const text = this.textResponses[q.questionId]?.trim();
        if (text) {
          answers.push({ questionId: q.questionId, responseText: text });
        }
      }
    }
    return answers;
  }

  private doSubmit(auto: boolean): void {
    if (!this.content || this.isSubmitting || this.finished) return;
    this.isSubmitting = true;
    const attemptId = this.content.attemptId;

    this.attemptService
      .submitAttempt(attemptId, this.buildAnswers(this.content))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.finish(attemptId);
          if (auto) {
            this.dialog.toast('Hết giờ. Bài của bạn đã được nộp tự động.', 'brand', 6000);
          }
          this.router.navigate(['/quiz/result', attemptId]);
        },
        error: (err) => {
          this.isSubmitting = false;
          const code = errorCode(err);
          if (code === 'ATTEMPT_SUBMITTED') {
            this.finish(attemptId);
            this.router.navigate(['/quiz/result', attemptId]);
            return;
          }
          if (code === 'ATTEMPT_EXPIRED') {
            this.finish(attemptId);
            this.showError('Bài làm đã hết giờ', 'Thời gian làm bài đã kết thúc trước khi bài được nộp nên không được chấm.', true);
            return;
          }
          if (code === 'QUIZ_NOT_AVAILABLE' || code === 'ATTEMPT_NOT_FOUND') {
            this.finish(attemptId);
            this.showError('Không thể nộp bài', extractError(err));
            return;
          }
          this.dialog.alert({
            title: 'Nộp bài thất bại',
            message: extractError(err, 'Vui lòng thử lại.'),
            tone: 'danger'
          });
          console.error(err);
        }
      });
  }

  private finish(attemptId: number): void {
    this.finished = true;
    this.stopTimer();
    this.clearStorage(attemptId);
  }

  // ===== Timer đếm ngược theo expiresAt =====

  private startTimer(): void {
    this.stopTimer();
    this.tick();
    if (this.finished || this.isSubmitting) return;
    this.timerId = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    this.timeRemaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    if (this.timeRemaining <= 0) {
      this.stopTimer();
      // Hết giờ: tự động nộp những câu đã trả lời (bài trống vẫn được chấm 0 điểm)
      if (this.dialog.current()) this.dialog.close(false);
      this.doSubmit(true);
    }
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  getProgress(): number {
    if (!this.content || this.content.questions.length === 0) return 0;
    return ((this.currentIndex + 1) / this.content.questions.length) * 100;
  }

  formatTime(totalSeconds: number): string {
    const s = Math.max(totalSeconds, 0);
    const minutes = Math.floor(s / 60);
    const secs = s % 60;
    return minutes + ':' + secs.toString().padStart(2, '0');
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

  /** Nhãn chữ cái cho đáp án (A, B, C...) */
  letter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  /** Màu chip đồng hồ theo thời gian còn lại */
  get timerChipClass(): string {
    if (this.timeRemaining < 60) return 'chip-danger';
    if (this.timeRemaining <= 300) return 'chip-warning';
    return 'chip-brand';
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
