import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PwaInstallService {
  private deferredPrompt: any = null;

  // sinal para o botão aparecer automaticamente quando o evento estiver disponível
  canInstall = signal(false);

  constructor() {
    // Capturar o evento do navegador
    window.addEventListener('beforeinstallprompt', (event: any) => {
      event.preventDefault();
      this.deferredPrompt = event;

      // habilita o botão de instalação
      this.canInstall.set(true);
    });
  }

  // Método para disparar o prompt
  async install() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const choiceResult = await this.deferredPrompt.userChoice;

    console.log('Resultado da instalação PWA:', choiceResult.outcome);

    this.deferredPrompt = null;
    this.canInstall.set(false);
  }
}
