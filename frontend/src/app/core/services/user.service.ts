import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, tap } from 'rxjs';
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

  getUsers(skipCache = false): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users`).pipe(
      tap(res => {
        if (!skipCache) {
          // Cache users locally in background macro-task to prevent main thread lag
          this.ngZone.runOutsideAngular(() => {
            setTimeout(() => {
              this.userOffline.bulkSave(res).catch(err => console.error('Failed to cache users', err));
            }, 0);
          });
        }
      }),
      withOfflineFallback(() => this.userOffline.getAll())
    );
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/users/${id}`);
  }

  updateUser(id: string, data: any): Observable<User> {
    return this.http.patch<User>(`${environment.apiUrl}/users/${id}`, data).pipe(
      tap(updatedUser => {
        this.userOffline.save(updatedUser).catch(err => console.error('Failed to cache updated user', err));
      })
    );
  }

  getRoles(): Observable<UserRole[]> {
    return this.http.get<UserRole[]>(`${environment.apiUrl}/user-roles`);
  }

  importUsers(users: any[]): Observable<any> {
    return this.http.post(`${environment.apiUrl}/users/import`, { users });
  }

  deleteUser(id: string, force: boolean = false): Observable<any> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.delete(`${environment.apiUrl}/users/${id}`, { params }).pipe(
      tap(() => {
        this.userOffline.delete(id).catch(err => console.error('Failed to delete offline user', err));
      })
    );
  }

  bulkDeleteUsers(ids: string[], force: boolean = false): Observable<any> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.post(`${environment.apiUrl}/users/bulk-delete`, { ids }, { params }).pipe(
      tap(() => {
        ids.forEach(id => {
          this.userOffline.delete(id).catch(() => {});
        });
      })
    );
  }

}
