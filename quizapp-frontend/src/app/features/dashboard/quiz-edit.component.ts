// UC12 – Sửa quiz: đọc :id từ URL, nạp dữ liệu cũ vào form (patchValue), PUT khi lưu

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { ProblemDetails } from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-quiz-edit',
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
              <div class="p-4 p-md-5">
                <h2 class="mb-4 text-secondary fw-bold"><i class="bi bi-pencil"></i> Sửa Quiz</h2>

                <div *ngIf="isLoading" class="text-center py-5">
                  <div class="spinner-border" role="status" style="color: #667eea;"></div>
                </div>

                <!-- Error -->
                <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show rounded-3 border-0">
                  {{ errorMessage }}
                  <button type="button" class="btn-close" (click)="errorMessage = null"></button>
                </div>

                <form *ngIf="!isLoading" [formGroup]="quizForm" (ngSubmit)="onSubmit()">
                  <div class="mb-4">
                    <label class="form-label">Tiêu đề <span class="text-danger">*</span></label>
                    <input
                      type="text"
                      class="form-control"
                      formControlName="title"
                      [class.is-invalid]="isFieldInvalid('title')"
                    />
                    <div *ngIf="isFieldInvalid('title')" class="invalid-feedback d-block">
                      Tiêu đề là bắt buộc, tối đa 255 ký tự
                    </div>
                  </div>

                  <div class="mb-4">
                    <label class="form-label">Mô tả</label>
                    <textarea
                      class="form-control"
                      rows="4"
                      formControlName="description"
                      [class.is-invalid]="isFieldInvalid('description')"
                    ></textarea>
                  </div>

                  <div class="mb-5">
                    <label class="form-label">Thời gian làm bài (phút) <span class="text-danger">*</span></label>
                    <input
                      type="number"
                      class="form-control"
                      style="max-width: 180px;"
                      formControlName="duration"
                      min="1"
                      max="600"
                      [class.is-invalid]="isFieldInvalid('duration')"
                    />
                    <div *ngIf="isFieldInvalid('duration')" class="invalid-feedback d-block">
                      Thời gian phải từ 1 đến 600 phút
                    </div>
                  </div>

                  <div class="d-flex gap-3 align-items-center">
                    <button
                      type="submit"
                      class="btn btn-gradient px-4"
                      [disabled]="isSubmitting || quizForm.invalid"
                    >
                      <span *ngIf="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status"></span>
                      {{ isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi' }}
                    </button>
                    <a routerLink="/dashboard/my-quizzes" class="btn btn-outline-secondary rounded-3 px-4">Hủy</a>
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
  `]
})
export class QuizEditComponent implements OnInit, OnDestroy {
  quizForm: FormGroup;
  isLoading = false;
  isSubmitting = false;
  errorMessage: string | null = null;
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
          this.errorMessage = err?.response?.data?.detail || 'Không thể tải quiz.';
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
        next: () => this.router.navigate(['/dashboard/my-quizzes']),
        error: (err) => {
          this.isSubmitting = false;
          const data: ProblemDetails | undefined = err?.response?.data;
          this.errorMessage = data?.errors
            ? Object.values(data.errors).flat().join(' ')
            : data?.detail || 'Lưu thất bại.';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
