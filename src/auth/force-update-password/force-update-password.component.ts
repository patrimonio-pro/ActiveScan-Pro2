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
  selector: 'app-force-update-password',
  standalone: true,
  templateUrl: './force-update-password.component.html',
  styleUrls: ['./force-update-password.component.css'],
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForceUpdatePasswordComponent {
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
      const { error } = await this.authService.forceUpdatePassword(password!);
      if (error) {
        this.errorMessage.set(error.message);
      } else {
        this.successMessage.set('Sua senha foi definida com sucesso! Você será redirecionado para o dashboard.');
        this.updatePasswordForm.disable();
        setTimeout(() => {
            this.router.navigate(['/dashboard']);
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
