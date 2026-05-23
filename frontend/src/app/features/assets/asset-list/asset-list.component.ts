import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, OnInit, ViewChild, NgZone, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AgGridModule, ICellEditorAngularComp, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { Subject, Subscription, combineLatest, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { Asset, AssetService } from '../../../core/services/asset.service';
import { Location, MasterDataService, Status } from '../../../core/services/master-data.service';
import { User, UserService } from '../../../core/services/user.service';
import { ConfirmationModalComponent } from '../../../shared/components/confirmation-modal/confirmation-modal.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { ExcelExportService } from '../../../shared/services/excel-export.service';
import { AssetImportComponent } from '../asset-import/asset-import.component';
import { UserDetailDialogComponent } from '../../users/user-detail-dialog/user-detail-dialog.component';

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
    <div class="flex items-center justify-between w-full h-full group pr-2">
      <div class="flex items-center space-x-3 truncate">
        <div *ngIf="params?.data?.category" class="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-{{params.data.category.color || 'slate'}}-50 text-{{params.data.category.color || 'slate'}}-600 border border-{{params.data.category.color || 'slate'}}-100"
             [title]="params.data.category.name">
          <lucide-icon [name]="params.data.category.icon || 'package'" [size]="14"></lucide-icon>
        </div>
        <a [routerLink]="['/assets', params.data.id, 'edit']" 
           class="text-slate-800 hover:underline font-semibold transition-all truncate">
          {{ params.value }}
        </a>
      </div>
      <button 
        (click)="copyName($event)" 
        class="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-all ml-2" 
        title="Copy Name"
      >
        <lucide-icon name="copy" [size]="13"></lucide-icon>
      </button>
    </div>
  `
})
export class AssetNameRenderer implements ICellRendererAngularComp {
  params: any;
  private toastr = inject(ToastrService);

  agInit(params: ICellRendererParams): void { this.params = params; }
  refresh(params: ICellRendererParams): boolean { this.params = params; return true; }

  copyName(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    if (this.params?.value) {
      navigator.clipboard.writeText(this.params.value);
      this.toastr.success('Asset Name copied to clipboard');
    }
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden p-2 w-64 animate-in fade-in zoom-in duration-200"
         (click)="$event.stopPropagation()">
      <div class="relative mb-2">
        <lucide-icon 
          name="search" 
          [size]="14" 
          class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        ></lucide-icon>
        <input 
          #searchInput
          type="text" 
          [(ngModel)]="searchTerm" 
          (keydown.enter)="onEnterPressed($event)"
          [placeholder]="'Search...'" 
          class="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
        >
      </div>
      <div class="max-h-48 overflow-y-auto custom-scrollbar py-1">
        <div 
          *ngFor="let item of filteredItems" 
          (click)="selectItem(item)"
          class="px-3 py-2 text-xs hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between transition-colors rounded-md"
          [class.bg-indigo-50]="selectedValue === item"
          [class.text-primary]="selectedValue === item"
          [class.font-semibold]="selectedValue === item"
        >
          <span class="truncate">{{ item }}</span>
          <lucide-icon *ngIf="selectedValue === item" name="check" [size]="12"></lucide-icon>
        </div>
        <div *ngIf="filteredItems.length === 0" class="px-3 py-4 text-center text-xs text-slate-400">
          No results found
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-in {
      animation: enter 0.15s ease-out;
    }
    @keyframes enter {
      from { opacity: 0; transform: translateY(-5px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `]
})
export class SearchableCellEditorComponent implements ICellEditorAngularComp {
  params: any;
  searchTerm = '';
  values: string[] = [];
  selectedValue: string = '';

  @ViewChild('searchInput', { static: true }) searchInput!: ElementRef;

  agInit(params: any): void {
    this.params = params;
    this.values = params.values || [];
    this.selectedValue = params.value || '';
    if (!this.selectedValue && this.values.includes('Unassigned')) {
      this.selectedValue = 'Unassigned';
    }
    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.nativeElement.focus();
      }
    }, 50);
  }

  getValue() {
    return this.selectedValue;
  }

  isPopup() {
    return true;
  }

  get filteredItems() {
    if (!this.searchTerm.trim()) return this.values;
    const term = this.searchTerm.toLowerCase();
    return this.values.filter(v => v.toLowerCase().includes(term));
  }

  selectItem(item: string) {
    this.selectedValue = item;
    this.params.stopEditing();
  }

  onEnterPressed(event: any) {
    event.preventDefault();
    event.stopPropagation();
    const filtered = this.filteredItems;
    if (filtered.length > 0) {
      this.selectItem(filtered[0]);
    }
  }
}

@Component({
  selector: 'app-asset-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, AgGridModule, FormsModule, AssetImportComponent, SkeletonLoaderComponent, ConfirmationModalComponent, SearchableCellEditorComponent, UserDetailDialogComponent],
  templateUrl: './asset-list.component.html',
  styleUrls: ['./asset-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetListComponent implements OnInit, OnDestroy {
  private assetService = inject(AssetService);
  private excelExportService = inject(ExcelExportService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private masterDataService = inject(MasterDataService);
  private userService = inject(UserService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private subs: Subscription[] = [];
  private assetsSub?: Subscription;

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
  showLaptopWarningModal = false;
  pendingAssignment: { assetId: string; userId: string | null; userName: string } | null = null;
  laptopWarningMessage = 'This employee already has a laptop assigned. Do you want to proceed?';
  showUserDetailDialog = false;
  selectedUserIdForDialog: string | null = null;
  
  loading = false;
  currentFilters: any = {};
  statuses: Status[] = [];
  locations: Location[] = [];
  users: User[] = [];
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
    if (this.assetsSub) {
      this.assetsSub.unsubscribe();
    }

    this.loading = true;
    this.currentFilters = params;
    this.cdr.markForCheck();

    this.assetsSub = this.assetService.getAssets(params).subscribe({
      next: (res: any) => {
        this.assets = res.data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to load assets');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private rebuildColumnDefs() {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('columnDefs', this.buildColumnDefs());
  }

  /** Load all master-data in parallel, then do ONE grid rebuild */
  private loadMasterData(): void {
    forkJoin({
      statuses: this.masterDataService.getStatuses().pipe(take(1)),
      locations: this.masterDataService.getLocations().pipe(take(1)),
      users: this.userService.getUsers().pipe(take(1))
    }).subscribe(({ statuses, locations, users }) => {
      this.statuses = statuses;
      this.locations = locations;
      this.users = users;
      this.rebuildColumnDefs();
    });
  }

  openUserDialog(userId: string) {
    this.selectedUserIdForDialog = userId;
    this.showUserDetailDialog = true;
  }

  saveTableState() {
    const state = {
      selectedStatusId: this.selectedStatusId,
      currentSearchTerm: this.currentSearchTerm,
      showFloatingFilters: this.showFloatingFilters,
      gridFilterModel: this.gridApi ? this.gridApi.getFilterModel() : null,
      currentFilters: this.currentFilters
    };
    localStorage.setItem('assets_table_state', JSON.stringify(state));
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    
    // 1. Restore floating filter toggle state
    const savedStateStr = localStorage.getItem('assets_table_state');
    if (savedStateStr) {
      try {
        const state = JSON.parse(savedStateStr);
        this.showFloatingFilters = !!state.showFloatingFilters;
        this.gridApi.setGridOption('floatingFiltersHeight', this.showFloatingFilters ? 50 : 0);
      } catch (e) {
        console.warn('Could not restore floating filter state:', e);
      }
    }
    
    this.rebuildColumnDefs();

    // 2. Restore AG Grid column filter model
    if (savedStateStr) {
      try {
        const state = JSON.parse(savedStateStr);
        if (state.gridFilterModel && Object.keys(state.gridFilterModel).length > 0) {
          setTimeout(() => {
            this.gridApi.setFilterModel(state.gridFilterModel);
          }, 200);
        }
      } catch (e) {
        console.warn('Could not restore AG Grid filter model:', e);
      }
    }
  }

  onFilterChanged() {
    this.saveTableState();
  }

  onSelectionChanged() {
    this.selectedCount = this.gridApi.getSelectedNodes().length;
  }

  onSearch(event: any) {
    const term = event.target.value as string;
    this.currentSearchTerm = term;
    this.searchSubject.next(term);
  }

  clearSearch() {
    this.currentSearchTerm = '';
    this.searchSubject.next('');
  }

  filterByStatus(statusId: string | null) {
    this.selectedStatusId = statusId;
    this.currentFilters = { ...this.currentFilters, statusId };
    if (!statusId) delete this.currentFilters.statusId;
    
    const loadParams = { ...this.currentFilters };
    if (this.currentSearchTerm) loadParams.search = this.currentSearchTerm;
    
    this.loadAssets(loadParams);
    this.saveTableState();
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

  async exportToExcel() {
    const dataToExport = this.assets.map(asset => ({
      'Name': asset.name,
      'Serial Number': asset.serialNumber,
      'Status': asset.status?.name || '',
      'Location': asset.location?.name || '',
      'Assigned To': asset.assignedUser?.name || 'Unassigned',
      'Category': asset.category?.name || '',
      'Notes': asset.notes || ''
    }));
    await this.excelExportService.exportToExcel(dataToExport, 'assets');
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
            next: (updatedAsset: Asset) => {
              this.toastr.success(`Status updated to ${newStatus.name}`);
              this.updateLocalAsset(updatedAsset);
            },
            error: () => {
              this.toastr.error('Failed to update status');
              this.loadAssets(this.currentFilters);
            }
          });
        }
      },
      { 
        field: 'location.name', 
        headerName: 'Location', 
        flex: 1.5,
        editable: true,
        cellEditor: SearchableCellEditorComponent,
        cellEditorParams: { values: this.locations.map(l => l.name) },
        valueSetter: (params: any) => {
          if (!params.data.location) {
            params.data.location = {};
          }
          params.data.location.name = params.newValue;
          return true;
        },
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
            next: (updatedAsset: Asset) => {
              this.toastr.success(`Location updated to ${newLoc.name}`);
              this.updateLocalAsset(updatedAsset);
            },
            error: () => {
              this.toastr.error('Failed to update location');
              this.loadAssets(this.currentFilters);
            }
          });
        }

      },
      { 
        field: 'assignedUser.name', 
        headerName: 'Assigned To', 
        flex: 1.5,
        editable: true,
        cellEditor: SearchableCellEditorComponent,
        cellEditorParams: { values: ['Unassigned', ...this.users.map(u => u.name)] },
        valueSetter: (params: any) => {
          if (!params.data.assignedUser) {
            params.data.assignedUser = {};
          }
          params.data.assignedUser.name = params.newValue;
          return true;
        },
        cellRenderer: (params: any) => {
          const name = params.value || 'Unassigned';
          const isUnassigned = name === 'Unassigned' || !params.data?.assignedUserId;
          const displayHtml = isUnassigned
            ? `<span class="text-slate-400 text-xs">Unassigned</span>`
            : `<span class="user-detail-link text-primary hover:underline font-medium cursor-pointer">${name}</span>`;
          return `<div class="flex items-center gap-1.5 group/assign">
            ${displayHtml}
            <span class="opacity-0 group-hover/assign:opacity-100 text-[10px] text-slate-400 transition-opacity">click to edit</span>
          </div>`;
        },
        onCellClicked: (params: any) => {
          const target = params.event?.target as HTMLElement;
          if (target?.closest('.user-detail-link') && params.data?.assignedUserId) {
            params.event.stopPropagation();
            params.event.preventDefault();
            this.ngZone.run(() => {
              this.selectedUserIdForDialog = params.data.assignedUserId;
              this.showUserDetailDialog = true;
            });
          }
        },
        onCellValueChanged: (params: any) => {
          this.ngZone.run(() => {
            const newUserName = params.newValue;
            const oldUserName = params.oldValue || 'Unassigned';
            if (newUserName === oldUserName) return;

            const catName = params.data.category?.name?.toLowerCase() || '';
            const isLaptop = catName === 'laptop' || catName === 'laptops' || catName.includes('laptop');

            let newUserId: string | null = null;
            if (newUserName && newUserName !== 'Unassigned') {
              const foundUser = this.users.find(u => u.name === newUserName);
              if (!foundUser) {
                this.toastr.error('User not found');
                this.loadAssets(this.currentFilters);
                return;
              }
              newUserId = foundUser.id;
            }

            // Case A: Block direct transfer of an in-use laptop
            if (isLaptop && oldUserName !== 'Unassigned' && newUserName !== 'Unassigned' && newUserId) {
              this.assetService.getAssets({ assignedUserId: newUserId }).subscribe({
                next: (res: any) => {
                  const existingLaptop = res.data.find((a: any) => 
                    a.id !== params.data.id && 
                    (a.category?.name?.toLowerCase() === 'laptop' || 
                     a.category?.name?.toLowerCase() === 'laptops' || 
                     a.category?.name?.toLowerCase().includes('laptop'))
                  );
                  if (existingLaptop) {
                    this.toastr.error(
                      `This laptop is currently assigned to ${oldUserName} and must be returned to stock before transferring. Additionally, ${newUserName} already has a laptop assigned with serial ${existingLaptop.serialNumber || 'N/A'}.`,
                      'Transfer Blocked',
                      { timeOut: 8000 }
                    );
                  } else {
                    this.toastr.error(
                      `This laptop is currently assigned to ${oldUserName} and must be returned to stock before transferring.`,
                      'Transfer Blocked',
                      { timeOut: 6000 }
                    );
                  }
                  this.loadAssets(this.currentFilters);
                },
                error: () => {
                  this.toastr.error(`This laptop is currently assigned to ${oldUserName} and must be returned to stock before transferring.`);
                  this.loadAssets(this.currentFilters);
                }
              });
              return;
            }

            // Case B: Normal assignment flow (laptop is in stock / unassigned)
            if (isLaptop && newUserId) {
              this.assetService.getAssets({ assignedUserId: newUserId }).subscribe({
                next: (res: any) => {
                  const existingLaptop = res.data.find((a: any) => 
                    a.id !== params.data.id && 
                    (a.category?.name?.toLowerCase() === 'laptop' || 
                     a.category?.name?.toLowerCase() === 'laptops' || 
                     a.category?.name?.toLowerCase().includes('laptop'))
                  );
                  if (existingLaptop) {
                    this.pendingAssignment = {
                      assetId: params.data.id,
                      userId: newUserId,
                      userName: newUserName
                    };
                    this.laptopWarningMessage = `This employee already has a laptop assigned (Serial: ${existingLaptop.serialNumber || 'N/A'}). Do you want to proceed?`;
                    this.showLaptopWarningModal = true;
                  } else {
                    this.executeAssetAssignment(params.data.id, newUserId);
                  }
                },
                error: () => {
                  this.executeAssetAssignment(params.data.id, newUserId);
                }
              });
            } else {
              this.executeAssetAssignment(params.data.id, newUserId);
            }
          });
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
    // Load master data first (statuses, locations, users) in ONE parallel call
    this.loadMasterData();
    this.loadSavedViews();

    // Restore table state from local storage on load
    const savedStateStr = localStorage.getItem('assets_table_state');
    if (savedStateStr) {
      try {
        const state = JSON.parse(savedStateStr);
        this.selectedStatusId = state.selectedStatusId || null;
        this.currentSearchTerm = state.currentSearchTerm || '';
        this.showFloatingFilters = !!state.showFloatingFilters;
        if (state.currentFilters) {
          this.currentFilters = { ...state.currentFilters };
        }
      } catch (e) {
        console.warn('Could not restore asset table state:', e);
      }
    }

    // Subscribe to query params — load assets with any URL-provided filters
    const qpSub = this.route.queryParams.subscribe(params => {
      const queryUserId = params['userId'];
      const queryStatusId = params['statusId'];
      const queryCategoryId = params['categoryId'];

      if (queryUserId !== undefined || queryStatusId !== undefined || queryCategoryId !== undefined) {
        this.currentFilters = {
          userId: queryUserId || null,
          statusId: queryStatusId || null,
          categoryId: queryCategoryId || null
        };
        this.selectedStatusId = this.currentFilters.statusId;
      } else {
        if (!this.currentFilters) {
          this.currentFilters = {};
        }
      }
      
      const loadParams: any = {};
      Object.keys(this.currentFilters).forEach(key => {
        if (this.currentFilters[key]) loadParams[key] = this.currentFilters[key];
      });
      if (this.currentSearchTerm) {
        loadParams['search'] = this.currentSearchTerm;
      }

      this.loadAssets(loadParams);
      this.saveTableState();
    });
    this.subs.push(qpSub);
    
    const searchSub = this.searchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(searchTerm => {
      this.currentSearchTerm = searchTerm;
      const params: any = { ...this.currentFilters, search: searchTerm };
      const loadParams: any = {};
      Object.keys(params).forEach(key => { if (params[key]) loadParams[key] = params[key]; });
      this.loadAssets(loadParams);
      this.saveTableState();
    });
    this.subs.push(searchSub);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  toggleFilters() {
    this.showFloatingFilters = !this.showFloatingFilters;
    this.gridApi.setGridOption('floatingFiltersHeight', this.showFloatingFilters ? 50 : 0);
    const newColDefs = this.buildColumnDefs().map(col => ({ ...col, floatingFilter: this.showFloatingFilters }));
    this.gridApi.setGridOption('columnDefs', newColDefs);
    this.saveTableState();
  }

  getRowId = (params: any) => params.data.id;

  updateLocalAsset(updatedAsset: Asset) {
    const idx = this.assets.findIndex(a => a.id === updatedAsset.id);
    if (idx > -1) {
      this.assets[idx] = updatedAsset;
    }
    if (this.gridApi) {
      const rowNode = this.gridApi.getRowNode(updatedAsset.id);
      if (rowNode) {
        rowNode.setData(updatedAsset);
        this.gridApi.refreshCells({ rowNodes: [rowNode] });
      }
    }
  }

  executeAssetAssignment(assetId: string, userId: string | null) {
    this.assetService.updateAsset(assetId, { assignedUserId: userId }).subscribe({
      next: (updatedAsset: any) => {
        this.toastr.success(userId ? `Assigned to ${updatedAsset.assignedUser?.name}` : 'Asset unassigned');
        this.updateLocalAsset(updatedAsset);
      },
      error: () => {
        this.toastr.error('Failed to update assignment');
        this.loadAssets(this.currentFilters);
      }
    });
  }


  confirmLaptopAssignment() {
    this.showLaptopWarningModal = false;
    if (this.pendingAssignment) {
      this.executeAssetAssignment(this.pendingAssignment.assetId, this.pendingAssignment.userId);
      this.pendingAssignment = null;
    }
  }

  cancelLaptopAssignment() {
    this.showLaptopWarningModal = false;
    this.pendingAssignment = null;
    this.toastr.info('Assignment cancelled');
    this.loadAssets(this.currentFilters);
  }
}
