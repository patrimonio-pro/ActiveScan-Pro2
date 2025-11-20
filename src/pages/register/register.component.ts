import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PessoaFisicaFormComponent } from './pessoa-fisica-form/pessoa-fisica-form.component';
import { PessoaJuridicaFormComponent } from './pessoa-juridica-form/pessoa-juridica-form.component';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  imports: [RouterLink, PessoaFisicaFormComponent, PessoaJuridicaFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  accountType = signal<'pessoa_fisica' | 'pessoa_juridica'>('pessoa_fisica');

  setAccountType(type: 'pessoa_fisica' | 'pessoa_juridica') {
    this.accountType.set(type);
  }
}
