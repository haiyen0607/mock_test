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
<div class="bg-page min-vh-100 py-5">
  <div class="container max-w-1000">
    <div class="mb-4">
      <a routerLink="/dashboard/question-banks" class="btn btn-white shadow-sm rounded-pill px-4 fw-medium text-secondary hover-primary">
        ← Quay lại Ngân hàng
      </a>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-5">
      <h2 class="fw-bold mb-0 text-secondary d-flex align-items-center gap-2">
        <span class="fs-2"><i class="bi bi-file-earmark-text"></i></span> Danh sách câu hỏi
      </h2>
      <span class="badge bg-light text-secondary border px-3 py-2 rounded-pill fs-6">Bank ID: #{{ bankId }}</span>
    </div>

    <div *ngIf="errorMessage" class="alert alert-danger rounded-4 shadow-sm border-0 mb-4 d-flex align-items-center">
      <span class="fs-4 me-3">⚠️</span>
      <div class="flex-grow-1">{{ errorMessage }}</div>
      <button type="button" class="btn-close" (click)="errorMessage = null"></button>
    </div>

    <!-- Form tạo question mới -->
    <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-5">
      <div class="card-accent-gradient"></div>
      <div class="card-header bg-white border-bottom-0 pt-4 pb-0 px-4 px-md-5">
        <h5 class="fw-medium text-secondary mb-0 d-flex align-items-center gap-2">
          <span class="text-primary fs-4"><i class="bi bi-plus"></i></span> Tạo câu hỏi mới
        </h5>
      </div>
      <div class="card-body p-4 p-md-5 pt-4">
        <div class="row g-4 mb-4">
          <div class="col-md-8">
            <label class="form-label fw-bold text-secondary small text-uppercase">Nội dung câu hỏi <span class="text-danger">*</span></label>
            <textarea class="form-control form-control-lg bg-light border-0" rows="3" [(ngModel)]="newQ.content" placeholder="Nhập nội dung câu hỏi..."></textarea>
          </div>
          <div class="col-md-4">
            <label class="form-label fw-bold text-secondary small text-uppercase">Loại câu hỏi</label>
            <select class="form-select form-select-lg bg-light border-0 cursor-pointer" [(ngModel)]="newQ.type" (ngModelChange)="onTypeChange()">
              <option value="SingleChoice">Chọn 1 đáp án</option>
              <option value="MultipleChoice">Chọn nhiều đáp án</option>
              <option value="TrueFalse">Đúng / Sai</option>
              <option value="FillInTheBlanks">Điền vào chỗ trống</option>
              <option value="ShortAnswer">Trả lời ngắn</option>
              <option value="LongAnswer">Tự luận (chấm tay)</option>
            </select>
          </div>
        </div>

        <div *ngIf="needsAnswers()" class="bg-light p-4 rounded-4 mb-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <label class="form-label fw-bold text-secondary small text-uppercase mb-0">Các đáp án</label>
            <span class="badge bg-white text-secondary border">Tick ✓ vào đáp án đúng</span>
          </div>

          <div class="d-flex flex-column gap-2 mb-3">
            <div *ngFor="let a of newQ.answers; let i = index" class="d-flex align-items-center gap-2 bg-white p-2 rounded-3 border">
              <div class="form-check m-0 ps-4 pe-2">
                <input class="form-check-input fs-5 cursor-pointer" type="checkbox" [(ngModel)]="a.isCorrect" />
              </div>
              <input type="text" class="form-control border-0 bg-transparent px-0 shadow-none" [(ngModel)]="a.content" placeholder="Nội dung đáp án {{ i + 1 }}..." />
              <button class="btn btn-light rounded-circle p-2 text-danger hover-danger" (click)="newQ.answers.splice(i, 1)" [disabled]="newQ.type === 'TrueFalse'">
                <i class="fs-5">✕</i>
              </button>
            </div>
          </div>

          <button class="btn btn-white btn-sm rounded-pill px-3 fw-medium text-primary border" (click)="newQ.answers.push({ content: '', isCorrect: false })"
                  [disabled]="newQ.type === 'TrueFalse'">
            + Thêm đáp án khác
          </button>
        </div>

        <div class="text-end mt-4 pt-3 border-top">
          <button class="btn btn-primary btn-lg rounded-pill px-5 custom-gradient text-white border-0 shadow-sm fw-bold" (click)="createQuestion()" [disabled]="isSaving || !newQ.content.trim()">
            <span *ngIf="isSaving" class="spinner-border spinner-border-sm me-2"></span>
            {{ isSaving ? 'Đang tạo...' : 'Lưu Câu Hỏi' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Danh sách question -->
    <h4 class="fw-bold mb-4 text-secondary px-2"><i class="bi bi-card-list"></i> Danh sách câu hỏi trong Ngân hàng</h4>

    <div *ngIf="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;"></div>
    </div>

    <div class="d-flex flex-column gap-4">
      <div *ngFor="let q of questions; let i = index" class="card border-0 shadow-sm rounded-4 question-card overflow-hidden">
        <div class="card-body p-4 p-md-5">
          <!-- Chế độ xem -->
          <div *ngIf="editingQuestionId !== q.questionId">
            <div class="d-flex justify-content-between align-items-start gap-4 mb-4">
              <div>
                <h5 class="fw-medium text-secondary mb-2 lh-base">
                  <span class="text-primary me-2">Câu {{ i + 1 }}.</span> {{ q.content }}
                </h5>
                <div class="d-flex flex-wrap gap-2">
                  <span class="badge bg-light text-secondary border px-3 py-2 rounded-pill">{{ typeLabel(q.questionType) }}</span>
                  <span class="badge px-3 py-2 rounded-pill" [ngClass]="q.status === 'Active' ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' : 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25'">
                    {{ q.status === 'Active' ? 'Hoạt động' : 'Bị gỡ' }}
                  </span>
                </div>
              </div>
              <div class="flex-shrink-0 d-flex gap-2 bg-light p-1 rounded-pill border">
                <button class="btn btn-sm btn-white rounded-circle p-2 text-primary shadow-sm" (click)="startEditQuestion(q)" title="Sửa câu hỏi"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-white rounded-circle p-2 text-danger shadow-sm" (click)="deleteQuestion(q)" title="Xóa câu hỏi"><i class="bi bi-trash"></i></button>
              </div>
            </div>
          </div>

          <!-- Chế độ sửa question -->
          <div *ngIf="editingQuestionId === q.questionId" class="bg-light p-4 rounded-4 mb-4 border">
            <h6 class="fw-bold mb-3 text-primary"><i class="bi bi-pencil"></i> Sửa câu hỏi</h6>
            <textarea class="form-control bg-white mb-3" rows="3" [(ngModel)]="editQ.content"></textarea>
            <div class="row mb-4">
              <div class="col-md-6">
                <select class="form-select bg-white cursor-pointer" [(ngModel)]="editQ.type">
                  <option value="SingleChoice">Chọn 1 đáp án</option>
                  <option value="MultipleChoice">Chọn nhiều đáp án</option>
                  <option value="TrueFalse">Đúng / Sai</option>
                  <option value="FillInTheBlanks">Điền vào chỗ trống</option>
                  <option value="ShortAnswer">Trả lời ngắn</option>
                  <option value="LongAnswer">Tự luận</option>
                </select>
              </div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-primary rounded-pill px-4 fw-medium custom-gradient border-0" (click)="saveEditQuestion(q)">Lưu thay đổi</button>
              <button class="btn btn-white border rounded-pill px-4 fw-medium text-secondary" (click)="editingQuestionId = null">Hủy</button>
            </div>
          </div>

          <!-- Answers -->
          <div *ngIf="q.answers.length > 0 || usesPredefined(q.questionType)" class="mt-2 pt-4 border-top">
            <h6 class="fw-bold text-secondary small text-uppercase mb-3">Danh sách đáp án</h6>
            
            <div class="row g-3 mb-4">
              <div *ngFor="let a of q.answers" class="col-md-6">
                <!-- Sửa answer inline -->
                <div *ngIf="editingAnswerId === a.answerId" class="d-flex align-items-center gap-2 p-2 bg-light rounded-3 border">
                  <div class="form-check m-0 ps-3">
                    <input class="form-check-input cursor-pointer" type="checkbox" [(ngModel)]="editA.isCorrect" />
                  </div>
                  <input type="text" class="form-control form-control-sm border-0" [(ngModel)]="editA.content" />
                  <button class="btn btn-sm btn-primary rounded-circle" (click)="saveEditAnswer(a)">💾</button>
                  <button class="btn btn-sm btn-light rounded-circle text-secondary" (click)="editingAnswerId = null">✕</button>
                </div>
                
                <!-- Xem answer -->
                <div *ngIf="editingAnswerId !== a.answerId" 
                     class="d-flex justify-content-between align-items-center p-3 rounded-3 border h-100 transition-all answer-card"
                     [ngClass]="a.isCorrect ? 'border-success bg-success bg-opacity-10' : 'bg-white'">
                  <div class="d-flex align-items-center gap-3">
                    <div class="answer-indicator rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                         [ngClass]="a.isCorrect ? 'bg-success text-white' : 'bg-light text-secondary border'">
                      {{ a.isCorrect ? '✓' : '' }}
                    </div>
                    <span class="fw-medium" [ngClass]="a.isCorrect ? 'text-success' : 'text-secondary'">{{ a.content }}</span>
                  </div>
                  <div class="answer-actions d-flex gap-1">
                    <button class="btn btn-sm btn-light rounded-circle p-1 text-secondary hover-primary" (click)="startEditAnswer(a)" title="Sửa đáp án"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-light rounded-circle p-1 text-secondary hover-danger" (click)="deleteAnswer(q, a.answerId)" title="Xóa đáp án">✕</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Thêm answer mới -->
            <div class="d-inline-flex p-2 bg-light rounded-pill border align-items-center gap-2 w-100" style="max-width: 500px;">
              <div class="form-check m-0 ps-4 pe-1" title="Đánh dấu là đáp án đúng">
                <input class="form-check-input cursor-pointer" type="checkbox" [(ngModel)]="newAnswerCorrect[q.questionId]" />
              </div>
              <input type="text" class="form-control border-0 bg-transparent shadow-none px-0" placeholder="Thêm đáp án mới..." [(ngModel)]="newAnswerContent[q.questionId]" />
              <button class="btn btn-primary rounded-pill px-3 fw-medium custom-gradient border-0 flex-shrink-0" (click)="addAnswer(q)">+ Thêm</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="!isLoading && questions.length === 0" class="text-center py-5 bg-white rounded-4 shadow-sm border-0 mt-4">
      <div class="fs-1 mb-3"><i class="bi bi-inbox"></i></div>
      <h5 class="fw-medium text-secondary mb-2">Ngân hàng trống</h5>
      <p class="text-muted mb-0">Chưa có câu hỏi nào trong ngân hàng này. Hãy tạo câu hỏi đầu tiên ở form bên trên.</p>
    </div>
  </div>
</div>
  `,
  styles: [
    `
      .bg-page { background-color: #f8f9ff; }
      .max-w-1000 { max-width: 1000px; margin: 0 auto; }
      .custom-gradient { background: linear-gradient(135deg, #667eea, #764ba2); }
      .card-accent-gradient { height: 4px; background: linear-gradient(135deg, #667eea, #764ba2); }
      
      .btn-white { background-color: #fff; border: 1px solid #e2e8f0; transition: all 0.2s; }
      .btn-white:hover { background-color: #f8f9fa; }
      .hover-primary:hover { color: #667eea !important; border-color: #667eea; }
      .hover-danger:hover { color: #ef4444 !important; background-color: #fef2f2 !important; }
      
      .cursor-pointer { cursor: pointer; }
      .transition-all { transition: all 0.2s; }
      
      .question-card { transition: transform 0.2s, box-shadow 0.2s; }
      .question-card:hover { transform: translateY(-2px); box-shadow: 0 .5rem 1rem rgba(0,0,0,.08) !important; }
      
      .answer-indicator { width: 24px; height: 24px; font-size: 0.8rem; }
      
      .answer-actions { opacity: 0; transition: opacity 0.2s; }
      .answer-card:hover .answer-actions { opacity: 1; }
      
      /* form inputs */
      .form-control:focus, .form-select:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 0.25rem rgba(102, 126, 234, 0.25);
      }
      .bg-light textarea.form-control:focus, .bg-light select.form-select:focus {
        background-color: #fff !important;
      }
    `
  ]

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
