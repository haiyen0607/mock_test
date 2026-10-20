// UC15 – Manage Question Bank, UC16 – Search Public Questions
// Khớp QuestionBanksController: /api/question-banks

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  QuestionBank,
  QuestionBankInfo,
  QuestionBankRequest,
  BankQuestion,
  PublicQuestion,
  QuestionAndAnswersRequest,
  AnswerRequest,
  ReplaceQuestionRequest,
  Answer,
  ListQuery,
  PagedResult
} from '../models';
import { ApiClient, toListParams } from './api-client';

@Injectable({
  providedIn: 'root'
})
export class QuestionBankService {
  constructor(private api: ApiClient) {}

  // ===== Question Bank =====

  // UC15 – GET /question-banks/mine?page=&pageSize=&sort=newest|oldest|title
  getMyBanks(q?: ListQuery): Observable<PagedResult<QuestionBank>> {
    return this.api.request((http) =>
      http.get<PagedResult<QuestionBank>>('/question-banks/mine', { params: toListParams(q) }));
  }

  // UC15 – POST /question-banks
  createBank(request: QuestionBankRequest): Observable<QuestionBank> {
    return this.api.request((http) =>
      http.post<QuestionBank>('/question-banks', request));
  }

  // UC15 – PUT /question-banks/{bankId}
  updateBank(bankId: number, request: QuestionBankRequest): Observable<QuestionBank> {
    return this.api.request((http) =>
      http.put<QuestionBank>(`/question-banks/${bankId}`, request));
  }

  // UC15 – DELETE /question-banks/{bankId}
  deleteBank(bankId: number): Observable<void> {
    return this.api.request((http) =>
      http.delete<void>(`/question-banks/${bankId}`));
  }

  // ===== Questions trong bank =====

  // UC15 – GET /question-banks/{bankId}/questions
  // Chủ sở hữu/Admin nhận QuestionDto (có isCorrect); người khác (bank public) nhận PublicQuestionDto.
  // UC16 – GET /question-banks/public?search=&page=&pageSize=&sort= (bank công khai của mọi User)
  getPublicBanks(q?: ListQuery): Observable<PagedResult<QuestionBankInfo>> {
    return this.api.request((http) =>
      http.get<PagedResult<QuestionBankInfo>>('/question-banks/public', { params: toListParams(q) }));
  }

  // UC15/UC16 – GET /question-banks/{bankId}: bank của mình hoặc bank công khai (khác -> 404)
  getBank(bankId: number): Observable<QuestionBankInfo> {
    return this.api.request((http) => http.get<QuestionBankInfo>(`/question-banks/${bankId}`));
  }

  /**
   * GET /question-banks/{bankId}/questions — chủ sở hữu nhận BankQuestion[] (có isCorrect);
   * người khác (bank công khai) nhận PublicQuestion[] (chỉ options, KHÔNG có đáp án đúng).
   */
  getBankQuestions(bankId: number): Observable<BankQuestion[]> {
    return this.api.request((http) =>
      http.get<BankQuestion[]>(`/question-banks/${bankId}/questions`));
  }

  /** Cùng endpoint, dành cho người xem KHÔNG phải chủ sở hữu (bank công khai): chỉ có options, không có đáp án đúng. */
  getPublicBankQuestions(bankId: number): Observable<PublicQuestion[]> {
    return this.api.request((http) =>
      http.get<PublicQuestion[]>(`/question-banks/${bankId}/questions`));
  }

  // UC15 – POST /question-banks/{bankId}/questions (tạo question kèm answers)
  addQuestion(bankId: number, request: QuestionAndAnswersRequest): Observable<BankQuestion> {
    return this.api.request((http) =>
      http.post<BankQuestion>(`/question-banks/${bankId}/questions`, request));
  }

  // UC15 – PUT /question-banks/questions/{questionId} (chỉ content + type)
  updateQuestion(questionId: number, content: string, questionType: string): Observable<BankQuestion> {
    return this.api.request((http) =>
      http.put<BankQuestion>(`/question-banks/questions/${questionId}`, { content, questionType })
    );
  }

  // UC15 – PUT /question-banks/questions/{questionId}/full (câu hỏi + toàn bộ đáp án, 1 transaction)
  replaceQuestion(questionId: number, request: ReplaceQuestionRequest): Observable<BankQuestion> {
    return this.api.request((http) =>
      http.put<BankQuestion>(`/question-banks/questions/${questionId}/full`, request));
  }

  // UC15 – DELETE /question-banks/questions/{questionId}
  deleteQuestion(questionId: number): Observable<void> {
    return this.api.request((http) =>
      http.delete<void>(`/question-banks/questions/${questionId}`));
  }

  // ===== Answers của question =====

  // UC15 – POST /question-banks/questions/{questionId}/answers
  addAnswer(questionId: number, request: AnswerRequest): Observable<Answer> {
    return this.api.request((http) =>
      http.post<Answer>(`/question-banks/questions/${questionId}/answers`, request)
    );
  }

  // UC15 – PUT /question-banks/answers/{answerId}
  updateAnswer(answerId: number, request: AnswerRequest): Observable<Answer> {
    return this.api.request((http) =>
      http.put<Answer>(`/question-banks/answers/${answerId}`, request));
  }

  // UC15 – DELETE /question-banks/answers/{answerId}
  deleteAnswer(answerId: number): Observable<void> {
    return this.api.request((http) =>
      http.delete<void>(`/question-banks/answers/${answerId}`));
  }

  // ===== Public questions =====

  // UC16 – GET /question-banks/public-questions?search=
  searchPublicQuestions(search?: string): Observable<PublicQuestion[]> {
    return this.api.request((http) =>
      http.get<PublicQuestion[]>('/question-banks/public-questions', {
        params: search?.trim() ? { search: search.trim() } : {}
      })
    );
  }
}
