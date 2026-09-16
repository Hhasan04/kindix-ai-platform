import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from './auth.service';

// No valid token or the wrong role both redirect to /login.
function roleGuard(role: UserRole): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    return authService.getRole() === role ? true : router.parseUrl('/login');
  };
}

export const schoolGuard: CanActivateFn = roleGuard('school');
export const adminGuard: CanActivateFn = roleGuard('admin');
