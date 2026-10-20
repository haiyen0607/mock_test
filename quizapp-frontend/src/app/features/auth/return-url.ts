import { ActivatedRoute } from '@angular/router';

/** `returnUrl` query param when it is a safe internal path, else /quiz/browse. */
export function safeReturnUrl(route: ActivatedRoute): string {
  const url = route.snapshot.queryParamMap.get('returnUrl');
  if (url && url.startsWith('/') && !url.startsWith('//') && !url.includes('\\') && !url.startsWith('/auth/')) {
    return url;
  }
  return '/quiz/browse';
}
