import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AttemptService } from '../../core/services/attempt.service';
import { AuthService } from '../../core/services/auth.service';
import { AttemptResult, AttemptResultQuestion, usesPredefinedAnswers } from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container py-5">
      <!-- Back Button -->
      <a routerLink="/quiz/browse" class="btn btn-outline-secondary mb-4">
        ← Quay lại
      </a>

      <!-- Loading -->
      <div *ngIf="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
        <p class="mt-2">Đang tải kết quả...</p>
      </div>

      <!-- Error -->
      <div *ngIf="errorMessage" class="alert alert-danger">
        {{ errorMessage }}
      </div>

      <!-- Result Content (UC10) -->
      <div *ngIf="result && !isLoading">
        <!-- Score Card -->
        <div class="card shadow-lg mb-4 bg-gradient">
          <div class="card-body text-center text-white p-5">
            <h1 class="display-4 fw-bold">{{ percentage }}%</h1>
            <p class="lead">{{ getScoreMessage(percentage) }}</p>
            <div class="mt-4">
              <p class="mb-2">
                <strong>{{ result.title }}</strong>
              </p>
              <p class="mb-2">
                Trả lời đúng <strong>{{ correctCount }}/{{ gradableCount }}</strong> câu được chấm tự động
              </p>
              <p *ngIf="pendingCount > 0" class="mb-2">
                ✍️ Còn <strong>{{ pendingCount }}</strong> câu tự luận đang chờ chấm thủ công
              </p>
              <p class="text-white-50 mb-0">Nộp lúc: {{ formatDateTime(result.submittedAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Detailed Results -->
        <div class="card shadow-sm">
          <div class="card-header bg-light">
            <h5 class="mb-0">📋 Chi Tiết Từng Câu</h5>
          </div>
          <div class="card-body">
            <div
              *ngFor="let q of result.questions; let i = index"
              class="mb-4 pb-4 border-bottom"
            >
              <div class="d-flex align-items-start gap-3">
                <!-- Icon: đúng / sai / chờ chấm -->
                <div class="fs-5">
                  <span *ngIf="q.isCorrect === true" class="text-success">✓</span>
                  <span *ngIf="q.isCorrect === false" class="text-danger">✗</span>
                  <span *ngIf="q.isCorrect === null" class="text-warning">⏳</span>
                </div>

                <!-- Content -->
                <div class="flex-grow-1">
                  <h6>Câu {{ i + 1 }}: {{ q.content }}</h6>

                  <div class="mt-2 small">
                    <!-- Câu chọn đáp án: hiển thị lựa chọn của user + đáp án đúng -->
                    <ng-container *ngIf="hasOptions(q)">
                      <div [ngClass]="q.isCorrect ? 'text-success' : 'text-danger'">
                        {{ q.isCorrect ? '✓' : '✗' }} Bạn chọn:
                        <strong>{{ selectedText(q) }}</strong>
                      </div>
                      <div *ngIf="q.isCorrect === false" class="text-success">
                        ✓ Đáp án đúng: <strong>{{ correctText(q) }}</strong>
                      </div>
                    </ng-container>

                    <!-- Câu text: hiển thị câu trả lời + trạng thái chấm -->
                    <ng-container *ngIf="!hasOptions(q)">
                      <div>
                        📝 Bạn trả lời: <strong>{{ q.responseText || 'Để trống' }}</strong>
                      </div>
                      <div *ngIf="q.isCorrect === true" class="text-success">✓ Được chấm: Đúng</div>
                      <div *ngIf="q.isCorrect === false" class="text-danger">✗ Được chấm: Sai</div>
                      <div *ngIf="q.isCorrect === null" class="text-warning">
                        ⏳ Đang chờ chấm thủ công
                      </div>
                    </ng-container>
                  </div>
                </div>
              </div>
            </div>

            <p *ngIf="result.questions.length === 0" class="text-muted mb-0">
              Không có dữ liệu câu trả lời.
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="d-grid gap-2 mt-4">
          <button class="btn btn-primary btn-lg" routerLink="/quiz/browse">
            Làm Quiz Khác
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .bg-gradient {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      .text-white-50 {
        color: rgba(255, 255, 255, 0.5);
      }
    `
  ]
})
export class ResultComponent implements OnInit, OnDestroy {
  result: AttemptResult | null = null;
  isLoading = false;
  errorMessage: string | null = null;

  // Số liệu tự tính từ danh sách câu hỏi
  correctCount = 0;
  gradableCount = 0; // các câu đã được chấm (isCorrect !== null)
  pendingCount = 0;  // các câu chờ chấm thủ công (isCorrect === null)
  percentage = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private attemptService: AttemptService,
    private authService: AuthService
  ) {}

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
          this.errorMessage = err?.response?.data?.detail || 'Không thể tải kết quả.';
          console.error(err);
        }
      });
  }

  private computeStats(result: AttemptResult): void {
    this.correctCount = result.questions.filter((q) => q.isCorrect === true).length;
    this.pendingCount = result.questions.filter((q) => q.isCorrect === null).length;
    this.gradableCount = result.questions.length - this.pendingCount;
    this.percentage =
      this.gradableCount > 0 ? Math.round((this.correctCount / this.gradableCount) * 100) : 0;
  }

  hasOptions(q: AttemptResultQuestion): boolean {
    return usesPredefinedAnswers(q.questionType);
  }

  /** Nội dung các đáp án user đã chọn */
  selectedText(q: AttemptResultQuestion): string {
    const selected = q.answers
      .filter((a) => q.selectedAnswerIds.includes(a.answerId))
      .map((a) => a.content);
    return selected.length > 0 ? selected.join(', ') : 'Để trống';
  }

  /** Nội dung các đáp án đúng */
  correctText(q: AttemptResultQuestion): string {
    return q.answers
      .filter((a) => a.isCorrect)
      .map((a) => a.content)
      .join(', ');
  }

  getScoreMessage(percentage: number): string {
    if (this.gradableCount === 0) return '✍️ Bài của bạn đang chờ chấm thủ công';
    if (percentage >= 90) return '🎉 Tuyệt vời!';
    if (percentage >= 80) return '👏 Tốt lắm!';
    if (percentage >= 70) return '😊 Khá tốt';
    if (percentage >= 50) return '📚 Cần cải thiện';
    return '💪 Tiếp tục cố gắng!';
  }

  formatDateTime(date: string | null): string {
    return date ? new Date(date).toLocaleString('vi-VN') : '-';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
