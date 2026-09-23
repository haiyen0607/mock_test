import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-container">
      <div class="auth-left d-none d-lg-flex flex-column justify-content-center align-items-center text-white">
        <div class="text-center p-5">
          <div class="display-1 mb-4">🚀</div>
          <h1 class="fw-bold mb-3">Khám phá tri thức</h1>
          <p class="lead mb-0">Hàng ngàn bài trắc nghiệm hấp dẫn đang chờ bạn khám phá. Tham gia cùng cộng đồng học tập ngay hôm nay!</p>
        </div>
      </div>
      <div class="auth-right d-flex flex-column justify-content-center align-items-center">
        <div class="auth-card">
          <div class="text-center mb-4">
            <div class="auth-icon-circle mx-auto mb-3"><i class="bi bi-lightning-fill"></i></div>
            <h2 class="auth-title">Chào mừng trở lại</h2>
            <p class="auth-subtitle">Đăng nhập để tiếp tục</p>
          </div>

          <!-- Error Alert -->
          <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
            {{ errorMessage }}
            <button type="button" class="btn-close" (click)="errorMessage = null"></button>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <!-- Username or Email Field (backend nhận cả 2) -->
            <div class="mb-3">
              <label for="usernameOrEmail" class="form-label">Email hoặc tên đăng nhập</label>
              <div class="input-group-custom">
                <span class="input-prefix"><i class="bi bi-person"></i></span>
                <input
                  type="text"
                  class="form-control"
                  id="usernameOrEmail"
                  formControlName="usernameOrEmail"
                  placeholder="your@email.com hoặc username"
                  [class.is-invalid]="isFieldInvalid('usernameOrEmail')"
                />
              </div>
              <div *ngIf="isFieldInvalid('usernameOrEmail')" class="invalid-feedback d-block mt-1">
                Email hoặc tên đăng nhập là bắt buộc
              </div>
            </div>

            <!-- Password Field -->
            <div class="mb-4">
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
                <span *ngIf="loginForm.get('password')?.errors?.['required']">Mật khẩu là bắt buộc</span>
                <span *ngIf="loginForm.get('password')?.errors?.['minlength']">Mật khẩu tối thiểu 6 ký tự</span>
              </div>
            </div>

            <!-- Login Button -->
            <button
              type="submit"
              class="btn-gradient"
              [disabled]="isLoading || loginForm.invalid"
            >
              <span *ngIf="!isLoading">Đăng Nhập</span>
              <span *ngIf="isLoading">
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Đang xử lý...
              </span>
            </button>
          </form>

          <!-- Register Link -->
          <div class="text-center mt-4">
            <p class="text-muted mb-2">
              Chưa có tài khoản?
              <a routerLink="/auth/register" class="text-primary-custom fw-bold">Đăng ký ngay</a>
            </p>
            <p class="text-muted small mb-0">
              <a routerLink="/quiz/browse" class="text-secondary-custom">Duyệt quiz miễn phí →</a>
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

    .text-secondary-custom {
      color: #764ba2;
      text-decoration: none;
    }

    .invalid-feedback {
      color: #ef4444;
      font-size: 0.8rem;
    }
  `]
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();

    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/quiz/browse']);
    }
  }

  initForm(): void {
    this.loginForm = this.fb.group({
      usernameOrEmail: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const { usernameOrEmail, password } = this.loginForm.value;

    this.authService
      .login(usernameOrEmail, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.router.navigate(['/quiz/browse']);
        },
        error: (err) => {
          this.isLoading = false;
          // Backend trả ProblemDetails (RFC 7807): thông báo nằm trong "detail"
          this.errorMessage =
            err?.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
