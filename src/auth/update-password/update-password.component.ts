import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  return password && confirmPassword && password.value !== confirmPassword.value ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './update-password.component.html',
  styleUrls: ['./update-password.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdatePasswordComponent {
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);
  // FIX: Explicitly type FormBuilder injection to fix type inference issue.
  private fb: FormBuilder = inject(FormBuilder);

  updatePasswordForm: FormGroup;
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  constructor() {
    this.updatePasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    }, { validators: passwordMatchValidator });
  }

  async onSubmit() {
    if (this.updatePasswordForm.invalid) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const { password } = this.updatePasswordForm.value;
      const { error } = await this.authService.updatePassword(password!);
      if (error) {
        this.errorMessage.set(error.message);
      } else {
        this.successMessage.set('Sua senha foi atualizada com sucesso! Você será redirecionado para o login.');
        this.updatePasswordForm.disable();
        setTimeout(() => {
            // Supabase signs the user out automatically after password update for security.
            // The onAuthStateChange handler will redirect to login anyway, but this is a safeguard.
            this.router.navigate(['/login']);
        }, 3000);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ocorreu um erro inesperado.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
