import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { EmptyStateComponent } from '../shared/empty-state.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule, EmptyStateComponent],
  template: `
    <div class="page-container-narrow animate-fade-up">
      <app-empty-state
        icon="bi-signpost-split"
        title="Không tìm thấy trang"
        message="Đường dẫn có thể đã thay đổi hoặc không còn tồn tại."
      >
        <a class="btn btn-primary" routerLink="/quiz/browse">
          <i class="bi bi-compass me-1" aria-hidden="true"></i>Về trang khám phá
        </a>
        <button type="button" class="btn btn-light" (click)="goBack()">
          <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>Quay lại
        </button>
      </app-empty-state>
    </div>
  `
})
export class NotFoundComponent {
  goBack(): void {
    history.back();
  }
}
