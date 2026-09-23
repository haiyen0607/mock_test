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
<div class="bg-page min-vh-100 py-5">
  <div class="container max-w-800">
    <!-- Back btn -->
    <a routerLink="/quiz/browse" class="btn btn-white shadow-sm rounded-pill mb-4 px-4 fw-medium text-secondary hover-primary">
      ← Quay lại danh sách
    </a>

    <!-- Loading -->
    <div *ngIf="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;"></div>
      <p class="mt-3 text-muted fs-5">Đang tải kết quả...</p>
    </div>

    <!-- Error -->
    <div *ngIf="errorMessage" class="alert alert-danger rounded-4 shadow-sm border-0 p-4">
      <h5 class="alert-heading fw-bold">⚠️ Lỗi</h5>
      <p class="mb-0">{{ errorMessage }}</p>
    </div>

    <!-- Content -->
    <div *ngIf="result && !isLoading">
      <!-- Hero Card -->
      <div class="card border-0 rounded-4 shadow-lg mb-5 hero-card overflow-hidden">
        <!-- Visual ring effect -->
        <div class="hero-ring ring-1"></div>
        <div class="hero-ring ring-2"></div>

        <div class="card-body p-5 text-center text-white position-relative z-1">
          <div class="score-circle mx-auto mb-4 d-flex align-items-center justify-content-center shadow-lg">
            <h1 class="display-3 fw-bold mb-0">{{ percentage }}%</h1>
          </div>

          <h3 class="fw-bold mb-1">{{ getScoreMessage(percentage) }}</h3>
          <h5 class="text-white-50 fw-normal mb-4">{{ result.title }}</h5>

          <div class="d-flex flex-wrap gap-3 justify-content-center mt-2">
            <div class="stat-badge rounded-pill px-4 py-2 bg-white bg-opacity-10 backdrop-blur border border-white border-opacity-25">
              <span class="fs-5 me-2">🎯</span>
              <span class="fw-medium">Đúng {{ correctCount }}/{{ gradableCount }}</span>
            </div>
            <div *ngIf="pendingCount > 0" class="stat-badge rounded-pill px-4 py-2 bg-warning bg-opacity-25 backdrop-blur border border-warning border-opacity-50 text-warning">
              <span class="fs-5 me-2">✍️</span>
              <span class="fw-medium">Chờ chấm {{ pendingCount }}</span>
            </div>
          </div>

          <p class="small text-white-50 mt-4 mb-0">
            Nộp lúc: {{ formatDateTime(result.submittedAt) }}
          </p>
        </div>
      </div>

      <!-- Detail list -->
      <h4 class="fw-bold mb-4 text-secondary px-2"><i class="bi bi-card-list"></i> Chi Tiết Từng Câu</h4>

      <div class="d-flex flex-column gap-3 mb-5">
        <div *ngFor="let q of result.questions; let i = index"
             class="card border-0 shadow-sm rounded-4 question-review-card bg-white">
          <div class="card-body p-4">
            <div class="d-flex gap-4">
              <!-- Left Icon Badge -->
              <div class="flex-shrink-0 mt-1">
                <div class="status-icon rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                     [ngClass]="{
                       'bg-success text-white': q.isCorrect === true,
                       'bg-danger text-white': q.isCorrect === false,
                       'bg-warning text-secondary': q.isCorrect === null
                     }">
                  <span *ngIf="q.isCorrect === true">✓</span>
                  <span *ngIf="q.isCorrect === false">✗</span>
                  <span *ngIf="q.isCorrect === null"><i class="bi bi-hourglass-split"></i></span>
                </div>
              </div>

              <!-- Content -->
              <div class="flex-grow-1">
                <h6 class="fw-bold fs-5 mb-3 text-secondary">Câu {{ i + 1 }}: {{ q.content }}</h6>

                <div class="review-box rounded-3 p-3 bg-light">
                  <ng-container *ngIf="hasOptions(q)">
                    <div class="d-flex flex-column gap-2">
                      <div class="d-flex align-items-start gap-2"
                           [ngClass]="q.isCorrect ? 'text-success' : 'text-danger'">
                        <span class="fw-bold">{{ q.isCorrect ? '✓' : '✗' }} Bạn chọn:</span>
                        <span class="fw-medium">{{ selectedText(q) }}</span>
                      </div>
                      <div *ngIf="q.isCorrect === false" class="d-flex align-items-start gap-2 text-success mt-1 pt-2 border-top">
                        <span class="fw-bold">✓ Đáp án đúng:</span>
                        <span class="fw-medium">{{ correctText(q) }}</span>
                      </div>
                    </div>
                  </ng-container>

                  <ng-container *ngIf="!hasOptions(q)">
                    <div class="d-flex flex-column gap-2">
                      <div class="d-flex align-items-start gap-2 text-secondary">
                        <span><i class="bi bi-file-earmark-text"></i> Bạn trả lời:</span>
                        <span class="fw-medium">{{ q.responseText || 'Để trống' }}</span>
                      </div>
                      <div class="mt-2 pt-2 border-top">
                        <div *ngIf="q.isCorrect === true" class="text-success fw-medium">✓ Được chấm: Đúng</div>
                        <div *ngIf="q.isCorrect === false" class="text-danger fw-medium">✗ Được chấm: Sai</div>
                        <div *ngIf="q.isCorrect === null" class="text-warning fw-medium"><i class="bi bi-hourglass-split"></i> Đang chờ chấm thủ công</div>
                      </div>
                    </div>
                  </ng-container>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="result.questions.length === 0" class="text-center py-5 bg-white rounded-4 shadow-sm border-0">
          <p class="text-muted mb-0 fs-5">Không có dữ liệu câu trả lời.</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="d-flex justify-content-center pb-5">
        <button class="btn btn-primary btn-lg rounded-pill px-5 py-3 custom-gradient text-white border-0 shadow-lg fw-bold fs-5"
                routerLink="/quiz/browse">
          Làm Quiz Khác
        </button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [
    `
      .bg-page { background-color: #f8f9ff; }
      .max-w-800 { max-width: 800px; margin: 0 auto; }
      .custom-gradient { background: linear-gradient(135deg, #667eea, #764ba2); }
      .hero-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        position: relative;
        border-radius: 12px;
      }
      .hero-ring {
        position: absolute;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.1);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .ring-1 { width: 300px; height: 300px; border-width: 4px; }
      .ring-2 { width: 450px; height: 450px; border-width: 2px; }
      .score-circle {
        width: 150px;
        height: 150px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        border: 4px solid rgba(255, 255, 255, 0.5);
      }
      .backdrop-blur { backdrop-filter: blur(5px); }
      .btn-white { background-color: #fff; border: 1px solid #e2e8f0; }
      .hover-primary:hover { color: #667eea !important; border-color: #667eea; }
      .question-review-card {
        border-radius: 12px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .question-review-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 .5rem 1rem rgba(0,0,0,.08) !important;
      }
      .status-icon { width: 40px; height: 40px; font-size: 1.25rem; font-weight: bold; }
      .review-box { border: 1px solid #e2e8f0; }
      .z-1 { z-index: 1; }
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
    if (percentage >= 90) return '<i class="bi bi-stars"></i> Tuyệt vời!';
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
