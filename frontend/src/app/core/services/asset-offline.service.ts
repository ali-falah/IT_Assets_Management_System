import { Injectable, inject } from '@angular/core';
import { Asset } from './asset.service';
import { OfflineStorageService } from './offline-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AssetOfflineService {
  private offlineStorage = inject(OfflineStorageService);

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

  async bulkSave(assets: Asset[]): Promise<void> {
    return this.offlineStorage.bulkSave('assets', assets);
  }

  async update(id: string, partialData: Partial<Asset>): Promise<Asset> {
    const asset = await this.getById(id);
    const updatedAsset = { ...asset, ...partialData };
    
    // Attempt to enrich with user/status data if we have them locally
    // Note: In a cleaner architecture, this might be handled by the sync layer
    // but we keep the current logic for parity.
    const users = await this.offlineStorage.getAll<any>('users');
    const statuses = await this.offlineStorage.getAll<any>('statuses');
    
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
}
