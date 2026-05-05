import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Search, Filter, Plus, Download, Trash2, TriangleAlert, Upload, Pencil, Check, X, Copy, Bookmark, BookmarkCheck, MoreHorizontal } from 'lucide-angular';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { AssetService, Asset } from '../../../core/services/asset.service';
import { MasterDataService, Status, Location } from '../../../core/services/master-data.service';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { ConfirmationModalComponent } from '../../../shared/components/confirmation-modal/confirmation-modal.component';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { AssetImportComponent } from '../asset-import/asset-import.component';

const SAVED_VIEWS_KEY = 'asset_saved_views';

interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string | null>;  // status/location/etc pill filters
  searchTerm?: string;                      // search bar keyword
  gridFilterModel?: Record<string, any>;    // AG Grid column filter state
}

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
  agInit(params: ICellRendererParams): void { this.params = params; }
  refresh(params: ICellRendererParams): boolean { this.params = params; return true; }
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
  locations: Location[] = [];
  selectedStatusId: string | null = null;

  // Saved Views
  savedViews: SavedView[] = [];
  showSaveViewInput = false;
  newViewName = '';
  currentSearchTerm = '';   // tracks the live search keyword

  // Inline edit state
  editingCellId: string | null = null;

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
        // Rebuild column defs now that statuses/locations are loaded
        this.rebuildColumnDefs();
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
      this.rebuildColumnDefs();
    });
  }

  loadLocations() {
    this.masterDataService.getLocations().subscribe(res => {
      this.locations = res;
      this.rebuildColumnDefs();
    });
  }

  private rebuildColumnDefs() {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('columnDefs', this.buildColumnDefs());
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.rebuildColumnDefs();
  }

  onSelectionChanged() {
    this.selectedCount = this.gridApi.getSelectedNodes().length;
  }

  onSearch(event: any) {
    const term = event.target.value as string;
    this.currentSearchTerm = term;
    this.searchSubject.next(term);
  }

  filterByStatus(statusId: string | null) {
    this.selectedStatusId = statusId;
    const params = { ...this.currentFilters, statusId };
    if (!statusId) delete params.statusId;
    this.loadAssets(params);
  }

  // ── Saved Views ────────────────────────────────────────────────────

  loadSavedViews() {
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY);
      this.savedViews = raw ? JSON.parse(raw) : [];
    } catch { this.savedViews = []; }
  }

  saveSavedViews() {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(this.savedViews));
  }

  saveCurrentView() {
    if (!this.newViewName.trim()) return;
    const view: SavedView = {
      id: Date.now().toString(),
      name: this.newViewName.trim(),
      filters: { ...this.currentFilters, statusId: this.selectedStatusId },
      searchTerm: this.currentSearchTerm || '',
      gridFilterModel: this.gridApi ? this.gridApi.getFilterModel() : {},
    };
    this.savedViews = [...this.savedViews, view];
    this.saveSavedViews();
    this.newViewName = '';
    this.showSaveViewInput = false;
    this.toastr.success(`View "${view.name}" saved`);
  }

  applyView(view: SavedView) {
    // 1. Restore status pill
    this.selectedStatusId = view.filters['statusId'] || null;

    // 2. Restore search term
    this.currentSearchTerm = view.searchTerm || '';
    // Push search into the input element via a shared signal
    // (We'll update the input value via a ViewChild alternative — use searchSubject directly)
    this.searchSubject.next(this.currentSearchTerm);

    // 3. Build reload params (pill filters + search keyword)
    const loadParams: any = {};
    const merged: Record<string, any> = { ...view.filters, search: this.currentSearchTerm };
    Object.keys(merged).forEach(k => { if (merged[k]) loadParams[k] = merged[k]; });
    this.currentFilters = { ...merged };
    this.loadAssets(loadParams);

    // 4. Restore AG Grid column filter model (after grid has data)
    if (view.gridFilterModel && Object.keys(view.gridFilterModel).length > 0 && this.gridApi) {
      setTimeout(() => this.gridApi.setFilterModel(view.gridFilterModel!), 200);
    }
  }

  deleteView(view: SavedView, event: Event) {
    event.stopPropagation();
    this.savedViews = this.savedViews.filter(v => v.id !== view.id);
    this.saveSavedViews();
  }

  // ── Delete with Undo ───────────────────────────────────────────────

  /** Desktop Actions column: show confirmation modal */
  confirmDeleteSingle(asset: Asset) {
    this.assetToDelete = asset;
    this.deleteType = 'single';
    this.showConfirmDelete = true;
  }

  /** Mobile card: optimistic remove + 6s undo toast */
  deleteSingleWithUndo(asset: Asset) {
    // Optimistically remove
    const idx = this.assets.findIndex(a => a.id === asset.id);
    if (idx > -1) this.assets = this.assets.filter(a => a.id !== asset.id);

    let undone = false;

    // Custom undo toast via innerHTML
    const toastRef = this.toastr.warning(
      `<div class="flex items-center justify-between gap-3">
        <span>Asset <strong>${asset.name}</strong> deleted.</span>
        <button id="undo-btn-${asset.id}"
          style="background:#4f46e5;color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">
          Undo
        </button>
      </div>`,
      '',
      { enableHtml: true, timeOut: 6000, tapToDismiss: false, progressBar: true }
    );

    // Listen for undo click
    const clickHandler = (e: MouseEvent) => {
      const btn = document.getElementById(`undo-btn-${asset.id}`);
      if (btn && (e.target === btn || btn.contains(e.target as Node))) {
        undone = true;
        // Restore asset to list
        const restored = [...this.assets];
        restored.splice(idx, 0, asset);
        this.assets = restored;
        this.toastr.success(`Restored: ${asset.name}`);
        toastRef.toastRef.close();
        document.removeEventListener('click', clickHandler);
      }
    };
    document.addEventListener('click', clickHandler);

    // After toast closes, execute real delete if not undone
    toastRef.onHidden.subscribe(() => {
      document.removeEventListener('click', clickHandler);
      if (!undone) {
        this.assetService.deleteAsset(asset.id, false).subscribe({
          error: (err) => {
            if (err.status === 409) {
              // Restore and show unassign confirm
              const restored = [...this.assets];
              restored.splice(idx, 0, asset);
              this.assets = restored;
              this.assetToDelete = asset;
              this.deleteType = 'single';
              this.unassignErrorMsg = err.error.message;
              this.showUnassignConfirm = true;
            } else {
              this.toastr.error('Failed to delete asset');
              // Restore
              const restored = [...this.assets];
              restored.splice(idx, 0, asset);
              this.assets = restored;
            }
          }
        });
      }
    });
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
            if (deletedCount > 0) this.toastr.success(`${deletedCount} assets deleted successfully`);
            if (errorCount > 0) this.toastr.error(`${errorCount} assets failed to delete.`);
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
    this.deleteSingleWithUndo(asset);
  }

  deleteSelectedAssets() {
    this.confirmDeleteBulk();
  }

  // ── Clone Asset ────────────────────────────────────────────────────
  cloneAsset(asset: Asset) {
    this.router.navigate(['/assets/new'], {
      state: {
        cloneData: {
          name: asset.name,
          categoryId: asset.categoryId,
          statusId: asset.statusId,
          locationId: asset.locationId,
          notes: asset.notes,
          imageUrl: asset.imageUrl
        }
      }
    });
  }

  // ── Inline Status Edit (mobile card) ──────────────────────────────
  onMobileStatusChange(asset: Asset, newStatusId: string) {
    const originalStatusId = asset.statusId;
    asset.statusId = newStatusId;
    const newStatus = this.statuses.find(s => s.id === newStatusId);
    if (newStatus) (asset as any).status = newStatus;

    this.assetService.updateAsset(asset.id, { statusId: newStatusId }).subscribe({
      next: () => this.toastr.success('Status updated'),
      error: () => {
        asset.statusId = originalStatusId;
        this.toastr.error('Failed to update status');
      }
    });
  }

  // ── Column Definitions ─────────────────────────────────────────────
  buildColumnDefs(): ColDef[] {
    return [
      { 
        field: 'name', 
        headerName: 'Asset Name', 
        flex: 2.5,
        cellRenderer: AssetNameRenderer
      },
      { 
        field: 'serialNumber', 
        headerName: 'Serial No.', 
        flex: 1.8,
        cellRenderer: (params: any) => {
          if (!params.value) return '-';
          return `
            <div class="flex items-center justify-between group">
              <span class="truncate font-mono text-xs">${params.value}</span>
              <button class="copy-btn opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-all ml-2" title="Copy">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
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
      { field: 'category.name', headerName: 'Category', flex: 1, cellClass: 'text-slate-500 font-medium' },
      { 
        field: 'status.name', 
        headerName: 'Status', 
        flex: 1.2,
        editable: (params: any) => !params.data?.assignedUserId,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: this.statuses.map(s => s.name) },
        cellRenderer: (params: any) => {
          const colorClass = params.data?.status?.colorClass || 'bg-slate-100 text-slate-700';
          const name = params.value || 'Unknown';
          const editable = !params.data?.assignedUserId;
          return `<div class="flex items-center gap-1.5 group/status">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}">${name}</span>
            ${editable ? '<span class="opacity-0 group-hover/status:opacity-100 text-[10px] text-slate-400 transition-opacity">click to edit</span>' : ''}
          </div>`;
        },
        onCellValueChanged: (params: any) => {
          const newStatus = this.statuses.find(s => s.name === params.newValue);
          if (!newStatus || params.newValue === params.oldValue) return;
          this.assetService.updateAsset(params.data.id, { statusId: newStatus.id }).subscribe({
            next: () => {
              params.data.status = newStatus;
              params.data.statusId = newStatus.id;
              // Force re-render so badge color updates immediately
              params.api.refreshCells({ rowNodes: [params.node], columns: ['status.name'], force: true });
              this.toastr.success(`Status updated to ${newStatus.name}`);
            },
            error: () => {
              this.toastr.error('Failed to update status');
              params.node.setDataValue('status.name', params.oldValue);
            }
          });
        }
      },
      { 
        field: 'location.name', 
        headerName: 'Location', 
        flex: 1.5,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: this.locations.map(l => l.name) },
        cellRenderer: (params: any) => {
          const name = params.value || '-';
          return `<div class="flex items-center gap-1.5 group/loc">
            <span>${name}</span>
            <span class="opacity-0 group-hover/loc:opacity-100 text-[10px] text-slate-400 transition-opacity">click to edit</span>
          </div>`;
        },
        onCellValueChanged: (params: any) => {
          const newLoc = this.locations.find(l => l.name === params.newValue);
          if (!newLoc || params.newValue === params.oldValue) return;
          this.assetService.updateAsset(params.data.id, { locationId: newLoc.id }).subscribe({
            next: () => {
              params.data.location = newLoc;
              params.data.locationId = newLoc.id;
              this.toastr.success(`Location updated to ${newLoc.name}`);
            },
            error: () => {
              this.toastr.error('Failed to update location');
              params.node.setDataValue('location.name', params.oldValue);
            }
          });
        }
      },
      { 
        field: 'assignedUser.name', 
        headerName: 'Assigned To', 
        flex: 1.5,
        cellRenderer: (params: any) => {
          if (!params.value) return '<span class="text-slate-400 text-xs">Unassigned</span>';
          const userId = params.data?.assignedUserId;
          if (!userId) return params.value;
          return `<a href="/users?userId=${userId}" class="text-primary hover:underline font-medium">${params.value}</a>`;
        }
      },
      {
        headerName: 'Actions',
        width: 130,
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        pinned: 'right' as const,
        cellRenderer: (params: any) => {
          return `
            <div class="flex items-center gap-1 h-full">
              <a href="/assets/${params.data.id}/edit"
                 class="action-edit-btn p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-primary rounded-lg transition-all"
                 title="Edit">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </a>
              <button class="action-clone-btn p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 rounded-lg transition-all" title="Duplicate">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button class="action-delete-btn p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          `;
        },
        onCellClicked: (params: any) => {
          const target = params.event?.target as HTMLElement;
          if (target?.closest('.action-delete-btn')) this.confirmDeleteSingle(params.data);
          else if (target?.closest('.action-clone-btn')) this.cloneAsset(params.data);
        }
      }
    ];
  }

  columnDefs: ColDef[] = this.buildColumnDefs();

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
    this.loadLocations();
    this.loadSavedViews();

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
    
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(searchTerm => {
      const params: any = { ...this.currentFilters, search: searchTerm };
      const loadParams: any = {};
      Object.keys(params).forEach(key => { if (params[key]) loadParams[key] = params[key]; });
      this.loadAssets(loadParams);
    });
  }

  toggleFilters() {
    this.showFloatingFilters = !this.showFloatingFilters;
    this.gridApi.setGridOption('floatingFiltersHeight', this.showFloatingFilters ? 50 : 0);
    const newColDefs = this.buildColumnDefs().map(col => ({ ...col, floatingFilter: this.showFloatingFilters }));
    this.gridApi.setGridOption('columnDefs', newColDefs);
  }
}
