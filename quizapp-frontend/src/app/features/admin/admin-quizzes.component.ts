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
<div class="admin-page min-vh-100 py-5">
  <div class="container">
    <div class="d-flex justify-content-between align-items-center mb-5">
      <div>
        <h2 class="fw-bold mb-1 d-flex align-items-center gap-2">
          <span class="fs-1 text-admin"><i class="bi bi-shield-check"></i></span> Kiểm Duyệt Nội Dung
        </h2>
        <p class="text-muted mb-0">Quản lý và kiểm duyệt Quiz trên hệ thống</p>
      </div>
      <a routerLink="/admin/users" class="btn btn-outline-admin rounded-pill px-4 fw-medium bg-white">
        <i class="bi bi-people"></i> Quản Lý User →
      </a>
    </div>

    <!-- Alert -->
    <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show rounded-4 shadow-sm border-0 mb-4 d-flex align-items-center" role="alert">
      <span class="fs-4 me-3">⚠️</span>
      <div class="flex-grow-1">{{ errorMessage }}</div>
      <button type="button" class="btn-close" (click)="errorMessage = null" aria-label="Close"></button>
    </div>

    <!-- Loading -->
    <div *ngIf="isLoading" class="d-flex flex-column justify-content-center align-items-center py-5">
      <div class="spinner-border text-admin mb-3" style="width: 3rem; height: 3rem;"></div>
      <p class="text-muted fw-medium fs-5">Đang tải danh sách Quiz...</p>
    </div>

    <!-- Table Card -->
    <div *ngIf="!isLoading" class="card border-0 shadow-sm rounded-4 overflow-hidden mb-5">
      <div class="card-accent-admin"></div>
      <div class="table-responsive">
        <table class="table align-middle mb-0 custom-table">
          <thead class="bg-light">
            <tr>
              <th class="py-3 px-4">THÔNG TIN QUIZ</th>
              <th class="py-3 text-center">NGƯỜI TẠO</th>
              <th class="py-3 text-center">CHẾ ĐỘ</th>
              <th class="py-3 text-center">TRẠNG THÁI</th>
              <th class="py-3 px-4 text-end">THAO TÁC</th>
            </tr>
          </thead>
          <tbody class="border-top-0">
            <ng-container *ngFor="let quiz of quizzes">
              <!-- Quiz Row -->
              <tr class="quiz-row" [class.expanded-row]="expandedQuizId === quiz.quizId">
                <td class="px-4 py-3">
                  <div class="fw-medium text-secondary fs-6 mb-1">{{ quiz.title }}</div>
                  <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-light text-secondary border"><i class="bi bi-file-earmark-text"></i> {{ quiz.questionCount }} câu hỏi</span>
                    <span class="text-muted small">ID: {{ quiz.quizId }}</span>
                  </div>
                </td>
                <td class="text-center">
                  <div class="d-inline-flex align-items-center gap-2">
                    <div class="avatar-xs bg-light text-admin rounded-circle fw-bold border">
                      {{ quiz.ownerUsername.charAt(0).toUpperCase() }}
                    </div>
                    <span class="fw-medium text-secondary">{{ quiz.ownerUsername }}</span>
                  </div>
                </td>
                <td class="text-center">
                  <span class="badge rounded-pill px-3 py-2" [ngClass]="quiz.isPublished ? 'badge-public' : 'badge-private'">
                    {{ quiz.isPublished ? '<i class="bi bi-globe"></i> Public' : '<i class="bi bi-lock"></i> Private' }}
                  </span>
                </td>
                <td class="text-center">
                  <span class="badge rounded-pill px-3 py-2" [ngClass]="quiz.status === 'Active' ? 'badge-success' : 'badge-danger'">
                    <span class="status-dot" [ngClass]="quiz.status === 'Active' ? 'bg-success' : 'bg-danger'"></span>
                    {{ quiz.status === 'Active' ? 'Hoạt động' : 'Bị gỡ' }}
                  </span>
                </td>
                <td class="px-4 text-end">
                  <button class="btn btn-sm rounded-pill px-3 fw-medium action-btn me-2"
                          [ngClass]="expandedQuizId === quiz.quizId ? 'btn-admin' : 'btn-outline-secondary'"
                          (click)="toggleExpand(quiz.quizId)">
                    {{ expandedQuizId === quiz.quizId ? '▲ Đóng' : '▼ Câu hỏi' }}
                  </button>
                  <button class="btn btn-sm rounded-pill px-3 fw-medium action-btn"
                          [ngClass]="quiz.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'"
                          (click)="toggleQuizStatus(quiz)"
                          [disabled]="busyId === quiz.quizId">
                    <span *ngIf="busyId === quiz.quizId" class="spinner-border spinner-border-sm me-1"></span>
                    {{ quiz.status === 'Active' ? '<i class="bi bi-slash-circle"></i> Gỡ Quiz' : '<i class="bi bi-check-circle"></i> Khôi phục' }}
                  </button>
                </td>
              </tr>

              <!-- Expanded Questions Row -->
              <tr *ngIf="expandedQuizId === quiz.quizId" class="expand-bg">
                <td colspan="5" class="p-0 border-bottom">
                  <div class="p-4 border-start border-admin border-4 m-3 bg-white rounded-3 shadow-sm">
                    <h6 class="fw-bold mb-3 d-flex align-items-center gap-2">
                      <span class="text-admin"><i class="bi bi-search"></i></span> Kiểm duyệt câu hỏi
                    </h6>

                    <div *ngIf="loadingQuestions" class="text-center py-4">
                      <div class="spinner-border text-admin mb-2" style="width: 2rem; height: 2rem;"></div>
                      <div class="text-muted small">Đang tải danh sách câu hỏi...</div>
                    </div>

                    <div *ngIf="!loadingQuestions" class="d-flex flex-column gap-2">
                      <div *ngFor="let q of expandedQuestions; let i = index"
                           class="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-light hover-bg-white transition-all">
                        <div>
                          <div class="fw-medium text-secondary mb-1">
                            <span class="text-admin me-1">#{{ i + 1 }}</span> {{ q.content }}
                          </div>
                          <span class="badge bg-white text-secondary border border-secondary border-opacity-25">{{ q.questionType }}</span>
                        </div>
                        <div class="d-flex gap-2">
                          <button class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-medium"
                                  (click)="setQuestionStatus(q.questionId, 'Removed')">
                            <i class="bi bi-slash-circle"></i> Gỡ
                          </button>
                          <button class="btn btn-sm btn-outline-success rounded-pill px-3 fw-medium"
                                  (click)="setQuestionStatus(q.questionId, 'Active')">
                            <i class="bi bi-check-circle"></i> Khôi phục
                          </button>
                        </div>
                      </div>

                      <div *ngIf="expandedQuestions.length === 0" class="text-center py-4 text-muted bg-light rounded-3 border">
                        Quiz này không có câu hỏi nào.
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </ng-container>

            <tr *ngIf="quizzes.length === 0">
              <td colspan="5" class="text-center py-5">
                <div class="text-muted fs-5">Chưa có Quiz nào trên hệ thống.</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [
    `
      .admin-page { background: #f8f9ff; }
      .text-admin { color: #f59e0b; }
      .card-accent-admin { height: 4px; background: linear-gradient(90deg, #f59e0b, #fbbf24); }

      .btn-admin { background: #f59e0b; color: white; border: none; }
      .btn-admin:hover { background: #d97706; color: white; }

      .btn-outline-admin {
        color: #f59e0b; border: 1.5px solid #f59e0b; transition: all 0.2s ease;
      }
      .btn-outline-admin:hover {
        background: #f59e0b; color: white; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
      }

      .custom-table th {
        font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;
        border-bottom: 2px solid #e8eaf6;
      }
      .custom-table td { vertical-align: middle; }

      .quiz-row { transition: all 0.2s; }
      .quiz-row:hover:not(.expanded-row) { background-color: rgba(245, 158, 11, 0.02); }
      .expanded-row { background-color: rgba(245, 158, 11, 0.05); }
      .expand-bg { background-color: rgba(245, 158, 11, 0.02); }

      .border-admin { border-color: #f59e0b !important; }
      .hover-bg-white:hover { background-color: white !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
      .transition-all { transition: all 0.2s; }

      .avatar-xs {
        width: 28px; height: 28px; font-size: 0.8rem;
        display: inline-flex; align-items: center; justify-content: center;
      }

      .badge-success { background: rgba(16, 185, 129, 0.15); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); }
      .badge-danger { background: rgba(239, 68, 68, 0.15); color: #b91c1c; border: 1px solid rgba(239, 68, 68, 0.3); }
      .badge-public { background: rgba(102, 126, 234, 0.15); color: #4338ca; border: 1px solid rgba(102, 126, 234, 0.3); }
      .badge-private { background: #f1f3f9; color: #4b5563; border: 1px solid #e5e7eb; }

      .status-dot {
        display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; vertical-align: middle;
      }

      .action-btn { transition: all 0.2s; border-width: 1.5px; }
      .action-btn:hover:not(:disabled) { transform: translateY(-1px); }
    `
  ]
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
