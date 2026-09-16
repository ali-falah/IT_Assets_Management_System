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
import { PlatformService } from './platform.service';
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
  private platform = inject(PlatformService);
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
  private readonly LAST_ASSET_SYNC_KEY = 'offline_last_asset_sync';

  constructor() {
    this.offlineManager.getOnlineStatus().subscribe(online => {
      if (online) {
        this.syncAll({ immediate: false });
        this.offlineManager.recordSyncTime();
      }
    });

    // Also sync when the API URL changes (configured on mobile)
    this.serverConfig.apiUrl$.subscribe(() => {
      this.offlineManager.getOnlineStatus().pipe(take(1)).subscribe(online => {
        if (online) {
          this.syncAll({ immediate: false });
        }
      });
    });
  }

  syncAll(options?: { immediate?: boolean }) {
    if (this.isSyncing) return;
    const now = Date.now();
    if (now - this.lastSyncTime < this.SYNC_COOLDOWN) return;

    const executeSync = () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      this.lastSyncTime = Date.now();

      const isMobile = this.platform.isMobile;
      let lastSyncTimestamp = localStorage.getItem(this.LAST_ASSET_SYNC_KEY) || undefined;

      // On desktop web: Avoid 10k bulk dumps. If no sync has run yet, mark baseline timestamp.
      if (!isMobile && !lastSyncTimestamp) {
        const baseline = new Date().toISOString();
        localStorage.setItem(this.LAST_ASSET_SYNC_KEY, baseline);
        lastSyncTimestamp = baseline;
      }

      // Delta sync: mobile downloads full initially if no timestamp, otherwise delta.
      // Desktop web always downloads delta only (0 to few records).
      const assetSync$ = this.assetService.getDeltaSync(lastSyncTimestamp).pipe(
        catchError(() => of({ data: [], total: 0, serverTime: new Date().toISOString() }))
      );

      forkJoin({
        assetDelta: assetSync$,
        users: this.userService.getUsers().pipe(catchError(() => of([]))),
        statuses: this.masterDataService.getStatuses().pipe(catchError(() => of([]))),
        categories: this.masterDataService.getCategories().pipe(catchError(() => of([]))),
        locations: this.masterDataService.getLocations().pipe(catchError(() => of([]))),
        dashboardStats: this.dashboardService.getStats().pipe(catchError(() => of(null))),
        assignments: this.assignmentService.getAssignments().pipe(catchError(() => of([])))
      }).subscribe({
        next: (res) => {
          this.ngZone.runOutsideAngular(async () => {
            try {
              if (res.assetDelta.serverTime) {
                localStorage.setItem(this.LAST_ASSET_SYNC_KEY, res.assetDelta.serverTime);
              }
              if (res.assetDelta.data && res.assetDelta.data.length > 0) {
                await this.assetOffline.bulkSave(res.assetDelta.data, false);
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
          console.error('Data sync failed:', err);
          this.isSyncing = false;
        }
      });
    };

    if (options?.immediate) {
      executeSync();
    } else {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => executeSync(), { timeout: 3500 });
      } else {
        setTimeout(executeSync, 2000);
      }
    }
  }
}
