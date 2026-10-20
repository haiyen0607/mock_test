import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Loading placeholder shaped like the content it replaces.
 *  - variant="cards": grid of quiz-card shapes
 *  - variant="list":  stacked rows (tables, question lists)
 *  - variant="detail": header block + paragraph lines
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sk" [ngSwitch]="variant" aria-busy="true" aria-live="polite">
      <span class="visually-hidden">Đang tải…</span>

      <div *ngSwitchCase="'cards'" class="sk-cards">
        <div class="sk-card" *ngFor="let _ of items">
          <div class="skeleton sk-thumb"></div>
          <div class="skeleton sk-line w-75"></div>
          <div class="skeleton sk-line w-50"></div>
          <div class="d-flex gap-2 mt-2">
            <div class="skeleton sk-pill"></div>
            <div class="skeleton sk-pill"></div>
          </div>
        </div>
      </div>

      <div *ngSwitchCase="'list'" class="sk-list">
        <div class="sk-row" *ngFor="let _ of items">
          <div class="skeleton sk-avatar"></div>
          <div class="flex-grow-1">
            <div class="skeleton sk-line w-50"></div>
            <div class="skeleton sk-line sk-thin w-25"></div>
          </div>
          <div class="skeleton sk-pill"></div>
        </div>
      </div>

      <div *ngSwitchDefault class="sk-detail">
        <div class="skeleton sk-hero"></div>
        <div class="skeleton sk-line w-50 mt-3"></div>
        <div class="skeleton sk-line w-100"></div>
        <div class="skeleton sk-line w-75"></div>
      </div>
    </div>
  `,
  styles: [`
    .sk-cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .sk-card { padding: 1rem; border-radius: var(--radius-card); background: var(--surface); border: 1px solid var(--border); }
    .sk-thumb { height: 88px; border-radius: 12px; margin-bottom: 1rem; }
    .sk-line { height: 12px; margin-bottom: 0.6rem; }
    .sk-thin { height: 9px; }
    .sk-pill { height: 22px; width: 64px; border-radius: var(--radius-pill); }
    .sk-list { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); }
    .sk-row { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.15rem; border-bottom: 1px solid var(--border); }
    .sk-row:last-child { border-bottom: 0; }
    .sk-avatar { width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; }
    .sk-hero { height: 140px; border-radius: var(--radius-card); }
  `]
})
export class SkeletonComponent {
  @Input() variant: 'cards' | 'list' | 'detail' = 'list';
  @Input() set count(n: number) { this.items = Array.from({ length: n }); }
  items: unknown[] = Array.from({ length: 4 });
}
