import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-pessoa-juridica-form',
  standalone: true,
  templateUrl: './pessoa-juridica-form.component.html',
  styleUrls: ['./pessoa-juridica-form.component.css'],
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PessoaJuridicaFormComponent {
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);
  // FIX: Explicitly type FormBuilder injection to fix type inference issue.
  private fb: FormBuilder = inject(FormBuilder);

  loading = signal(false);
  errorMessage = signal('');

  pjForm: FormGroup;

  constructor() {
    this.pjForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      razao_social: ['', Validators.required],
      cnpj: ['', [Validators.required, Validators.maxLength(18)]],
      nome_fantasia: [''],
      telefone_comercial: ['', [Validators.required, Validators.maxLength(18)]],
      responsavel_legal: ['', Validators.required],
      inscricao_estadual: [''],
      inscricao_municipal: [''],
      cep: ['', [Validators.required, Validators.maxLength(9)]],
      logradouro: ['', Validators.required],
      numero: ['', Validators.required],
      bairro: ['', Validators.required],
      cidade: ['', Validators.required],
      uf: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    });
  }

  async onSubmit() {
    if (this.pjForm.invalid) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');

    const { email, password, ...profileData } = this.pjForm.getRawValue();

    try {
      await this.authService.signUp({ email: email!, password: password! }, profileData, 'pessoa_juridica');
      this.router.navigate(['/login'], { queryParams: { registration: 'success' } });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ocorreu um erro inesperado durante o cadastro.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
