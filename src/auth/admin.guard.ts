import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService: AuthService = inject(AuthService);
  const router: Router = inject(Router);

  if (authService.isLoggedIn() && authService.isAdmin()) {
    return true;
  }
  
  // Redirect to the dashboard page if not an admin
  router.navigate(['/dashboard']);
  return false;
};