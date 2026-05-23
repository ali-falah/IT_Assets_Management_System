import { Injectable, inject, NgZone } from '@angular/core';
import { catchError, forkJoin, of, take } from 'rxjs';
import { AssetOfflineService } from './asset-offline.service';
import { AssetService } from './asset.service';
import { AssignmentOfflineService } from './assignment-offline.service';
import { AssignmentService } from './assignment.service';
import { DashboardOfflineService } from './dashboard-offline.service';
import { DashboardService } from './dashboard.service';
import { MasterDataOfflineService } from './master-data-offline.service';
import { MasterDataService } from './master-data.service';
import { OfflineManagerService } from './offline-manager.service';
import { ServerConfigService } from './server-config.service';
import { UserOfflineService } from './user-offline.service';
import { UserService } from './user.service';

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
  private serverConfig = inject(ServerConfigService);
  private ngZone = inject(NgZone);

  // Offline Repositories
  private assetOffline = inject(AssetOfflineService);
  private userOffline = inject(UserOfflineService);
  private masterDataOffline = inject(MasterDataOfflineService);
  private dashboardOffline = inject(DashboardOfflineService);
  private assignmentOffline = inject(AssignmentOfflineService);

  private isSyncing = false;
  private lastSyncTime = 0;
  private readonly SYNC_COOLDOWN = 15000; // 15s minimum between syncs

  constructor() {
    this.offlineManager.getOnlineStatus().subscribe(online => {
      if (online) {
        this.syncAll();
        this.offlineManager.recordSyncTime();
      }
    });

    // Also sync when the API URL changes (configured on mobile)
    this.serverConfig.apiUrl$.subscribe(url => {
      this.offlineManager.getOnlineStatus().pipe(take(1)).subscribe(online => {
        if (online) {
          this.syncAll();
        }
      });
    });
  }

  syncAll() {
    if (this.isSyncing) return;
    const now = Date.now();
    if (now - this.lastSyncTime < this.SYNC_COOLDOWN) return;
    this.isSyncing = true;
    this.lastSyncTime = now;

    forkJoin({
      assets: this.assetService.getAssets({ limit: 500, skipCache: true }).pipe(catchError(() => of({ data: [], total: 0 }))),
      users: this.userService.getUsers(true).pipe(catchError(() => of([]))),

      statuses: this.masterDataService.getStatuses().pipe(catchError(() => of([]))),
      categories: this.masterDataService.getCategories().pipe(catchError(() => of([]))),
      locations: this.masterDataService.getLocations().pipe(catchError(() => of([]))),
      dashboardStats: this.dashboardService.getStats().pipe(catchError(() => of(null))),
      assignments: this.assignmentService.getAssignments().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.ngZone.runOutsideAngular(async () => {
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
          } catch (err) {
            console.error('Error saving data to IndexedDB:', err);
          } finally {
            this.isSyncing = false;
          }
        });
      },
      error: (err) => {
        console.error('Full data sync failed:', err);
        this.isSyncing = false;
      }
    });
  }
}
