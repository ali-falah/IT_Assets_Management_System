import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { withOfflineFallback } from '../utils/offline-operators';
import { User, UserOfflineService, UserRole } from './user-offline.service';
export { User, UserRole };

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private userOffline = inject(UserOfflineService);
  private ngZone = inject(NgZone);

  private usersCache$?: Observable<User[]>;

  getUsers(skipCache = false): Observable<User[]> {
    if (skipCache || !this.usersCache$) {
      const req$ = this.http.get<User[]>(`${environment.apiUrl}/users`).pipe(
        tap(res => {
          this.ngZone.runOutsideAngular(() => {
            setTimeout(() => {
              this.userOffline.bulkSave(res).catch(err => console.error('Failed to cache users', err));
            }, 0);
          });
        }),
        withOfflineFallback(() => this.userOffline.getAll()),
        shareReplay({ bufferSize: 1, refCount: false })
      );

      if (skipCache) {
        return req$;
      }
      this.usersCache$ = req$;
    }
    return this.usersCache$;
  }

  invalidateUsersCache(): void {
    this.usersCache$ = undefined;
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/users/${id}`);
  }

  updateUser(id: string, data: any): Observable<User> {
    return this.http.patch<User>(`${environment.apiUrl}/users/${id}`, data).pipe(
      tap(updatedUser => {
        this.invalidateUsersCache();
        this.userOffline.save(updatedUser).catch(err => console.error('Failed to cache updated user', err));
      })
    );
  }

  getRoles(): Observable<UserRole[]> {
    return this.http.get<UserRole[]>(`${environment.apiUrl}/user-roles`);
  }

  createUser(data: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/register`, data).pipe(
      tap(() => this.invalidateUsersCache())
    );
  }

  importUsers(users: any[]): Observable<any> {
    return this.http.post(`${environment.apiUrl}/users/import`, { users }).pipe(
      tap(() => this.invalidateUsersCache())
    );
  }

  deleteUser(id: string, force: boolean = false): Observable<any> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.delete(`${environment.apiUrl}/users/${id}`, { params }).pipe(
      tap(() => {
        this.invalidateUsersCache();
        this.userOffline.delete(id).catch(err => console.error('Failed to delete offline user', err));
      })
    );
  }

  bulkDeleteUsers(ids: string[], force: boolean = false): Observable<any> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.post(`${environment.apiUrl}/users/bulk-delete`, { ids }, { params }).pipe(
      tap(() => {
        this.invalidateUsersCache();
        ids.forEach(id => {
          this.userOffline.delete(id).catch(() => {});
        });
      })
    );
  }
}
