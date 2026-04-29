import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserOfflineService, User, UserRole } from './user-offline.service';
export { User, UserRole };
import { withOfflineFallback } from '../utils/offline-operators';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private userOffline = inject(UserOfflineService);

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users`).pipe(
      withOfflineFallback(() => this.userOffline.getAll())
    );
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/users/${id}`);
  }

  updateUser(id: string, data: any): Observable<User> {
    return this.http.patch<User>(`${environment.apiUrl}/users/${id}`, data);
  }

  getRoles(): Observable<UserRole[]> {
    return this.http.get<UserRole[]>(`${environment.apiUrl}/user-roles`);
  }

  importUsers(users: any[]): Observable<any> {
    return this.http.post(`${environment.apiUrl}/users/import`, { users });
  }

  deleteUser(id: string, force: boolean = false): Observable<any> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.delete(`${environment.apiUrl}/users/${id}`, { params });
  }

  bulkDeleteUsers(ids: string[], force: boolean = false): Observable<any> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.post(`${environment.apiUrl}/users/bulk-delete`, { ids }, { params });
  }
}
