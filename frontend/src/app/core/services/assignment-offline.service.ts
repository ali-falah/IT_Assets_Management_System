import { Injectable, inject } from '@angular/core';
import { Assignment } from './assignment.service';
import { OfflineStorageService } from './offline-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AssignmentOfflineService {
  private offlineStorage = inject(OfflineStorageService);

  async getAll(): Promise<Assignment[]> {
    return this.offlineStorage.getAll<Assignment>('assignments');
  }

  async bulkSave(items: Assignment[]): Promise<void> {
    return this.offlineStorage.bulkSave('assignments', items);
  }
}
