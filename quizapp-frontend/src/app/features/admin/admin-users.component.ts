// UC18 – Manage Users: Administrator xem danh sách tài khoản và khóa/mở khóa

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
<div class="admin-page min-vh-100 py-5">
  <div class="container">
    <div class="d-flex justify-content-between align-items-center mb-5">
      <div>
        <h2 class="fw-bold mb-1 d-flex align-items-center gap-2">
          <span class="fs-1 text-admin"><i class="bi bi-shield-check"></i></span> Quản Lý Hệ Thống
        </h2>
        <p class="text-muted mb-0">Phân hệ quản lý tài khoản người dùng</p>
      </div>
      <a routerLink="/admin/quizzes" class="btn btn-outline-admin rounded-pill px-4 fw-medium bg-white">
        Phê duyệt Quiz →
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
      <p class="text-muted fw-medium fs-5">Đang tải danh sách tài khoản...</p>
    </div>

    <!-- Table Card -->
    <div *ngIf="!isLoading" class="card border-0 shadow-sm rounded-4 overflow-hidden mb-5">
      <div class="card-accent-admin"></div>
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 custom-table">
          <thead class="bg-light">
            <tr>
              <th class="py-3 px-4 text-secondary font-monospace">#ID</th>
              <th class="py-3">USERNAME</th>
              <th class="py-3">EMAIL</th>
              <th class="py-3 text-center">VAI TRÒ</th>
              <th class="py-3 text-center">TRẠNG THÁI</th>
              <th class="py-3 text-center">NGÀY TẠO</th>
              <th class="py-3 px-4 text-end">THAO TÁC</th>
            </tr>
          </thead>
          <tbody class="border-top-0">
            <tr *ngFor="let user of users">
              <td class="px-4 text-muted font-monospace">{{ user.userId }}</td>
              <td class="fw-medium text-secondary d-flex align-items-center gap-2 py-3">
                <div class="avatar-sm bg-light text-admin rounded-circle d-flex align-items-center justify-content-center fw-bold border">
                  {{ user.username.charAt(0).toUpperCase() }}
                </div>
                {{ user.username }}
              </td>
              <td class="text-secondary">{{ user.email }}</td>
              <td class="text-center">
                <span class="badge rounded-pill px-3 py-2"
                      [ngClass]="user.role === 'Administrator' ? 'badge-admin' : 'badge-user'">
                  {{ user.role === 'Administrator' ? '👑 Admin' : '<i class="bi bi-person"></i> User' }}
                </span>
              </td>
              <td class="text-center">
                <span class="badge rounded-pill px-3 py-2"
                      [ngClass]="user.status === 'Active' ? 'badge-success' : 'badge-danger'">
                  <span class="status-dot" [ngClass]="user.status === 'Active' ? 'bg-success' : 'bg-danger'"></span>
                  {{ user.status === 'Active' ? 'Hoạt động' : 'Bị khóa' }}
                </span>
              </td>
              <td class="text-center text-muted">{{ formatDate(user.createdAt) }}</td>
              <td class="px-4 text-end">
                <button
                  *ngIf="user.userId !== currentUserId"
                  class="btn btn-sm rounded-pill px-3 fw-medium action-btn"
                  [ngClass]="user.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'"
                  (click)="toggleStatus(user)"
                  [disabled]="busyId === user.userId"
                >
                  <span *ngIf="busyId === user.userId" class="spinner-border spinner-border-sm me-1"></span>
                  {{ user.status === 'Active' ? '<i class="bi bi-lock"></i> Khóa' : '🔓 Mở khóa' }}
                </button>
                <span *ngIf="user.userId === currentUserId" class="badge bg-light text-secondary rounded-pill px-3 py-2 border">
                  Bạn (Không thể khóa)
                </span>
              </td>
            </tr>
            <tr *ngIf="users.length === 0">
              <td colspan="7" class="text-center py-5">
                <div class="text-muted fs-5">Không có tài khoản nào.</div>
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
      .custom-table tbody tr { transition: all 0.2s; }
      .custom-table tbody tr:hover { background-color: rgba(245, 158, 11, 0.02); }

      .avatar-sm { width: 36px; height: 36px; font-size: 1rem; }

      .badge-admin { background: rgba(245, 158, 11, 0.15); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.3); }
      .badge-user { background: rgba(102, 126, 234, 0.15); color: #4338ca; border: 1px solid rgba(102, 126, 234, 0.3); }
      .badge-success { background: rgba(16, 185, 129, 0.15); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); }
      .badge-danger { background: rgba(239, 68, 68, 0.15); color: #b91c1c; border: 1px solid rgba(239, 68, 68, 0.3); }

      .status-dot {
        display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; vertical-align: middle;
      }

      .action-btn { transition: all 0.2s; border-width: 1.5px; }
      .action-btn:hover:not(:disabled) { transform: translateY(-1px); }
    `
  ]
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  users: User[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  busyId: number | null = null;
  currentUserId: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private adminService: AdminService,
    private authService: AuthService
  ) {
    this.currentUserId = this.authService.getCurrentUser()?.userId ?? null;
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  // UC18 – GET /admin/users
  loadUsers(): void {
    this.isLoading = true;
    this.adminService.getUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.users = data; this.isLoading = false; },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.response?.data?.detail || 'Không thể tải danh sách người dùng (cần quyền Administrator).';
      }
    });
  }

  // UC18 – PUT /admin/users/{id}/status: Active <-> Blocked
  toggleStatus(user: User): void {
    const newStatus = user.status === 'Active' ? 'Blocked' : 'Active';
    const action = newStatus === 'Blocked' ? 'Khóa' : 'Mở khóa';
    if (!confirm(action + ' tài khoản "' + user.username + '"?')) return;

    this.busyId = user.userId;
    this.adminService.setUserStatus(user.userId, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        // Cập nhật đúng dòng đó trong bảng
        this.users = this.users.map((u) => (u.userId === updated.userId ? updated : u));
        this.busyId = null;
      },
      error: (err) => {
        this.busyId = null;
        this.errorMessage = err?.response?.data?.detail || 'Thao tác thất bại.';
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
