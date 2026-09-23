import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AttemptService } from '../../core/services/attempt.service';
import { AuthService } from '../../core/services/auth.service';
import {
  AttemptContent,
  AttemptQuestion,
  AttemptAnswerRequest,
  usesPredefinedAnswers,
  allowsOneSelectionOnly
} from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-attempt',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
<div class="attempt-bg">
  <!-- Loading -->
  <div *ngIf="isLoading" class="d-flex flex-column justify-content-center align-items-center" style="min-height: 100vh;">
    <div class="spinner-border" style="width: 3rem; height: 3rem; color: #667eea;"></div>
    <p class="mt-3 text-muted fs-5">Đang chuẩn bị bài làm...</p>
  </div>

  <!-- Error -->
  <div *ngIf="errorMessage" class="d-flex flex-column justify-content-center align-items-center" style="min-height: 100vh;">
    <div class="error-card">
      <div class="text-center p-5">
        <div style="font-size: 4rem;" class="mb-4">⚠️</div>
        <h4 class="mb-4 text-secondary">{{ errorMessage }}</h4>
        <div class="d-grid gap-2" style="max-width: 280px; margin: 0 auto;">
          <a routerLink="/auth/register" class="btn btn-gradient rounded-pill">Đăng Ký Tài Khoản</a>
          <a routerLink="/quiz/browse" class="btn btn-light rounded-pill border">Quay lại danh sách</a>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div *ngIf="content && !isLoading && !errorMessage" class="d-flex flex-column" style="min-height: 100vh;">
    <!-- Sticky Header -->
    <div class="sticky-top bg-white" style="box-shadow: 0 2px 12px rgba(0,0,0,0.06); z-index: 100;">
      <div class="attempt-container py-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="mb-0 fw-medium text-secondary text-truncate pe-3">{{ content.title }}</h5>
          <span class="timer-badge flex-shrink-0" [ngClass]="timeRemaining < 60 ? 'timer-urgent' : 'timer-normal'">
            <i class="bi bi-stopwatch"></i> {{ formatTime(timeRemaining) }}
          </span>
        </div>
        <div class="progress" style="height: 5px;">
          <div class="progress-bar" role="progressbar" [style.width.%]="getProgress()"></div>
        </div>
      </div>
    </div>

    <!-- Question Area -->
    <div class="attempt-container flex-grow-1 py-4">
      <div *ngIf="currentQuestion" class="question-card mb-4">
        <div class="p-4 p-md-5">
          <div class="d-flex justify-content-between align-items-center mb-4">
            <span class="q-num-badge">Câu {{ currentIndex + 1 }} / {{ content.questions.length }}</span>
            <span class="type-badge">{{ typeLabel(currentQuestion.questionType) }}</span>
          </div>

          <h3 class="question-text mb-5">{{ currentQuestion.content }}</h3>

          <!-- SingleChoice / TrueFalse -->
          <div *ngIf="isSingleSelect(currentQuestion)" class="d-flex flex-column gap-3">
            <label *ngFor="let option of currentQuestion.options"
                   class="option-card"
                   [class.option-selected]="singleSelections[currentQuestion.questionId] === option.answerId">
              <div class="d-flex align-items-center gap-3">
                <input type="radio"
                       [name]="'q' + currentQuestion.questionId"
                       [value]="option.answerId"
                       [(ngModel)]="singleSelections[currentQuestion.questionId]"
                       class="form-check-input fs-5" />
                <span>{{ option.content }}</span>
              </div>
            </label>
          </div>

          <!-- MultipleChoice -->
          <div *ngIf="isMultiSelect(currentQuestion)" class="d-flex flex-column gap-3">
            <p class="text-muted small mb-1">☑️ Có thể chọn nhiều đáp án</p>
            <label *ngFor="let option of currentQuestion.options"
                   class="option-card"
                   [class.option-selected]="isChecked(currentQuestion.questionId, option.answerId)">
              <div class="d-flex align-items-center gap-3">
                <input type="checkbox"
                       [checked]="isChecked(currentQuestion.questionId, option.answerId)"
                       (change)="toggleMulti(currentQuestion.questionId, option.answerId)"
                       class="form-check-input fs-5" />
                <span>{{ option.content }}</span>
              </div>
            </label>
          </div>

          <!-- FillInTheBlanks / ShortAnswer -->
          <div *ngIf="isShortText(currentQuestion)" class="mt-3">
            <input type="text"
                   class="form-control text-input"
                   placeholder="Nhập câu trả lời của bạn..."
                   [(ngModel)]="textResponses[currentQuestion.questionId]" />
          </div>

          <!-- LongAnswer -->
          <div *ngIf="currentQuestion.questionType === 'LongAnswer'" class="mt-3">
            <textarea class="form-control text-input" rows="7"
                      placeholder="Nhập bài làm của bạn..."
                      [(ngModel)]="textResponses[currentQuestion.questionId]"></textarea>
            <div class="form-text text-muted mt-2">✍️ Câu tự luận sẽ được chấm thủ công sau khi nộp.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky Footer Nav -->
    <div class="sticky-bottom bg-white border-top" style="box-shadow: 0 -4px 16px rgba(0,0,0,0.06);">
      <div class="attempt-container py-3 position-relative">
        <div class="text-center mb-2">
          <span class="answered-pill">
            Đã trả lời: {{ answeredCount() }} / {{ content.questions.length }}
          </span>
        </div>
        <div class="d-flex justify-content-between align-items-center">
          <button class="btn btn-nav-secondary"
                  (click)="previousQuestion()" [disabled]="currentIndex === 0">
            ← Trước
          </button>

          <div class="d-flex gap-2 align-items-center">
            <button class="btn btn-abandon" (click)="abandonAttempt()" [disabled]="isSubmitting">
              Thoát
            </button>
            <button *ngIf="currentIndex < content.questions.length - 1"
                    class="btn btn-gradient btn-lg rounded-pill px-5"
                    (click)="nextQuestion()">
              Tiếp Theo →
            </button>
            <button *ngIf="currentIndex === content.questions.length - 1"
                    class="btn btn-submit btn-lg rounded-pill px-5"
                    (click)="submitAttempt()" [disabled]="isSubmitting">
              {{ isSubmitting ? 'Đang nộp...' : '📤 Nộp Bài' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [
    `
      .attempt-bg { background: #f8f9ff; min-height: 100vh; }
      .attempt-container { max-width: 760px; margin: 0 auto; padding: 0 1rem; }

      .timer-badge {
        padding: 0.45rem 1rem;
        border-radius: 50px;
        font-weight: 700;
        font-size: 1rem;
        letter-spacing: 0.02em;
      }
      .timer-normal { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
      .timer-urgent { background: #ef4444; color: white; animation: pulse 1s infinite; }

      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.75; } }

      .question-card {
        background: white;
        border-radius: 16px;
        border: 1px solid #e8eaf6;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.08);
      }

      .q-num-badge {
        background: rgba(102, 126, 234, 0.1);
        color: #667eea;
        border: 1px solid rgba(102, 126, 234, 0.2);
        border-radius: 50px;
        padding: 0.35rem 0.85rem;
        font-size: 0.875rem;
        font-weight: 700;
      }

      .type-badge {
        background: #f1f3f9;
        color: #4b5563;
        border-radius: 6px;
        padding: 0.3rem 0.7rem;
        font-size: 0.8rem;
        font-weight: 600;
      }

      .question-text {
        color: #1a1a2e;
        font-size: 1.2rem;
        font-weight: 700;
        line-height: 1.6;
      }

      .option-card {
        display: block;
        padding: 1rem 1.25rem;
        border: 2px solid #e8eaf6;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: #fafbff;
      }
      .option-card:hover { border-color: #667eea; background: rgba(102,126,234,0.04); }
      .option-selected { border-color: #667eea; background: rgba(102,126,234,0.08); }

      .form-check-input { cursor: pointer; accent-color: #667eea; }
      .form-check-input:checked { background-color: #667eea; border-color: #667eea; }

      .text-input {
        border: 2px solid #e8eaf6;
        border-radius: 12px;
        padding: 0.85rem 1rem;
        font-size: 1rem;
        transition: border-color 0.2s;
      }
      .text-input:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.12); }

      .answered-pill {
        display: inline-block;
        background: #f1f3f9;
        color: #4b5563;
        border-radius: 50px;
        padding: 0.3rem 0.9rem;
        font-size: 0.85rem;
        font-weight: 600;
      }

      .btn-gradient {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border: none;
        font-weight: 700;
        transition: all 0.2s;
      }
      .btn-gradient:hover { opacity: 0.9; transform: translateY(-1px); color: white; }

      .btn-nav-secondary {
        background: white;
        border: 1.5px solid #e8eaf6;
        border-radius: 50px;
        color: #6b7280;
        font-weight: 600;
        padding: 0.55rem 1.4rem;
        transition: all 0.2s;
      }
      .btn-nav-secondary:hover:not(:disabled) { border-color: #667eea; color: #667eea; }
      .btn-nav-secondary:disabled { opacity: 0.5; }

      .btn-abandon {
        background: #fef2f2;
        border: 1.5px solid #fecaca;
        border-radius: 50px;
        color: #ef4444;
        font-weight: 600;
        padding: 0.55rem 1.2rem;
        transition: all 0.2s;
      }
      .btn-abandon:hover:not(:disabled) { background: #ef4444; color: white; }

      .btn-submit {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border: none;
        font-weight: 700;
        box-shadow: 0 4px 16px rgba(16,185,129,0.3);
        transition: all 0.2s;
      }
      .btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16,185,129,0.4); color: white; }
      .btn-submit:disabled { opacity: 0.65; }

      .error-card {
        background: white;
        border-radius: 16px;
        border: 1px solid #e8eaf6;
        box-shadow: 0 8px 40px rgba(0,0,0,0.08);
        max-width: 420px;
        width: 90%;
      }
    `
  ]
})
export class AttemptComponent implements OnInit, OnDestroy {
  content: AttemptContent | null = null;
  currentIndex = 0;
  isLoading = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  timeRemaining = 0; // giây

  // Trạng thái trả lời theo từng loại câu hỏi
  singleSelections: { [questionId: number]: number } = {};          // SingleChoice, TrueFalse
  multiSelections: { [questionId: number]: { [answerId: number]: boolean } } = {}; // MultipleChoice
  textResponses: { [questionId: number]: string } = {};             // Fill/Short/Long

  private timerId: ReturnType<typeof setInterval> | null = null;
  private destroy$ = new Subject<void>();
  private isLoggedIn = false;

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
      const quizId = parseInt(params['id'], 10);
      this.startNewAttempt(quizId);
    });
  }

  // UC07 (guest) / UC08 (user) — response trả về luôn nội dung bài làm
  startNewAttempt(quizId: number): void {
    this.isLoading = true;
    this.errorMessage = null;

    const start$ = this.isLoggedIn
      ? this.attemptService.startAttempt(quizId)
      : this.attemptService.startTrial(quizId);

    start$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (content) => {
        this.content = content;
        this.isLoading = false;
        this.startTimer(content.duration * 60);
      },
      error: (err) => {
        this.isLoading = false;
        // UC07 A1: 403 hết lượt trial — hiển thị detail từ ProblemDetails
        this.errorMessage =
          err?.response?.data?.detail || 'Không thể bắt đầu quiz. Vui lòng thử lại.';
        console.error(err);
      }
    });
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
  }

  // ===== Điều hướng =====

  nextQuestion(): void {
    if (this.content && this.currentIndex < this.content.questions.length - 1) {
      this.currentIndex++;
    }
  }

  previousQuestion(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
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

  // ===== UC09 – Nộp bài =====

  submitAttempt(): void {
    if (!this.content) return;

    // Backend yêu cầu ít nhất 1 câu trả lời
    if (this.answeredCount() === 0) {
      alert('Bạn cần trả lời ít nhất 1 câu trước khi nộp bài.');
      return;
    }

    const msg = 'Bạn đã trả lời ' + this.answeredCount() + '/' + this.content.questions.length + ' câu. Nộp bài chứ?';
    if (!confirm(msg)) {
      return;
    }

    this.doSubmit();
  }

  private doSubmit(): void {
    if (!this.content) return;
    this.isSubmitting = true;

    // Xây danh sách answers theo đúng format backend:
    // - Chọn 1: 1 phần tử { questionId, answerId }
    // - Chọn nhiều: NHIỀU phần tử cùng questionId, mỗi phần tử 1 answerId
    // - Text: { questionId, responseText }
    const answers: AttemptAnswerRequest[] = [];

    for (const q of this.content.questions) {
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

    const attemptId = this.content.attemptId;

    this.attemptService
      .submitAttempt(attemptId, answers)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.stopTimer();
          this.router.navigate(['/quiz/result', attemptId]);
        },
        error: (err) => {
          this.isSubmitting = false;
          alert(err?.response?.data?.detail || 'Nộp bài thất bại. Vui lòng thử lại.');
          console.error(err);
        }
      });
  }

  abandonAttempt(): void {
    // UC07/UC08 A3 – thoát trước khi nộp: bài không được chấm
    if (confirm('Bạn chắc chứ? Bài làm sẽ không được chấm.')) {
      this.router.navigate(['/quiz/browse']);
    }
  }

  // ===== Timer đếm ngược theo duration của quiz =====

  private startTimer(seconds: number): void {
    this.timeRemaining = seconds;
    this.timerId = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.stopTimer();
        // Hết giờ: tự động nộp những câu đã trả lời (nếu có)
        if (this.answeredCount() > 0 && !this.isSubmitting) {
          alert('Hết giờ! Bài của bạn sẽ được nộp tự động.');
          this.doSubmit();
        } else {
          alert('Hết giờ! Bạn chưa trả lời câu nào nên bài không được chấm.');
          this.router.navigate(['/quiz/browse']);
        }
      }
    }, 1000);
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

  ngOnDestroy(): void {
    this.stopTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
