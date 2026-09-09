import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ActivityLog {
  id: string;
  action:
    | 'asset_created'
    | 'asset_updated'
    | 'asset_deleted'
    | 'asset_assigned'
    | 'asset_returned'
    | 'asset_bulk_updated'
    | 'asset_imported'
    | 'user_created'
    | 'user_updated'
    | 'user_deleted';
  message: string;
  entityId: string;
  entityName: string;
  secondaryId?: string;
  secondaryName?: string;
  actorId?: string;
  actorName?: string;
  meta?: {
    serialNumber?: string;
    assignedUser?: string;
    changes?: Record<string, { from?: string; to?: string }>;
    [key: string]: any;
  };
  createdAt: string;
}

export interface ActivityStats {
  totalCount: number;
  assetEventsCount: number;
  assignmentEventsCount: number;
  userEventsCount: number;
  last24hCount: number;
}

export interface ActivityLogsResponse {
  data: ActivityLog[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/activity-logs`;

  getAll(limit = 300): Observable<ActivityLog[]> {
    return this.http.get<any>(`${this.api}?limit=${limit}`).pipe(
      catchError(() => of([])),
      map(res => (Array.isArray(res) ? res : res?.data || []))
    );
  }

  getLogs(params: Record<string, any> = {}): Observable<ActivityLogsResponse> {
    return this.http.get<any>(this.api, { params }).pipe(
      catchError(() => of({ data: [], total: 0, page: 1, limit: 50 })),
      map(res => {
        if (Array.isArray(res)) {
          return { data: res, total: res.length, page: 1, limit: res.length };
        }
        return res || { data: [], total: 0, page: 1, limit: 50 };
      })
    );
  }

  getStats(): Observable<ActivityStats> {
    return this.http.get<ActivityStats>(`${this.api}/stats`).pipe(
      catchError(() => of({
        totalCount: 0,
        assetEventsCount: 0,
        assignmentEventsCount: 0,
        userEventsCount: 0,
        last24hCount: 0,
      }))
    );
  }
}
