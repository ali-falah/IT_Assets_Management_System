import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ActivityLog {
  id: string;
  action:
    | 'asset_created'
    | 'asset_updated'
    | 'asset_deleted'
    | 'asset_assigned'
    | 'asset_returned'
    | 'user_created'
    | 'user_deleted';
  message: string;
  entityId: string;
  entityName: string;
  secondaryId: string;
  secondaryName: string;
  actorId: string;
  actorName: string;
  meta: Record<string, any>;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/activity-logs`;

  getAll(limit = 200): Observable<ActivityLog[]> {
    return this.http.get<ActivityLog[]>(`${this.api}?limit=${limit}`);
  }
}
