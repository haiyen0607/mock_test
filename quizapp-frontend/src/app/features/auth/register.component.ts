import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-container">
      <div class="auth-left d-none d-lg-flex flex-column justify-content-center align-items-center text-white">
        <div class="text-center p-5">
          <div class="display-1 mb-4"><i class="bi bi-mortarboard"></i></div>
          <h1 class="fw-bold mb-3">Bắt đầu hành trình</h1>
          <p class="lead mb-0">Tham gia nền tảng của chúng tôi để nâng cao kiến thức thông qua hàng ngàn bài trắc nghiệm đa dạng.</p>
        </div>
      </div>
      <div class="auth-right d-flex flex-column justify-content-center align-items-center">
        <div class="auth-card">
          <div class="text-center mb-4">
            <div class="auth-icon-circle mx-auto mb-3"><i class="bi bi-lightning-fill"></i></div>
            <h2 class="auth-title">Tạo tài khoản mới</h2>
            <p class="auth-subtitle">Bắt đầu hành trình học tập</p>
          </div>

          <!-- Error Alert -->
          <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
            {{ errorMessage }}
            <button type="button" class="btn-close" (click)="errorMessage = null"></button>
          </div>

          <!-- Success Alert -->
          <div *ngIf="successMessage" class="alert alert-success alert-dismissible fade show" role="alert">
            {{ successMessage }}
            <button type="button" class="btn-close" (click)="successMessage = null"></button>
          </div>

          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
            <!-- Username Field -->
            <div class="mb-3">
              <label for="username" class="form-label">Tên đăng nhập</label>
              <div class="input-group-custom">
                <span class="input-prefix"><i class="bi bi-person"></i></span>
                <input
                  type="text"
                  class="form-control"
                  id="username"
                  formControlName="username"
                  placeholder="username"
                  [class.is-invalid]="isFieldInvalid('username')"
                />
              </div>
              <div *ngIf="isFieldInvalid('username')" class="invalid-feedback d-block mt-1">
                <span *ngIf="registerForm.get('username')?.errors?.['required']">Tên đăng nhập là bắt buộc</span>
                <span *ngIf="registerForm.get('username')?.errors?.['minlength']">Tên đăng nhập tối thiểu 3 ký tự</span>
              </div>
            </div>

            <!-- Email Field -->
            <div class="mb-3">
              <label for="email" class="form-label">Email</label>
              <div class="input-group-custom">
                <span class="input-prefix">✉️</span>
                <input
                  type="email"
                  class="form-control"
                  id="email"
                  formControlName="email"
                  placeholder="your@email.com"
                  [class.is-invalid]="isFieldInvalid('email')"
                />
              </div>
              <div *ngIf="isFieldInvalid('email')" class="invalid-feedback d-block mt-1">
                <span *ngIf="registerForm.get('email')?.errors?.['required']">Email là bắt buộc</span>
                <span *ngIf="registerForm.get('email')?.errors?.['email']">Email không hợp lệ</span>
              </div>
            </div>

            <!-- Password Field -->
            <div class="mb-3">
              <label for="password" class="form-label">Mật khẩu</label>
              <div class="input-group-custom">
                <span class="input-prefix"><i class="bi bi-lock"></i></span>
                <input
                  type="password"
                  class="form-control"
                  id="password"
                  formControlName="password"
                  placeholder="••••••••"
                  [class.is-invalid]="isFieldInvalid('password')"
                />
              </div>
              <div *ngIf="isFieldInvalid('password')" class="invalid-feedback d-block mt-1">
                <span *ngIf="registerForm.get('password')?.errors?.['required']">Mật khẩu là bắt buộc</span>
                <span *ngIf="registerForm.get('password')?.errors?.['minlength']">Mật khẩu tối thiểu 6 ký tự</span>
              </div>
              <small class="text-muted d-block mt-1" style="font-size: 0.8rem;">Tối thiểu 6 ký tự, nên có chữ hoa, chữ thường, số</small>
            </div>

            <!-- Confirm Password Field -->
            <div class="mb-4">
              <label for="confirmPassword" class="form-label">Xác nhận mật khẩu</label>
              <div class="input-group-custom">
                <span class="input-prefix">🔐</span>
                <input
                  type="password"
                  class="form-control"
                  id="confirmPassword"
                  formControlName="confirmPassword"
                  placeholder="••••••••"
                  [class.is-invalid]="isFieldInvalid('confirmPassword')"
                />
              </div>
              <div *ngIf="isFieldInvalid('confirmPassword')" class="invalid-feedback d-block mt-1">
                <span *ngIf="registerForm.get('confirmPassword')?.errors?.['required']">Xác nhận mật khẩu là bắt buộc</span>
                <span *ngIf="registerForm.get('confirmPassword')?.errors?.['mismatch']">Mật khẩu không khớp</span>
              </div>
            </div>

            <!-- Register Button -->
            <button
              type="submit"
              class="btn-gradient"
              [disabled]="isLoading || registerForm.invalid"
            >
              <span *ngIf="!isLoading">Đăng Ký</span>
              <span *ngIf="isLoading">
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Đang xử lý...
              </span>
            </button>
          </form>

          <!-- Login Link -->
          <div class="text-center mt-4">
            <p class="text-muted">
              Đã có tài khoản?
              <a routerLink="/auth/login" class="text-primary-custom fw-bold">Đăng nhập</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #f8f9ff;
    }

    .auth-container {
      display: flex;
      min-height: 100vh;
      width: 100%;
    }

    .auth-left {
      flex: 1;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .auth-right {
      flex: 1;
      padding: 2rem;
      background: #f8f9ff;
      overflow-y: auto;
    }

    .auth-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.12);
      padding: 2.5rem;
      width: 100%;
      max-width: 450px;
    }

    .auth-icon-circle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .auth-title {
      font-weight: 700;
      color: #1f2937;
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .auth-subtitle {
      color: #6b7280;
      font-size: 0.95rem;
    }

    .form-label {
      font-weight: 600;
      font-size: 0.875rem;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .input-group-custom {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-prefix {
      position: absolute;
      left: 1rem;
      z-index: 10;
    }

    .form-control {
      padding: 0.75rem 1rem 0.75rem 2.5rem;
      border: 1.5px solid #e8eaf6;
      border-radius: 10px;
      background: #fff;
      font-size: 0.95rem;
      transition: all 0.2s;
    }

    .form-control:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
      outline: none;
    }

    .btn-gradient {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 0.85rem;
      width: 100%;
      font-weight: 600;
      font-size: 1rem;
      transition: opacity 0.2s, transform 0.2s;
      margin-top: 1rem;
    }

    .btn-gradient:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .btn-gradient:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .text-primary-custom {
      color: #667eea;
      text-decoration: none;
    }

    .text-primary-custom:hover {
      text-decoration: underline;
    }

    .invalid-feedback {
      color: #ef4444;
      font-size: 0.8rem;
    }
  `]
})
export class RegisterComponent implements OnInit, OnDestroy {
  registerForm!: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.initForm();

    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/quiz/browse']);
    }
  }

  initForm(): void {
    this.registerForm = this.fb.group(
      {
        username: ['', [Validators.required, Validators.minLength(3)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: this.passwordMatchValidator() }
    );
  }

  passwordMatchValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const password = control.get('password');
      const confirmPassword = control.get('confirmPassword');

      if (!password || !confirmPassword) {
        return null;
      }

      return password.value === confirmPassword.value ? null : { mismatch: true };
    };
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const { username, email, password } = this.registerForm.value;

    this.authService
      .register(username, email, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = 'Đăng ký thành công! Đang chuyển hướng đến trang đăng nhập...';
          setTimeout(() => {
            this.router.navigate(['/auth/login']);
          }, 2000);
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err?.response?.data?.detail || 'Đăng ký thất bại. Email hoặc username có thể đã tồn tại.';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
