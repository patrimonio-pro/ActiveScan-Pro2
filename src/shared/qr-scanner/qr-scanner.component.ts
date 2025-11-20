import { Component, ChangeDetectionStrategy, output, viewChild, ElementRef, AfterViewInit, OnDestroy, signal } from '@angular/core';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  templateUrl: './qr-scanner.component.html',
  styleUrls: ['./qr-scanner.component.css'],
  imports: [],
})
export class QrScannerComponent implements AfterViewInit, OnDestroy {
  scanSuccess = output<string>();
  scanCancel = output<void>();

  video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  error = signal<string | null>(null);
  isLoading = signal(true);
  isTorchSupported = signal(false);
  isTorchOn = signal(false);
  
  private codeReader: BrowserMultiFormatReader;
  private stream: MediaStream | null = null;

  constructor() {
    const hints = new Map();
    const formats = [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.AZTEC,
        BarcodeFormat.PDF_417,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    // Add try harder hint for better accuracy with noisy images.
    hints.set(DecodeHintType.TRY_HARDER, true);
    this.codeReader = new BrowserMultiFormatReader(hints);
  }

    async ngAfterViewInit() {
    try {
      const videoElement = this.video().nativeElement;
      // Request higher resolution and continuous focus for better scanning accuracy.
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // Remove 'advanced' constraint as it's not supported in standard MediaTrackConstraints.
          // Use @ts-ignore if needed for custom constraints, but it's causing type errors.
          // For continuous focus, rely on browser default behavior or test on device.
        }
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.checkTorchSupport(); // Check for torch support after getting the stream
      videoElement.srcObject = this.stream;
      videoElement.setAttribute('playsinline', 'true'); // Ensure inline playback on iOS

      // Wait for metadata to load to ensure we have dimensions before decoding
      await new Promise<void>((resolve) => {
        if (videoElement.readyState >= 1) {
            resolve();
        } else {
            videoElement.onloadedmetadata = () => resolve();
        }
      });

      await videoElement.play();
      this.isLoading.set(false);
      
      this.codeReader.decodeContinuously(videoElement, (result, err) => {
        if (result) {
          this.scanSuccess.emit(result.getText());
          this.stopScan();
        }
        // This error is expected when no code is found in a frame. Using instanceof is a robust
        // way to filter these out and prevent spamming the console.
        if (err && !(err instanceof NotFoundException)) {
          const msg = err instanceof Error ? err.message : String(err);
          // Suppress the specific "source width is 0" error if it happens momentarily
          if (!msg.includes('source width is 0')) {
             console.error('QR Scanner Error:', err);
          }
        }
      });

    } catch (err) {
      console.error("Error accessing camera for scanning: ", err);
      let message = 'Ocorreu um erro ao acessar a câmera.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'A permissão para acessar a câmera foi negada. Verifique as permissões de câmera para este site nas configurações do seu navegador e também as permissões do próprio aplicativo.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'Nenhuma câmera traseira foi encontrada no dispositivo.';
        } else if (err.name === 'NotReadableError') {
           message = 'A câmera já está em uso por outra aplicação ou aba do navegador.';
        }
      }
      this.error.set(message);
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    this.stopScan();
  }

  onCancel() {
    this.scanCancel.emit();
    this.stopScan();
  }
  
  private checkTorchSupport() {
    if (!this.stream) return;
    const videoTrack = this.stream.getVideoTracks()[0];
    if (videoTrack && 'getCapabilities' in videoTrack) {
      const capabilities = videoTrack.getCapabilities();
      // @ts-ignore - torch is a valid capability but might not be in all TS lib versions
      if (capabilities.torch) {
        this.isTorchSupported.set(true);
      }
    }
  }
  
  toggleTorch() {
    if (!this.isTorchSupported() || !this.stream) {
      return;
    }
    const newTorchState = !this.isTorchOn();
    const videoTrack = this.stream.getVideoTracks()[0];
    videoTrack.applyConstraints({
      // @ts-ignore
      advanced: [{ torch: newTorchState }]
    }).then(() => {
      this.isTorchOn.set(newTorchState);
    }).catch(e => {
      console.error('Failed to toggle torch:', e);
      this.error.set('Não foi possível ativar a lanterna.');
    });
  }

  private stopScan() {
    // Turn off torch before stopping stream to prevent it from staying on.
    if (this.isTorchOn()) {
        const videoTrack = this.stream?.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.applyConstraints({
                // @ts-ignore
                advanced: [{ torch: false }]
            });
        }
    }

    // Use reset() to stop the decoding loop and release resources.
    this.codeReader.reset();
    
    // Also, manually stop all tracks on the stream to ensure the camera light turns off.
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
    }
  }
}