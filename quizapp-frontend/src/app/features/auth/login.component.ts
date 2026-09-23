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
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <div class="card shadow-lg">
            <div class="card-body p-5">
              <h2 class="card-title text-center mb-4">Đăng Nhập</h2>

              <!-- Error Alert -->
              <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
                {{ errorMessage }}
                <button type="button" class="btn-close" (click)="errorMessage = null"></button>
              </div>

              <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
                <!-- Username or Email Field (backend nhận cả 2) -->
                <div class="mb-3">
                  <label for="usernameOrEmail" class="form-label">Email hoặc tên đăng nhập</label>
                  <input
                    type="text"
                    class="form-control"
                    id="usernameOrEmail"
                    formControlName="usernameOrEmail"
                    placeholder="your@email.com hoặc username"
                    [class.is-invalid]="isFieldInvalid('usernameOrEmail')"
                  />
                  <div *ngIf="isFieldInvalid('usernameOrEmail')" class="invalid-feedback d-block">
                    Email hoặc tên đăng nhập là bắt buộc
                  </div>
                </div>

                <!-- Password Field -->
                <div class="mb-4">
                  <label for="password" class="form-label">Mật khẩu</label>
                  <input
                    type="password"
                    class="form-control"
                    id="password"
                    formControlName="password"
                    placeholder="••••••••"
                    [class.is-invalid]="isFieldInvalid('password')"
                  />
                  <div *ngIf="isFieldInvalid('password')" class="invalid-feedback d-block">
                    <span *ngIf="loginForm.get('password')?.errors?.['required']">Mật khẩu là bắt buộc</span>
                    <span *ngIf="loginForm.get('password')?.errors?.['minlength']">Mật khẩu tối thiểu 6 ký tự</span>
                  </div>
                </div>

                <!-- Login Button -->
                <button
                  type="submit"
                  class="btn btn-primary w-100"
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
                <p class="text-muted">
                  Chưa có tài khoản?
                  <a routerLink="/auth/register" class="text-primary fw-bold">Đăng ký ngay</a>
                </p>
              </div>

              <!-- Trial Link -->
              <div class="text-center">
                <p class="text-muted small">
                  <a routerLink="/quiz/browse" class="text-secondary">Duyệt quiz miễn phí →</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem 0;
    }

    .card {
      border: none;
      border-radius: 12px;
    }

    .form-label {
      font-weight: 500;
      color: #333;
      margin-bottom: 0.5rem;
    }

    .form-control {
      border-radius: 6px;
      border: 1px solid #ddd;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
    }

    .form-control:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 6px;
      padding: 0.75rem;
      font-weight: 500;
      transition: transform 0.2s;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .text-primary {
      color: #667eea !important;
      text-decoration: none;
    }

    .text-primary:hover {
      text-decoration: underline;
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
