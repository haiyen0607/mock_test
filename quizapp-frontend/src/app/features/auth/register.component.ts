import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AUTH_STYLES } from './auth.styles';
import { safeReturnUrl } from './return-url';
import { extractError } from '../../core/errors';
import { DialogService } from '../../core/services/dialog.service';


@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-wrap animate-fade-up">
      <div class="auth-grid">
        <section class="auth-form surface" aria-labelledby="register-title">
          <a routerLink="/quiz/browse" class="brand-mark">
            <span class="brand-glyph" aria-hidden="true">Q</span>
            <span>QuizApp</span>
          </a>

          <h1 id="register-title" class="auth-title">Tạo tài khoản</h1>
          <p class="auth-sub">Miễn phí, chỉ mất chưa đến một phút.</p>

          <div *ngIf="errorMessage" class="alert alert-danger mb-4" role="alert">
            <i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i>
            <div>{{ errorMessage }}</div>
          </div>
          <div *ngIf="successMessage" class="alert alert-success mb-4" role="status">
            <i class="bi bi-check-circle-fill" aria-hidden="true"></i>
            <div>{{ successMessage }}</div>
          </div>

          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" novalidate>
            <div class="mb-3">
              <label for="username" class="form-label">Tên đăng nhập</label>
              <input
                type="text"
                class="form-control"
                id="username"
                formControlName="username"
                autocomplete="username"
                [class.is-invalid]="isFieldInvalid('username')"
                [attr.aria-invalid]="isFieldInvalid('username')"
                [attr.aria-describedby]="isFieldInvalid('username') ? 'username-error' : null"
              />
              <div id="username-error" class="invalid-feedback" *ngIf="isFieldInvalid('username')">Tên đăng nhập cần tối thiểu 3 ký tự</div>
            </div>

            <div class="mb-3">
              <label for="email" class="form-label">Email</label>
              <input
                type="email"
                class="form-control"
                id="email"
                formControlName="email"
                autocomplete="email"
                [class.is-invalid]="isFieldInvalid('email')"
                [attr.aria-invalid]="isFieldInvalid('email')"
                [attr.aria-describedby]="isFieldInvalid('email') ? 'email-error' : null"
              />
              <div id="email-error" class="invalid-feedback" *ngIf="isFieldInvalid('email')">Vui lòng nhập email hợp lệ</div>
            </div>

            <div class="mb-3">
              <label for="password" class="form-label">Mật khẩu</label>
              <div class="pw-field">
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  class="form-control"
                  id="password"
                  formControlName="password"
                  autocomplete="new-password"
                  [attr.aria-describedby]="isFieldInvalid('password') ? 'password-error' : 'password-help'"
                  [class.is-invalid]="isFieldInvalid('password')"
                  [attr.aria-invalid]="isFieldInvalid('password')"
                />
                <button type="button" class="btn btn-icon pw-toggle"
                        (click)="showPassword = !showPassword"
                        [attr.aria-pressed]="showPassword"
                        [attr.aria-label]="showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                        aria-controls="password confirmPassword">
                  <i class="bi" [ngClass]="showPassword ? 'bi-eye-slash' : 'bi-eye'" aria-hidden="true"></i>
                </button>
              </div>
              <div id="password-help" class="form-text" *ngIf="!isFieldInvalid('password')">Tối thiểu 6 ký tự</div>
              <div id="password-error" class="invalid-feedback d-block" *ngIf="isFieldInvalid('password')">Mật khẩu cần tối thiểu 6 ký tự</div>
            </div>

            <div class="mb-4">
              <label for="confirmPassword" class="form-label">Xác nhận mật khẩu</label>
              <input
                [type]="showPassword ? 'text' : 'password'"
                class="form-control"
                id="confirmPassword"
                formControlName="confirmPassword"
                autocomplete="new-password"
                [class.is-invalid]="confirmInvalid"
                [attr.aria-invalid]="confirmInvalid"
                [attr.aria-describedby]="confirmInvalid ? 'confirmPassword-error' : null"
              />
              <div id="confirmPassword-error" class="invalid-feedback" *ngIf="confirmInvalid">
                {{ showMismatch ? 'Mật khẩu không khớp' : 'Vui lòng nhập lại mật khẩu' }}
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-lg w-100" [disabled]="isLoading || registerForm.invalid">
              <span *ngIf="!isLoading">Tạo tài khoản</span>
              <span *ngIf="isLoading"><span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Đang xử lý…</span>
            </button>
          </form>

          <p class="auth-switch">
            Đã có tài khoản?
            <a routerLink="/auth/login" queryParamsHandling="preserve">Đăng nhập</a>
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
          <h2 class="brand-heading">Bắt đầu hành trình học của bạn</h2>
          <ul class="benefits">
            <li><span class="icon-tile"><i class="bi bi-infinity"></i></span>Làm quiz không giới hạn lượt</li>
            <li><span class="icon-tile"><i class="bi bi-pencil-square"></i></span>Tự tạo và chia sẻ quiz của riêng bạn</li>
            <li><span class="icon-tile"><i class="bi bi-clock-history"></i></span>Lưu lại lịch sử và kết quả làm bài</li>
          </ul>
        </aside>
      </div>
    </div>
  `,
  styles: [AUTH_STYLES]
})
export class RegisterComponent implements OnInit, OnDestroy {
  registerForm!: FormGroup;
  isLoading = false;
  showPassword = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: DialogService
  ) { }

  ngOnInit(): void {
    this.initForm();

    if (this.authService.isLoggedIn()) {
      this.router.navigateByUrl(safeReturnUrl(this.route));
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

  /** Mật khẩu xác nhận không khớp (chỉ hiện sau khi người dùng đã chạm vào một trong hai ô) */
  get showMismatch(): boolean {
    return !!(
      this.registerForm.errors?.['mismatch'] &&
      (this.registerForm.get('confirmPassword')?.touched || this.registerForm.get('password')?.touched)
    );
  }

  get confirmInvalid(): boolean {
    return this.showMismatch || this.isFieldInvalid('confirmPassword');
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
        next: (res) => {
          if (res?.token && res.user) {
            // Backend trả token ngay khi đăng ký → đăng nhập luôn
            this.authService.setSession(res);
            this.dialog.toast(`Chào mừng ${res.user.username}, tài khoản đã được tạo.`);
            this.router.navigateByUrl(safeReturnUrl(this.route));
          } else {
            this.dialog.toast('Đăng ký thành công. Mời bạn đăng nhập.');
            this.router.navigate(['/auth/login'], { queryParamsHandling: 'preserve' });
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = extractError(err, 'Đăng ký thất bại. Email hoặc tên đăng nhập có thể đã tồn tại.');
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
