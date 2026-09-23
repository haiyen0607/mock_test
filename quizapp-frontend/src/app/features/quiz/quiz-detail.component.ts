import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { AuthService } from '../../core/services/auth.service';
import { QuizDetail } from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-quiz-detail',
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
        <p class="mt-2 text-muted">Đang tải chi tiết...</p>
      </div>

      <!-- Error -->
      <div *ngIf="errorMessage" class="alert alert-danger">
        {{ errorMessage }}
      </div>

      <!-- Content -->
      <div *ngIf="quiz && !isLoading" class="row">
        <!-- Main Content -->
        <div class="col-lg-8">
          <div class="card shadow-sm mb-4">
            <div class="card-body">
              <h1 class="card-title">{{ quiz.title }}</h1>
              <p class="card-text text-muted">{{ quiz.description || 'Chưa có mô tả' }}</p>

              <!-- Quiz Stats (UC06) -->
              <div class="row mt-4">
                <div class="col-md-4">
                  <small class="text-muted">Số Câu Hỏi</small>
                  <p class="fw-bold">{{ quiz.questions.length }}</p>
                </div>
                <div class="col-md-4">
                  <small class="text-muted">Thời Gian</small>
                  <p class="fw-bold">{{ quiz.duration }} phút</p>
                </div>
                <div class="col-md-4">
                  <small class="text-muted">Người Tạo</small>
                  <p class="fw-bold">{{ quiz.ownerUsername }}</p>
                </div>
              </div>

              <!-- Questions Preview (không lộ đáp án) -->
              <div class="mt-5">
                <h5>📋 Các Câu Hỏi ({{ quiz.questions.length }})</h5>
                <div class="list-group">
                  <div
                    *ngFor="let q of quiz.questions; let i = index"
                    class="list-group-item"
                  >
                    <div class="d-flex justify-content-between align-items-start">
                      <div>
                        <h6>Câu {{ i + 1 }}: {{ q.content }}</h6>
                        <small class="text-muted">Loại: {{ typeLabel(q.questionType) }}</small>
                      </div>
                      <span *ngIf="q.answerCount > 0" class="badge bg-info">{{ q.answerCount }} đáp án</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="col-lg-4">
          <div class="card shadow-sm sticky-top" style="top: 20px;">
            <div class="card-body">
              <h5>Bắt Đầu Làm Quiz</h5>
              <p class="text-muted small">
                Bạn sẽ trả lời {{ quiz.questions.length }} câu hỏi trong {{ quiz.duration }} phút
                và xem kết quả sau khi nộp bài.
              </p>

              <div class="d-grid gap-2 mt-4">
                <button
                  class="btn btn-success btn-lg"
                  (click)="startQuiz()"
                >
                  {{ isLoggedIn ? '▶️ Bắt Đầu' : '▶️ Thử Miễn Phí' }}
                </button>
              </div>

              <div *ngIf="!isLoggedIn" class="mt-3 p-3 bg-light rounded">
                <small class="text-muted">
                  ℹ️ Khách chỉ được làm thử tối đa 3 lượt. Đăng ký để làm không giới hạn!
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class QuizDetailComponent implements OnInit, OnDestroy {
  quiz: QuizDetail | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  isLoggedIn = false;
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
          this.errorMessage = err?.response?.data?.detail || 'Không thể tải chi tiết quiz.';
          console.error(err);
        }
      });
  }

  startQuiz(): void {
    this.router.navigate(['/quiz/attempt', this.quizId]);
  }

  typeLabel(type: string): string {
    const map: { [key: string]: string } = {
      MultipleChoice: 'Chọn nhiều đáp án',
      SingleChoice: 'Chọn 1 đáp án',
      TrueFalse: 'Đúng / Sai',
      FillInTheBlanks: 'Điền vào chỗ trống',
      ShortAnswer: 'Trả lời ngắn',
      LongAnswer: 'Tự luận'
    };
    return map[type] || type;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
