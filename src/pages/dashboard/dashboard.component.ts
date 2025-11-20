import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { BensService } from '../bens/bens.service';
import { Router } from '@angular/router';
import { StatusChartComponent, ChartData } from './status-chart/status-chart.component';

interface DashboardStats {
  total: number;
  ativos: number;
  manutencao: number;
  baixados: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  imports: [StatusChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private bensService: BensService = inject(BensService);
  private router: Router = inject(Router);

  stats = signal<DashboardStats>({ total: 0, ativos: 0, manutencao: 0, baixados: 0 });
  isLoading = signal(true);
  error = signal<string | null>(null);

  chartData = computed<ChartData[]>(() => {
    const s = this.stats();
    return [
      { label: 'Ativos', value: s.ativos },
      { label: 'Manutenção', value: s.manutencao },
      { label: 'Baixados / Inativos', value: s.baixados },
    ];
  });

  ngOnInit() {
    this.loadStats();
  }

  navigateToBens() {
    this.router.navigate(['/bens']);
  }

  async loadStats() {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const bens = await this.bensService.getBens();
      const total = bens.length;
      const ativos = bens.filter(b => b.situacao === 'ativo').length;
      const manutencao = bens.filter(b => b.situacao === 'em_manutencao').length;
      const baixados = bens.filter(b => b.situacao === 'baixado' || b.situacao === 'inativo').length;
      
      this.stats.set({ total, ativos, manutencao, baixados });
    } catch (err) {
      this.error.set('Falha ao carregar as estatísticas do dashboard.');
      console.error(err);
    } finally {
      this.isLoading.set(false);
    }
  }
}