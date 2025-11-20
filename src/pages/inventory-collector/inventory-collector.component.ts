import { Component, ChangeDetectionStrategy, inject, signal, effect, computed, viewChild, ElementRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { InventoryService } from './inventory.service';
import { AuthService } from '../../auth/auth.service';
import { BensService } from '../bens/bens.service';
import { InventarioItem } from '../../shared/models/api.models';
import * as XLSX from 'xlsx';
import { QrScannerComponent } from '../../shared/qr-scanner/qr-scanner.component';

type CollectorStatus = 'idle' | 'scanning' | 'locating' | 'saving' | 'syncing' | 'checking_bem' | 'importing';

interface ImportResult {
  fileName: string;
  status: 'success' | 'error';
  message: string;
}

@Component({
  selector: 'app-inventory-collector',
  standalone: true,
  templateUrl: './inventory-collector.component.html',
  styleUrls: ['./inventory-collector.component.css'],
  imports: [DatePipe, QrScannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryCollectorComponent {
  inventoryService: InventoryService = inject(InventoryService);
  authService: AuthService = inject(AuthService);
  bensService: BensService = inject(BensService);

  status = signal<CollectorStatus>('idle');
  lastScan = signal<string | null>(null);
  lastLocation = signal<{ lat: number, lon: number } | null>(null);
  syncMessage = signal<string | null>(null);
  importResults = signal<ImportResult[]>([]);
  isScanning = signal(false);

  collectedItems = this.inventoryService.getCollectedItems();
  unsyncedCount = computed(() => this.collectedItems().filter(i => !i.is_synced).length);

  fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  constructor() {
    // Reset sync message after a while
    effect((onCleanup) => {
        if(this.syncMessage()) {
            const timer = setTimeout(() => this.syncMessage.set(null), 4000);
            onCleanup(() => clearTimeout(timer));
        }
    });
  }

  onScan() {
    if (this.status() !== 'idle') return;
    this.status.set('scanning');
    this.isScanning.set(true);
  }

  async onScanSuccess(code: string) {
    this.isScanning.set(false);
    if(this.collectedItems().find(item => item.plaqueta_lida === code && !item.is_synced)) {
        alert('Este item já foi coletado e está pendente de sincronização.');
        this.status.set('idle');
        return;
    }
    this.lastScan.set(code);
    this.status.set('idle');
    // Automatically perform the next step
    this.onLocateAndSave();
  }

  onScanCancel() {
    this.isScanning.set(false);
    this.status.set('idle');
  }

  async onLocateAndSave() {
    const plaqueta = this.lastScan();
    if (this.status() !== 'idle' || !plaqueta) return;
    
    this.status.set('checking_bem');
    const bem = await this.bensService.getBemByNumeroPatrimonio(plaqueta);
    
    this.status.set('locating');
    try {
      const position = await this.inventoryService.getCurrentPosition();
      this.lastLocation.set(position);
      this.status.set('saving');

      // Fix: Explicitly declare the type for status to prevent it from being widened to 'string'.
      const statusConciliacao: InventarioItem['status_conciliacao'] = bem ? 'conciliado' : 'nao_encontrado';

      const newItem = {
        bem_id: bem ? bem.id : null,
        plaqueta_lida: plaqueta,
        data_coleta: new Date().toISOString(),
        usuario_coleta_id: this.authService.currentUser()!.id,
        latitude: position.lat,
        longitude: position.lon,
        status_conciliacao: statusConciliacao,
      };

      await this.inventoryService.saveItemLocally(newItem);
      this.lastScan.set(null);
      this.lastLocation.set(null);
      this.status.set('idle');
    } catch (error) {
      console.error('Error getting location or saving', error);
      this.status.set('idle');
    }
  }

  async onSync() {
      if (this.status() !== 'idle') return;
      this.status.set('syncing');
      try {
        const result = await this.inventoryService.syncWithBackend();
        if (result.success) {
          this.syncMessage.set(`${result.synced} itens sincronizados com sucesso!`);
        }
      } catch (error) {
        this.syncMessage.set(`Falha ao sincronizar.`);
      } finally {
        this.status.set('idle');
      }
  }

  onImportClick() {
    this.fileInput().nativeElement.value = ''; // Reset to allow re-selecting the same file
    this.fileInput().nativeElement.click();
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
  
    this.status.set('importing');
    this.importResults.set([]); // Clear previous results
  
    const files = Array.from(input.files);
    const results: ImportResult[] = [];
  
    for (const file of files) {
      try {
        const parsedData = await this.parseFile(file);
        const processedCount = await this.processImportedData(parsedData);
        results.push({
          fileName: file.name,
          status: 'success',
          message: `${processedCount} itens importados com sucesso e salvos localmente.`
        });
      } catch (error: any) {
        console.error(`Erro ao importar o arquivo ${file.name}:`, error);
        results.push({
          fileName: file.name,
          status: 'error',
          message: `Falha na importação: ${error.message}`
        });
      }
    }
  
    this.importResults.set(results);
    this.status.set('idle');
  }

  clearImportResults() {
    this.importResults.set([]);
  }

  private parseFile(file: File): Promise<any[]> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = (e: any) => {
        try {
          const content = e.target.result;
          let data: any[] = [];
          switch (extension) {
            case 'json':
              data = JSON.parse(content);
              break;
            case 'csv':
              data = this.parseCsv(content);
              break;
            case 'xlsx':
            case 'xls':
              const workbook = XLSX.read(content, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              data = XLSX.utils.sheet_to_json(worksheet);
              break;
            case 'xml':
              data = this.parseXml(content);
              break;
            default:
              reject(new Error(`Formato de arquivo .${extension} não suportado.`));
              return;
          }
          resolve(Array.isArray(data) ? data : [data]);
        } catch (err) {
          reject(new Error(`Erro ao processar o arquivo ${file.name}. Verifique o formato.`));
        }
      };
      reader.onerror = (error) => reject(error);

      if (extension === 'xlsx' || extension === 'xls') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  }
  
  private parseCsv(content: string): any[] {
    const lines = content.split(/\r\n|\n/);
    if (lines.length < 2) return [];
    
    const parseLine = (line: string) => {
        const result: string[] = [];
        let current = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (line[i+1] === '"') { // Handle escaped quote
                    current += '"';
                    i++;
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const values = parseLine(lines[i]);
      const obj: { [key: string]: string } = {};
      headers.forEach((header, index) => {
        obj[header] = values[index];
      });
      data.push(obj);
    }
    return data;
  }

  private parseXml(content: string): any[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "text/xml");
    const items = Array.from(xmlDoc.documentElement.children);
    
    return items.map(item => {
      const obj: { [key: string]: string } = {};
      for (const child of Array.from(item.children)) {
        obj[child.tagName] = child.textContent || '';
      }
      return obj;
    });
  }

  private async processImportedData(data: any[]): Promise<number> {
    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      throw new Error("Usuário não autenticado.");
    }

    const identifierKeys = ['plaqueta', 'numero_patrimonio', 'patrimonio', 'asset_tag', 'assetid', 'codigo', 'id'];
    let processedCount = 0;

    for (const record of data) {
      let plaqueta: string | null = null;
      let identifierKeyFound: string | null = null;
      
      const recordKeyMap = new Map(Object.keys(record).map(k => [k.toLowerCase(), k]));

      for (const key of identifierKeys) {
        if (recordKeyMap.has(key)) {
          const originalKey = recordKeyMap.get(key)!;
          const value = record[originalKey];
          if (value) {
            plaqueta = String(value);
            identifierKeyFound = originalKey;
            break;
          }
        }
      }

      if (!plaqueta) {
        console.warn('Registro ignorado por falta de um identificador (ex: plaqueta, numero_patrimonio):', record);
        continue;
      }
      
      if(this.collectedItems().find(item => item.plaqueta_lida === plaqueta && !item.is_synced)) {
          console.warn(`Item ${plaqueta} já coletado e pendente de sincronização, ignorando importação.`);
          continue;
      }
      
      const bem = await this.bensService.getBemByNumeroPatrimonio(plaqueta);
      const statusConciliacao: InventarioItem['status_conciliacao'] = bem ? 'conciliado' : 'nao_encontrado';

      const observacoes = Object.entries(record)
        .filter(([key]) => key !== identifierKeyFound)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      const newItem: Omit<InventarioItem, 'id' | 'is_synced'> = {
        bem_id: bem ? bem.id : null,
        plaqueta_lida: plaqueta,
        data_coleta: new Date().toISOString(),
        usuario_coleta_id: userId,
        status_conciliacao: statusConciliacao,
        observacao: observacoes,
      };

      await this.inventoryService.saveItemLocally(newItem);
      processedCount++;
    }
    return processedCount;
  }
}