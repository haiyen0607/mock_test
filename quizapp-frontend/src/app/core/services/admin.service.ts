// UC18 – Manage Users, UC19 – Manage System Quizzes, UC20 – Moderate Content
// Khớp AdminController: /api/admin (backend yêu cầu role Administrator)

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  User,
  UserStatus,
  QuizListItem,
  BankQuestion,
  AdminQuestion,
  ModerationStatus,
  ListQuery,
  PagedResult
} from '../models';
import { ApiClient, toListParams } from './api-client';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private api: ApiClient) {}

  // UC18 – GET /admin/users?search=&page=&pageSize=&sort=newest|oldest|username
  getUsers(q?: ListQuery): Observable<PagedResult<User>> {
    return this.api.request((http) =>
      http.get<PagedResult<User>>('/admin/users', { params: toListParams(q) })
    );
  }

  // UC18 – PUT /admin/users/{userId}/status  body: { status: "Active" | "Blocked" }
  setUserStatus(userId: number, status: UserStatus): Observable<User> {
    return this.api.request((http) => http.put<User>(`/admin/users/${userId}/status`, { status }));
  }

  // UC19 – GET /admin/quizzes?search=&page=&pageSize=&sort= (Active + Removed, không gồm quiz đã xóa)
  /** status: lọc theo trạng thái kiểm duyệt (bỏ trống = Active + Removed). */
  getAllQuizzes(q?: ListQuery & { status?: ModerationStatus }): Observable<PagedResult<QuizListItem>> {
    return this.api.request((http) =>
      http.get<PagedResult<QuizListItem>>('/admin/quizzes', { params: toListParams(q) })
    );
  }

  // UC19/UC20 – PUT /admin/quizzes/{quizId}/status  body: { status: "Active" | "Removed" }
  setQuizStatus(quizId: number, status: ModerationStatus): Observable<QuizListItem> {
    return this.api.request((http) => http.put<QuizListItem>(`/admin/quizzes/${quizId}/status`, { status }));
  }

  // UC20 – GET /admin/questions?search=&status= (không phân trang, tối đa 200)
  getQuestions(q?: { search?: string; status?: string }): Observable<AdminQuestion[]> {
    return this.api.request((http) =>
      http.get<AdminQuestion[]>('/admin/questions', { params: toListParams(q) })
    );
  }

  // UC20 – PUT /admin/questions/{questionId}/status  body: { status: "Active" | "Removed" } → QuestionDto
  setQuestionStatus(questionId: number, status: ModerationStatus): Observable<BankQuestion> {
    return this.api.request((http) => http.put<BankQuestion>(`/admin/questions/${questionId}/status`, { status }));
  }
}
