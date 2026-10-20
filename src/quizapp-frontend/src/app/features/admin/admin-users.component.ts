// UC18 – Manage Users: Administrator xem danh sách tài khoản và khóa/mở khóa

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { User, UserSort } from '../../core/models';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { PagerComponent } from '../../shared/pager.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DialogService } from '../../core/services/dialog.service';
import { extractError } from '../../core/errors';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, EmptyStateComponent, SkeletonComponent, PagerComponent],
  template: `
<div class="page-container animate-fade-up">
  <header class="page-header">
    <div>
      <h1>Quản lý người dùng</h1>
      <p class="page-subtitle">Xem danh sách tài khoản và khóa hoặc mở khóa khi cần.</p>
    </div>
    <a routerLink="/admin/quizzes" class="btn btn-light">
      <i class="bi bi-shield-check me-1" aria-hidden="true"></i>Kiểm duyệt quiz
    </a>
  </header>

  <!-- Alert -->
  <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible mb-4" role="alert">
    <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
    <div class="flex-grow-1">{{ errorMessage }}</div>
    <button type="button" class="btn-close" (click)="errorMessage = null" aria-label="Đóng"></button>
  </div>

  <!-- Toolbar: tìm kiếm + sắp xếp (server-side) -->
  <div class="toolbar mb-3">
    <div class="search-field toolbar-search">
      <i class="bi bi-search" aria-hidden="true"></i>
      <input type="search" class="form-control" [ngModel]="search" (ngModelChange)="onSearchChange($event)"
             aria-label="Tìm theo tên đăng nhập hoặc email" placeholder="Tìm theo tên đăng nhập hoặc email" />
    </div>
    <div class="d-flex align-items-center gap-2">
      <label for="user-sort" class="small text-muted text-nowrap mb-0">Sắp xếp</label>
      <select id="user-sort" class="form-select form-select-sm" [ngModel]="sort" (ngModelChange)="onSortChange($event)">
        <option *ngFor="let s of sortOptions" [ngValue]="s.value">{{ s.label }}</option>
      </select>
    </div>
    <span *ngIf="!isLoading && !errorMessage" class="small text-muted tabular ms-auto" aria-live="polite">
      {{ total }} tài khoản{{ search.trim() ? ' khớp' : '' }}
    </span>
  </div>

  <!-- Loading -->
  <app-skeleton *ngIf="isLoading" variant="list" [count]="6"></app-skeleton>

  <ng-container *ngIf="!isLoading">
    <div *ngIf="users.length > 0" class="table-wrap">
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Người dùng</th>
              <th class="text-center">Vai trò</th>
              <th class="text-center">Trạng thái</th>
              <th class="d-none d-md-table-cell">Ngày tạo</th>
              <th class="text-end">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of users">
              <td>
                <div class="d-flex align-items-center gap-3">
                  <span class="avatar" aria-hidden="true">{{ user.username.charAt(0).toUpperCase() }}</span>
                  <div class="min-w-0">
                    <div class="fw-semibold text-truncate">
                      {{ user.username }}
                      <span class="small text-muted fw-normal tabular ms-1">#{{ user.userId }}</span>
                    </div>
                    <div class="small text-muted text-truncate">{{ user.email }}</div>
                  </div>
                </div>
              </td>
              <td class="text-center">
                <span class="chip text-nowrap" [ngClass]="user.role === 'Administrator' ? 'chip-brand' : ''">
                  <i class="bi" [ngClass]="user.role === 'Administrator' ? 'bi-shield-check' : 'bi-person'" aria-hidden="true"></i>
                  {{ user.role === 'Administrator' ? 'Quản trị viên' : 'Thành viên' }}
                </span>
              </td>
              <td class="text-center">
                <span class="chip text-nowrap" [ngClass]="user.status === 'Active' ? 'chip-success' : 'chip-danger'">
                  <i class="bi" [ngClass]="user.status === 'Active' ? 'bi-check-circle' : 'bi-lock'" aria-hidden="true"></i>
                  {{ user.status === 'Active' ? 'Đang hoạt động' : 'Đã khóa' }}
                </span>
              </td>
              <td class="text-muted tabular d-none d-md-table-cell">{{ formatDate(user.createdAt) }}</td>
              <td class="text-end">
                <button
                  *ngIf="user.userId !== currentUserId"
                  type="button"
                  class="btn btn-sm text-nowrap"
                  [ngClass]="user.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'"
                  (click)="toggleStatus(user)"
                  [disabled]="busyId === user.userId"
                  [attr.aria-busy]="busyId === user.userId"
                  [attr.aria-label]="(user.status === 'Active' ? 'Khóa tài khoản ' : 'Mở khóa tài khoản ') + user.username"
                >
                  <span *ngIf="busyId === user.userId" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                  <i *ngIf="busyId !== user.userId" class="bi me-1" [ngClass]="user.status === 'Active' ? 'bi-lock' : 'bi-unlock'" aria-hidden="true"></i>
                  {{ user.status === 'Active' ? 'Khóa' : 'Mở khóa' }}
                </button>
                <span *ngIf="user.userId === currentUserId" class="chip chip-outline text-nowrap">Tài khoản của bạn</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <app-pager *ngIf="users.length > 0" [page]="page" [pageSize]="pageSize" [total]="total"
               (pageChange)="goToPage($event)"></app-pager>

    <div *ngIf="users.length === 0 && !errorMessage && search.trim()" class="surface">
      <app-empty-state icon="bi-search" tone="neutral" title="Không có tài khoản phù hợp"
                       message="Thử tìm bằng tên đăng nhập hoặc email khác.">
        <button type="button" class="btn btn-light btn-sm" (click)="clearSearch()">Xóa tìm kiếm</button>
      </app-empty-state>
    </div>
    <div *ngIf="users.length === 0 && !errorMessage && !search.trim()" class="surface">
      <app-empty-state icon="bi-people" tone="neutral" title="Không có tài khoản nào"
                       message="Danh sách tài khoản sẽ hiển thị ở đây khi có người đăng ký."></app-empty-state>
    </div>
    <div *ngIf="users.length === 0 && errorMessage" class="surface">
      <app-empty-state icon="bi-exclamation-triangle" tone="danger" title="Không tải được danh sách"
                       message="Kiểm tra quyền truy cập rồi thử lại.">
        <button type="button" class="btn btn-primary" (click)="loadUsers()">
          <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
        </button>
      </app-empty-state>
    </div>
  </ng-container>
</div>
  `,
  styles: [
    `
      .toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
      .toolbar-search { flex: 1 1 16rem; max-width: 420px; }
      .toolbar .form-select { width: auto; }

      .avatar {
        width: 2.25rem; height: 2.25rem; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 12px; background: var(--brand-soft); color: var(--brand-soft-text);
        font-family: var(--font-display); font-weight: 800;
      }
      .min-w-0 { min-width: 0; max-width: 22rem; }
    `
  ]
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private dialog = inject(DialogService);
  users: User[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  busyId: number | null = null;
  currentUserId: number | null = null;

  // Server-side search / sort / pagination
  search = '';
  sort: UserSort = 'newest';
  page = 1;
  readonly pageSize = 20;
  total = 0;
  readonly sortOptions: { value: UserSort; label: string }[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
    { value: 'username', label: 'Tên đăng nhập' }
  ];

  private search$ = new Subject<string>();
  private loadSub?: Subscription;
  private destroy$ = new Subject<void>();

  constructor(
    private adminService: AdminService,
    private authService: AuthService
  ) {
    this.currentUserId = this.authService.getCurrentUser()?.userId ?? null;
  }

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page = 1;
        this.loadUsers();
      });
    this.loadUsers();
  }

  onSearchChange(value: string): void {
    this.search = value ?? '';
    this.search$.next(this.search.trim());
  }

  onSortChange(value: UserSort): void {
    this.sort = value;
    this.page = 1;
    this.loadUsers();
  }

  clearSearch(): void {
    this.onSearchChange('');
  }

  goToPage(page: number): void {
    this.page = page;
    this.loadUsers();
  }

  // UC18 – GET /admin/users?search=&page=&pageSize=&sort=
  loadUsers(): void {
    this.loadSub?.unsubscribe();
    this.isLoading = true;
    this.errorMessage = null;
    this.loadSub = this.adminService
      .getUsers({ search: this.search.trim() || undefined, page: this.page, pageSize: this.pageSize, sort: this.sort })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.users = data.items;
          this.total = data.total;
          this.isLoading = false;
          // Trang hiện tại trống sau khi dữ liệu thay đổi → lùi về trang cuối có dữ liệu
          if (data.items.length === 0 && data.total > 0 && this.page > 1) {
            this.page = Math.max(1, Math.ceil(data.total / this.pageSize));
            this.loadUsers();
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.users = [];
          this.total = 0;
          this.errorMessage = extractError(err, 'Không thể tải danh sách người dùng (cần quyền Administrator).');
        }
      });
  }

  // UC18 – PUT /admin/users/{id}/status: Active <-> Blocked
  async toggleStatus(user: User): Promise<void> {
    const newStatus = user.status === 'Active' ? 'Blocked' : 'Active';
    const action = newStatus === 'Blocked' ? 'Khóa' : 'Mở khóa';
    const ok = await this.dialog.confirm({
      title: action + ' tài khoản "' + user.username + '"?',
      message: newStatus === 'Blocked'
        ? 'Người dùng này sẽ không thể đăng nhập cho tới khi được mở khóa.'
        : 'Người dùng này sẽ đăng nhập lại được.',
      confirmText: action,
      tone: newStatus === 'Blocked' ? 'danger' : 'brand',
      icon: newStatus === 'Blocked' ? 'bi-lock' : 'bi-unlock'
    });
    if (!ok) return;

    this.busyId = user.userId;
    this.adminService.setUserStatus(user.userId, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.users = this.users.map((u) => (u.userId === updated.userId ? updated : u));
        this.busyId = null;
        this.dialog.toast(
          (updated.status === 'Blocked' ? 'Đã khóa tài khoản ' : 'Đã mở khóa tài khoản ') + updated.username + '.'
        );
      },
      error: (err) => {
        this.busyId = null;
        const message = extractError(err, 'Thao tác thất bại.');
        this.dialog.toast(message, 'danger');
      }
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('vi-VN');
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
