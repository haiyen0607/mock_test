import { Component, ElementRef, HostListener, OnDestroy, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationStart, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { DialogService } from '../core/services/dialog.service';

/** Renders DialogService dialogs and toasts. Mounted once in AppComponent. */
@Component({
  selector: 'app-dialog-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="dialog.current() as d">
      <div class="dlg-backdrop animate-fade-in" (click)="dialog.close(false)"></div>
      <div class="dlg-wrap">
        <div class="dlg animate-pop" role="alertdialog" aria-modal="true"
             aria-labelledby="dlg-title" [attr.aria-describedby]="d.message ? 'dlg-msg' : null"
             [attr.data-tone]="d.tone || 'brand'">
          <span class="dlg-icon" aria-hidden="true">
            <i class="bi" [ngClass]="d.icon || (d.tone === 'danger' ? 'bi-exclamation-triangle' : d.kind === 'alert' ? 'bi-info-circle' : 'bi-question-circle')"></i>
          </span>
          <h2 id="dlg-title" class="dlg-title">{{ d.title }}</h2>
          <p id="dlg-msg" class="dlg-msg" *ngIf="d.message">{{ d.message }}</p>
          <div class="dlg-actions">
            <button *ngIf="d.kind === 'confirm'" type="button" class="btn btn-light" (click)="dialog.close(false)">
              {{ d.cancelText || 'Hủy' }}
            </button>
            <button #primaryBtn type="button" class="btn"
                    [ngClass]="d.tone === 'danger' ? 'btn-danger' : 'btn-primary'"
                    (click)="dialog.close(true)">
              {{ d.confirmText || (d.kind === 'alert' ? 'Đã hiểu' : 'Đồng ý') }}
            </button>
          </div>
        </div>
      </div>
    </ng-container>

    <div class="toasts" aria-live="polite" aria-atomic="false">
      <div *ngFor="let t of dialog.toasts()" class="toast-item animate-fade-up" [attr.data-tone]="t.tone" role="status">
        <i class="bi" [ngClass]="t.tone === 'danger' ? 'bi-x-circle-fill' : t.tone === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'" aria-hidden="true"></i>
        <span>{{ t.message }}</span>
        <button type="button" class="btn-close btn-close-sm" aria-label="Đóng thông báo" (click)="dialog.dismissToast(t.id)"></button>
      </div>
    </div>
  `,
  styles: [`
    .dlg-backdrop { position: fixed; inset: 0; z-index: 1990; background: color-mix(in srgb, var(--text) 45%, transparent); }
    .dlg-wrap { position: fixed; inset: 0; z-index: 1991; display: flex; align-items: center; justify-content: center; padding: 1rem; pointer-events: none; }
    .dlg {
      pointer-events: auto;
      width: 100%; max-width: 420px;
      background: var(--surface); color: var(--text);
      border: 1px solid var(--border); border-radius: var(--radius-card);
      box-shadow: var(--shadow-lg);
      padding: 1.5rem;
    }
    .dlg-icon {
      width: 2.75rem; height: 2.75rem; border-radius: 14px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 1.25rem; margin-bottom: 0.9rem;
      background: var(--brand-soft); color: var(--brand-600);
    }
    [data-tone='danger'] .dlg-icon { background: var(--danger-soft); color: var(--danger); }
    .dlg-title { font-size: 1.15rem; font-weight: 800; margin: 0 0 0.4rem; }
    .dlg-msg { color: var(--text-2); margin: 0; white-space: pre-line; }
    .dlg-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.4rem; flex-wrap: wrap; }

    .toasts {
      position: fixed; z-index: 1995; right: 1rem; bottom: 1rem;
      display: grid; gap: 0.5rem; width: min(360px, calc(100vw - 2rem));
    }
    .toast-item {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 0.7rem 0.8rem 0.7rem 1rem;
      background: var(--surface); color: var(--text);
      border: 1px solid var(--border); border-radius: var(--radius-input);
      box-shadow: var(--shadow-lg);
      font-weight: 500; font-size: 0.9rem;
    }
    .toast-item span { flex: 1; }
    .toast-item i { font-size: 1.05rem; }
    [data-tone='success'] > i { color: var(--success); }
    [data-tone='danger'] > i { color: var(--danger); }
    [data-tone='brand'] > i { color: var(--brand-500); }
    .btn-close-sm { width: 0.6rem; height: 0.6rem; padding: 0.4rem; background-size: 0.6rem; }
  `]
})
export class DialogHostComponent implements OnDestroy {
  @ViewChild('primaryBtn') primaryBtn?: ElementRef<HTMLButtonElement>;
  private previousFocus: HTMLElement | null = null;
  private navSub: Subscription;

  constructor(public dialog: DialogService, router: Router) {
    // Move focus into the dialog on open, restore it on close.
    effect(() => {
      const open = !!this.dialog.current();
      if (open) {
        this.previousFocus = document.activeElement as HTMLElement | null;
        setTimeout(() => this.primaryBtn?.nativeElement.focus());
      } else if (this.previousFocus) {
        this.previousFocus.focus?.();
        this.previousFocus = null;
      }
    });

    // Leaving the page cancels any open dialog.
    this.navSub = router.events.pipe(filter((e) => e instanceof NavigationStart)).subscribe(() => this.dialog.close(false));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dialog.close(false);
  }

  /** Keep Tab focus inside the open dialog. */
  @HostListener('document:keydown.tab', ['$event'])
  onTab(event: Event): void {
    if (!this.dialog.current()) return;
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('.dlg button'));
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const e = event as KeyboardEvent;
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    } else if (!buttons.includes(document.activeElement as HTMLElement)) {
      first.focus();
      e.preventDefault();
    }
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
  }
}
