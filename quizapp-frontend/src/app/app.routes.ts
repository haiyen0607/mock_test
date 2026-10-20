import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { leaveAttemptGuard } from './core/guards/leave-attempt.guard';

// Mỗi trang được lazy-load (tách chunk riêng) để giảm dung lượng tải ban đầu.
// `title` được AppTitleStrategy ghép thành "<title> · QuizApp".
export const routes: Routes = [
  // UC01, UC02 – Authentication
  {
    path: 'auth',
    children: [
      { path: 'login', title: 'Đăng nhập', loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
      { path: 'register', title: 'Tạo tài khoản', loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent) }
    ]
  },
  // UC04-UC10 – Quiz Discovery & Participation (Guest + User)
  {
    path: 'quiz',
    children: [
      { path: 'browse', title: 'Khám phá quiz', loadComponent: () => import('./features/quiz/browse-quizzes.component').then((m) => m.BrowseQuizzesComponent) },
      { path: 'detail/:id', title: 'Chi tiết quiz', loadComponent: () => import('./features/quiz/quiz-detail.component').then((m) => m.QuizDetailComponent) },
      { path: 'attempt/:id', title: 'Làm bài', canDeactivate: [leaveAttemptGuard], loadComponent: () => import('./features/quiz/attempt.component').then((m) => m.AttemptComponent) },
      { path: 'result/:id', title: 'Kết quả', loadComponent: () => import('./features/quiz/result.component').then((m) => m.ResultComponent) }
    ]
  },
  // UC11-UC17 – Quiz Management + Question Bank (User đã đăng nhập)
  {
    path: 'dashboard',
    canActivate: [authGuard],
    children: [
      { path: 'my-quizzes', title: 'Quiz của tôi', loadComponent: () => import('./features/dashboard/my-quizzes.component').then((m) => m.MyQuizzesComponent) },
      { path: 'quiz-create', title: 'Tạo quiz', loadComponent: () => import('./features/dashboard/quiz-create.component').then((m) => m.QuizCreateComponent) },
      { path: 'quiz-edit/:id', title: 'Sửa quiz', loadComponent: () => import('./features/dashboard/quiz-edit.component').then((m) => m.QuizEditComponent) },
      { path: 'quiz-questions/:id', title: 'Câu hỏi của quiz', loadComponent: () => import('./features/dashboard/quiz-questions.component').then((m) => m.QuizQuestionsComponent) },
      { path: 'question-banks', title: 'Ngân hàng câu hỏi', loadComponent: () => import('./features/dashboard/question-banks.component').then((m) => m.QuestionBanksComponent) },
      { path: 'question-banks/:id', title: 'Câu hỏi trong ngân hàng', loadComponent: () => import('./features/dashboard/bank-questions.component').then((m) => m.BankQuestionsComponent) },
      { path: 'history', title: 'Bài đã làm', loadComponent: () => import('./features/dashboard/attempt-history.component').then((m) => m.AttemptHistoryComponent) },
      { path: 'quiz-grading/:id', title: 'Chấm bài', loadComponent: () => import('./features/dashboard/quiz-grading.component').then((m) => m.QuizGradingComponent) },
      { path: 'quiz-stats/:id', title: 'Thống kê quiz', loadComponent: () => import('./features/dashboard/quiz-stats.component').then((m) => m.QuizStatsComponent) }
    ]
  },
  // UC18-UC20 – Administration (chỉ Administrator)
  {
    path: 'admin',
    canActivate: [adminGuard],
    children: [
      { path: 'users', title: 'Người dùng', loadComponent: () => import('./features/admin/admin-users.component').then((m) => m.AdminUsersComponent) },
      { path: 'quizzes', title: 'Kiểm duyệt quiz', loadComponent: () => import('./features/admin/admin-quizzes.component').then((m) => m.AdminQuizzesComponent) }
    ]
  },
  { path: '', redirectTo: '/quiz/browse', pathMatch: 'full' },
  { path: '**', title: 'Không tìm thấy trang', loadComponent: () => import('./features/not-found.component').then((m) => m.NotFoundComponent) }
];
