import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { Location, CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BensService } from './bens.service';
import { Bem } from '../../shared/models/api.models';
import { BemFormComponent } from './bem-form.component';

@Component({
  selector: 'app-bem-detail',
  standalone: true,
  templateUrl: './bem-detail.component.html',
  styleUrls: ['./bem-detail.component.css'],
  imports: [BemFormComponent, CurrencyPipe, DatePipe, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BemDetailComponent implements OnInit {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private location: Location = inject(Location);
  private bensService: BensService = inject(BensService);

  bem = signal<Bem | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isEditing = signal(false);

  private readonly brazilLocaleOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Sao_Paulo',
  };

  private formatDateForBrazil(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR', this.brazilLocaleOptions);
  }

  createdAtFormatted = computed(() => this.formatDateForBrazil(this.bem()?.created_at));

  updatedAtFormatted = computed(() => this.formatDateForBrazil(this.bem()?.updated_at || this.bem()?.created_at));

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadBem(Number(id));
    } else {
      this.error.set('ID do bem não encontrado.');
      this.isLoading.set(false);
    }
  }

  async loadBem(id: number) {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const bem = await this.bensService.getBemById(id);
      this.bem.set(bem);
    } catch (err: unknown) {
      const errorMessage = this.getErrorMessage(err, 'Falha ao carregar o bem.');
      this.error.set(errorMessage);
      console.error('Erro ao carregar o bem:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Helper to get a descriptive error message from an unknown error.
  private getErrorMessage(err: unknown, baseMessage: string): string {
    let details = '';
    if (err && typeof err === 'object') {
      if ('message' in err && typeof err.message === 'string') {
        // Special handling for the known Supabase trigger error
        if (err.message.includes('record "new" has no field "updated_at"')) {
          return "Falha de configuração do banco de dados: A coluna 'updated_at' para o histórico de alterações parece estar faltando na tabela 'bem'. Por favor, adicione a coluna no seu editor de tabelas do Supabase e certifique-se de que o trigger de atualização está configurado corretamente.";
        }
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

  async handleSalvar(bemData: Partial<Bem> & { new_photos_data?: string[], deleted_photo_urls?: string[] }) {
    const bemAtual = this.bem();
    if (!bemAtual) return;
    this.error.set(null); // Clear previous errors

    try {
      await this.bensService.updateBem(bemAtual.id, bemData);
      this.isEditing.set(false);
      this.loadBem(bemAtual.id); // Refresh data
    } catch (err: unknown) {
      const errorMessage = this.getErrorMessage(err, 'Falha ao atualizar o bem.');
      this.error.set(errorMessage);
      console.error('Erro ao atualizar o bem:', err);
    }
  }

  async handleExcluir() {
    const bemAtual = this.bem();
    if (!bemAtual) return;
    
    if (confirm(`Tem certeza que deseja excluir o bem "${bemAtual.descricao}" (${bemAtual.numero_patrimonio})?`)) {
      this.error.set(null);
      try {
        await this.bensService.deleteBem(bemAtual.id);
        this.router.navigate(['/bens']);
      } catch (err: unknown) {
        const errorMessage = this.getErrorMessage(err, 'Falha ao excluir o bem.');
        this.error.set(errorMessage);
        console.error('Erro ao excluir o bem:', err);
      }
    }
  }

  goBack() {
    this.location.back();
  }

  getStatusClass(status: string | undefined): string {
    if(!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100';
    switch (status) {
      case 'ativo':
        return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
      case 'em_manutencao':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100';
      case 'inativo':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100';
      case 'baixado':
        return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100';
    }
  }
}