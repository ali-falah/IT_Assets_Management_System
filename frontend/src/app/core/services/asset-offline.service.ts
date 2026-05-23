import { Injectable, inject } from '@angular/core';
import { Asset } from './asset.service';
import { OfflineStorageService } from './offline-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AssetOfflineService {
  private offlineStorage = inject(OfflineStorageService);

  private cachedUsers: any[] | null = null;
  private cachedStatuses: any[] | null = null;

  private async getCachedUsers(): Promise<any[]> {
    if (this.cachedUsers) return this.cachedUsers;
    this.cachedUsers = await this.offlineStorage.getAll('users');
    return this.cachedUsers;
  }

  private async getCachedStatuses(): Promise<any[]> {
    if (this.cachedStatuses) return this.cachedStatuses;
    this.cachedStatuses = await this.offlineStorage.getAll('statuses');
    return this.cachedStatuses;
  }

  invalidateCache(): void {
    this.cachedUsers = null;
    this.cachedStatuses = null;
  }

  async getAll(): Promise<Asset[]> {
    return this.offlineStorage.getAll('assets');
  }

  async getById(id: string): Promise<Asset> {
    return this.offlineStorage.getById('assets', id);
  }

  async search(term: string): Promise<Asset[]> {
    const assets = await this.getAll();
    const searchTerm = term.toLowerCase();
    return assets.filter(asset => 
      asset.serialNumber?.toLowerCase().includes(searchTerm) ||
      asset.name?.toLowerCase().includes(searchTerm) ||
      asset.id?.toLowerCase().includes(searchTerm)
    );
  }

  async bulkSave(assets: Asset[], clear: boolean = true): Promise<void> {
    return this.offlineStorage.bulkSave('assets', assets, clear);
  }

  async update(id: string, partialData: Partial<Asset>): Promise<Asset> {
    const asset = await this.getById(id);
    const updatedAsset = { ...asset, ...partialData };
    
    const users = await this.getCachedUsers();
    const statuses = await this.getCachedStatuses();
    
    if (partialData.assignedUserId) {
      updatedAsset.assignedUser = users.find((u: any) => u.id === partialData.assignedUserId);
    } else if (partialData.assignedUserId === null) {
      updatedAsset.assignedUser = null;
    }
    
    if (partialData.statusId) {
      updatedAsset.status = statuses.find((s: any) => s.id === partialData.statusId);
    }
    
    await this.offlineStorage.save('assets', updatedAsset);
    return updatedAsset;
  }

  async delete(id: string): Promise<void> {
    return this.offlineStorage.delete('assets', id);
  }
}

