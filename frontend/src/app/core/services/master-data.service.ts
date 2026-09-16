import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { withOfflineFallback } from '../utils/offline-operators';
import { MasterDataOfflineService } from './master-data-offline.service';

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
  private masterDataOffline = inject(MasterDataOfflineService);

  private categoriesCache$?: Observable<Category[]>;
  private locationsCache$?: Observable<Location[]>;
  private statusesCache$?: Observable<Status[]>;

  invalidateCategoriesCache(): void {
    this.categoriesCache$ = undefined;
  }

  invalidateLocationsCache(): void {
    this.locationsCache$ = undefined;
  }

  invalidateStatusesCache(): void {
    this.statusesCache$ = undefined;
  }

  invalidateAllCache(): void {
    this.categoriesCache$ = undefined;
    this.locationsCache$ = undefined;
    this.statusesCache$ = undefined;
  }

  // Categories
  getCategories(skipCache = false): Observable<Category[]> {
    if (skipCache || !this.categoriesCache$) {
      const req$ = this.http.get<Category[]>(`${environment.apiUrl}/categories`).pipe(
        tap(res => {
          this.masterDataOffline.bulkSaveCategories(res).catch(err => console.error('Failed to cache categories', err));
        }),
        withOfflineFallback(() => this.masterDataOffline.getCategories()),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      if (skipCache) return req$;
      this.categoriesCache$ = req$;
    }
    return this.categoriesCache$;
  }

  createCategory(data: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${environment.apiUrl}/categories`, data).pipe(
      tap(() => this.invalidateCategoriesCache())
    );
  }

  updateCategory(id: string, data: Partial<Category>): Observable<Category> {
    return this.http.patch<Category>(`${environment.apiUrl}/categories/${id}`, data).pipe(
      tap(() => this.invalidateCategoriesCache())
    );
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/categories/${id}`).pipe(
      tap(() => this.invalidateCategoriesCache())
    );
  }

  // Locations
  getLocations(skipCache = false): Observable<Location[]> {
    if (skipCache || !this.locationsCache$) {
      const req$ = this.http.get<Location[]>(`${environment.apiUrl}/locations`).pipe(
        tap(res => {
          this.masterDataOffline.bulkSaveLocations(res).catch(err => console.error('Failed to cache locations', err));
        }),
        withOfflineFallback(() => this.masterDataOffline.getLocations()),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      if (skipCache) return req$;
      this.locationsCache$ = req$;
    }
    return this.locationsCache$;
  }

  createLocation(data: Partial<Location>): Observable<Location> {
    return this.http.post<Location>(`${environment.apiUrl}/locations`, data).pipe(
      tap(() => this.invalidateLocationsCache())
    );
  }

  updateLocation(id: string, data: Partial<Location>): Observable<Location> {
    return this.http.patch<Location>(`${environment.apiUrl}/locations/${id}`, data).pipe(
      tap(() => this.invalidateLocationsCache())
    );
  }

  deleteLocation(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/locations/${id}`).pipe(
      tap(() => this.invalidateLocationsCache())
    );
  }

  // Statuses
  getStatuses(skipCache = false): Observable<Status[]> {
    if (skipCache || !this.statusesCache$) {
      const req$ = this.http.get<Status[]>(`${environment.apiUrl}/statuses`).pipe(
        tap(res => {
          this.masterDataOffline.bulkSaveStatuses(res).catch(err => console.error('Failed to cache statuses', err));
        }),
        withOfflineFallback(() => this.masterDataOffline.getStatuses()),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      if (skipCache) return req$;
      this.statusesCache$ = req$;
    }
    return this.statusesCache$;
  }

  createStatus(data: Partial<Status>): Observable<Status> {
    return this.http.post<Status>(`${environment.apiUrl}/statuses`, data).pipe(
      tap(() => this.invalidateStatusesCache())
    );
  }

  updateStatus(id: string, data: Partial<Status>): Observable<Status> {
    return this.http.patch<Status>(`${environment.apiUrl}/statuses/${id}`, data).pipe(
      tap(() => this.invalidateStatusesCache())
    );
  }

  deleteStatus(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/statuses/${id}`).pipe(
      tap(() => this.invalidateStatusesCache())
    );
  }
}
