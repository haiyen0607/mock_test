import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Requires role Administrator. Waits for the user to be restored (GET /auth/me)
 * so a page reload on /admin/* does not bounce the admin away.
 */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
  }

  const user = await authService.ensureCurrentUser();
  if (!user) {
    return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
  }
  if (user.role === 'Administrator') {
    return true;
  }
  return router.createUrlTree(['/quiz/browse']);
};
