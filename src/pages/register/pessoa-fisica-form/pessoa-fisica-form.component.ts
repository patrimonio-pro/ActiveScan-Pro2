import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-pessoa-fisica-form',
  standalone: true,
  templateUrl: './pessoa-fisica-form.component.html',
  styleUrls: ['./pessoa-fisica-form.component.css'],
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PessoaFisicaFormComponent {
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);
  // FIX: Explicitly type FormBuilder injection to fix type inference issue.
  private fb: FormBuilder = inject(FormBuilder);

  loading = signal(false);
  errorMessage = signal('');

  pfForm: FormGroup;

  constructor() {
    this.pfForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      nome_completo: ['', Validators.required],
      cpf: ['', [Validators.required, Validators.maxLength(14)]],
      data_nascimento: ['', Validators.required],
      telefone_celular: ['', [Validators.required, Validators.maxLength(18)]],
      sexo: ['', Validators.required],
      cep: ['', [Validators.required, Validators.maxLength(9)]],
      logradouro: ['', Validators.required],
      numero: ['', Validators.required],
      bairro: ['', Validators.required],
      cidade: ['', Validators.required],
      uf: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    });
  }

  async onSubmit() {
    if (this.pfForm.invalid) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');

    const { email, password, ...profileData } = this.pfForm.getRawValue();

    try {
      await this.authService.signUp({ email: email!, password: password! }, profileData, 'pessoa_fisica');
      this.router.navigate(['/login'], { queryParams: { registration: 'success' } });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ocorreu um erro inesperado durante o cadastro.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
