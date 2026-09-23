import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import axios, { AxiosInstance } from 'axios';
import { environment } from '../../../environments/environment';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private axiosInstance: AxiosInstance;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: environment.apiUrl,
      timeout: 10000
    });

    // Thêm token vào mỗi request
    this.axiosInstance.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.loadCurrentUser();
  }

  // UC01 – Đăng ký. Backend trả AuthResponseDto { token, user } (201)
  register(username: string, email: string, password: string): Observable<AuthResponse> {
    const request: RegisterRequest = { username, email, password };
    return new Observable((observer) => {
      this.axiosInstance
        .post<AuthResponse>('/auth/register', request)
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC02 – Đăng nhập bằng username HOẶC email
  login(usernameOrEmail: string, password: string): Observable<AuthResponse> {
    const request: LoginRequest = { usernameOrEmail, password };
    return new Observable((observer) => {
      this.axiosInstance
        .post<AuthResponse>('/auth/login', request)
        .then((res) => {
          const { token, user } = res.data;
          this.setToken(token);
          this.currentUserSubject.next(user);
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC03 – Đăng xuất (JWT không lưu trạng thái server, chỉ cần xóa token phía client)
  logout(): void {
    localStorage.removeItem(environment.jwtKey);
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'Administrator';
  }

  // Khôi phục thông tin user khi F5 trang (GET /auth/me)
  loadCurrentUser(): void {
    if (!this.isLoggedIn()) {
      return;
    }

    this.axiosInstance
      .get<User>('/auth/me')
      .then((res) => {
        this.currentUserSubject.next(res.data);
      })
      .catch(() => {
        this.logout(); // token hết hạn / không hợp lệ
      });
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
