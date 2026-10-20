import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ThemeService, ThemePreference } from './core/services/theme.service';
import { DialogHostComponent } from './shared/dialog-host.component';
import { User } from './core/models';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, DialogHostComponent],

  template: `
    <a class="skip-link" href="#main-content">Bỏ qua tới nội dung</a>
    <app-dialog-host></app-dialog-host>

    <div class="app-wrapper">
      <!-- Sidebar (desktop) -->
      <aside class="app-sidebar d-none d-lg-flex flex-column" aria-label="Điều hướng chính">
        <div class="sidebar-brand">
          <ng-container *ngTemplateOutlet="brand"></ng-container>
        </div>
        <nav class="sidebar-nav flex-grow-1">
          <ng-container *ngTemplateOutlet="navLinks; context: { mobile: false }"></ng-container>
        </nav>
        <div class="sidebar-footer">
          <ng-container *ngTemplateOutlet="footer; context: { mobile: false }"></ng-container>
        </div>
      </aside>

      <!-- Content -->
      <div class="app-content-wrapper flex-grow-1">
        <header class="app-mobile-header d-lg-none">
          <ng-container *ngTemplateOutlet="brand"></ng-container>
          <button class="btn btn-light btn-icon" type="button" data-bs-toggle="offcanvas"
                  data-bs-target="#mobileSidebar" aria-controls="mobileSidebar" aria-label="Mở menu">
            <i class="bi bi-list fs-5"></i>
          </button>
        </header>

        <main id="main-content" class="app-main" tabindex="-1">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <!-- Mobile offcanvas -->
    <div class="offcanvas offcanvas-start" tabindex="-1" id="mobileSidebar" aria-label="Menu">
      <div class="offcanvas-header">
        <ng-container *ngTemplateOutlet="brand"></ng-container>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Đóng menu"></button>
      </div>
      <div class="offcanvas-body d-flex flex-column p-0">
        <nav class="sidebar-nav flex-grow-1">
          <ng-container *ngTemplateOutlet="navLinks; context: { mobile: true }"></ng-container>
        </nav>
        <div class="sidebar-footer">
          <ng-container *ngTemplateOutlet="footer; context: { mobile: true }"></ng-container>
        </div>
      </div>
    </div>

    <!-- ── Shared templates ── -->
    <ng-template #brand>
      <a routerLink="/quiz/browse" class="brand" aria-label="QuizApp — trang chủ">
        <span class="brand-mark" aria-hidden="true">Q</span>
        <span class="brand-name">QuizApp</span>
      </a>
    </ng-template>

    <ng-template #navLinks let-mobile="mobile">
      <ul class="nav-list">
        <ng-container *ngFor="let item of mainNav">
          <li *ngIf="!item.auth || isLoggedIn">
            <a class="nav-item-link" [routerLink]="item.link" routerLinkActive="active"
               [attr.data-bs-dismiss]="mobile ? 'offcanvas' : null">
              <i class="bi" [ngClass]="item.icon"></i><span>{{ item.label }}</span>
            </a>
          </li>
        </ng-container>
      </ul>

      <ng-container *ngIf="isAdmin">
        <p class="nav-group-label">Quản trị</p>
        <ul class="nav-list">
          <li *ngFor="let item of adminNav">
            <a class="nav-item-link" [routerLink]="item.link" routerLinkActive="active"
               [attr.data-bs-dismiss]="mobile ? 'offcanvas' : null">
              <i class="bi" [ngClass]="item.icon"></i><span>{{ item.label }}</span>
            </a>
          </li>
        </ul>
      </ng-container>
    </ng-template>

    <ng-template #footer let-mobile="mobile">
      <div class="theme-switch" role="radiogroup" aria-label="Giao diện">
        <button *ngFor="let opt of themeOptions" type="button" role="radio"
                [attr.aria-checked]="theme.preference() === opt.value"
                [class.active]="theme.preference() === opt.value"
                (click)="setTheme(opt.value)" [title]="opt.label">
          <i class="bi" [ngClass]="opt.icon"></i><span>{{ opt.label }}</span>
        </button>
      </div>

      <div *ngIf="!isLoggedIn" class="d-grid gap-2">
        <a class="btn btn-primary" routerLink="/auth/register" [attr.data-bs-dismiss]="mobile ? 'offcanvas' : null">Tạo tài khoản</a>
        <a class="btn btn-light" routerLink="/auth/login" [attr.data-bs-dismiss]="mobile ? 'offcanvas' : null">Đăng nhập</a>
      </div>

      <div *ngIf="isLoggedIn" class="user-card">
        <span class="user-avatar" aria-hidden="true">{{ currentUser?.username?.[0]?.toUpperCase() }}</span>
        <div class="user-meta">
          <span class="user-name text-truncate">{{ currentUser?.username }}</span>
          <span class="user-role">{{ isAdmin ? 'Quản trị viên' : 'Thành viên' }}</span>
        </div>
        <button type="button" class="btn btn-light btn-icon" (click)="logout()" title="Đăng xuất"
                aria-label="Đăng xuất" [attr.data-bs-dismiss]="mobile ? 'offcanvas' : null">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; height: 100dvh; overflow: hidden; }
    .app-wrapper { display: flex; height: 100dvh; width: 100%; background: var(--bg); }

    /* Sidebar */
    .app-sidebar {
      width: 264px; flex-shrink: 0; z-index: var(--z-sidebar);
      background: var(--surface);
      border-right: 1px solid var(--border);
    }
    .sidebar-brand { padding: 1.25rem 1.25rem 0.75rem; }
    .sidebar-nav { padding: 0.5rem 0.85rem; overflow-y: auto; }
    .sidebar-footer { padding: 0.85rem; border-top: 1px solid var(--border); display: grid; gap: 0.75rem; }

    .brand { display: inline-flex; align-items: center; gap: 0.6rem; text-decoration: none; color: var(--text); }
    .brand-mark {
      width: 36px; height: 36px; border-radius: 12px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--brand-500); color: var(--brand-contrast);
      font-family: var(--font-display); font-weight: 800; font-size: 1.15rem;
      transform: rotate(-6deg);
      box-shadow: 0 3px 0 rgba(var(--brand-rgb), 0.25);
    }
    .brand-name { font-family: var(--font-display); font-weight: 800; font-size: 1.2rem; letter-spacing: -0.02em; }

    .nav-list { list-style: none; margin: 0 0 0.75rem; padding: 0; display: grid; gap: 2px; }
    .nav-group-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin: 0.75rem 0 0.35rem; padding: 0 0.75rem; }
    .nav-item-link {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.6rem 0.75rem; border-radius: 12px;
      color: var(--text-2); font-weight: 600; font-size: 0.92rem; text-decoration: none;
      transition: background-color var(--transition), color var(--transition);
    }
    .nav-item-link i { font-size: 1.1rem; width: 1.25rem; text-align: center; }
    .nav-item-link:hover { background: var(--surface-2); color: var(--text); }
    .nav-item-link.active { background: var(--brand-soft); color: var(--brand-soft-text); }
    .nav-item-link.active i { color: var(--brand-500); }

    /* Theme segmented control */
    .theme-switch { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 3px; background: var(--surface-2); border-radius: var(--radius-pill); }
    .theme-switch button {
      border: 0; background: transparent; color: var(--text-2);
      border-radius: var(--radius-pill); padding: 0.35rem 0.25rem;
      font-size: 0.75rem; font-weight: 600;
      display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem;
      transition: background-color var(--transition), color var(--transition);
    }
    .theme-switch button:hover { color: var(--text); }
    .theme-switch button.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }

    .user-card { display: flex; align-items: center; gap: 0.65rem; padding: 0.4rem 0.25rem 0.1rem 0.4rem; }
    .user-avatar {
      width: 36px; height: 36px; border-radius: 12px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--brand-soft); color: var(--brand-soft-text); font-weight: 800; font-family: var(--font-display);
    }
    .user-meta { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.25; }
    .user-name { font-weight: 600; color: var(--text); font-size: 0.9rem; }
    .user-role { font-size: 0.75rem; color: var(--text-muted); }

    /* Content */
    .app-content-wrapper { min-width: 0; height: 100dvh; overflow-y: auto; display: flex; flex-direction: column; }
    .app-mobile-header {
      position: sticky; top: 0; z-index: 1010;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.7rem 1rem;
      background: color-mix(in srgb, var(--surface) 88%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
    }
    .app-main { flex-grow: 1; padding: 1.25rem 1rem 3rem; outline: none; }
    @media (min-width: 768px) { .app-main { padding: 2rem 2rem 4rem; } }
    @media (min-width: 1200px) { .app-main { padding: 2.25rem 3rem 4rem; } }

    .offcanvas-header { border-bottom: 1px solid var(--border); }
    .offcanvas { width: 280px; }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isLoggedIn = false;
  isAdmin = false;
  private destroy$ = new Subject<void>();

  readonly mainNav = [
    { link: '/quiz/browse', icon: 'bi-compass', label: 'Khám phá', auth: false },
    { link: '/dashboard/my-quizzes', icon: 'bi-collection', label: 'Quiz của tôi', auth: true },
    { link: '/dashboard/history', icon: 'bi-clock-history', label: 'Bài đã làm', auth: true },
    { link: '/dashboard/question-banks', icon: 'bi-archive', label: 'Ngân hàng câu hỏi', auth: true }
  ];

  readonly adminNav = [
    { link: '/admin/users', icon: 'bi-people', label: 'Người dùng' },
    { link: '/admin/quizzes', icon: 'bi-shield-check', label: 'Kiểm duyệt quiz' }
  ];

  readonly themeOptions: { value: ThemePreference; label: string; icon: string }[] = [
    { value: 'light', label: 'Sáng', icon: 'bi-sun' },
    { value: 'dark', label: 'Tối', icon: 'bi-moon-stars' },
    { value: 'system', label: 'Tự động', icon: 'bi-circle-half' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    public theme: ThemeService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this.isLoggedIn = !!user;
        this.isAdmin = user?.role === 'Administrator';
      });

    // Route change: scroll the content container to top and move focus to <main>
    // (skipped on the first load and on query-param-only changes).
    let lastPath: string | null = null;
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((e) => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        const isFirst = lastPath === null;
        const changed = path !== lastPath;
        lastPath = path;
        if (isFirst || !changed) return;

        document.querySelector('.app-content-wrapper')?.scrollTo({ top: 0 });
        document.getElementById('main-content')?.focus({ preventScroll: true });
      });
  }

  setTheme(pref: ThemePreference): void {
    this.theme.setPreference(pref);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
