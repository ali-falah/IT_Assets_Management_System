import { Observable, OperatorFunction, catchError, from, throwError } from 'rxjs';

/**
 * Custom RxJS operator to handle offline fallbacks gracefully.
 * It catches network errors (status 0 or !navigator.onLine) and 
 * executes a local fallback function (usually reading from IndexedDB).
 * 
 * @param fallbackFn A function that returns a Promise or Observable for local data
 */
export function withOfflineFallback<T>(fallbackFn: () => Promise<T> | Observable<T>): OperatorFunction<T, T> {
  return (source: Observable<T>): Observable<T> => {
    return source.pipe(
      catchError((error) => {
        if (error.status === 0 || !navigator.onLine) {
          console.log('Network error or offline: switching to local storage');
          return from(fallbackFn());
        }
        return throwError(() => error);
      })
    );
  };
}
