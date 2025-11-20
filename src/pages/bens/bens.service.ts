
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { Bem } from '../../shared/models/api.models';
import { AuthService } from '../../auth/auth.service';
import { SupabaseClient } from '@supabase/supabase-js';

const BENS_TABLE = 'bem';
const STORAGE_BUCKET = 'bens_fotos';

// Helper function to convert data URL to a File object
async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}


@Injectable({ providedIn: 'root' })
export class BensService {
  private supabase: SupabaseClient = inject(SupabaseService).client;
  private authService: AuthService = inject(AuthService);

  /**
   * Lista todos os bens da tabela 'bem', filtrando apenas pelos bens
   * que pertencem ao usuário logado.
   */
  async getBens(): Promise<Bem[]> {
    const userId = this.authService.userId;
    if (!userId) {
      return [];
    }

    const { data, error } = await this.supabase
      .from(BENS_TABLE)
      .select('*')
      .eq('usuario_id', userId);

    if (error) {
      console.error('Erro ao buscar bens:', error.message);
      throw error;
    }
    return data || [];
  }

  /**
   * Busca um bem específico pelo ID, garantindo que ele pertença ao usuário logado.
   */
  async getBemById(id: number): Promise<Bem> {
    const userId = this.authService.userId;
    if (!userId) {
      throw new Error('Usuário não autenticado.');
    }

    const { data, error } = await this.supabase
      .from(BENS_TABLE)
      .select('*')
      .eq('id', id)
      .eq('usuario_id', userId) // Security check
      .single();

    if (error) {
      console.error('Erro ao buscar bem por id:', error);
      if (error.code === 'PGRST116') { // Not found or no permission
         throw new Error('Bem não encontrado ou você não tem permissão para acessá-lo.');
      }
      throw error;
    }
    return data;
  }

  /**
   * Busca um bem pelo número de patrimônio (plaqueta), garantindo que ele pertença ao usuário logado.
   */
  async getBemByNumeroPatrimonio(numeroPatrimonio: string): Promise<Bem | null> {
    const userId = this.authService.userId;
    if (!userId) {
      throw new Error('Usuário não autenticado.');
    }

    const { data, error } = await this.supabase
      .from(BENS_TABLE)
      .select('*')
      .eq('numero_patrimonio', numeroPatrimonio)
      .eq('usuario_id', userId) // Security check
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar bem por número de patrimônio:', error);
      throw error;
    }
    return data;
  }

  /**
   * Uploads a photo for a 'bem' to Supabase Storage.
   */
  private async uploadBemFoto(
    userId: string,
    bemId: number | string,
    fotoData: string
  ): Promise<string> {
    const fileExt = 'png';
    // Ensure unique filename to prevent collisions
    const filename = `${bemId}-${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
    const filePath = `${userId}/${filename}`;
    
    const imageFile = await dataUrlToFile(fotoData, filename);

    // Use upsert: true to often bypass strict INSERT-only policies if permissions are broad
    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, imageFile, {
        contentType: 'image/png',
        upsert: true, 
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Error uploading photo:', uploadError);
      // Return empty string or throw? Throwing ensures we catch the RLS error properly
      throw uploadError;
    }
    
    const { data: urlData } = this.supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(uploadData.path);

    return urlData.publicUrl;
  }

  /**
   * Deletes a photo from Supabase Storage based on its public URL.
   */
  private async deleteBemFoto(photoUrl: string): Promise<void> {
    try {
        const url = new URL(photoUrl);
        const pathSegments = url.pathname.split('/');
        const bucketIndex = pathSegments.indexOf(STORAGE_BUCKET);
        if (bucketIndex === -1 || bucketIndex + 1 >= pathSegments.length) {
            throw new Error('Caminho do arquivo inválido na URL.');
        }
        const filePath = pathSegments.slice(bucketIndex + 1).join('/');

        const { error } = await this.supabase.storage
            .from(STORAGE_BUCKET)
            .remove([filePath]);
        
        if (error) {
            console.warn(`Falha ao deletar a foto do storage: ${filePath}`, error);
        }
    } catch (e) {
        console.error('Erro ao processar URL para deleção de foto:', e);
    }
  }

  /**
   * Adiciona um novo bem. Se fotos forem fornecidas, elas são carregadas após a criação do bem.
   */
  async addBem(bemData: Partial<Bem> & { new_photos_data?: string[], deleted_photo_urls?: string[] }): Promise<Bem> {
    const userId = this.authService.userId;
    if (!userId) throw new Error('Usuário não autenticado para adicionar um bem.');

    // Removendo deleted_photo_urls e new_photos_data do objeto que vai para o insert
    const { new_photos_data, deleted_photo_urls, ...bemDetails } = bemData;
    
    if (new_photos_data && new_photos_data.length > 12) {
      throw new Error('Não é possível adicionar um bem com mais de 12 fotos.');
    }

    const { data: newBem, error: insertError } = await this.supabase
      .from(BENS_TABLE)
      .insert({ ...bemDetails, foto_urls: [], usuario_id: userId })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao adicionar bem (fase 1):', insertError);
      throw insertError;
    }
    
    if (!new_photos_data || new_photos_data.length === 0) {
        return newBem; // No photos to upload
    }

    try {
        const uploadPromises = new_photos_data.map(data => this.uploadBemFoto(userId, newBem.id, data));
        const publicUrls = await Promise.all(uploadPromises);
        
        const { data: updatedBem, error: updateError } = await this.supabase
            .from(BENS_TABLE)
            .update({ foto_urls: publicUrls })
            .eq('id', newBem.id)
            .select()
            .single();
        
        if (updateError) throw updateError;
        return updatedBem;

    } catch(uploadError: any) {
        console.error("Upload de fotos falhou, mas o bem foi criado:", uploadError);
        // Important: Do not re-throw if you want the user to at least have the text data saved.
        // However, the user needs to know the photos failed.
        // For now, we re-throw but append context so the component can display a specific warning if needed.
        throw new Error(`O bem foi criado, mas ocorreu um erro ao salvar as fotos: ${uploadError.message || 'Erro desconhecido (RLS)'}`);
    }
  }

  /**
   * Atualiza um bem existente. Lida com adição e remoção de fotos.
   */
 async updateBem(id: number, updates: Partial<Bem> & { new_photos_data?: string[], deleted_photo_urls?: string[] }): Promise<Bem> {
  const userId = this.authService.userId;
  if (!userId) throw new Error('Usuário não autenticado para atualizar um bem.');
  
  const { new_photos_data, deleted_photo_urls, ...updateData } = updates;

  // REMOÇÃO CRUCIAL
  delete updateData.created_at;
  delete updateData.updated_at;

  const { data: currentBem, error: fetchError } = await this.supabase
    .from(BENS_TABLE)
    .select('foto_urls')
    .eq('id', id)
    .single();
  
  if (fetchError) throw fetchError;
  
  let currentUrls = currentBem.foto_urls || [];

  if (deleted_photo_urls && deleted_photo_urls.length > 0) {
      await Promise.all(deleted_photo_urls.map(url => this.deleteBemFoto(url)));
      currentUrls = currentUrls.filter(url => !deleted_photo_urls.includes(url));
  }

  const newUrls: string[] = [];
  if (new_photos_data && new_photos_data.length > 0) {
      if (currentUrls.length + new_photos_data.length > 12) {
          throw new Error('Limite de 12 fotos por bem excedido.');
      }
      const uploadPromises = new_photos_data.map(data => this.uploadBemFoto(userId, id, data));
      newUrls.push(...await Promise.all(uploadPromises));
  }

  updateData.foto_urls = [...currentUrls, ...newUrls];

  const { data, error } = await this.supabase
    .from(BENS_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
    
  if (error) {
    console.error('Erro ao atualizar bem:', error);
    throw error;
  }
  return data;
}


  /**
   * Deleta um bem. O RLS garante que o usuário só possa deletar seus próprios bens.
   */
  async deleteBem(id: number): Promise<void> {
    const { error } = await this.supabase
      .from(BENS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar bem:', error);
      throw error;
    }
  }

  /**
   * Alterna o status de favorito de um bem.
   */
  async toggleFavorito(id: number, newStatus: boolean): Promise<Bem> {
    const { data, error } = await this.supabase
      .from(BENS_TABLE)
      .update({ favorito: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar favorito:', error);
      throw error;
    }
    return data;
  }
}
