import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute, ParamMap } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../core/services/quiz.service';
import { AuthService } from '../../core/services/auth.service';
import { QuizListItem, QuizSort } from '../../core/models';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { PagerComponent } from '../../shared/pager.component';
import { extractError } from '../../core/errors';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-browse-quizzes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, EmptyStateComponent, SkeletonComponent, PagerComponent],
  template: `
    <div class="page-container animate-fade-up">
      <header class="page-header">
        <div>
          <h1>Khám phá quiz</h1>
          <p class="page-subtitle">Tìm một bài trắc nghiệm hợp với bạn và thử sức ngay.</p>
        </div>
      </header>

      <div class="toolbar">
        <div class="search-field flex-grow-1">
          <i class="bi bi-search" aria-hidden="true"></i>
          <input
            type="search"
            class="form-control"
            placeholder="Tìm theo tiêu đề quiz"
            aria-label="Tìm kiếm quiz theo tiêu đề"
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearch($event)"
          />
        </div>
        <label class="sort-field">
          <span class="visually-hidden">Sắp xếp</span>
          <select class="form-select" aria-label="Sắp xếp quiz" [ngModel]="sort" (ngModelChange)="onSortChange($event)">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="title">Tên A–Z</option>
          </select>
        </label>
        <span class="chip chip-brand tabular" *ngIf="!isLoading && !errorMessage">
          <i class="bi bi-collection" aria-hidden="true"></i>{{ total }} quiz
        </span>
      </div>

      <app-skeleton *ngIf="isLoading" variant="cards" [count]="6"></app-skeleton>

      <app-empty-state
        *ngIf="!isLoading && errorMessage"
        icon="bi-wifi-off"
        tone="danger"
        title="Không tải được danh sách quiz"
        [message]="errorMessage">
        <button type="button" class="btn btn-primary" (click)="loadQuizzes()">
          <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
        </button>
      </app-empty-state>

      <div *ngIf="!isLoading && !errorMessage && quizzes.length > 0" class="quiz-grid stagger">
        <article *ngFor="let quiz of quizzes; let i = index" class="quiz-card card card-hover">
          <div class="band" [attr.data-tone]="i % 3">
            <span class="icon-tile"><i class="bi" [ngClass]="bandIcon(i)" aria-hidden="true"></i></span>
            <span class="band-count tabular">{{ quiz.questionCount }} câu</span>
          </div>
          <div class="quiz-body">
            <h2 class="quiz-title">
              <a class="stretched" [routerLink]="['/quiz/detail', quiz.quizId]">{{ quiz.title }}</a>
            </h2>
            <p class="quiz-desc" [class.is-empty]="!quiz.description">{{ quiz.description || 'Chưa có mô tả' }}</p>

            <div class="meta">
              <span class="chip"><i class="bi bi-stopwatch" aria-hidden="true"></i><span class="tabular">{{ quiz.duration }} phút</span></span>
              <span class="chip" [title]="'Tạo ngày ' + formatDate(quiz.createdAt)"><i class="bi bi-calendar3" aria-hidden="true"></i><span class="tabular">{{ formatDate(quiz.createdAt) }}</span></span>
              <span class="chip owner" [title]="quiz.ownerUsername"><i class="bi bi-person" aria-hidden="true"></i><span class="text-truncate">{{ quiz.ownerUsername }}</span></span>
            </div>

            <div class="actions">
              <a class="btn btn-light btn-sm flex-fill" [routerLink]="['/quiz/detail', quiz.quizId]" tabindex="-1" aria-hidden="true">Chi tiết</a>
              <button type="button" class="btn btn-primary btn-sm flex-fill" (click)="startAttempt(quiz.quizId)">
                {{ isLoggedIn ? 'Bắt đầu' : 'Làm thử' }}
              </button>
            </div>
          </div>
        </article>
      </div>

      <app-pager *ngIf="!isLoading && !errorMessage"
                 [page]="page" [pageSize]="pageSize" [total]="total"
                 (pageChange)="onPageChange($event)"></app-pager>

      <app-empty-state
        *ngIf="!isLoading && !errorMessage && quizzes.length === 0"
        icon="bi-search"
        [title]="searchTerm ? 'Không tìm thấy quiz phù hợp' : 'Chưa có quiz nào'"
        [message]="searchTerm ? 'Thử một từ khóa khác hoặc xóa bộ lọc tìm kiếm.' : 'Chưa có quiz nào được công khai. Hãy quay lại sau nhé.'">
        <button *ngIf="searchTerm" type="button" class="btn btn-light" (click)="clearSearch()">Xóa tìm kiếm</button>
      </app-empty-state>
    </div>
  `,
  styles: [`
    .toolbar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .toolbar .search-field { max-width: 480px; min-width: 200px; }
    .sort-field { flex: 0 0 auto; margin: 0; }
    .sort-field .form-select { min-width: 9.5rem; }
    @media (max-width: 400px) { .sort-field { flex: 1 1 auto; } .sort-field .form-select { width: 100%; } }

    .quiz-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }

    .quiz-card { position: relative; overflow: hidden; display: flex; flex-direction: column; }
    .quiz-card:has(.stretched:focus-visible) { box-shadow: var(--ring); }
    .quiz-card:hover .quiz-title a { color: var(--brand-600); }

    .band {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.15rem;
      background: var(--brand-100);
    }
    .band[data-tone='0'] { background: var(--brand-50); }
    .band[data-tone='1'] { background: var(--brand-100); }
    .band[data-tone='2'] { background: var(--brand-200); }
    .band .icon-tile { background: var(--surface); box-shadow: var(--shadow-sm); }
    .band-count { font-size: 0.8rem; font-weight: 700; color: var(--brand-soft-text); }

    .quiz-body { display: flex; flex-direction: column; flex: 1; padding: 1rem 1.15rem 1.15rem; }

    .quiz-title {
      font-size: 1.05rem; font-weight: 800; line-height: 1.35; margin: 0 0 0.4rem;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .quiz-title a { color: var(--text); text-decoration: none; }
    .quiz-title a:focus-visible { outline: none; }
    /* Stretched link: cả thẻ bấm được, các nút bên trong vẫn bấm riêng */
    .stretched::after { content: ''; position: absolute; inset: 0; z-index: 1; }
    .quiz-title a:hover { color: var(--brand-600); }

    .quiz-desc {
      font-size: 0.875rem; color: var(--text-2); margin: 0 0 1rem;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .quiz-desc.is-empty { color: var(--text-muted); font-style: italic; }

    .meta { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.1rem; }
    .meta .owner { max-width: 100%; min-width: 0; }

    .actions { position: relative; z-index: 2; display: flex; gap: 0.5rem; margin-top: auto; }
  `]
})
export class BrowseQuizzesComponent implements OnInit, OnDestroy {
  quizzes: QuizListItem[] = [];
  searchTerm = '';
  sort: QuizSort = 'newest';
  page = 1;
  readonly pageSize = 12;
  total = 0;
  isLoading = false;
  errorMessage: string | null = null;
  isLoggedIn = false;
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private quizService: QuizService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.isLoggedIn = this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    // URL (?q=&sort=&page=) là nguồn trạng thái: nút Back của trình duyệt hoạt động đúng
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.readParams(params);
      this.loadQuizzes();
    });

    // Search với debounce 300ms — tìm mới luôn về trang 1
    this.searchSubject
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((term) => {
        const q = term.trim();
        if (q !== (this.route.snapshot.queryParamMap.get('q') ?? '')) {
          this.updateUrl({ q, page: 1 }, true);
        }
      });
  }

  private readParams(params: ParamMap): void {
    this.searchTerm = params.get('q') ?? '';
    const sort = params.get('sort');
    this.sort = sort === 'oldest' || sort === 'title' ? sort : 'newest';
    const page = parseInt(params.get('page') ?? '1', 10);
    this.page = isFinite(page) && page > 0 ? page : 1;
  }

  private updateUrl(change: { q?: string; sort?: QuizSort; page?: number }, replace = false): void {
    const q = change.q ?? this.searchTerm.trim();
    const sort = change.sort ?? this.sort;
    const page = change.page ?? this.page;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: q || null,
        sort: sort === 'newest' ? null : sort,
        page: page > 1 ? page : null
      },
      replaceUrl: replace
    });
  }

  loadQuizzes(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.quizService
      .getPublicQuizzes({
        search: this.searchTerm.trim() || undefined,
        sort: this.sort,
        page: this.page,
        pageSize: this.pageSize
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.quizzes = data.items;
          this.total = data.total;
          this.isLoading = false;
          // Trang vượt quá cuối (vd. sau khi dữ liệu thay đổi): về trang cuối có dữ liệu
          if (data.items.length === 0 && data.total > 0 && this.page > 1) {
            this.updateUrl({ page: Math.ceil(data.total / this.pageSize) }, true);
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = extractError(err, 'Không thể tải danh sách quiz. Vui lòng thử lại.');
          console.error(err);
        }
      });
  }

  onSearch(term: string): void {
    this.searchSubject.next(term);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.updateUrl({ q: '', page: 1 });
  }

  onSortChange(sort: QuizSort): void {
    this.updateUrl({ sort, page: 1 });
  }

  onPageChange(page: number): void {
    this.updateUrl({ page });
  }

  startAttempt(quizId: number): void {
    this.router.navigate(['/quiz/attempt', quizId]);
  }

  /** Presentational: rotate a few icons so the card bands feel less uniform */
  bandIcon(index: number): string {
    const icons = ['bi-patch-question', 'bi-lightbulb', 'bi-journal-check', 'bi-puzzle'];
    return icons[index % icons.length];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('vi-VN');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
