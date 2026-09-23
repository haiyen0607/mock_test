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
    <div class="container py-5">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>👥 Quản Lý Người Dùng</h1>
        <a routerLink="/admin/quizzes" class="btn btn-outline-primary">🛡️ Kiểm Duyệt Quiz →</a>
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
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th class="text-center">Vai trò</th>
                <th class="text-center">Trạng thái</th>
                <th class="text-center">Ngày tạo</th>
                <th class="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let user of users">
                <td>{{ user.userId }}</td>
                <td><strong>{{ user.username }}</strong></td>
                <td>{{ user.email }}</td>
                <td class="text-center">
                  <span class="badge" [ngClass]="user.role === 'Administrator' ? 'bg-warning text-dark' : 'bg-info'">
                    {{ user.role }}
                  </span>
                </td>
                <td class="text-center">
                  <span class="badge" [ngClass]="user.status === 'Active' ? 'bg-success' : 'bg-danger'">
                    {{ user.status }}
                  </span>
                </td>
                <td class="text-center">{{ formatDate(user.createdAt) }}</td>
                <td class="text-end">
                  <!-- Không cho tự khóa chính mình -->
                  <button
                    *ngIf="user.userId !== currentUserId"
                    class="btn btn-sm"
                    [ngClass]="user.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'"
                    (click)="toggleStatus(user)"
                    [disabled]="busyId === user.userId"
                  >
                    {{ user.status === 'Active' ? '🔒 Khóa' : '🔓 Mở khóa' }}
                  </button>
                  <span *ngIf="user.userId === currentUserId" class="text-muted small">(bạn)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: []
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
