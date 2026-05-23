import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, TemplateRef } from '@angular/core';

export interface TableColumn {
  key: string;
  label: string;
  template: TemplateRef<any> | null;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-100">
      <table class="w-full text-sm text-left text-slate-500">
        <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
          <tr>
            <th *ngFor="let col of columns" class="px-6 py-4 font-semibold tracking-wider">{{ col.label }}</th>
            <th *ngIf="actionsTemplate" class="px-6 py-4 font-semibold text-right tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <!-- Loading State -->
          <tr *ngIf="loading" class="bg-white">
            <td [attr.colspan]="columns.length + (actionsTemplate ? 1 : 0)" class="px-6 py-20 text-center">
              <div class="flex flex-col items-center justify-center space-y-3">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <span class="text-slate-400 font-medium">Loading data...</span>
              </div>
            </td>
          </tr>

          <!-- Empty State -->
          <tr *ngIf="!loading && data.length === 0" class="bg-white">
            <td [attr.colspan]="columns.length + (actionsTemplate ? 1 : 0)" class="px-6 py-20 text-center">
              <div class="flex flex-col items-center justify-center space-y-2">
                <div class="p-3 bg-slate-50 rounded-full">
                  <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                </div>
                <span class="text-slate-500 font-medium">No results found</span>
                <p class="text-slate-400 text-xs">Try adjusting your filters or search terms.</p>
              </div>
            </td>
          </tr>

          <!-- Data Rows -->
          <tr *ngFor="let row of data" class="bg-white hover:bg-slate-50 transition-colors group">
            <td *ngFor="let col of columns" class="px-6 py-4 whitespace-nowrap">
              <ng-container *ngIf="!col.template; else customCol">
                <span class="text-slate-700">{{ row[col.key] || '-' }}</span>
              </ng-container>
              <ng-template #customCol [ngTemplateOutlet]="col.template" [ngTemplateOutletContext]="{ $implicit: row }"></ng-template>
            </td>
            <td *ngIf="actionsTemplate" class="px-6 py-4 text-right whitespace-nowrap">
              <ng-container [ngTemplateOutlet]="actionsTemplate" [ngTemplateOutletContext]="{ $implicit: row }"></ng-container>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent {
  @Input() data: any[] = [];
  @Input() columns: TableColumn[] = [];
  @Input() loading = false;
  @Input() actionsTemplate?: TemplateRef<any>;
}
