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
import { AssetDrawerComponent } from '../../../shared/components/asset-drawer/asset-drawer.component';
import { UserHoverCardComponent } from '../../../shared/components/user-hover-card/user-hover-card.component';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <div class="flex items-center justify-between w-full h-full group pr-2">
      <div class="flex items-center space-x-2.5 truncate">
        <div *ngIf="params?.data?.category" class="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs"
             [title]="params.data.category.name">
          <lucide-icon [name]="params.data.category.icon || 'laptop'" [size]="14"></lucide-icon>
        </div>
        <a [routerLink]="['/assets', params?.data?.id, 'edit']"
           class="text-slate-800 hover:text-primary hover:underline font-bold transition-all truncate text-left cursor-pointer outline-none"
           title="Edit Asset">
          {{ params.value }}
        </a>
      </div>
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          type="button"
          (click)="openDrawer($event)"
          class="p-1 hover:bg-indigo-50 rounded text-slate-400 hover:text-primary transition-all cursor-pointer"
          title="Quick Inspect Drawer">
          <lucide-icon name="panel-right" [size]="13"></lucide-icon>
        </button>
        <button 
          type="button"
          (click)="copyName($event)" 
          class="p-1 rounded transition-all cursor-pointer" 
          [ngClass]="copied ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-400 hover:text-primary'"
          [title]="copied ? 'Copied!' : 'Copy Name'"
        >
          <lucide-icon [name]="copied ? 'check' : 'copy'" [size]="13"></lucide-icon>
        </button>
      </div>
    </div>
  `
})
export class AssetNameRenderer implements ICellRendererAngularComp {
  params: any;
  copied = false;
  private copyTimeout: any;
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  agInit(params: ICellRendererParams): void { this.params = params; }
  refresh(params: ICellRendererParams): boolean { this.params = params; return true; }

  openDrawer(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    if (this.params?.data?.id && this.params?.context?.componentParent) {
      this.params.context.componentParent.openAssetDrawer(this.params.data.id);
    }
  }

  copyName(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    if (this.params?.value) {
      navigator.clipboard.writeText(this.params.value);
      this.toastr.success('Asset Name copied to clipboard');
      this.copied = true;
      this.cdr.detectChanges();
      if (this.copyTimeout) clearTimeout(this.copyTimeout);
      this.copyTimeout = setTimeout(() => {
        this.copied = false;
        this.cdr.detectChanges();
      }, 2000);
    }
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="flex items-center gap-1.5 group/assign w-full h-full">
      <span *ngIf="!params?.data?.assignedUserId" class="text-slate-400 text-xs font-medium">Unassigned</span>
      <button *ngIf="params?.data?.assignedUserId" 
        data-user-hover="true"
        (click)="openDetail($event)"
        (mouseenter)="onHover($event)"
        (mouseleave)="onLeave()"
        class="text-primary hover:underline font-semibold cursor-pointer text-left truncate outline-none"
        title="View User Details">
        {{ params.value }}
      </button>
      <span class="opacity-0 group-hover/assign:opacity-100 text-[10px] text-slate-400 transition-opacity ml-auto">double-click to edit</span>
    </div>
  `
})
export class AssignedUserRenderer implements ICellRendererAngularComp {
  params: any;

  agInit(params: ICellRendererParams): void { this.params = params; }
  refresh(params: ICellRendererParams): boolean { this.params = params; return true; }

  openDetail(event: MouseEvent) {
    event.stopPropagation();
    if (this.params?.data?.assignedUserId && this.params?.context?.componentParent) {
      this.params.context.componentParent.openUserDialog(this.params.data.assignedUserId);
    }
  }

  onHover(event: MouseEvent) {
    if (this.params?.data?.assignedUserId && this.params?.context?.componentParent) {
      this.params.context.componentParent.onUserHover(this.params.data.assignedUserId, event);
    }
  }

  onLeave() {
    if (this.params?.context?.componentParent) {
      this.params.context.componentParent.onUserHoverLeave();
    }
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden p-2 w-64 animate-in fade-in zoom-in duration-200"
         (click)="$event.stopPropagation()">
      <div class="relative mb-2">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <lucide-icon 
            name="search" 
            [size]="14" 
          ></lucide-icon>
        </div>
        <input 
          #searchInput
          type="text" 
          [(ngModel)]="searchTerm" 
          (ngModelChange)="onSearchChange()"
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

  private cdr = inject(ChangeDetectorRef);
  @ViewChild('searchInput', { static: false }) searchInput?: ElementRef;

  agInit(params: any): void {
    this.params = params;
    let vals: string[] = [];
    if (Array.isArray(params.values)) {
      vals = params.values;
    } else if (typeof params.values === 'function') {
      const res = params.values(params);
      vals = Array.isArray(res) ? res : (res?.values || []);
    } else if (typeof params.colDef?.cellEditorParams === 'function') {
      const res = params.colDef.cellEditorParams(params);
      vals = Array.isArray(res) ? res : (res?.values || []);
    } else if (Array.isArray(params.colDef?.cellEditorParams?.values)) {
      vals = params.colDef.cellEditorParams.values;
    }
    this.values = vals;
    this.selectedValue = params.value || '';
    if (!this.selectedValue && this.values.includes('Unassigned')) {
      this.selectedValue = 'Unassigned';
    }
    this.cdr.markForCheck();
    setTimeout(() => {
      if (this.searchInput?.nativeElement) {
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

  onSearchChange() {
    this.cdr.markForCheck();
  }

  selectItem(item: string) {
    this.selectedValue = item;
    this.cdr.markForCheck();
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

import { PageHeaderService } from '../../../core/services/page-header.service';
import { PageHeaderActionsDirective } from '../../../shared/directives/page-header-actions.directive';
import { AssetLabelModalComponent } from '../../../shared/components/asset-label-modal/asset-label-modal.component';

@Component({
  selector: 'app-asset-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, AgGridModule, FormsModule, AssetImportComponent, SkeletonLoaderComponent, ConfirmationModalComponent, SearchableCellEditorComponent, UserDetailDialogComponent, AssetDrawerComponent, UserHoverCardComponent, PageHeaderActionsDirective, AssetLabelModalComponent],
  templateUrl: './asset-list.component.html',
  styleUrls: ['./asset-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetListComponent implements OnInit, OnDestroy {
  private pageHeaderService = inject(PageHeaderService);
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
  gridContext = { componentParent: this };
  private searchSubject = new Subject<string>();

  assets: Asset[] = [];
  selectedCount = 0;
  showImportModal = false;

  // Asset Inspection Drawer State
  selectedAssetIdForDrawer: string | null = null;
  showAssetDrawer = false;

  // Assignee Hover Card State
  hoverUser: User | null = null;
  showHoverCard = false;
  hoverCardPosition = { x: 0, y: 0, triggerTop: 0, triggerBottom: 0 };
  private hoverEnterTimeout: any;
  private hoverTimeout: any;

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

  openAssetDrawer(id: string): void {
    this.ngZone.run(() => {
      this.selectedAssetIdForDrawer = id;
      this.showAssetDrawer = true;
      this.cdr.markForCheck();
    });
  }

  closeAssetDrawer(): void {
    this.showAssetDrawer = false;
    this.selectedAssetIdForDrawer = null;
    this.cdr.markForCheck();
  }

  // Asset Label Modal State & Methods
  showPrintLabelModal = false;
  assetForLabel: any = null;

  openPrintLabel(asset: any): void {
    this.ngZone.run(() => {
      this.assetForLabel = asset;
      this.showPrintLabelModal = true;
      this.cdr.markForCheck();
    });
  }

  closePrintLabelModal(): void {
    this.showPrintLabelModal = false;
    this.assetForLabel = null;
    this.cdr.markForCheck();
  }

  onDrawerAssetUpdated(): void {
    this.loadAssets(this.currentFilters);
  }

  onCardHoverChange(isHovered: boolean): void {
    if (isHovered) {
      if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    } else {
      if (this.hoverEnterTimeout) clearTimeout(this.hoverEnterTimeout);
      if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
      this.hoverTimeout = setTimeout(() => {
        this.ngZone.run(() => {
          this.showHoverCard = false;
          this.hoverUser = null;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      }, 50);
    }
  }

  openUserDialog(userIdentifier?: string): void {
    if (!userIdentifier) return;
    if (this.hoverEnterTimeout) clearTimeout(this.hoverEnterTimeout);
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    this.showHoverCard = false;
    this.hoverUser = null;
    const user = this.users.find(u => u.id === userIdentifier || u.name.toLowerCase() === userIdentifier.toLowerCase());
    this.selectedUserIdForDialog = user ? user.id : userIdentifier;
    this.showUserDetailDialog = true;
    this.cdr.detectChanges();
  }

  onUserHover(userIdentifier: string, event: MouseEvent): void {
    if (!userIdentifier) return;
    if (this.hoverEnterTimeout) clearTimeout(this.hoverEnterTimeout);

    const target = (event.target as HTMLElement).closest('[data-user-hover]') as HTMLElement || (event.target as HTMLElement);
    const rect = target.getBoundingClientRect();

    this.hoverEnterTimeout = setTimeout(() => {
      const user = this.users.find(u => u.id === userIdentifier || u.name.toLowerCase() === userIdentifier.toLowerCase());
      if (user) {
        if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
        this.ngZone.run(() => {
          this.hoverUser = user;
          this.hoverCardPosition = {
            x: Math.min(rect.left, window.innerWidth - 300),
            y: rect.bottom,
            triggerTop: rect.top,
            triggerBottom: rect.bottom
          };
          this.showHoverCard = true;
          this.cdr.detectChanges();
        });
      }
    }, 90);
  }

  onUserHoverLeave(): void {
    if (this.hoverEnterTimeout) {
      clearTimeout(this.hoverEnterTimeout);
      this.hoverEnterTimeout = null;
    }
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(() => {
      this.ngZone.run(() => {
        this.showHoverCard = false;
        this.hoverUser = null;
        this.cdr.detectChanges();
      });
    }, 60);
  }
  selectedStatusId: string | null = null;
  currentSearchTerm = '';   // tracks the live search keyword
  mobileSearchOpen = false;
  totalAssetsCount = 0;
  searchLoading = false;

  toggleMobileSearch(): void {
    this.mobileSearchOpen = !this.mobileSearchOpen;
    this.cdr.markForCheck();
  }

  getStatusDotColor(statusName?: string): string {
    const name = (statusName || '').toLowerCase();
    if (name.includes('stock') || name.includes('ready') || name.includes('available')) return 'bg-emerald-400';
    if (name.includes('assigned') || name.includes('deploy')) return 'bg-blue-400';
    if (name.includes('maint') || name.includes('repair')) return 'bg-amber-400';
    if (name.includes('damag') || name.includes('lost')) return 'bg-rose-400';
    if (name.includes('retir') || name.includes('dispos')) return 'bg-slate-400';
    return 'bg-indigo-400';
  }

  // Inline edit state
  editingCellId: string | null = null;

  gridIcons = {
    filter: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6366f1; opacity: 0.8;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    sortAscending: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6366f1;"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>',
    sortDescending: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6366f1;"><path d="m19 12-7 7-7-7"/><path d="M12 5v14"/></svg>'
  };

  private notifySuccess(msg: string, title?: string, opts?: any) {
    setTimeout(() => this.toastr.success(msg, title, opts), 0);
  }

  private notifyError(msg: string, title?: string, opts?: any) {
    setTimeout(() => this.toastr.error(msg, title, opts), 0);
  }

  private notifyWarning(msg: string, title?: string, opts?: any) {
    setTimeout(() => this.toastr.warning(msg, title, opts), 0);
  }

  private notifyInfo(msg: string, title?: string, opts?: any) {
    setTimeout(() => this.toastr.info(msg, title, opts), 0);
  }

  loadAssets(params: any = {}) {
    if (this.assetsSub) {
      this.assetsSub.unsubscribe();
    }
    this.loading = true;
    if (params.search) {
      this.searchLoading = true;
    }
    this.currentFilters = params;
    this.cdr.markForCheck();

    this.assetsSub = this.assetService.getAssets(params).subscribe({
      next: (res: any) => {
        this.assets = res.data;
        if (!params.statusId && !params.search) {
          this.totalAssetsCount = res.total || res.data.length;
        } else if (this.totalAssetsCount === 0 && res.data) {
          this.totalAssetsCount = res.total || res.data.length;
        }
        this.loading = false;
        this.searchLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.notifyError('Failed to load assets');
        this.loading = false;
        this.searchLoading = false;
        this.cdr.markForCheck();
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
    this.gridApi.setGridOption('overlayNoRowsTemplate', '<div class="py-12 text-center"><p class="text-slate-500 font-semibold text-sm">No assets match your search criteria</p><p class="text-slate-400 text-xs mt-1">Try searching by name, serial, category, location, or assignee</p></div>');

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
    const term = (event?.target?.value || '') as string;
    this.currentSearchTerm = term;
    if (term.trim()) {
      this.searchLoading = true;
    } else {
      this.searchLoading = false;
    }
    this.cdr.markForCheck();
    this.searchSubject.next(term);
  }

  onSearchEnter() {
    this.searchLoading = true;
    this.cdr.markForCheck();
    const params: any = { ...this.currentFilters, search: this.currentSearchTerm.trim() };
    const loadParams: any = {};
    Object.keys(params).forEach(key => { if (params[key]) loadParams[key] = params[key]; });
    this.loadAssets(loadParams);
    this.saveTableState();
  }

  clearSearch() {
    this.currentSearchTerm = '';
    this.searchLoading = false;
    this.searchSubject.next('');
    const loadParams = { ...this.currentFilters };
    delete loadParams.search;
    this.loadAssets(loadParams);
    this.saveTableState();
    this.cdr.markForCheck();
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

  // ── Delete with Undo ───────────────────────────────────────────────

  /** Desktop Actions column: show confirmation modal */
  confirmDeleteSingle(asset: Asset) {
    this.assetToDelete = asset;
    this.deleteType = 'single';
    this.showConfirmDelete = true;
    this.cdr.detectChanges();
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
    this.cdr.detectChanges();
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
              <button class="copy-btn opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-all ml-2 flex items-center justify-center cursor-pointer" title="Copy">
                <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                <svg class="check-icon hidden text-emerald-600" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          `;
        },
        onCellClicked: (event: any) => {
          const btn = event.event?.target?.closest('.copy-btn') as HTMLElement;
          if (btn) {
            navigator.clipboard.writeText(event.value);
            this.toastr.success('Copied to clipboard');
            const copyIcon = btn.querySelector('.copy-icon');
            const checkIcon = btn.querySelector('.check-icon');
            if (copyIcon && checkIcon) {
              copyIcon.classList.add('hidden');
              checkIcon.classList.remove('hidden');
              btn.classList.add('bg-emerald-50', 'text-emerald-600');
              setTimeout(() => {
                copyIcon.classList.remove('hidden');
                checkIcon.classList.add('hidden');
                btn.classList.remove('bg-emerald-50', 'text-emerald-600');
              }, 2000);
            }
          }
        }
      },
      { field: 'category.name', headerName: 'Category', flex: 1, cellClass: 'text-slate-500 font-medium' },
      {
        field: 'status.name',
        headerName: 'Status',
        flex: 1.25,
        headerClass: 'ag-header-center',
        cellClass: 'flex items-center justify-center text-center',
        editable: (params: any) => !params.data?.assignedUserId,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: this.statuses.map(s => s.name) },
        cellRenderer: (params: any) => {
          const name = params.value || 'Unknown';
          const lower = name.toLowerCase();
          let badgeCls = 'bg-purple-50 text-purple-700 border-purple-200/80';
          let dotCls = 'bg-purple-500';

          if (lower.includes('stock') || lower.includes('available')) {
            badgeCls = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
            dotCls = 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse';
          } else if (lower.includes('use') || lower.includes('assigned')) {
            badgeCls = 'bg-blue-50 text-blue-700 border-blue-200/80';
            dotCls = 'bg-blue-500';
          } else if (lower.includes('service') || lower.includes('maintenance') || lower.includes('repair')) {
            badgeCls = 'bg-amber-50 text-amber-800 border-amber-200/80';
            dotCls = 'bg-amber-500';
          } else if (lower.includes('damaged') || lower.includes('broken')) {
            badgeCls = 'bg-rose-50 text-rose-700 border-rose-200/80';
            dotCls = 'bg-rose-500';
          } else if (lower.includes('removed') || lower.includes('retired') || lower.includes('disposed')) {
            badgeCls = 'bg-slate-100 text-slate-600 border-slate-200 line-through';
            dotCls = 'bg-slate-400';
          }

          return `<div class="flex items-center justify-center w-full">
            <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeCls} border tracking-wide shadow-2xs">
              <span class="inline-block w-1.5 h-1.5 rounded-full ${dotCls} mr-1.5"></span>
              <span>${name}</span>
            </span>
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
        cellEditorParams: () => ({ values: this.locations.map(l => l.name) }),
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
        cellEditorParams: () => ({ values: ['Unassigned', ...this.users.map(u => u.name)] }),
        cellRenderer: AssignedUserRenderer,
        valueSetter: (params: any) => {
          if (!params.data.assignedUser) {
            params.data.assignedUser = {};
          }
          params.data.assignedUser.name = params.newValue;
          return true;
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
        width: 165,
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        pinned: 'right' as const,
        cellRenderer: (params: any) => {
          return `
            <div class="flex items-center gap-1 h-full">
              <button class="action-print-btn p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-all cursor-pointer"
                      title="Print Asset Label">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
              </button>
              <button class="action-edit-btn p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-primary rounded-lg transition-all cursor-pointer"
                      title="Edit">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
              <button class="action-clone-btn p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 rounded-lg transition-all cursor-pointer" title="Duplicate">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button class="action-delete-btn p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          `;
        },
        onCellClicked: (params: any) => {
          const target = params.event?.target as HTMLElement;
          if (target?.closest('.action-print-btn')) this.openPrintLabel(params.data);
          else if (target?.closest('.action-edit-btn')) this.router.navigate(['/assets', params.data.id, 'edit']);
          else if (target?.closest('.action-delete-btn')) this.confirmDeleteSingle(params.data);
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
    this.pageHeaderService.setHeader({ title: 'IT Assets', subtitle: 'Manage and track physical equipment' });
    // Load master data first (statuses, locations, users) in ONE parallel call
    this.loadMasterData();

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

    const searchSub = this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(searchTerm => {
      this.currentSearchTerm = searchTerm;
      const params: any = { ...this.currentFilters, search: searchTerm.trim() };
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
