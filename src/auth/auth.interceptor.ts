import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Intercepts HTTP responses to handle authentication errors globally.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Note: We don't need to add the auth token here because the supabase-js client
  // handles that automatically. This interceptor's primary role is to catch
  // 401 Unauthorized responses, which indicate an expired session.

  return next(req).pipe(
    catchError((error: any) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // A 401 error from the API means the user's session is no longer valid
        // (both access and refresh tokens have likely expired). The best course of action
        // is to sign them out, which will clear the local state and trigger a
        // reactive redirect to the login page.
        console.warn('Auth Interceptor: Received 401 Unauthorized. Signing out.');
        
        // Call signOut but also catch any potential errors from the sign-out process itself
        // to prevent an unhandled promise rejection from crashing the app.
        authService.signOut().catch(signOutError => {
          console.error('Error during sign out after 401:', signOutError);
        });
      }
      
      // Re-throw the error so that it can be handled by other error handlers
      // or the component that initiated the request.
      return throwError(() => error);
    })
  );
};