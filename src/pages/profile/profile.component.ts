import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ProfileService } from './profile.service';
import { UserProfile, PessoaFisica, PessoaJuridica } from '../../shared/models/api.models';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private fb: FormBuilder = inject(FormBuilder);
  private router: Router = inject(Router);
  authService: AuthService = inject(AuthService);
  private profileService: ProfileService = inject(ProfileService);

  isLoading = signal(true);
  isEditing = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  
  userProfile = this.authService.userProfile;
  detailedProfile = signal<PessoaFisica | PessoaJuridica | null>(null);

  profileForm!: FormGroup;

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const profile = await this.profileService.getProfile();
      this.detailedProfile.set(profile);
      this.buildForm();
    } catch (err: any) {
      this.error.set(err.message || 'Falha ao carregar o perfil.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private buildForm() {
    const profile = this.detailedProfile();
    const type = this.userProfile()?.tipo;

    if (!profile || !type) {
      this.error.set('Não foi possível inicializar o formulário de perfil.');
      return;
    }

    if (type === 'Pessoa Física') {
      const pf = profile as PessoaFisica;
      this.profileForm = this.fb.group({
        nome_completo: [pf.nome_completo, Validators.required],
        cpf: [pf.cpf, [Validators.required, Validators.maxLength(14)]],
        data_nascimento: [pf.data_nascimento, Validators.required],
        telefone_celular: [pf.telefone_celular, [Validators.required, Validators.maxLength(18)]],
        sexo: [pf.sexo, Validators.required],
        cep: [pf.cep, [Validators.required, Validators.maxLength(9)]],
        logradouro: [pf.logradouro, Validators.required],
        numero: [pf.numero, Validators.required],
        bairro: [pf.bairro, Validators.required],
        cidade: [pf.cidade, Validators.required],
        uf: [pf.uf, [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
      });
    } else {
      const pj = profile as PessoaJuridica;
      this.profileForm = this.fb.group({
        razao_social: [pj.razao_social, Validators.required],
        cnpj: [pj.cnpj, [Validators.required, Validators.maxLength(18)]],
        nome_fantasia: [pj.nome_fantasia],
        telefone_comercial: [pj.telefone_comercial, [Validators.required, Validators.maxLength(18)]],
        responsavel_legal: [pj.responsavel_legal, Validators.required],
        inscricao_estadual: [pj.inscricao_estadual],
        inscricao_municipal: [pj.inscricao_municipal],
        cep: [pj.cep, [Validators.required, Validators.maxLength(9)]],
        logradouro: [pj.logradouro, Validators.required],
        numero: [pj.numero, Validators.required],
        bairro: [pj.bairro, Validators.required],
        cidade: [pj.cidade, Validators.required],
        uf: [pj.uf, [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
      });
    }
  }

  setEditing(isEditing: boolean) {
    this.isEditing.set(isEditing);
    if (!isEditing) {
       this.successMessage.set(null);
       this.error.set(null);
    }
  }

  async onSave() {
    if (this.profileForm.invalid) {
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    try {
      const updatedData = this.profileForm.getRawValue();
      await this.profileService.updateProfile(updatedData);
      await this.authService.refreshUserProfile(); // Refresh global profile state
      await this.loadProfile(); // Reload local detailed profile
      this.successMessage.set('Perfil atualizado com sucesso!');
      this.isEditing.set(false);
    } catch (err: any) {
      this.error.set(err.message || 'Falha ao atualizar o perfil.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onDeleteAccount() {
    const confirmation = prompt('Esta ação é irreversível e irá deletar todos os seus dados. Para confirmar, digite "DELETAR MINHA CONTA":');
    if (confirmation !== 'DELETAR MINHA CONTA') {
      alert('Ação cancelada.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.profileService.deleteAccount();
      // On success, the auth state change will trigger a redirect to login.
      // No need to navigate manually.
      alert('Sua conta foi deletada com sucesso.');
    } catch(err: any) {
       this.error.set(err.message || 'Falha ao deletar a conta.');
       this.isLoading.set(false);
    }
  }

  // Type guards for template
  isPessoaFisica(profile: any): profile is PessoaFisica {
    return this.userProfile()?.tipo === 'Pessoa Física';
  }
}
