import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./core/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) 
      },
      { 
        path: 'assets', 
        loadComponent: () => import('./features/assets/asset-list/asset-list.component').then(m => m.AssetListComponent) 
      },
      { 
        path: 'assets/new', 
        loadComponent: () => import('./features/assets/asset-form/asset-form.component').then(m => m.AssetFormComponent) 
      },
      { 
        path: 'assets/:id/edit', 
        loadComponent: () => import('./features/assets/asset-form/asset-form.component').then(m => m.AssetFormComponent) 
      },
      { 
        path: 'activities', 
        loadComponent: () => import('./features/activities/activity-list/activity-list.component').then(m => m.ActivityListComponent) 
      },
      { 
        path: 'scan', 
        loadComponent: () => import('./features/scanner/scanner.component').then(m => m.ScannerComponent) 
      },
      { 
        path: 'users', 
        loadComponent: () => import('./features/users/user-list/user-list.component').then(m => m.UserListComponent),
        canActivate: [adminGuard]
      },
      { 
        path: 'settings', 
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) 
      },
      { 
        path: 'settings/categories', 
        loadComponent: () => import('./features/settings/categories/categories.component').then(m => m.CategoriesComponent) 
      },
      { 
        path: 'settings/locations', 
        loadComponent: () => import('./features/settings/locations/locations.component').then(m => m.LocationsComponent) 
      },
      { 
        path: 'settings/statuses', 
        loadComponent: () => import('./features/settings/statuses/statuses.component').then(m => m.StatusesComponent) 
      },
    ]
  },
  { path: '**', redirectTo: '' }
];
