import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { withOfflineFallback } from '../utils/offline-operators';
import { AssetOfflineService } from './asset-offline.service';

export interface Asset {
  id: string;
  name: string;
  serialNumber: string;
  statusId: string;
  status?: any;
  lastTransactionDate: string;
  categoryId: string;
  locationId: string;
  assignedUserId?: string | null;
  imageUrl?: string;
  notes?: string;
  category?: any;
  location?: any;
  assignedUser?: any;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AssetService {
  private http = inject(HttpClient);
  private assetOffline = inject(AssetOfflineService);
  private ngZone = inject(NgZone);
  private apiUrl = `${environment.apiUrl}/assets`;

  getAssets(params: any): Observable<{ data: Asset[], total: number }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (key !== 'skipCache' && params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.append(key, params[key]);
      }
    });

    return this.http.get<{ data: Asset[], total: number }>(this.apiUrl, { params: httpParams }).pipe(
      tap(res => {
        if (!params.skipCache) {
          // Cache data locally in a background macrotask to keep the UI smooth
          this.ngZone.runOutsideAngular(() => {
            setTimeout(() => {
              this.assetOffline.bulkSave(res.data, false).catch(err => console.error('Failed to cache assets', err));
            }, 0);
          });
        }
      }),
      withOfflineFallback<{ data: Asset[], total: number }>(async () => {
        const assets = params.search 
          ? await this.assetOffline.search(params.search) 
          : await this.assetOffline.getAll();
        return { data: assets, total: assets.length };
      })
    );
  }

  getAsset(id: string): Observable<Asset> {
    return this.http.get<Asset>(`${this.apiUrl}/${id}`).pipe(
      withOfflineFallback(() => this.assetOffline.getById(id))
    );
  }

  createAsset(asset: Partial<Asset>): Observable<Asset> {
    return this.http.post<Asset>(this.apiUrl, asset).pipe(
      tap(newAsset => {
        this.assetOffline.update(newAsset.id, newAsset).catch(err => console.error('Failed to cache new asset', err));
      })
    );
  }

  updateAsset(id: string, asset: Partial<Asset>): Observable<Asset> {
    return this.http.patch<Asset>(`${this.apiUrl}/${id}`, asset).pipe(
      tap(() => {
        // Update local DB instantly to keep UI fresh whether offline or online
        this.assetOffline.update(id, asset).catch(err => console.error('Failed to update local asset', err));
      })
    );
  }

  bulkUpdateAssets(ids: string[], data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/bulk-update`, { ids, data }).pipe(
      tap(() => {
        ids.forEach(id => {
          this.assetOffline.update(id, data).catch(() => {});
        });
      })
    );
  }

  deleteAsset(id: string, force: boolean = false): Observable<void> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { params }).pipe(
      tap(() => {
        this.assetOffline.delete(id).catch(err => console.error('Failed to delete offline asset', err));
      })
    );
  }

  bulkDeleteAssets(ids: string[], force: boolean = false): Observable<any> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.post<any>(`${this.apiUrl}/bulk-delete`, { ids }, { params }).pipe(
      tap(() => {
        ids.forEach(id => {
          this.assetOffline.delete(id).catch(() => {});
        });
      })
    );
  }

  importAssets(data: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/import`, data);
  }

}
