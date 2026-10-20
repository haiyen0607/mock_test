# API changes: backend Part A (A1–A5)

This file is the contract for the frontend. JSON is camelCase. Enums are strings. Every `DateTime` is **UTC ISO-8601 with a `Z` suffix** (for example `"2026-09-25T15:55:14.5071301Z"`). Base URL: `http://localhost:5080`.

---

## 1. Errors

### 1.1 Shape

Every error response is RFC 7807 `application/problem+json` and carries a string `code`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Not Found",
  "status": 404,
  "detail": "Quiz 5 was not found.",
  "traceId": "00-...",
  "code": "QUIZ_NOT_FOUND"
}
```

`detail` is English and meant for debugging. **Show the user a message chosen by `code`**, and fall back to one chosen by `status`.

Validation errors (model binding and DataAnnotations, publish validation, submit validation) keep the standard `errors` dictionary and add `code: "VALIDATION_FAILED"`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": { "Title": ["Title is required."], "Duration": ["Duration must be between 1 and 600 minutes."] },
  "traceId": "00-...",
  "code": "VALIDATION_FAILED"
}
```

The keys in `errors` are PascalCase property names, as ASP.NET Core emits them (`Title`, `Answers[0].QuestionId`). The exceptions are the business validations below, which use lowercase keys:
- `questions`: publish validation (`PUT /api/quizzes/{id}/publish`)
- `answers`: submit validation (`POST /api/attempts/{id}/submit`)

### 1.2 Error codes

| code | HTTP | When |
|------|------|------|
| `VALIDATION_FAILED` | 400 | The body or query failed validation, or publish/submit validation failed (see `errors`) |
| `INVALID_REQUEST` | 400 | A generic business-rule violation, for example: missing or too-long `X-Guest-Id`, reorder list mismatch, question already in the quiz, answer rules for the question type, change not allowed while the quiz is published, admin trying to block itself or another admin |
| `INVALID_STATUS` | 400 | Admin status value is not `Active`/`Blocked` (users) or `Active`/`Removed` (quizzes/questions) |
| `QUIZ_NO_QUESTIONS` | 400 | Start or trial on a quiz with no Active question |
| `ATTEMPT_EXPIRED` | 400 | Submit after `expiresAt` plus 30 s grace |
| `ATTEMPT_NOT_SUBMITTED` | 400 | `GET /api/attempts/{id}/result` before the attempt is submitted *(added code)* |
| `NOT_GRADABLE` | 400 | Grading an answer that is not a non-empty text answer on a submitted attempt |
| `INVALID_CREDENTIALS` | 401 | Login with a wrong username/email or password |
| `UNAUTHORIZED` | 401 | Missing, invalid or expired token, or the account was blocked or deleted after the token was issued *(added code, emitted by the JWT middleware)*. The frontend should log out and redirect to login |
| `ACCOUNT_BLOCKED` | 403 | Login with correct credentials on a blocked account (**this was 401 before**) |
| `NOT_OWNER` | 403 | The caller is not the owner (or an admin) of the quiz, bank, question or answer |
| `FORBIDDEN` | 403 | Reusing a question from someone else's private bank; accessing an admin endpoint without the admin role |
| `QUIZ_NOT_AVAILABLE` | 403 | Start or trial on a quiz that is not published or was removed by an admin; submit on a quiz that was removed or deleted while the attempt was in progress |
| `TRIAL_LIMIT` | 403 | The guest (`X-Guest-Id`) has used 3 trials |
| `QUIZ_NOT_FOUND` | 404 | The quiz does not exist, **was deleted (soft delete)**, or is private and the caller is not its owner |
| `QUESTION_NOT_FOUND` | 404 | The question does not exist or was deleted; the question is not part of this quiz |
| `BANK_NOT_FOUND` | 404 | The question bank does not exist, was deleted, or is private |
| `ANSWER_NOT_FOUND` | 404 | The answer or the attempt answer (grading) does not exist |
| `ATTEMPT_NOT_FOUND` | 404 | The attempt does not exist or does not belong to the caller or guest |
| `USER_NOT_FOUND` | 404 | Admin action on a missing user |
| `NOT_FOUND` | 404 | Unknown route *(added code)* |
| `USERNAME_TAKEN` | 409 | Register with an existing username (**this was a 400 ValidationProblem before**) |
| `EMAIL_TAKEN` | 409 | Register with an existing email (**this was a 400 ValidationProblem before**) |
| `ATTEMPT_SUBMITTED` | 409 | Submitting twice (including concurrent submits); `GET content` of an attempt that is already submitted |
| `QUESTION_IN_USE` | 409 | Deleting a bank or question that a quiz still uses (**this was 400 before**) |
| `CONCURRENCY_CONFLICT` | 409 | Two grading requests changed the same attempt at the same moment. Reload and retry *(added code)* |
| `RATE_LIMITED` | 429 | Rate limit exceeded. The `Retry-After` header gives seconds (the header is CORS-exposed) |
| `INTERNAL_ERROR` | 500 | Unexpected server error *(added code)* |

### 1.3 Rate limits (per client IP, fixed window)

| Policy | Endpoints | Limit |
|--------|-----------|-------|
| `auth` | `POST /api/auth/login`, `POST /api/auth/register` | 5 requests per minute (the limit is shared by both endpoints) |
| `trial` | `POST /api/quizzes/{id}/trial` | 10 requests per hour |

---

## 2. Pagination

Paginated endpoints take these query parameters:

| param | default | notes |
|-------|---------|-------|
| `page` | `1` | Starts at 1. Values below 1 are treated as 1 |
| `pageSize` | `20` | Maximum `50`; larger values are clamped. Values below 1 become 20 |
| `sort` | `newest` | `newest` \| `oldest` \| `title`. For users: `newest` \| `oldest` \| `username`. Unknown values fall back to `newest` |

The response is `PagedResult<T>`:

```json
{ "items": [ /* T */ ], "page": 1, "pageSize": 20, "total": 57 }
```

`total` counts every matching record across all pages. A page past the end returns `items: []`.

Paginated endpoints: `GET /api/quizzes`, `GET /api/quizzes/mine`, `GET /api/question-banks/mine`, `GET /api/admin/users`, `GET /api/admin/quizzes`, `GET /api/attempts/mine`, `GET /api/quizzes/{id}/grading`.

**Breaking change:** these endpoints used to return a bare array.

---

## 3. Changed endpoints

### 3.1 Auth

**POST `/api/auth/register`** (rate limit `auth`)
- Body is unchanged: `{ "username": string(3..100), "email": string(email, ≤255), "password": string(6..100) }`.
- `201` returns `{ "token": string, "user": UserDto }`. Use this token to log the user in straight away.
- A duplicate returns **409** `USERNAME_TAKEN` or `EMAIL_TAKEN`. The username is checked first.

**POST `/api/auth/login`** (rate limit `auth`)
- Body: `{ "usernameOrEmail": string(≤255), "password": string(≤100) }`. Matching is case-insensitive.
- `200` returns `{ token, user }`. Wrong credentials return `401 INVALID_CREDENTIALS`. A blocked account returns **`403 ACCOUNT_BLOCKED`**.

`UserDto` is `{ "userId": 1, "username": "admin", "email": "...", "role": "Administrator" | "User", "status": "Active" | "Blocked", "createdAt": "…Z" }`

### 3.2 Quizzes

`QuizListItemDto` has the same shape as before. **`questionCount` now counts only Active questions.**
```json
{ "quizId": 1, "title": "…", "description": "…" | null, "duration": 30, "isPublished": true,
  "status": "Active" | "Removed", "questionCount": 4, "ownerUsername": "hoanganh", "createdAt": "…Z" }
```

| Endpoint | Change |
|----------|--------|
| `GET /api/quizzes?search=&page=&pageSize=&sort=` | Returns `PagedResult<QuizListItemDto>`. Lists only published, Active quizzes that have at least 1 Active question |
| `GET /api/quizzes/mine?page=&pageSize=&sort=` | Returns `PagedResult<QuizListItemDto>`. Deleted quizzes are excluded |
| `GET /api/quizzes/{id}` | Shape unchanged. A deleted quiz returns `404 QUIZ_NOT_FOUND`, even for its owner |
| `PUT /api/quizzes/{id}`, `PUT /api/quizzes/{id}/publish` | Shape unchanged. A deleted quiz returns 404. Publish validation returns 400 `VALIDATION_FAILED` with `errors.questions` |
| `DELETE /api/quizzes/{id}` | Still `204`, but it is now a **soft delete**: `status = Deleted`, `isPublished = false`, and question links are removed. Attempts, history and results stay readable |
| `/api/quizzes/{id}/questions…` (add, reorder, remove) | Shapes unchanged. A deleted quiz returns 404. **Add (create new):** `questionBankId` is now optional — when omitted, the question is saved into the quiz owner's private default bank "Câu hỏi tạo trong quiz" (created on first use) |

`status` can only be `"Deleted"` in the history (`quizDeleted: true`). Deleted quizzes never appear in any list.

### 3.3 Question banks

- `GET /api/question-banks/mine?page=&pageSize=&sort=` returns `PagedResult<QuestionBankDto>`, where `sort=title` sorts by name.
  `QuestionBankDto` is `{ "questionBankId": 1, "name": "…", "description": "…" | null, "isPublic": true, "questionCount": 4, "createdAt": "…Z" }`
- Deleting a bank or question that a quiz still uses now returns **409 `QUESTION_IN_USE`** (it was 400).

### 3.4 Admin

- `GET /api/admin/users?search=&page=&pageSize=&sort=newest|oldest|username` returns `PagedResult<UserDto>`. The default sort is now `newest`; it used to be by id.
- `GET /api/admin/quizzes?search=&status=&page=&pageSize=&sort=` returns `PagedResult<QuizListItemDto>`, with Active and Removed quizzes (deleted quizzes are excluded). Optional `status` = `Active` or `Removed` filters by moderation status; any other value returns 400 `INVALID_STATUS`.
- `PUT /api/admin/quizzes/{id}/status` returns `QuizListItemDto`. A deleted quiz returns 404.
- `PUT /api/admin/questions/{id}/status` returns **`QuestionDto`**: `{ questionId, questionBankId, content, questionType, status, answers: AnswerDto[] }`. This is **not** `AdminQuestionDto`, so fix the frontend type.
- `GET /api/admin/questions?search=&status=` is unchanged (not paginated; returns at most 200 items as `AdminQuestionDto[]`).
- An invalid status value returns `400 INVALID_STATUS`.

### 3.5 Taking a quiz

**POST `/api/quizzes/{id}/trial`** (guest; header `X-Guest-Id` required, ≤ 100 characters; rate limit `trial`)
**POST `/api/quizzes/{id}/attempts`** (authenticated)

Both return `201 AttemptContentDto`. **The new fields are `startedAt` and `expiresAt`.** `duration` is the duration fixed when the attempt started.
```json
{
  "attemptId": 12, "quizId": 1, "title": "Angular Fundamentals Quiz", "duration": 30,
  "startedAt": "2026-09-25T15:55:14.5071301Z",
  "expiresAt": "2026-09-25T16:25:14.5071301Z",
  "questions": [
    { "questionId": 1, "content": "…", "questionType": "SingleChoice",
      "options": [ { "answerId": 1, "content": "@Component" } ] }
  ]
}
```
Errors: `404 QUIZ_NOT_FOUND` (missing or deleted), `403 QUIZ_NOT_AVAILABLE` (not published or removed), `400 QUIZ_NO_QUESTIONS`, `403 TRIAL_LIMIT`, `400 INVALID_REQUEST` (bad `X-Guest-Id`), `429 RATE_LIMITED`.

**GET `/api/attempts/{id}/content`** (owner; a guest sends `X-Guest-Id`)
- Returns `200 AttemptContentDto` (same shape as above). Drive the countdown from `expiresAt` so a page reload does not reset the timer.
- **New:** an attempt that is already submitted returns `409 ATTEMPT_SUBMITTED`. Redirect to the result page.

**POST `/api/attempts/{id}/submit`**
- Body: `{ "answers": [ { "questionId": 1, "answerId": 3 }, { "questionId": 4, "responseText": "…" } ] }`
  - **`answers: []` is now allowed**; the attempt scores 0. The list holds at most 200 items.
  - MultipleChoice sends one item per selected option.
- `200` returns:
  ```json
  { "attemptId": 12, "quizId": 1, "submittedAt": "…Z", "score": 33, "totalGradable": 3, "pendingManualReview": 1, "correctCount": 1 }
  ```
  `score` is a **percentage from 0 to 100** (or `null` when nothing has been graded yet). `totalGradable` is the number of graded questions. `correctCount` is **new**.
- Errors: `409 ATTEMPT_SUBMITTED` (was 400; this includes a concurrent double submit), `400 ATTEMPT_EXPIRED`, `403 QUIZ_NOT_AVAILABLE` (removed or deleted mid-attempt; was 400), `400 VALIDATION_FAILED` (`errors.answers`), `404 ATTEMPT_NOT_FOUND`.

**GET `/api/attempts/{id}/result`**
```json
{
  "attemptId": 12, "quizId": 1, "title": "…", "startedAt": "…Z", "submittedAt": "…Z",
  "score": 50,
  "questions": [
    {
      "questionId": 1, "content": "…", "questionType": "SingleChoice",
      "answers": [ { "answerId": 1, "questionId": 1, "content": "@Component", "isCorrect": true | false | null } ],
      "selectedAnswerIds": [1],
      "responseText": null,
      "isCorrect": true
    }
  ],
  "answersHidden": false,
  "correctCount": 2,
  "maxScore": 4,
  "pendingCount": 0
}
```
- **New fields:** `answersHidden`, `correctCount`, `maxScore`, `pendingCount`.
- `answers[].isCorrect` is now **`boolean | null`**. It is `null` for every option when `answersHidden = true`.
- `answersHidden = true` on guest trial attempts. The frontend must not show which option is correct; it should show a prompt such as "Đăng ký để xem đáp án". The per-question `isCorrect` (whether the user's answer was right), `score` and the counts are still returned.
- The per-question `isCorrect` is `true` or `false`. It is `null` for a text answer awaiting grading or left empty.
- The questions are the ones that were in the attempt at submit time, even if the quiz was edited or deleted since. Questions an admin later marked `Removed` are hidden.
- Errors: `404 ATTEMPT_NOT_FOUND`, `400 ATTEMPT_NOT_SUBMITTED`.

### Scoring semantics (all endpoints)

- `maxScore` is the number of graded questions: every choice question (an unanswered one counts as wrong) plus every text answer that has been graded.
- `correctCount` is the number of those graded questions answered correctly.
- `pendingCount` is the number of non-empty text answers waiting for manual grading. Empty text answers are not counted.
- `score` is `round(correctCount * 100 / maxScore)`, or `null` when `maxScore` is 0. It is recomputed after each grading.

---

## 4. New endpoints

### 4.1 GET `/api/attempts/mine` [auth]: "Bài đã làm" (attempt history)

- Query: `page`, `pageSize`, `sort` = `newest` (by submittedAt, the default) \| `oldest` \| `title` (quiz title).
- Returns only the caller's **submitted**, non-trial attempts. Attempts on deleted quizzes are included.
- `200` returns `PagedResult<AttemptHistoryItemDto>`:
```json
{
  "items": [
    { "attemptId": 12, "quizId": 1, "quizTitle": "Angular Fundamentals Quiz", "quizDeleted": false,
      "startedAt": "…Z", "submittedAt": "…Z",
      "score": 33, "correctCount": 1, "maxScore": 3, "pendingCount": 1 }
  ],
  "page": 1, "pageSize": 20, "total": 1
}
```
- `score` is a percentage (`null` if nothing has been graded yet). `correctCount` is an extra field beyond the plan.
- When `quizDeleted` is true, show the result link only (`/api/attempts/{id}/result` still works). Do not show a "retake" button.

### 4.2 GET `/api/quizzes/{quizId}/grading` [auth, quiz owner or admin]

- Query: `page`, `pageSize`, `sort` = `newest` (default) \| `oldest` (by submittedAt), and `includeGraded` (bool, default `false`).
- Returns text answers (FillInTheBlanks, ShortAnswer, LongAnswer) that are non-empty, on **submitted, non-trial** attempts. By default only ungraded answers (`isCorrect == null`) are included; `includeGraded=true` returns graded ones as well, for re-grading.
- `200` returns `PagedResult<GradingItemDto>`:
```json
{
  "items": [
    { "attemptAnswerId": 4, "attemptId": 12, "questionId": 4,
      "questionContent": "Explain the difference…", "questionType": "LongAnswer",
      "responseText": "my essay", "username": "hoanganh", "submittedAt": "…Z",
      "isCorrect": null }
  ],
  "page": 1, "pageSize": 20, "total": 1
}
```
- Errors: `404 QUIZ_NOT_FOUND` (missing or deleted), `403 NOT_OWNER`.

### 4.3 PUT `/api/attempt-answers/{attemptAnswerId}/grade` [auth, owner or admin of the attempt's quiz]

- Body: `{ "isCorrect": true }`. The field is required and must be a boolean.
- An answer that has already been graded can be graded again.
- `200` returns:
```json
{ "attemptId": 12, "score": 50, "correctCount": 2, "maxScore": 4, "pendingCount": 0 }
```
- Errors: `404 ANSWER_NOT_FOUND`, `403 NOT_OWNER`, `400 NOT_GRADABLE` (a choice question, an empty text answer, or an attempt that is not submitted), `400 VALIDATION_FAILED` (missing `isCorrect`), `409 CONCURRENCY_CONFLICT`.

### 4.4 GET `/api/quizzes/{quizId}/stats` [auth, quiz owner or admin]

Stats count only submitted, non-trial attempts.
```json
{
  "attemptCount": 10,
  "uniqueUsers": 7,
  "averageScorePercent": 62.5,
  "pendingGradingCount": 3,
  "questions": [
    { "questionId": 1, "content": "…", "questionType": "SingleChoice",
      "answeredCount": 9, "correctCount": 6, "correctRatePercent": 66.7 }
  ]
}
```
- `averageScorePercent` is the mean `score` of attempts that have a score, rounded to 1 decimal. It is `0` when there are no such attempts.
- `pendingGradingCount` is the sum of `pendingCount` over attempts. Use it for the "chờ chấm" badge.
- For each question:
  - `answeredCount`: attempts that gave a non-empty answer.
  - `correctCount`: attempts that got the question right.
  - `correctRatePercent`: `correctCount` divided by the attempts where the question was graded (choice questions always; text questions once graded), times 100, rounded to 1 decimal. It is `0` when no attempt was graded on the question.
- Question order: the quiz's current order first, then questions that were removed from the quiz but still appear in attempt history.
- Errors: `404 QUIZ_NOT_FOUND`, `403 NOT_OWNER`.

---

## 5. Differences from the coordinator's contract

1. **Error codes added:** `UNAUTHORIZED` (401), `NOT_FOUND` (404 route), `ATTEMPT_NOT_SUBMITTED` (400), `CONCURRENCY_CONFLICT` (409) and `INTERNAL_ERROR` (500).
2. `QUIZ_NOT_AVAILABLE` is always **403**.
3. **Fields added** beyond the plan: `correctCount` (history, grade result, submit result, attempt result), `maxScore` and `pendingCount` (attempt result), `isCorrect` and the `includeGraded` query (grading list).
4. `score` stays a **percentage** everywhere, to match the existing submit and result endpoints. `maxScore` is the number of graded questions, not "100".
5. **The grading list and stats exclude guest trial attempts.** Guests only ever see their automatic score.
6. `GET /api/attempts/{id}/content` returns `409 ATTEMPT_SUBMITTED` for attempts that are already submitted.

## Later additions

### Edit a question together with all of its answers
`PUT /api/question-banks/questions/{questionId}/full` (owner of the question's bank, or admin). Returns `QuestionDto`.

```json
{
  "content": "…",
  "questionType": "SingleChoice",
  "answers": [
    { "answerId": 10, "content": "B", "isCorrect": true },
    { "answerId": null, "content": "C", "isCorrect": false }
  ]
}
```

- An entry with an `answerId` updates that answer. An entry with a null `answerId` creates a new answer. Any existing answer left out of the list is deleted; past attempts that selected it lose the reference, as with `DELETE answers/{id}`.
- Type rules are checked against the final state in one transaction. For example, changing the single correct answer from A to B works in one call.
- The call fails with 400 `INVALID_REQUEST` when an `answerId` does not belong to the question or appears twice, or when a type rule is broken. It also fails when the question is used in a published quiz and would no longer be playable. A missing question returns 404 `QUESTION_NOT_FOUND`; a caller who does not own it gets 403 `NOT_OWNER`.

### `canEdit` on quiz questions
`QuestionSummaryDto` in `GET /api/quizzes/{id}` has a new `canEdit` (bool) field. It is true only when the viewer owns the quiz (or is an admin) and also manages the bank that contains the question. Questions reused from another user's public bank are `false`.

### Browse public question banks
- `GET /api/question-banks/public?search=&page=&pageSize=&sort=` (anonymous is allowed) returns `PagedResult<QuestionBankInfoDto>`. It lists the public, non-deleted banks of every user, including the caller's own. `search` matches the bank name or the owner's username, and `sort` is `newest`, `oldest` or `title`.
- `GET /api/question-banks/{bankId}` returns `QuestionBankInfoDto`. The owner or an admin can open any of their banks; everyone else can open public banks only. Another user's private bank returns 404 `BANK_NOT_FOUND`.
- `QuestionBankInfoDto` = `{ questionBankId, name, description, isPublic, questionCount, ownerUsername, canManage, createdAt }`. `questionCount` counts only questions the viewer can see. `canManage` is true when the viewer is the owner or an admin.
- `GET /api/question-banks/{bankId}/questions` is unchanged: non-owners still get `PublicQuestionDto[]`, which never includes the correct answers.
- `GET /api/question-banks/public-questions?search=` now matches the question content, **the bank name, or the bank owner's username**. With an empty search it still returns the 100 newest public questions.
