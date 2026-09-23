// UC15 – Manage Question Bank: danh sách bank của tôi + tạo / sửa / xóa

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuestionBankService } from '../../core/services/question-bank.service';
import { QuestionBank } from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-question-banks',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container py-5">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>🗄️ Ngân Hàng Câu Hỏi</h1>
        <button class="btn btn-primary" (click)="startCreate()">➕ Tạo Bank Mới</button>
      </div>

      <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show">
        {{ errorMessage }}
        <button type="button" class="btn-close" (click)="errorMessage = null"></button>
      </div>

      <!-- Form tạo / sửa (dùng chung, phân biệt bằng editingId) -->
      <div *ngIf="showForm" class="card shadow-sm mb-4">
        <div class="card-body">
          <h5>{{ editingId ? '✏️ Sửa Bank' : '➕ Tạo Bank Mới' }}</h5>
          <div class="mb-3">
            <label class="form-label">Tên bank <span class="text-danger">*</span></label>
            <input type="text" class="form-control" [(ngModel)]="form.name" maxlength="255" />
          </div>
          <div class="mb-3">
            <label class="form-label">Mô tả</label>
            <input type="text" class="form-control" [(ngModel)]="form.description" maxlength="2000" />
          </div>
          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="isPublic" [(ngModel)]="form.isPublic" />
            <label class="form-check-label" for="isPublic">
              Công khai — người khác tìm và tái sử dụng được câu hỏi trong bank này (UC16/UC17)
            </label>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-primary" (click)="save()" [disabled]="isSaving || !form.name.trim()">
              {{ isSaving ? 'Đang lưu...' : '💾 Lưu' }}
            </button>
            <button class="btn btn-outline-secondary" (click)="showForm = false">Hủy</button>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <!-- Danh sách bank -->
      <div *ngIf="!isLoading && banks.length > 0" class="card shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Tên</th>
                <th class="text-center">Số câu hỏi</th>
                <th class="text-center">Trạng thái</th>
                <th class="text-center">Ngày tạo</th>
                <th class="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let bank of banks">
                <td>
                  <strong>{{ bank.name }}</strong>
                  <div class="small text-muted">{{ bank.description || 'Chưa có mô tả' }}</div>
                </td>
                <td class="text-center">{{ bank.questionCount }}</td>
                <td class="text-center">
                  <span class="badge" [ngClass]="bank.isPublic ? 'bg-success' : 'bg-secondary'">
                    {{ bank.isPublic ? 'Công khai' : 'Riêng tư' }}
                  </span>
                </td>
                <td class="text-center">{{ formatDate(bank.createdAt) }}</td>
                <td class="text-end">
                  <a class="btn btn-sm btn-outline-success me-1" [routerLink]="['/dashboard/question-banks', bank.questionBankId]">
                    📝 Câu hỏi
                  </a>
                  <button class="btn btn-sm btn-outline-primary me-1" (click)="startEdit(bank)">✏️ Sửa</button>
                  <button class="btn btn-sm btn-outline-danger" (click)="deleteBank(bank)">🗑️ Xóa</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div *ngIf="!isLoading && banks.length === 0" class="text-center py-5">
        <p class="text-muted">Chưa có bank nào. Tạo bank đầu tiên để bắt đầu lưu câu hỏi!</p>
      </div>
    </div>
  `,
  styles: []
})
export class QuestionBanksComponent implements OnInit, OnDestroy {
  banks: QuestionBank[] = [];
  isLoading = false;
  isSaving = false;
  errorMessage: string | null = null;

  showForm = false;
  editingId: number | null = null;
  form = { name: '', description: '', isPublic: false };

  private destroy$ = new Subject<void>();

  constructor(private bankService: QuestionBankService) {}

  ngOnInit(): void {
    this.loadBanks();
  }

  loadBanks(): void {
    this.isLoading = true;
    this.bankService.getMyBanks().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.banks = data; this.isLoading = false; },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.response?.data?.detail || 'Không thể tải danh sách bank.';
      }
    });
  }

  startCreate(): void {
    this.editingId = null;
    this.form = { name: '', description: '', isPublic: false };
    this.showForm = true;
  }

  startEdit(bank: QuestionBank): void {
    this.editingId = bank.questionBankId;
    this.form = { name: bank.name, description: bank.description || '', isPublic: bank.isPublic };
    this.showForm = true;
  }

  // UC15 – POST hoặc PUT tùy đang tạo hay sửa
  save(): void {
    this.isSaving = true;
    this.errorMessage = null;

    const request = {
      name: this.form.name.trim(),
      description: this.form.description.trim() || null,
      isPublic: this.form.isPublic
    };

    const call$ = this.editingId
      ? this.bankService.updateBank(this.editingId, request)
      : this.bankService.createBank(request);

    call$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSaving = false;
        this.showForm = false;
        this.loadBanks();
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err?.response?.data?.detail || 'Lưu thất bại.';
      }
    });
  }

  // UC15 – DELETE
  deleteBank(bank: QuestionBank): void {
    if (!confirm('Xóa bank "' + bank.name + '" cùng toàn bộ ' + bank.questionCount + ' câu hỏi trong đó?')) return;

    this.bankService.deleteBank(bank.questionBankId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => (this.banks = this.banks.filter((b) => b.questionBankId !== bank.questionBankId)),
      error: (err) => (this.errorMessage = err?.response?.data?.detail || 'Xóa thất bại.')
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
