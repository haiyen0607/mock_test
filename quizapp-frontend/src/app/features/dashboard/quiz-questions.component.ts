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
<div class="bg-page min-vh-100 py-5">
  <div class="container max-w-1000">
    <div class="mb-4">
      <a routerLink="/dashboard/my-quizzes" class="btn btn-white shadow-sm rounded-pill px-4 fw-medium text-secondary hover-primary">
        ← Quay lại Quiz Của Tôi
      </a>
    </div>

    <div *ngIf="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;"></div>
      <p class="mt-3 text-muted fs-5">Đang tải dữ liệu...</p>
    </div>

    <div *ngIf="errorMessage" class="alert alert-danger rounded-4 shadow-sm border-0 mb-4 d-flex align-items-center">
      <span class="fs-4 me-3">⚠️</span>
      <div class="flex-grow-1">{{ errorMessage }}</div>
      <button type="button" class="btn-close" (click)="errorMessage = null"></button>
    </div>

    <div *ngIf="successMessage" class="alert alert-success rounded-4 shadow-sm border-0 mb-4 d-flex align-items-center">
      <span class="fs-4 me-3"><i class="bi bi-check-circle"></i></span>
      <div class="flex-grow-1">{{ successMessage }}</div>
      <button type="button" class="btn-close" (click)="successMessage = null"></button>
    </div>

    <div *ngIf="quiz && !isLoading">
      <!-- Header -->
      <div class="card border-0 shadow-sm rounded-4 mb-5 overflow-hidden">
        <div class="card-accent-gradient"></div>
        <div class="card-body p-4 p-md-5">
          <div class="d-flex justify-content-between align-items-start gap-4 flex-wrap">
            <div>
              <h2 class="fw-bold mb-2 text-secondary d-flex align-items-center gap-2">
                <span class="fs-2"><i class="bi bi-card-list"></i></span> {{ quiz.title }}
              </h2>
              <p class="text-muted mb-0 fs-6">
                <span class="badge bg-light text-secondary border me-2">{{ quiz.questions.length }} câu hỏi</span>
                <span class="text-muted">Cần ít nhất 1 câu để publish</span>
              </p>
            </div>
            <span class="badge rounded-pill px-3 py-2" [ngClass]="quiz.isPublished ? 'badge-public' : 'badge-private'">
              {{ quiz.isPublished ? '<i class="bi bi-globe"></i> Đã Publish' : '<i class="bi bi-lock"></i> Đang ẩn' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Content Layout: 2 Columns on Desktop -->
      <div class="row g-5">
        
        <!-- Cột trái: Quản lý danh sách câu hỏi -->
        <div class="col-lg-7">
          <h4 class="fw-bold mb-4 text-secondary d-flex align-items-center gap-2">
            <span class="text-primary fs-4"><i class="bi bi-file-earmark-text"></i></span> Câu hỏi trong Quiz
          </h4>

          <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
            <div class="list-group list-group-flush custom-list">
              <div *ngFor="let q of quiz.questions; let i = index" class="list-group-item p-4 border-bottom">
                <div class="d-flex align-items-start gap-3">
                  <div class="question-number rounded-circle d-flex align-items-center justify-content-center bg-light text-primary fw-bold flex-shrink-0 border mt-1">
                    {{ i + 1 }}
                  </div>
                  
                  <div class="flex-grow-1 min-w-0">
                    <h6 class="fw-medium text-secondary mb-2 lh-base text-break">{{ q.content }}</h6>
                    <div class="d-flex flex-wrap gap-2 mb-3">
                      <span class="badge bg-light text-secondary border">{{ typeLabel(q.questionType) }}</span>
                      <span class="badge bg-light text-secondary border">{{ q.answerCount }} đáp án</span>
                    </div>
                    
                    <div class="d-flex gap-2">
                      <button class="btn btn-sm btn-light rounded-pill px-3 fw-medium text-secondary hover-primary border" (click)="move(i, -1)" [disabled]="i === 0" title="Di chuyển lên">↑ Lên</button>
                      <button class="btn btn-sm btn-light rounded-pill px-3 fw-medium text-secondary hover-primary border" (click)="move(i, 1)" [disabled]="i === quiz.questions.length - 1" title="Di chuyển xuống">↓ Xuống</button>
                    </div>
                  </div>
                  
                  <div class="flex-shrink-0 ps-2">
                    <button class="btn btn-white rounded-circle p-2 text-danger hover-danger border shadow-sm" (click)="removeQuestion(q.questionId)" title="Xóa khỏi quiz">
                      <i class="fs-6"><i class="bi bi-trash"></i></i>
                    </button>
                  </div>
                </div>
              </div>
              
              <div *ngIf="quiz.questions.length === 0" class="text-center py-5 bg-white">
                <div class="fs-1 mb-3 text-muted"><i class="bi bi-inbox"></i></div>
                <h6 class="fw-medium text-secondary">Chưa có câu hỏi</h6>
                <p class="text-muted small mb-0">Hãy thêm câu hỏi từ cột bên phải</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Cột phải: Thêm câu hỏi -->
        <div class="col-lg-5">
          <div class="sticky-top" style="top: 2rem; z-index: 10;">
            <h4 class="fw-bold mb-4 text-secondary d-flex align-items-center gap-2">
              <span class="text-success fs-4"><i class="bi bi-plus"></i></span> Thêm câu hỏi
            </h4>

            <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
              <!-- Custom Tabs -->
              <div class="d-flex border-bottom bg-light">
                <button class="flex-fill btn rounded-0 py-3 fw-bold border-0 tab-btn" [class.active-tab]="tab === 'new'" (click)="tab = 'new'">
                  Tạo Mới
                </button>
                <button class="flex-fill btn rounded-0 py-3 fw-bold border-0 border-start tab-btn" [class.active-tab]="tab === 'reuse'" (click)="tab = 'reuse'; loadReuseSources()">
                  Tái Sử Dụng
                </button>
              </div>

              <div class="card-body p-4">
                
                <!-- TAB 1: TẠO MỚI -->
                <div *ngIf="tab === 'new'" class="animate-fade-in">
                  <div class="mb-4 p-3 bg-light rounded-3 border">
                    <label class="form-label fw-bold text-secondary small text-uppercase mb-2">Lưu vào Question Bank <span class="text-danger">*</span></label>
                    <select class="form-select border-0 cursor-pointer mb-2" [(ngModel)]="newQ.bankId">
                      <option [ngValue]="null">-- Chọn bank của bạn --</option>
                      <option *ngFor="let b of myBanks" [ngValue]="b.questionBankId">{{ b.name }}</option>
                    </select>
                    <div class="small text-muted d-flex align-items-center gap-1">
                      <span>💡 Chưa có bank?</span>
                      <a routerLink="/dashboard/question-banks" class="text-primary text-decoration-none fw-medium hover-underline">Tạo Bank mới</a>
                    </div>
                  </div>

                  <div class="mb-3">
                    <label class="form-label fw-bold text-secondary small text-uppercase">Nội dung <span class="text-danger">*</span></label>
                    <textarea class="form-control bg-light border-0" rows="3" [(ngModel)]="newQ.content" placeholder="Nhập câu hỏi..."></textarea>
                  </div>

                  <div class="mb-4">
                    <label class="form-label fw-bold text-secondary small text-uppercase">Loại câu hỏi</label>
                    <select class="form-select bg-light border-0 cursor-pointer" [(ngModel)]="newQ.type" (ngModelChange)="onTypeChange()">
                      <option value="SingleChoice">Chọn 1 đáp án</option>
                      <option value="MultipleChoice">Chọn nhiều đáp án</option>
                      <option value="TrueFalse">Đúng / Sai</option>
                      <option value="FillInTheBlanks">Điền vào chỗ trống</option>
                      <option value="ShortAnswer">Trả lời ngắn</option>
                      <option value="LongAnswer">Tự luận (chấm tay)</option>
                    </select>
                  </div>

                  <div *ngIf="needsAnswers()" class="mb-4">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <label class="form-label fw-bold text-secondary small text-uppercase mb-0">Đáp án</label>
                      <span class="badge bg-light text-secondary border">Tick ✓ = đúng</span>
                    </div>
                    
                    <div class="d-flex flex-column gap-2 mb-2">
                      <div *ngFor="let a of newQ.answers; let i = index" class="d-flex align-items-center gap-2 bg-light p-2 rounded-3">
                        <div class="form-check m-0 ps-3 pe-1">
                          <input class="form-check-input cursor-pointer" type="checkbox" [(ngModel)]="a.isCorrect" title="Đánh dấu đáp án đúng" />
                        </div>
                        <input type="text" class="form-control form-control-sm border-0 bg-transparent px-0 shadow-none" [(ngModel)]="a.content" placeholder="Đáp án {{ i + 1 }}" />
                        <button class="btn btn-sm btn-white rounded-circle p-1 text-danger hover-danger border" (click)="newQ.answers.splice(i, 1)" [disabled]="newQ.type === 'TrueFalse'" title="Xóa">✕</button>
                      </div>
                    </div>
                    <button class="btn btn-sm btn-white rounded-pill px-3 fw-medium text-primary border" (click)="addAnswerRow()" [disabled]="newQ.type === 'TrueFalse'">+ Thêm đáp án</button>
                  </div>
                  
                  <div *ngIf="!needsAnswers()" class="alert alert-light border rounded-3 mb-4 text-muted small">
                    ℹ️ Loại câu hỏi này trả lời bằng văn bản — không cần định nghĩa đáp án ở đây.
                  </div>

                  <button class="btn btn-primary w-100 py-3 rounded-3 custom-gradient text-white border-0 shadow-sm fw-bold fs-6" (click)="submitNewQuestion()" [disabled]="isSubmitting">
                    <span *ngIf="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                    {{ isSubmitting ? 'Đang thêm...' : 'Thêm vào Quiz' }}
                  </button>
                </div>

                <!-- TAB 2: TÁI SỬ DỤNG -->
                <div *ngIf="tab === 'reuse'" class="animate-fade-in">
                  
                  <!-- Nguồn 1 -->
                  <div class="mb-4 p-3 bg-light rounded-3 border">
                    <label class="form-label fw-bold text-secondary small text-uppercase mb-2">1. Từ Question Bank của bạn</label>
                    <select class="form-select border-0 cursor-pointer mb-3" [(ngModel)]="reuseBankId" (ngModelChange)="loadBankQuestions()">
                      <option [ngValue]="null">-- Chọn bank --</option>
                      <option *ngFor="let b of myBanks" [ngValue]="b.questionBankId">{{ b.name }} ({{ b.questionCount }} câu)</option>
                    </select>
                    
                    <div class="d-flex flex-column gap-2 max-h-300 overflow-auto pe-2" *ngIf="bankQuestions.length > 0">
                      <div *ngFor="let q of bankQuestions" class="d-flex align-items-center justify-content-between p-2 bg-white rounded border shadow-sm hover-elevate transition-all">
                        <div class="flex-grow-1 min-w-0 pe-2">
                          <div class="text-truncate fw-medium text-secondary mb-1" title="{{ q.content }}">{{ q.content }}</div>
                          <span class="badge bg-light text-secondary border border-secondary border-opacity-25" style="font-size: 0.7rem;">{{ typeLabel(q.questionType) }}</span>
                        </div>
                        <button class="btn btn-sm btn-success rounded-pill px-3 fw-medium flex-shrink-0 shadow-sm" (click)="reuseQuestion(q.questionId)" [disabled]="isSubmitting">+ Chọn</button>
                      </div>
                    </div>
                  </div>

                  <!-- Nguồn 2 -->
                  <div class="p-3 bg-light rounded-3 border">
                    <label class="form-label fw-bold text-secondary small text-uppercase mb-2">2. Tìm từ cộng đồng</label>
                    <div class="input-group mb-3 shadow-sm rounded-3 overflow-hidden border">
                      <input type="text" class="form-control border-0 bg-white" placeholder="Từ khóa..." [(ngModel)]="publicSearch" (keyup.enter)="searchPublic()" />
                      <button class="btn btn-primary px-3 border-0 custom-gradient" (click)="searchPublic()"><i class="bi bi-search"></i></button>
                    </div>
                    
                    <div class="d-flex flex-column gap-2 max-h-300 overflow-auto pe-2" *ngIf="publicQuestions.length > 0">
                      <div *ngFor="let q of publicQuestions" class="d-flex align-items-center justify-content-between p-2 bg-white rounded border shadow-sm hover-elevate transition-all">
                        <div class="flex-grow-1 min-w-0 pe-2">
                          <div class="text-truncate fw-medium text-secondary mb-1" title="{{ q.content }}">{{ q.content }}</div>
                          <div class="d-flex gap-1">
                            <span class="badge bg-light text-secondary border border-secondary border-opacity-25" style="font-size: 0.7rem;">{{ typeLabel(q.questionType) }}</span>
                            <span class="badge bg-light text-primary border border-primary border-opacity-25 text-truncate max-w-100" style="font-size: 0.7rem;" title="{{ q.questionBankName }}">Bank: {{ q.questionBankName }}</span>
                          </div>
                        </div>
                        <button class="btn btn-sm btn-success rounded-pill px-3 fw-medium flex-shrink-0 shadow-sm" (click)="reuseQuestion(q.questionId)" [disabled]="isSubmitting">+ Chọn</button>
                      </div>
                    </div>
                    
                    <p *ngIf="publicSearched && publicQuestions.length === 0" class="text-muted small text-center mb-0 p-2 bg-white rounded border">
                      Không tìm thấy câu hỏi phù hợp.
                    </p>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [
    `
      .bg-page { background-color: #f8f9ff; }
      .max-w-1000 { max-width: 1000px; margin: 0 auto; }
      .max-w-100 { max-width: 100px; }
      .min-w-0 { min-width: 0; }
      .custom-gradient { background: linear-gradient(135deg, #667eea, #764ba2); }
      .card-accent-gradient { height: 4px; background: linear-gradient(135deg, #667eea, #764ba2); }
      
      .btn-white { background-color: #fff; border: 1px solid #e2e8f0; transition: all 0.2s; }
      .btn-white:hover:not(:disabled) { background-color: #f8f9fa; }
      .hover-primary:hover:not(:disabled) { color: #667eea !important; border-color: #667eea !important; }
      .hover-danger:hover:not(:disabled) { color: #ef4444 !important; border-color: #fecaca !important; background-color: #fef2f2 !important; }
      .hover-underline:hover { text-decoration: underline !important; }
      
      .cursor-pointer { cursor: pointer; }
      .transition-all { transition: all 0.2s; }
      .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      
      .badge-public { background: rgba(16, 185, 129, 0.15); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); }
      .badge-private { background: rgba(107, 114, 128, 0.15); color: #4b5563; border: 1px solid rgba(107, 114, 128, 0.3); }
      
      .question-number { width: 36px; height: 36px; font-size: 1rem; }
      .custom-list .list-group-item { background: transparent; transition: background-color 0.2s; }
      .custom-list .list-group-item:hover { background-color: #f8f9fa; }
      
      .tab-btn { color: #6b7280; background: transparent; transition: all 0.2s; }
      .tab-btn:hover { color: #667eea; background: rgba(102, 126, 234, 0.05); }
      .active-tab { color: #667eea; background: white; box-shadow: inset 0 3px 0 #667eea; }
      
      .max-h-300 { max-height: 300px; }
      .hover-elevate:hover { transform: translateY(-1px); box-shadow: 0 4px 6px rgba(0,0,0,0.05) !important; }
      
      /* custom scrollbar for lists */
      .overflow-auto::-webkit-scrollbar { width: 6px; }
      .overflow-auto::-webkit-scrollbar-track { background: transparent; }
      .overflow-auto::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
      
      .form-control:focus, .form-select:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 0.25rem rgba(102, 126, 234, 0.25);
      }
    `
  ]
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
