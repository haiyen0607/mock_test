// UC19 – Manage System Quizzes + UC20 – Moderate Content
// Admin xem MỌI quiz trong hệ thống, gỡ (Removed) / khôi phục (Active) quiz,
// và mở rộng từng quiz để kiểm duyệt từng câu hỏi bên trong.

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { QuizService } from '../../core/services/quiz.service';
import { QuizListItem, QuestionSummary } from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-quizzes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container py-5">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>🛡️ Kiểm Duyệt Nội Dung</h1>
        <a routerLink="/admin/users" class="btn btn-outline-primary">👥 Quản Lý User →</a>
      </div>

      <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show">
        {{ errorMessage }}
        <button type="button" class="btn-close" (click)="errorMessage = null"></button>
      </div>

      <div *ngIf="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="!isLoading" class="card shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Quiz</th>
                <th class="text-center">Người tạo</th>
                <th class="text-center">Publish</th>
                <th class="text-center">Kiểm duyệt</th>
                <th class="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let quiz of quizzes">
                <tr>
                  <td>
                    <strong>{{ quiz.title }}</strong>
                    <div class="small text-muted">{{ quiz.questionCount }} câu hỏi</div>
                  </td>
                  <td class="text-center">{{ quiz.ownerUsername }}</td>
                  <td class="text-center">
                    <span class="badge" [ngClass]="quiz.isPublished ? 'bg-success' : 'bg-secondary'">
                      {{ quiz.isPublished ? 'Public' : 'Private' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span class="badge" [ngClass]="quiz.status === 'Active' ? 'bg-success' : 'bg-danger'">
                      {{ quiz.status }}
                    </span>
                  </td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary me-1" (click)="toggleExpand(quiz.quizId)">
                      {{ expandedQuizId === quiz.quizId ? '▲ Đóng' : '▼ Câu hỏi' }}
                    </button>
                    <!-- UC19/UC20: gỡ hoặc khôi phục quiz -->
                    <button
                      class="btn btn-sm"
                      [ngClass]="quiz.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'"
                      (click)="toggleQuizStatus(quiz)"
                      [disabled]="busyId === quiz.quizId"
                    >
                      {{ quiz.status === 'Active' ? '🚫 Gỡ Quiz' : '✅ Khôi phục' }}
                    </button>
                  </td>
                </tr>

                <!-- Hàng mở rộng: kiểm duyệt từng câu hỏi (UC20) -->
                <tr *ngIf="expandedQuizId === quiz.quizId">
                  <td colspan="5" class="bg-light">
                    <div *ngIf="loadingQuestions" class="text-center py-2">
                      <div class="spinner-border spinner-border-sm text-primary"></div>
                    </div>
                    <ul class="list-group" *ngIf="!loadingQuestions">
                      <li *ngFor="let q of expandedQuestions; let i = index" class="list-group-item d-flex align-items-center">
                        <div class="flex-grow-1">
                          Câu {{ i + 1 }}: {{ q.content }}
                          <small class="text-muted d-block">{{ q.questionType }}</small>
                        </div>
                        <!-- UC20 – PUT /admin/questions/{id}/status -->
                        <button class="btn btn-sm btn-outline-danger me-1" (click)="setQuestionStatus(q.questionId, 'Removed')">
                          🚫 Gỡ câu hỏi
                        </button>
                        <button class="btn btn-sm btn-outline-success" (click)="setQuestionStatus(q.questionId, 'Active')">
                          ✅ Khôi phục
                        </button>
                      </li>
                      <li *ngIf="expandedQuestions.length === 0" class="list-group-item text-muted">
                        Quiz này không có câu hỏi.
                      </li>
                    </ul>
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class AdminQuizzesComponent implements OnInit, OnDestroy {
  quizzes: QuizListItem[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  busyId: number | null = null;

  expandedQuizId: number | null = null;
  expandedQuestions: QuestionSummary[] = [];
  loadingQuestions = false;

  private destroy$ = new Subject<void>();

  constructor(
    private adminService: AdminService,
    private quizService: QuizService
  ) {}

  ngOnInit(): void {
    this.loadQuizzes();
  }

  // UC19 – GET /admin/quizzes (mọi quiz, mọi trạng thái)
  loadQuizzes(): void {
    this.isLoading = true;
    this.adminService.getAllQuizzes().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.quizzes = data; this.isLoading = false; },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.response?.data?.detail || 'Không thể tải danh sách (cần quyền Administrator).';
      }
    });
  }

  // UC19/UC20 – gỡ / khôi phục quiz
  toggleQuizStatus(quiz: QuizListItem): void {
    const newStatus = quiz.status === 'Active' ? 'Removed' : 'Active';
    const action = newStatus === 'Removed' ? 'Gỡ' : 'Khôi phục';
    if (!confirm(action + ' quiz "' + quiz.title + '"?')) return;

    this.busyId = quiz.quizId;
    this.adminService.setQuizStatus(quiz.quizId, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.quizzes = this.quizzes.map((q) => (q.quizId === updated.quizId ? updated : q));
        this.busyId = null;
      },
      error: (err) => {
        this.busyId = null;
        this.errorMessage = err?.response?.data?.detail || 'Thao tác thất bại.';
      }
    });
  }

  // Mở rộng xem câu hỏi của quiz (admin xem được mọi quiz qua GET /quizzes/{id})
  toggleExpand(quizId: number): void {
    if (this.expandedQuizId === quizId) {
      this.expandedQuizId = null;
      return;
    }
    this.expandedQuizId = quizId;
    this.expandedQuestions = [];
    this.loadingQuestions = true;

    this.quizService.getQuizDetail(quizId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (detail) => {
        this.expandedQuestions = detail.questions;
        this.loadingQuestions = false;
      },
      error: (err) => {
        this.loadingQuestions = false;
        this.errorMessage = err?.response?.data?.detail || 'Không tải được câu hỏi.';
      }
    });
  }

  // UC20 – kiểm duyệt từng câu hỏi
  setQuestionStatus(questionId: number, status: 'Active' | 'Removed'): void {
    this.adminService.setQuestionStatus(questionId, status).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.errorMessage = null;
        alert((status === 'Removed' ? 'Đã gỡ' : 'Đã khôi phục') + ' câu hỏi #' + questionId + '.');
      },
      error: (err) => (this.errorMessage = err?.response?.data?.detail || 'Thao tác thất bại.')
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
