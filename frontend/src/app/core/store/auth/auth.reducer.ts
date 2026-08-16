import { createReducer, on } from '@ngrx/store';
import * as AuthActions from './auth.actions';

export interface AuthState {
  user: any | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

function getInitialUser(): any | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getInitialToken(): string | null {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || token === 'undefined' || token === 'null') return null;
    return token;
  } catch {
    return null;
  }
}

export const initialState: AuthState = {
  user: getInitialUser(),
  token: getInitialToken(),
  loading: false,
  error: null,
};

export const authReducer = createReducer(
  initialState,
  on(AuthActions.login, state => ({ ...state, loading: true, error: null })),
  on(AuthActions.loginSuccess, (state, { user, token }) => ({
    ...state,
    user,
    token,
    loading: false,
  })),
  on(AuthActions.loginFailure, (state, { error }) => ({
    ...state,
    error,
    loading: false,
  })),
  on(AuthActions.logoutSuccess, state => ({
    ...state,
    user: null,
    token: null,
  }))
);
