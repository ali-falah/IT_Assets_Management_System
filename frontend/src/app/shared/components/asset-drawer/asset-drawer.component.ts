import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, Input, NgZone, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { Asset, AssetService } from '../../../core/services/asset.service';
import { Location, MasterDataService, Status } from '../../../core/services/master-data.service';
import { User, UserService } from '../../../core/services/user.service';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal.component';
import { AssetLabelModalComponent } from '../asset-label-modal/asset-label-modal.component';

@Component({
  selector: 'app-asset-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule, ConfirmationModalComponent, AssetLabelModalComponent],
  templateUrl: './asset-drawer.component.html',
  styleUrls: ['./asset-drawer.component.css']
})
export class AssetDrawerComponent implements OnInit, OnChanges {
  @Input() assetId: string | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();
  @Output() openUserDetail = new EventEmitter<string>();

  private assetService = inject(AssetService);
  private masterDataService = inject(MasterDataService);
  private userService = inject(UserService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  asset: any | null = null;
  loading = false;
  actionLoading = false;
  users: User[] = [];
  statuses: Status[] = [];
  locations: Location[] = [];

  // Inline Assignment Form State (No overlapping popup!)
  isAssigning = false;
  selectedNewUserId: string = '';
  userFilterQuery: string = '';

  // Return to Stock Confirmation
  showReturnConfirmModal = false;

  // Assignment / Transfer Confirmation
  showAssignConfirmModal = false;
  assignConfirmTitle = 'Confirm Assignment';
  assignConfirmMessage = '';
  confirmButtonText = 'Confirm Assignment';

  // Double laptop check
  showLaptopWarningModal = false;
  laptopWarningMessage = '';
  pendingAssignUserId = '';

  ngOnInit(): void {
    this.loadMasterData();
    if (this.assetId && this.isOpen) {
      this.loadAsset();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['assetId'] || changes['isOpen']) && this.isOpen && this.assetId) {
      this.isAssigning = false;
      this.selectedNewUserId = '';
      this.userFilterQuery = '';
      this.loadAsset();
    }
  }

  loadMasterData(): void {
    this.userService.getUsers().subscribe((u: User[]) => {
      this.ngZone.run(() => { this.users = u; this.cdr.markForCheck(); this.cdr.detectChanges(); });
    });
    this.masterDataService.getStatuses().subscribe((s: Status[]) => {
      this.ngZone.run(() => { this.statuses = s; this.cdr.markForCheck(); this.cdr.detectChanges(); });
    });
    this.masterDataService.getLocations().subscribe((l: Location[]) => {
      this.ngZone.run(() => { this.locations = l; this.cdr.markForCheck(); this.cdr.detectChanges(); });
    });
  }

  loadAsset(): void {
    if (!this.assetId) return;
    this.ngZone.run(() => {
      this.loading = true;
      this.asset = null;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });

    this.assetService.getAsset(this.assetId).subscribe({
      next: (data: any) => {
        this.ngZone.run(() => {
          this.asset = data;
          this.loading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          console.error('Failed to load asset in drawer:', err);
          this.toastr.error('Failed to load asset details');
          this.loading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      }
    });
  }

  copiedSerial = false;
  private copySerialTimeout: any;

  copySerial(): void {
    if (this.asset?.serialNumber) {
      navigator.clipboard.writeText(this.asset.serialNumber);
      this.toastr.success('Serial Number copied to clipboard');
      this.copiedSerial = true;
      this.cdr.detectChanges();
      if (this.copySerialTimeout) clearTimeout(this.copySerialTimeout);
      this.copySerialTimeout = setTimeout(() => {
        this.copiedSerial = false;
        this.cdr.detectChanges();
      }, 2000);
    }
  }

  // Status Helpers
  isAvailableStock(): boolean {
    if (this.asset?.assignedUserId) return false;
    const slug = (this.asset?.status?.slug || '').toLowerCase();
    const name = (this.asset?.status?.name || '').toLowerCase();
    return slug === 'available' || name.includes('stock') || name.includes('available');
  }

  isOutOfService(): boolean {
    const slug = (this.asset?.status?.slug || '').toLowerCase();
    const name = (this.asset?.status?.name || '').toLowerCase();
    return slug === 'maintenance' || name.includes('service') || name.includes('maintenance') || name.includes('repair');
  }

  isDamaged(): boolean {
    const slug = (this.asset?.status?.slug || '').toLowerCase();
    const name = (this.asset?.status?.name || '').toLowerCase();
    return slug === 'damaged' || name.includes('damaged') || name.includes('broken');
  }

  isRemoved(): boolean {
    const slug = (this.asset?.status?.slug || '').toLowerCase();
    const name = (this.asset?.status?.name || '').toLowerCase();
    return slug === 'removed' || name.includes('removed') || name.includes('retired') || name.includes('disposed');
  }

  getStatusBadgeClass(statusName?: string): string {
    const name = (statusName || this.asset?.status?.name || '').toLowerCase();
    if (name.includes('stock') || name.includes('available')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (name.includes('use') || name.includes('assigned')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (name.includes('service') || name.includes('maintenance') || name.includes('repair')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (name.includes('damaged') || name.includes('broken')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (name.includes('removed') || name.includes('retired') || name.includes('disposed')) {
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    return 'bg-purple-50 text-purple-700 border-purple-200';
  }

  getStatusDotClass(statusName?: string): string {
    const name = (statusName || this.asset?.status?.name || '').toLowerCase();
    if (name.includes('stock') || name.includes('available')) {
      return 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse';
    }
    if (name.includes('use') || name.includes('assigned')) {
      return 'bg-blue-500';
    }
    if (name.includes('service') || name.includes('maintenance')) {
      return 'bg-amber-500';
    }
    if (name.includes('damaged')) {
      return 'bg-rose-500';
    }
    if (name.includes('removed') || name.includes('retired')) {
      return 'bg-slate-400';
    }
    return 'bg-purple-500';
  }

  // Quick Status Change from Drawer
  onStatusChange(newStatusId: string): void {
    if (!this.asset?.id || !newStatusId || newStatusId === this.asset.statusId) return;
    this.actionLoading = true;
    this.cdr.markForCheck();

    this.assetService.updateAsset(this.asset.id, { statusId: newStatusId }).subscribe({
      next: () => {
        const found = this.statuses.find(s => s.id === newStatusId);
        this.toastr.success(`Status changed to ${found?.name || 'Updated'}`);
        this.actionLoading = false;
        this.loadAsset();
        this.updated.emit();
        this.cdr.markForCheck();
      },
      error: () => {
        this.toastr.error('Failed to change status');
        this.actionLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // 1-Click Move to Stock (Available)
  moveToStock(): void {
    if (!this.asset?.id) return;
    const availableStatus = this.statuses.find(s => s.slug === 'available' || s.name.toLowerCase().includes('stock')) || this.statuses[0];
    if (!availableStatus) return;

    this.actionLoading = true;
    this.cdr.markForCheck();

    this.assetService.updateAsset(this.asset.id, {
      statusId: availableStatus.id,
      assignedUserId: null
    }).subscribe({
      next: () => {
        this.toastr.success(`Asset "${this.asset.name}" is now Available in Stock`);
        this.actionLoading = false;
        this.loadAsset();
        this.updated.emit();
        this.cdr.markForCheck();
      },
      error: () => {
        this.toastr.error('Failed to move asset to stock');
        this.actionLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Quick Action: Return to Stock
  confirmReturnToStock(): void {
    if (!this.asset?.id) return;
    this.actionLoading = true;
    this.cdr.markForCheck();

    const availableStatus = this.statuses.find(s => s.slug === 'available' || s.name.toLowerCase().includes('stock')) || this.statuses[0];

    this.assetService.updateAsset(this.asset.id, {
      assignedUserId: null,
      statusId: availableStatus?.id
    }).subscribe({
      next: () => {
        this.toastr.success(`Asset "${this.asset.name}" returned to stock`);
        this.actionLoading = false;
        this.showReturnConfirmModal = false;
        this.loadAsset();
        this.updated.emit();
        this.cdr.markForCheck();
      },
      error: () => {
        this.toastr.error('Failed to return asset to stock');
        this.actionLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Inline Quick Assign Handlers
  openInlineAssign(): void {
    this.selectedNewUserId = '';
    this.userFilterQuery = '';
    this.isAssigning = true;
    this.cdr.markForCheck();
  }

  cancelInlineAssign(): void {
    this.isAssigning = false;
    this.selectedNewUserId = '';
    this.userFilterQuery = '';
    this.cdr.markForCheck();
  }

  get filteredUsers(): User[] {
    if (!this.userFilterQuery) return this.users;
    const q = this.userFilterQuery.toLowerCase();
    return this.users.filter(u => u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)));
  }

  submitInlineAssignment(): void {
    if (!this.asset?.id || !this.selectedNewUserId) return;
    const catName = (this.asset.category?.name || '').toLowerCase();
    const isLaptop = catName === 'laptop' || catName === 'laptops' || catName.includes('laptop');
    const selectedUser = this.users.find(u => u.id === this.selectedNewUserId);

    // Double laptop check
    if (isLaptop && this.selectedNewUserId) {
      this.actionLoading = true;
      this.cdr.markForCheck();
      this.assetService.getAssets({ assignedUserId: this.selectedNewUserId }).subscribe({
        next: (res: any) => {
          this.actionLoading = false;
          const existingLaptop = res.data.find((a: any) =>
            a.id !== this.asset.id &&
            (a.category?.name?.toLowerCase() === 'laptop' ||
              a.category?.name?.toLowerCase() === 'laptops' ||
              a.category?.name?.toLowerCase().includes('laptop'))
          );
          if (existingLaptop) {
            this.pendingAssignUserId = this.selectedNewUserId;
            this.laptopWarningMessage = `${selectedUser?.name || 'This employee'} already has a laptop assigned (Serial: ${existingLaptop.serialNumber || 'N/A'}). Do you want to proceed?`;
            this.showLaptopWarningModal = true;
            this.cdr.markForCheck();
          } else {
            this.promptAssignConfirm(selectedUser);
          }
        },
        error: () => {
          this.actionLoading = false;
          this.promptAssignConfirm(selectedUser);
        }
      });
      return;
    }

    this.promptAssignConfirm(selectedUser);
  }

  private promptAssignConfirm(selectedUser?: User): void {
    const isTransfer = !!this.asset?.assignedUserId;
    if (isTransfer) {
      this.assignConfirmTitle = 'Confirm Asset Transfer';
      this.assignConfirmMessage = `Are you sure you want to transfer <strong>${this.asset.name}</strong> from <strong>${this.asset.assignedUser?.name || 'Current User'}</strong> to <strong>${selectedUser?.name || 'selected employee'}</strong>?`;
      this.confirmButtonText = 'Transfer Asset';
    } else {
      this.assignConfirmTitle = 'Confirm Asset Assignment';
      this.assignConfirmMessage = `Are you sure you want to assign <strong>${this.asset.name}</strong> to <strong>${selectedUser?.name || 'selected employee'}</strong>?`;
      this.confirmButtonText = 'Assign Asset';
    }
    this.showAssignConfirmModal = true;
    this.cdr.markForCheck();
  }

  confirmAssignmentAction(): void {
    this.showAssignConfirmModal = false;
    if (this.selectedNewUserId) {
      this.executeAssignUser(this.selectedNewUserId);
    }
  }

  confirmLaptopOverride(): void {
    this.showLaptopWarningModal = false;
    if (this.pendingAssignUserId) {
      const selectedUser = this.users.find(u => u.id === this.pendingAssignUserId);
      this.promptAssignConfirm(selectedUser);
      this.pendingAssignUserId = '';
    }
  }

  private executeAssignUser(userId: string): void {
    this.actionLoading = true;
    this.cdr.markForCheck();

    const assignedStatus = this.statuses.find(s => s.slug === 'assigned' || s.name.toLowerCase().includes('use')) || this.statuses[0];
    const targetUser = this.users.find(u => u.id === userId);

    this.assetService.updateAsset(this.asset.id, {
      assignedUserId: userId,
      statusId: assignedStatus?.id
    }).subscribe({
      next: () => {
        this.toastr.success(`Asset assigned to ${targetUser?.name || 'User'}`);
        this.actionLoading = false;
        this.isAssigning = false;
        this.selectedNewUserId = '';
        this.loadAsset();
        this.updated.emit();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.toastr.error(err?.error?.message || 'Failed to assign asset');
        this.actionLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  showPrintModal = false;

  printLabel(): void {
    if (!this.asset) return;
    this.showPrintModal = true;
    this.cdr.markForCheck();
  }

  closePrintModal(): void {
    this.showPrintModal = false;
    this.cdr.markForCheck();
  }

  navigateToEdit(): void {
    if (this.asset?.id) {
      this.close.emit();
      this.router.navigate(['/assets', this.asset.id, 'edit']);
    }
  }

  onUserClick(userId: string): void {
    this.openUserDetail.emit(userId);
  }
}
