// UC12 – Manage Own Quiz (xem/sửa/xóa) + UC14 – Công khai quiz

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../core/services/quiz.service';
import { QuizListItem, QuizSort } from '../../core/models';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { PagerComponent } from '../../shared/pager.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DialogService } from '../../core/services/dialog.service';
import { extractError } from '../../core/errors';

@Component({
  selector: 'app-my-quizzes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, EmptyStateComponent, SkeletonComponent, PagerComponent],
  template: `
    <div class="page-container animate-fade-up">
      <header class="page-header">
        <div>
          <h1>Quiz của tôi</h1>
          <p class="page-subtitle">Quản lý, chỉnh sửa và công khai các quiz bạn đã tạo.</p>
        </div>
        <a class="btn btn-primary" routerLink="/dashboard/quiz-create">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Tạo quiz
        </a>
      </header>

      <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        <div>{{ errorMessage }}</div>
        <button type="button" class="btn-close" aria-label="Đóng" (click)="errorMessage = null"></button>
      </div>

      <app-skeleton *ngIf="isLoading && quizzes.length === 0" variant="cards" [count]="6"></app-skeleton>

      <!-- Lỗi tải: khác với danh sách trống -->
      <div *ngIf="!isLoading && loadError" class="surface">
        <app-empty-state tone="danger" icon="bi-wifi-off" title="Không tải được danh sách quiz" [message]="loadError">
          <button type="button" class="btn btn-primary" (click)="loadMyQuizzes()">
            <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
          </button>
        </app-empty-state>
      </div>

      <ng-container *ngIf="!loadError && quizzes.length > 0">
        <div class="stats-row mb-4">
          <div class="stat-tile">
            <div class="stat-value">{{ total }}</div>
            <div class="stat-label">Tổng số quiz</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">{{ publishedCount }}</div>
            <div class="stat-label">Đang công khai{{ isPartial ? ' (trang này)' : '' }}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">{{ quizzes.length - publishedCount }}</div>
            <div class="stat-label">Riêng tư{{ isPartial ? ' (trang này)' : '' }}</div>
          </div>
        </div>

        <div class="list-toolbar mb-3">
          <label for="quizSort" class="form-label m-0">Sắp xếp</label>
          <select id="quizSort" class="form-select form-select-sm sort-select" [(ngModel)]="sort"
                  (ngModelChange)="changeSort()" [disabled]="isLoading">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="title">Tên</option>
          </select>
          <span *ngIf="isLoading" class="spinner-border spinner-border-sm text-muted" role="status">
            <span class="visually-hidden">Đang tải…</span>
          </span>
        </div>

        <div class="quiz-grid stagger" [class.is-busy]="isLoading">
          <article *ngFor="let quiz of quizzes" class="card quiz-card">
            <div class="card-body d-flex flex-column">
              <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
                <span class="icon-tile" aria-hidden="true"><i class="bi bi-journal-text"></i></span>
                <div class="d-flex flex-wrap gap-1 justify-content-end">
                  <span *ngIf="quiz.status === 'Removed'" class="chip chip-danger">
                    <i class="bi bi-slash-circle" aria-hidden="true"></i>Bị gỡ
                  </span>
                  <span class="chip" [class.chip-success]="quiz.isPublished">
                    <i class="bi" [ngClass]="quiz.isPublished ? 'bi-globe2' : 'bi-lock'" aria-hidden="true"></i>
                    {{ quiz.isPublished ? 'Đang công khai' : 'Riêng tư' }}
                  </span>
                </div>
              </div>

              <h2 class="quiz-title">{{ quiz.title }}</h2>
              <p class="quiz-desc" [class.is-empty]="!quiz.description">{{ quiz.description || 'Chưa có mô tả' }}</p>

              <div class="quiz-meta tabular">
                <span><i class="bi bi-question-circle" aria-hidden="true"></i>{{ quiz.questionCount }} câu hỏi</span>
                <span><i class="bi bi-clock" aria-hidden="true"></i>{{ quiz.duration }} phút</span>
              </div>

              <div class="quiz-links">
                <a class="link-action" [routerLink]="['/dashboard/quiz-stats', quiz.quizId]"
                   [attr.aria-label]="'Thống kê quiz ' + quiz.title">
                  <i class="bi bi-bar-chart" aria-hidden="true"></i>Thống kê
                </a>
                <a class="link-action" [routerLink]="['/dashboard/quiz-grading', quiz.quizId]"
                   [attr.aria-label]="'Chấm bài quiz ' + quiz.title">
                  <i class="bi bi-check2-square" aria-hidden="true"></i>Chấm bài
                </a>
              </div>

              <div class="quiz-actions">
                <a class="btn btn-light btn-sm" [routerLink]="['/dashboard/quiz-questions', quiz.quizId]"
                   [attr.aria-label]="'Câu hỏi của quiz ' + quiz.title">
                  <i class="bi bi-list-check me-1" aria-hidden="true"></i>Câu hỏi
                </a>
                <a class="btn btn-light btn-sm" [routerLink]="['/dashboard/quiz-edit', quiz.quizId]"
                   [attr.aria-label]="'Sửa quiz ' + quiz.title">
                  <i class="bi bi-pencil me-1" aria-hidden="true"></i>Sửa
                </a>
                <button
                  type="button"
                  class="btn btn-sm"
                  [ngClass]="quiz.isPublished ? 'btn-outline-secondary' : 'btn-outline-primary'"
                  (click)="togglePublish(quiz)"
                  [disabled]="busyId === quiz.quizId"
                  [attr.aria-label]="(quiz.isPublished ? 'Ẩn khỏi công khai quiz ' : 'Công khai quiz ') + quiz.title"
                >
                  <span *ngIf="busyId === quiz.quizId && busyAction === 'publish'" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                  <i *ngIf="!(busyId === quiz.quizId && busyAction === 'publish')" class="bi me-1"
                     [ngClass]="quiz.isPublished ? 'bi-eye-slash' : 'bi-send'" aria-hidden="true"></i>{{ quiz.isPublished ? 'Ẩn khỏi công khai' : 'Công khai' }}
                </button>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-icon ms-auto"
                  (click)="deleteQuiz(quiz)"
                  [disabled]="busyId === quiz.quizId"
                  title="Xóa quiz"
                  [attr.aria-label]="'Xóa quiz ' + quiz.title"
                >
                  <span *ngIf="busyId === quiz.quizId && busyAction === 'delete'; else trashIcon" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                  <ng-template #trashIcon><i class="bi bi-trash" aria-hidden="true"></i></ng-template>
                </button>
              </div>
            </div>
          </article>
        </div>

        <app-pager [page]="page" [pageSize]="pageSize" [total]="total" [disabled]="isLoading"
                   (pageChange)="goToPage($event)"></app-pager>
      </ng-container>

      <div *ngIf="!isLoading && !loadError && quizzes.length === 0" class="surface">
        <app-empty-state
          icon="bi-journal-plus"
          title="Chưa có quiz nào"
          message="Bạn chưa tạo quiz nào. Tạo quiz đầu tiên rồi thêm câu hỏi để bắt đầu."
        >
          <a class="btn btn-primary" routerLink="/dashboard/quiz-create">
            <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Tạo quiz
          </a>
        </app-empty-state>
      </div>
    </div>
  `,
  styles: [`
    .stats-row {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      max-width: 640px;
    }

    .list-toolbar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .sort-select { width: auto; min-width: 140px; }

    .quiz-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      transition: opacity var(--transition);
    }
    .quiz-grid.is-busy { opacity: 0.6; }
    @media (max-width: 575.98px) {
      .quiz-grid { grid-template-columns: 1fr; }
    }

    .quiz-card { height: 100%; }
    .quiz-card:hover { border-color: var(--brand-200); box-shadow: var(--shadow-md); }
    .quiz-card .card-body { padding: 1.15rem 1.25rem; }

    .quiz-title {
      font-size: 1.1rem;
      font-weight: 800;
      margin: 0.35rem 0 0.3rem;
      word-break: break-word;
    }
    .quiz-desc {
      color: var(--text-2);
      font-size: 0.88rem;
      margin-bottom: 0.9rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .quiz-desc.is-empty { color: var(--text-muted); font-style: italic; }

    .quiz-meta {
      display: flex; flex-wrap: wrap; gap: 1rem;
      color: var(--text-muted); font-size: 0.82rem; font-weight: 500;
      margin-top: auto; margin-bottom: 0.6rem;
    }
    .quiz-meta i { margin-right: 0.35rem; }

    .quiz-links { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.9rem; }
    .link-action {
      display: inline-flex; align-items: center; gap: 0.35rem;
      font-size: 0.85rem; font-weight: 600;
      color: var(--brand-600); text-decoration: none;
    }
    .link-action:hover { color: var(--brand-700); text-decoration: underline; }

    .quiz-actions {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem;
      padding-top: 0.9rem;
      border-top: 1px solid var(--border);
    }
    .quiz-actions .btn-icon { width: 2rem; height: 2rem; }
  `]
})
export class MyQuizzesComponent implements OnInit, OnDestroy {
  private dialog = inject(DialogService);
  quizzes: QuizListItem[] = [];
  isLoading = false;
  loadError: string | null = null;
  errorMessage: string | null = null;
  busyId: number | null = null;
  busyAction: 'publish' | 'delete' | null = null;

  // Phân trang phía máy chủ
  page = 1;
  readonly pageSize = 12;
  total = 0;
  sort: QuizSort = 'newest';

  private destroy$ = new Subject<void>();

  /** Số quiz đang công khai trên trang hiện tại */
  get publishedCount(): number {
    return this.quizzes.filter((q) => q.isPublished).length;
  }

  /** Danh sách đang hiển thị chưa phải toàn bộ quiz */
  get isPartial(): boolean {
    return this.total > this.quizzes.length;
  }

  constructor(private quizService: QuizService) {}

  ngOnInit(): void {
    this.loadMyQuizzes();
  }

  // UC12 – GET /api/quizzes/mine?page=&pageSize=&sort=
  loadMyQuizzes(): void {
    this.isLoading = true;
    this.loadError = null;

    this.quizService
      .getMyQuizzes({ page: this.page, pageSize: this.pageSize, sort: this.sort })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.total = data.total;
          // Trang hiện tại trống (vd. vừa xóa quiz cuối trang) — lùi lại một trang
          if (data.items.length === 0 && this.page > 1) {
            this.page = Math.max(1, Math.ceil(data.total / this.pageSize));
            this.loadMyQuizzes();
            return;
          }
          this.quizzes = data.items;
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.quizzes = [];
          this.loadError = extractError(err, 'Không thể tải danh sách quiz của bạn.');
        }
      });
  }

  goToPage(p: number): void {
    this.page = p;
    this.loadMyQuizzes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  changeSort(): void {
    this.page = 1;
    this.loadMyQuizzes();
  }

  // UC14 – PUT /api/quizzes/{id}/publish  body: { publish: true|false }
  async togglePublish(quiz: QuizListItem): Promise<void> {
    const publish = !quiz.isPublished;

    // UC14 A1: backend từ chối công khai quiz 0 câu hỏi — chặn sớm cho thân thiện
    if (publish && quiz.questionCount === 0) {
      await this.dialog.alert({
        title: 'Chưa thể công khai quiz',
        message: 'Quiz "' + quiz.title + '" chưa có câu hỏi nào. Hãy thêm ít nhất 1 câu hỏi trước khi công khai.',
        icon: 'bi-info-circle'
      });
      return;
    }

    this.busyId = quiz.quizId;
    this.busyAction = 'publish';
    this.errorMessage = null;

    this.quizService
      .setPublish(quiz.quizId, publish)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          quiz.isPublished = publish;
          this.busyId = null;
          this.busyAction = null;
          this.dialog.toast(publish
            ? 'Đã công khai "' + quiz.title + '". Mọi người có thể làm quiz này.'
            : 'Đã chuyển "' + quiz.title + '" về riêng tư.');
        },
        error: (err) => {
          this.busyId = null;
          this.busyAction = null;
          this.errorMessage = extractError(err, 'Thao tác thất bại.');
        }
      });
  }

  // UC12 – DELETE /api/quizzes/{id} (xóa mềm: giữ lịch sử làm bài)
  async deleteQuiz(quiz: QuizListItem): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Xóa quiz "' + quiz.title + '"?',
      message: 'Quiz sẽ bị ẩn; lịch sử làm bài của người học vẫn được giữ.',
      confirmText: 'Xóa quiz',
      tone: 'danger',
      icon: 'bi-trash'
    });
    if (!ok) return;

    this.busyId = quiz.quizId;
    this.busyAction = 'delete';
    this.errorMessage = null;

    this.quizService
      .deleteQuiz(quiz.quizId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.busyId = null;
          this.busyAction = null;
          this.dialog.toast('Đã xóa quiz "' + quiz.title + '".');
          this.loadMyQuizzes();
        },
        error: (err) => {
          this.busyId = null;
          this.busyAction = null;
          this.errorMessage = extractError(err, 'Xóa quiz thất bại.');
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
