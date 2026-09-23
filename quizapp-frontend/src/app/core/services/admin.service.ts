// UC18 – Manage Users, UC19 – Manage System Quizzes, UC20 – Moderate Content
// Khớp AdminController: /api/admin (backend yêu cầu role Administrator)

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import axios, { AxiosInstance } from 'axios';
import { environment } from '../../../environments/environment';
import { User, QuizListItem } from '../models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
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
      return config;
    });
  }

  private wrap<T>(promise: Promise<{ data: T }>): Observable<T> {
    return new Observable((observer) => {
      promise
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC18 – GET /admin/users
  getUsers(): Observable<User[]> {
    return this.wrap(this.axiosInstance.get<User[]>('/admin/users'));
  }

  // UC18 – PUT /admin/users/{userId}/status  body: { status: "Active" | "Blocked" }
  setUserStatus(userId: number, status: 'Active' | 'Blocked'): Observable<User> {
    return this.wrap(this.axiosInstance.put<User>(`/admin/users/${userId}/status`, { status }));
  }

  // UC19 – GET /admin/quizzes (mọi quiz, mọi trạng thái)
  getAllQuizzes(): Observable<QuizListItem[]> {
    return this.wrap(this.axiosInstance.get<QuizListItem[]>('/admin/quizzes'));
  }

  // UC19/UC20 – PUT /admin/quizzes/{quizId}/status  body: { status: "Active" | "Removed" }
  setQuizStatus(quizId: number, status: 'Active' | 'Removed'): Observable<QuizListItem> {
    return this.wrap(this.axiosInstance.put<QuizListItem>(`/admin/quizzes/${quizId}/status`, { status }));
  }

  // UC20 – PUT /admin/questions/{questionId}/status  body: { status: "Active" | "Removed" }
  setQuestionStatus(questionId: number, status: 'Active' | 'Removed'): Observable<void> {
    return this.wrap(this.axiosInstance.put<void>(`/admin/questions/${questionId}/status`, { status }));
  }
}
