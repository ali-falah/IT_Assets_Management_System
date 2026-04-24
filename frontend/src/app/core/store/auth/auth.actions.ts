import { createAction, props } from '@ngrx/store';

export const login = createAction('[Auth] Login', props<{ credentials: any }>());
export const loginSuccess = createAction('[Auth] Login Success', props<{ user: any, token: string }>());
export const loginFailure = createAction('[Auth] Login Failure', props<{ error: string }>());

export const logout = createAction('[Auth] Logout');
export const logoutSuccess = createAction('[Auth] Logout Success');
