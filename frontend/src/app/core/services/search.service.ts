import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SearchResult {
  assets: any[];
  users: any[];
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/search`;

  search(query: string): Observable<SearchResult> {
    return this.http.get<SearchResult>(this.apiUrl, { params: { q: query } });
  }
}
