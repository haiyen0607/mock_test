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
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-6">
          <div class="card shadow-lg">
            <div class="card-body p-5">
              <h2 class="card-title text-center mb-4">Đăng Ký</h2>
              
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
                  <input
                    type="text"
                    class="form-control"
                    id="username"
                    formControlName="username"
                    placeholder="username"
                    [class.is-invalid]="isFieldInvalid('username')"
                  />
                  <div *ngIf="isFieldInvalid('username')" class="invalid-feedback d-block">
                    <span *ngIf="registerForm.get('username')?.errors?.['required']">Tên đăng nhập là bắt buộc</span>
                    <span *ngIf="registerForm.get('username')?.errors?.['minlength']">Tên đăng nhập tối thiểu 3 ký tự</span>
                  </div>
                </div>

                <!-- Email Field -->
                <div class="mb-3">
                  <label for="email" class="form-label">Email</label>
                  <input
                    type="email"
                    class="form-control"
                    id="email"
                    formControlName="email"
                    placeholder="your@email.com"
                    [class.is-invalid]="isFieldInvalid('email')"
                  />
                  <div *ngIf="isFieldInvalid('email')" class="invalid-feedback d-block">
                    <span *ngIf="registerForm.get('email')?.errors?.['required']">Email là bắt buộc</span>
                    <span *ngIf="registerForm.get('email')?.errors?.['email']">Email không hợp lệ</span>
                  </div>
                </div>

                <!-- Password Field -->
                <div class="mb-3">
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
                    <span *ngIf="registerForm.get('password')?.errors?.['required']">Mật khẩu là bắt buộc</span>
                    <span *ngIf="registerForm.get('password')?.errors?.['minlength']">Mật khẩu tối thiểu 6 ký tự</span>
                  </div>
                  <small class="text-muted d-block mt-1">Tối thiểu 6 ký tự, nên có chữ hoa, chữ thường, số</small>
                </div>

                <!-- Confirm Password Field -->
                <div class="mb-4">
                  <label for="confirmPassword" class="form-label">Xác nhận mật khẩu</label>
                  <input
                    type="password"
                    class="form-control"
                    id="confirmPassword"
                    formControlName="confirmPassword"
                    placeholder="••••••••"
                    [class.is-invalid]="isFieldInvalid('confirmPassword')"
                  />
                  <div *ngIf="isFieldInvalid('confirmPassword')" class="invalid-feedback d-block">
                    <span *ngIf="registerForm.get('confirmPassword')?.errors?.['required']">Xác nhận mật khẩu là bắt buộc</span>
                    <span *ngIf="registerForm.get('confirmPassword')?.errors?.['mismatch']">Mật khẩu không khớp</span>
                  </div>
                </div>

                <!-- Register Button -->
                <button
                  type="submit"
                  class="btn btn-primary w-100"
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
                  <a routerLink="/auth/login" class="text-primary fw-bold">Đăng nhập</a>
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
