// UC15 – Manage Question Bank, UC16 – Search Public Questions
// Khớp QuestionBanksController: /api/question-banks

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import axios, { AxiosInstance } from 'axios';
import { environment } from '../../../environments/environment';
import {
  QuestionBank,
  QuestionBankRequest,
  BankQuestion,
  PublicQuestion,
  QuestionAndAnswersRequest,
  AnswerRequest,
  ResultAnswer
} from '../models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class QuestionBankService {
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

  // Helper: bọc promise axios thành Observable cho đồng bộ với các service khác
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

  // ===== Question Bank =====

  // UC15 – GET /question-banks/mine
  getMyBanks(): Observable<QuestionBank[]> {
    return this.wrap(this.axiosInstance.get<QuestionBank[]>('/question-banks/mine'));
  }

  // UC15 – POST /question-banks
  createBank(request: QuestionBankRequest): Observable<QuestionBank> {
    return this.wrap(this.axiosInstance.post<QuestionBank>('/question-banks', request));
  }

  // UC15 – PUT /question-banks/{bankId}
  updateBank(bankId: number, request: QuestionBankRequest): Observable<QuestionBank> {
    return this.wrap(this.axiosInstance.put<QuestionBank>(`/question-banks/${bankId}`, request));
  }

  // UC15 – DELETE /question-banks/{bankId}
  deleteBank(bankId: number): Observable<void> {
    return this.wrap(this.axiosInstance.delete<void>(`/question-banks/${bankId}`));
  }

  // ===== Questions trong bank =====

  // UC15 – GET /question-banks/{bankId}/questions
  getBankQuestions(bankId: number): Observable<BankQuestion[]> {
    return this.wrap(this.axiosInstance.get<BankQuestion[]>(`/question-banks/${bankId}/questions`));
  }

  // UC15 – POST /question-banks/{bankId}/questions (tạo question kèm answers)
  addQuestion(bankId: number, request: QuestionAndAnswersRequest): Observable<BankQuestion> {
    return this.wrap(this.axiosInstance.post<BankQuestion>(`/question-banks/${bankId}/questions`, request));
  }

  // UC15 – PUT /question-banks/questions/{questionId} (chỉ content + type)
  updateQuestion(questionId: number, content: string, questionType: string): Observable<BankQuestion> {
    return this.wrap(
      this.axiosInstance.put<BankQuestion>(`/question-banks/questions/${questionId}`, { content, questionType })
    );
  }

  // UC15 – DELETE /question-banks/questions/{questionId}
  deleteQuestion(questionId: number): Observable<void> {
    return this.wrap(this.axiosInstance.delete<void>(`/question-banks/questions/${questionId}`));
  }

  // ===== Answers của question =====

  // UC15 – POST /question-banks/questions/{questionId}/answers
  addAnswer(questionId: number, request: AnswerRequest): Observable<ResultAnswer> {
    return this.wrap(
      this.axiosInstance.post<ResultAnswer>(`/question-banks/questions/${questionId}/answers`, request)
    );
  }

  // UC15 – PUT /question-banks/answers/{answerId}
  updateAnswer(answerId: number, request: AnswerRequest): Observable<ResultAnswer> {
    return this.wrap(this.axiosInstance.put<ResultAnswer>(`/question-banks/answers/${answerId}`, request));
  }

  // UC15 – DELETE /question-banks/answers/{answerId}
  deleteAnswer(answerId: number): Observable<void> {
    return this.wrap(this.axiosInstance.delete<void>(`/question-banks/answers/${answerId}`));
  }

  // ===== Public questions =====

  // UC16 – GET /question-banks/public-questions?search=
  searchPublicQuestions(search?: string): Observable<PublicQuestion[]> {
    return this.wrap(
      this.axiosInstance.get<PublicQuestion[]>('/question-banks/public-questions', {
        params: search?.trim() ? { search: search.trim() } : {}
      })
    );
  }
}
