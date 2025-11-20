import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  globalError = signal<string | null>(null);

  setGlobalError(message: string) {
    this.globalError.set(message);
  }

  clearGlobalError() {
    this.globalError.set(null);
  }
}
