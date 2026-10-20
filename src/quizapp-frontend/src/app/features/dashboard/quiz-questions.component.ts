// UC13 – Manage Quiz Questions + UC17 – Reuse Question
//
// Trang này làm 4 việc:
//   1. Liệt kê câu hỏi trong quiz (theo orderIndex)
//   2. Thêm câu hỏi MỚI: (tuỳ chọn) chọn bank chứa + nhập nội dung/loại/đáp án → POST { questionBankId?, newQuestion }
//   3. Tái sử dụng câu hỏi CÓ SẴN (UC16+17): tìm câu hỏi public hoặc từ bank của mình → POST { questionId }
//   4. Xóa câu hỏi khỏi quiz, di chuyển lên/xuống (PUT order với danh sách questionIds mới)

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../core/services/quiz.service';
import { QuestionBankService } from '../../core/services/question-bank.service';
import {
  QuizDetail,
  QuestionBank,
  QuestionBankInfo,
  BankQuestion,
  PublicQuestion,
  QuestionType,
  QuestionSummary,
  AnswerRequest,
  usesPredefinedAnswers,
  allowsOneSelectionOnly
} from '../../core/models';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DialogService } from '../../core/services/dialog.service';
import { extractError } from '../../core/errors';

@Component({
  selector: 'app-quiz-questions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, EmptyStateComponent, SkeletonComponent],
  template: `
<div class="page-container animate-fade-up">
  <a routerLink="/dashboard/my-quizzes" class="back-link">
    <i class="bi bi-arrow-left" aria-hidden="true"></i>Quiz của tôi
  </a>

  <div *ngIf="errorMessage && quiz" class="alert alert-danger alert-dismissible fade show" role="alert">
    <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
    <div>{{ errorMessage }}</div>
    <button type="button" class="btn-close" aria-label="Đóng" (click)="errorMessage = null"></button>
  </div>

  <app-skeleton *ngIf="isLoading && !quiz" variant="list" [count]="4"></app-skeleton>

  <div *ngIf="!quiz && !isLoading && loadError" class="surface">
    <app-empty-state icon="bi-wifi-off" tone="danger" title="Không tải được quiz" [message]="loadError">
      <button type="button" class="btn btn-primary" (click)="loadQuiz()">
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
      </button>
      <a class="btn btn-light" routerLink="/dashboard/my-quizzes">Về Quiz của tôi</a>
    </app-empty-state>
  </div>

  <div *ngIf="quiz">
    <!-- Header -->
    <header class="page-header">
      <div class="min-w-0">
        <h1 class="text-break">{{ quiz.title }}</h1>
        <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
          <span class="chip" [class.chip-success]="quiz.isPublished">
            <i class="bi" [ngClass]="quiz.isPublished ? 'bi-globe2' : 'bi-lock'" aria-hidden="true"></i>
            {{ quiz.isPublished ? 'Đang công khai' : 'Riêng tư' }}
          </span>
          <span class="chip chip-outline tabular">
            <i class="bi bi-question-circle" aria-hidden="true"></i>{{ quiz.questions.length }} câu hỏi
          </span>
          <span class="hint">Cần ít nhất 1 câu để công khai</span>
        </div>
      </div>
      <a class="btn btn-light" [routerLink]="['/dashboard/quiz-edit', quiz.quizId]">
        <i class="bi bi-pencil me-1" aria-hidden="true"></i>Sửa thông tin
      </a>
    </header>

    <div class="row g-4">
      <!-- Cột trái: danh sách câu hỏi -->
      <div class="col-lg-7">
        <h2 class="section-title">Câu hỏi trong quiz</h2>

        <ol class="question-list stagger" *ngIf="quiz.questions.length > 0">
          <li *ngFor="let q of quiz.questions; let i = index" class="surface question-card" [class.editing]="editingId === q.questionId">
            <span class="q-number tabular" aria-hidden="true">{{ i + 1 }}</span>

            <!-- Xem câu hỏi -->
            <div *ngIf="editingId !== q.questionId" class="flex-grow-1 min-w-0">
              <div class="d-flex flex-wrap gap-1 mb-2">
                <span class="chip chip-brand">
                  <i class="bi" [ngClass]="typeIcon(q.questionType)" aria-hidden="true"></i>{{ typeLabel(q.questionType) }}
                </span>
                <span class="chip tabular">{{ q.answerCount }} đáp án</span>
                <span *ngIf="!q.canEdit" class="chip chip-outline" title="Câu hỏi tái sử dụng từ ngân hàng của người khác nên không sửa được">
                  <i class="bi bi-lock" aria-hidden="true"></i>Chỉ xem
                </span>
              </div>
              <p class="q-content">{{ q.content }}</p>
              <ul class="q-answers" *ngIf="q.answers?.length">
                <li *ngFor="let a of q.answers" [class.correct]="a.isCorrect">
                  <i class="bi" [ngClass]="a.isCorrect ? 'bi-check-circle-fill' : 'bi-circle'" aria-hidden="true"></i>
                  <span>{{ a.content }}</span>
                  <span class="visually-hidden" *ngIf="a.isCorrect">(đáp án đúng)</span>
                </li>
              </ul>
            </div>

            <!-- Sửa câu hỏi -->
            <form *ngIf="editingId === q.questionId" class="flex-grow-1 min-w-0 edit-form" (ngSubmit)="saveEdit(q)" novalidate>
              <h3 class="edit-title">Sửa câu {{ i + 1 }}</h3>

              <div class="mb-3">
                <label class="form-label" [attr.for]="'editContent' + q.questionId">
                  Nội dung câu hỏi <span class="req" aria-hidden="true">*</span><span class="visually-hidden">(bắt buộc)</span>
                </label>
                <textarea [id]="'editContent' + q.questionId" name="content" class="form-control" rows="3"
                          [(ngModel)]="editQ.content" (ngModelChange)="editErrors.content = null"
                          [class.is-invalid]="editErrors.content" [attr.aria-invalid]="editErrors.content ? true : null"
                          [attr.aria-describedby]="editErrors.content ? 'editContentError' + q.questionId : null"></textarea>
                <div *ngIf="editErrors.content" [id]="'editContentError' + q.questionId" class="invalid-feedback d-block">{{ editErrors.content }}</div>
              </div>

              <div class="mb-3">
                <label class="form-label" [attr.for]="'editType' + q.questionId">Loại câu hỏi</label>
                <select [id]="'editType' + q.questionId" name="type" class="form-select" [(ngModel)]="editQ.type" (ngModelChange)="onEditTypeChange()">
                  <option *ngFor="let t of editTypeOptions(q)" [value]="t">{{ typeLabel(t) }}</option>
                </select>
              </div>

              <fieldset *ngIf="editNeedsAnswers()" class="mb-3">
                <legend class="form-label mb-1">Đáp án</legend>
                <div class="form-text mt-0 mb-2">
                  {{ editOneCorrectOnly() ? 'Chọn 1 đáp án đúng.' : 'Đánh dấu một hoặc nhiều đáp án đúng.' }}
                </div>
                <div class="d-flex flex-column gap-2 mb-2">
                  <div *ngFor="let a of editQ.answers; let j = index" class="answer-row" [class.is-correct]="a.isCorrect">
                    <input class="form-check-input m-0 flex-shrink-0" type="checkbox" [name]="'editCorrect' + j"
                           [class.as-radio]="editOneCorrectOnly()"
                           [(ngModel)]="a.isCorrect" (ngModelChange)="onEditCorrectChange(j); editErrors.answers = null"
                           [attr.aria-label]="'Đáp án ' + (j + 1) + ' là đáp án đúng'" title="Đánh dấu đáp án đúng" />
                    <input type="text" class="form-control form-control-sm answer-input" [name]="'editAnswer' + j"
                           [(ngModel)]="a.content" (ngModelChange)="editErrors.answers = null"
                           [attr.aria-label]="'Nội dung đáp án ' + (j + 1)" placeholder="Đáp án {{ j + 1 }}" />
                    <button type="button" class="btn btn-light btn-icon btn-sm-icon flex-shrink-0" (click)="editQ.answers.splice(j, 1)"
                            [disabled]="editQ.type === 'TrueFalse'" title="Xóa đáp án" [attr.aria-label]="'Xóa đáp án ' + (j + 1)">
                      <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary" (click)="editQ.answers.push({ answerId: null, content: '', isCorrect: false })"
                        [disabled]="editQ.type === 'TrueFalse'">
                  <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Thêm đáp án
                </button>
                <div *ngIf="editErrors.answers" class="invalid-feedback d-block" role="alert">{{ editErrors.answers }}</div>
              </fieldset>

              <p class="hint mb-3">
                <i class="bi bi-info-circle me-1" aria-hidden="true"></i>Thay đổi áp dụng cho mọi quiz đang dùng câu hỏi này.
              </p>

              <div class="d-flex gap-2 justify-content-end">
                <button type="button" class="btn btn-light btn-sm" (click)="cancelEdit()" [disabled]="savingEdit">Hủy</button>
                <button type="submit" class="btn btn-primary btn-sm" [disabled]="savingEdit">
                  <span *ngIf="savingEdit" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                  {{ savingEdit ? 'Đang lưu…' : 'Lưu thay đổi' }}
                </button>
              </div>
            </form>

            <div class="q-actions" *ngIf="editingId !== q.questionId">
              <button *ngIf="q.canEdit" type="button" class="btn btn-light btn-icon btn-sm-icon" (click)="startEdit(q)"
                      [disabled]="isReordering || removingId === q.questionId"
                      title="Sửa câu hỏi" [attr.aria-label]="'Sửa câu ' + (i + 1) + ': ' + shortText(q.content)">
                <i class="bi bi-pencil" aria-hidden="true"></i>
              </button>
              <button type="button" class="btn btn-light btn-icon btn-sm-icon" (click)="move(i, -1)" [disabled]="i === 0 || isReordering"
                      title="Di chuyển lên" [attr.aria-label]="'Di chuyển câu ' + (i + 1) + ': ' + shortText(q.content) + ' lên'">
                <span *ngIf="movingId === q.questionId && movingDir === -1; else upIcon" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <ng-template #upIcon><i class="bi bi-arrow-up" aria-hidden="true"></i></ng-template>
              </button>
              <button type="button" class="btn btn-light btn-icon btn-sm-icon" (click)="move(i, 1)" [disabled]="i === quiz.questions.length - 1 || isReordering"
                      title="Di chuyển xuống" [attr.aria-label]="'Di chuyển câu ' + (i + 1) + ': ' + shortText(q.content) + ' xuống'">
                <span *ngIf="movingId === q.questionId && movingDir === 1; else downIcon" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <ng-template #downIcon><i class="bi bi-arrow-down" aria-hidden="true"></i></ng-template>
              </button>
              <button type="button" class="btn btn-outline-danger btn-icon btn-sm-icon" (click)="removeQuestion(q, i)"
                      [disabled]="removingId === q.questionId || isReordering"
                      title="Gỡ khỏi quiz" [attr.aria-label]="'Gỡ câu ' + (i + 1) + ': ' + shortText(q.content) + ' khỏi quiz'">
                <span *ngIf="removingId === q.questionId; else trashIcon" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <ng-template #trashIcon><i class="bi bi-trash" aria-hidden="true"></i></ng-template>
              </button>
            </div>
          </li>
        </ol>

        <div *ngIf="quiz.questions.length === 0" class="surface">
          <app-empty-state [compact]="true" icon="bi-patch-question" title="Chưa có câu hỏi"
                           message="Tạo câu hỏi mới hoặc tái sử dụng câu hỏi có sẵn ở khung Thêm câu hỏi.">
          </app-empty-state>
        </div>
      </div>

      <!-- Cột phải: thêm câu hỏi -->
      <div class="col-lg-5">
        <div class="add-panel">
          <h2 class="section-title">Thêm câu hỏi</h2>

          <div class="surface panel-card">
            <ul class="nav nav-tabs w-100 mb-4" role="tablist">
              <li class="nav-item flex-fill" role="presentation">
                <button type="button" class="nav-link w-100" role="tab" [class.active]="tab === 'new'"
                        [attr.aria-selected]="tab === 'new'" (click)="tab = 'new'">
                  <i class="bi bi-plus-circle me-1" aria-hidden="true"></i>Tạo mới
                </button>
              </li>
              <li class="nav-item flex-fill" role="presentation">
                <button type="button" class="nav-link w-100" role="tab" [class.active]="tab === 'reuse'"
                        [attr.aria-selected]="tab === 'reuse'" (click)="tab = 'reuse'; loadReuseSources()">
                  <i class="bi bi-recycle me-1" aria-hidden="true"></i>Tái sử dụng
                </button>
              </li>
            </ul>

            <!-- TAB 1: TẠO MỚI -->
            <div *ngIf="tab === 'new'" class="animate-fade-in">
              <div class="mb-3">
                <label for="newBank" class="form-label">Lưu vào ngân hàng câu hỏi <span class="text-muted fw-normal">(không bắt buộc)</span></label>
                <select id="newBank" class="form-select" [(ngModel)]="newQ.bankId" aria-describedby="newBankHelp">
                  <option [ngValue]="null">Không chọn (lưu vào “Câu hỏi tạo trong quiz”)</option>
                  <option *ngFor="let b of myBanks" [ngValue]="b.questionBankId">{{ b.name }}</option>
                </select>
                <div id="newBankHelp" class="form-text">
                  Nếu không chọn, câu hỏi được lưu vào ngân hàng riêng tư “Câu hỏi tạo trong quiz” (tự tạo khi cần) để bạn dùng lại sau.
                </div>
              </div>

              <div class="mb-3">
                <label for="newContent" class="form-label">Nội dung câu hỏi <span class="req" aria-hidden="true">*</span><span class="visually-hidden">(bắt buộc)</span></label>
                <textarea id="newContent" class="form-control" rows="3" [(ngModel)]="newQ.content" (ngModelChange)="fieldErrors.content = null"
                          [class.is-invalid]="fieldErrors.content" [attr.aria-invalid]="fieldErrors.content ? true : null"
                          [attr.aria-describedby]="fieldErrors.content ? 'newContentError' : null"></textarea>
                <div *ngIf="fieldErrors.content" id="newContentError" class="invalid-feedback d-block">{{ fieldErrors.content }}</div>
              </div>

              <div class="mb-3">
                <label for="newType" class="form-label">Loại câu hỏi</label>
                <select id="newType" class="form-select" [(ngModel)]="newQ.type" (ngModelChange)="onTypeChange()">
                  <option value="SingleChoice">Chọn 1 đáp án</option>
                  <option value="MultipleChoice">Chọn nhiều đáp án</option>
                  <option value="TrueFalse">Đúng / Sai</option>
                  <option value="LongAnswer">Tự luận (chấm tay)</option>
                </select>
              </div>

              <fieldset *ngIf="needsAnswers()" class="mb-4">
                <legend class="form-label mb-1">Đáp án</legend>
                <div class="form-text mt-0 mb-2">Đánh dấu ô bên trái cho đáp án đúng.</div>

                <div class="d-flex flex-column gap-2 mb-2">
                  <div *ngFor="let a of newQ.answers; let i = index" class="answer-row" [class.is-correct]="a.isCorrect">
                    <input class="form-check-input m-0 flex-shrink-0" type="checkbox" [id]="'ans-correct-' + i" [class.as-radio]="newQ.type !== 'MultipleChoice'"
                           [(ngModel)]="a.isCorrect" (ngModelChange)="onCorrectChange(newQ.answers, i, newQ.type)"
                           [attr.aria-label]="'Đáp án ' + (i + 1) + ' là đáp án đúng'" title="Đánh dấu đáp án đúng" />
                    <input type="text" class="form-control form-control-sm answer-input" [(ngModel)]="a.content"
                           [attr.aria-label]="'Nội dung đáp án ' + (i + 1)" placeholder="Đáp án {{ i + 1 }}" />
                    <span *ngIf="a.isCorrect" class="correct-mark" title="Đáp án đúng">
                      <i class="bi bi-check-circle-fill" aria-hidden="true"></i><span class="visually-hidden">Đáp án đúng</span>
                    </span>
                    <button type="button" class="btn btn-light btn-icon btn-sm-icon flex-shrink-0" (click)="newQ.answers.splice(i, 1)"
                            [disabled]="newQ.type === 'TrueFalse'" title="Xóa đáp án" [attr.aria-label]="'Xóa đáp án ' + (i + 1)">
                      <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary" (click)="addAnswerRow()" [disabled]="newQ.type === 'TrueFalse'">
                  <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Thêm đáp án
                </button>
              </fieldset>

              <div *ngIf="!needsAnswers()" class="note mb-4">
                <i class="bi bi-info-circle" aria-hidden="true"></i>
                <div>Loại câu hỏi này trả lời bằng văn bản, không cần định nghĩa đáp án ở đây.</div>
              </div>

              <div class="d-flex justify-content-end">
                <button type="button" class="btn btn-primary" (click)="submitNewQuestion()" [disabled]="isSubmitting">
                  <span *ngIf="isSubmitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                  {{ isSubmitting ? 'Đang thêm…' : 'Thêm vào quiz' }}
                </button>
              </div>
            </div>

            <!-- TAB 2: TÁI SỬ DỤNG -->
            <div *ngIf="tab === 'reuse'" class="animate-fade-in">
              <!-- Chọn nguồn câu hỏi -->
              <div class="d-flex flex-wrap gap-2 mb-3" role="radiogroup" aria-label="Nguồn câu hỏi">
                <button type="button" class="chip" role="radio" [class.active]="reuseSource === 'mine'"
                        [attr.aria-checked]="reuseSource === 'mine'" (click)="setReuseSource('mine')">
                  <i class="bi bi-person" aria-hidden="true"></i>Ngân hàng của tôi
                </button>
                <button type="button" class="chip" role="radio" [class.active]="reuseSource === 'public'"
                        [attr.aria-checked]="reuseSource === 'public'" (click)="setReuseSource('public')">
                  <i class="bi bi-globe2" aria-hidden="true"></i>Ngân hàng công khai
                </button>
              </div>

              <!-- Nguồn: ngân hàng của tôi -->
              <section *ngIf="reuseSource === 'mine'">
                <label for="reuseBank" class="form-label">Ngân hàng câu hỏi của bạn</label>
                <select id="reuseBank" class="form-select" [(ngModel)]="reuseBankId" (ngModelChange)="loadBankQuestions()">
                  <option [ngValue]="null">Chọn ngân hàng câu hỏi</option>
                  <option *ngFor="let b of myBanks" [ngValue]="b.questionBankId">{{ b.name }} ({{ b.questionCount }} câu)</option>
                </select>
                <div *ngIf="myBanks.length === 0" class="form-text">
                  Bạn chưa có ngân hàng câu hỏi nào. Thử chuyển sang <button type="button" class="btn btn-link btn-sm p-0 align-baseline" (click)="setReuseSource('public')">ngân hàng công khai</button>.
                </div>

                <ng-container *ngTemplateOutlet="pickList; context: { $implicit: bankQuestions, showBank: false }"></ng-container>
                <p *ngIf="reuseBankId !== null && !reuseLoading && bankQuestions.length === 0" class="hint mt-2 mb-0">Ngân hàng này chưa có câu hỏi.</p>
              </section>

              <!-- Nguồn: ngân hàng công khai của mọi người -->
              <section *ngIf="reuseSource === 'public'">
                <label for="publicBank" class="form-label">Ngân hàng công khai</label>
                <select id="publicBank" class="form-select mb-2" [(ngModel)]="publicBankId" (ngModelChange)="onPublicBankChange()">
                  <option [ngValue]="null">Tất cả ngân hàng công khai</option>
                  <option *ngFor="let b of publicBanks" [ngValue]="b.questionBankId">
                    {{ b.name }} — {{ b.canManage ? 'của bạn' : b.ownerUsername }} ({{ b.questionCount }} câu)
                  </option>
                </select>

                <label for="publicSearch" class="visually-hidden">Tìm câu hỏi công khai</label>
                <div class="search-field">
                  <i class="bi bi-search" aria-hidden="true"></i>
                  <input id="publicSearch" type="search" class="form-control" [ngModel]="publicSearch"
                         (ngModelChange)="onPublicSearchChange($event)" aria-describedby="publicSearchHelp"
                         placeholder="Tìm theo nội dung, tên ngân hàng hoặc người tạo" />
                </div>
                <div id="publicSearchHelp" class="form-text">
                  {{ publicBankId === null ? 'Hiển thị tối đa 100 câu mới nhất phù hợp.' : 'Lọc câu hỏi trong ngân hàng đã chọn.' }}
                </div>

                <ng-container *ngTemplateOutlet="pickList; context: { $implicit: publicList, showBank: publicBankId === null }"></ng-container>

                <app-empty-state *ngIf="!reuseLoading && publicLoaded && publicList.length === 0" [compact]="true" tone="neutral"
                                 icon="bi-search" title="Không tìm thấy câu hỏi phù hợp"
                                 [message]="publicSearch.trim() ? 'Thử một từ khóa khác.' : 'Chưa có câu hỏi công khai nào.'">
                </app-empty-state>
              </section>

              <div *ngIf="reuseLoading" class="d-flex align-items-center gap-2 hint mt-3" role="status">
                <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Đang tải câu hỏi…
              </div>

              <!-- Danh sách câu hỏi để chọn (dùng chung 2 nguồn) -->
              <ng-template #pickList let-items let-showBank="showBank">
                <ul class="pick-list mt-2" *ngIf="items.length > 0">
                  <li *ngFor="let q of items" class="pick-item">
                    <div class="flex-grow-1 min-w-0">
                      <div class="pick-title text-truncate" [title]="q.content">{{ q.content }}</div>
                      <div class="d-flex gap-1 min-w-0">
                        <span class="chip chip-sm">{{ typeLabel(q.questionType) }}</span>
                        <span *ngIf="showBank && q.questionBankName" class="chip chip-sm chip-brand text-truncate bank-chip" [title]="q.questionBankName">
                          <i class="bi bi-collection" aria-hidden="true"></i>{{ q.questionBankName }}
                        </span>
                      </div>
                    </div>
                    <span *ngIf="isInQuiz(q.questionId); else pickBtn" class="chip chip-sm chip-success flex-shrink-0">
                      <i class="bi bi-check-lg" aria-hidden="true"></i>Đã có
                    </span>
                    <ng-template #pickBtn>
                      <button type="button" class="btn btn-sm btn-outline-primary flex-shrink-0" (click)="reuseQuestion(q.questionId)" [disabled]="isSubmitting"
                              [attr.aria-label]="'Chọn câu hỏi: ' + shortText(q.content)">
                        <span *ngIf="reusingId === q.questionId" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                        <i *ngIf="reusingId !== q.questionId" class="bi bi-plus-lg me-1" aria-hidden="true"></i>Chọn
                      </button>
                    </ng-template>
                  </li>
                </ul>
              </ng-template>
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
      .min-w-0 { min-width: 0; }
      .req { color: var(--danger); }
      .hint { color: var(--text-muted); font-size: 0.82rem; }

      /* Danh sách câu hỏi */
      .question-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
      .question-card {
        display: flex; align-items: flex-start; gap: 0.9rem;
        padding: 1rem 1.1rem;
        box-shadow: var(--shadow-sm);
        transition: border-color var(--transition), box-shadow var(--transition);
      }
      .question-card:hover { border-color: var(--brand-200); box-shadow: var(--shadow-md); }
      .q-number {
        width: 2.25rem; height: 2.25rem; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 12px;
        background: var(--brand-soft); color: var(--brand-soft-text);
        font-family: var(--font-display); font-weight: 800;
      }
      .q-content { margin: 0; font-weight: 600; color: var(--text); word-break: break-word; white-space: pre-line; }
      .q-answers { list-style: none; padding: 0; margin: 0.65rem 0 0; display: grid; gap: 0.3rem; }
      .q-answers li {
        display: flex; align-items: flex-start; gap: 0.5rem;
        padding: 0.35rem 0.65rem; border-radius: var(--radius-sm);
        font-size: 0.88rem; color: var(--text-2); background: var(--surface-2);
        word-break: break-word;
      }
      .q-answers li i { margin-top: 0.15rem; color: var(--text-muted); }
      .q-answers li.correct { background: var(--success-soft); color: var(--success); font-weight: 600; }
      .q-answers li.correct i { color: var(--success); }
      .q-actions { display: flex; gap: 0.3rem; flex-shrink: 0; }
      .question-card.editing { border-color: var(--brand-300); box-shadow: var(--shadow-md); }
      .edit-title { font-size: 1rem; font-weight: 800; margin: 0.35rem 0 1rem; }
      /* Câu chỉ 1 đáp án đúng: ô đánh dấu hình tròn (như radio) */
      .form-check-input.as-radio { border-radius: 50%; }
      .btn-sm-icon { width: 2rem; height: 2rem; font-size: 0.85rem; }
      @media (max-width: 575.98px) {
        .question-card { flex-wrap: wrap; }
        .q-actions { width: 100%; justify-content: flex-end; }
      }

      /* Khung thêm câu hỏi */
      .add-panel { position: sticky; top: 1.5rem; }
      @media (max-width: 991.98px) { .add-panel { position: static; } }
      .panel-card { padding: 1.25rem; box-shadow: var(--shadow-sm); }
      .nav-tabs .nav-link { display: inline-flex; align-items: center; justify-content: center; }

      fieldset { border: 0; padding: 0; margin: 0; }
      .answer-row {
        display: flex; align-items: center; gap: 0.6rem;
        padding: 0.4rem 0.45rem 0.4rem 0.75rem;
        border-radius: var(--radius-input);
        background: var(--surface-2);
        border: 1px solid transparent;
        transition: background-color var(--transition), border-color var(--transition);
      }
      .answer-row.is-correct {
        background: var(--success-soft);
        border-color: color-mix(in srgb, var(--success) 30%, transparent);
      }
      .answer-row .form-check-input:checked { background-color: var(--success); border-color: var(--success); }
      .answer-input { background: var(--surface); }
      .correct-mark { color: var(--success); display: inline-flex; flex-shrink: 0; }

      .note {
        display: flex; gap: 0.6rem; align-items: flex-start;
        padding: 0.75rem 0.9rem;
        border-radius: var(--radius-input);
        background: var(--surface-2);
        color: var(--text-2);
        font-size: 0.85rem;
      }

      /* Danh sách chọn để tái sử dụng */
      .pick-list {
        list-style: none; padding: 0.25rem; margin-bottom: 0;
        max-height: 300px; overflow-y: auto;
        display: flex; flex-direction: column; gap: 0.4rem;
      }
      .pick-item {
        display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        background: var(--surface);
        transition: border-color var(--transition), background-color var(--transition);
      }
      .pick-item:hover { border-color: var(--brand-200); background: var(--brand-50); }
      .pick-title { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.3rem; }
      .chip-sm { font-size: 0.72rem; padding: 0.15rem 0.55rem; }
      .bank-chip { max-width: 160px; display: inline-block; }
    `
  ]
})
export class QuizQuestionsComponent implements OnInit, OnDestroy {
  private dialog = inject(DialogService);
  quiz: QuizDetail | null = null;
  isLoading = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  loadError: string | null = null;
  fieldErrors: { bank: string | null; content: string | null } = { bank: null, content: null };

  // Trạng thái bận cho từng thao tác
  isReordering = false;
  movingId: number | null = null;
  movingDir = 0;
  removingId: number | null = null;

  // Sửa từng câu hỏi trong danh sách (PUT question-banks/questions/{id}/full)
  editingId: number | null = null;
  savingEdit = false;
  editQ: { content: string; type: QuestionType; answers: { answerId: number | null; content: string; isCorrect: boolean }[] } =
    { content: '', type: 'SingleChoice', answers: [] };
  editErrors: { content: string | null; answers: string | null } = { content: null, answers: null };
  reusingId: number | null = null;
  isSearching = false;

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

  // Tab Tái sử dụng: nguồn câu hỏi + ngân hàng công khai của mọi người
  reuseSource: 'mine' | 'public' = 'mine';
  reuseLoading = false;
  publicBanks: QuestionBankInfo[] = [];
  publicBankId: number | null = null;
  publicBankQuestions: PublicQuestion[] = [];
  publicLoaded = false;
  private publicSearch$ = new Subject<string>();
  private reuseSub?: Subscription;

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

    // Tìm câu hỏi công khai khi gõ (không cần nhấn nút)
    this.publicSearch$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => { if (this.publicBankId === null) this.searchPublic(); });
  }

  loadQuiz(): void {
    this.isLoading = true;
    this.loadError = null;
    this.quizService.getQuizDetail(this.quizId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.quiz = data; this.isLoading = false; },
      error: (err) => {
        this.isLoading = false;
        if (this.quiz) {
          this.errorMessage = extractError(err, 'Không thể tải lại quiz.');
        } else {
          this.loadError = extractError(err, 'Quiz không tồn tại hoặc bạn không có quyền chỉnh sửa.');
        }
      }
    });
  }

  loadMyBanks(): void {
    this.bankService.getMyBanks({ pageSize: 50 }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (banks) => (this.myBanks = banks.items),
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

  
  onCorrectChange(answers: any[], index: number, type: string): void {
    // Chọn 1 đáp án / Đúng–Sai: chỉ 1 đáp án đúng
    if (allowsOneSelectionOnly(type as QuestionType) && answers[index].isCorrect) {
      answers.forEach((a, i) => {
        if (i !== index) a.isCorrect = false;
      });
    }
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
    this.fieldErrors = {
      bank: null,
      content: this.newQ.content.trim() ? null : 'Hãy nhập nội dung câu hỏi.'
    };
    if (this.fieldErrors.content) {
      document.getElementById('newContent')?.focus();
      return;
    }

    const answers = this.needsAnswers()
      ? this.newQ.answers.filter((a) => a.content.trim())
      : [];

    this.isSubmitting = true;
    this.errorMessage = null;

    this.quizService
      .addQuizQuestion(this.quizId, {
        // null -> backend lưu vào bank mặc định "Câu hỏi tạo trong quiz"
        questionBankId: this.newQ.bankId ?? undefined,
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
          this.dialog.toast('Đã thêm câu hỏi vào quiz.');
          this.newQ.content = '';
          this.onTypeChange();
          this.loadQuiz();      // tải lại danh sách
          this.loadMyBanks();   // cập nhật questionCount của bank
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = extractError(err, 'Thao tác thất bại. Vui lòng thử lại.');
        }
      });
  }

  // ===== Tái sử dụng (UC17) =====

  setReuseSource(source: 'mine' | 'public'): void {
    this.reuseSource = source;
    if (source === 'public' && !this.publicLoaded && !this.reuseLoading) {
      // Lần đầu mở: tải danh sách bank công khai + các câu công khai mới nhất (không cần gõ gì)
      this.bankService.getPublicBanks({ pageSize: 50, sort: 'title' }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (page) => (this.publicBanks = page.items),
        error: () => { /* vẫn tìm được câu hỏi, chỉ thiếu bộ lọc theo bank */ }
      });
      this.searchPublic();
    }
  }

  loadBankQuestions(): void {
    this.bankQuestions = [];
    this.reuseSub?.unsubscribe();
    if (this.reuseBankId == null) return;
    this.reuseLoading = true;
    this.reuseSub = this.bankService.getBankQuestions(this.reuseBankId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (qs) => { this.bankQuestions = qs.filter((q) => q.status === 'Active'); this.reuseLoading = false; },
      error: (err) => {
        this.reuseLoading = false;
        this.errorMessage = extractError(err, 'Không tải được câu hỏi của ngân hàng câu hỏi.');
      }
    });
  }

  onPublicSearchChange(value: string): void {
    this.publicSearch = value ?? '';
    this.publicSearch$.next(this.publicSearch.trim());
  }

  /** Chọn 1 bank công khai: tải toàn bộ câu của bank đó (lọc theo từ khóa ở client); bỏ chọn: tìm trên mọi bank. */
  onPublicBankChange(): void {
    this.reuseSub?.unsubscribe();
    this.publicBankQuestions = [];
    if (this.publicBankId === null) {
      this.searchPublic();
      return;
    }
    const bank = this.publicBanks.find((b) => b.questionBankId === this.publicBankId);
    this.reuseLoading = true;
    this.reuseSub = this.bankService.getPublicBankQuestions(this.publicBankId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (qs) => {
        this.publicBankQuestions = qs.map((q) => ({ ...q, questionBankName: q.questionBankName ?? bank?.name ?? '' }));
        this.reuseLoading = false;
        this.publicLoaded = true;
      },
      error: (err) => {
        this.reuseLoading = false;
        this.errorMessage = extractError(err, 'Không tải được câu hỏi của ngân hàng câu hỏi.');
      }
    });
  }

  /** Danh sách hiển thị ở nguồn công khai */
  get publicList(): PublicQuestion[] {
    if (this.publicBankId === null) return this.publicQuestions;
    const term = this.publicSearch.trim().toLowerCase();
    return term ? this.publicBankQuestions.filter((q) => q.content.toLowerCase().includes(term)) : this.publicBankQuestions;
  }

  isInQuiz(questionId: number): boolean {
    return !!this.quiz?.questions.some((q) => q.questionId === questionId);
  }

  // UC16 – tìm câu hỏi công khai (nội dung, tên bank, người tạo); từ khóa trống = mới nhất
  searchPublic(): void {
    this.reuseSub?.unsubscribe();
    this.publicSearched = false;
    this.isSearching = true;
    this.reuseLoading = true;
    this.reuseSub = this.bankService.searchPublicQuestions(this.publicSearch).pipe(takeUntil(this.destroy$)).subscribe({
      next: (qs) => {
        this.publicQuestions = qs;
        this.publicSearched = true;
        this.publicLoaded = true;
        this.isSearching = false;
        this.reuseLoading = false;
      },
      error: (err) => {
        this.isSearching = false;
        this.reuseLoading = false;
        this.errorMessage = extractError(err, 'Tìm kiếm thất bại.');
      }
    });
  }

  // UC17 – POST { questionId }
  reuseQuestion(questionId: number): void {
    this.isSubmitting = true;
    this.reusingId = questionId;
    this.errorMessage = null;
    this.quizService.addQuizQuestion(this.quizId, { questionId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.reusingId = null;
        this.dialog.toast('Đã thêm câu hỏi vào quiz.');
        this.loadQuiz();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.reusingId = null;
        // A3 – câu hỏi đã có trong quiz, A2 – bank riêng tư... backend trả detail rõ ràng
        this.errorMessage = extractError(err, 'Thao tác thất bại. Vui lòng thử lại.');
      }
    });
  }

  // ===== Xóa & sắp xếp =====

  // UC13 – DELETE /quizzes/{quizId}/questions/{questionId}
  async removeQuestion(q: { questionId: number; content: string }, index: number): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Gỡ câu ' + (index + 1) + ' khỏi quiz?',
      message: 'Câu hỏi vẫn còn trong ngân hàng câu hỏi.',
      confirmText: 'Gỡ khỏi quiz',
      tone: 'danger',
      icon: 'bi-trash'
    });
    if (!ok) return;
    this.removingId = q.questionId;
    this.errorMessage = null;
    this.quizService.removeQuizQuestion(this.quizId, q.questionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.removingId = null;
        if (this.quiz) this.quiz.questions = this.quiz.questions.filter((x) => x.questionId !== q.questionId);
        this.dialog.toast('Đã gỡ câu hỏi khỏi quiz.');
        this.loadQuiz();
      },
      error: (err) => {
        this.removingId = null;
        this.errorMessage = extractError(err, 'Thao tác thất bại. Vui lòng thử lại.');
      }
    });
  }

  // UC13 – PUT order: gửi toàn bộ danh sách questionIds theo thứ tự mới
  move(index: number, delta: number): void {
    if (!this.quiz) return;
    const ids = this.quiz.questions.map((q) => q.questionId);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;

    [ids[index], ids[target]] = [ids[target], ids[index]]; // hoán đổi vị trí

    this.isReordering = true;
    this.movingId = ids[target];
    this.movingDir = delta;
    this.errorMessage = null;
    this.quizService.reorderQuizQuestions(this.quizId, ids).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        // Cập nhật tại chỗ rồi đồng bộ lại với máy chủ
        if (this.quiz) {
          const qs = [...this.quiz.questions];
          [qs[index], qs[target]] = [qs[target], qs[index]];
          this.quiz.questions = qs;
        }
        this.isReordering = false;
        this.movingId = null;
        this.loadQuiz();
      },
      error: (err) => {
        this.isReordering = false;
        this.movingId = null;
        this.errorMessage = extractError(err, 'Thao tác thất bại. Vui lòng thử lại.');
      }
    });
  }

  /** Icon hiển thị cạnh loại câu hỏi (chỉ để trình bày) */
  // ===== Sửa câu hỏi =====

  startEdit(q: QuestionSummary): void {
    this.editingId = q.questionId;
    this.editErrors = { content: null, answers: null };
    this.editQ = {
      content: q.content,
      type: q.questionType,
      answers: (q.answers ?? []).map((a) => ({ answerId: a.answerId, content: a.content, isCorrect: a.isCorrect }))
    };
    if (this.editNeedsAnswers() && this.editQ.answers.length === 0) this.onEditTypeChange();
    setTimeout(() => document.getElementById('editContent' + q.questionId)?.focus());
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  editNeedsAnswers(): boolean {
    return usesPredefinedAnswers(this.editQ.type);
  }

  editOneCorrectOnly(): boolean {
    return allowsOneSelectionOnly(this.editQ.type);
  }

  /** Loại có thể chọn khi sửa: 4 loại tạo được + loại hiện tại của câu (nếu là loại cũ khác). */
  editTypeOptions(q: QuestionSummary): QuestionType[] {
    const base: QuestionType[] = ['SingleChoice', 'MultipleChoice', 'TrueFalse', 'LongAnswer'];
    return base.includes(q.questionType) ? base : [...base, q.questionType];
  }

  onEditTypeChange(): void {
    this.editErrors.answers = null;
    const answers = this.editQ.answers;
    if (this.editQ.type === 'TrueFalse') {
      // Giữ id 2 đáp án đầu (nếu có) để không mất liên kết lịch sử làm bài không cần thiết
      const keepCorrectFirst = answers.length === 0 || answers[0].isCorrect || !answers[1]?.isCorrect;
      this.editQ.answers = [
        { answerId: answers[0]?.answerId ?? null, content: 'Đúng', isCorrect: keepCorrectFirst },
        { answerId: answers[1]?.answerId ?? null, content: 'Sai', isCorrect: !keepCorrectFirst }
      ];
    } else if (!this.editNeedsAnswers()) {
      this.editQ.answers = []; // câu văn bản không có đáp án định nghĩa sẵn
    } else {
      if (answers.length < 2) {
        this.editQ.answers = [...answers, ...Array.from({ length: 2 - answers.length }, () => ({ answerId: null, content: '', isCorrect: false }))];
      }
      if (this.editOneCorrectOnly()) {
        const first = this.editQ.answers.findIndex((a) => a.isCorrect);
        this.editQ.answers.forEach((a, i) => (a.isCorrect = i === first));
      }
    }
  }

  onEditCorrectChange(index: number): void {
    if (this.editOneCorrectOnly() && this.editQ.answers[index].isCorrect) {
      this.editQ.answers.forEach((a, i) => { if (i !== index) a.isCorrect = false; });
    }
  }

  saveEdit(q: QuestionSummary): void {
    const content = this.editQ.content.trim();
    const answers = this.editNeedsAnswers()
      ? this.editQ.answers.filter((a) => a.content.trim()).map((a) => ({ ...a, content: a.content.trim() }))
      : [];

    this.editErrors = {
      content: content ? null : 'Hãy nhập nội dung câu hỏi.',
      answers: !this.editNeedsAnswers() ? null
        : answers.length < 2 ? 'Cần ít nhất 2 đáp án có nội dung.'
        : !answers.some((a) => a.isCorrect) ? 'Hãy đánh dấu ít nhất 1 đáp án đúng.'
        : null
    };
    if (this.editErrors.content || this.editErrors.answers) {
      if (this.editErrors.content) document.getElementById('editContent' + q.questionId)?.focus();
      return;
    }

    this.savingEdit = true;
    this.bankService
      .replaceQuestion(q.questionId, { content, questionType: this.editQ.type, answers })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.savingEdit = false;
          this.editingId = null;
          this.dialog.toast('Đã lưu câu hỏi.');
          this.loadQuiz();
        },
        error: (err) => {
          this.savingEdit = false;
          this.errorMessage = extractError(err, 'Không lưu được câu hỏi. Vui lòng thử lại.');
        }
      });
  }

  typeIcon(type: string): string {
    const map: { [key: string]: string } = {
      MultipleChoice: 'bi-ui-checks',
      SingleChoice: 'bi-ui-radios',
      TrueFalse: 'bi-toggle-on',
      FillInTheBlanks: 'bi-input-cursor-text',
      ShortAnswer: 'bi-chat-left-text',
      LongAnswer: 'bi-text-paragraph'
    };
    return map[type] || 'bi-question-circle';
  }

  typeLabel(type: string): string {
    const map: { [key: string]: string } = {
      MultipleChoice: 'Chọn nhiều đáp án',
      SingleChoice: 'Chọn 1 đáp án',
      TrueFalse: 'Đúng / Sai',
      FillInTheBlanks: 'Điền vào chỗ trống',
      ShortAnswer: 'Trả lời ngắn',
      LongAnswer: 'Tự luận'
    };
    return map[type] || type;
  }

  /** Rút gọn nội dung để dùng trong aria-label */
  shortText(text: string, max = 60): string {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
