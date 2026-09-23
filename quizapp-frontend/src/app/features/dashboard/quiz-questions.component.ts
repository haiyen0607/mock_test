// UC13 – Manage Quiz Questions + UC17 – Reuse Question
//
// Trang này làm 4 việc:
//   1. Liệt kê câu hỏi trong quiz (theo orderIndex)
//   2. Thêm câu hỏi MỚI: chọn bank chứa + nhập nội dung/loại/đáp án → POST { questionBankId, newQuestion }
//   3. Tái sử dụng câu hỏi CÓ SẴN (UC16+17): tìm câu hỏi public hoặc từ bank của mình → POST { questionId }
//   4. Xóa câu hỏi khỏi quiz, di chuyển lên/xuống (PUT order với danh sách questionIds mới)

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../core/services/quiz.service';
import { QuestionBankService } from '../../core/services/question-bank.service';
import {
  QuizDetail,
  QuestionBank,
  BankQuestion,
  PublicQuestion,
  QuestionType,
  AnswerRequest,
  usesPredefinedAnswers
} from '../../core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-quiz-questions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container py-5">
      <a routerLink="/dashboard/my-quizzes" class="btn btn-outline-secondary mb-4">← Quiz Của Tôi</a>

      <div *ngIf="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show">
        {{ errorMessage }}
        <button type="button" class="btn-close" (click)="errorMessage = null"></button>
      </div>
      <div *ngIf="successMessage" class="alert alert-success alert-dismissible fade show">
        {{ successMessage }}
        <button type="button" class="btn-close" (click)="successMessage = null"></button>
      </div>

      <div *ngIf="quiz && !isLoading">
        <h2 class="mb-1">📋 Câu Hỏi: {{ quiz.title }}</h2>
        <p class="text-muted mb-4">{{ quiz.questions.length }} câu hỏi — cần ít nhất 1 câu để publish (UC14)</p>

        <!-- ===== Danh sách câu hỏi hiện có ===== -->
        <div class="card shadow-sm mb-4">
          <div class="card-header bg-light"><strong>Câu hỏi trong quiz</strong></div>
          <ul class="list-group list-group-flush">
            <li *ngFor="let q of quiz.questions; let i = index" class="list-group-item d-flex align-items-center gap-2">
              <span class="badge bg-secondary">{{ i + 1 }}</span>
              <div class="flex-grow-1">
                {{ q.content }}
                <small class="text-muted d-block">{{ typeLabel(q.questionType) }} — {{ q.answerCount }} đáp án</small>
              </div>
              <button class="btn btn-sm btn-outline-secondary" (click)="move(i, -1)" [disabled]="i === 0">↑</button>
              <button class="btn btn-sm btn-outline-secondary" (click)="move(i, 1)" [disabled]="i === quiz.questions.length - 1">↓</button>
              <button class="btn btn-sm btn-outline-danger" (click)="removeQuestion(q.questionId)">🗑️</button>
            </li>
            <li *ngIf="quiz.questions.length === 0" class="list-group-item text-muted">
              Chưa có câu hỏi nào — thêm bằng 1 trong 2 cách bên dưới.
            </li>
          </ul>
        </div>

        <!-- ===== Tab chọn cách thêm ===== -->
        <ul class="nav nav-tabs">
          <li class="nav-item">
            <button class="nav-link" [class.active]="tab === 'new'" (click)="tab = 'new'">➕ Tạo câu hỏi mới</button>
          </li>
          <li class="nav-item">
            <button class="nav-link" [class.active]="tab === 'reuse'" (click)="tab = 'reuse'; loadReuseSources()">
              ♻️ Tái sử dụng câu hỏi (UC17)
            </button>
          </li>
        </ul>

        <!-- ===== TAB 1: Tạo câu hỏi mới ===== -->
        <div *ngIf="tab === 'new'" class="card shadow-sm border-top-0 rounded-top-0">
          <div class="card-body">
            <div class="mb-3">
              <label class="form-label">Lưu câu hỏi vào Question Bank <span class="text-danger">*</span></label>
              <select class="form-select" [(ngModel)]="newQ.bankId">
                <option [ngValue]="null">-- Chọn bank --</option>
                <option *ngFor="let b of myBanks" [ngValue]="b.questionBankId">{{ b.name }}</option>
              </select>
              <small class="text-muted">
                Chưa có bank? <a routerLink="/dashboard/question-banks">Tạo Question Bank</a> trước.
              </small>
            </div>

            <div class="mb-3">
              <label class="form-label">Nội dung câu hỏi <span class="text-danger">*</span></label>
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

            <!-- Đáp án: chỉ hiện với loại chọn đáp án -->
            <div *ngIf="needsAnswers()" class="mb-3">
              <label class="form-label">Đáp án (tick ✓ vào đáp án đúng)</label>
              <div *ngFor="let a of newQ.answers; let i = index" class="input-group mb-2">
                <div class="input-group-text">
                  <input class="form-check-input mt-0" type="checkbox" [(ngModel)]="a.isCorrect" title="Đáp án đúng" />
                </div>
                <input type="text" class="form-control" [(ngModel)]="a.content" placeholder="Nội dung đáp án {{ i + 1 }}" />
                <button class="btn btn-outline-danger" (click)="newQ.answers.splice(i, 1)" [disabled]="newQ.type === 'TrueFalse'">✕</button>
              </div>
              <button class="btn btn-sm btn-outline-secondary" (click)="addAnswerRow()" [disabled]="newQ.type === 'TrueFalse'">
                + Thêm đáp án
              </button>
            </div>
            <p *ngIf="!needsAnswers()" class="text-muted small">
              Loại câu hỏi này trả lời bằng văn bản — không cần định nghĩa đáp án
              (ShortAnswer/FillInTheBlanks chấm tự động khi khớp text; LongAnswer chấm tay).
            </p>

            <button class="btn btn-primary" (click)="submitNewQuestion()" [disabled]="isSubmitting">
              {{ isSubmitting ? 'Đang thêm...' : '➕ Thêm vào Quiz' }}
            </button>
          </div>
        </div>

        <!-- ===== TAB 2: Tái sử dụng ===== -->
        <div *ngIf="tab === 'reuse'" class="card shadow-sm border-top-0 rounded-top-0">
          <div class="card-body">
            <!-- Nguồn 1: bank của tôi -->
            <div class="mb-4">
              <label class="form-label"><strong>Từ bank của tôi</strong></label>
              <select class="form-select mb-2" [(ngModel)]="reuseBankId" (ngModelChange)="loadBankQuestions()">
                <option [ngValue]="null">-- Chọn bank --</option>
                <option *ngFor="let b of myBanks" [ngValue]="b.questionBankId">{{ b.name }} ({{ b.questionCount }} câu)</option>
              </select>
              <ul class="list-group" *ngIf="bankQuestions.length > 0">
                <li *ngFor="let q of bankQuestions" class="list-group-item d-flex align-items-center">
                  <div class="flex-grow-1">
                    {{ q.content }}
                    <small class="text-muted d-block">{{ typeLabel(q.questionType) }}</small>
                  </div>
                  <button class="btn btn-sm btn-success" (click)="reuseQuestion(q.questionId)" [disabled]="isSubmitting">
                    + Thêm
                  </button>
                </li>
              </ul>
            </div>

            <!-- Nguồn 2: câu hỏi công khai (UC16) -->
            <div>
              <label class="form-label"><strong>Tìm câu hỏi công khai (UC16)</strong></label>
              <div class="input-group mb-2">
                <input type="text" class="form-control" placeholder="Từ khóa..." [(ngModel)]="publicSearch"
                       (keyup.enter)="searchPublic()" />
                <button class="btn btn-outline-primary" (click)="searchPublic()">🔍 Tìm</button>
              </div>
              <ul class="list-group" *ngIf="publicQuestions.length > 0">
                <li *ngFor="let q of publicQuestions" class="list-group-item d-flex align-items-center">
                  <div class="flex-grow-1">
                    {{ q.content }}
                    <small class="text-muted d-block">{{ typeLabel(q.questionType) }} — Bank: {{ q.questionBankName }}</small>
                  </div>
                  <button class="btn btn-sm btn-success" (click)="reuseQuestion(q.questionId)" [disabled]="isSubmitting">
                    + Thêm
                  </button>
                </li>
              </ul>
              <p *ngIf="publicSearched && publicQuestions.length === 0" class="text-muted small">
                Không tìm thấy câu hỏi công khai phù hợp.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .nav-link { cursor: pointer; }
  `]
})
export class QuizQuestionsComponent implements OnInit, OnDestroy {
  quiz: QuizDetail | null = null;
  isLoading = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  tab: 'new' | 'reuse' = 'new';

  // Form tạo câu hỏi mới
  myBanks: QuestionBank[] = [];
  newQ = {
    bankId: null as number | null,
    content: '',
    type: 'SingleChoice' as QuestionType,
    answers: [
      { content: '', isCorrect: true },
      { content: '', isCorrect: false }
    ] as AnswerRequest[]
  };

  // Tái sử dụng
  reuseBankId: number | null = null;
  bankQuestions: BankQuestion[] = [];
  publicSearch = '';
  publicQuestions: PublicQuestion[] = [];
  publicSearched = false;

  private quizId!: number;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private quizService: QuizService,
    private bankService: QuestionBankService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.quizId = parseInt(params['id'], 10);
      this.loadQuiz();
    });
    this.loadMyBanks();
  }

  loadQuiz(): void {
    this.isLoading = true;
    this.quizService.getQuizDetail(this.quizId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.quiz = data; this.isLoading = false; },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.response?.data?.detail || 'Không thể tải quiz.';
      }
    });
  }

  loadMyBanks(): void {
    this.bankService.getMyBanks().pipe(takeUntil(this.destroy$)).subscribe({
      next: (banks) => (this.myBanks = banks),
      error: (err) => console.error(err)
    });
  }

  loadReuseSources(): void {
    if (this.myBanks.length === 0) this.loadMyBanks();
  }

  // ===== Tạo câu hỏi mới =====

  needsAnswers(): boolean {
    return usesPredefinedAnswers(this.newQ.type);
  }

  onTypeChange(): void {
    if (this.newQ.type === 'TrueFalse') {
      // TrueFalse: đúng 2 đáp án định nghĩa sẵn
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

  addAnswerRow(): void {
    this.newQ.answers.push({ content: '', isCorrect: false });
  }

  // UC13 – POST { questionBankId, newQuestion }
  submitNewQuestion(): void {
    if (!this.newQ.bankId) {
      this.errorMessage = 'Hãy chọn Question Bank để lưu câu hỏi.';
      return;
    }
    if (!this.newQ.content.trim()) {
      this.errorMessage = 'Hãy nhập nội dung câu hỏi.';
      return;
    }

    const answers = this.needsAnswers()
      ? this.newQ.answers.filter((a) => a.content.trim())
      : [];

    this.isSubmitting = true;
    this.errorMessage = null;

    this.quizService
      .addQuizQuestion(this.quizId, {
        questionBankId: this.newQ.bankId,
        newQuestion: {
          content: this.newQ.content.trim(),
          questionType: this.newQ.type,
          answers
        }
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.successMessage = 'Đã thêm câu hỏi vào quiz.';
          this.newQ.content = '';
          this.onTypeChange();
          this.loadQuiz();      // tải lại danh sách
          this.loadMyBanks();   // cập nhật questionCount của bank
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = this.extractError(err);
        }
      });
  }

  // ===== Tái sử dụng (UC17) =====

  loadBankQuestions(): void {
    this.bankQuestions = [];
    if (this.reuseBankId == null) return;
    this.bankService.getBankQuestions(this.reuseBankId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (qs) => (this.bankQuestions = qs),
      error: (err) => (this.errorMessage = err?.response?.data?.detail || 'Không tải được câu hỏi của bank.')
    });
  }

  // UC16 – tìm câu hỏi công khai
  searchPublic(): void {
    this.publicSearched = false;
    this.bankService.searchPublicQuestions(this.publicSearch).pipe(takeUntil(this.destroy$)).subscribe({
      next: (qs) => { this.publicQuestions = qs; this.publicSearched = true; },
      error: (err) => (this.errorMessage = err?.response?.data?.detail || 'Tìm kiếm thất bại.')
    });
  }

  // UC17 – POST { questionId }
  reuseQuestion(questionId: number): void {
    this.isSubmitting = true;
    this.errorMessage = null;
    this.quizService.addQuizQuestion(this.quizId, { questionId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'Đã thêm câu hỏi vào quiz.';
        this.loadQuiz();
      },
      error: (err) => {
        this.isSubmitting = false;
        // A3 – câu hỏi đã có trong quiz, A2 – bank riêng tư... backend trả detail rõ ràng
        this.errorMessage = this.extractError(err);
      }
    });
  }

  // ===== Xóa & sắp xếp =====

  // UC13 – DELETE /quizzes/{quizId}/questions/{questionId}
  removeQuestion(questionId: number): void {
    if (!confirm('Gỡ câu hỏi này khỏi quiz? (Câu hỏi vẫn còn trong Question Bank)')) return;
    this.quizService.removeQuizQuestion(this.quizId, questionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.loadQuiz(),
      error: (err) => (this.errorMessage = this.extractError(err))
    });
  }

  // UC13 – PUT order: gửi toàn bộ danh sách questionIds theo thứ tự mới
  move(index: number, delta: number): void {
    if (!this.quiz) return;
    const ids = this.quiz.questions.map((q) => q.questionId);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;

    [ids[index], ids[target]] = [ids[target], ids[index]]; // hoán đổi vị trí

    this.quizService.reorderQuizQuestions(this.quizId, ids).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.loadQuiz(),
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
    return data?.detail || 'Thao tác thất bại. Vui lòng thử lại.';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
