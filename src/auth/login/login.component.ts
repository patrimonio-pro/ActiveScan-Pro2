import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private themeService: ThemeService = inject(ThemeService);
  // FIX: Explicitly type FormBuilder injection to fix type inference issue.
  private fb: FormBuilder = inject(FormBuilder);

  loginForm: FormGroup;
  theme = this.themeService.theme;

  loading = signal(false);
  errorMessage = signal('');
  registrationSuccessMessage = signal('');

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['registration'] === 'success') {
        this.registrationSuccessMessage.set('Cadastro realizado com sucesso! Por favor, verifique seu e-mail para confirmar sua conta antes de fazer login.');
      }
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const { email, password } = this.loginForm.value;
      const { error } = await this.authService.signIn({ email: email!, password: password! });
      if (error) {
        if (error.message === 'Invalid login credentials') {
          this.errorMessage.set('E-mail ou senha inválidos.');
        } else {
          this.errorMessage.set(error.message);
        }
      } 
      // A navegação agora é tratada pelo AuthService para centralizar a lógica de redirecionamento
      // (para o dashboard ou para a página de atualização de senha).
    } catch (e) {
        if (e instanceof Error) {
            this.errorMessage.set(e.message);
        } else {
            this.errorMessage.set('Ocorreu um erro inesperado.');
        }
    } finally {
        this.loading.set(false);
    }
  }
}
