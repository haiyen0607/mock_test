import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Empty / error / not-found block with a simple geometric illustration
 * (brand shapes + a Bootstrap Icon). Put action buttons in the content slot.
 *
 * <app-empty-state icon="bi-journal-x" title="Chưa có quiz nào" message="...">
 *   <a class="btn btn-primary" routerLink="...">Tạo quiz</a>
 * </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty" [class.compact]="compact" [attr.data-tone]="tone" role="status">
      <div class="art" aria-hidden="true">
        <span class="blob"></span>
        <span class="ring"></span>
        <span class="dot dot-a"></span>
        <span class="dot dot-b"></span>
        <span class="glyph"><i class="bi" [ngClass]="icon"></i></span>
      </div>
      <h2 class="title">{{ title }}</h2>
      <p class="message" *ngIf="message">{{ message }}</p>
      <div class="actions"><ng-content></ng-content></div>
    </div>
  `,
  styles: [`
    .empty {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: 3rem 1.5rem;
      animation: fadeInUp 420ms var(--ease) both;
    }
    .empty.compact { padding: 1.75rem 1rem; }

    .art { position: relative; width: 148px; height: 120px; margin-bottom: 1.25rem; }
    .compact .art { transform: scale(0.8); margin-bottom: 0.5rem; }

    .blob {
      position: absolute; inset: 8px 14px 6px 10px;
      background: var(--tone-soft);
      border-radius: 46% 54% 42% 58% / 55% 45% 55% 45%;
    }
    .ring {
      position: absolute; width: 38px; height: 38px; right: 4px; top: 0;
      border: 3px solid var(--tone-mid); border-radius: 50%;
    }
    .dot { position: absolute; border-radius: 50%; background: var(--tone-strong); }
    .dot-a { width: 12px; height: 12px; left: 2px; bottom: 18px; }
    .dot-b { width: 7px; height: 7px; right: 26px; bottom: 4px; opacity: 0.6; }
    .glyph {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-6deg);
      width: 64px; height: 64px; border-radius: 20px;
      display: flex; align-items: center; justify-content: center;
      background: var(--surface); color: var(--tone-strong);
      box-shadow: var(--shadow-md);
      font-size: 1.75rem;
    }

    .title { font-size: 1.15rem; font-weight: 800; margin: 0 0 0.35rem; }
    .message { color: var(--text-2); max-width: 42ch; margin: 0 0 1.25rem; }
    .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
    .actions:empty { display: none; }

    [data-tone='brand'] { --tone-soft: var(--brand-soft); --tone-mid: var(--brand-300); --tone-strong: var(--brand-500); }
    [data-tone='danger'] { --tone-soft: var(--danger-soft); --tone-mid: color-mix(in srgb, var(--danger) 45%, transparent); --tone-strong: var(--danger); }
    [data-tone='neutral'] { --tone-soft: var(--surface-2); --tone-mid: var(--border-strong); --tone-strong: var(--text-2); }
  `]
})
export class EmptyStateComponent {
  @Input() icon = 'bi-inbox';
  @Input() title = '';
  @Input() message = '';
  @Input() tone: 'brand' | 'danger' | 'neutral' = 'brand';
  @Input() compact = false;
}
