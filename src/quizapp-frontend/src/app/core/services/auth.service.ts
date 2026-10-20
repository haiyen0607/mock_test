import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '../models';
import { ApiClient } from './api-client';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  /** In-flight GET /auth/me (restoring the user after F5). */
  private loadingUser: Promise<User | null> | null = null;

  constructor(private api: ApiClient) {
    // 401 from any request → token already cleared by ApiClient; drop the cached user.
    this.api.onUnauthorized = () => this.currentUserSubject.next(null);
    this.loadCurrentUser();
  }

  // UC01 – Đăng ký. Backend trả AuthResponseDto { token, user } (201)
  register(username: string, email: string, password: string): Observable<AuthResponse> {
    const request: RegisterRequest = { username, email, password };
    return this.api.request((http) => http.post<AuthResponse>('/auth/register', request, { skipAuthRedirect: true }));
  }

  // UC02 – Đăng nhập bằng username HOẶC email
  login(usernameOrEmail: string, password: string): Observable<AuthResponse> {
    const request: LoginRequest = { usernameOrEmail, password };
    return this.api
      .request((http) => http.post<AuthResponse>('/auth/login', request, { skipAuthRedirect: true }))
      .pipe(tap((res) => this.setSession(res)));
  }

  /** Store token + user from an AuthResponse (login, or register when it returns a token). */
  setSession(res: AuthResponse): void {
    this.setToken(res.token);
    this.currentUserSubject.next(res.user);
  }

  // UC03 – Đăng xuất (JWT không lưu trạng thái server, chỉ cần xóa token phía client)
  logout(): void {
    localStorage.removeItem(environment.jwtKey);
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      // Decode JWT payload to check expiry to prevent browser 401 console logs
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const payload = JSON.parse(jsonPayload);
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        this.logout();
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  isAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'Administrator';
  }

  // Khôi phục thông tin user khi F5 trang (GET /auth/me)
  loadCurrentUser(): void {
    void this.fetchCurrentUser();
  }

  /** Cached user, or waits for the in-flight /auth/me. Null when not logged in. */
  ensureCurrentUser(): Promise<User | null> {
    if (!this.isLoggedIn()) return Promise.resolve(null);
    const cached = this.currentUserSubject.value;
    if (cached) return Promise.resolve(cached);
    return this.loadingUser ?? this.fetchCurrentUser();
  }

  private fetchCurrentUser(): Promise<User | null> {
    if (!this.isLoggedIn()) {
      return Promise.resolve(null);
    }
    if (this.loadingUser) return this.loadingUser;

    this.loadingUser = this.api.http
      .get<User>('/auth/me', { skipAuthRedirect: true })
      .then((res) => {
        this.currentUserSubject.next(res.data);
        return res.data;
      })
      .catch(() => {
        this.logout(); // token hết hạn / không hợp lệ
        return null;
      })
      .finally(() => {
        this.loadingUser = null;
      });
    return this.loadingUser;
  }

  getToken(): string | null {
    return localStorage.getItem(environment.jwtKey);
  }

  setToken(token: string): void {
    localStorage.setItem(environment.jwtKey, token);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
}
