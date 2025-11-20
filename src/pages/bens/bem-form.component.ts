import { Component, ChangeDetectionStrategy, input, output, OnInit, signal, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Bem } from '../../shared/models/api.models';
import { CameraComponent } from '../../shared/camera/camera.component';

// Custom validator to prevent future dates
export function noFutureDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const dateValue = control.value;
    if (!dateValue) {
      return null; // Don't validate if empty
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to 00:00:00 to compare dates only

    // input[type=date] gives 'YYYY-MM-DD'. new Date() parses this as UTC.
    // To treat it as local date, we can append T00:00:00.
    const inputDate = new Date(`${dateValue}T00:00:00`);

    return inputDate > today ? { futureDate: true } : null;
  };
}

@Component({
  selector: 'app-bem-form',
  standalone: true,
  templateUrl: './bem-form.component.html',
  styleUrls: ['./bem-form.component.css'],
  imports: [ReactiveFormsModule, CameraComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BemFormComponent implements OnInit {
  bem = input<Bem | null>(null);
  save = output<Partial<Bem> & { new_photos_data?: string[], deleted_photo_urls?: string[] }>();
  cancel = output<void>();

  private fb: FormBuilder = inject(FormBuilder);

  bemForm: FormGroup;
  isEditing = false;
  isCameraOpen = signal(false);

  // Photo state management signals
  photoPreviews = signal<string[]>([]); // URLs for display (http or data URI)
  newPhotosData = signal<string[]>([]); // New base64 images to be uploaded
  deletedPhotoUrls = signal<string[]>([]); // Existing http URLs to be deleted

  constructor() {
    this.bemForm = this.fb.group({
      codigo: ['', Validators.required],
      descricao: ['', Validators.required],
      numero_patrimonio: ['', Validators.required],
      situacao: ['ativo' as Bem['situacao'], Validators.required],
      categoria: [''],
      localizacao: [''],
      responsavel: [''],
      data_aquisicao: [null, [noFutureDateValidator()]],
      valor: [null, [Validators.min(0)]],
      numero_serie: [''],
      fabricante: [''],
      modelo: [''],
      observacoes: [''],
      estado_conservacao_dep: [5, [Validators.required, Validators.min(0), Validators.max(10)]],
      created_at: [{ value: null, disabled: true }],
      updated_at: [{ value: null, disabled: true }],
    });
  }

  ngOnInit() {
    const bemAtual = this.bem();
    if (bemAtual) {
      this.isEditing = true;

      const formatOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        timeZone: 'America/Sao_Paulo',
      };

      const formatDateForBrazil = (dateString: string): string => {
        return new Date(dateString).toLocaleString('pt-BR', formatOptions);
      };

      const formattedBem = {
        ...bemAtual,
        data_aquisicao: bemAtual.data_aquisicao ? new Date(bemAtual.data_aquisicao).toISOString().split('T')[0] : null,
        created_at: bemAtual.created_at ? formatDateForBrazil(bemAtual.created_at) : 'N/A',
        updated_at: bemAtual.updated_at ? formatDateForBrazil(bemAtual.updated_at) : (bemAtual.created_at ? formatDateForBrazil(bemAtual.created_at) : 'N/A')
      };
      this.bemForm.patchValue(formattedBem);

      if (bemAtual.foto_urls) {
        this.photoPreviews.set([...bemAtual.foto_urls]);
      }
    }
  }

  openCamera() {
    if (this.photoPreviews().length >= 12) {
      alert('Você atingiu o limite máximo de 12 fotos por bem.');
      return;
    }
    this.isCameraOpen.set(true);
  }

  closeCamera() {
    this.isCameraOpen.set(false);
  }

  onPhotoTaken(dataUrl: string) {
    if (this.photoPreviews().length < 12) {
      this.photoPreviews.update(p => [...p, dataUrl]);
      this.newPhotosData.update(d => [...d, dataUrl]);
    }
    this.closeCamera();
  }
  
  deletePhoto(photoUrl: string, index: number) {
    if (confirm('Tem certeza que deseja remover esta foto?')) {
      if (photoUrl.startsWith('http')) {
        this.deletedPhotoUrls.update(urls => [...urls, photoUrl]);
      } else {
        this.newPhotosData.update(data => data.filter(d => d !== photoUrl));
      }
      this.photoPreviews.update(p => p.filter((_, i) => i !== index));
    }
  }

  onSubmit() {
    if (this.bemForm.valid) {
      this.save.emit({
        ...this.bemForm.getRawValue(),
        new_photos_data: this.newPhotosData(),
        deleted_photo_urls: this.deletedPhotoUrls()
      });
    } else {
      this.bemForm.markAllAsTouched();
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
