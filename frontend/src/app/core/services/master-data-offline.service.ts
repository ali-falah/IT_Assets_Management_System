import { Injectable, inject } from '@angular/core';
import { Status, Category, Location } from './master-data.service';
import { OfflineStorageService } from './offline-storage.service';

@Injectable({
  providedIn: 'root'
})
export class MasterDataOfflineService {
  private offlineStorage = inject(OfflineStorageService);

  // Categories
  async getCategories(): Promise<Category[]> {
    return this.offlineStorage.getAll<Category>('categories');
  }
  async bulkSaveCategories(items: Category[]): Promise<void> {
    return this.offlineStorage.bulkSave('categories', items);
  }

  // Locations
  async getLocations(): Promise<Location[]> {
    return this.offlineStorage.getAll<Location>('locations');
  }
  async bulkSaveLocations(items: Location[]): Promise<void> {
    return this.offlineStorage.bulkSave('locations', items);
  }

  // Statuses
  async getStatuses(): Promise<Status[]> {
    return this.offlineStorage.getAll<Status>('statuses');
  }
  async bulkSaveStatuses(items: Status[]): Promise<void> {
    return this.offlineStorage.bulkSave('statuses', items);
  }
}
