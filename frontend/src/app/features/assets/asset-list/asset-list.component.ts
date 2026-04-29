import { Component, inject, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Search, Filter, Plus, Download, Trash2, TriangleAlert, Upload, Pencil, Check, X } from 'lucide-angular';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { AssetService, Asset } from '../../../core/services/asset.service';
import { MasterDataService, Status } from '../../../core/services/master-data.service';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { ConfirmationModalComponent } from '../../../shared/components/confirmation-modal/confirmation-modal.component';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { AssetImportComponent } from '../asset-import/asset-import.component';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <div class="flex items-center space-x-3 h-full">
      <div *ngIf="params?.data?.category" class="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-{{params.data.category.color || 'slate'}}-50 text-{{params.data.category.color || 'slate'}}-600 border border-{{params.data.category.color || 'slate'}}-100"
           [title]="params.data.category.name">
        <lucide-icon [name]="params.data.category.icon || 'package'" [size]="14"></lucide-icon>
      </div>
      <a [routerLink]="['/assets', params.data.id, 'edit']" 
         class="text-slate-800 hover:underline font-semibold transition-all truncate">
        {{ params.value }}
      </a>
    </div>
  `
})
export class AssetNameRenderer implements ICellRendererAngularComp {
  params: any;
  agInit(params: ICellRendererParams): void {
    this.params = params;
  }
  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    return true;
  }
}

@Component({
  selector: 'app-asset-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, AgGridModule, FormsModule, AssetImportComponent, SkeletonLoaderComponent, ConfirmationModalComponent],
  templateUrl: './asset-list.component.html',
  styleUrls: ['./asset-list.component.css']
})
export class AssetListComponent implements OnInit {
  private assetService = inject(AssetService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private masterDataService = inject(MasterDataService);

  private gridApi!: GridApi;
  private searchSubject = new Subject<string>();

  assets: Asset[] = [];
  selectedCount = 0;
  showImportModal = false;
  
  // Modal states
  showConfirmDelete = false;
  showUnassignConfirm = false;
  unassignErrorMsg = '';
  deleteType: 'single' | 'bulk' = 'single';
  assetToDelete: Asset | null = null;
  
  loading = false;
  currentFilters: any = {};
  statuses: Status[] = [];
  selectedStatusId: string | null = null;
  
  gridIcons = {
    filter: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6366f1; opacity: 0.8;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    sortAscending: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6366f1;"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>',
    sortDescending: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6366f1;"><path d="m19 12-7 7-7-7"/><path d="M12 5v14"/></svg>'
  };

  loadAssets(params: any = {}) {
    this.loading = true;
    this.currentFilters = params;
    this.assetService.getAssets(params).subscribe({
      next: (res: any) => {
        this.assets = res.data;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load assets');
        this.loading = false;
      }
    });
  }

  loadStatuses() {
    this.masterDataService.getStatuses().subscribe(res => {
      this.statuses = res;
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onSelectionChanged() {
    this.selectedCount = this.gridApi.getSelectedNodes().length;
  }

  onSearch(event: any) {
    const value = event.target.value;
    this.searchSubject.next(value);
  }

  filterByStatus(statusId: string | null) {
    this.selectedStatusId = statusId;
    const params = { ...this.currentFilters, statusId };
    if (!statusId) delete params.statusId;
    this.loadAssets(params);
  }

  confirmDeleteSingle(asset: Asset) {
    this.assetToDelete = asset;
    this.deleteType = 'single';
    this.showConfirmDelete = true;
  }

  confirmDeleteBulk() {
    if (this.selectedCount === 0) return;
    this.deleteType = 'bulk';
    this.showConfirmDelete = true;
  }

  cancelDelete() {
    this.showConfirmDelete = false;
    this.showUnassignConfirm = false;
    this.assetToDelete = null;
    this.unassignErrorMsg = '';
  }

  executeDelete(force: boolean = false) {
    console.log('executeDelete called', { force, deleteType: this.deleteType, assetToDelete: this.assetToDelete });
    
    if (this.deleteType === 'single' && this.assetToDelete) {
      this.assetService.deleteAsset(this.assetToDelete.id, force).subscribe({
        next: () => {
          this.toastr.success('Asset deleted successfully');
          this.loadAssets(this.currentFilters);
          this.showConfirmDelete = false;
          this.showUnassignConfirm = false;
          this.assetToDelete = null;
        },
        error: (err) => {
          if (err.status === 409) {
            this.unassignErrorMsg = err.error.message;
            this.showUnassignConfirm = true;
          } else {
            this.toastr.error('Failed to delete asset');
          }
        }
      });
    } else if (this.deleteType === 'bulk') {
      const selectedNodes = this.gridApi.getSelectedNodes();
      const ids = selectedNodes.map(node => node.data.id);
      
      this.assetService.bulkDeleteAssets(ids, force).subscribe({
        next: (res: any) => {
          if (res.errors && res.errors.length > 0 && !force) {
            this.unassignErrorMsg = `Some selected assets are currently assigned. Do you want to unassign and delete them all?`;
            this.showUnassignConfirm = true;
          } else {
            const deletedCount = res.count || 0;
            const errorCount = res.errors?.length || 0;
            
            if (deletedCount > 0) {
              this.toastr.success(`${deletedCount} assets deleted successfully`);
            }
            
            if (errorCount > 0) {
              this.toastr.error(`${errorCount} assets failed to delete.`);
            }

            if (deletedCount > 0 || errorCount === 0) {
              this.loadAssets(this.currentFilters);
              this.selectedCount = 0;
              this.showConfirmDelete = false;
              this.showUnassignConfirm = false;
            }
          }
        },
        error: (err) => {
          if (err.status === 409) {
            this.unassignErrorMsg = err.error.message;
            this.showUnassignConfirm = true;
          } else {
            this.toastr.error('Failed to delete assets');
          }
        }
      });
    }
  }

  deleteAsset(asset: Asset) {
    this.confirmDeleteSingle(asset);
  }

  deleteSelectedAssets() {
    this.confirmDeleteBulk();
  }

  columnDefs: ColDef[] = [
    { 
      field: 'name', 
      headerName: 'Asset Name', 
      flex: 2.5,
      cellRenderer: AssetNameRenderer
    },
    { 
      field: 'serialNumber', 
      headerName: 'Serial Number', 
      flex: 2,
      cellRenderer: (params: any) => {
        if (!params.value) return '-';
        return `
          <div class="flex items-center justify-between group">
            <span class="truncate">${params.value}</span>
            <button class="copy-btn opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-all ml-2" 
                    title="Copy to clipboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
          </div>
        `;
      },
      onCellClicked: (event: any) => {
        if (event.event?.target?.closest('.copy-btn')) {
          navigator.clipboard.writeText(event.value);
          this.toastr.success('Copied to clipboard');
        }
      }
    },
    { 
      field: 'category.name', 
      headerName: 'Category', 
      flex: 1,
      cellClass: 'text-slate-500 font-medium'
    },
    { 
      field: 'status.name', 
      headerName: 'Status', 
      flex: 1,
      cellRenderer: (params: any) => {
        const colorClass = params.data?.status?.colorClass || 'bg-slate-100 text-slate-700';
        const name = params.value || 'Unknown';
        return `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}">${name}</span>`;
      }
    },
    { field: 'location.name', headerName: 'Location', flex: 1.5 },
    { 
      field: 'assignedUser.name', 
      headerName: 'Assigned To', 
      flex: 1.5,
      cellRenderer: (params: any) => {
        if (!params.value) return '-';
        const userId = params.data?.assignedUserId;
        if (!userId) return params.value;
        return `<a href="/users?userId=${userId}" class="text-primary hover:underline font-medium">${params.value}</a>`;
      }
    }
  ];

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: false,
  };

  rowSelection: 'single' | 'multiple' = 'multiple';

  showFloatingFilters = false;
  
  ngOnInit() {
    this.loadStatuses();
    this.route.queryParams.subscribe(params => {
      this.currentFilters = {
        userId: params['userId'] || null,
        statusId: params['statusId'] || null,
        categoryId: params['categoryId'] || null
      };
      
      const loadParams: any = {};
      Object.keys(this.currentFilters).forEach(key => {
        if (this.currentFilters[key]) loadParams[key] = this.currentFilters[key];
      });

      this.loadAssets(loadParams);
    });
    
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      const params: any = { ...this.currentFilters, search: searchTerm };
      const loadParams: any = {};
      Object.keys(params).forEach(key => {
        if (params[key]) loadParams[key] = params[key];
      });
      this.loadAssets(loadParams);
    });
  }

  toggleFilters() {
    this.showFloatingFilters = !this.showFloatingFilters;
    this.gridApi.setGridOption('floatingFiltersHeight', this.showFloatingFilters ? 50 : 0);
    
    const newColDefs = this.columnDefs.map(col => ({
      ...col,
      floatingFilter: this.showFloatingFilters
    }));
    this.gridApi.setGridOption('columnDefs', newColDefs);
  }
}
