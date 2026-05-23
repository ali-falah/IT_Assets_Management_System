import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

/**
 * Interceptor to automatically unwrap the 'data' property from standard API responses.
 * Standard backend response: { success: true, data: T, timestamp: string }
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map(event => {
      if (event instanceof HttpResponse && event.body && (event.body as any).success === true) {
        // Return only the inner data property
        return event.clone({ body: (event.body as any).data });
      }
      return event;
    })
  );
};
