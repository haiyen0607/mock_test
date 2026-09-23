// UC15 – Quản lý câu hỏi bên trong một Question Bank
// Tạo question kèm answers, sửa nội dung/loại, xóa; thêm/sửa/xóa từng answer

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuestionBankService } from '../../core/services/question-bank.service';
import { BankQuestion, QuestionType, AnswerRequest, usesPredefinedAnswers } from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-bank-questions',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container py-5">
      <a routerLink="/dashboard/question-banks" class="btn btn-outline-secondary mb-4">← Ngân Hàng Câu Hỏi</a>

      <h2 class="mb-4">📝 Câu Hỏi Trong Bank #{{ bankId }}</h2>

      <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show">
        {{ errorMessage }}
        <button type="button" class="btn-close" (click)="errorMessage = null"></button>
      </div>

      <!-- ===== Form tạo question mới (kèm answers) ===== -->
      <div class="card shadow-sm mb-4">
        <div class="card-header bg-light"><strong>➕ Tạo câu hỏi mới</strong></div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label">Nội dung <span class="text-danger">*</span></label>
            <textarea class="form-control" rows="2" [(ngModel)]="newQ.content"></textarea>
          </div>
          <div class="mb-3">
            <label class="form-label">Loại câu hỏi</label>
            <select class="form-select" [(ngModel)]="newQ.type" (ngModelChange)="onTypeChange()">
              <option value="SingleChoice">Chọn 1 đáp án</option>
              <option value="MultipleChoice">Chọn nhiều đáp án</option>
              <option value="TrueFalse">Đúng / Sai</option>
              <option value="FillInTheBlanks">Điền vào chỗ trống</option>
              <option value="ShortAnswer">Trả lời ngắn</option>
              <option value="LongAnswer">Tự luận (chấm tay)</option>
            </select>
          </div>

          <div *ngIf="needsAnswers()" class="mb-3">
            <label class="form-label">Đáp án (tick ✓ = đúng)</label>
            <div *ngFor="let a of newQ.answers; let i = index" class="input-group mb-2">
              <div class="input-group-text">
                <input class="form-check-input mt-0" type="checkbox" [(ngModel)]="a.isCorrect" />
              </div>
              <input type="text" class="form-control" [(ngModel)]="a.content" placeholder="Đáp án {{ i + 1 }}" />
              <button class="btn btn-outline-danger" (click)="newQ.answers.splice(i, 1)" [disabled]="newQ.type === 'TrueFalse'">✕</button>
            </div>
            <button class="btn btn-sm btn-outline-secondary" (click)="newQ.answers.push({ content: '', isCorrect: false })"
                    [disabled]="newQ.type === 'TrueFalse'">
              + Thêm đáp án
            </button>
          </div>

          <button class="btn btn-primary" (click)="createQuestion()" [disabled]="isSaving || !newQ.content.trim()">
            {{ isSaving ? 'Đang tạo...' : '💾 Tạo Câu Hỏi' }}
          </button>
        </div>
      </div>

      <!-- ===== Danh sách question ===== -->
      <div *ngIf="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngFor="let q of questions" class="card shadow-sm mb-3">
        <div class="card-body">
          <!-- Chế độ xem -->
          <div *ngIf="editingQuestionId !== q.questionId">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h6 class="mb-1">{{ q.content }}</h6>
                <span class="badge bg-secondary me-1">{{ typeLabel(q.questionType) }}</span>
                <span class="badge" [ngClass]="q.status === 'Active' ? 'bg-success' : 'bg-danger'">{{ q.status }}</span>
              </div>
              <div class="flex-shrink-0">
                <button class="btn btn-sm btn-outline-primary me-1" (click)="startEditQuestion(q)">✏️</button>
                <button class="btn btn-sm btn-outline-danger" (click)="deleteQuestion(q)">🗑️</button>
              </div>
            </div>
          </div>

          <!-- Chế độ sửa question (content + type) -->
          <div *ngIf="editingQuestionId === q.questionId" class="mb-2">
            <textarea class="form-control mb-2" rows="2" [(ngModel)]="editQ.content"></textarea>
            <select class="form-select mb-2" [(ngModel)]="editQ.type">
              <option value="SingleChoice">Chọn 1 đáp án</option>
              <option value="MultipleChoice">Chọn nhiều đáp án</option>
              <option value="TrueFalse">Đúng / Sai</option>
              <option value="FillInTheBlanks">Điền vào chỗ trống</option>
              <option value="ShortAnswer">Trả lời ngắn</option>
              <option value="LongAnswer">Tự luận</option>
            </select>
            <button class="btn btn-sm btn-primary me-1" (click)="saveEditQuestion(q)">💾 Lưu</button>
            <button class="btn btn-sm btn-outline-secondary" (click)="editingQuestionId = null">Hủy</button>
          </div>

          <!-- Answers -->
          <div *ngIf="q.answers.length > 0 || usesPredefined(q.questionType)" class="mt-3 ps-3 border-start">
            <div *ngFor="let a of q.answers" class="d-flex align-items-center gap-2 mb-1">
              <!-- Sửa answer inline -->
              <ng-container *ngIf="editingAnswerId === a.answerId; else viewAnswer">
                <input class="form-check-input" type="checkbox" [(ngModel)]="editA.isCorrect" />
                <input type="text" class="form-control form-control-sm" [(ngModel)]="editA.content" />
                <button class="btn btn-sm btn-primary" (click)="saveEditAnswer(a)">💾</button>
                <button class="btn btn-sm btn-outline-secondary" (click)="editingAnswerId = null">✕</button>
              </ng-container>
              <ng-template #viewAnswer>
                <span [ngClass]="a.isCorrect ? 'text-success fw-bold' : ''">
                  {{ a.isCorrect ? '✓' : '○' }} {{ a.content }}
                </span>
                <button class="btn btn-sm btn-link p-0" (click)="startEditAnswer(a)">sửa</button>
                <button class="btn btn-sm btn-link text-danger p-0" (click)="deleteAnswer(q, a.answerId)">xóa</button>
              </ng-template>
            </div>

            <!-- Thêm answer mới -->
            <div class="input-group input-group-sm mt-2" style="max-width: 480px;">
              <div class="input-group-text">
                <input class="form-check-input mt-0" type="checkbox" [(ngModel)]="newAnswerCorrect[q.questionId]" />
              </div>
              <input type="text" class="form-control" placeholder="Đáp án mới..." [(ngModel)]="newAnswerContent[q.questionId]" />
              <button class="btn btn-outline-primary" (click)="addAnswer(q)">+ Thêm</button>
            </div>
          </div>
        </div>
      </div>

      <p *ngIf="!isLoading && questions.length === 0" class="text-muted text-center py-4">
        Bank này chưa có câu hỏi nào.
      </p>
    </div>
  `,
  styles: []
})
export class BankQuestionsComponent implements OnInit, OnDestroy {
  bankId!: number;
  questions: BankQuestion[] = [];
  isLoading = false;
  isSaving = false;
  errorMessage: string | null = null;

  // Form tạo question mới
  newQ = {
    content: '',
    type: 'SingleChoice' as QuestionType,
    answers: [
      { content: '', isCorrect: true },
      { content: '', isCorrect: false }
    ] as AnswerRequest[]
  };

  // Sửa question
  editingQuestionId: number | null = null;
  editQ = { content: '', type: 'SingleChoice' as QuestionType };

  // Sửa answer
  editingAnswerId: number | null = null;
  editA = { content: '', isCorrect: false };

  // Thêm answer mới cho từng question
  newAnswerContent: { [questionId: number]: string } = {};
  newAnswerCorrect: { [questionId: number]: boolean } = {};

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private bankService: QuestionBankService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.bankId = parseInt(params['id'], 10);
      this.loadQuestions();
    });
  }

  loadQuestions(): void {
    this.isLoading = true;
    this.bankService.getBankQuestions(this.bankId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.questions = data; this.isLoading = false; },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.response?.data?.detail || 'Không thể tải câu hỏi.';
      }
    });
  }

  needsAnswers(): boolean {
    return usesPredefinedAnswers(this.newQ.type);
  }

  usesPredefined(type: QuestionType): boolean {
    return usesPredefinedAnswers(type);
  }

  onTypeChange(): void {
    if (this.newQ.type === 'TrueFalse') {
      this.newQ.answers = [
        { content: 'Đúng', isCorrect: true },
        { content: 'Sai', isCorrect: false }
      ];
    } else if (this.needsAnswers() && this.newQ.answers.length < 2) {
      this.newQ.answers = [
        { content: '', isCorrect: true },
        { content: '', isCorrect: false }
      ];
    }
  }

  // UC15 – POST /{bankId}/questions
  createQuestion(): void {
    const answers = this.needsAnswers() ? this.newQ.answers.filter((a) => a.content.trim()) : [];
    this.isSaving = true;
    this.errorMessage = null;

    this.bankService
      .addQuestion(this.bankId, {
        content: this.newQ.content.trim(),
        questionType: this.newQ.type,
        answers
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.newQ.content = '';
          this.onTypeChange();
          this.loadQuestions();
        },
        error: (err) => {
          this.isSaving = false;
          this.errorMessage = this.extractError(err);
        }
      });
  }

  startEditQuestion(q: BankQuestion): void {
    this.editingQuestionId = q.questionId;
    this.editQ = { content: q.content, type: q.questionType };
  }

  // UC15 – PUT /questions/{questionId}
  saveEditQuestion(q: BankQuestion): void {
    this.bankService
      .updateQuestion(q.questionId, this.editQ.content.trim(), this.editQ.type)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.editingQuestionId = null;
          this.loadQuestions();
        },
        error: (err) => (this.errorMessage = this.extractError(err))
      });
  }

  // UC15 – DELETE /questions/{questionId}
  deleteQuestion(q: BankQuestion): void {
    if (!confirm('Xóa câu hỏi này? Nó cũng sẽ bị gỡ khỏi các quiz đang dùng.')) return;
    this.bankService.deleteQuestion(q.questionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.loadQuestions(),
      error: (err) => (this.errorMessage = this.extractError(err))
    });
  }

  startEditAnswer(a: { answerId: number; content: string; isCorrect: boolean }): void {
    this.editingAnswerId = a.answerId;
    this.editA = { content: a.content, isCorrect: a.isCorrect };
  }

  // UC15 – PUT /answers/{answerId}
  saveEditAnswer(a: { answerId: number }): void {
    this.bankService
      .updateAnswer(a.answerId, { content: this.editA.content.trim(), isCorrect: this.editA.isCorrect })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.editingAnswerId = null;
          this.loadQuestions();
        },
        error: (err) => (this.errorMessage = this.extractError(err))
      });
  }

  // UC15 – DELETE /answers/{answerId}
  deleteAnswer(q: BankQuestion, answerId: number): void {
    this.bankService.deleteAnswer(answerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.loadQuestions(),
      error: (err) => (this.errorMessage = this.extractError(err))
    });
  }

  // UC15 – POST /questions/{questionId}/answers
  addAnswer(q: BankQuestion): void {
    const content = this.newAnswerContent[q.questionId]?.trim();
    if (!content) return;

    this.bankService
      .addAnswer(q.questionId, { content, isCorrect: !!this.newAnswerCorrect[q.questionId] })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.newAnswerContent[q.questionId] = '';
          this.newAnswerCorrect[q.questionId] = false;
          this.loadQuestions();
        },
        error: (err) => (this.errorMessage = this.extractError(err))
      });
  }

  typeLabel(type: string): string {
    const map: { [key: string]: string } = {
      MultipleChoice: 'Chọn nhiều',
      SingleChoice: 'Chọn 1',
      TrueFalse: 'Đúng / Sai',
      FillInTheBlanks: 'Điền chỗ trống',
      ShortAnswer: 'Trả lời ngắn',
      LongAnswer: 'Tự luận'
    };
    return map[type] || type;
  }

  private extractError(err: any): string {
    const data = err?.response?.data;
    if (data?.errors) return Object.values(data.errors as { [k: string]: string[] }).flat().join(' ');
    return data?.detail || 'Thao tác thất bại.';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
