import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

let isHandling401 = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toastr = inject(ToastrService);
  const token = localStorage.getItem('token');

  let authReq = req;
  if (token) {
    authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't intercept login or register endpoint errors
      if (req.url.includes('/auth/login') || req.url.includes('/auth/register')) {
        return throwError(() => error);
      }

      if (error.status === 401) {
        if (!isHandling401) {
          isHandling401 = true;
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setTimeout(() => {
            router.navigate(['/login']);
            toastr.error('Session expired. Please login again.');
            isHandling401 = false;
          }, 0);
        }
      }
      return throwError(() => error);
    })
  );
};
