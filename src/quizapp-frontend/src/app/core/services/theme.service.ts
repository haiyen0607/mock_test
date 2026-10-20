import { Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'quizapp-theme';

/**
 * Light / dark theme. Writes `data-bs-theme` on <html>, which drives both
 * Bootstrap 5.3 and the tokens in styles.css. `system` follows the OS setting.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  readonly preference = signal<ThemePreference>(this.readPreference());
  readonly resolved = signal<'light' | 'dark'>(this.resolve(this.preference()));

  constructor() {
    this.apply();
    this.media.addEventListener('change', () => {
      if (this.preference() === 'system') this.apply();
    });
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    try {
      if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // storage unavailable: preference lasts for this session only
    }
    this.apply();
  }

  private apply(): void {
    const theme = this.resolve(this.preference());
    this.resolved.set(theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
  }

  private resolve(pref: ThemePreference): 'light' | 'dark' {
    if (pref === 'system') return this.media.matches ? 'dark' : 'light';
    return pref;
  }

  private readPreference(): ThemePreference {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'system';
  }
}
