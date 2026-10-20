import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  QuizListItem,
  QuizDetail,
  QuizRequest,
  AddQuizQuestionRequest,
  QuestionSummary,
  PagedResult,
  ListQuery,
  GradingItem,
  GradingQuery,
  GradeResult,
  QuizStats
} from '../models';
import { ApiClient, toListParams } from './api-client';

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  constructor(private api: ApiClient) {}

  // UC04/UC05 – GET /api/quizzes?search=&page=&pageSize=&sort= (1 endpoint cho cả browse và search)
  getPublicQuizzes(q?: ListQuery): Observable<PagedResult<QuizListItem>> {
    return this.api.request((http) =>
      http.get<PagedResult<QuizListItem>>('/quizzes', { params: toListParams(q) })
    );
  }

  // UC06 – GET /api/quizzes/{id}
  getQuizDetail(quizId: number): Observable<QuizDetail> {
    return this.api.request((http) => http.get<QuizDetail>(`/quizzes/${quizId}`));
  }

  // UC12 – GET /api/quizzes/mine?page=&pageSize=&sort=
  getMyQuizzes(q?: ListQuery): Observable<PagedResult<QuizListItem>> {
    return this.api.request((http) =>
      http.get<PagedResult<QuizListItem>>('/quizzes/mine', { params: toListParams(q) })
    );
  }

  // UC11 – POST /api/quizzes  body: { title, description, duration }
  createQuiz(request: QuizRequest): Observable<QuizDetail> {
    return this.api.request((http) => http.post<QuizDetail>('/quizzes', request));
  }

  // UC12 – PUT /api/quizzes/{id}
  updateQuiz(quizId: number, request: QuizRequest): Observable<QuizDetail> {
    return this.api.request((http) => http.put<QuizDetail>(`/quizzes/${quizId}`, request));
  }

  // UC12 – DELETE /api/quizzes/{id}
  deleteQuiz(quizId: number): Observable<void> {
    return this.api.request((http) => http.delete<void>(`/quizzes/${quizId}`));
  }

  // UC14 – PUT /api/quizzes/{id}/publish  body: { publish: true|false }
  setPublish(quizId: number, publish: boolean): Observable<QuizDetail> {
    return this.api.request((http) => http.put<QuizDetail>(`/quizzes/${quizId}/publish`, { publish }));
  }

  // ===== UC13/UC17 – Quản lý câu hỏi trong Quiz =====

  // UC13/UC17 – POST /api/quizzes/{quizId}/questions
  // request: { questionId } (tái sử dụng) HOẶC { questionBankId?, newQuestion } (tạo mới)
  addQuizQuestion(quizId: number, request: AddQuizQuestionRequest): Observable<QuestionSummary> {
    return this.api.request((http) => http.post<QuestionSummary>(`/quizzes/${quizId}/questions`, request));
  }

  // UC13 – PUT /api/quizzes/{quizId}/questions/order  body: { questionIds: [...] }
  reorderQuizQuestions(quizId: number, questionIds: number[]): Observable<void> {
    return this.api.request((http) => http.put<void>(`/quizzes/${quizId}/questions/order`, { questionIds }));
  }

  // UC13 – DELETE /api/quizzes/{quizId}/questions/{questionId}
  removeQuizQuestion(quizId: number, questionId: number): Observable<void> {
    return this.api.request((http) => http.delete<void>(`/quizzes/${quizId}/questions/${questionId}`));
  }

  // ===== Chấm thủ công & thống kê (chủ quiz / Admin) =====

  // GET /api/quizzes/{quizId}/grading?page=&pageSize=&sort=newest|oldest&includeGraded=
  getGrading(quizId: number, q?: GradingQuery): Observable<PagedResult<GradingItem>> {
    return this.api.request((http) =>
      http.get<PagedResult<GradingItem>>(`/quizzes/${quizId}/grading`, { params: toListParams(q) })
    );
  }

  // PUT /api/attempt-answers/{attemptAnswerId}/grade  body: { isCorrect }
  gradeAnswer(attemptAnswerId: number, isCorrect: boolean): Observable<GradeResult> {
    return this.api.request((http) =>
      http.put<GradeResult>(`/attempt-answers/${attemptAnswerId}/grade`, { isCorrect })
    );
  }

  // GET /api/quizzes/{quizId}/stats
  getStats(quizId: number): Observable<QuizStats> {
    return this.api.request((http) => http.get<QuizStats>(`/quizzes/${quizId}/stats`));
  }
}
