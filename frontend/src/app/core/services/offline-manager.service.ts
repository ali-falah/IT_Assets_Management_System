import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { concatMap, finalize, tap } from 'rxjs/operators';

export const LAST_SYNCED_KEY = 'offline_last_synced_at';

interface QueuedRequest {
  url: string;
  method: string;
  body: any;
  headers: { [key: string]: string };
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineManagerService {
  private readonly QUEUE_KEY = 'offline_request_queue';
  private isOnline = new BehaviorSubject<boolean>(window.navigator.onLine);
  private isSyncing = false;
  private offlineNotificationShown = false;

  /** Emits the current number of pending offline requests */
  private _queueCount = new BehaviorSubject<number>(this.getQueue().length);
  queueCount$ = this._queueCount.asObservable();

  constructor(private http: HttpClient, private toastr: ToastrService) {
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
  }

  /** Returns the timestamp (ms) of the last successful full sync, or null */
  getLastSyncedAt(): number | null {
    const val = localStorage.getItem(LAST_SYNCED_KEY);
    return val ? parseInt(val, 10) : null;
  }

  /** Records the current time as the last successful sync timestamp */
  recordSyncTime(): void {
    localStorage.setItem(LAST_SYNCED_KEY, Date.now().toString());
  }

  private updateOnlineStatus(online: boolean) {
    this.isOnline.next(online);
    if (online) {
      this.offlineNotificationShown = false;
      this.syncQueue();
    } else if (!this.offlineNotificationShown) {
      this.toastr.warning('Could not contact the backend server', 'Offline Mode', {
        timeOut: 5000,
        progressBar: true
      });
      this.offlineNotificationShown = true;
    }
  }

  enqueueRequest(url: string, method: string, body: any, headers: any): void {
    const queue = this.getQueue();
    const newRequest: QueuedRequest = {
      url,
      method,
      body,
      headers: this.serializeHeaders(headers),
      timestamp: Date.now()
    };
    queue.push(newRequest);
    this.saveQueue(queue);
    this._queueCount.next(queue.length);
    
    if (!this.offlineNotificationShown) {
      this.toastr.warning('Could not contact the backend server', 'Changes will be synced when online', {
        timeOut: 5000
      });
      this.offlineNotificationShown = true;
    }
  }

  private getQueue(): QueuedRequest[] {
    const data = localStorage.getItem(this.QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveQueue(queue: QueuedRequest[]): void {
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  }

  private serializeHeaders(headers: any): { [key: string]: string } {
    const serialized: { [key: string]: string } = {};
    if (headers && typeof headers.keys === 'function') {
      headers.keys().forEach((key: string) => {
        serialized[key] = headers.get(key);
      });
    } else if (headers) {
      Object.assign(serialized, headers);
    }
    return serialized;
  }

  private syncQueue(): void {
    const queue = this.getQueue();
    if (queue.length === 0 || this.isSyncing) return;

    this.isSyncing = true;
    
    // Process queue sequentially
    from(queue).pipe(
      concatMap(request => this.processRequest(request)),
      finalize(() => {
        this.isSyncing = false;
        const remaining = this.getQueue();
        this._queueCount.next(remaining.length);
        if (remaining.length === 0) {
          this.recordSyncTime();
          this.toastr.success('Back online, all your staged operations has been sent successfully to backend', 'Sync Complete');
        }
      })
    ).subscribe({
      next: (res) => {
        // Remove successful request from queue
        const currentQueue = this.getQueue();
        currentQueue.shift();
        this.saveQueue(currentQueue);
        this._queueCount.next(currentQueue.length);
      },
      error: (err) => {
        console.error('Error syncing request:', err);
        // If it's a network error again, stop syncing
        if (err.status === 0) {
          this.isSyncing = false;
        } else {
          // If it's a 4xx/5xx error, skip to avoid blocking the whole queue.
          const currentQueue = this.getQueue();
          currentQueue.shift();
          this.saveQueue(currentQueue);
          this._queueCount.next(currentQueue.length);
        }
      }
    });
  }

  private processRequest(request: QueuedRequest): Observable<any> {
    return this.http.request(request.method, request.url, {
      body: request.body,
      headers: request.headers
    });
  }

  getOnlineStatus(): Observable<boolean> {
    return this.isOnline.asObservable();
  }
}
