import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseClient, Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '../services/supabase.service';
import { AuthSession } from '@supabase/supabase-js';
import { UserProfile } from '../shared/models/api.models';
import { ErrorService } from '../services/error.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabase: SupabaseClient = inject(SupabaseService).client;
  private router: Router = inject(Router);
  private errorService: ErrorService = inject(ErrorService);
  private _session: AuthSession | null = null;

  currentUser = signal<User | null>(null);
  userProfile = signal<UserProfile | null>(null);
  isLoggedIn = signal<boolean>(false);
  isAdmin = computed(() => this.userProfile()?.permissoes?.split(',').map(p => p.trim().toUpperCase()).includes('ROLE_ADMIN') ?? false);

  private resolveInitialAuthCheck?: (value: void | PromiseLike<void>) => void;
  private initialAuthCheckCompleted: Promise<void> = new Promise((resolve) => {
    this.resolveInitialAuthCheck = resolve;
  });

  constructor() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      // Don't use async here to avoid listener response issues
      // Instead, handle async operations and resolve at the end
      (async () => {
        try {
          this._session = session;
          const user = session?.user ?? null;

          if (event === 'PASSWORD_RECOVERY') {
            this.router.navigate(['/update-password']);
          } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
            this.currentUser.set(user);
            this.isLoggedIn.set(!!user);
    
            if (user) {
              await this.fetchUserProfile(user.id); // Fetch profile on any valid session
              if (user.user_metadata?.must_change_password) {
                if (!this.router.url.includes('/force-update-password')) {
                  this.router.navigate(['/force-update-password']);
                }
              } else if (event === 'SIGNED_IN' && (this.router.url.startsWith('/login') || this.router.url.startsWith('/register'))) {
                this.router.navigate(['/dashboard']);
              }
            } else {
              // This case handles when INITIAL_SESSION returns a null session
              this.currentUser.set(null);
              this.userProfile.set(null);
              this.isLoggedIn.set(false);
            }
          } else if (event === 'SIGNED_OUT') {
            this.currentUser.set(null);
            this.userProfile.set(null);
            this.isLoggedIn.set(false);
          }
        } catch (error) {
          console.error('Critical error in onAuthStateChange handler:', error);
          this.errorService.setGlobalError('Ocorreu um erro crítico na sessão. Por favor, recarregue a página.');
          // Ensure a clean logged-out state on any error
          this.currentUser.set(null);
          this.userProfile.set(null);
          this.isLoggedIn.set(false);
        } finally {
          // Unblock the APP_INITIALIZER on the first auth event, regardless of success or failure.
          if (this.resolveInitialAuthCheck) {
            this.resolveInitialAuthCheck();
            this.resolveInitialAuthCheck = undefined; // Ensure it's only called once
          }
        }
      })();
    });
  }

  /**
   * This method is called by the APP_INITIALIZER.
   * It returns a promise that resolves once the initial authentication state has been determined
   * by the onAuthStateChange listener, thus preventing the app from rendering prematurely.
   */
  checkSession(): Promise<void> {
    return this.initialAuthCheckCompleted;
  }
  
  private async fetchUserProfile(userId: string) {
    const { data, error } = await this.supabase
        .from('vw_usuarios')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Failed to fetch user profile due to a database error:', error);
        throw new Error(`Falha ao buscar perfil do usuário: ${error.message}`);
    }

    if (!data) {
        console.warn(
          `User profile not found for user ID: ${userId}. This is expected for new users or admins without a profile record in 'pessoa_fisica' or 'pessoa_juridica'.`
        );
        this.userProfile.set(null);
    } else {
        this.userProfile.set(data as UserProfile);
    }
  }

  public async refreshUserProfile() {
    const userId = this.currentUser()?.id;
    if (userId) {
        await this.fetchUserProfile(userId);
    }
  }

  async signIn(credentials: { email: string; password: string; }) {
    const { data, error } = await this.supabase.auth.signInWithPassword(credentials);
    
    // The redirect logic is now fully handled by the onAuthStateChange listener,
    // ensuring consistency whether it's a new login or a session restoration.

    return { data, error };
  }

  async signUp(credentials: { email: string; password: string; }, profileData: Omit<any, 'user_id'>, profileType: 'pessoa_fisica' | 'pessoa_juridica') {
    // Passo 0: Verificar duplicidade de documento (CPF/CNPJ) ANTES de criar o usuário de autenticação.
    const documentType = profileType === 'pessoa_fisica' ? 'cpf' : 'cnpj';
    const documentValue = profileData[documentType as keyof typeof profileData];

    if (documentValue) {
        const { data: existingProfile, error: checkError } = await this.supabase
            .from(profileType)
            .select(documentType)
            .eq(documentType, documentValue)
            .maybeSingle(); // Use maybeSingle para obter um ou nulo, não um erro se não for encontrado.

        if (checkError) {
            console.error('Erro ao verificar a duplicação do documento:', checkError);
            throw new Error('Não foi possível verificar a disponibilidade do documento. Tente novamente.');
        }

        if (existingProfile) {
            const documentName = profileType === 'pessoa_fisica' ? 'CPF' : 'CNPJ';
            throw new Error(`O ${documentName} informado já está em uso por outro usuário.`);
        }
    }
    
    // Passo 1: Cadastrar o usuário no Supabase Auth.
    // O Supabase Auth já trata a duplicidade de e-mail.
    const { data: authData, error: authError } = await this.supabase.auth.signUp(credentials);

    if (authError) {
        // A mensagem de erro de autenticação do Supabase para duplicatas é "User already registered"
        if (authError.message.toLowerCase().includes('user already registered')) {
            throw new Error('Este e-mail já está cadastrado. Tente fazer login ou use um e-mail diferente.');
        }
        throw authError;
    }

    if (!authData.user) {
        throw new Error("Cadastro bem-sucedido, mas os dados do usuário não foram retornados.");
    }

    // Passo 2: Inserir os dados do perfil na tabela correspondente.
    // A verificação de duplicidade de documento já foi feita, então o risco de falha aqui é menor.
    const { error: profileError } = await this.supabase
      .from(profileType)
      .insert({ ...profileData, user_id: authData.user.id });

    if (profileError) {
      // Isso ainda pode falhar por outros motivos (por exemplo, RLS, banco de dados inativo), criando um usuário órfão.
      // A pré-verificação minimiza a causa de falha mais comum (restrição de unicidade).
      console.error(`Usuário de autenticação criado, mas a inserção do perfil falhou. User ID: ${authData.user.id}. Erro:`, profileError);
      throw new Error(`Ocorreu um erro ao salvar os detalhes do perfil: ${profileError.message}`);
    }

    return { user: authData.user };
  }


  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    // Navigation is reactively handled by an effect in AppComponent
    // which listens for auth state changes. This avoids redundant navigation calls.
    
    // Explicitly set state to false on sign out to ensure reactive components update.
    this.currentUser.set(null);
    this.userProfile.set(null);
    this.isLoggedIn.set(false);

    return { error };
  }

  async sendPasswordResetEmail(email: string) {
    return this.supabase.auth.resetPasswordForEmail(email);
  }

  async updatePassword(password: string) {
    return this.supabase.auth.updateUser({ password });
  }

  async forceUpdatePassword(password: string) {
    return this.supabase.auth.updateUser({
      password,
      data: { must_change_password: false } // Clear metadata flag
    });
  }

  get session(): AuthSession | null {
    return this._session;
  }
    // Returns the UID (User ID) of the logged-in user
  get userId(): string | undefined {
    return this._session?.user.id;
  }
}
