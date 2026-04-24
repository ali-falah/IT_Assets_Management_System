import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  private apiUrl = `${environment.apiUrl}/assets`;

  getAssets(params: any): Observable<{ data: Asset[], total: number }> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
        httpParams = httpParams.append(key, params[key]);
      }
    });
    return this.http.get<{ data: Asset[], total: number }>(this.apiUrl, { params: httpParams });
  }

  getAsset(id: string): Observable<Asset> {
    return this.http.get<Asset>(`${this.apiUrl}/${id}`);
  }

  createAsset(asset: Partial<Asset>): Observable<Asset> {
    return this.http.post<Asset>(this.apiUrl, asset);
  }

  updateAsset(id: string, asset: Partial<Asset>): Observable<Asset> {
    return this.http.patch<Asset>(`${this.apiUrl}/${id}`, asset);
  }

  bulkUpdateAssets(ids: string[], data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/bulk-update`, { ids, data });
  }

  deleteAsset(id: string, force: boolean = false): Observable<void> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { params });
  }

  bulkDeleteAssets(ids: string[], force: boolean = false): Observable<any> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return this.http.post<any>(`${this.apiUrl}/bulk-delete`, { ids }, { params });
  }

  importAssets(data: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/import`, data);
  }
}
