import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { withOfflineFallback } from '../utils/offline-operators';
import { AssignmentOfflineService } from './assignment-offline.service';

export interface Assignment {
  id: string;
  assetId: string;
  userId: string;
  assignedAt: string;
  returnedAt?: string;
  notes?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  asset?: {
    id: string;
    name: string;
    serialNumber: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AssignmentService {
  private http = inject(HttpClient);
  private assignmentOffline = inject(AssignmentOfflineService);

  private assignmentsCache$?: Observable<Assignment[]>;

  getAssignments(assetId?: string): Observable<Assignment[]> {
    if (assetId) {
      const url = `${environment.apiUrl}/assignments?assetId=${assetId}`;
      return this.http.get<Assignment[]>(url);
    }

    if (!this.assignmentsCache$) {
      this.assignmentsCache$ = this.http.get<Assignment[]>(`${environment.apiUrl}/assignments`).pipe(
        tap(res => {
          this.assignmentOffline.bulkSave(res).catch(err => console.error('Failed to cache assignments', err));
        }),
        withOfflineFallback(() => this.assignmentOffline.getAll()),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.assignmentsCache$;
  }

  invalidateAssignmentsCache(): void {
    this.assignmentsCache$ = undefined;
  }

  getAssignmentById(id: string): Observable<Assignment> {
    return this.http.get<Assignment>(`${environment.apiUrl}/assignments/${id}`);
  }

  createAssignment(data: any): Observable<Assignment> {
    return this.http.post<Assignment>(`${environment.apiUrl}/assignments`, data);
  }

  updateAssignment(id: string, data: any): Observable<Assignment> {
    return this.http.patch<Assignment>(`${environment.apiUrl}/assignments/${id}`, data);
  }
}
