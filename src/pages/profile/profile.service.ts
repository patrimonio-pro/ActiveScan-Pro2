import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../auth/auth.service';
import { PessoaFisica, PessoaJuridica } from '../../shared/models/api.models';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private supabase: SupabaseClient = inject(SupabaseService).client;
  private authService: AuthService = inject(AuthService);

  async getProfile(): Promise<PessoaFisica | PessoaJuridica | null> {
    const userProfile = this.authService.userProfile();
    const userId = this.authService.userId;

    if (!userProfile || !userId) {
      throw new Error('Usuário não autenticado ou perfil não encontrado.');
    }

    const tableName = userProfile.tipo === 'Pessoa Física' ? 'pessoa_fisica' : 'pessoa_juridica';

    const { data, error } = await this.supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error(`Erro ao buscar perfil detalhado da tabela ${tableName}:`, error);
      throw error;
    }

    return data;
  }

  async updateProfile(profileData: Partial<PessoaFisica | PessoaJuridica>): Promise<any> {
    const userProfile = this.authService.userProfile();
    const userId = this.authService.userId;

    if (!userProfile || !userId) {
      throw new Error('Usuário não autenticado ou perfil não encontrado.');
    }
    
    const isFisica = userProfile.tipo === 'Pessoa Física';
    const tableName = isFisica ? 'pessoa_fisica' : 'pessoa_juridica';
    const documentField = isFisica ? 'cpf' : 'cnpj';
    const documentValue = (profileData as any)[documentField];

    // 1. Check for document duplication if the document value is present
    if (documentValue) {
        const { data: existingProfile, error: checkError } = await this.supabase
            .from(tableName)
            .select('user_id')
            .eq(documentField, documentValue)
            .neq('user_id', userId) // IMPORTANT: Exclude the current user from the check
            .maybeSingle();

        if (checkError) {
            console.error('Erro ao verificar a duplicação do documento:', checkError);
            throw new Error('Não foi possível verificar a disponibilidade do documento. Tente novamente.');
        }

        if (existingProfile) {
            const documentName = isFisica ? 'CPF' : 'CNPJ';
            throw new Error(`O ${documentName} informado já está em uso por outro usuário.`);
        }
    }


    // 2. If no duplicate is found, proceed with the update
    const { data, error } = await this.supabase
      .from(tableName)
      .update(profileData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao atualizar perfil na tabela ${tableName}:`, error);
      throw error;
    }
    
    return data;
  }
  
  /**
   * Invoca uma função RPC no Supabase para deletar a conta do usuário.
   * IMPORTANTE: Você precisa criar esta função no seu banco de dados Supabase.
   * Vá para "Database" -> "Functions" -> "Create a new function" e use o SQL abaixo.
   * Isso garante que todos os seus dados relacionados ao usuário sejam removidos de forma segura.
   *
   * CREATE OR REPLACE FUNCTION delete_user_account()
   * RETURNS void
   * LANGUAGE plpgsql
   * SECURITY DEFINER
   * AS $$
   * BEGIN
   *   -- Adicione 'delete from' para qualquer outra tabela que tenha uma FK para auth.uid()
   *   DELETE FROM public.pessoa_fisica WHERE user_id = auth.uid();
   *   DELETE FROM public.pessoa_juridica WHERE user_id = auth.uid();
   *   DELETE FROM public.usuario_permissao WHERE user_id = auth.uid();
   *   
   *   -- Por último, remove o usuário da tabela de autenticação
   *   DELETE FROM auth.users WHERE id = auth.uid();
   * END;
   * $$;
   */
  async deleteAccount(): Promise<void> {
    const { error } = await this.supabase.rpc('delete_user_account');

    if (error) {
      console.error('Erro ao chamar a RPC para deletar a conta:', error);
      throw error;
    }
  }
}