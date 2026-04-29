import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class OfflineStorageService {
  private readonly DB_NAME = 'it_inventory_offline_db';
  private readonly DB_VERSION = 2;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        const stores: any[] = [
          { name: 'assets', options: { keyPath: 'id' }, indexes: [['serialNumber', 'serialNumber'], ['name', 'name']] },
          { name: 'users', options: { keyPath: 'id' } },
          { name: 'statuses', options: { keyPath: 'id' } },
          { name: 'categories', options: { keyPath: 'id' } },
          { name: 'locations', options: { keyPath: 'id' } },
          { name: 'dashboardStats', options: { keyPath: 'id' } },
          { name: 'assignments', options: { keyPath: 'id' } }
        ];

        stores.forEach(s => {
          if (!db.objectStoreNames.contains(s.name)) {
            const store = db.createObjectStore(s.name, s.options);
            if (s.indexes) {
              s.indexes.forEach((idx: string[]) => {
                store.createIndex(idx[0], idx[1], { unique: false });
              });
            }
          }
        });
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event: any) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  private async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    await this.initDb();
    return this.db!;
  }

  /**
   * Generic method to save an item to a store
   */
  async save(storeName: string, item: any): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic method to save multiple items to a store
   */
  async bulkSave(storeName: string, items: any[]): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      store.clear();
      items.forEach(item => store.put(item));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Generic method to get all items from a store
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic method to get a single item by key
   */
  async getById<T>(storeName: string, id: string): Promise<T> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) resolve(request.result);
        else reject(new Error(`Item ${id} not found in store ${storeName}`));
      };
      request.onerror = () => reject(request.error);
    });
  }
}
