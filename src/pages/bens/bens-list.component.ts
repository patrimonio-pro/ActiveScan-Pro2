import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { BensService } from './bens.service';
import { Bem } from '../../shared/models/api.models';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-bens-list',
  standalone: true,
  templateUrl: './bens-list.component.html',
  styleUrls: ['./bens-list.component.css'],
  imports: [RouterLink, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BensListComponent implements OnInit {
  private bensService: BensService = inject(BensService);

  bens = signal<Bem[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  searchTerm = signal('');
  showFavoritesOnly = signal(false);

  bensFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const favoritesOnly = this.showFavoritesOnly();
    
    let filteredBens = this.bens();

    // 1. Apply favorites filter
    if (favoritesOnly) {
      filteredBens = filteredBens.filter(bem => bem.favorito);
    }
    
    // 2. Apply search term filter
    if (term) {
      filteredBens = filteredBens.filter(bem =>
        (bem.numero_patrimonio?.toLowerCase() ?? '').includes(term) ||
        (bem.codigo?.toLowerCase() ?? '').includes(term) ||
        bem.descricao.toLowerCase().includes(term)
      );
    }

    return filteredBens;
  });

  selectedBens = signal(new Set<number>());
  isAllSelected = computed(() => {
    const numFiltered = this.bensFiltrados().length;
    return numFiltered > 0 && this.selectedBens().size === numFiltered;
  });

  ngOnInit() {
    this.loadBens();
  }

  async loadBens() {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const bens = await this.bensService.getBens();
      this.bens.set(bens);
    } catch (err: unknown) {
      let message = 'Falha ao carregar os bens.';
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        message += ` Detalhes: ${err.message}`;
      }
      this.error.set(message);
      console.error(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    // Desmarcar todos ao filtrar para evitar confusão
    this.selectedBens.set(new Set());
  }

  toggleShowFavorites(): void {
    this.showFavoritesOnly.update(value => !value);
    this.selectedBens.set(new Set());
  }

  async toggleFavorito(bemToToggle: Bem, event: Event) {
    event.stopPropagation(); // Prevent row selection change
    
    const newStatus = !bemToToggle.favorito;

    try {
      // Optimistic update for better UX
      this.bens.update(currentBens => {
        return currentBens.map(bem => 
          bem.id === bemToToggle.id ? { ...bem, favorito: newStatus } : bem
        );
      });

      // Call service to persist change
      await this.bensService.toggleFavorito(bemToToggle.id, newStatus);
      
    } catch (err) {
      // Rollback on error
      this.bens.update(currentBens => {
        return currentBens.map(bem => 
          bem.id === bemToToggle.id ? { ...bem, favorito: !newStatus } : bem
        );
      });
      this.error.set('Falha ao atualizar o status de favorito.');
      console.error(err);
    }
  }

  getStatusClass(status: string): string {
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

  toggleSelectBem(id: number): void {
    this.selectedBens.update(currentSet => {
      const newSet = new Set(currentSet);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  toggleSelectAll(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    const filteredIds = this.bensFiltrados().map(b => b.id);
    
    if (isChecked) {
      this.selectedBens.set(new Set(filteredIds));
    } else {
      this.selectedBens.set(new Set());
    }
  }

  exportData(format: 'csv' | 'json' | 'xml' | 'excel' | 'pdf' | 'whatsapp'): void {
    const selectedIds = this.selectedBens();
    const dataToExport = this.bens().filter(bem => selectedIds.has(bem.id));
    if (dataToExport.length === 0) {
      alert('Nenhum bem selecionado para exportar.');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    switch (format) {
      case 'excel':
      case 'csv': {
        const fileContent = this.convertToCSV(dataToExport);
        const filename = `bens_export_${timestamp}.csv`;
        const mimeType = 'text/csv;charset=utf-8;';
        this.downloadFile(fileContent, filename, mimeType);
        break;
      }
      case 'json': {
        const fileContent = JSON.stringify(dataToExport.map(item => {
          const sanitizedItem: { [key: string]: any } = {};
          for (const key in item) {
             sanitizedItem[key] = typeof (item as any)[key] === 'string' ? this.sanitizeString((item as any)[key]) : (item as any)[key];
          }
          return sanitizedItem;
        }), null, 2);
        const filename = `bens_export_${timestamp}.json`;
        const mimeType = 'application/json;charset=utf-8;';
        this.downloadFile(fileContent, filename, mimeType);
        break;
      }
      case 'xml': {
        const fileContent = this.convertToXML(dataToExport);
        const filename = `bens_export_${timestamp}.xml`;
        const mimeType = 'application/xml;charset=utf-8;';
        this.downloadFile(fileContent, filename, mimeType);
        break;
      }
      case 'pdf':
        this.exportToPDF(dataToExport);
        break;
      case 'whatsapp':
        this.shareOnWhatsApp(dataToExport);
        break;
    }
  }
  
  private downloadFile(data: string, filename: string, type: string): void {
    const blob = new Blob([`\uFEFF${data}`], { type }); // Add BOM for Excel compatibility
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  private sanitizeString(str: string | null | undefined): string {
    if (str === null || str === undefined) {
      return '';
    }
    // Using normalize to separate base letters from combining accent marks,
    // then removing the accent marks. Also removes symbols like 'º'.
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/º/g, 'o');
  }
  
  private convertToCSV(data: Bem[]): string {
    if (data.length === 0) return '';
    const headers = [
        'numero_patrimonio', 'codigo', 'descricao', 'situacao', 'categoria',
        'fabricante', 'modelo', 'numero_serie', 'data_aquisicao', 'valor',
        'localizacao', 'responsavel', 'observacoes', 'created_at', 'updated_at'
    ];
    const headerDisplay = [
        'Plaqueta', 'Codigo', 'Descricao', 'Situacao', 'Categoria',
        'Fabricante', 'Modelo', 'N de Serie', 'Data de Aquisicao', 'Valor',
        'Localizacao', 'Responsavel', 'Observacoes', 'Data de Criacao', 'Ultima Atualizacao'
    ];

    const csvRows = [headerDisplay.join(',')];
    
    for (const item of data) {
      const values = headers.map(header => {
        let value = (item as any)[header];
        if (value === null || value === undefined) {
          value = '';
        } else {
            if (header === 'data_aquisicao' && value) {
                value = new Date(value).toLocaleDateString('pt-BR');
            }
            if (header === 'valor' && typeof value === 'number') {
                value = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
        }
        
        const stringValue = this.sanitizeString(String(value));

        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }
  
  private convertToXML(data: Bem[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<bens>\n';
    
    data.forEach(item => {
      xml += `  <bem id="${item.id}">\n`;
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          const value = (item as any)[key];
          const sanitizedValue = this.sanitizeString(value !== null && value !== undefined ? String(value) : '');
          const escapedValue = sanitizedValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
          xml += `    <${key}>${escapedValue}</${key}>\n`;
        }
      }
      xml += '  </bem>\n';
    });
    
    xml += '</bens>';
    return xml;
  }

  private exportToPDF(data: Bem[]): void {
    const headers = ['Plaqueta', 'Descricao', 'Situacao', 'Valor', 'Fabricante', 'Modelo', 'N Serie'];
    const rows = data.map(bem => [
      this.sanitizeString(bem.numero_patrimonio),
      this.sanitizeString(bem.descricao),
      this.sanitizeString(bem.situacao),
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bem.valor || 0),
      this.sanitizeString(bem.fabricante || 'N/A'),
      this.sanitizeString(bem.modelo || 'N/A'),
      this.sanitizeString(bem.numero_serie || 'N/A')
    ]);

    const tableHeader = headers.map(h => `<th>${h}</th>`).join('');
    const tableRows = rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Exportacao de Bens</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            @media print {
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <h1>Relatorio de Bens</h1>
          <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          <table>
            <thead><tr>${tableHeader}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=UTF-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  private shareOnWhatsApp(data: Bem[]): void {
    let message = '*Inventario ActiveScan Pro*\n\n';
    data.forEach((bem, index) => {
      message += `*Item ${index + 1}*\n`;
      message += `Plaqueta: ${this.sanitizeString(bem.numero_patrimonio)}\n`;
      message += `Descricao: ${this.sanitizeString(bem.descricao)}\n`;
      message += `Fabricante: ${this.sanitizeString(bem.fabricante || 'N/A')}\n`;
      message += `Modelo: ${this.sanitizeString(bem.modelo || 'N/A')}\n`;
      message += `N Serie: ${this.sanitizeString(bem.numero_serie || 'N/A')}\n`;
      message += `Situacao: ${this.sanitizeString(bem.situacao)}\n`;
      message += `Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bem.valor || 0)}\n\n`;
    });
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  }
}