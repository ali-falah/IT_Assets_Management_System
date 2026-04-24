import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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

  getAssignments(assetId?: string): Observable<Assignment[]> {
    const url = assetId 
      ? `${environment.apiUrl}/assignments?assetId=${assetId}`
      : `${environment.apiUrl}/assignments`;
    return this.http.get<Assignment[]>(url);
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
