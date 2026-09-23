// UC12 – Manage Own Quiz (xem/sửa/xóa) + UC14 – Publish Quiz

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { QuizListItem } from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-my-quizzes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-bg min-vh-100 py-5">
      <div class="container">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h1 class="m-0 text-secondary"><i class="bi bi-card-list"></i> Quiz Của Tôi</h1>
          <a class="btn btn-gradient" routerLink="/dashboard/quiz-create">
            + Tạo Quiz Mới
          </a>
        </div>

        <!-- Loading -->
        <div *ngIf="isLoading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status"></div>
          <p class="mt-2 text-muted">Đang tải...</p>
        </div>

        <!-- Error -->
        <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show shadow-sm border-0 rounded-3">
          {{ errorMessage }}
          <button type="button" class="btn-close" (click)="errorMessage = null"></button>
        </div>

        <!-- Success -->
        <div *ngIf="successMessage" class="alert alert-success alert-dismissible fade show shadow-sm border-0 rounded-3">
          {{ successMessage }}
          <button type="button" class="btn-close" (click)="successMessage = null"></button>
        </div>

        <!-- Table -->
        <div *ngIf="!isLoading && quizzes.length > 0" class="card card-custom">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light thead-custom">
                <tr>
                  <th>Tiêu đề & Mô tả</th>
                  <th class="text-center">Câu hỏi</th>
                  <th class="text-center">Thời gian</th>
                  <th class="text-center">Trạng thái</th>
                  <th class="text-end">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let quiz of quizzes">
                  <td>
                    <div class="fw-medium text-secondary">{{ quiz.title }}</div>
                    <div class="small text-muted">{{ quiz.description || 'Chưa có mô tả' }}</div>
                  </td>
                  <td class="text-center">
                    <span class="badge bg-light text-secondary border">{{ quiz.questionCount }}</span>
                  </td>
                  <td class="text-center text-secondary">{{ quiz.duration }} phút</td>
                  <td class="text-center">
                    <span class="badge badge-pill-custom" [ngClass]="quiz.isPublished ? 'bg-success' : 'bg-secondary'">
                      {{ quiz.isPublished ? 'Đã publish' : 'Riêng tư' }}
                    </span>
                  </td>
                  <td class="text-end">
                    <a class="btn btn-sm btn-outline-success me-1 rounded-pill px-3" [routerLink]="['/dashboard/quiz-questions', quiz.quizId]">
                      Câu hỏi
                    </a>
                    <a class="btn btn-sm btn-outline-primary me-1 rounded-pill px-3" [routerLink]="['/dashboard/quiz-edit', quiz.quizId]">
                      Sửa
                    </a>
                    <button
                      class="btn btn-sm me-1 rounded-pill px-3"
                      [ngClass]="quiz.isPublished ? 'btn-outline-warning' : 'btn-outline-info'"
                      (click)="togglePublish(quiz)"
                      [disabled]="busyId === quiz.quizId"
                    >
                      {{ quiz.isPublished ? 'Unpublish' : 'Publish' }}
                    </button>
                    <button
                      class="btn btn-sm btn-outline-danger rounded-pill px-3"
                      (click)="deleteQuiz(quiz)"
                      [disabled]="busyId === quiz.quizId"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Empty state -->
        <div *ngIf="!isLoading && !errorMessage && quizzes.length === 0" class="card card-custom empty-state">
          <div class="empty-emoji"><i class="bi bi-file-earmark-text"></i></div>
          <h4 class="text-secondary mb-2">Chưa có quiz nào</h4>
          <p class="text-muted mb-4">Bạn chưa tạo quiz nào. Hãy bắt đầu ngay!</p>
          <a class="btn btn-gradient px-4 py-2" routerLink="/dashboard/quiz-create">Tạo Quiz Mới</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-bg { background-color: #f8f9ff; }

    .btn-gradient {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      padding: 0.55rem 1.2rem;
      transition: all 0.2s;
    }
    .btn-gradient:hover { opacity: 0.9; transform: translateY(-1px); color: white; box-shadow: 0 4px 12px rgba(102,126,234,0.3); }

    .card-custom {
      border-radius: 14px;
      border: 1px solid #e8eaf6;
      box-shadow: 0 2px 12px rgba(102,126,234,0.07);
      overflow: hidden;
      background: white;
    }

    .thead-custom th {
      text-transform: uppercase;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #6b7280;
      padding-top: 1rem;
      padding-bottom: 1rem;
      background: #f8f9ff;
    }

    .badge-pill-custom {
      border-radius: 50rem;
      padding: 0.4em 0.85em;
      font-weight: 600;
    }

    .empty-state {
      padding: 5rem 2rem;
      text-align: center;
    }
    .empty-emoji { font-size: 3.5rem; margin-bottom: 1rem; }
  `]
})
export class MyQuizzesComponent implements OnInit, OnDestroy {
  quizzes: QuizListItem[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  busyId: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(private quizService: QuizService) {}

  ngOnInit(): void {
    this.loadMyQuizzes();
  }

  // UC12 – GET /api/quizzes/mine
  loadMyQuizzes(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.quizService
      .getMyQuizzes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.quizzes = data;
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = 'Không thể tải danh sách quiz của bạn.';
          console.error(err);
        }
      });
  }

  // UC14 – PUT /api/quizzes/{id}/publish  body: { publish: true|false }
  togglePublish(quiz: QuizListItem): void {
    const publish = !quiz.isPublished;

    // UC14 A1: backend từ chối publish quiz 0 câu hỏi — chặn sớm cho thân thiện
    if (publish && quiz.questionCount === 0) {
      this.errorMessage = 'Quiz "' + quiz.title + '" chưa có câu hỏi nào — thêm ít nhất 1 câu trước khi publish (bấm Câu hỏi).';
      return;
    }

    this.busyId = quiz.quizId;
    this.errorMessage = null;

    this.quizService
      .setPublish(quiz.quizId, publish)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          quiz.isPublished = publish;
          this.busyId = null;
          this.successMessage = publish
            ? 'Đã publish "' + quiz.title + '" — mọi người có thể làm quiz này.'
            : 'Đã chuyển "' + quiz.title + '" về riêng tư.';
        },
        error: (err) => {
          this.busyId = null;
          this.errorMessage = err?.response?.data?.detail || 'Thao tác thất bại.';
        }
      });
  }

  // UC12 – DELETE /api/quizzes/{id}
  deleteQuiz(quiz: QuizListItem): void {
    if (!confirm('Xóa quiz "' + quiz.title + '"? Toàn bộ lượt làm bài của quiz này cũng sẽ bị xóa.')) {
      return;
    }

    this.busyId = quiz.quizId;
    this.errorMessage = null;

    this.quizService
      .deleteQuiz(quiz.quizId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.quizzes = this.quizzes.filter((q) => q.quizId !== quiz.quizId);
          this.busyId = null;
          this.successMessage = 'Đã xóa quiz "' + quiz.title + '".';
        },
        error: (err) => {
          this.busyId = null;
          this.errorMessage = err?.response?.data?.detail || 'Xóa quiz thất bại.';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
