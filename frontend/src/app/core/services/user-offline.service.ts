import { Injectable, inject } from '@angular/core';
import { OfflineStorageService } from './offline-storage.service';

export interface UserRole {
  id: string;
  name: string;
  description?: string;
  colorClass?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  department?: string;
  assets?: any[];
  assignments?: any[];
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserOfflineService {
  private offlineStorage = inject(OfflineStorageService);

  async getAll(): Promise<User[]> {
    return this.offlineStorage.getAll<User>('users');
  }

  async bulkSave(users: User[]): Promise<void> {
    return this.offlineStorage.bulkSave('users', users);
  }

  async save(user: User): Promise<void> {
    return this.offlineStorage.save('users', user);
  }

  async delete(id: string): Promise<void> {
    return this.offlineStorage.delete('users', id);
  }
}

