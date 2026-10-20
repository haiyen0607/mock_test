// Models khớp với DTO của QuizApp.Api (JSON camelCase) — xem QuizApp.Api/API_CHANGES.md.
// Mọi DateTime là chuỗi ISO-8601 UTC (hậu tố "Z").

// ===== Phân trang / trạng thái dùng chung =====

/** PagedResult<T> — mọi endpoint danh sách có phân trang. `total` = tổng số bản ghi khớp (mọi trang). */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Query phân trang/sắp xếp/tìm kiếm. page bắt đầu từ 1; pageSize mặc định 20, tối đa 50.
 * sort: 'newest' | 'oldest' | 'title' (users: 'username'). `search` chỉ áp dụng cho endpoint hỗ trợ.
 */
export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  search?: string;
}

export type QuizSort = 'newest' | 'oldest' | 'title';
export type UserSort = 'newest' | 'oldest' | 'username';

export type UserRole = 'User' | 'Administrator';
export type UserStatus = 'Active' | 'Blocked';
/** Trạng thái kiểm duyệt có thể đặt (admin). */
export type ModerationStatus = 'Active' | 'Removed';
/** Trạng thái nội dung trả về từ API ('Deleted' chỉ xuất hiện trong lịch sử bài làm). */
export type ContentStatus = 'Active' | 'Removed' | 'Deleted';

// ===== Auth (UC01, UC02, UC03) =====

export interface User {
  userId: number;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
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
  status: ContentStatus;
  /** Chỉ đếm câu hỏi Active. */
  questionCount: number;
  ownerUsername: string;
  createdAt: string;
}

/**
 * QuestionSummaryDto — câu hỏi trong chi tiết quiz.
 * `answers` (kèm isCorrect) chỉ có khi người xem là chủ quiz/Admin; người khác nhận null.
 */
export interface QuestionSummary {
  questionId: number;
  orderIndex: number;
  content: string;
  questionType: QuestionType;
  answerCount: number;
  status: ContentStatus;
  answers?: Answer[] | null;
  /** Người xem sửa được câu này (câu thuộc bank của mình). Câu tái sử dụng từ bank của người khác: false. */
  canEdit?: boolean;
}

/** QuizDetailDto */
export interface QuizDetail {
  quizId: number;
  title: string;
  description: string | null;
  duration: number;
  isPublished: boolean;
  status: ContentStatus;
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
  duration: number; // phút, chốt lúc bắt đầu
  startedAt: string;
  /** Hạn nộp (UTC). Dùng để chạy đồng hồ đếm ngược — không reset khi F5. */
  expiresAt: string;
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
  /** Phần trăm 0–100; null khi chưa có câu nào được chấm. */
  score: number | null;
  totalGradable: number;
  pendingManualReview: number;
  correctCount: number;
}

/** AnswerDto — đáp án kèm isCorrect (chủ sở hữu/Admin) */
export interface Answer {
  answerId: number;
  questionId: number;
  content: string;
  isCorrect: boolean;
}

/** @deprecated Dùng `Answer`. Giữ để tương thích. */
export type ResultAnswer = Answer;

/** ResultAnswerOptionDto — lựa chọn trong màn kết quả; isCorrect = null khi answersHidden */
export interface ResultAnswerOption {
  answerId: number;
  questionId: number;
  content: string;
  isCorrect: boolean | null;
}

/** AttemptResultAnswerDto — isCorrect = null nghĩa là chờ chấm thủ công */
export interface AttemptResultQuestion {
  questionId: number;
  content: string;
  questionType: QuestionType;
  answers: ResultAnswerOption[];
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
  /** true với lượt trial của Guest: không được hiển thị đáp án đúng. */
  answersHidden: boolean;
  correctCount: number;
  /** Số câu đã được chấm (không phải 100). */
  maxScore: number;
  /** Số câu tự luận chờ chấm thủ công. */
  pendingCount: number;
}

/** AttemptHistoryItemDto — 1 dòng "Bài đã làm" (GET /attempts/mine) */
export interface AttemptHistoryItem {
  attemptId: number;
  quizId: number;
  quizTitle: string;
  /** Quiz đã bị xóa: chỉ cho xem kết quả, không cho làm lại. */
  quizDeleted: boolean;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  correctCount: number;
  maxScore: number;
  pendingCount: number;
}

export type AttemptSort = 'newest' | 'oldest' | 'title';

// ===== Chấm thủ công & thống kê (chủ quiz / Admin) =====

/** GradingItemDto — 1 câu trả lời văn bản cần chấm */
export interface GradingItem {
  attemptAnswerId: number;
  attemptId: number;
  questionId: number;
  questionContent: string;
  questionType: QuestionType;
  responseText: string;
  username: string;
  submittedAt: string;
  /** null = chưa chấm */
  isCorrect: boolean | null;
}

/** Query cho GET /quizzes/{id}/grading (sort: 'newest' | 'oldest') */
export interface GradingQuery extends ListQuery {
  includeGraded?: boolean;
}

/** GradeResultDto — điểm của lượt làm sau khi chấm */
export interface GradeResult {
  attemptId: number;
  score: number | null;
  correctCount: number;
  maxScore: number;
  pendingCount: number;
}

/** QuestionStatDto */
export interface QuestionStat {
  questionId: number;
  content: string;
  questionType: QuestionType;
  answeredCount: number;
  correctCount: number;
  correctRatePercent: number;
}

/** QuizStatsDto — GET /quizzes/{id}/stats */
export interface QuizStats {
  attemptCount: number;
  uniqueUsers: number;
  averageScorePercent: number;
  pendingGradingCount: number;
  questions: QuestionStat[];
}

// ===== Lỗi chuẩn RFC 7807 (ProblemDetails) =====

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  traceId?: string;
  /** Mã lỗi ổn định, dùng để chọn thông báo (xem core/errors.ts) */
  code?: string;
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

/** ReplaceQuestionRequest — sửa câu hỏi + TOÀN BỘ đáp án 1 lần. answerId bỏ trống = đáp án mới; đáp án cũ không gửi lên = xoá. */
export interface ReplaceQuestionRequest {
  content: string;
  questionType: QuestionType;
  answers: (AnswerRequest & { answerId?: number | null })[];
}

/**
 * QuestionBankInfoDto — bank khi duyệt ngân hàng công khai (GET /question-banks/public) hoặc mở chi tiết (GET /question-banks/{id}).
 * canManage: người xem là chủ sở hữu/Admin (sửa được, thấy đáp án đúng).
 */
export interface QuestionBankInfo {
  questionBankId: number;
  name: string;
  description: string | null;
  isPublic: boolean;
  questionCount: number;
  ownerUsername: string;
  canManage: boolean;
  createdAt: string;
}

/** QuestionDto — câu hỏi trong bank của chủ sở hữu, CÓ lộ isCorrect */
export interface BankQuestion {
  questionId: number;
  questionBankId: number;
  content: string;
  questionType: QuestionType;
  status: ContentStatus;
  answers: Answer[];
}

/** PublicQuestionDto — kết quả tìm câu hỏi công khai (UC16), KHÔNG lộ đáp án */
export interface PublicQuestion {
  questionId: number;
  questionBankId: number;
  questionBankName: string;
  content: string;
  questionType: QuestionType;
  /** Các lựa chọn (không có isCorrect) */
  options: AnswerOption[];
}

/** QuestionAndAnswersRequest — tạo question kèm answers trong 1 lần gọi */
export interface QuestionAndAnswersRequest {
  content: string;
  questionType: QuestionType;
  answers: AnswerRequest[];
}

// ===== Quiz Questions (UC13, UC17) =====

/** AddQuizQuestionRequest — điền MỘT trong hai: questionId (tái sử dụng) HOẶC newQuestion (+ questionBankId tuỳ chọn; bỏ trống = bank mặc định "Câu hỏi tạo trong quiz") */
export interface AddQuizQuestionRequest {
  questionId?: number | null;
  questionBankId?: number | null;
  newQuestion?: QuestionAndAnswersRequest | null;
}

// ===== Admin (UC18, UC19, UC20) =====

export interface UpdateUserStatusRequest {
  status: UserStatus;
}

export interface UpdateContentStatusRequest {
  status: ModerationStatus;
}

/** AdminQuestionDto — GET /admin/questions (không phân trang, tối đa 200) */
export interface AdminQuestion {
  questionId: number;
  questionBankId: number;
  questionBankName: string;
  questionBankIsPublic: boolean;
  ownerUsername: string;
  content: string;
  questionType: QuestionType;
  status: ContentStatus;
  usedInQuizCount: number;
  createdAt: string;
  answers: Answer[];
}
