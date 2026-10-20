// UC12 – Sửa quiz: đọc :id từ URL, nạp dữ liệu cũ vào form (patchValue), PUT khi lưu

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { DialogService } from '../../core/services/dialog.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { extractError } from '../../core/errors';

@Component({
  selector: 'app-quiz-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SkeletonComponent, EmptyStateComponent],
  template: `
    <div class="page-container-narrow animate-fade-up">
      <a routerLink="/dashboard/my-quizzes" class="back-link">
        <i class="bi bi-arrow-left" aria-hidden="true"></i>Quiz của tôi
      </a>

      <header class="page-header">
        <div>
          <h1>Sửa quiz</h1>
          <p class="page-subtitle">Cập nhật tiêu đề, mô tả và thời gian làm bài.</p>
        </div>
      </header>

      <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        <div>{{ errorMessage }}</div>
        <button type="button" class="btn-close" aria-label="Đóng" (click)="errorMessage = null"></button>
      </div>

      <app-skeleton *ngIf="isLoading" variant="detail"></app-skeleton>

      <div *ngIf="!isLoading && loadError" class="surface">
        <app-empty-state tone="danger" icon="bi-wifi-off" title="Không tải được quiz" [message]="loadError">
          <button type="button" class="btn btn-primary" (click)="loadQuiz()">
            <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
          </button>
          <a class="btn btn-light" routerLink="/dashboard/my-quizzes">Về Quiz của tôi</a>
        </app-empty-state>
      </div>

      <form *ngIf="!isLoading && !loadError" [formGroup]="quizForm" (ngSubmit)="onSubmit()" novalidate>
        <section class="surface form-section">
          <h2 class="section-title">Thông tin chung</h2>

          <div class="mb-3">
            <label for="editTitle" class="form-label">Tiêu đề <span class="req" aria-hidden="true">*</span><span class="visually-hidden">(bắt buộc)</span></label>
            <input
              type="text"
              id="editTitle"
              class="form-control"
              formControlName="title"
              [attr.aria-describedby]="isFieldInvalid('title') ? 'editTitleError editTitleHelp' : 'editTitleHelp'"
              [attr.aria-invalid]="isFieldInvalid('title') ? true : null"
              [class.is-invalid]="isFieldInvalid('title')"
            />
            <div id="editTitleHelp" class="form-text">Tối đa 255 ký tự.</div>
            <div *ngIf="isFieldInvalid('title')" id="editTitleError" class="invalid-feedback d-block">
              Tiêu đề là bắt buộc, tối đa 255 ký tự
            </div>
          </div>

          <div>
            <label for="editDescription" class="form-label">Mô tả</label>
            <textarea
              id="editDescription"
              class="form-control"
              rows="4"
              formControlName="description"
              [attr.aria-describedby]="isFieldInvalid('description') ? 'editDescriptionError editDescriptionHelp' : 'editDescriptionHelp'"
              [attr.aria-invalid]="isFieldInvalid('description') ? true : null"
              [class.is-invalid]="isFieldInvalid('description')"
            ></textarea>
            <div id="editDescriptionHelp" class="form-text">Không bắt buộc, tối đa 2000 ký tự.</div>
            <div *ngIf="isFieldInvalid('description')" id="editDescriptionError" class="invalid-feedback d-block">
              Mô tả tối đa 2000 ký tự
            </div>
          </div>
        </section>

        <section class="surface form-section">
          <h2 class="section-title">Cài đặt</h2>

          <label for="editDuration" class="form-label">Thời gian làm bài <span class="req" aria-hidden="true">*</span><span class="visually-hidden">(bắt buộc)</span></label>
          <div class="input-group duration-group">
            <input
              type="number"
              id="editDuration"
              class="form-control"
              formControlName="duration"
              min="1"
              max="600"
              [attr.aria-describedby]="isFieldInvalid('duration') ? 'editDurationError editDurationHelp' : 'editDurationHelp'"
              [attr.aria-invalid]="isFieldInvalid('duration') ? true : null"
              [class.is-invalid]="isFieldInvalid('duration')"
            />
            <span class="input-group-text">phút</span>
          </div>
          <div id="editDurationHelp" class="form-text">Từ 1 đến 600 phút.</div>
          <div *ngIf="isFieldInvalid('duration')" id="editDurationError" class="invalid-feedback d-block">
            Thời gian phải từ 1 đến 600 phút
          </div>
        </section>

        <div class="form-actions">
          <a routerLink="/dashboard/my-quizzes" class="btn btn-light">Hủy</a>
          <button type="submit" class="btn btn-primary" [disabled]="isSubmitting || quizForm.invalid">
            <span *ngIf="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            {{ isSubmitting ? 'Đang lưu…' : 'Lưu thay đổi' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .form-section { padding: 1.5rem; margin-bottom: 1rem; box-shadow: var(--shadow-sm); }
    .req { color: var(--danger); }
    .duration-group { max-width: 220px; }
    .duration-group .form-control { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .duration-group .input-group-text { border-top-left-radius: 0; border-bottom-left-radius: 0; border-left: 0; }

    .form-actions {
      display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap;
      margin-top: 1.25rem;
    }
    @media (max-width: 575.98px) {
      .form-section { padding: 1.15rem; }
    }
  `]
})
export class QuizEditComponent implements OnInit, OnDestroy {
  private dialog = inject(DialogService);
  quizForm: FormGroup;
  isLoading = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  loadError: string | null = null;
  private quizId!: number;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private quizService: QuizService
  ) {
    this.quizForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(2000)]],
      duration: [15, [Validators.required, Validators.min(1), Validators.max(600)]]
    });
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.quizId = parseInt(params['id'], 10);
      this.loadQuiz();
    });
  }

  // Nạp dữ liệu hiện tại vào form — điểm khác biệt chính so với form tạo mới
  loadQuiz(): void {
    this.isLoading = true;
    this.loadError = null;
    this.errorMessage = null;
    this.quizService
      .getQuizDetail(this.quizId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (quiz) => {
          // patchValue: đổ giá trị vào các control trùng tên
          this.quizForm.patchValue({
            title: quiz.title,
            description: quiz.description || '',
            duration: quiz.duration
          });
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.loadError = extractError(err, 'Quiz không tồn tại hoặc bạn không có quyền chỉnh sửa.');
        }
      });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.quizForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // UC12 – PUT /api/quizzes/{id}
  onSubmit(): void {
    if (this.quizForm.invalid) return;

    this.isSubmitting = true;
    this.errorMessage = null;
    const { title, description, duration } = this.quizForm.value;

    this.quizService
      .updateQuiz(this.quizId, {
        title: title.trim(),
        description: description?.trim() || null,
        duration: Number(duration)
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialog.toast('Đã lưu thay đổi của quiz.');
          this.router.navigate(['/dashboard/my-quizzes']);
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = extractError(err, 'Lưu thất bại.');
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
