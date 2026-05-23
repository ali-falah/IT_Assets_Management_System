import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { withOfflineFallback } from '../utils/offline-operators';
import { DashboardOfflineService } from './dashboard-offline.service';

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

  private statsCache$?: Observable<DashboardStats>;

  getStats(): Observable<DashboardStats> {
    if (!this.statsCache$) {
      this.statsCache$ = this.http.get<DashboardStats>(`${this.apiUrl}/stats`).pipe(
        tap(res => {
          this.dashboardOffline.saveStats(res).catch(err => console.error('Failed to cache dashboard stats', err));
        }),
        withOfflineFallback(() => this.dashboardOffline.getStats()),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.statsCache$;
  }

  invalidateStatsCache(): void {
    this.statsCache$ = undefined;
  }
}
