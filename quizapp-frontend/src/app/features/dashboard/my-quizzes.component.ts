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
    <div class="container py-5">
      <!-- Header -->
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>🗂️ Quiz Của Tôi</h1>
        <a class="btn btn-primary" routerLink="/dashboard/quiz-create">
          ➕ Tạo Quiz Mới
        </a>
      </div>

      <!-- Loading -->
      <div *ngIf="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
        <p class="mt-2 text-muted">Đang tải...</p>
      </div>

      <!-- Error -->
      <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show">
        {{ errorMessage }}
        <button type="button" class="btn-close" (click)="errorMessage = null"></button>
      </div>

      <!-- Success -->
      <div *ngIf="successMessage" class="alert alert-success alert-dismissible fade show">
        {{ successMessage }}
        <button type="button" class="btn-close" (click)="successMessage = null"></button>
      </div>

      <!-- Bảng danh sách quiz -->
      <div *ngIf="!isLoading && quizzes.length > 0" class="card shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Tiêu đề</th>
                <th class="text-center">Số câu hỏi</th>
                <th class="text-center">Thời gian</th>
                <th class="text-center">Trạng thái</th>
                <th class="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let quiz of quizzes">
                <td>
                  <strong>{{ quiz.title }}</strong>
                  <div class="small text-muted">{{ quiz.description || 'Chưa có mô tả' }}</div>
                </td>
                <td class="text-center">{{ quiz.questionCount }}</td>
                <td class="text-center">{{ quiz.duration }} phút</td>
                <td class="text-center">
                  <span class="badge" [ngClass]="quiz.isPublished ? 'bg-success' : 'bg-secondary'">
                    {{ quiz.isPublished ? 'Đã publish' : 'Riêng tư' }}
                  </span>
                </td>
                <td class="text-end">
                  <!-- UC13: quản lý câu hỏi -->
                  <a class="btn btn-sm btn-outline-success me-1" [routerLink]="['/dashboard/quiz-questions', quiz.quizId]">
                    📋 Câu hỏi
                  </a>
                  <!-- UC12: sửa -->
                  <a class="btn btn-sm btn-outline-primary me-1" [routerLink]="['/dashboard/quiz-edit', quiz.quizId]">
                    ✏️ Sửa
                  </a>
                  <!-- UC14: publish/unpublish -->
                  <button
                    class="btn btn-sm me-1"
                    [ngClass]="quiz.isPublished ? 'btn-outline-warning' : 'btn-outline-info'"
                    (click)="togglePublish(quiz)"
                    [disabled]="busyId === quiz.quizId"
                  >
                    {{ quiz.isPublished ? '🔒 Unpublish' : '🌍 Publish' }}
                  </button>
                  <!-- UC12: xóa -->
                  <button
                    class="btn btn-sm btn-outline-danger"
                    (click)="deleteQuiz(quiz)"
                    [disabled]="busyId === quiz.quizId"
                  >
                    🗑️ Xóa
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="!isLoading && !errorMessage && quizzes.length === 0" class="text-center py-5">
        <p class="text-muted">Bạn chưa có quiz nào. Bấm "Tạo Quiz Mới" để bắt đầu!</p>
      </div>
    </div>
  `,
  styles: []
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
      this.errorMessage = 'Quiz "' + quiz.title + '" chưa có câu hỏi nào — thêm ít nhất 1 câu trước khi publish (bấm 📋 Câu hỏi).';
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
