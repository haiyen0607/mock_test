import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { environment } from '../../../environments/environment';
import { ListQuery } from '../models';

/**
 * Turns a ListQuery (plus any extra flags) into axios query params,
 * dropping empty/undefined values and trimming strings.
 */
export function toListParams(q?: ListQuery | object): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (!q) return params;
  for (const [key, value] of Object.entries(q as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      const v = value.trim();
      if (v) params[key] = v;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      params[key] = value;
    }
  }
  return params;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Do not log out / redirect to login when this request returns 401. */
    skipAuthRedirect?: boolean;
  }
}

/**
 * The app's single HTTP client. Every service goes through `request()`.
 *
 * - Attaches the JWT (read straight from localStorage so this class does not
 *   depend on AuthService — AuthService depends on it instead).
 * - On 401 for a request that carried a token: clears the token, notifies
 *   `onUnauthorized` (AuthService clears the current user) and sends the user
 *   to /auth/login?returnUrl=<current url>.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly router = inject(Router);
  readonly http: AxiosInstance;

  /** Set by AuthService to reset its in-memory user state. */
  onUnauthorized: (() => void) | null = null;

  constructor() {
    this.http = axios.create({
      baseURL: environment.apiUrl,
      timeout: 15000
    });

    this.http.interceptors.request.use((config) => {
      const token = localStorage.getItem(environment.jwtKey);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.http.interceptors.response.use(
      (res) => res,
      (error) => {
        const config = error?.config;
        const hadToken = !!config?.headers?.Authorization;
        if (error?.response?.status === 401 && hadToken && !config?.skipAuthRedirect) {
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Runs an axios call and exposes it as a cold Observable of the response body.
   * Nothing is emitted after the subscriber unsubscribes.
   */
  request<T>(fn: (http: AxiosInstance) => Promise<AxiosResponse<T>>): Observable<T> {
    return new Observable<T>((subscriber) => {
      fn(this.http)
        .then((res) => {
          if (subscriber.closed) return;
          subscriber.next(res.data);
          subscriber.complete();
        })
        .catch((err) => {
          if (!subscriber.closed) subscriber.error(err);
        });
    });
  }

  private handleUnauthorized(): void {
    localStorage.removeItem(environment.jwtKey);
    this.onUnauthorized?.();

    const current = this.router.url;
    if (current.startsWith('/auth/login')) return;
    this.router.navigate(['/auth/login'], { queryParams: { returnUrl: current } });
  }
}
