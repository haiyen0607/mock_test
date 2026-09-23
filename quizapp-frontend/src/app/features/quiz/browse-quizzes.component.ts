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
    <div class="container py-5">
      <!-- Header -->
      <div class="d-flex justify-content-between align-items-center mb-5">
        <h1>📚 Danh Sách Quiz</h1>
      </div>

      <!-- Search Bar (UC05 - lọc theo tiêu đề) -->
      <div class="mb-4">
        <input
          type="text"
          class="form-control form-control-lg"
          placeholder="🔍 Tìm kiếm quiz theo tiêu đề..."
          [(ngModel)]="searchTerm"
          (ngModelChange)="onSearch($event)"
        />
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 text-muted">Đang tải...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show">
        {{ errorMessage }}
        <button type="button" class="btn-close" (click)="errorMessage = null"></button>
      </div>

      <!-- Quiz Cards Grid -->
      <div class="row g-4">
        <div *ngFor="let quiz of quizzes" class="col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm hover-card">
            <div class="card-body d-flex flex-column">
              <h5 class="card-title">{{ quiz.title }}</h5>
              <p class="card-text text-muted flex-grow-1">{{ quiz.description || 'Chưa có mô tả' }}</p>

              <!-- Quiz Info -->
              <div class="small text-muted mb-3">
                <div>👤 {{ quiz.ownerUsername }}</div>
                <div>📝 {{ quiz.questionCount }} câu hỏi</div>
                <div>⏱️ {{ quiz.duration }} phút</div>
                <div>📅 {{ formatDate(quiz.createdAt) }}</div>
              </div>

              <!-- Action Buttons -->
              <div class="d-grid gap-2">
                <button
                  class="btn btn-sm btn-outline-primary"
                  [routerLink]="['/quiz/detail', quiz.quizId]"
                >
                  Chi Tiết
                </button>
                <button
                  class="btn btn-sm btn-success"
                  (click)="startAttempt(quiz.quizId)"
                >
                  {{ isLoggedIn ? 'Bắt Đầu' : 'Thử Miễn Phí' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Results -->
      <div *ngIf="!isLoading && !errorMessage && quizzes.length === 0" class="text-center py-5">
        <p class="text-muted">Chưa có quiz nào được publish. Thử tìm kiếm khác nhé!</p>
      </div>
    </div>
  `,
  styles: [`
    .hover-card {
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .hover-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important;
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
