import { isAxiosError } from 'axios';

/**
 * Error codes returned by the API in ProblemDetails `code` (extensions["code"]).
 * Keep in sync with the backend ApiProblem helper.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Tên đăng nhập hoặc mật khẩu không đúng.',
  ACCOUNT_BLOCKED: 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.',
  USERNAME_TAKEN: 'Tên đăng nhập này đã có người sử dụng.',
  EMAIL_TAKEN: 'Email này đã được đăng ký.',
  NOT_OWNER: 'Bạn chỉ có thể thao tác trên nội dung của chính mình.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  QUIZ_NOT_FOUND: 'Không tìm thấy quiz. Có thể quiz đã bị xóa hoặc ẩn.',
  QUESTION_NOT_FOUND: 'Không tìm thấy câu hỏi.',
  BANK_NOT_FOUND: 'Không tìm thấy ngân hàng câu hỏi.',
  ANSWER_NOT_FOUND: 'Không tìm thấy đáp án.',
  ATTEMPT_NOT_FOUND: 'Không tìm thấy bài làm.',
  USER_NOT_FOUND: 'Không tìm thấy người dùng.',
  QUIZ_NOT_AVAILABLE: 'Quiz này hiện không mở để làm bài.',
  QUIZ_NO_QUESTIONS: 'Quiz này chưa có câu hỏi nào.',
  TRIAL_LIMIT: 'Bạn đã dùng hết lượt làm thử. Hãy đăng nhập hoặc tạo tài khoản để làm tiếp.',
  ATTEMPT_SUBMITTED: 'Bài làm này đã được nộp trước đó.',
  ATTEMPT_EXPIRED: 'Đã hết thời gian làm bài.',
  QUESTION_IN_USE: 'Câu hỏi đang được dùng trong quiz nên chưa thể xóa.',
  INVALID_STATUS: 'Trạng thái không hợp lệ.',
  INVALID_REQUEST: 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
  NOT_GRADABLE: 'Câu trả lời này không cần chấm thủ công.',
  VALIDATION_FAILED: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  NOT_FOUND: 'Không tìm thấy dữ liệu.',
  ATTEMPT_NOT_SUBMITTED: 'Bài làm này chưa được nộp nên chưa có kết quả.',
  CONCURRENCY_CONFLICT: 'Dữ liệu vừa được người khác cập nhật. Vui lòng tải lại và thử lại.',
  INTERNAL_ERROR: 'Máy chủ gặp sự cố. Vui lòng thử lại sau.'
};

const GENERIC_INVALID = 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.';

/** Best-effort translation of ASP.NET default (English) validation messages. */
function translateValidation(message: string): string {
  const m = message.trim();
  if (!m) return '';
  // Already Vietnamese (contains non-ASCII letters) → keep as is.
  if (/[^\x00-\x7F]/.test(m)) return m;
  if (/is required/i.test(m)) return 'Vui lòng nhập đầy đủ các thông tin bắt buộc.';
  if (/e-?mail/i.test(m) && /valid/i.test(m)) return 'Email không hợp lệ.';
  if (/already exists|already taken|already in use/i.test(m)) return 'Tên đăng nhập hoặc email đã tồn tại.';
  if (/minimum length/i.test(m)) return 'Một số thông tin quá ngắn.';
  if (/maximum length/i.test(m)) return 'Một số thông tin quá dài.';
  if (/must be between|out of range|range/i.test(m)) return 'Có giá trị nằm ngoài khoảng cho phép.';
  return GENERIC_INVALID;
}

/**
 * Turns any API/network error into a Vietnamese message for the UI.
 * Never exposes the raw (English) `detail` from the server.
 */
export function extractError(err: unknown, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string {
  if (!isAxiosError(err)) return fallback;

  const response = err.response;
  if (!response) {
    return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.';
  }

  const data = (response.data ?? {}) as { code?: unknown; errors?: unknown };
  const code = typeof data.code === 'string' ? data.code : undefined;

  if (code && code !== 'VALIDATION_FAILED' && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  if (data.errors && typeof data.errors === 'object') {
    const raw = Object.values(data.errors as Record<string, unknown>)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .filter((v): v is string => typeof v === 'string');
    const messages = Array.from(new Set(raw.map(translateValidation).filter(Boolean)));
    if (messages.length) return messages.join(' ');
  }
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];

  const status = response.status;
  // Login 401 without a code (should not happen) — still show the credentials message, not "session expired".
  if (status === 401 && /\/auth\/login\b/.test(err.config?.url ?? '')) return ERROR_MESSAGES['INVALID_CREDENTIALS'];
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Không tìm thấy dữ liệu.';
  if (status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
  if (status >= 500) return 'Máy chủ gặp sự cố. Vui lòng thử lại sau.';

  return fallback;
}
