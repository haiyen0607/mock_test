import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AUTH_STYLES } from './auth.styles';
import { safeReturnUrl } from './return-url';
import { extractError } from '../../core/errors';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-wrap animate-fade-up">
      <div class="auth-grid">
        <section class="auth-form surface" aria-labelledby="login-title">
          <a routerLink="/quiz/browse" class="brand-mark">
            <span class="brand-glyph" aria-hidden="true">Q</span>
            <span>QuizApp</span>
          </a>

          <h1 id="login-title" class="auth-title">Đăng nhập</h1>
          <p class="auth-sub">Chào mừng bạn quay lại. Tiếp tục ôn luyện nào.</p>

          <div *ngIf="errorMessage" class="alert alert-danger mb-4" role="alert">
            <i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i>
            <div>{{ errorMessage }}</div>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" novalidate>
            <div class="mb-3">
              <label for="usernameOrEmail" class="form-label">Email hoặc tên đăng nhập</label>
              <input
                type="text"
                class="form-control"
                id="usernameOrEmail"
                formControlName="usernameOrEmail"
                autocomplete="username"
                [class.is-invalid]="isFieldInvalid('usernameOrEmail')"
                [attr.aria-invalid]="isFieldInvalid('usernameOrEmail')"
                [attr.aria-describedby]="isFieldInvalid('usernameOrEmail') ? 'usernameOrEmail-error' : null"
              />
              <div id="usernameOrEmail-error" class="invalid-feedback" *ngIf="isFieldInvalid('usernameOrEmail')">Vui lòng nhập email hoặc tên đăng nhập</div>
            </div>

            <div class="mb-4">
              <label for="password" class="form-label">Mật khẩu</label>
              <div class="pw-field">
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  class="form-control"
                  id="password"
                  formControlName="password"
                  autocomplete="current-password"
                  [class.is-invalid]="isFieldInvalid('password')"
                  [attr.aria-invalid]="isFieldInvalid('password')"
                  [attr.aria-describedby]="isFieldInvalid('password') ? 'password-error' : null"
                />
                <button type="button" class="btn btn-icon pw-toggle"
                        (click)="showPassword = !showPassword"
                        [attr.aria-pressed]="showPassword"
                        [attr.aria-label]="showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                        aria-controls="password">
                  <i class="bi" [ngClass]="showPassword ? 'bi-eye-slash' : 'bi-eye'" aria-hidden="true"></i>
                </button>
              </div>
              <div id="password-error" class="invalid-feedback d-block" *ngIf="isFieldInvalid('password')">Mật khẩu cần tối thiểu 6 ký tự</div>
            </div>

            <button type="submit" class="btn btn-primary btn-lg w-100" [disabled]="isLoading || loginForm.invalid">
              <span *ngIf="!isLoading">Đăng nhập</span>
              <span *ngIf="isLoading"><span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Đang xử lý…</span>
            </button>
          </form>

          <p class="auth-switch">
            Chưa có tài khoản?
            <a routerLink="/auth/register" queryParamsHandling="preserve">Đăng ký</a>
          </p>
        </section>

        <aside class="auth-brand" aria-hidden="true">
          <div class="art">
            <span class="shape blob"></span>
            <span class="shape ring"></span>
            <span class="shape square"></span>
            <span class="shape dot"></span>
            <span class="glyph"><i class="bi bi-patch-question"></i></span>
          </div>
          <h2 class="brand-heading">Học mỗi ngày, nhớ lâu hơn</h2>
          <ul class="benefits">
            <li><span class="icon-tile"><i class="bi bi-lightning-charge"></i></span>Làm quiz nhanh, xem kết quả ngay</li>
            <li><span class="icon-tile"><i class="bi bi-graph-up-arrow"></i></span>Theo dõi tiến bộ qua từng lượt</li>
            <li><span class="icon-tile"><i class="bi bi-collection"></i></span>Tự tạo ngân hàng câu hỏi riêng</li>
          </ul>
        </aside>
      </div>
    </div>
  `,
  styles: [AUTH_STYLES]
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  isLoading = false;
  showPassword = false;
  errorMessage: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initForm();

    if (this.authService.isLoggedIn()) {
      this.router.navigateByUrl(safeReturnUrl(this.route));
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
          this.router.navigateByUrl(safeReturnUrl(this.route));
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = extractError(err, 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
