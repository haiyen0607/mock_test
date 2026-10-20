// UC19 – Manage System Quizzes + UC20 – Moderate Content
// Admin xem MỌI quiz trong hệ thống, gỡ (Removed) / khôi phục (Active) quiz,
// và mở rộng từng quiz để kiểm duyệt từng câu hỏi bên trong.

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { QuizService } from '../../core/services/quiz.service';
import { QuizListItem, QuestionSummary, QuizSort } from '../../core/models';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { PagerComponent } from '../../shared/pager.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DialogService } from '../../core/services/dialog.service';
import { extractError } from '../../core/errors';

type StatusFilter = 'all' | 'Active' | 'Removed';

@Component({
  selector: 'app-admin-quizzes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, EmptyStateComponent, SkeletonComponent, PagerComponent],
  template: `
<div class="page-container animate-fade-up">
  <header class="page-header">
    <div>
      <h1>Kiểm duyệt nội dung</h1>
      <p class="page-subtitle">Xem mọi quiz trên hệ thống, gỡ hoặc khôi phục quiz và từng câu hỏi.</p>
    </div>
    <a routerLink="/admin/users" class="btn btn-light">
      <i class="bi bi-people me-1" aria-hidden="true"></i>Quản lý người dùng
    </a>
  </header>

  <!-- Alert -->
  <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible mb-4" role="alert">
    <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
    <div class="flex-grow-1">{{ errorMessage }}</div>
    <button type="button" class="btn-close" (click)="errorMessage = null" aria-label="Đóng"></button>
  </div>

  <!-- Toolbar: tìm kiếm, sắp xếp, lọc trạng thái (server-side) -->
  <div class="toolbar mb-3">
    <div class="search-field toolbar-search">
      <i class="bi bi-search" aria-hidden="true"></i>
      <input type="search" class="form-control" [ngModel]="search" (ngModelChange)="onSearchChange($event)"
             aria-label="Tìm theo tên quiz hoặc người tạo" placeholder="Tìm theo tên quiz hoặc người tạo" />
    </div>
    <div class="d-flex align-items-center gap-2">
      <label for="quiz-sort" class="small text-muted text-nowrap mb-0">Sắp xếp</label>
      <select id="quiz-sort" class="form-select form-select-sm" [ngModel]="sort" (ngModelChange)="onSortChange($event)">
        <option *ngFor="let s of sortOptions" [ngValue]="s.value">{{ s.label }}</option>
      </select>
    </div>
    <div class="d-flex flex-wrap gap-2" role="group" aria-label="Lọc theo trạng thái">
      <button *ngFor="let f of statusFilters" type="button" class="chip"
              [class.active]="statusFilter === f.value" [attr.aria-pressed]="statusFilter === f.value"
              (click)="setStatusFilter(f.value)">
        {{ f.label }}
      </button>
    </div>
    <span *ngIf="!isLoading && !errorMessage" class="small text-muted tabular ms-auto" aria-live="polite">
      {{ total }} quiz{{ search.trim() ? ' khớp' : '' }}
    </span>
  </div>

  <!-- Loading -->
  <app-skeleton *ngIf="isLoading" variant="list" [count]="6"></app-skeleton>

  <ng-container *ngIf="!isLoading && quizzes.length > 0">
    <div class="table-wrap">
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Quiz</th>
              <th class="d-none d-md-table-cell">Người tạo</th>
              <th class="text-center d-none d-lg-table-cell">Chế độ</th>
              <th class="text-center">Trạng thái</th>
              <th class="text-end">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let quiz of filteredQuizzes">
              <!-- Quiz Row -->
              <tr [class.is-expanded]="expandedQuizId === quiz.quizId">
                <td>
                  <div class="fw-semibold quiz-title">{{ quiz.title }}</div>
                  <div class="small text-muted tabular">
                    <i class="bi bi-question-circle me-1" aria-hidden="true"></i>{{ quiz.questionCount }} câu hỏi · #{{ quiz.quizId }}
                    <span class="d-md-none"> · {{ quiz.ownerUsername }}</span>
                  </div>
                </td>
                <td class="d-none d-md-table-cell">
                  <div class="d-flex align-items-center gap-2">
                    <span class="avatar" aria-hidden="true">{{ quiz.ownerUsername.charAt(0).toUpperCase() }}</span>
                    <span class="fw-medium">{{ quiz.ownerUsername }}</span>
                  </div>
                </td>
                <td class="text-center d-none d-lg-table-cell">
                  <span class="chip text-nowrap" [ngClass]="quiz.isPublished ? 'chip-brand' : ''">
                    <i class="bi" [ngClass]="quiz.isPublished ? 'bi-globe2' : 'bi-lock'" aria-hidden="true"></i>
                    {{ quiz.isPublished ? 'Công khai' : 'Riêng tư' }}
                  </span>
                </td>
                <td class="text-center">
                  <span class="chip text-nowrap" [ngClass]="quiz.status === 'Active' ? 'chip-success' : 'chip-danger'">
                    <i class="bi" [ngClass]="quiz.status === 'Active' ? 'bi-check-circle' : 'bi-slash-circle'" aria-hidden="true"></i>
                    {{ quiz.status === 'Active' ? 'Đang hoạt động' : 'Đã gỡ' }}
                  </span>
                </td>
                <td class="text-end">
                  <div class="d-inline-flex flex-wrap justify-content-end gap-2">
                    <button type="button" class="btn btn-light btn-sm text-nowrap"
                            (click)="toggleExpand(quiz.quizId)"
                            [attr.aria-expanded]="expandedQuizId === quiz.quizId"
                            [attr.aria-label]="(expandedQuizId === quiz.quizId ? 'Đóng danh sách câu hỏi của ' : 'Xem câu hỏi của ') + quiz.title">
                      <i class="bi me-1" [ngClass]="expandedQuizId === quiz.quizId ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
                      {{ expandedQuizId === quiz.quizId ? 'Đóng' : 'Câu hỏi' }}
                    </button>
                    <button *ngIf="quiz.status === 'Active'" type="button" class="btn btn-sm btn-outline-danger text-nowrap"
                            (click)="toggleQuizStatus(quiz)"
                            [disabled]="busyId === quiz.quizId"
                            [attr.aria-busy]="busyId === quiz.quizId"
                            [attr.aria-label]="'Gỡ quiz ' + quiz.title">
                      <span *ngIf="busyId === quiz.quizId" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                      <i *ngIf="busyId !== quiz.quizId" class="bi bi-slash-circle me-1" aria-hidden="true"></i>Gỡ
                    </button>
                    <button *ngIf="quiz.status !== 'Active'" type="button" class="btn btn-sm btn-outline-success text-nowrap"
                            (click)="toggleQuizStatus(quiz)"
                            [disabled]="busyId === quiz.quizId"
                            [attr.aria-busy]="busyId === quiz.quizId"
                            [attr.aria-label]="'Khôi phục quiz ' + quiz.title">
                      <span *ngIf="busyId === quiz.quizId" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                      <i *ngIf="busyId !== quiz.quizId" class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Khôi phục
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Expanded Questions Row -->
              <tr *ngIf="expandedQuizId === quiz.quizId" class="expand-row">
                <td colspan="5">
                  <div class="expand-panel animate-fade-in">
                    <h2 class="section-title mb-3">Kiểm duyệt câu hỏi</h2>

                    <app-skeleton *ngIf="loadingQuestions" variant="list" [count]="3"></app-skeleton>

                    <div *ngIf="!loadingQuestions" class="d-flex flex-column gap-2">
                      <div *ngFor="let q of expandedQuestions; let i = index" class="q-row" [class.is-removed]="q.status !== 'Active'">
                        <span class="q-num tabular" aria-hidden="true">{{ i + 1 }}</span>
                        <div class="flex-grow-1 min-w-0">
                          <div class="fw-medium mb-1 q-content">{{ q.content }}</div>
                          <div class="d-flex flex-wrap gap-2">
                            <span class="chip">{{ typeLabel(q.questionType) }}</span>
                            <span class="chip" [ngClass]="q.status === 'Active' ? 'chip-success' : 'chip-danger'">
                              {{ q.status === 'Active' ? 'Đang hoạt động' : 'Đã gỡ' }}
                            </span>
                          </div>
                        </div>
                        <div class="flex-shrink-0">
                          <button *ngIf="q.status === 'Active'" type="button" class="btn btn-sm btn-outline-danger text-nowrap"
                                  (click)="setQuestionStatus(q, 'Removed')"
                                  [disabled]="busyQuestionId === q.questionId"
                                  [attr.aria-busy]="busyQuestionId === q.questionId"
                                  [attr.aria-label]="'Gỡ câu hỏi ' + (i + 1)">
                            <span *ngIf="busyQuestionId === q.questionId" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                            <i *ngIf="busyQuestionId !== q.questionId" class="bi bi-slash-circle me-1" aria-hidden="true"></i>Gỡ
                          </button>
                          <button *ngIf="q.status !== 'Active'" type="button" class="btn btn-sm btn-outline-success text-nowrap"
                                  (click)="setQuestionStatus(q, 'Active')"
                                  [disabled]="busyQuestionId === q.questionId"
                                  [attr.aria-busy]="busyQuestionId === q.questionId"
                                  [attr.aria-label]="'Khôi phục câu hỏi ' + (i + 1)">
                            <span *ngIf="busyQuestionId === q.questionId" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                            <i *ngIf="busyQuestionId !== q.questionId" class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Khôi phục
                          </button>
                        </div>
                      </div>

                      <app-empty-state *ngIf="expandedQuestions.length === 0" [compact]="true" tone="neutral"
                                       icon="bi-inbox" title="Quiz này không có câu hỏi nào"></app-empty-state>
                    </div>
                  </div>
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
      </div>
      <app-empty-state *ngIf="filteredQuizzes.length === 0" [compact]="true" tone="neutral" icon="bi-funnel"
                       title="Không có quiz phù hợp trên trang này" message="Thử đổi bộ lọc trạng thái hoặc chuyển trang.">
        <button type="button" class="btn btn-light btn-sm" (click)="setStatusFilter('all')">Xóa bộ lọc</button>
      </app-empty-state>
    </div>

    <app-pager [page]="page" [pageSize]="pageSize" [total]="total" (pageChange)="goToPage($event)"></app-pager>
  </ng-container>

  <div *ngIf="!isLoading && quizzes.length === 0 && errorMessage" class="surface">
    <app-empty-state icon="bi-exclamation-triangle" tone="danger" title="Không tải được danh sách"
                     message="Kiểm tra quyền truy cập rồi thử lại.">
      <button type="button" class="btn btn-primary" (click)="loadQuizzes()">
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
      </button>
    </app-empty-state>
  </div>
  <div *ngIf="!isLoading && quizzes.length === 0 && !errorMessage && search.trim()" class="surface">
    <app-empty-state icon="bi-search" tone="neutral" title="Không có quiz phù hợp"
                     message="Thử tìm bằng tên quiz hoặc tên người tạo khác.">
      <button type="button" class="btn btn-light btn-sm" (click)="onSearchChange('')">Xóa tìm kiếm</button>
    </app-empty-state>
  </div>
  <div *ngIf="!isLoading && quizzes.length === 0 && !errorMessage && !search.trim()" class="surface">
    <app-empty-state icon="bi-journal-x" tone="neutral" title="Chưa có quiz nào trên hệ thống"
                     message="Các quiz do người dùng tạo sẽ xuất hiện ở đây để kiểm duyệt."></app-empty-state>
  </div>
</div>
  `,
  styles: [
    `
      .toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
      .toolbar-search { flex: 1 1 16rem; max-width: 420px; }
      .toolbar .form-select { width: auto; }

      .quiz-title { max-width: 28rem; overflow-wrap: anywhere; }
      .q-content { overflow-wrap: anywhere; }
      .q-row.is-removed .q-content { color: var(--text-2); }
      .min-w-0 { min-width: 0; }

      .avatar {
        width: 2rem; height: 2rem; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 12px; background: var(--brand-soft); color: var(--brand-soft-text);
        font-family: var(--font-display); font-weight: 800; font-size: 0.85rem;
      }

      tr.is-expanded > td { background: var(--brand-50); }
      .table tbody tr.expand-row > td { padding: 0 1rem 1rem; background: var(--brand-50); }
      .table-hover tbody tr.expand-row:hover > * { --bs-table-bg-state: transparent; }
      .expand-panel {
        background: var(--surface); border: 1px solid var(--border);
        border-radius: var(--radius-card); padding: 1rem 1.15rem;
      }

      .q-row {
        display: flex; align-items: center; gap: 0.85rem;
        padding: 0.75rem 0.9rem; border: 1px solid var(--border);
        border-radius: var(--radius-input); background: var(--surface-2);
      }
      .q-num {
        width: 1.9rem; height: 1.9rem; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 10px; background: var(--surface); color: var(--text-2);
        font-weight: 700; font-size: 0.85rem; border: 1px solid var(--border);
      }
      @media (max-width: 575.98px) { .q-row { flex-wrap: wrap; } }
    `
  ]
})
export class AdminQuizzesComponent implements OnInit, OnDestroy {
  private dialog = inject(DialogService);
  quizzes: QuizListItem[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  busyId: number | null = null;
  busyQuestionId: number | null = null;

  expandedQuizId: number | null = null;
  expandedQuestions: QuestionSummary[] = [];
  loadingQuestions = false;

  // Server-side: tìm kiếm / sắp xếp / phân trang
  search = '';
  sort: QuizSort = 'newest';
  page = 1;
  readonly pageSize = 20;
  total = 0;
  readonly sortOptions: { value: QuizSort; label: string }[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
    { value: 'title', label: 'Tên quiz' }
  ];

  // Lọc trạng thái ở server; getter vẫn lọc lại để ẩn ngay quiz vừa đổi trạng thái
  statusFilter: StatusFilter = 'all';
  readonly statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'Active', label: 'Đang hoạt động' },
    { value: 'Removed', label: 'Đã gỡ' }
  ];

  get filteredQuizzes(): QuizListItem[] {
    if (this.statusFilter === 'all') return this.quizzes;
    return this.quizzes.filter((q) => (this.statusFilter === 'Active' ? q.status === 'Active' : q.status !== 'Active'));
  }

  private search$ = new Subject<string>();
  private loadSub?: Subscription;
  private questionsSub?: Subscription;
  private destroy$ = new Subject<void>();

  constructor(
    private adminService: AdminService,
    private quizService: QuizService
  ) {}

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 1;
        this.loadQuizzes();
      });
    this.loadQuizzes();
  }

  onSearchChange(value: string): void {
    this.search = value ?? '';
    this.search$.next(this.search.trim());
  }

  setStatusFilter(value: StatusFilter): void {
    if (this.statusFilter === value) return;
    this.statusFilter = value;
    this.page = 1;
    this.loadQuizzes();
  }

  onSortChange(value: QuizSort): void {
    this.sort = value;
    this.page = 1;
    this.loadQuizzes();
  }

  goToPage(page: number): void {
    this.page = page;
    this.loadQuizzes();
  }

  // UC19 – GET /admin/quizzes?search=&status=&page=&pageSize=&sort=
  loadQuizzes(): void {
    this.loadSub?.unsubscribe();
    this.questionsSub?.unsubscribe();
    this.isLoading = true;
    this.errorMessage = null;
    this.expandedQuizId = null;
    this.loadSub = this.adminService
      .getAllQuizzes({
        search: this.search.trim() || undefined,
        status: this.statusFilter === 'all' ? undefined : this.statusFilter,
        page: this.page,
        pageSize: this.pageSize,
        sort: this.sort
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.quizzes = data.items;
          this.total = data.total;
          this.isLoading = false;
          // Trang hiện tại trống sau khi dữ liệu thay đổi → lùi về trang cuối có dữ liệu
          if (data.items.length === 0 && data.total > 0 && this.page > 1) {
            this.page = Math.max(1, Math.ceil(data.total / this.pageSize));
            this.loadQuizzes();
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.quizzes = [];
          this.total = 0;
          this.errorMessage = extractError(err, 'Không thể tải danh sách (cần quyền Administrator).');
        }
      });
  }

  // UC19/UC20 – gỡ / khôi phục quiz
  async toggleQuizStatus(quiz: QuizListItem): Promise<void> {
    const newStatus = quiz.status === 'Active' ? 'Removed' : 'Active';
    const action = newStatus === 'Removed' ? 'Gỡ' : 'Khôi phục';
    const ok = await this.dialog.confirm({
      title: action + ' quiz "' + quiz.title + '"?',
      message: newStatus === 'Removed'
        ? 'Quiz sẽ bị ẩn khỏi trang khám phá cho tới khi được khôi phục.'
        : 'Quiz sẽ hiển thị công khai trở lại nếu đang được xuất bản.',
      confirmText: action,
      tone: newStatus === 'Removed' ? 'danger' : 'brand'
    });
    if (!ok) return;

    this.busyId = quiz.quizId;
    this.adminService.setQuizStatus(quiz.quizId, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.quizzes = this.quizzes.map((q) => (q.quizId === updated.quizId ? updated : q));
        this.busyId = null;
        this.dialog.toast((updated.status === 'Active' ? 'Đã khôi phục quiz "' : 'Đã gỡ quiz "') + updated.title + '".');
      },
      error: (err) => {
        this.busyId = null;
        this.dialog.toast(extractError(err, 'Thao tác thất bại.'), 'danger');
      }
    });
  }

  // Mở rộng xem câu hỏi của quiz (admin xem được mọi quiz qua GET /quizzes/{id})
  toggleExpand(quizId: number): void {
    this.questionsSub?.unsubscribe();
    if (this.expandedQuizId === quizId) {
      this.expandedQuizId = null;
      this.loadingQuestions = false;
      return;
    }
    this.expandedQuizId = quizId;
    this.expandedQuestions = [];
    this.loadingQuestions = true;

    this.questionsSub = this.quizService.getQuizDetail(quizId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (detail) => {
        this.expandedQuestions = detail.questions;
        this.loadingQuestions = false;
      },
      error: (err) => {
        this.loadingQuestions = false;
        this.errorMessage = extractError(err, 'Không tải được câu hỏi.');
      }
    });
  }

  // UC20 – kiểm duyệt từng câu hỏi (PUT trả về QuestionDto)
  setQuestionStatus(question: QuestionSummary, status: 'Active' | 'Removed'): void {
    this.busyQuestionId = question.questionId;
    this.adminService.setQuestionStatus(question.questionId, status).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.busyQuestionId = null;
        this.expandedQuestions = this.expandedQuestions.map((q) =>
          q.questionId === updated.questionId ? { ...q, status: updated.status } : q
        );
        this.dialog.toast(updated.status === 'Removed' ? 'Đã gỡ câu hỏi.' : 'Đã khôi phục câu hỏi.');
      },
      error: (err) => {
        this.busyQuestionId = null;
        this.dialog.toast(extractError(err, 'Thao tác thất bại.'), 'danger');
      }
    });
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      MultipleChoice: 'Chọn nhiều',
      SingleChoice: 'Chọn một',
      TrueFalse: 'Đúng / Sai',
      FillInTheBlanks: 'Điền chỗ trống',
      ShortAnswer: 'Trả lời ngắn',
      LongAnswer: 'Tự luận'
    };
    return map[type] || type;
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.questionsSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
