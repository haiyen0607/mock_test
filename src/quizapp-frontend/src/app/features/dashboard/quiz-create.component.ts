// BƯỚC 2 — UC11: Create Quiz (form tạo quiz mới)

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { extractError } from '../../core/errors';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-quiz-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="page-container-narrow animate-fade-up">
      <a routerLink="/dashboard/my-quizzes" class="back-link">
        <i class="bi bi-arrow-left" aria-hidden="true"></i>Quiz của tôi
      </a>

      <header class="page-header">
        <div>
          <h1>Tạo quiz mới</h1>
          <p class="page-subtitle">Điền thông tin cơ bản, sau đó bạn sẽ được chuyển tới trang thêm câu hỏi.</p>
        </div>
      </header>

      <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        <div>{{ errorMessage }}</div>
        <button type="button" class="btn-close" aria-label="Đóng" (click)="errorMessage = null"></button>
      </div>

      <form [formGroup]="quizForm" (ngSubmit)="onSubmit()" novalidate>
        <section class="surface form-section">
          <h2 class="section-title">Thông tin chung</h2>

          <div class="mb-3">
            <label for="title" class="form-label">Tiêu đề <span class="req" aria-hidden="true">*</span><span class="visually-hidden">(bắt buộc)</span></label>
            <input
              type="text"
              id="title"
              class="form-control"
              formControlName="title"
              [attr.aria-describedby]="isFieldInvalid('title') ? 'titleError titleHelp' : 'titleHelp'"
              [attr.aria-invalid]="isFieldInvalid('title') ? true : null"
              [class.is-invalid]="isFieldInvalid('title')"
            />
            <div id="titleHelp" class="form-text">Ví dụ: Kiểm tra kiến thức cơ bản. Tối đa 255 ký tự.</div>
            <div *ngIf="isFieldInvalid('title')" id="titleError" class="invalid-feedback d-block">
              <span *ngIf="quizForm.get('title')?.errors?.['required']">Tiêu đề là bắt buộc</span>
              <span *ngIf="quizForm.get('title')?.errors?.['maxlength']">Tiêu đề tối đa 255 ký tự</span>
            </div>
          </div>

          <div>
            <label for="description" class="form-label">Mô tả</label>
            <textarea
              id="description"
              class="form-control"
              rows="4"
              formControlName="description"
              [attr.aria-describedby]="isFieldInvalid('description') ? 'descriptionError descriptionHelp' : 'descriptionHelp'"
              [attr.aria-invalid]="isFieldInvalid('description') ? true : null"
              [class.is-invalid]="isFieldInvalid('description')"
            ></textarea>
            <div id="descriptionHelp" class="form-text">Quiz này kiểm tra những gì. Không bắt buộc.</div>
            <div *ngIf="isFieldInvalid('description')" id="descriptionError" class="invalid-feedback d-block">
              Mô tả tối đa 2000 ký tự
            </div>
          </div>
        </section>

        <section class="surface form-section">
          <h2 class="section-title">Cài đặt</h2>

          <div class="mb-3">
            <label for="duration" class="form-label">Thời gian làm bài <span class="req" aria-hidden="true">*</span><span class="visually-hidden">(bắt buộc)</span></label>
            <div class="input-group duration-group">
              <input
                type="number"
                id="duration"
                class="form-control"
                formControlName="duration"
                min="1"
                max="600"
                [attr.aria-describedby]="isFieldInvalid('duration') ? 'durationError durationHelp' : 'durationHelp'"
                [attr.aria-invalid]="isFieldInvalid('duration') ? true : null"
                [class.is-invalid]="isFieldInvalid('duration')"
              />
              <span class="input-group-text">phút</span>
            </div>
            <div id="durationHelp" class="form-text">Từ 1 đến 600 phút.</div>
            <div *ngIf="isFieldInvalid('duration')" id="durationError" class="invalid-feedback d-block">
              <span *ngIf="quizForm.get('duration')?.errors?.['required']">Thời gian là bắt buộc</span>
              <span *ngIf="quizForm.get('duration')?.errors?.['min'] || quizForm.get('duration')?.errors?.['max']">
                Thời gian phải từ 1 đến 600 phút
              </span>
            </div>
          </div>

          <div class="visibility-note">
            <i class="bi bi-lock" aria-hidden="true"></i>
            <div>
              Quiz mới tạo ở trạng thái <strong>Riêng tư</strong>. Thêm câu hỏi xong mới công khai được.
            </div>
          </div>
        </section>

        <div class="form-actions">
          <a routerLink="/dashboard/my-quizzes" class="btn btn-light">Hủy</a>
          <button type="submit" class="btn btn-primary" [disabled]="isSubmitting || quizForm.invalid">
            <span *ngIf="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            {{ isSubmitting ? 'Đang lưu…' : 'Lưu quiz' }}
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

    .visibility-note {
      display: flex; gap: 0.6rem; align-items: flex-start;
      padding: 0.75rem 0.9rem;
      border-radius: var(--radius-input);
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 0.85rem;
    }
    .visibility-note strong { color: var(--text); }

    .form-actions {
      display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap;
      margin-top: 1.25rem;
    }
    @media (max-width: 575.98px) {
      .form-section { padding: 1.15rem; }
    }
  `]
})
export class QuizCreateComponent {
  private dialog = inject(DialogService);
  quizForm: FormGroup;
  isSubmitting = false;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private quizService: QuizService,
    private router: Router
  ) {
    // Validators khớp 1-1 với QuizRequest của backend
    this.quizForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(2000)]],
      duration: [15, [Validators.required, Validators.min(1), Validators.max(600)]]
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.quizForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // UC11 – POST /api/quizzes
  onSubmit(): void {
    if (this.quizForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;

    const { title, description, duration } = this.quizForm.value;

    this.quizService
      .createQuiz({
        title: title.trim(),
        description: description?.trim() || null,
        duration: Number(duration)
      })
      .subscribe({
        next: (createdQuiz) => {
          this.dialog.toast('Đã tạo quiz. Hãy thêm câu hỏi.');
          this.router.navigate(['/dashboard/quiz-questions', createdQuiz.quizId]);
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = extractError(err, 'Tạo quiz thất bại. Vui lòng thử lại.');
          console.error(err);
        }
      });
  }
}
