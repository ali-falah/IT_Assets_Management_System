import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, of, throwError } from 'rxjs';
import { OfflineManagerService } from '../services/offline-manager.service';

export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  const offlineManager = inject(OfflineManagerService);

  // We only care about modifying requests for offline queueing
  const isModifyingRequest = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Check if it's a network error (status 0) or if we are explicitly offline
      if (error.status === 0 || !window.navigator.onLine) {
        if (isModifyingRequest) {
          console.log('Offline detected. Queueing request:', req.url);
          
          offlineManager.enqueueRequest(
            req.url,
            req.method,
            req.body,
            req.headers
          );

          // Return a fake success response to the application
          // This keeps the UI state consistent
          return of(new HttpResponse({ status: 202, body: { message: 'Request queued for offline sync' } }));
        }
      }
      
      return throwError(() => error);
    })
  );
};
