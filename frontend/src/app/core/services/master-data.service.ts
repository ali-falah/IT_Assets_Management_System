import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
}

export interface Status {
  id: string;
  name: string;
  slug: string;
  colorClass?: string;
  isSystem?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MasterDataService {
  private http = inject(HttpClient);

  // Categories
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${environment.apiUrl}/categories`);
  }
  createCategory(data: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${environment.apiUrl}/categories`, data);
  }
  updateCategory(id: string, data: Partial<Category>): Observable<Category> {
    return this.http.patch<Category>(`${environment.apiUrl}/categories/${id}`, data);
  }
  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/categories/${id}`);
  }

  // Locations
  getLocations(): Observable<Location[]> {
    return this.http.get<Location[]>(`${environment.apiUrl}/locations`);
  }
  createLocation(data: Partial<Location>): Observable<Location> {
    return this.http.post<Location>(`${environment.apiUrl}/locations`, data);
  }
  updateLocation(id: string, data: Partial<Location>): Observable<Location> {
    return this.http.patch<Location>(`${environment.apiUrl}/locations/${id}`, data);
  }
  deleteLocation(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/locations/${id}`);
  }

  // Statuses
  getStatuses(): Observable<Status[]> {
    return this.http.get<Status[]>(`${environment.apiUrl}/statuses`);
  }
  createStatus(data: Partial<Status>): Observable<Status> {
    return this.http.post<Status>(`${environment.apiUrl}/statuses`, data);
  }
  updateStatus(id: string, data: Partial<Status>): Observable<Status> {
    return this.http.patch<Status>(`${environment.apiUrl}/statuses/${id}`, data);
  }
  deleteStatus(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/statuses/${id}`);
  }
}
