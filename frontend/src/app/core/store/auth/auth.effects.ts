import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import * as AuthActions from './auth.actions';

@Injectable()
export class AuthEffects {
  private actions$ = inject(Actions);
  private http = inject(HttpClient);
  private router = inject(Router);

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      mergeMap(action =>
        this.http.post<any>(`${environment.apiUrl}/auth/login`, action.credentials).pipe(
          map(response => {
            localStorage.setItem('token', response.access_token);
            localStorage.setItem('user', JSON.stringify(response.user));
            return AuthActions.loginSuccess({ user: response.user, token: response.access_token });
          }),
          catchError(error => of(AuthActions.loginFailure({ error: error.error?.message || 'Login failed' })))
        )
      )
    )
  );

  loginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        tap(() => this.router.navigate(['/dashboard']))
      ),
    { dispatch: false }
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      mergeMap(() =>
        this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(
          map(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return AuthActions.logoutSuccess();
          }),
          catchError(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return of(AuthActions.logoutSuccess());
          })
        )
      )
    )
  );

  logoutSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logoutSuccess),
        tap(() => this.router.navigate(['/login']))
      ),
    { dispatch: false }
  );
}
