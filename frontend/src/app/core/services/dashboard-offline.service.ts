import { Injectable, inject } from '@angular/core';
import { DashboardStats } from './dashboard.service';
import { OfflineStorageService } from './offline-storage.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardOfflineService {
  private offlineStorage = inject(OfflineStorageService);

  async getStats(): Promise<DashboardStats> {
    try {
      return await this.offlineStorage.getById<DashboardStats>('dashboardStats', 'latest');
    } catch {
      return {
        kpi: { total: 0, byStatus: [] },
        byCategory: [],
        expiringWarranties: [],
        recentActivity: []
      } as DashboardStats;
    }
  }

  async saveStats(stats: DashboardStats): Promise<void> {
    return this.offlineStorage.save('dashboardStats', { id: 'latest', ...stats });
  }
}
