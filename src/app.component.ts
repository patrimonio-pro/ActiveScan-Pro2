import { Component, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { HeaderComponent } from './layout/header/header.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { LayoutService } from './layout/layout.service';
import { ErrorService } from './services/error.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  authService: AuthService = inject(AuthService);
  router: Router = inject(Router);
  layoutService: LayoutService = inject(LayoutService);
  errorService: ErrorService = inject(ErrorService);

  isLoggedIn = this.authService.isLoggedIn;
  isSidebarOpen = this.layoutService.isSidebarOpen;
  globalError = this.errorService.globalError;

  // This effect redirects to the login page when the user logs out or the session expires.
  constructor() {
    effect(() => {
      if (!this.isLoggedIn()) {
        const currentUrl = this.router.url;
        // Avoid redirecting if already on a public page to prevent navigation loops.
        // The authGuard handles redirection from protected routes.
        if (!currentUrl.startsWith('/login') && !currentUrl.startsWith('/register')) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  closeSidebar() {
    this.layoutService.closeSidebar();
  }

  clearError() {
    this.errorService.clearGlobalError();
  }
}