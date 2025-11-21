import { Component, ChangeDetectionStrategy, inject, computed, signal, HostListener } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { ThemeService } from '../../services/theme.service';
import { LayoutService } from '../layout.service';
import { Router } from '@angular/router';
import { PwaInstallService } from '../../services/pwa-install.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private authService: AuthService = inject(AuthService);
  private themeService: ThemeService = inject(ThemeService);
  private layoutService: LayoutService = inject(LayoutService);
  private router: Router = inject(Router);
  pwa = inject(PwaInstallService);

  theme = this.themeService.theme;
  userEmail = computed(() => this.authService.currentUser()?.email ?? 'Usuário');
  isAdmin = this.authService.isAdmin;

  isDropdownOpen = signal(false);

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleSidebar(): void {
    this.layoutService.toggleSidebar();
  }

  toggleDropdown(): void {
    this.isDropdownOpen.update(v => !v);
  }

  closeDropdown(): void {
    this.isDropdownOpen.set(false);
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
    this.closeDropdown();
  }

  logout() {
    this.closeDropdown();
    this.authService.signOut();
  }
}