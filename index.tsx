import './index.css';

import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_INITIALIZER, provideZonelessChangeDetection, isDevMode } from '@angular/core';

import { AppComponent } from './src/app.component';
import { APP_ROUTES } from './src/app.routes';
import { AuthService } from './src/auth/auth.service';
import { authInterceptor } from './src/auth/auth.interceptor';
import { provideServiceWorker } from '@angular/service-worker';

function initializeAuth(authService: AuthService): () => Promise<void> {
  return () => authService.checkSession();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),

    // ❗ FUNCIONA, MAS NÃO É O IDEAL PARA PWA
    provideRouter(APP_ROUTES),

    provideHttpClient(withInterceptors([authInterceptor])),

    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthService],
      multi: true,
    },

    // PWA — 100% correto
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ],
}).catch(err => console.error(err));
