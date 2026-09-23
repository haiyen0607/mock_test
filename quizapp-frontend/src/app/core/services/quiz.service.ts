import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import axios, { AxiosInstance } from 'axios';
import { environment } from '../../../environments/environment';
import { QuizListItem, QuizDetail, QuizRequest, AddQuizQuestionRequest, QuestionSummary } from '../models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class QuizService {
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

  // UC04/UC05 – GET /api/quizzes?search=... (1 endpoint cho cả browse và search)
  getPublicQuizzes(search?: string): Observable<QuizListItem[]> {
    return new Observable((observer) => {
      this.axiosInstance
        .get<QuizListItem[]>('/quizzes', {
          params: search?.trim() ? { search: search.trim() } : {}
        })
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC06 – GET /api/quizzes/{id}
  getQuizDetail(quizId: number): Observable<QuizDetail> {
    return new Observable((observer) => {
      this.axiosInstance
        .get<QuizDetail>(`/quizzes/${quizId}`)
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC12 – GET /api/quizzes/mine
  getMyQuizzes(): Observable<QuizListItem[]> {
    return new Observable((observer) => {
      this.axiosInstance
        .get<QuizListItem[]>('/quizzes/mine')
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC11 – POST /api/quizzes  body: { title, description, duration }
  createQuiz(request: QuizRequest): Observable<QuizDetail> {
    return new Observable((observer) => {
      this.axiosInstance
        .post<QuizDetail>('/quizzes', request)
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC12 – PUT /api/quizzes/{id}
  updateQuiz(quizId: number, request: QuizRequest): Observable<QuizDetail> {
    return new Observable((observer) => {
      this.axiosInstance
        .put<QuizDetail>(`/quizzes/${quizId}`, request)
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC12 – DELETE /api/quizzes/{id}
  deleteQuiz(quizId: number): Observable<void> {
    return new Observable((observer) => {
      this.axiosInstance
        .delete(`/quizzes/${quizId}`)
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC14 – PUT /api/quizzes/{id}/publish  body: { publish: true|false }
  setPublish(quizId: number, publish: boolean): Observable<QuizDetail> {
    return new Observable((observer) => {
      this.axiosInstance
        .put<QuizDetail>(`/quizzes/${quizId}/publish`, { publish })
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }
  // ===== UC13/UC17 – Quản lý câu hỏi trong Quiz =====

  // UC13/UC17 – POST /api/quizzes/{quizId}/questions
  // request: { questionId } (tái sử dụng) HOẶC { questionBankId, newQuestion } (tạo mới)
  addQuizQuestion(quizId: number, request: AddQuizQuestionRequest): Observable<QuestionSummary> {
    return new Observable((observer) => {
      this.axiosInstance
        .post<QuestionSummary>(`/quizzes/${quizId}/questions`, request)
        .then((res) => {
          observer.next(res.data);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC13 – PUT /api/quizzes/{quizId}/questions/order  body: { questionIds: [...] }
  reorderQuizQuestions(quizId: number, questionIds: number[]): Observable<void> {
    return new Observable((observer) => {
      this.axiosInstance
        .put(`/quizzes/${quizId}/questions/order`, { questionIds })
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  // UC13 – DELETE /api/quizzes/{quizId}/questions/{questionId}
  removeQuizQuestion(quizId: number, questionId: number): Observable<void> {
    return new Observable((observer) => {
      this.axiosInstance
        .delete(`/quizzes/${quizId}/questions/${questionId}`)
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }
}
