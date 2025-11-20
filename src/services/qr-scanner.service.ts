import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class QrScannerService {
  /**
   * Mocks scanning a QR code.
   * In a real app, this would use a library like zxing-ngx-scanner or similar
   * and interact with the device camera.
   * @returns A promise that resolves with the scanned string.
   */
  scanQrCode(): Promise<string> {
    console.log('Mocking QR code scan...');
    return new Promise((resolve) => {
      setTimeout(() => {
        const randomPlaqueta = `PAT-${Math.floor(100000 + Math.random() * 900000)}`;
        resolve(randomPlaqueta);
      }, 1200);
    });
  }
}
