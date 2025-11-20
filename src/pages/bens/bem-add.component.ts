import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BemFormComponent } from './bem-form.component';
import { BensService } from './bens.service';
import { Bem } from '../../shared/models/api.models';

@Component({
  selector: 'app-bem-add',
  standalone: true,
  templateUrl: './bem-add.component.html',
  styleUrls: ['./bem-add.component.css'],
  imports: [BemFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BemAddComponent {
  private bensService: BensService = inject(BensService);
  private router: Router = inject(Router);

  error = signal<string | null>(null);

  // Helper to get a descriptive error message from an unknown error.
  private getErrorMessage(err: unknown, baseMessage: string): string {
    let details = '';
    if (err && typeof err === 'object') {
      if ('message' in err && typeof err.message === 'string') {
        details = err.message;
      } else {
        try {
          details = JSON.stringify(err);
        } catch {
          details = 'Erro não pôde ser serializado.';
        }
      }
    } else if (err) {
      details = String(err);
    }

    return details ? `${baseMessage} Detalhes: ${details}` : baseMessage;
  }

  async handleAdicionarBem(bemData: Partial<Bem> & { new_photos_data?: string[] }) {
    this.error.set(null);
    try {
      await this.bensService.addBem(bemData);
      this.router.navigate(['/bens']);
    } catch (err: unknown) {
      const errorMessage = this.getErrorMessage(err, 'Falha ao salvar o bem.');
      this.error.set(errorMessage);
      console.error('Erro ao adicionar o bem:', err);
    }
  }

  handleCancelar() {
    this.router.navigate(['/bens']);
  }
}