import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import axios, { AxiosInstance } from 'axios';
import { environment } from '../../../environments/environment';
import {
  AttemptContent,
  AttemptAnswerRequest,
  SubmitAttemptResult,
  AttemptResult
} from '../models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AttemptService {
  private axiosInstance: AxiosInstance;

  constructor(private authService: AuthService) {
    this.axiosInstance = axios.create({
      baseURL: environment.apiUrl,
      timeout: 10000
    });

    this.axiosInstance.interceptors.request.use((config) => {
      const token = this.authService.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Guest được backend định danh qua header X-Guest-Id (UC07)
      const guestId = this.getOrCreateGuestId();
      if (guestId) {
        config.headers['X-Guest-Id'] = guestId;
      }

      return config;
    });
  }

  // UC07 – POST /api/quizzes/{quizId}/trial → trả về luôn nội dung bài làm (AttemptContent)
  startTrial(quizId: number): Observable<AttemptContent> {
    return new Observable((observer) => {
      this.axiosInstance
        .post<AttemptContent>(`/quizzes/${quizId}/trial`)
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC08 – POST /api/quizzes/{quizId}/attempts (yêu cầu đăng nhập)
  startAttempt(quizId: number): Observable<AttemptContent> {
    return new Observable((observer) => {
      this.axiosInstance
        .post<AttemptContent>(`/quizzes/${quizId}/attempts`)
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // Lấy lại nội dung attempt đang làm – GET /api/attempts/{id}/content
  getContent(attemptId: number): Observable<AttemptContent> {
    return new Observable((observer) => {
      this.axiosInstance
        .get<AttemptContent>(`/attempts/${attemptId}/content`)
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC09 – POST /api/attempts/{attemptId}/submit  body: { answers: [...] }
  submitAttempt(attemptId: number, answers: AttemptAnswerRequest[]): Observable<SubmitAttemptResult> {
    return new Observable((observer) => {
      this.axiosInstance
        .post<SubmitAttemptResult>(`/attempts/${attemptId}/submit`, { answers })
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC10 – GET /api/attempts/{attemptId}/result
  getResult(attemptId: number): Observable<AttemptResult> {
    return new Observable((observer) => {
      this.axiosInstance
        .get<AttemptResult>(`/attempts/${attemptId}/result`)
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // Guest ID lưu localStorage để backend đếm được giới hạn 3 lượt trial (UC07 A1)
  private getOrCreateGuestId(): string | null {
    if (this.authService.isLoggedIn()) {
      return null;
    }

    let guestId = localStorage.getItem('guest_id');
    if (!guestId) {
      guestId = 'guest-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('guest_id', guestId);
    }
    return guestId;
  }
}
