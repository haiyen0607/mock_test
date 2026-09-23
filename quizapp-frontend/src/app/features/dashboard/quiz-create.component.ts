// BƯỚC 2 — UC11: Create Quiz (form tạo quiz mới)

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
    <div class="page-bg min-vh-100 py-5">
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-lg-7">
            <!-- Back -->
            <a routerLink="/dashboard/my-quizzes" class="btn btn-back mb-4">
              ← Quay lại Quiz Của Tôi
            </a>

            <div class="form-card">
              <div class="form-card-accent"></div>
              <div class="form-card-body p-4 p-md-5">
                <h2 class="mb-4 text-secondary fw-bold">✨ Tạo Quiz Mới</h2>

                <!-- Error -->
                <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show rounded-3 border-0">
                  {{ errorMessage }}
                  <button type="button" class="btn-close" (click)="errorMessage = null"></button>
                </div>

                <form [formGroup]="quizForm" (ngSubmit)="onSubmit()">
                  <div class="mb-4">
                    <label for="title" class="form-label">Tiêu đề <span class="text-danger">*</span></label>
                    <input
                      type="text"
                      id="title"
                      class="form-control"
                      formControlName="title"
                      placeholder="VD: Kiểm tra kiến thức cơ bản"
                      [class.is-invalid]="isFieldInvalid('title')"
                    />
                    <div *ngIf="isFieldInvalid('title')" class="invalid-feedback d-block">
                      <span *ngIf="quizForm.get('title')?.errors?.['required']">Tiêu đề là bắt buộc</span>
                      <span *ngIf="quizForm.get('title')?.errors?.['maxlength']">Tiêu đề tối đa 255 ký tự</span>
                    </div>
                  </div>

                  <div class="mb-4">
                    <label for="description" class="form-label">Mô tả</label>
                    <textarea
                      id="description"
                      class="form-control"
                      rows="4"
                      formControlName="description"
                      placeholder="Quiz này kiểm tra những gì? (không bắt buộc)"
                      [class.is-invalid]="isFieldInvalid('description')"
                    ></textarea>
                    <div *ngIf="isFieldInvalid('description')" class="invalid-feedback d-block">
                      Mô tả tối đa 2000 ký tự
                    </div>
                  </div>

                  <div class="mb-5">
                    <label for="duration" class="form-label">Thời gian làm bài (phút) <span class="text-danger">*</span></label>
                    <input
                      type="number"
                      id="duration"
                      class="form-control"
                      style="max-width: 180px;"
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

                  <!-- Buttons -->
                  <div class="d-flex gap-3 align-items-center mb-4">
                    <button
                      type="submit"
                      class="btn btn-gradient px-4"
                      [disabled]="isSubmitting || quizForm.invalid"
                    >
                      <span *ngIf="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status"></span>
                      {{ isSubmitting ? 'Đang lưu...' : 'Lưu Quiz' }}
                    </button>
                    <a routerLink="/dashboard/my-quizzes" class="btn btn-outline-secondary rounded-3 px-4">Hủy</a>
                  </div>

                  <div class="info-note p-3 rounded-3 d-flex gap-2 align-items-start">
                    <span>ℹ️</span>
                    <small class="text-muted">Quiz mới tạo ở trạng thái <strong>Riêng tư</strong>. Thêm câu hỏi xong mới publish được.</small>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-bg { background-color: #f8f9ff; }

    .btn-back {
      background: white;
      border: 1.5px solid #e8eaf6;
      border-radius: 50px;
      color: #6b7280;
      font-weight: 500;
      text-decoration: none;
      padding: 0.45rem 1rem;
      transition: all 0.2s;
    }
    .btn-back:hover { border-color: #667eea; color: #667eea; }

    .form-card {
      background: white;
      border-radius: 14px;
      border: 1px solid #e8eaf6;
      box-shadow: 0 2px 12px rgba(102,126,234,0.07);
      overflow: hidden;
      position: relative;
    }
    .form-card-accent {
      height: 5px;
      background: linear-gradient(135deg, #667eea, #764ba2);
    }

    .btn-gradient {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      padding: 0.65rem 1.5rem;
      transition: all 0.2s;
    }
    .btn-gradient:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); color: white; }
    .btn-gradient:disabled { opacity: 0.65; }

    .info-note { background: #f0f4ff; border: 1px solid #e0e7ff; }
  `]
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
