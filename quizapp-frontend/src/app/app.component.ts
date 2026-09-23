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
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
      <div class="container-fluid">
        <a class="navbar-brand fw-bold" routerLink="/quiz/browse">
          📚 QuizApp
        </a>

        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav mx-auto">
            <li class="nav-item">
              <a class="nav-link" routerLink="/quiz/browse" routerLinkActive="active">
                Danh Sách Quiz
              </a>
            </li>
            <li class="nav-item" *ngIf="isLoggedIn">
              <a class="nav-link" routerLink="/dashboard/my-quizzes" routerLinkActive="active">
                Quiz Của Tôi
              </a>
            </li>
            <li class="nav-item" *ngIf="isLoggedIn">
              <a class="nav-link" routerLink="/dashboard/question-banks" routerLinkActive="active">
                Ngân Hàng Câu Hỏi
              </a>
            </li>
            <li class="nav-item" *ngIf="isAdmin">
              <a class="nav-link" routerLink="/admin/users" routerLinkActive="active">
                Quản Lý User
              </a>
            </li>
            <li class="nav-item" *ngIf="isAdmin">
              <a class="nav-link" routerLink="/admin/quizzes" routerLinkActive="active">
                Kiểm Duyệt
              </a>
            </li>
          </ul>

          <div class="d-flex gap-2">
            <div *ngIf="!isLoggedIn">
              <a class="btn btn-outline-light btn-sm me-2" routerLink="/auth/login">
                Đăng Nhập
              </a>
              <a class="btn btn-light btn-sm" routerLink="/auth/register">
                Đăng Ký
              </a>
            </div>

            <div *ngIf="isLoggedIn" class="dropdown">
              <button
                class="btn btn-outline-light btn-sm dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
              >
                👤 {{ currentUser?.username }}
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <a class="dropdown-item" routerLink="/dashboard/my-quizzes">
                    Dashboard
                  </a>
                </li>
                <li><hr class="dropdown-divider" /></li>
                <li>
                  <a class="dropdown-item text-danger" (click)="logout()">
                    Đăng Xuất
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <main class="flex-grow-1">
      <router-outlet></router-outlet>
    </main>

    <footer class="bg-dark text-light py-4 mt-5">
      <div class="container text-center">
        <p class="mb-0">© 2024 QuizApp. All rights reserved.</p>
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

      main {
        flex: 1;
      }

      .navbar-brand {
        font-size: 1.5rem;
      }

      .nav-link.active {
        color: #ffc107 !important;
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
