import { Component, ChangeDetectionStrategy, output, viewChild, ElementRef, AfterViewInit, OnDestroy, signal } from '@angular/core';

@Component({
  selector: 'app-camera',
  standalone: true,
  templateUrl: './camera.component.html',
  styleUrls: ['./camera.component.css'],
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraComponent implements AfterViewInit, OnDestroy {
  photo = output<string>();
  cancel = output<void>();

  video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  stream: MediaStream | null = null;
  error = signal<string | null>(null);
  isLoading = signal(true);

  async ngAfterViewInit() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        this.video().nativeElement.srcObject = this.stream;
        this.video().nativeElement.play();
        this.isLoading.set(false);
      } else {
        this.error.set('A API da câmera não é suportada neste navegador.');
        this.isLoading.set(false);
      }
    } catch (err) {
      console.error("Erro ao acessar a câmera: ", err);
      let message = 'Ocorreu um erro ao acessar a câmera.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'A permissão para acessar a câmera foi negada. Por favor, habilite nas configurações do seu navegador.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'Nenhuma câmera foi encontrada no dispositivo.';
        }
      }
      this.error.set(message);
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    this.stopStream();
  }

  capture() {
    const videoEl = this.video().nativeElement;
    const canvasEl = this.canvas().nativeElement;
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    const context = canvasEl.getContext('2d');
    context?.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    const dataUrl = canvasEl.toDataURL('image/png');
    this.photo.emit(dataUrl);
    this.stopStream();
  }

  onCancel() {
    this.cancel.emit();
    this.stopStream();
  }

  private stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
}
