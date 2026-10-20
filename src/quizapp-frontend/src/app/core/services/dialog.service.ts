import { Injectable, signal } from '@angular/core';

export interface DialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** danger: destructive action (red confirm button) */
  tone?: 'brand' | 'danger';
  icon?: string;
}

export interface DialogState extends DialogOptions {
  kind: 'confirm' | 'alert';
  resolve: (ok: boolean) => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'danger' | 'brand';
}

/**
 * In-app replacement for window.confirm / window.alert, styled with the design
 * system. Rendered by <app-dialog-host> in the app shell.
 *
 *   if (!(await this.dialog.confirm({ title: 'Xóa quiz?', tone: 'danger' }))) return;
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly current = signal<DialogState | null>(null);
  readonly toasts = signal<Toast[]>([]);
  private nextToastId = 1;

  confirm(options: DialogOptions): Promise<boolean> {
    return this.open('confirm', options);
  }

  alert(options: DialogOptions): Promise<void> {
    return this.open('alert', options).then(() => undefined);
  }

  /** Short, non-blocking confirmation message (auto-dismisses). */
  toast(message: string, tone: Toast['tone'] = 'success', durationMs = 3500): void {
    const id = this.nextToastId++;
    this.toasts.update((list) => [...list, { id, message, tone }]);
    setTimeout(() => this.dismissToast(id), durationMs);
  }

  dismissToast(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  /** Close the open dialog with the given result (used by the host). */
  close(ok: boolean): void {
    const state = this.current();
    if (!state) return;
    this.current.set(null);
    state.resolve(ok);
  }

  private open(kind: DialogState['kind'], options: DialogOptions): Promise<boolean> {
    // A new dialog supersedes an open one; the old one resolves as cancelled.
    this.close(false);
    return new Promise<boolean>((resolve) => this.current.set({ ...options, kind, resolve }));
  }
}
