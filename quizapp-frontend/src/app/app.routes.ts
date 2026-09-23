import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { BrowseQuizzesComponent } from './features/quiz/browse-quizzes.component';
import { QuizDetailComponent } from './features/quiz/quiz-detail.component';
import { AttemptComponent } from './features/quiz/attempt.component';
import { ResultComponent } from './features/quiz/result.component';
import { MyQuizzesComponent } from './features/dashboard/my-quizzes.component';
import { QuizCreateComponent } from './features/dashboard/quiz-create.component';
import { QuizEditComponent } from './features/dashboard/quiz-edit.component';
import { QuizQuestionsComponent } from './features/dashboard/quiz-questions.component';
import { QuestionBanksComponent } from './features/dashboard/question-banks.component';
import { BankQuestionsComponent } from './features/dashboard/bank-questions.component';
import { AdminUsersComponent } from './features/admin/admin-users.component';
import { AdminQuizzesComponent } from './features/admin/admin-quizzes.component';
import { AuthGuard } from './core/guards/auth.guard';
import { AdminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  // UC01, UC02 – Authentication
  {
    path: 'auth',
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent }
    ]
  },
  // UC04-UC10 – Quiz Discovery & Participation (Guest + User)
  {
    path: 'quiz',
    children: [
      { path: 'browse', component: BrowseQuizzesComponent },
      { path: 'detail/:id', component: QuizDetailComponent },
      { path: 'attempt/:id', component: AttemptComponent },
      { path: 'result/:id', component: ResultComponent }
    ]
  },
  // UC11-UC17 – Quiz Management + Question Bank (User đã đăng nhập)
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    children: [
      { path: 'my-quizzes', component: MyQuizzesComponent },
      { path: 'quiz-create', component: QuizCreateComponent },
      { path: 'quiz-edit/:id', component: QuizEditComponent },
      { path: 'quiz-questions/:id', component: QuizQuestionsComponent },
      { path: 'question-banks', component: QuestionBanksComponent },
      { path: 'question-banks/:id', component: BankQuestionsComponent }
    ]
  },
  // UC18-UC20 – Administration (chỉ Administrator)
  {
    path: 'admin',
    canActivate: [AdminGuard],
    children: [
      { path: 'users', component: AdminUsersComponent },
      { path: 'quizzes', component: AdminQuizzesComponent }
    ]
  },
  { path: '', redirectTo: '/quiz/browse', pathMatch: 'full' },
  { path: '**', redirectTo: '/quiz/browse' }
];
