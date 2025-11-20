import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { UserProfile, Permissao } from '../../shared/models/api.models';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private supabase: SupabaseClient = inject(SupabaseService).client;

  async getUsers(): Promise<UserProfile[]> {
    // This now queries the unified view which includes permissions.
    // The user must update this view in Supabase first.
    const { data, error } = await this.supabase
      .from('vw_usuarios')
      .select('user_id, nome, email, tipo, documento, permissoes');

    if (error) {
      console.error('Erro ao buscar usuários da view vw_usuarios:', error);
      throw error;
    }
    
    // The data from the view should already match the UserProfile structure.
    const users = data || [];
    return (users as UserProfile[]).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }

  /**
   * Reseta a senha de um usuário específico. Esta função DEVE ser chamada apenas por um administrador.
   * IMPORTANTE: Esta função depende de uma Supabase Edge Function chamada `admin-reset-user-password`.
   * Você precisa criar esta função no seu projeto Supabase para que esta funcionalidade opere corretamente.
   *
   * --- INSTRUÇÕES PARA A EDGE FUNCTION ---
   * 1. Crie uma nova função: `supabase functions new admin-reset-user-password`
   * 2. Substitua o conteúdo de `/supabase/functions/admin-reset-user-password/index.ts` pelo código abaixo.
   * 3. Implante a função: `supabase functions deploy admin-reset-user-password --project-ref <seu-ref-do-projeto>`
   *
   * --- CÓDIGO PARA A EDGE FUNCTION (index.ts) ---
   *
   * import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
   *
   * // Função para gerar uma senha aleatória segura
   * function generateTemporaryPassword(length = 12) {
   *   const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
   *   let password = "";
   *   for (let i = 0; i < length; i++) {
   *     const randomIndex = Math.floor(Math.random() * charset.length);
   *     password += charset[randomIndex];
   *   }
   *   return password;
   * }
   *
   * Deno.serve(async (req) => {
   *   // 1. Inicializa o cliente Supabase com privilégios de administrador
   *   const supabaseAdmin = createClient(
   *     Deno.env.get('SUPABASE_URL') ?? '',
   *     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
   *   );
   *
   *   // 2. Extrai o ID do usuário a ser resetado do corpo da requisição
   *   const { userIdToReset } = await req.json();
   *   if (!userIdToReset) {
   *     return new Response(JSON.stringify({ error: 'ID do usuário não fornecido.' }), { status: 400 });
   *   }
   *
   *   // 3. Verifica se o chamador da função é um administrador
   *   const authHeader = req.headers.get('Authorization')!;
   *   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
   *   const { data: { user } } = await supabase.auth.getUser();
   *
   *   if (!user) {
   *     return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401 });
   *   }
   *
   *   const { data: adminCheck, error: adminError } = await supabase.rpc('is_admin');
   *   if (adminError || !adminCheck) {
   *     return new Response(JSON.stringify({ error: 'Acesso negado. Requer privilégios de administrador.' }), { status: 403 });
   *   }
   *
   *   // 4. Gera a nova senha temporária
   *   const temporaryPassword = generateTemporaryPassword();
   *
   *   // 5. Atualiza a senha do usuário e adiciona um metadado para forçar a alteração no próximo login
   *   const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
   *     userIdToReset,
   *     {
   *       password: temporaryPassword,
   *       user_metadata: { must_change_password: true },
   *     }
   *   );
   *
   *   if (updateError) {
   *     return new Response(JSON.stringify({ error: `Falha ao atualizar usuário: ${updateError.message}` }), { status: 500 });
   *   }
   *
   *   // 6. Retorna a senha temporária para o front-end
   *   return new Response(
   *     JSON.stringify({ temporaryPassword }),
   *     { headers: { 'Content-Type': 'application/json' } }
   *   );
   * });
   */
  async adminResetUserPassword(userId: string): Promise<{ temporaryPassword: string }> {
    const { data, error } = await this.supabase.functions.invoke('admin-reset-user-password', {
      body: { userIdToReset: userId },
    });

    if (error) {
      console.error('Erro ao invocar a Edge Function admin-reset-user-password:', error);
      throw new Error(`Falha ao resetar a senha: ${error.message || 'Verifique o log da sua Edge Function.'}`);
    }

    return data;
  }

  async getAllPermissions(): Promise<Permissao[]> {
    const { data, error } = await this.supabase
      .from('permissao')
      .select('id, descricao');
    
    if (error) {
      console.error('Erro ao buscar permissões:', error);
      throw error;
    }
    return data || [];
  }

  async addUserPermission(userId: string, permissionId: number): Promise<void> {
    const { error } = await this.supabase
      .from('usuario_permissao')
      .insert({ user_id: userId, permissao_id: permissionId });

    if (error) {
      console.error('Erro ao adicionar permissão:', error);
      throw error;
    }
  }

  async removeUserPermission(userId: string, permissionId: number): Promise<void> {
    const { error } = await this.supabase
      .from('usuario_permissao')
      .delete()
      .eq('user_id', userId)
      .eq('permissao_id', permissionId);

    if (error) {
      console.error('Erro ao remover permissão:', error);
      throw error;
    }
  }
}