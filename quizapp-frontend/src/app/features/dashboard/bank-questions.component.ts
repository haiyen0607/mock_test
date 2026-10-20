// UC15 – Quản lý câu hỏi bên trong một ngân hàng câu hỏi
// Tạo câu hỏi kèm đáp án, sửa nội dung/loại, xóa; thêm/sửa/xóa từng đáp án

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuestionBankService } from '../../core/services/question-bank.service';
import {
  Answer, BankQuestion, QuestionType, AnswerRequest, usesPredefinedAnswers, QuestionBankInfo, PublicQuestion
} from '../../core/models';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { isAxiosError } from 'axios';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DialogService } from '../../core/services/dialog.service';
import { extractError } from '../../core/errors';

const TYPE_LABELS: Record<string, string> = {
  SingleChoice: 'Chọn 1 đáp án',
  MultipleChoice: 'Chọn nhiều đáp án',
  TrueFalse: 'Đúng / Sai',
  FillInTheBlanks: 'Điền vào chỗ trống',
  ShortAnswer: 'Trả lời ngắn',
  LongAnswer: 'Tự luận'
};

/** Loại câu hỏi có thể tạo từ trang này */
const CREATABLE_TYPES: QuestionType[] = ['SingleChoice', 'MultipleChoice', 'TrueFalse', 'LongAnswer'];

@Component({
  selector: 'app-bank-questions',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, EmptyStateComponent, SkeletonComponent],
  template: `
<div class="page-container-narrow animate-fade-up">
  <a routerLink="/dashboard/question-banks" [queryParams]="readOnly ? { tab: 'public' } : null" class="back-link">
    <i class="bi bi-arrow-left" aria-hidden="true"></i> Ngân hàng câu hỏi
  </a>

  <!-- Không tìm thấy ngân hàng (không tồn tại hoặc là ngân hàng riêng tư của người khác) -->
  <div *ngIf="bankNotFound" class="surface">
    <app-empty-state tone="neutral" icon="bi-archive" title="Không tìm thấy ngân hàng câu hỏi"
                     message="Ngân hàng này không tồn tại, đã bị xóa hoặc không được chia sẻ công khai.">
      <a class="btn btn-light" routerLink="/dashboard/question-banks">Về ngân hàng câu hỏi</a>
    </app-empty-state>
  </div>

  <!-- Lỗi tải thông tin ngân hàng -->
  <div *ngIf="!bankNotFound && !bankLoading && bankError" class="surface">
    <app-empty-state tone="danger" icon="bi-wifi-off" title="Không tải được ngân hàng câu hỏi" [message]="bankError">
      <button type="button" class="btn btn-primary" (click)="loadBank()">
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
      </button>
      <a class="btn btn-light" routerLink="/dashboard/question-banks">Về ngân hàng câu hỏi</a>
    </app-empty-state>
  </div>

  <ng-container *ngIf="!bankNotFound && !bankError">
  <!-- Bank header -->
  <header class="surface bank-head mb-4">
    <span class="icon-tile" aria-hidden="true"><i class="bi bi-archive"></i></span>
    <div class="flex-grow-1 min-w-0">
      <h1 class="bank-title">{{ bankName || ('Ngân hàng #' + bankId) }}</h1>
      <p *ngIf="bank?.description" class="bank-desc">{{ bank?.description }}</p>
      <div class="d-flex flex-wrap gap-2 mt-2" *ngIf="bank">
        <span class="chip" [ngClass]="bank.isPublic ? 'chip-success' : ''">
          <i class="bi" [ngClass]="bank.isPublic ? 'bi-globe2' : 'bi-lock'" aria-hidden="true"></i>{{ bank.isPublic ? 'Công khai' : 'Riêng tư' }}
        </span>
        <span class="chip chip-brand tabular">
          <i class="bi bi-question-circle" aria-hidden="true"></i>{{ questionCount }} câu hỏi
        </span>
        <span class="chip owner-chip"><i class="bi bi-person" aria-hidden="true"></i>Tạo bởi {{ bank.ownerUsername }}</span>
      </div>
    </div>
    <button type="button" class="btn btn-primary btn-sm" (click)="focusCompose()" *ngIf="bank?.canManage && !loadError">
      <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Thêm câu hỏi
    </button>
  </header>

  <!-- Đang tải thông tin ngân hàng -->
  <app-skeleton *ngIf="bankLoading && !bank" variant="list" [count]="3"></app-skeleton>

  <!-- ===== Chế độ chỉ xem: ngân hàng công khai của người khác ===== -->
  <ng-container *ngIf="readOnly && bank">
    <div class="alert alert-info mb-4" role="note">
      <i class="bi bi-info-circle" aria-hidden="true"></i>
      <div class="flex-grow-1">
        Đây là ngân hàng công khai của {{ bank.ownerUsername }}. Bạn chỉ xem được câu hỏi; đáp án đúng được ẩn.
        Để dùng câu hỏi, vào trang soạn câu hỏi của quiz và chọn tab Tái sử dụng.
      </div>
    </div>

    <div *ngIf="!isLoading && loadError" class="surface">
      <app-empty-state tone="danger" icon="bi-wifi-off" title="Không tải được câu hỏi" [message]="loadError">
        <button type="button" class="btn btn-primary" (click)="loadQuestions()">
          <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
        </button>
      </app-empty-state>
    </div>

    <ng-container *ngIf="!loadError">
      <h2 class="section-title">Danh sách câu hỏi</h2>
      <app-skeleton *ngIf="isLoading && publicQuestions.length === 0" variant="list" [count]="3"></app-skeleton>

      <div *ngIf="publicQuestions.length > 0" class="d-flex flex-column gap-3 stagger">
        <article *ngFor="let q of publicQuestions; let i = index" class="surface q-card">
          <div class="d-flex align-items-start gap-3">
            <span class="q-num tabular" aria-hidden="true">{{ i + 1 }}</span>
            <div class="flex-grow-1 min-w-0">
              <h3 class="q-content"><span class="visually-hidden">Câu {{ i + 1 }}. </span>{{ q.content }}</h3>
              <span class="chip chip-brand">{{ typeLabel(q.questionType) }}</span>
            </div>
          </div>
          <div *ngIf="q.options.length > 0" class="answers">
            <ul class="row g-2 list-unstyled mb-0" [attr.aria-label]="'Các lựa chọn của câu ' + (i + 1)">
              <li *ngFor="let o of q.options" class="col-md-6">
                <div class="answer-view">
                  <span class="answer-mark" aria-hidden="true"></span>
                  <span class="flex-grow-1 answer-text">{{ o.content }}</span>
                </div>
              </li>
            </ul>
          </div>
        </article>
      </div>

      <div *ngIf="!isLoading && publicQuestions.length === 0" class="surface">
        <app-empty-state tone="neutral" icon="bi-inbox" title="Ngân hàng câu hỏi trống"
                         message="Ngân hàng này chưa có câu hỏi nào."></app-empty-state>
      </div>
    </ng-container>
  </ng-container>

  <!-- ===== Chế độ chủ sở hữu ===== -->
  <ng-container *ngIf="bank?.canManage">
  <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible mb-4" role="alert">
    <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
    <div class="flex-grow-1">{{ errorMessage }}</div>
    <button type="button" class="btn-close" (click)="errorMessage = null" aria-label="Đóng"></button>
  </div>

  <!-- Lỗi tải: khác với ngân hàng trống -->
  <div *ngIf="!isLoading && loadError" class="surface">
    <app-empty-state tone="danger" icon="bi-wifi-off" title="Không tải được câu hỏi" [message]="loadError">
      <button type="button" class="btn btn-primary" (click)="loadQuestions()">
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Thử lại
      </button>
      <a class="btn btn-light" routerLink="/dashboard/question-banks">Về ngân hàng câu hỏi</a>
    </app-empty-state>
  </div>

  <ng-container *ngIf="!loadError">
  <!-- Form tạo câu hỏi mới -->
  <section id="new-question" class="surface compose mb-5" aria-labelledby="compose-title">
    <h2 id="compose-title" class="section-title">Tạo câu hỏi mới</h2>

    <div class="row g-3 mb-3">
      <div class="col-md-8">
        <label class="form-label" for="newContent">
          Nội dung câu hỏi <span class="text-danger" aria-hidden="true">*</span><span class="visually-hidden">(bắt buộc)</span>
        </label>
        <textarea id="newContent" class="form-control" rows="3" [(ngModel)]="newQ.content"
                  (ngModelChange)="contentError = null"
                  [class.is-invalid]="contentError" [attr.aria-invalid]="contentError ? true : null"
                  [attr.aria-describedby]="contentError ? 'newContentError' : null"></textarea>
        <div *ngIf="contentError" id="newContentError" class="invalid-feedback d-block">{{ contentError }}</div>
      </div>
      <div class="col-md-4">
        <label class="form-label" for="newType">Loại câu hỏi</label>
        <select id="newType" class="form-select" [(ngModel)]="newQ.type" (ngModelChange)="onTypeChange()">
          <option *ngFor="let t of creatableTypes" [value]="t">{{ typeLabel(t) }}{{ t === 'LongAnswer' ? ' (chấm tay)' : '' }}</option>
        </select>
      </div>
    </div>

    <fieldset *ngIf="needsAnswers()" class="answers-box mb-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <legend class="form-label m-0">Các đáp án</legend>
        <span class="form-text m-0"><i class="bi bi-check2-circle me-1" aria-hidden="true"></i>Đánh dấu đáp án đúng</span>
      </div>

      <div class="d-flex flex-column gap-2 mb-3">
        <div *ngFor="let a of newQ.answers; let i = index" class="answer-row" [class.is-correct]="a.isCorrect">
          <input class="form-check-input m-0" type="checkbox" [class.as-radio]="newQ.type !== 'MultipleChoice'"
                 [(ngModel)]="a.isCorrect" (ngModelChange)="onCorrectChange(newQ.answers, i, newQ.type)"
                 [attr.aria-label]="'Đáp án ' + (i + 1) + ' là đáp án đúng'" />
          <input type="text" class="form-control form-control-sm" [(ngModel)]="a.content"
                 [attr.aria-label]="'Nội dung đáp án ' + (i + 1)" [placeholder]="'Đáp án ' + (i + 1)" />
          <button type="button" class="btn btn-light btn-icon btn-sm" (click)="newQ.answers.splice(i, 1)"
                  [disabled]="newQ.type === 'TrueFalse'" title="Xóa đáp án"
                  [attr.aria-label]="'Xóa đáp án ' + (i + 1) + (a.content.trim() ? ': ' + shortText(a.content) : '')">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <button type="button" class="btn btn-light btn-sm" (click)="newQ.answers.push({ content: '', isCorrect: false })"
              [disabled]="newQ.type === 'TrueFalse'">
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Thêm đáp án
      </button>
    </fieldset>

    <div class="d-flex justify-content-end pt-3 compose-footer">
      <button type="button" class="btn btn-primary" (click)="createQuestion()" [disabled]="isSaving">
        <span *ngIf="isSaving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
        {{ isSaving ? 'Đang tạo…' : 'Lưu câu hỏi' }}
      </button>
    </div>
  </section>

  <!-- Danh sách câu hỏi -->
  <h2 class="section-title">Danh sách câu hỏi</h2>

  <app-skeleton *ngIf="isLoading && questions.length === 0" variant="list" [count]="3"></app-skeleton>

  <div *ngIf="questions.length > 0" class="d-flex flex-column gap-3 stagger">
    <article *ngFor="let q of questions; let i = index" class="surface q-card">
      <!-- Chế độ xem -->
      <div *ngIf="editingQuestionId !== q.questionId" class="d-flex align-items-start gap-3">
        <span class="q-num tabular" aria-hidden="true">{{ i + 1 }}</span>
        <div class="flex-grow-1 min-w-0">
          <h3 class="q-content"><span class="visually-hidden">Câu {{ i + 1 }}. </span>{{ q.content }}</h3>
          <div class="d-flex flex-wrap gap-2">
            <span class="chip chip-brand">{{ typeLabel(q.questionType) }}</span>
            <span class="chip" [ngClass]="q.status === 'Active' ? 'chip-success' : 'chip-danger'">
              {{ q.status === 'Active' ? 'Hoạt động' : 'Bị gỡ' }}
            </span>
          </div>
        </div>
        <div class="d-flex gap-1 flex-shrink-0">
          <button type="button" class="btn btn-light btn-icon" (click)="startEditQuestion(q)"
                  [disabled]="deletingQuestionId === q.questionId"
                  title="Sửa câu hỏi" [attr.aria-label]="'Sửa câu ' + (i + 1) + ': ' + shortText(q.content)">
            <i class="bi bi-pencil" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-outline-danger btn-icon" (click)="deleteQuestion(q, i)"
                  [disabled]="deletingQuestionId === q.questionId"
                  title="Xóa câu hỏi" [attr.aria-label]="'Xóa câu ' + (i + 1) + ': ' + shortText(q.content)">
            <span *ngIf="deletingQuestionId === q.questionId; else trashIcon" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <ng-template #trashIcon><i class="bi bi-trash" aria-hidden="true"></i></ng-template>
          </button>
        </div>
      </div>

      <!-- Chế độ sửa câu hỏi -->
      <div *ngIf="editingQuestionId === q.questionId" class="edit-box">
        <h3 class="q-content mb-3">Sửa câu {{ i + 1 }}</h3>
        <label class="form-label" [attr.for]="'editContent' + q.questionId">
          Nội dung câu hỏi <span class="text-danger" aria-hidden="true">*</span><span class="visually-hidden">(bắt buộc)</span>
        </label>
        <textarea [id]="'editContent' + q.questionId" class="form-control" rows="3" [(ngModel)]="editQ.content"
                  (ngModelChange)="editContentError = null"
                  [class.is-invalid]="editContentError" [attr.aria-invalid]="editContentError ? true : null"
                  [attr.aria-describedby]="editContentError ? 'editContentError' + q.questionId : null"></textarea>
        <div *ngIf="editContentError" [id]="'editContentError' + q.questionId" class="invalid-feedback d-block">{{ editContentError }}</div>
        <div class="row my-3">
          <div class="col-md-6">
            <label class="form-label" [attr.for]="'editType' + q.questionId">Loại câu hỏi</label>
            <select [id]="'editType' + q.questionId" class="form-select" [(ngModel)]="editQ.type">
              <option *ngFor="let t of editTypeOptions(q)" [value]="t">{{ typeLabel(t) }}</option>
            </select>
          </div>
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-primary btn-sm" (click)="saveEditQuestion(q)" [disabled]="savingQuestionId === q.questionId">
            <span *ngIf="savingQuestionId === q.questionId" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
            {{ savingQuestionId === q.questionId ? 'Đang lưu…' : 'Lưu thay đổi' }}
          </button>
          <button type="button" class="btn btn-light btn-sm" (click)="editingQuestionId = null" [disabled]="savingQuestionId === q.questionId">Hủy</button>
        </div>
      </div>

      <!-- Đáp án -->
      <div *ngIf="q.answers.length > 0 || usesPredefined(q.questionType)" class="answers">
        <div class="row g-2 mb-3">
          <div *ngFor="let a of q.answers" class="col-md-6">
            <!-- Sửa đáp án inline -->
            <div *ngIf="editingAnswerId === a.answerId" class="answer-row">
              <input class="form-check-input m-0" type="checkbox" [(ngModel)]="editA.isCorrect"
                     [attr.aria-label]="'Đáp án ' + shortText(a.content) + ' là đáp án đúng'" />
              <input type="text" class="form-control form-control-sm" [(ngModel)]="editA.content"
                     [attr.aria-label]="'Nội dung đáp án ' + shortText(a.content)" />
              <button type="button" class="btn btn-primary btn-icon btn-sm" (click)="saveEditAnswer(a)"
                      [disabled]="savingAnswerId === a.answerId || !editA.content.trim()"
                      title="Lưu đáp án" [attr.aria-label]="'Lưu đáp án ' + shortText(a.content)">
                <span *ngIf="savingAnswerId === a.answerId; else checkIcon" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <ng-template #checkIcon><i class="bi bi-check-lg" aria-hidden="true"></i></ng-template>
              </button>
              <button type="button" class="btn btn-light btn-icon btn-sm" (click)="editingAnswerId = null"
                      [disabled]="savingAnswerId === a.answerId"
                      title="Hủy" [attr.aria-label]="'Hủy sửa đáp án ' + shortText(a.content)">
                <i class="bi bi-x-lg" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Xem đáp án -->
            <div *ngIf="editingAnswerId !== a.answerId" class="answer-view" [class.is-correct]="a.isCorrect">
              <span class="answer-mark" aria-hidden="true"><i *ngIf="a.isCorrect" class="bi bi-check-lg"></i></span>
              <span class="flex-grow-1 answer-text">
                {{ a.content }}<span *ngIf="a.isCorrect" class="visually-hidden"> (đáp án đúng)</span>
              </span>
              <div class="answer-actions d-flex gap-1" [class.is-busy]="deletingAnswerId === a.answerId">
                <button type="button" class="btn btn-light btn-icon btn-sm" (click)="startEditAnswer(a)"
                        [disabled]="deletingAnswerId === a.answerId"
                        title="Sửa đáp án" [attr.aria-label]="'Sửa đáp án ' + shortText(a.content)">
                  <i class="bi bi-pencil" aria-hidden="true"></i>
                </button>
                <button type="button" class="btn btn-light btn-icon btn-sm" (click)="deleteAnswer(a)"
                        [disabled]="deletingAnswerId === a.answerId"
                        title="Xóa đáp án" [attr.aria-label]="'Xóa đáp án ' + shortText(a.content)">
                  <span *ngIf="deletingAnswerId === a.answerId; else xIcon" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                  <ng-template #xIcon><i class="bi bi-x-lg" aria-hidden="true"></i></ng-template>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Thêm đáp án mới -->
        <div class="answer-row add-row">
          <input class="form-check-input m-0" type="checkbox" [(ngModel)]="newAnswerCorrect[q.questionId]"
                 title="Đánh dấu là đáp án đúng" [attr.aria-label]="'Đáp án mới của câu ' + (i + 1) + ' là đáp án đúng'" />
          <input type="text" class="form-control form-control-sm" [(ngModel)]="newAnswerContent[q.questionId]"
                 (keyup.enter)="addAnswer(q)"
                 [attr.aria-label]="'Nội dung đáp án mới của câu ' + (i + 1)" placeholder="Thêm đáp án mới" />
          <button type="button" class="btn btn-light btn-sm flex-shrink-0" (click)="addAnswer(q)"
                  [disabled]="addingAnswerFor === q.questionId || !newAnswerContent[q.questionId]?.trim()"
                  [attr.aria-label]="'Thêm đáp án cho câu ' + (i + 1)">
            <span *ngIf="addingAnswerFor === q.questionId" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
            <i *ngIf="addingAnswerFor !== q.questionId" class="bi bi-plus-lg me-1" aria-hidden="true"></i>Thêm
          </button>
        </div>
      </div>
    </article>
  </div>

  <div *ngIf="!isLoading && questions.length === 0" class="surface">
    <app-empty-state icon="bi-inbox" title="Ngân hàng câu hỏi trống"
                     message="Chưa có câu hỏi nào trong ngân hàng này. Hãy tạo câu hỏi đầu tiên ở biểu mẫu phía trên.">
      <button type="button" class="btn btn-primary" (click)="focusCompose()"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Thêm câu hỏi</button>
    </app-empty-state>
  </div>
  </ng-container>
  </ng-container>
  </ng-container>
</div>
  `,
  styles: [
    `
      .min-w-0 { min-width: 0; }
      fieldset { border: 0; margin: 0; min-width: 0; }
      legend { float: none; width: auto; font-size: inherit; }

      .bank-head { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; flex-wrap: wrap; }
      .bank-title { font-size: clamp(1.3rem, 1.1rem + 0.8vw, 1.6rem); margin: 0; word-break: break-word; }
      .bank-desc { margin: 0.35rem 0 0; color: var(--text-2); font-size: 0.92rem; white-space: pre-line; word-break: break-word; }
      .owner-chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .compose { padding: 1.5rem; box-shadow: var(--shadow-sm); scroll-margin-top: 1rem; }
      .compose-footer { border-top: 1px solid var(--border); }
      .answers-box { background: var(--surface-2); border-radius: var(--radius-card); padding: 1rem; }

      .answer-row {
        display: flex; align-items: center; gap: 0.6rem;
        padding: 0.4rem 0.4rem 0.4rem 0.75rem;
        background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-input);
        transition: border-color var(--transition), background-color var(--transition);
      }
      .answer-row.is-correct { border-color: color-mix(in srgb, var(--success) 45%, transparent); }
      .answer-row .form-control { border-color: transparent; background: transparent; }
      .answer-row .form-control:hover { border-color: var(--border); }
      .answer-row .form-control:focus { border-color: var(--brand-500); background: var(--surface); }
      .answer-row .form-check-input { width: 1.15rem; height: 1.15rem; flex-shrink: 0; cursor: pointer; }
      .form-check-input.as-radio { border-radius: 50%; }
      .answer-row .btn-icon.btn-sm, .answer-view .btn-icon.btn-sm { width: 2rem; height: 2rem; }
      .add-row { max-width: 520px; background: var(--surface-2); border-style: dashed; }

      .q-card { padding: 1.25rem; transition: box-shadow var(--transition); }
      .q-card:hover { box-shadow: var(--shadow-md); }
      .q-num {
        width: 2.25rem; height: 2.25rem; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 12px; background: var(--brand-soft); color: var(--brand-soft-text);
        font-family: var(--font-display); font-weight: 800;
      }
      .q-content { font-size: 1rem; font-weight: 700; line-height: 1.45; margin: 0.25rem 0 0.6rem; white-space: pre-line; word-break: break-word; }

      .edit-box { background: var(--surface-2); border-radius: var(--radius-card); padding: 1rem; }

      .answers { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); }
      .answer-view {
        display: flex; align-items: center; gap: 0.6rem; height: 100%;
        padding: 0.55rem 0.55rem 0.55rem 0.75rem;
        border: 1px solid var(--border); border-radius: var(--radius-input); background: var(--surface);
      }
      .answer-view.is-correct {
        background: var(--success-soft);
        border-color: color-mix(in srgb, var(--success) 35%, transparent);
      }
      .answer-view.is-correct .answer-text { color: var(--success); font-weight: 600; }
      .answer-text { color: var(--text); font-size: 0.92rem; word-break: break-word; }
      .answer-mark {
        width: 1.4rem; height: 1.4rem; flex-shrink: 0; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        border: 1.5px solid var(--border-strong); font-size: 0.8rem;
      }
      .is-correct .answer-mark { background: var(--success); border-color: var(--success); color: var(--surface); }

      /* Hành động của đáp án: hiện khi hover/focus; luôn hiện trên thiết bị cảm ứng */
      .answer-actions { opacity: 0; transition: opacity var(--transition); }
      .answer-view:hover .answer-actions,
      .answer-view:focus-within .answer-actions,
      .answer-actions.is-busy { opacity: 1; }
      @media (hover: none) { .answer-actions { opacity: 1; } }
    `
  ]
})
export class BankQuestionsComponent implements OnInit, OnDestroy {
  private dialog = inject(DialogService);
  private router = inject(Router);

  bankId!: number;
  bankName: string | null = null;
  bank: QuestionBankInfo | null = null;
  bankLoading = false;
  bankError: string | null = null;
  bankNotFound = false;
  questions: BankQuestion[] = [];
  publicQuestions: PublicQuestion[] = [];
  private bankSub?: Subscription;
  private questionsSub?: Subscription;
  isLoading = false;
  isSaving = false;
  loadError: string | null = null;
  errorMessage: string | null = null;
  contentError: string | null = null;
  editContentError: string | null = null;

  readonly creatableTypes = CREATABLE_TYPES;

  // Trạng thái bận cho từng thao tác
  savingQuestionId: number | null = null;
  deletingQuestionId: number | null = null;
  savingAnswerId: number | null = null;
  deletingAnswerId: number | null = null;
  addingAnswerFor: number | null = null;

  // Form tạo câu hỏi mới
  newQ = {
    content: '',
    type: 'SingleChoice' as QuestionType,
    answers: [
      { content: '', isCorrect: true },
      { content: '', isCorrect: false }
    ] as AnswerRequest[]
  };

  // Sửa câu hỏi
  editingQuestionId: number | null = null;
  editQ = { content: '', type: 'SingleChoice' as QuestionType };

  // Sửa đáp án
  editingAnswerId: number | null = null;
  editA = { content: '', isCorrect: false };

  // Thêm đáp án mới cho từng câu hỏi
  newAnswerContent: { [questionId: number]: string } = {};
  newAnswerCorrect: { [questionId: number]: boolean } = {};

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private bankService: QuestionBankService
  ) {
    // Tên ngân hàng được truyền qua router state từ trang danh sách (nếu có)
    const state = this.router.getCurrentNavigation()?.extras.state ?? history.state;
    if (state && typeof state['bankName'] === 'string') this.bankName = state['bankName'];
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = parseInt(params['id'], 10);
      if (this.bankId !== undefined && this.bankId !== id) this.bankName = null;
      this.bankId = id;
      this.bank = null;
      this.questions = [];
      this.publicQuestions = [];
      this.loadBank();
    });
  }

  /** Người xem không phải chủ sở hữu (ngân hàng công khai của người khác) → chỉ xem */
  get readOnly(): boolean {
    return !!this.bank && !this.bank.canManage;
  }

  /** Số câu hỏi: ưu tiên danh sách đã tải, nếu chưa có thì dùng số liệu từ thông tin ngân hàng */
  get questionCount(): number {
    if (!this.bank) return 0;
    if (this.isLoading || this.loadError) return this.bank.questionCount;
    return this.bank.canManage ? this.questions.length : this.publicQuestions.length;
  }

  // UC15/UC16 – GET /question-banks/{bankId}
  loadBank(): void {
    const id = this.bankId;
    this.bankSub?.unsubscribe();
    this.bankLoading = true;
    this.bankError = null;
    this.bankNotFound = false;
    this.bankSub = this.bankService.getBank(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (bank) => {
        if (this.bankId !== id) return;
        this.bank = bank;
        this.bankName = bank.name;
        this.bankLoading = false;
        this.loadQuestions();
      },
      error: (err) => {
        if (this.bankId !== id) return;
        this.bankLoading = false;
        if (isAxiosError(err) && err.response?.status === 404) {
          this.bankNotFound = true;
        } else {
          this.bankError = extractError(err, 'Không thể tải thông tin ngân hàng câu hỏi.');
        }
      }
    });
  }

  loadQuestions(): void {
    if (!this.bank) return;
    this.isLoading = true;
    this.loadError = null;
    this.questionsSub?.unsubscribe();

    if (!this.bank.canManage) {
      this.questionsSub = this.bankService.getPublicBankQuestions(this.bankId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => { this.publicQuestions = data; this.isLoading = false; },
        error: (err) => {
          this.isLoading = false;
          this.loadError = extractError(err, 'Không thể tải câu hỏi của ngân hàng này.');
        }
      });
      return;
    }

    this.questionsSub = this.bankService.getBankQuestions(this.bankId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.questions = data; this.isLoading = false; },
      error: (err) => {
        this.isLoading = false;
        if (this.questions.length > 0) {
          this.errorMessage = extractError(err, 'Không thể tải lại câu hỏi.');
        } else {
          this.loadError = extractError(err, 'Không thể tải câu hỏi của ngân hàng này.');
        }
      }
    });
  }

  needsAnswers(): boolean {
    return usesPredefinedAnswers(this.newQ.type);
  }

  usesPredefined(type: QuestionType): boolean {
    return usesPredefinedAnswers(type);
  }

  /** Các loại có thể chọn khi sửa — giữ cả loại hiện tại nếu nó không nằm trong danh sách tạo mới */
  editTypeOptions(q: BankQuestion): QuestionType[] {
    return CREATABLE_TYPES.includes(q.questionType) ? CREATABLE_TYPES : [...CREATABLE_TYPES, q.questionType];
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

  onCorrectChange(answers: AnswerRequest[], index: number, type: string): void {
    if (type !== 'MultipleChoice' && answers[index].isCorrect) {
      answers.forEach((a, i) => {
        if (i !== index) a.isCorrect = false;
      });
    }
  }

  // UC15 – POST /{bankId}/questions
  createQuestion(): void {
    if (!this.newQ.content.trim()) {
      this.contentError = 'Hãy nhập nội dung câu hỏi.';
      document.getElementById('newContent')?.focus();
      return;
    }
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
          this.newQ.answers = [];
          this.onTypeChange();
          this.dialog.toast('Đã tạo câu hỏi.');
          this.loadQuestions();
        },
        error: (err) => {
          this.isSaving = false;
          this.errorMessage = extractError(err, 'Tạo câu hỏi thất bại.');
        }
      });
  }

  startEditQuestion(q: BankQuestion): void {
    this.editingQuestionId = q.questionId;
    this.editContentError = null;
    this.editQ = { content: q.content, type: q.questionType };
    setTimeout(() => document.getElementById('editContent' + q.questionId)?.focus(), 0);
  }

  // UC15 – PUT /questions/{questionId}
  saveEditQuestion(q: BankQuestion): void {
    if (!this.editQ.content.trim()) {
      this.editContentError = 'Nội dung câu hỏi không được để trống.';
      return;
    }
    this.savingQuestionId = q.questionId;
    this.errorMessage = null;
    this.bankService
      .updateQuestion(q.questionId, this.editQ.content.trim(), this.editQ.type)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.savingQuestionId = null;
          this.editingQuestionId = null;
          this.dialog.toast('Đã lưu câu hỏi.');
          this.loadQuestions();
        },
        error: (err) => {
          this.savingQuestionId = null;
          this.errorMessage = extractError(err, 'Lưu câu hỏi thất bại.');
        }
      });
  }

  // UC15 – DELETE /questions/{questionId}
  async deleteQuestion(q: BankQuestion, index: number): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Xóa câu ' + (index + 1) + '?',
      message: 'Câu hỏi sẽ bị xóa khỏi ngân hàng câu hỏi. Không thể xóa nếu một quiz đang dùng câu hỏi này.',
      confirmText: 'Xóa',
      tone: 'danger',
      icon: 'bi-trash'
    });
    if (!ok) return;
    this.deletingQuestionId = q.questionId;
    this.errorMessage = null;
    this.bankService.deleteQuestion(q.questionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.deletingQuestionId = null;
        this.questions = this.questions.filter((x) => x.questionId !== q.questionId);
        this.dialog.toast('Đã xóa câu hỏi.');
        this.loadQuestions();
      },
      error: (err) => {
        this.deletingQuestionId = null;
        this.errorMessage = extractError(err, 'Xóa câu hỏi thất bại.');
      }
    });
  }

  startEditAnswer(a: Answer): void {
    this.editingAnswerId = a.answerId;
    this.editA = { content: a.content, isCorrect: a.isCorrect };
  }

  // UC15 – PUT /answers/{answerId}
  saveEditAnswer(a: Answer): void {
    if (!this.editA.content.trim()) return;
    this.savingAnswerId = a.answerId;
    this.errorMessage = null;
    this.bankService
      .updateAnswer(a.answerId, { content: this.editA.content.trim(), isCorrect: this.editA.isCorrect })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.savingAnswerId = null;
          this.editingAnswerId = null;
          this.dialog.toast('Đã lưu đáp án.');
          this.loadQuestions();
        },
        error: (err) => {
          this.savingAnswerId = null;
          this.errorMessage = extractError(err, 'Lưu đáp án thất bại.');
        }
      });
  }

  // UC15 – DELETE /answers/{answerId}
  async deleteAnswer(a: Answer): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Xóa đáp án "' + this.shortText(a.content) + '"?',
      message: 'Đáp án sẽ bị xóa khỏi câu hỏi. Không thể hoàn tác.',
      confirmText: 'Xóa đáp án',
      tone: 'danger',
      icon: 'bi-trash'
    });
    if (!ok) return;
    this.deletingAnswerId = a.answerId;
    this.errorMessage = null;
    this.bankService.deleteAnswer(a.answerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.deletingAnswerId = null;
        this.dialog.toast('Đã xóa đáp án.');
        this.loadQuestions();
      },
      error: (err) => {
        this.deletingAnswerId = null;
        this.errorMessage = extractError(err, 'Xóa đáp án thất bại.');
      }
    });
  }

  // UC15 – POST /questions/{questionId}/answers
  addAnswer(q: BankQuestion): void {
    const content = this.newAnswerContent[q.questionId]?.trim();
    if (!content || this.addingAnswerFor === q.questionId) return;

    this.addingAnswerFor = q.questionId;
    this.errorMessage = null;
    this.bankService
      .addAnswer(q.questionId, { content, isCorrect: !!this.newAnswerCorrect[q.questionId] })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.addingAnswerFor = null;
          this.newAnswerContent[q.questionId] = '';
          this.newAnswerCorrect[q.questionId] = false;
          this.dialog.toast('Đã thêm đáp án.');
          this.loadQuestions();
        },
        error: (err) => {
          this.addingAnswerFor = null;
          this.errorMessage = extractError(err, 'Thêm đáp án thất bại.');
        }
      });
  }

  // Presentational: đưa người dùng tới form tạo câu hỏi
  focusCompose(): void {
    document.getElementById('new-question')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('newContent')?.focus({ preventScroll: true }), 300);
  }

  typeLabel(type: string): string {
    return TYPE_LABELS[type] || type;
  }

  /** Rút gọn nội dung để dùng trong aria-label / tiêu đề hộp thoại */
  shortText(text: string, max = 60): string {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
