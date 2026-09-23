// BƯỚC 2 — UC11: Create Quiz (form tạo quiz mới)
//
// Kiến thức chính: REACTIVE FORMS
//   - FormBuilder tạo form gồm các control, mỗi control có validators
//   - Validators phía frontend được đặt KHỚP với rule backend (QuizRequest):
//       title:       [Required, StringLength(255)]
//       description: [StringLength(2000)] — không bắt buộc
//       duration:    [Range(1, 600)]
//     → chặn lỗi ngay trên form, đỡ tốn 1 request; backend vẫn validate lần nữa (không bao giờ tin client!)
//   - Nếu backend vẫn trả lỗi 400 (ValidationProblem), ta đọc err.response.data để hiển thị

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { ProblemDetails } from '../../core/models';

@Component({
  selector: 'app-quiz-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-lg-7">
          <!-- Back -->
          <a routerLink="/dashboard/my-quizzes" class="btn btn-outline-secondary mb-4">
            ← Quiz Của Tôi
          </a>

          <div class="card shadow-sm">
            <div class="card-body p-4">
              <h2 class="mb-4">➕ Tạo Quiz Mới</h2>

              <!-- Lỗi từ backend -->
              <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show">
                {{ errorMessage }}
                <button type="button" class="btn-close" (click)="errorMessage = null"></button>
              </div>

              <form [formGroup]="quizForm" (ngSubmit)="onSubmit()">
                <!-- Title: bắt buộc, tối đa 255 ký tự (khớp QuizRequest backend) -->
                <div class="mb-3">
                  <label for="title" class="form-label">Tiêu đề <span class="text-danger">*</span></label>
                  <input
                    type="text"
                    id="title"
                    class="form-control"
                    formControlName="title"
                    placeholder="VD: Kiểm tra kiến thức C# cơ bản"
                    [class.is-invalid]="isFieldInvalid('title')"
                  />
                  <div *ngIf="isFieldInvalid('title')" class="invalid-feedback d-block">
                    <span *ngIf="quizForm.get('title')?.errors?.['required']">Tiêu đề là bắt buộc</span>
                    <span *ngIf="quizForm.get('title')?.errors?.['maxlength']">Tiêu đề tối đa 255 ký tự</span>
                  </div>
                </div>

                <!-- Description: không bắt buộc, tối đa 2000 ký tự -->
                <div class="mb-3">
                  <label for="description" class="form-label">Mô tả</label>
                  <textarea
                    id="description"
                    class="form-control"
                    rows="3"
                    formControlName="description"
                    placeholder="Quiz này kiểm tra những gì? (không bắt buộc)"
                    [class.is-invalid]="isFieldInvalid('description')"
                  ></textarea>
                  <div *ngIf="isFieldInvalid('description')" class="invalid-feedback d-block">
                    Mô tả tối đa 2000 ký tự
                  </div>
                </div>

                <!-- Duration: 1–600 phút (khớp [Range(1, 600)] backend) -->
                <div class="mb-4">
                  <label for="duration" class="form-label">Thời gian làm bài (phút) <span class="text-danger">*</span></label>
                  <input
                    type="number"
                    id="duration"
                    class="form-control"
                    formControlName="duration"
                    min="1"
                    max="600"
                    [class.is-invalid]="isFieldInvalid('duration')"
                  />
                  <div *ngIf="isFieldInvalid('duration')" class="invalid-feedback d-block">
                    <span *ngIf="quizForm.get('duration')?.errors?.['required']">Thời gian là bắt buộc</span>
                    <span *ngIf="quizForm.get('duration')?.errors?.['min'] || quizForm.get('duration')?.errors?.['max']">
                      Thời gian phải từ 1 đến 600 phút
                    </span>
                  </div>
                </div>

                <!-- Submit -->
                <div class="d-flex gap-2">
                  <button
                    type="submit"
                    class="btn btn-primary"
                    [disabled]="isSubmitting || quizForm.invalid"
                  >
                    {{ isSubmitting ? 'Đang tạo...' : '💾 Tạo Quiz' }}
                  </button>
                  <a routerLink="/dashboard/my-quizzes" class="btn btn-outline-secondary">Hủy</a>
                </div>

                <p class="text-muted small mt-3 mb-0">
                  ℹ️ Quiz mới tạo ở trạng thái <strong>Riêng tư</strong>. Thêm câu hỏi xong (Bước 5)
                  mới publish được — backend yêu cầu quiz phải có ít nhất 1 câu hỏi (UC14 A1).
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class QuizCreateComponent {
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
        next: () => {
          // Tạo xong → quay về danh sách, quiz mới sẽ nằm đầu bảng
          this.router.navigate(['/dashboard/my-quizzes']);
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = this.extractError(err);
          console.error(err);
        }
      });
  }

  // Backend có 2 dạng lỗi:
  //   - ProblemDetails thường:   { detail: "..." }
  //   - ValidationProblem (400): { errors: { title: ["..."], duration: ["..."] } }
  private extractError(err: any): string {
    const data: ProblemDetails | undefined = err?.response?.data;
    if (data?.errors) {
      // Gom tất cả message validation thành 1 chuỗi
      return Object.values(data.errors).flat().join(' ');
    }
    return data?.detail || 'Tạo quiz thất bại. Vui lòng thử lại.';
  }
}
