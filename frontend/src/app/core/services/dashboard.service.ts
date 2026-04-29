import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardOfflineService } from './dashboard-offline.service';
import { withOfflineFallback } from '../utils/offline-operators';

export interface StatusCount {
  id: string;
  name: string;
  colorClass: string;
  count: number;
}

export interface DashboardStats {
  kpi: {
    total: number;
    byStatus: StatusCount[];
  };
  byCategory: Array<{ categoryName: string; count: string }>;
  expiringWarranties: Array<{ id: string; name: string; warrantyExpiry: string; daysLeft: number }>;
  recentActivity: Array<{ type: string; message: string; date: string }>;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private dashboardOffline = inject(DashboardOfflineService);
  private apiUrl = `${environment.apiUrl}/dashboard`;

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/stats`).pipe(
      withOfflineFallback(() => this.dashboardOffline.getStats())
    );
  }
}
