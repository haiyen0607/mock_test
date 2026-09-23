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
    <div style="background: #f8f9ff; min-height: 100vh; padding: 2rem 0;">
      <div class="container">
        <!-- Back Button -->
        <a routerLink="/quiz/browse" class="btn btn-back mb-4">
          ← Quay lại danh sách
        </a>

        <!-- Loading -->
        <div *ngIf="isLoading" class="text-center py-5">
          <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: #667eea;">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-3 text-muted fw-medium">Đang tải chi tiết...</p>
        </div>

        <!-- Error -->
        <div *ngIf="errorMessage" class="alert alert-danger rounded-3 shadow-sm border-0">
          {{ errorMessage }}
        </div>

        <!-- Content -->
        <div *ngIf="quiz && !isLoading" class="row g-4">
          <!-- Main Content -->
          <div class="col-lg-8">
            <div class="detail-card mb-4">
              <div class="detail-card-body">
                <h1 class="quiz-title mb-3">{{ quiz.title }}</h1>
                <p class="quiz-desc mb-5">{{ quiz.description || 'Chưa có mô tả.' }}</p>

                <!-- Stats Row -->
                <div class="row g-3 mb-5">
                  <div class="col-4">
                    <div class="stat-box text-center p-3">
                      <div class="stat-emoji"><i class="bi bi-file-earmark-text"></i></div>
                      <small class="text-muted d-block fw-bold text-uppercase" style="font-size: 0.7rem; letter-spacing: 0.05em;">Câu hỏi</small>
                      <h4 class="fw-medium text-secondary mb-0 mt-1">{{ quiz.questions.length }}</h4>
                    </div>
                  </div>
                  <div class="col-4">
                    <div class="stat-box text-center p-3">
                      <div class="stat-emoji"><i class="bi bi-stopwatch"></i></div>
                      <small class="text-muted d-block fw-bold text-uppercase" style="font-size: 0.7rem; letter-spacing: 0.05em;">Thời gian</small>
                      <h4 class="fw-medium text-secondary mb-0 mt-1">{{ quiz.duration }} phút</h4>
                    </div>
                  </div>
                  <div class="col-4">
                    <div class="stat-box text-center p-3">
                      <div class="stat-emoji"><i class="bi bi-person"></i></div>
                      <small class="text-muted d-block fw-bold text-uppercase" style="font-size: 0.7rem; letter-spacing: 0.05em;">Tác giả</small>
                      <h5 class="fw-medium text-secondary mb-0 mt-1 text-truncate" [title]="quiz.ownerUsername">{{ quiz.ownerUsername }}</h5>
                    </div>
                  </div>
                </div>

                <!-- Questions List -->
                <h4 class="fw-medium text-secondary mb-4"><i class="bi bi-card-list"></i> Danh sách câu hỏi</h4>
                <div class="d-flex flex-column gap-2">
                  <div *ngFor="let q of quiz.questions; let i = index" class="question-row p-3">
                    <div class="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <span class="q-index">{{ i + 1 }}</span>
                        <span class="ms-2 fw-medium text-secondary">{{ q.content }}</span>
                      </div>
                      <span class="type-badge flex-shrink-0">{{ typeLabel(q.questionType) }}</span>
                    </div>
                  </div>
                  <div *ngIf="quiz.questions.length === 0" class="text-center py-4 text-muted">
                    Quiz này chưa có câu hỏi nào.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="col-lg-4">
            <div class="sidebar-card sticky-top" style="top: 2rem;">
              <div class="sidebar-accent"></div>
              <div class="p-4">
                <h4 class="fw-medium text-secondary mb-3">Sẵn sàng chưa?</h4>
                <p class="text-muted mb-4" style="font-size: 0.9rem;">
                  Bạn sẽ trả lời <strong class="text-secondary">{{ quiz.questions.length }} câu hỏi</strong> trong
                  <strong class="text-secondary">{{ quiz.duration }} phút</strong>. Kết quả sẽ hiển thị ngay sau khi nộp.
                </p>
                <div class="d-grid">
                  <button class="btn btn-start btn-lg" (click)="startQuiz()">
                    {{ isLoggedIn ? '▶️ Bắt Đầu Làm Bài' : '▶️ Thử Miễn Phí' }}
                  </button>
                </div>
                <div *ngIf="!isLoggedIn" class="guest-box mt-4 p-3 rounded-3">
                  <div class="d-flex gap-2">
                    <span>ℹ️</span>
                    <small class="text-muted">
                      Khách chỉ được làm thử tối đa <strong>3 lượt</strong>. Đăng ký để làm không giới hạn!
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .btn-back {
      background: white;
      border: 1.5px solid #e8eaf6;
      border-radius: 50px;
      color: #6b7280;
      font-weight: 500;
      padding: 0.5rem 1.2rem;
      transition: all 0.2s;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      text-decoration: none;
    }
    .btn-back:hover { border-color: #667eea; color: #667eea; }

    .detail-card {
      background: white;
      border-radius: 14px;
      border: 1px solid #e8eaf6;
      box-shadow: 0 2px 12px rgba(102,126,234,0.07);
      overflow: hidden;
    }
    .detail-card-body { padding: 2.5rem; }

    .quiz-title { font-size: 1.75rem; font-weight: 800; color: #1a1a2e; letter-spacing: -0.02em; }
    .quiz-desc { color: #6b7280; font-size: 1.05rem; line-height: 1.7; }

    .stat-box {
      background: #f8f9ff;
      border: 1px solid #e8eaf6;
      border-radius: 12px;
      transition: transform 0.2s;
    }
    .stat-box:hover { transform: translateY(-2px); }
    .stat-emoji { font-size: 1.5rem; margin-bottom: 0.3rem; }

    .question-row {
      background: white;
      border: 1px solid #e8eaf6;
      border-left: 4px solid #667eea;
      border-radius: 8px;
      transition: background 0.15s;
    }
    .question-row:hover { background: #f8f9ff; }

    .q-index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border-radius: 50%;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .type-badge {
      background: #f1f3f9;
      color: #4b5563;
      border-radius: 6px;
      padding: 0.25rem 0.6rem;
      font-size: 0.78rem;
      font-weight: 600;
    }

    .sidebar-card {
      background: white;
      border-radius: 14px;
      border: 1px solid #e8eaf6;
      box-shadow: 0 2px 12px rgba(102,126,234,0.07);
      overflow: hidden;
    }
    .sidebar-accent {
      height: 6px;
      background: linear-gradient(135deg, #667eea, #764ba2);
    }

    .btn-start {
      background: linear-gradient(135deg, #43e97b, #38f9d7);
      border: none;
      border-radius: 10px;
      color: #065f46;
      font-weight: 700;
      padding: 0.85rem;
      transition: all 0.2s;
      box-shadow: 0 3px 12px rgba(67,233,123,0.3);
    }
    .btn-start:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(67,233,123,0.4); color: #065f46; }

    .guest-box { background: #fffbeb; border: 1px solid #fde68a; }
  `]
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
