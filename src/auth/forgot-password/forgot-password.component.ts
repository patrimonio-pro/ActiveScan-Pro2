import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
  imports: [RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private authService: AuthService = inject(AuthService);
  // FIX: Explicitly type FormBuilder injection to fix type inference issue.
  private fb: FormBuilder = inject(FormBuilder);

  forgotPasswordForm: FormGroup;
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  constructor() {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  async onSubmit() {
    if (this.forgotPasswordForm.invalid) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const { email } = this.forgotPasswordForm.value;
      const { error } = await this.authService.sendPasswordResetEmail(email!);
      if (error) {
        this.errorMessage.set(error.message);
      } else {
        this.successMessage.set('Se o e-mail estiver cadastrado, um link para redefinição de senha foi enviado.');
        this.forgotPasswordForm.reset();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ocorreu um erro inesperado.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
