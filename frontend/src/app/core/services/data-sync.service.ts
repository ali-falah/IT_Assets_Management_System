import { Injectable, inject } from '@angular/core';
import { AssetService } from './asset.service';
import { UserService } from './user.service';
import { MasterDataService } from './master-data.service';
import { DashboardService } from './dashboard.service';
import { AssignmentService } from './assignment.service';
import { OfflineManagerService } from './offline-manager.service';
import { AssetOfflineService } from './asset-offline.service';
import { UserOfflineService } from './user-offline.service';
import { MasterDataOfflineService } from './master-data-offline.service';
import { DashboardOfflineService } from './dashboard-offline.service';
import { AssignmentOfflineService } from './assignment-offline.service';
import { catchError, of, forkJoin } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataSyncService {
  private assetService = inject(AssetService);
  private userService = inject(UserService);
  private masterDataService = inject(MasterDataService);
  private dashboardService = inject(DashboardService);
  private assignmentService = inject(AssignmentService);
  private offlineManager = inject(OfflineManagerService);

  // Offline Repositories
  private assetOffline = inject(AssetOfflineService);
  private userOffline = inject(UserOfflineService);
  private masterDataOffline = inject(MasterDataOfflineService);
  private dashboardOffline = inject(DashboardOfflineService);
  private assignmentOffline = inject(AssignmentOfflineService);

  private isSyncing = false;

  constructor() {
    this.offlineManager.getOnlineStatus().subscribe(online => {
      if (online) {
        this.syncAll();
        this.offlineManager.recordSyncTime();
      }
    });
  }

  syncAll() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    console.log('Starting full data sync for offline use...');

    forkJoin({
      assets: this.assetService.getAssets({ limit: 1000 }).pipe(catchError(() => of({ data: [], total: 0 }))),
      users: this.userService.getUsers().pipe(catchError(() => of([]))),
      statuses: this.masterDataService.getStatuses().pipe(catchError(() => of([]))),
      categories: this.masterDataService.getCategories().pipe(catchError(() => of([]))),
      locations: this.masterDataService.getLocations().pipe(catchError(() => of([]))),
      dashboardStats: this.dashboardService.getStats().pipe(catchError(() => of(null))),
      assignments: this.assignmentService.getAssignments().pipe(catchError(() => of([])))
    }).subscribe({
      next: async (res) => {
        try {
          if (res.assets.data.length > 0) {
            await this.assetOffline.bulkSave(res.assets.data);
          }
          if (res.users.length > 0) {
            await this.userOffline.bulkSave(res.users);
          }
          if (res.statuses.length > 0) {
            await this.masterDataOffline.bulkSaveStatuses(res.statuses);
          }
          if (res.categories.length > 0) {
            await this.masterDataOffline.bulkSaveCategories(res.categories);
          }
          if (res.locations.length > 0) {
            await this.masterDataOffline.bulkSaveLocations(res.locations);
          }
          if (res.dashboardStats) {
            await this.dashboardOffline.saveStats(res.dashboardStats);
          }
          if (res.assignments.length > 0) {
            await this.assignmentOffline.bulkSave(res.assignments);
          }
          console.log('Offline data sync completed successfully');
        } catch (err) {
          console.error('Error saving data to IndexedDB:', err);
        } finally {
          this.isSyncing = false;
        }
      },
      error: (err) => {
        console.error('Full data sync failed:', err);
        this.isSyncing = false;
      }
    });
  }
}
