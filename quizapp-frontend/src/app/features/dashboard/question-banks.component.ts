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
    <div class="page-bg min-vh-100 py-5">
      <div class="container">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h1 class="m-0 text-secondary"><i class="bi bi-archive"></i> Ngân Hàng Câu Hỏi</h1>
          <button class="btn btn-gradient" (click)="startCreate()">+ Tạo Bank Mới</button>
        </div>

        <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show shadow-sm border-0 rounded-3">
          {{ errorMessage }}
          <button type="button" class="btn-close" (click)="errorMessage = null"></button>
        </div>

        <!-- Form tạo / sửa (dùng chung, phân biệt bằng editingId) -->
        <div *ngIf="showForm" class="form-card mb-4">
          <div class="form-card-accent"></div>
          <div class="p-4">
            <h5 class="fw-bold mb-4">{{ editingId ? '<i class="bi bi-pencil"></i> Sửa Bank' : '<i class="bi bi-plus"></i> Tạo Bank Mới' }}</h5>

            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">Tên bank <span class="text-danger">*</span></label>
                <input type="text" class="form-control" [(ngModel)]="form.name" maxlength="255" placeholder="Nhập tên ngân hàng..." />
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label">Mô tả</label>
                <input type="text" class="form-control" [(ngModel)]="form.description" maxlength="2000" placeholder="Mô tả ngắn (không bắt buộc)" />
              </div>
            </div>

            <div class="form-check mb-4">
              <input class="form-check-input" type="checkbox" id="isPublic" [(ngModel)]="form.isPublic" />
              <label class="form-check-label text-muted" for="isPublic">
                Công khai — người khác tìm và tái sử dụng được câu hỏi trong bank này
              </label>
            </div>

            <div class="d-flex gap-3">
              <button class="btn btn-gradient px-4" (click)="save()" [disabled]="isSaving || !form.name.trim()">
                <span *ngIf="isSaving" class="spinner-border spinner-border-sm me-2" role="status"></span>
                {{ isSaving ? 'Đang lưu...' : 'Lưu' }}
              </button>
              <button class="btn btn-outline-secondary rounded-3 px-4" (click)="showForm = false">Hủy</button>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="isLoading" class="text-center py-5">
          <div class="spinner-border" role="status" style="color: #667eea;"></div>
        </div>

        <!-- Danh sách bank -->
        <div *ngIf="!isLoading && banks.length > 0" class="card card-custom">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="thead-custom">
                <tr>
                  <th>Tên & Mô tả</th>
                  <th class="text-center">Số câu hỏi</th>
                  <th class="text-center">Trạng thái</th>
                  <th class="text-center">Ngày tạo</th>
                  <th class="text-end">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let bank of banks">
                  <td>
                    <div class="fw-medium text-secondary">{{ bank.name }}</div>
                    <div class="small text-muted">{{ bank.description || 'Chưa có mô tả' }}</div>
                  </td>
                  <td class="text-center">
                    <span class="badge bg-light text-secondary border">{{ bank.questionCount }}</span>
                  </td>
                  <td class="text-center">
                    <span class="badge badge-pill-custom" [ngClass]="bank.isPublic ? 'bg-success' : 'bg-secondary'">
                      {{ bank.isPublic ? 'Công khai' : 'Riêng tư' }}
                    </span>
                  </td>
                  <td class="text-center text-secondary small">{{ formatDate(bank.createdAt) }}</td>
                  <td class="text-end">
                    <a class="btn btn-sm btn-outline-success me-1 rounded-pill px-3" [routerLink]="['/dashboard/question-banks', bank.questionBankId]">
                      Câu hỏi
                    </a>
                    <button class="btn btn-sm btn-outline-primary me-1 rounded-pill px-3" (click)="startEdit(bank)">Sửa</button>
                    <button class="btn btn-sm btn-outline-danger rounded-pill px-3" (click)="deleteBank(bank)">Xóa</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Empty state -->
        <div *ngIf="!isLoading && banks.length === 0" class="card card-custom empty-state">
          <div class="empty-emoji">📂</div>
          <h4 class="text-secondary mb-2">Chưa có ngân hàng nào</h4>
          <p class="text-muted mb-4">Tạo ngân hàng đầu tiên để bắt đầu lưu câu hỏi!</p>
          <button class="btn btn-gradient px-4 py-2" (click)="startCreate()">Tạo Bank Mới</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-bg { background-color: #f8f9ff; }

    .btn-gradient {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      font-weight: 600;
      border-radius: 8px;
      padding: 0.55rem 1.2rem;
      transition: all 0.2s;
    }
    .btn-gradient:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); color: white; }
    .btn-gradient:disabled { opacity: 0.65; }

    .form-card {
      background: white;
      border-radius: 14px;
      border: 1px solid #e8eaf6;
      box-shadow: 0 2px 12px rgba(102,126,234,0.07);
      overflow: hidden;
    }
    .form-card-accent { height: 5px; background: linear-gradient(135deg, #667eea, #764ba2); }

    .card-custom {
      background: white;
      border-radius: 14px;
      border: 1px solid #e8eaf6;
      box-shadow: 0 2px 12px rgba(102,126,234,0.07);
      overflow: hidden;
    }

    .thead-custom th {
      text-transform: uppercase;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #6b7280;
      padding-top: 1rem;
      padding-bottom: 1rem;
      background: #f8f9ff;
      border-bottom: 2px solid #e8eaf6;
    }

    .badge-pill-custom { border-radius: 50rem; padding: 0.4em 0.85em; font-weight: 600; }

    .empty-state { padding: 5rem 2rem; text-align: center; }
    .empty-emoji { font-size: 3.5rem; margin-bottom: 1rem; }
  `]
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
