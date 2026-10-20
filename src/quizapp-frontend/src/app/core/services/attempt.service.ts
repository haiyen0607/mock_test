import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AxiosRequestConfig } from 'axios';
import {
  AttemptContent,
  AttemptAnswerRequest,
  SubmitAttemptResult,
  AttemptResult,
  AttemptHistoryItem,
  ListQuery,
  PagedResult
} from '../models';
import { AuthService } from './auth.service';
import { ApiClient, toListParams } from './api-client';

@Injectable({
  providedIn: 'root'
})
export class AttemptService {
  constructor(
    private api: ApiClient,
    private authService: AuthService
  ) {}

  // UC07 – POST /api/quizzes/{quizId}/trial → trả về luôn nội dung bài làm (AttemptContent)
  startTrial(quizId: number): Observable<AttemptContent> {
    return this.api.request((http) =>
      http.post<AttemptContent>(`/quizzes/${quizId}/trial`, undefined, this.guestConfig())
    );
  }

  // UC08 – POST /api/quizzes/{quizId}/attempts (yêu cầu đăng nhập)
  startAttempt(quizId: number): Observable<AttemptContent> {
    return this.api.request((http) =>
      http.post<AttemptContent>(`/quizzes/${quizId}/attempts`, undefined, this.guestConfig())
    );
  }

  // Lấy lại nội dung attempt đang làm – GET /api/attempts/{id}/content
  getContent(attemptId: number): Observable<AttemptContent> {
    return this.api.request((http) => http.get<AttemptContent>(`/attempts/${attemptId}/content`, this.guestConfig()));
  }

  // UC09 – POST /api/attempts/{attemptId}/submit  body: { answers: [...] }
  submitAttempt(attemptId: number, answers: AttemptAnswerRequest[]): Observable<SubmitAttemptResult> {
    return this.api.request((http) =>
      http.post<SubmitAttemptResult>(`/attempts/${attemptId}/submit`, { answers }, this.guestConfig())
    );
  }

  // UC10 – GET /api/attempts/{attemptId}/result
  getResult(attemptId: number): Observable<AttemptResult> {
    return this.api.request((http) => http.get<AttemptResult>(`/attempts/${attemptId}/result`, this.guestConfig()));
  }

  // "Bài đã làm" – GET /api/attempts/mine?page=&pageSize=&sort=newest|oldest|title (chỉ bài đã nộp, không gồm trial)
  getMyAttempts(q?: ListQuery): Observable<PagedResult<AttemptHistoryItem>> {
    return this.api.request((http) =>
      http.get<PagedResult<AttemptHistoryItem>>('/attempts/mine', { params: toListParams(q) })
    );
  }

  // Guest được backend định danh qua header X-Guest-Id (UC07) – tính lại cho từng request
  private guestConfig(): AxiosRequestConfig {
    const guestId = this.getOrCreateGuestId();
    return guestId ? { headers: { 'X-Guest-Id': guestId } } : {};
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
