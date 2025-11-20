import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { UsersService } from './users.service';
import { UserProfile, Permissao } from '../../shared/models/api.models';

@Component({
  selector: 'app-users-list',
  standalone: true,
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css'],
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersListComponent implements OnInit {
  private usersService: UsersService = inject(UsersService);

  // State for user list
  users = signal<UserProfile[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  // State for permission management modal
  isManageModalOpen = signal(false);
  selectedUser = signal<UserProfile | null>(null);
  allPermissions = signal<Permissao[]>([]);
  
  // Stores a map of permission ID to its description for quick lookup
  userPermissions = signal<Map<number, string>>(new Map());
  isLoadingPermissions = signal(false);
  
  // State for temporary password modal
  isTempPasswordModalOpen = signal(false);
  tempPassword = signal('');
  isResettingPassword = signal(false);
  resetPasswordError = signal<string|null>(null);

  // Computed property to quickly check if a user has a specific permission
  hasPermission = computed(() => (permissionId: number) => this.userPermissions().has(permissionId));

  ngOnInit() {
    this.loadUsers();
  }

  async loadUsers() {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const users = await this.usersService.getUsers();
      this.users.set(users);
    } catch (err: any) {
      this.error.set('Falha ao carregar os usuários. Verifique as permissões de acesso (RLS) e se a view `vw_usuarios` foi atualizada corretamente no Supabase.');
      console.error(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async openManageModal(user: UserProfile) {
    this.selectedUser.set(user);
    this.isLoadingPermissions.set(true);
    this.isManageModalOpen.set(true);
    this.resetPasswordError.set(null); // Clear previous errors

    try {
      // Fetch all available permissions
      const allPerms = await this.usersService.getAllPermissions();
      this.allPermissions.set(allPerms);

      // Create a map of the user's current permissions from the aggregated string
      const userPermsMap = new Map<number, string>();
      if (user.permissoes) {
        const userPermsArray = user.permissoes.split(',').map(p => p.trim());
        for (const p of userPermsArray) {
          const matchingPerm = allPerms.find(ap => ap.descricao === p);
          if (matchingPerm) {
            userPermsMap.set(matchingPerm.id, matchingPerm.descricao);
          }
        }
      }
      this.userPermissions.set(userPermsMap);

    } catch (e) {
      this.error.set('Falha ao carregar detalhes de permissão.');
      this.closeManageModal();
    } finally {
      this.isLoadingPermissions.set(false);
    }
  }

  closeManageModal() {
    this.isManageModalOpen.set(false);
    this.selectedUser.set(null);
    this.allPermissions.set([]);
    this.userPermissions.set(new Map());
  }
  
  closeTempPasswordModal() {
    this.isTempPasswordModalOpen.set(false);
    this.tempPassword.set('');
  }

  async togglePermission(permission: Permissao) {
    const user = this.selectedUser();
    if (!user) return;
    
    this.isLoadingPermissions.set(true);
    const currentPermissions = this.userPermissions();

    try {
      if (currentPermissions.has(permission.id)) {
        // Remove permission
        await this.usersService.removeUserPermission(user.user_id, permission.id);
        this.userPermissions.update(map => {
            const newMap = new Map(map);
            newMap.delete(permission.id);
            return newMap;
        });
      } else {
        // Add permission
        await this.usersService.addUserPermission(user.user_id, permission.id);
        this.userPermissions.update(map => {
            const newMap = new Map(map);
            newMap.set(permission.id, permission.descricao);
            return newMap;
        });
      }
      // Refresh the user list to show updated aggregated permissions string
      await this.loadUsers();
    } catch (e) {
      this.error.set('Falha ao atualizar a permissão.');
    } finally {
      this.isLoadingPermissions.set(false);
    }
  }

  async resetPassword() {
    const user = this.selectedUser();
    if (!user) return;

    if (!confirm(`Tem certeza que deseja resetar a senha de ${user.nome}? Uma nova senha temporária será gerada.`)) {
      return;
    }

    this.isResettingPassword.set(true);
    this.resetPasswordError.set(null);
    try {
      const result = await this.usersService.adminResetUserPassword(user.user_id);
      this.tempPassword.set(result.temporaryPassword);
      this.isTempPasswordModalOpen.set(true);
      this.closeManageModal(); // Close the management modal
    } catch (err: any) {
      this.resetPasswordError.set(err.message || 'Ocorreu um erro desconhecido.');
    } finally {
      this.isResettingPassword.set(false);
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Optional: show a small success message
      alert('Senha copiada para a área de transferência!');
    }).catch(err => {
      console.error('Falha ao copiar a senha: ', err);
      alert('Não foi possível copiar a senha.');
    });
  }

  getPermissionClass(permission: string): string {
    const p = permission.trim().toUpperCase();
    switch (p) {
      case 'ROLE_ADMIN':
        return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100';
      case 'ROLE_USER':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  }

  getPermissionLabel(permission: string): string {
    const p = permission.trim().toUpperCase();
    switch (p) {
      case 'ROLE_ADMIN':
        return 'Admin';
      case 'ROLE_USER':
        return 'Usuário';
      default:
        return permission.trim();
    }
  }
}