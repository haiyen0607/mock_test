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
    <div class="container py-4">
      <!-- Loading -->
      <div *ngIf="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
        <p class="mt-2">Đang chuẩn bị bài làm...</p>
      </div>

      <!-- Error (vd: hết lượt trial - UC07 A1) -->
      <div *ngIf="errorMessage" class="alert alert-danger">
        {{ errorMessage }}
        <div class="mt-3">
          <a routerLink="/auth/register" class="btn btn-primary btn-sm me-2">Đăng Ký</a>
          <a routerLink="/quiz/browse" class="btn btn-outline-secondary btn-sm">← Quay lại danh sách</a>
        </div>
      </div>

      <div *ngIf="content && !isLoading && !errorMessage">
        <!-- Title + Timer + Progress -->
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h4 class="mb-0">{{ content.title }}</h4>
          <span class="badge fs-6" [ngClass]="timeRemaining < 60 ? 'bg-danger' : 'bg-primary'">
            ⏱️ {{ formatTime(timeRemaining) }}
          </span>
        </div>

        <div class="progress mb-4" style="height: 25px;">
          <div
            class="progress-bar"
            role="progressbar"
            [style.width.%]="getProgress()"
          >
            {{ currentIndex + 1 }} / {{ content.questions.length }}
          </div>
        </div>

        <!-- Question Content -->
        <div *ngIf="currentQuestion" class="card shadow-sm mb-4">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <h5 class="mb-0">Câu {{ currentIndex + 1 }}: {{ currentQuestion.content }}</h5>
              <span class="badge bg-secondary ms-2 flex-shrink-0">{{ typeLabel(currentQuestion.questionType) }}</span>
            </div>

            <!-- SingleChoice / TrueFalse: radio, chọn đúng 1 đáp án -->
            <div *ngIf="isSingleSelect(currentQuestion)" class="list-group">
              <label
                *ngFor="let option of currentQuestion.options"
                class="list-group-item"
                [class.active-option]="singleSelections[currentQuestion.questionId] === option.answerId"
              >
                <input
                  type="radio"
                  [name]="'q' + currentQuestion.questionId"
                  [value]="option.answerId"
                  [(ngModel)]="singleSelections[currentQuestion.questionId]"
                  class="form-check-input me-2"
                />
                {{ option.content }}
              </label>
            </div>

            <!-- MultipleChoice: checkbox, chọn NHIỀU đáp án -->
            <div *ngIf="isMultiSelect(currentQuestion)">
              <p class="text-muted small">☑️ Có thể chọn nhiều đáp án</p>
              <div class="list-group">
                <label
                  *ngFor="let option of currentQuestion.options"
                  class="list-group-item"
                  [class.active-option]="isChecked(currentQuestion.questionId, option.answerId)"
                >
                  <input
                    type="checkbox"
                    [checked]="isChecked(currentQuestion.questionId, option.answerId)"
                    (change)="toggleMulti(currentQuestion.questionId, option.answerId)"
                    class="form-check-input me-2"
                  />
                  {{ option.content }}
                </label>
              </div>
            </div>

            <!-- FillInTheBlanks / ShortAnswer: input text -->
            <div *ngIf="isShortText(currentQuestion)" class="mt-2">
              <input
                type="text"
                class="form-control"
                placeholder="Nhập câu trả lời của bạn..."
                [(ngModel)]="textResponses[currentQuestion.questionId]"
              />
            </div>

            <!-- LongAnswer: textarea (chấm thủ công) -->
            <div *ngIf="currentQuestion.questionType === 'LongAnswer'" class="mt-2">
              <textarea
                class="form-control"
                rows="6"
                placeholder="Nhập bài làm của bạn..."
                [(ngModel)]="textResponses[currentQuestion.questionId]"
              ></textarea>
              <small class="text-muted">✍️ Câu tự luận sẽ được chấm thủ công sau khi nộp.</small>
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="d-flex justify-content-between">
          <button
            class="btn btn-outline-secondary"
            (click)="previousQuestion()"
            [disabled]="currentIndex === 0"
          >
            ← Trước
          </button>

          <div class="btn-group">
            <button
              class="btn btn-primary"
              *ngIf="currentIndex < content.questions.length - 1"
              (click)="nextQuestion()"
            >
              Tiếp Theo →
            </button>
            <button
              class="btn btn-success"
              *ngIf="currentIndex === content.questions.length - 1"
              (click)="submitAttempt()"
              [disabled]="isSubmitting"
            >
              {{ isSubmitting ? 'Đang nộp...' : '📤 Nộp Bài' }}
            </button>
          </div>

          <button
            class="btn btn-outline-danger"
            (click)="abandonAttempt()"
            [disabled]="isSubmitting"
          >
            Thoát
          </button>
        </div>

        <!-- Đã trả lời bao nhiêu câu -->
        <p class="text-center text-muted small mt-3">
          Đã trả lời {{ answeredCount() }} / {{ content.questions.length }} câu
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .list-group-item {
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .list-group-item:hover {
        background-color: #f8f9fa;
      }

      .active-option {
        background-color: #e7f1ff;
        border-color: #667eea;
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
