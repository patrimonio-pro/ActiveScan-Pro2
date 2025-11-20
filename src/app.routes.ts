import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { adminGuard } from './auth/admin.guard';

export const APP_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent),
    title: 'Login'
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
    title: 'Cadastro de Usuário'
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    title: 'Recuperar Senha'
  },
  {
    path: 'update-password',
    loadComponent: () => import('./auth/update-password/update-password.component').then(m => m.UpdatePasswordComponent),
    title: 'Atualizar Senha'
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Dashboard'
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
        title: 'Meu Perfil'
      },
      {
        path: 'inventario/coletor',
        loadComponent: () => import('./pages/inventory-collector/inventory-collector.component').then(m => m.InventoryCollectorComponent),
        title: 'Coletor de Inventário'
      },
      {
        path: 'bens',
        loadComponent: () => import('./pages/bens/bens-list.component').then(m => m.BensListComponent),
        title: 'Gestão de Bens'
      },
      {
        path: 'bens/novo',
        loadComponent: () => import('./pages/bens/bem-add.component').then(m => m.BemAddComponent),
        title: 'Adicionar Bem'
      },
      {
        path: 'bens/:id',
        loadComponent: () => import('./pages/bens/bem-detail.component').then(m => m.BemDetailComponent),
        title: 'Detalhes do Bem'
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./pages/users/users-list.component').then(m => m.UsersListComponent),
        title: 'Gestão de Usuários',
        canActivate: [adminGuard]
      },
      {
        path: 'force-update-password',
        loadComponent: () => import('./auth/force-update-password/force-update-password.component').then(m => m.ForceUpdatePasswordComponent),
        title: 'Atualizar Senha'
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' } // Wildcard route
];