import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { User } from './core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  template: `
    <nav class="app-navbar navbar navbar-expand-lg">
      <div class="container-fluid px-4">
        <a class="navbar-brand" routerLink="/quiz/browse">
          <span class="brand-icon"><i class="bi bi-lightning-fill"></i></span>
          <span class="brand-text">QuizApp</span>
        </a>

        <button class="navbar-toggler-custom" type="button"
          data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span></span><span></span><span></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="nav-links mx-auto">
            <li>
              <a class="nav-item-link" routerLink="/quiz/browse" routerLinkActive="active">
                <span class="nav-icon"><i class="bi bi-house-door"></i></span> Khám phá
              </a>
            </li>
            <li *ngIf="isLoggedIn">
              <a class="nav-item-link" routerLink="/dashboard/my-quizzes" routerLinkActive="active">
                <span class="nav-icon"><i class="bi bi-card-list"></i></span> Quiz Của Tôi
              </a>
            </li>
            <li *ngIf="isLoggedIn">
              <a class="nav-item-link" routerLink="/dashboard/question-banks" routerLinkActive="active">
                <span class="nav-icon"><i class="bi bi-archive"></i></span> Ngân Hàng
              </a>
            </li>
            <li *ngIf="isAdmin">
              <a class="nav-item-link admin-link" routerLink="/admin/users" routerLinkActive="active">
                <span class="nav-icon"><i class="bi bi-people"></i></span> Users
              </a>
            </li>
            <li *ngIf="isAdmin">
              <a class="nav-item-link admin-link" routerLink="/admin/quizzes" routerLinkActive="active">
                <span class="nav-icon"><i class="bi bi-shield-check"></i></span> Kiểm Duyệt
              </a>
            </li>
          </ul>

          <div class="nav-actions">
            <div *ngIf="!isLoggedIn" class="d-flex gap-2">
              <a class="btn-nav-outline" routerLink="/auth/login">Đăng Nhập</a>
              <a class="btn-nav-primary" routerLink="/auth/register">Đăng Ký</a>
            </div>

            <div *ngIf="isLoggedIn" class="dropdown">
              <button class="btn-user dropdown-toggle" type="button" data-bs-toggle="dropdown">
                <span class="user-avatar">{{ currentUser?.username?.[0]?.toUpperCase() }}</span>
                <span class="user-name">{{ currentUser?.username }}</span>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li class="dropdown-header-info">
                  <small class="text-muted d-block">Đăng nhập với</small>
                  <strong>{{ currentUser?.username }}</strong>
                </li>
                <li><hr class="dropdown-divider" /></li>
                <li>
                  <a class="dropdown-item" routerLink="/dashboard/my-quizzes">
                    <i class="bi bi-card-list"></i> Dashboard
                  </a>
                </li>
                <li *ngIf="isAdmin">
                  <a class="dropdown-item" routerLink="/admin/users">
                    <i class="bi bi-shield-check"></i> Quản trị
                  </a>
                </li>
                <li><hr class="dropdown-divider" /></li>
                <li>
                  <a class="dropdown-item text-danger" style="cursor:pointer" (click)="logout()">
                    🚪 Đăng Xuất
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <main class="app-main">
      <router-outlet></router-outlet>
    </main>

    <footer class="app-footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-brand">
            <span class="brand-icon"><i class="bi bi-lightning-fill"></i></span>
            <span class="brand-text">QuizApp</span>
          </div>
          <p class="footer-text">© 2024 QuizApp — Nền tảng học tập thông minh</p>
          <div class="footer-links">
            <a routerLink="/quiz/browse">Khám phá Quiz</a>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      .app-navbar {
        position: sticky;
        top: 0;
        z-index: 1030;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(102, 126, 234, 0.12);
        box-shadow: 0 2px 20px rgba(102, 126, 234, 0.08);
        padding: 0.75rem 0;
        display: flex;
        align-items: center;
      }

      .app-navbar .container-fluid {
        display: flex;
        align-items: center;
        width: 100%;
      }

      .navbar-brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        text-decoration: none;
        flex-shrink: 0;
      }

      .brand-icon {
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
      }

      .brand-text {
        font-size: 1.3rem;
        font-weight: 800;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.03em;
      }

      .nav-links {
        display: flex;
        align-items: center;
        list-style: none;
        margin: 0;
        padding: 0;
        gap: 0.25rem;
      }

      .nav-item-link {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 0.85rem;
        border-radius: 8px;
        text-decoration: none;
        color: #6b7280;
        font-weight: 500;
        font-size: 0.9rem;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .nav-item-link:hover {
        background: rgba(102, 126, 234, 0.08);
        color: #667eea;
      }

      .nav-item-link.active {
        background: rgba(102, 126, 234, 0.1);
        color: #667eea;
        font-weight: 700;
      }

      .nav-icon { font-size: 0.9rem; }

      .admin-link { color: #f59e0b; }
      .admin-link:hover, .admin-link.active {
        background: rgba(245, 158, 11, 0.1);
        color: #d97706;
      }

      .nav-actions {
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }

      .btn-nav-outline {
        padding: 0.45rem 1rem;
        border: 1.5px solid #667eea;
        color: #667eea;
        background: transparent;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.875rem;
        text-decoration: none;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .btn-nav-outline:hover {
        background: rgba(102, 126, 234, 0.08);
        color: #667eea;
      }

      .btn-nav-primary {
        padding: 0.45rem 1.1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.875rem;
        text-decoration: none;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.35);
        white-space: nowrap;
      }

      .btn-nav-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.45);
        color: white;
      }

      .btn-user {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.85rem;
        background: rgba(102, 126, 234, 0.08);
        border: 1.5px solid rgba(102, 126, 234, 0.2);
        border-radius: 50px;
        color: #667eea;
        font-weight: 600;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-user:hover {
        background: rgba(102, 126, 234, 0.15);
        border-color: #667eea;
      }

      .user-avatar {
        width: 26px;
        height: 26px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 700;
      }

      .user-name {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dropdown-header-info {
        padding: 0.5rem 0.85rem;
      }

      .navbar-toggler-custom {
        display: none;
        flex-direction: column;
        gap: 5px;
        padding: 6px 8px;
        background: transparent;
        border: none;
        cursor: pointer;
        margin-left: auto;
      }

      .navbar-toggler-custom span {
        display: block;
        width: 22px;
        height: 2px;
        background: #667eea;
        border-radius: 2px;
        transition: all 0.2s;
      }

      .app-main {
        flex: 1;
        min-height: 0;
      }

      .app-footer {
        background: #1a1a2e;
        color: rgba(255,255,255,0.7);
        padding: 2rem 0;
        margin-top: auto;
      }

      .footer-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .footer-brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .footer-brand .brand-icon {
        width: 28px;
        height: 28px;
        font-size: 0.9rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 7px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .footer-brand .brand-text {
        font-weight: 700;
        font-size: 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .footer-text {
        margin: 0;
        font-size: 0.85rem;
        color: rgba(255,255,255,0.5);
      }

      .footer-links a {
        color: rgba(255,255,255,0.5);
        text-decoration: none;
        font-size: 0.85rem;
        transition: color 0.2s;
      }

      .footer-links a:hover { color: #667eea; }

      @media (max-width: 991.98px) {
        .navbar-toggler-custom { display: flex; }

        .navbar-collapse {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(102, 126, 234, 0.12);
          padding: 1rem 1.5rem;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }

        .nav-links {
          flex-direction: column;
          align-items: stretch;
          gap: 0.25rem;
          margin-bottom: 1rem;
        }

        .nav-item-link { width: 100%; }

        .nav-actions {
          border-top: 1px solid rgba(102, 126, 234, 0.1);
          padding-top: 0.75rem;
        }
      }
    `
  ]
})
export class AppComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isLoggedIn = false;
  isAdmin = false;
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this.isLoggedIn = !!user;
        this.isAdmin = user?.role === 'Administrator';
      });
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
