
import './index.css';

import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_INITIALIZER, provideZonelessChangeDetection } from '@angular/core';

import { AppComponent } from './src/app.component';
import { APP_ROUTES } from './src/app.routes';
import { AuthService } from './src/auth/auth.service';
import { authInterceptor } from './src/auth/auth.interceptor';

function initializeAuth(authService: AuthService): () => Promise<void> {
  return () => authService.checkSession();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(APP_ROUTES, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthService],
      multi: true,
    },
  ],
}).catch(err => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.