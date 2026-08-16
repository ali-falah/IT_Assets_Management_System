import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (token) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
  
  if (userStr && userStr !== 'undefined' && userStr !== 'null') {
    try {
      const user = JSON.parse(userStr);
      const roleName = typeof user.role === 'object' ? user.role?.name : user.role;
      if (roleName === 'admin') {
        return true;
      }
    } catch {
      // ignore JSON parse error
    }
  }

  router.navigate(['/dashboard']);
  return false;
};
