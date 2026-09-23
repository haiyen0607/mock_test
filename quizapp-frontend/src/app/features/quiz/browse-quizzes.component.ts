import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../core/services/quiz.service';
import { AuthService } from '../../core/services/auth.service';
import { QuizListItem } from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-browse-quizzes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div style="background: #f8f9ff; min-height: 100vh;">
      <!-- Hero Section -->
      <div class="hero-section text-white text-center py-5" style="background: linear-gradient(135deg,#667eea,#764ba2);">
        <div class="container">
          <h1 class="display-5 fw-bold mb-2"><i class="bi bi-trophy"></i> Khám Phá Quiz</h1>
          <p class="lead mb-4 opacity-75">Tìm kiếm và thử sức với hàng ngàn bài trắc nghiệm thú vị</p>
          <!-- Search Bar in Hero -->
          <div class="search-wrapper mx-auto" style="max-width: 560px;">
            <div class="d-flex align-items-center search-pill">
              <span class="px-3 text-muted"><i class="bi bi-search"></i></span>
              <input
                type="text"
                class="form-control border-0 shadow-none bg-transparent"
                placeholder="Tìm kiếm quiz theo tiêu đề..."
                [(ngModel)]="searchTerm"
                (ngModelChange)="onSearch($event)"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="container py-5">
        <!-- Stats Bar -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h5 class="mb-0 fw-medium text-secondary">
            Kết quả
            <span class="badge rounded-pill ms-2" style="background: linear-gradient(135deg,#667eea,#764ba2);">{{ quizzes.length }} quiz</span>
          </h5>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="text-center py-5">
          <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; color: #667eea;">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-3 text-muted fw-medium">Đang tải...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show">
          {{ errorMessage }}
          <button type="button" class="btn-close" (click)="errorMessage = null"></button>
        </div>

        <!-- Quiz Cards Grid -->
        <div class="row g-4">
          <div *ngFor="let quiz of quizzes" class="col-md-6 col-lg-4">
            <div class="quiz-card h-100">
              <div class="quiz-card-accent"></div>
              <div class="quiz-card-body d-flex flex-column p-4">
                <h5 class="fw-medium text-secondary mb-2 quiz-title">{{ quiz.title }}</h5>
                <p class="text-muted flex-grow-1 quiz-desc mb-3">{{ quiz.description || 'Chưa có mô tả' }}</p>

                <!-- Info Pills -->
                <div class="d-flex flex-wrap gap-2 mb-4">
                  <span class="info-pill"><i class="bi bi-person"></i> {{ quiz.ownerUsername }}</span>
                  <span class="info-pill"><i class="bi bi-file-earmark-text"></i> {{ quiz.questionCount }} câu</span>
                  <span class="info-pill"><i class="bi bi-stopwatch"></i> {{ quiz.duration }} phút</span>
                </div>

                <!-- Action Buttons -->
                <div class="d-flex gap-2 mt-auto">
                  <a class="btn btn-detail flex-fill" [routerLink]="['/quiz/detail', quiz.quizId]">Chi Tiết</a>
                  <button class="btn btn-start flex-fill" (click)="startAttempt(quiz.quizId)">
                    {{ isLoggedIn ? 'Bắt Đầu' : 'Thử Miễn Phí' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading && !errorMessage && quizzes.length === 0" class="text-center py-5">
          <div style="font-size: 3.5rem; margin-bottom: 1rem; opacity: 0.5;"><i class="bi bi-inbox"></i></div>
          <h4 class="fw-medium text-secondary">Không tìm thấy quiz</h4>
          <p class="text-muted">Chưa có quiz nào được publish. Thử từ khóa khác nhé!</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .search-pill {
      background: white;
      border-radius: 50px;
      padding: 0.3rem 0.5rem;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    }

    .search-pill .form-control {
      font-size: 1rem;
      padding: 0.6rem 0.5rem;
    }

    .quiz-card {
      background: white;
      border: 1px solid #e8eaf6;
      border-radius: 14px;
      box-shadow: 0 2px 8px rgba(102,126,234,0.07);
      overflow: hidden;
      transition: all 0.25s ease;
    }

    .quiz-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 30px rgba(102,126,234,0.15);
      border-color: rgba(102,126,234,0.3);
    }

    .quiz-card-accent {
      height: 4px;
      background: linear-gradient(135deg, #667eea, #764ba2);
    }

    .quiz-title {
      font-size: 1rem;
      line-height: 1.4;
    }

    .quiz-desc {
      font-size: 0.875rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .info-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.3rem 0.7rem;
      background: #f1f3f9;
      color: #4b5563;
      border-radius: 50px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .btn-detail {
      border: 1.5px solid #667eea;
      color: #667eea;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      transition: all 0.2s;
    }

    .btn-detail:hover {
      background: #667eea;
      color: white;
    }

    .btn-start {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      transition: opacity 0.2s, transform 0.2s;
    }

    .btn-start:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      color: white;
    }
  `]
})
export class BrowseQuizzesComponent implements OnInit, OnDestroy {
  quizzes: QuizListItem[] = [];
  searchTerm = '';
  isLoading = false;
  errorMessage: string | null = null;
  isLoggedIn = false;
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private quizService: QuizService,
    private authService: AuthService,
    private router: Router
  ) {
    this.isLoggedIn = this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    this.loadQuizzes();

    // Search với debounce 300ms — backend gộp browse + search trong 1 endpoint
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((term) => this.loadQuizzes(term));
  }

  loadQuizzes(search?: string): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.quizService
      .getPublicQuizzes(search)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.quizzes = data;
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = 'Không thể tải danh sách quiz. Vui lòng thử lại.';
          console.error(err);
        }
      });
  }

  onSearch(term: string): void {
    this.searchSubject.next(term);
  }

  startAttempt(quizId: number): void {
    this.router.navigate(['/quiz/attempt', quizId]);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('vi-VN');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
