// Models khớp 100% với DTO của QuizApp.Api (JSON camelCase)

// ===== Auth (UC01, UC02, UC03) =====

export interface User {
  userId: number;
  username: string;
  email: string;
  role: 'User' | 'Administrator';
  status: 'Active' | 'Blocked';
  createdAt: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

/** AuthResponseDto: { token, user } */
export interface AuthResponse {
  token: string;
  user: User;
}

// ===== Quiz (UC04, UC05, UC06, UC11-14) =====

/** QuizListItemDto */
export interface QuizListItem {
  quizId: number;
  title: string;
  description: string | null;
  duration: number; // phút
  isPublished: boolean;
  status: string;
  questionCount: number;
  ownerUsername: string;
  createdAt: string;
}

/** QuestionSummaryDto — câu hỏi trong chi tiết quiz, KHÔNG lộ đáp án */
export interface QuestionSummary {
  questionId: number;
  orderIndex: number;
  content: string;
  questionType: QuestionType;
  answerCount: number;
}

/** QuizDetailDto */
export interface QuizDetail {
  quizId: number;
  title: string;
  description: string | null;
  duration: number;
  isPublished: boolean;
  status: string;
  ownerUsername: string;
  questions: QuestionSummary[];
}

export interface QuizRequest {
  title: string;
  description?: string | null;
  duration: number;
}

// ===== Question types (Enums/QuestionType.cs) =====

export type QuestionType =
  | 'MultipleChoice'   // chọn NHIỀU đáp án (checkbox)
  | 'SingleChoice'     // chọn 1 đáp án (radio)
  | 'TrueFalse'        // 2 đáp án định nghĩa sẵn (radio)
  | 'FillInTheBlanks'  // điền text
  | 'ShortAnswer'      // điền text
  | 'LongAnswer';      // điền text dài (chấm tay)

/** Loại câu hỏi trả lời bằng cách chọn Answer định nghĩa sẵn */
export function usesPredefinedAnswers(type: QuestionType): boolean {
  return type === 'MultipleChoice' || type === 'SingleChoice' || type === 'TrueFalse';
}

/** Loại câu hỏi chỉ được chọn đúng 1 đáp án */
export function allowsOneSelectionOnly(type: QuestionType): boolean {
  return type === 'SingleChoice' || type === 'TrueFalse';
}

// ===== Attempt (UC07, UC08, UC09, UC10) =====

/** AnswerOptionDto — đáp án khi đang làm bài, KHÔNG lộ isCorrect */
export interface AnswerOption {
  answerId: number;
  content: string;
}

/** AttemptQuestionDto */
export interface AttemptQuestion {
  questionId: number;
  content: string;
  questionType: QuestionType;
  options: AnswerOption[];
}

/** AttemptContentDto — trả về khi bắt đầu trial/attempt và GET content */
export interface AttemptContent {
  attemptId: number;
  quizId: number;
  title: string;
  duration: number; // phút
  questions: AttemptQuestion[];
}

/** AttemptAnswerRequest — 1 câu trả lời gửi lên khi Submit.
 *  Câu chọn nhiều đáp án: gửi NHIỀU phần tử cùng questionId, mỗi phần tử 1 answerId. */
export interface AttemptAnswerRequest {
  questionId: number;
  answerId?: number | null;
  responseText?: string | null;
}

export interface SubmitAttemptRequest {
  answers: AttemptAnswerRequest[];
}

/** SubmitAttemptResultDto — kết quả ngay sau khi nộp */
export interface SubmitAttemptResult {
  attemptId: number;
  quizId: number;
  submittedAt: string;
  score: number | null;
  totalGradable: number;
  pendingManualReview: number;
}

/** AnswerDto — lộ isCorrect (chỉ xuất hiện trong kết quả UC10) */
export interface ResultAnswer {
  answerId: number;
  questionId: number;
  content: string;
  isCorrect: boolean;
}

/** AttemptResultAnswerDto — isCorrect = null nghĩa là chờ chấm thủ công */
export interface AttemptResultQuestion {
  questionId: number;
  content: string;
  questionType: QuestionType;
  answers: ResultAnswer[];
  selectedAnswerIds: number[];
  responseText: string | null;
  isCorrect: boolean | null;
}

/** AttemptResultDto */
export interface AttemptResult {
  attemptId: number;
  quizId: number;
  title: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  questions: AttemptResultQuestion[];
}

// ===== Lỗi chuẩn RFC 7807 (ProblemDetails) =====

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: { [field: string]: string[] };
}

// ===== Question Bank (UC15, UC16, UC17) =====

/** QuestionBankDto */
export interface QuestionBank {
  questionBankId: number;
  name: string;
  description: string | null;
  isPublic: boolean;
  questionCount: number;
  createdAt: string;
}

/** QuestionBankRequest — tạo/sửa bank */
export interface QuestionBankRequest {
  name: string;
  description?: string | null;
  isPublic: boolean;
}

/** AnswerRequest — thêm/sửa 1 answer */
export interface AnswerRequest {
  content: string;
  isCorrect: boolean;
}

/** QuestionDto — câu hỏi trong bank của chủ sở hữu, CÓ lộ isCorrect */
export interface BankQuestion {
  questionId: number;
  questionBankId: number;
  content: string;
  questionType: QuestionType;
  status: string;
  answers: ResultAnswer[];
}

/** PublicQuestionDto — kết quả tìm câu hỏi công khai (UC16), KHÔNG lộ đáp án */
export interface PublicQuestion {
  questionId: number;
  questionBankId: number;
  questionBankName: string;
  content: string;
  questionType: QuestionType;
}

/** QuestionAndAnswersRequest — tạo question kèm answers trong 1 lần gọi */
export interface QuestionAndAnswersRequest {
  content: string;
  questionType: QuestionType;
  answers: AnswerRequest[];
}

// ===== Quiz Questions (UC13, UC17) =====

/** AddQuizQuestionRequest — điền MỘT trong hai: questionId (tái sử dụng) HOẶC questionBankId + newQuestion */
export interface AddQuizQuestionRequest {
  questionId?: number | null;
  questionBankId?: number | null;
  newQuestion?: QuestionAndAnswersRequest | null;
}

// ===== Admin (UC18, UC19, UC20) =====

export interface UpdateUserStatusRequest {
  status: 'Active' | 'Blocked';
}

export interface UpdateContentStatusRequest {
  status: 'Active' | 'Removed';
}
