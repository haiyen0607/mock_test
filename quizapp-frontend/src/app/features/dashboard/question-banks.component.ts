// UC15 – Manage Question Bank: danh sách ngân hàng câu hỏi của tôi + tạo / sửa / xóa
// UC16 – Duyệt ngân hàng câu hỏi công khai (tab "Công khai", ?tab=public)

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuestionBankService } from '../../core/services/question-bank.service';
import { QuestionBank, QuestionBankInfo, QuizSort } from '../../core/models';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { PagerComponent } from '../../shared/pager.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DialogService } from '../../core/services/dialog.service';
import { extractError } from '../../core/errors';

@Component({
  selector: 'app-question-banks',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, EmptyStateComponent, SkeletonComponent, PagerComponent],
  template: `
    <div class="page-container animate-fade-up">
      <header class="page-header">
        <div>
          <h1>Ngân hàng câu hỏi</h1>
          <p class="page-subtitle">Lưu câu hỏi theo chủ đề để tái sử dụng khi tạo quiz.</p>
        </div>
        <button *ngIf="tab === 'mine'" type="button" class="btn btn-primary" (click)="startCreate()">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Tạo ngân hàng
        </button>
      </header>

      <ul class="nav nav-tabs bank-tabs mb-4" role="tablist" aria-label="Loại ngân hàng câu hỏi">
        <li class="nav-item" role="presentation">
          <button type="button" class="nav-link" role="tab" [class.active]="tab === 'mine'"
                  [attr.aria-selected]="tab === 'mine'" (click)="selectTab('mine')">
            <i class="bi bi-person me-1" aria-hidden="true"></i>Của tôi
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button type="button" class="nav-link" role="tab" [class.active]="tab === 'public'"
                  [attr.aria-selected]="tab === 'public'" (click)="selectTab('public')">
            <i class="bi bi-globe2 me-1" aria-hidden="true"></i>Công khai
          </button>
        </li>
      </ul>

      <ng-container *ngIf="tab === 'mine'">

      <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible mb-4" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        <div class="flex-grow-1">{{ errorMessage }}</div>
        <button type="button" class="btn-close" (click)="errorMessage = null" aria-label="Đóng"></button>
      </div>

      <!-- Form tạo / sửa (dùng chung, phân biệt bằng editingId) -->
      <section *ngIf="showForm" class="surface bank-form mb-4 animate-pop" aria-labelledby="bank-form-title">
        <div class="d-flex align-items-center gap-3 mb-4">
          <span class="icon-tile" aria-hidden="true"><i class="bi" [ngClass]="editingId ? 'bi-pencil' : 'bi-plus-lg'"></i></span>
          <h2 id="bank-form-title" class="section-title m-0">{{ editingId ? 'Sửa ngân hàng câu hỏi' : 'Tạo ngân hàng câu hỏi mới' }}</h2>
        </div>

        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label" for="bankName">
              Tên ngân hàng <span class="text-danger" aria-hidden="true">*</span><span class="visually-hidden">(bắt buộc)</span>
            </label>
            <input id="bankName" type="text" class="form-control" [(ngModel)]="form.name" maxlength="255"
                   (ngModelChange)="nameError = null"
                   [class.is-invalid]="nameError" [attr.aria-invalid]="nameError ? true : null"
                   [attr.aria-describedby]="nameError ? 'bankNameError bankNameHelp' : 'bankNameHelp'" />
            <div *ngIf="nameError" id="bankNameError" class="invalid-feedback d-block">{{ nameError }}</div>
            <div id="bankNameHelp" class="form-text">Ví dụ: Toán lớp 10 – Hàm số</div>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="bankDesc">Mô tả</label>
            <input id="bankDesc" type="text" class="form-control" [(ngModel)]="form.description" maxlength="2000"
                   aria-describedby="bankDescHelp" />
            <div id="bankDescHelp" class="form-text">Không bắt buộc</div>
          </div>
        </div>

        <div class="form-check mt-3 mb-4">
          <input class="form-check-input" type="checkbox" id="isPublic" [(ngModel)]="form.isPublic" aria-describedby="isPublicHelp" />
          <label class="form-check-label" for="isPublic">
            Công khai
            <span id="isPublicHelp" class="d-block form-text mt-0">Người khác có thể tìm và tái sử dụng câu hỏi trong ngân hàng này.</span>
          </label>
        </div>

        <div class="d-flex gap-2">
          <button type="button" class="btn btn-primary" (click)="save()" [disabled]="isSaving">
            <span *ngIf="isSaving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
            {{ isSaving ? 'Đang lưu…' : 'Lưu' }}
          </button>
          <button type="button" class="btn btn-light" (click)="showForm = false" [disabled]="isSaving">Hủy</button>
        </div>
      </section>

      <!-- Loading -->
      <app-skeleton *ngIf="isLoading && banks.length === 0" variant="cards" [count]="6"></app-skeleton>

      <!-- Lỗi tải: khác với danh sách trống -->
      <div *ngIf="!isLoading && loadError" class="surface">
        <app-empty-state tone="danger" icon="bi-wifi-off" title="Không tải được ngân hàng câu hỏi" [message]="loadError">
          <button type="button" class="btn btn-primary" (click)="loadBanks()">
            <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
          </button>
        </app-empty-state>
      </div>

      <ng-container *ngIf="!loadError && banks.length > 0">
        <div class="list-toolbar mb-3">
          <span class="small text-muted tabular">{{ total }} ngân hàng câu hỏi</span>
          <label for="bankSort" class="form-label m-0 ms-auto">Sắp xếp</label>
          <select id="bankSort" class="form-select form-select-sm sort-select" [(ngModel)]="sort"
                  (ngModelChange)="changeSort()" [disabled]="isLoading">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="title">Tên</option>
          </select>
          <span *ngIf="isLoading" class="spinner-border spinner-border-sm text-muted" role="status">
            <span class="visually-hidden">Đang tải…</span>
          </span>
        </div>

        <!-- Danh sách ngân hàng -->
        <div class="bank-grid stagger" [class.is-busy]="isLoading">
          <article *ngFor="let bank of banks" class="card card-hover bank-card">
            <div class="card-body d-flex flex-column">
              <div class="d-flex align-items-start gap-3 mb-3">
                <span class="icon-tile" aria-hidden="true"><i class="bi bi-archive"></i></span>
                <div class="min-w-0 flex-grow-1">
                  <h2 class="bank-name">
                    <a [routerLink]="['/dashboard/question-banks', bank.questionBankId]" [state]="{ bankName: bank.name }">{{ bank.name }}</a>
                  </h2>
                  <p class="bank-desc" [class.is-empty]="!bank.description">{{ bank.description || 'Chưa có mô tả' }}</p>
                </div>
              </div>

              <div class="d-flex flex-wrap gap-2 mb-3">
                <span class="chip chip-brand tabular"><i class="bi bi-question-circle" aria-hidden="true"></i>{{ bank.questionCount }} câu hỏi</span>
                <span class="chip" [ngClass]="bank.isPublic ? 'chip-success' : ''">
                  <i class="bi" [ngClass]="bank.isPublic ? 'bi-globe2' : 'bi-lock'" aria-hidden="true"></i>{{ bank.isPublic ? 'Công khai' : 'Riêng tư' }}
                </span>
              </div>

              <div class="bank-footer mt-auto">
                <span class="small text-muted tabular">Tạo ngày {{ formatDate(bank.createdAt) }}</span>
                <div class="d-flex gap-1">
                  <a class="btn btn-light btn-sm" [routerLink]="['/dashboard/question-banks', bank.questionBankId]"
                     [state]="{ bankName: bank.name }" [attr.aria-label]="'Câu hỏi trong ngân hàng ' + bank.name">Câu hỏi</a>
                  <button type="button" class="btn btn-light btn-icon btn-sm" (click)="startEdit(bank)"
                          [disabled]="deletingId === bank.questionBankId"
                          title="Sửa ngân hàng" [attr.aria-label]="'Sửa ngân hàng ' + bank.name">
                    <i class="bi bi-pencil" aria-hidden="true"></i>
                  </button>
                  <button type="button" class="btn btn-outline-danger btn-icon btn-sm" (click)="deleteBank(bank)"
                          [disabled]="deletingId === bank.questionBankId"
                          title="Xóa ngân hàng" [attr.aria-label]="'Xóa ngân hàng ' + bank.name">
                    <span *ngIf="deletingId === bank.questionBankId; else trashIcon" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                    <ng-template #trashIcon><i class="bi bi-trash" aria-hidden="true"></i></ng-template>
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>

        <app-pager [page]="page" [pageSize]="pageSize" [total]="total" [disabled]="isLoading"
                   (pageChange)="goToPage($event)"></app-pager>
      </ng-container>

      <!-- Empty state -->
      <div *ngIf="!isLoading && !loadError && banks.length === 0" class="surface">
        <app-empty-state icon="bi-archive" title="Chưa có ngân hàng câu hỏi nào"
                         message="Tạo ngân hàng câu hỏi đầu tiên để bắt đầu lưu câu hỏi.">
          <button type="button" class="btn btn-primary" (click)="startCreate()">
            <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Tạo ngân hàng
          </button>
        </app-empty-state>
      </div>
      </ng-container>

      <!-- ===== Tab Công khai ===== -->
      <ng-container *ngIf="tab === 'public'">
        <p class="text-muted mb-3">Ngân hàng câu hỏi do mọi người chia sẻ. Bạn có thể xem câu hỏi và tái sử dụng chúng khi soạn quiz.</p>

        <div class="list-toolbar mb-3">
          <div class="search-field toolbar-search">
            <i class="bi bi-search" aria-hidden="true"></i>
            <input type="search" class="form-control" [ngModel]="publicSearch" (ngModelChange)="onPublicSearchChange($event)"
                   aria-label="Tìm theo tên ngân hàng hoặc người tạo" placeholder="Tìm theo tên ngân hàng hoặc người tạo" />
          </div>
          <span *ngIf="!publicLoadError && publicTotal > 0" class="small text-muted tabular">{{ publicTotal }} ngân hàng</span>
          <label for="publicSort" class="form-label m-0 ms-auto">Sắp xếp</label>
          <select id="publicSort" class="form-select form-select-sm sort-select" [(ngModel)]="publicSort"
                  (ngModelChange)="changePublicSort()">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="title">Tên</option>
          </select>
          <span *ngIf="publicLoading && publicBanks.length > 0" class="spinner-border spinner-border-sm text-muted" role="status">
            <span class="visually-hidden">Đang tải…</span>
          </span>
        </div>

        <app-skeleton *ngIf="publicLoading && publicBanks.length === 0" variant="cards" [count]="6"></app-skeleton>

        <div *ngIf="!publicLoading && publicLoadError" class="surface">
          <app-empty-state tone="danger" icon="bi-wifi-off" title="Không tải được ngân hàng công khai" [message]="publicLoadError">
            <button type="button" class="btn btn-primary" (click)="loadPublicBanks()">
              <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
            </button>
          </app-empty-state>
        </div>

        <ng-container *ngIf="!publicLoadError && publicBanks.length > 0">
          <div class="bank-grid stagger" [class.is-busy]="publicLoading">
            <article *ngFor="let bank of publicBanks" class="card card-hover bank-card">
              <div class="card-body d-flex flex-column">
                <div class="d-flex align-items-start gap-3 mb-3">
                  <span class="icon-tile" aria-hidden="true"><i class="bi bi-archive"></i></span>
                  <div class="min-w-0 flex-grow-1">
                    <h2 class="bank-name">
                      <a class="stretched-link" [routerLink]="['/dashboard/question-banks', bank.questionBankId]"
                         [state]="{ bankName: bank.name }">{{ bank.name }}</a>
                    </h2>
                    <p class="bank-desc" [class.is-empty]="!bank.description">{{ bank.description || 'Chưa có mô tả' }}</p>
                  </div>
                </div>

                <div class="d-flex flex-wrap gap-2 mt-auto">
                  <span class="chip tabular"><i class="bi bi-question-circle" aria-hidden="true"></i>{{ bank.questionCount }} câu hỏi</span>
                  <span class="chip owner-chip"><i class="bi bi-person" aria-hidden="true"></i>bởi {{ bank.ownerUsername }}</span>
                  <span *ngIf="bank.canManage" class="chip chip-brand">Của bạn</span>
                </div>
              </div>
            </article>
          </div>

          <app-pager [page]="publicPage" [pageSize]="pageSize" [total]="publicTotal" [disabled]="publicLoading"
                     (pageChange)="goToPublicPage($event)"></app-pager>
        </ng-container>

        <div *ngIf="!publicLoading && !publicLoadError && publicBanks.length === 0" class="surface">
          <app-empty-state *ngIf="!publicSearch.trim()" icon="bi-globe2" title="Chưa có ngân hàng công khai nào"
                           message="Khi ai đó chia sẻ ngân hàng câu hỏi ở chế độ công khai, ngân hàng đó sẽ xuất hiện ở đây."></app-empty-state>
          <app-empty-state *ngIf="publicSearch.trim()" icon="bi-search" title="Không tìm thấy ngân hàng phù hợp"
                           message="Thử từ khóa khác hoặc xóa tìm kiếm để xem tất cả.">
            <button type="button" class="btn btn-light" (click)="clearPublicSearch()">Xóa tìm kiếm</button>
          </app-empty-state>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .bank-form { padding: 1.5rem; box-shadow: var(--shadow-sm); }

    .list-toolbar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .sort-select { width: auto; min-width: 140px; }
    .toolbar-search { flex: 1 1 16rem; max-width: 420px; }
    .owner-chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (max-width: 575.98px) {
      .bank-tabs { display: flex; width: 100%; }
      .bank-tabs .nav-item { flex: 1 1 0; }
      .bank-tabs .nav-link { width: 100%; }
    }

    .bank-grid {
      display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      transition: opacity var(--transition);
    }
    .bank-grid.is-busy { opacity: 0.6; }
    .bank-card .card-body { padding: 1.25rem; }
    .min-w-0 { min-width: 0; }
    .bank-name {
      font-size: 1.05rem; font-weight: 800; margin: 0 0 0.25rem; word-break: break-word;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .bank-name a { color: var(--text); text-decoration: none; }
    .bank-name a:hover { color: var(--brand-600); }
    .bank-desc {
      margin: 0; color: var(--text-2); font-size: 0.88rem;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .bank-desc.is-empty { color: var(--text-muted); font-style: italic; }
    .bank-footer {
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      padding-top: 0.85rem; border-top: 1px solid var(--border);
    }
    .bank-footer .btn-icon.btn-sm { width: 2rem; height: 2rem; }
  `]
})
export class QuestionBanksComponent implements OnInit, OnDestroy {
  private dialog = inject(DialogService);
  banks: QuestionBank[] = [];
  isLoading = false;
  isSaving = false;
  loadError: string | null = null;
  errorMessage: string | null = null;
  nameError: string | null = null;
  deletingId: number | null = null;

  // Phân trang phía máy chủ
  page = 1;
  readonly pageSize = 12;
  total = 0;
  sort: QuizSort = 'newest';

  showForm = false;
  editingId: number | null = null;
  form = { name: '', description: '', isPublic: false };

  // Tab hiện tại, đồng bộ với query param ?tab=public
  tab: 'mine' | 'public' = 'mine';
  private mineLoaded = false;

  // Tab Công khai (phân trang + tìm kiếm phía máy chủ)
  publicBanks: QuestionBankInfo[] = [];
  publicLoading = false;
  publicLoadError: string | null = null;
  publicPage = 1;
  publicTotal = 0;
  publicSort: QuizSort = 'newest';
  publicSearch = '';
  private publicLoaded = false;
  private publicSearch$ = new Subject<string>();
  private publicSub?: Subscription;

  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);

  constructor(private bankService: QuestionBankService, private router: Router) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.tab = params.get('tab') === 'public' ? 'public' : 'mine';
      if (this.tab === 'public' && !this.publicLoaded) {
        this.publicLoaded = true;
        this.loadPublicBanks();
      } else if (this.tab === 'mine' && !this.mineLoaded) {
        this.mineLoaded = true;
        this.loadBanks();
      }
    });

    this.publicSearch$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.publicPage = 1;
        this.loadPublicBanks();
      });
  }

  selectTab(tab: 'mine' | 'public'): void {
    if (tab === this.tab) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'public' ? 'public' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  // UC16 – GET /question-banks/public?search=&page=&pageSize=&sort=
  loadPublicBanks(): void {
    this.publicSub?.unsubscribe();
    this.publicLoading = true;
    this.publicLoadError = null;
    const search = this.publicSearch.trim();
    this.publicSub = this.bankService
      .getPublicBanks({
        page: this.publicPage,
        pageSize: this.pageSize,
        sort: this.publicSort,
        search: search || undefined
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.publicTotal = data.total;
          // Trang hiện tại trống (dữ liệu vừa thay đổi) — lùi về trang cuối có dữ liệu
          if (data.items.length === 0 && this.publicPage > 1 && data.total > 0) {
            this.publicPage = Math.max(1, Math.ceil(data.total / this.pageSize));
            this.loadPublicBanks();
            return;
          }
          this.publicBanks = data.items;
          this.publicLoading = false;
        },
        error: (err) => {
          this.publicLoading = false;
          this.publicBanks = [];
          this.publicLoadError = extractError(err, 'Không thể tải danh sách ngân hàng công khai.');
        }
      });
  }

  onPublicSearchChange(value: string): void {
    this.publicSearch = value ?? '';
    this.publicSearch$.next(this.publicSearch.trim());
  }

  clearPublicSearch(): void {
    this.onPublicSearchChange('');
  }

  changePublicSort(): void {
    this.publicPage = 1;
    this.loadPublicBanks();
  }

  goToPublicPage(p: number): void {
    this.publicPage = p;
    this.loadPublicBanks();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // UC15 – GET /question-banks/mine?page=&pageSize=&sort=
  loadBanks(): void {
    this.isLoading = true;
    this.loadError = null;
    this.bankService
      .getMyBanks({ page: this.page, pageSize: this.pageSize, sort: this.sort })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.total = data.total;
          // Trang hiện tại trống (vd. vừa xóa mục cuối trang) — lùi lại một trang
          if (data.items.length === 0 && this.page > 1) {
            this.page = Math.max(1, Math.ceil(data.total / this.pageSize));
            this.loadBanks();
            return;
          }
          this.banks = data.items;
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.banks = [];
          this.loadError = extractError(err, 'Không thể tải danh sách ngân hàng câu hỏi.');
        }
      });
  }

  goToPage(p: number): void {
    this.page = p;
    this.loadBanks();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  changeSort(): void {
    this.page = 1;
    this.loadBanks();
  }

  startCreate(): void {
    this.editingId = null;
    this.nameError = null;
    this.form = { name: '', description: '', isPublic: false };
    this.showForm = true;
    setTimeout(() => document.getElementById('bankName')?.focus(), 0);
  }

  startEdit(bank: QuestionBank): void {
    this.editingId = bank.questionBankId;
    this.nameError = null;
    this.form = { name: bank.name, description: bank.description || '', isPublic: bank.isPublic };
    this.showForm = true;
    setTimeout(() => {
      const el = document.getElementById('bankName');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }, 0);
  }

  // UC15 – POST hoặc PUT tùy đang tạo hay sửa
  save(): void {
    if (!this.form.name.trim()) {
      this.nameError = 'Hãy nhập tên ngân hàng câu hỏi.';
      document.getElementById('bankName')?.focus();
      return;
    }

    this.isSaving = true;
    this.errorMessage = null;

    const request = {
      name: this.form.name.trim(),
      description: this.form.description.trim() || null,
      isPublic: this.form.isPublic
    };
    const editingId = this.editingId;

    const call$ = editingId
      ? this.bankService.updateBank(editingId, request)
      : this.bankService.createBank(request);

    call$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.showForm = false;
        if (!editingId && res && res.questionBankId) {
          this.dialog.toast('Đã tạo ngân hàng câu hỏi "' + request.name + '".');
          this.router.navigate(['/dashboard/question-banks', res.questionBankId], { state: { bankName: request.name } });
        } else {
          this.dialog.toast('Đã lưu ngân hàng câu hỏi "' + request.name + '".');
          this.loadBanks();
        }
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = extractError(err, 'Lưu thất bại.');
      }
    });
  }

  // UC15 – DELETE
  async deleteBank(bank: QuestionBank): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Xóa ngân hàng "' + bank.name + '"?',
      message: 'Toàn bộ ' + bank.questionCount + ' câu hỏi trong ngân hàng này cũng sẽ bị xóa.',
      confirmText: 'Xóa',
      tone: 'danger',
      icon: 'bi-trash'
    });
    if (!ok) return;

    this.deletingId = bank.questionBankId;
    this.errorMessage = null;
    this.bankService.deleteBank(bank.questionBankId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.deletingId = null;
        if (this.editingId === bank.questionBankId) this.showForm = false;
        this.dialog.toast('Đã xóa ngân hàng câu hỏi "' + bank.name + '".');
        this.loadBanks();
      },
      error: (err) => {
        this.deletingId = null;
        this.errorMessage = extractError(err, 'Xóa thất bại.');
      }
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('vi-VN');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
