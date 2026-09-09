import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, from, of, catchError, map } from 'rxjs';
import { ActivityLogService, ActivityStats } from '../../../core/services/activity-log.service';
import { AssignmentService } from '../../../core/services/assignment.service';
import { Asset, AssetService } from '../../../core/services/asset.service';
import { AssetOfflineService } from '../../../core/services/asset-offline.service';
import { ExcelExportService } from '../../../shared/services/excel-export.service';
import { UserDetailDialogComponent } from '../../users/user-detail-dialog/user-detail-dialog.component';
import { AssetDrawerComponent } from '../../../shared/components/asset-drawer/asset-drawer.component';
import { UserHoverCardComponent } from '../../../shared/components/user-hover-card/user-hover-card.component';
import { User, UserService } from '../../../core/services/user.service';
import { PageHeaderService } from '../../../core/services/page-header.service';
import { PageHeaderActionsDirective } from '../../../shared/directives/page-header-actions.directive';

export interface ActivityChangeDiff {
  field: string;
  from?: string;
  to?: string;
  isUser?: boolean;
  userId?: string;
}

export interface UnifiedActivity {
  id: string;
  action: string;
  message: string;
  entityId?: string;
  entityName?: string;
  secondaryId?: string;
  secondaryName?: string;
  assetSerialNumber?: string;
  ownerName?: string;
  actorId?: string;
  actorName?: string;
  date: Date;
  isAssignment?: boolean;
  isUserEvent?: boolean;
  changes?: Record<string, { from?: string; to?: string }>;
  diffList?: ActivityChangeDiff[];
  meta?: Record<string, any>;
}

export interface TimelineGroup {
  title: string;
  badgeClass: string;
  items: UnifiedActivity[];
}

@Component({
  selector: 'app-activity-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule, UserDetailDialogComponent, AssetDrawerComponent, UserHoverCardComponent, PageHeaderActionsDirective],
  templateUrl: './activity-list.component.html',
  styleUrls: ['./activity-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityListComponent implements OnInit {
  private pageHeaderService = inject(PageHeaderService);
  private activityLogService = inject(ActivityLogService);
  private assignmentService = inject(AssignmentService);
  private assetService = inject(AssetService);
  private assetOffline = inject(AssetOfflineService);
  private excelExportService = inject(ExcelExportService);
  private userService = inject(UserService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private router = inject(Router);

  activities: UnifiedActivity[] = [];
  users: User[] = [];
  loading = true;
  exporting = false;
  protected readonly Math = Math;
  
  // Asset Inspection Drawer State
  selectedAssetIdForDrawer: string | null = null;
  showAssetDrawer = false;

  // Assignee Hover Card State
  hoverUser: User | null = null;
  showHoverCard = false;
  hoverCardPosition = { x: 0, y: 0, triggerTop: 0, triggerBottom: 0 };
  private hoverEnterTimeout: any;
  private hoverTimeout: any;

  // Copy Serial UX State
  copiedSerialMap: { [serial: string]: boolean } = {};
  private copyTimeouts: { [serial: string]: any } = {};

  copySerial(serial?: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!serial) return;
    navigator.clipboard.writeText(serial);
    this.toastr.success('Serial Number copied to clipboard');
    this.copiedSerialMap[serial] = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    if (this.copyTimeouts[serial]) clearTimeout(this.copyTimeouts[serial]);
    this.copyTimeouts[serial] = setTimeout(() => {
      this.ngZone.run(() => {
        this.copiedSerialMap[serial] = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    }, 2000);
  }

  private dismissHoverCard() {
    if (this.hoverEnterTimeout) {
      clearTimeout(this.hoverEnterTimeout);
      this.hoverEnterTimeout = null;
    }
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    this.showHoverCard = false;
    this.hoverUser = null;
  }

  openAssetDrawer(id?: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!id) return;
    this.dismissHoverCard();
    this.ngZone.run(() => {
      this.selectedAssetIdForDrawer = id;
      this.showAssetDrawer = true;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
  }

  closeAssetDrawer() {
    this.ngZone.run(() => {
      this.showAssetDrawer = false;
      this.selectedAssetIdForDrawer = null;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
  }

  onDrawerUpdated() {
    this.loadActivities();
  }

  onUserHover(userIdentifier: string | undefined, event: MouseEvent) {
    if (!userIdentifier || userIdentifier === 'Stock' || userIdentifier === 'None' || userIdentifier === '-') return;
    if (this.hoverEnterTimeout) clearTimeout(this.hoverEnterTimeout);

    const targetEl = (event.target as HTMLElement).closest('[data-user-hover]') as HTMLElement || (event.target as HTMLElement);
    const rect = targetEl.getBoundingClientRect();

    // Responsive 90ms hover delay to prevent accidental popups when traversing
    this.hoverEnterTimeout = setTimeout(() => {
      this.ngZone.run(() => {
        const clean = userIdentifier.trim().toLowerCase();
        const user = this.users.find(u => 
          u.id === userIdentifier || 
          u.name.toLowerCase().trim() === clean || 
          (u.email && u.email.toLowerCase().trim() === clean)
        );
        if (user) {
          if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
          this.hoverUser = user;
          this.hoverCardPosition = {
            x: Math.min(rect.left, window.innerWidth - 300),
            y: rect.bottom,
            triggerTop: rect.top,
            triggerBottom: rect.bottom
          };
          this.showHoverCard = true;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        }
      });
    }, 90);
  }

  onUserHoverLeave() {
    if (this.hoverEnterTimeout) {
      clearTimeout(this.hoverEnterTimeout);
      this.hoverEnterTimeout = null;
    }
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(() => {
      this.ngZone.run(() => {
        this.showHoverCard = false;
        this.hoverUser = null;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    }, 60);
  }

  onCardHoverChange(isHovered: boolean) {
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

  // Search & Filter state
  searchTerm = '';
  selectedCategory: 'all' | 'assets' | 'assignments' | 'users' | 'updates' | 'deletions' = 'all';
  selectedDateRange: 'all' | 'today' | 'week' | 'month' | 'custom' = 'all';
  customStartDate = '';
  customEndDate = '';
  viewMode: 'timeline' | 'table' = 'timeline';

  // Mobile UX state (Option A)
  mobileSearchOpen = false;

  toggleMobileSearch() {
    this.mobileSearchOpen = !this.mobileSearchOpen;
    this.cdr.markForCheck();
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'timeline' ? 'table' : 'timeline';
    this.cdr.markForCheck();
  }

  setQuickMobileFilter(filter: 'all' | 'today' | 'assets' | 'assignments' | 'updates' | 'users' | 'deletions') {
    if (filter === 'today') {
      this.selectedDateRange = 'today';
      this.selectedCategory = 'all';
    } else if (filter === 'all') {
      this.selectedDateRange = 'all';
      this.selectedCategory = 'all';
    } else {
      this.selectedDateRange = 'all';
      this.selectedCategory = filter;
    }
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  onMobileCardClick(activity: UnifiedActivity, event: Event) {
    if (activity.entityId && !activity.isUserEvent && activity.action !== 'asset_deleted') {
      this.openAssetDrawer(activity.entityId, event);
    } else if (activity.isUserEvent && activity.action !== 'user_deleted') {
      this.openUserDialog(activity.entityId || activity.entityName, event);
    }
  }

  // Pagination
  currentPage = 1;
  pageSize = 25;
  pageSizeOptions = [10, 25, 50, 100];

  // User detail dialog
  showUserDetailDialog = false;
  selectedUserIdForDialog: string | null = null;

  // Overview metrics
  stats: ActivityStats = {
    totalCount: 0,
    assetEventsCount: 0,
    assignmentEventsCount: 0,
    userEventsCount: 0,
    last24hCount: 0,
  };

  private notifySuccess(msg: string) {
    setTimeout(() => this.toastr.success(msg), 0);
  }

  private notifyError(msg: string) {
    setTimeout(() => this.toastr.error(msg), 0);
  }

  ngOnInit() {
    this.pageHeaderService.setHeader({
      title: 'Activity & Audit History',
      subtitle: 'Comprehensive audit trail of asset lifecycle, assignments, and user operations'
    });
    this.userService.getUsers().subscribe(u => { this.users = u; this.cdr.detectChanges(); });
    this.loadActivities();
  }

  isUserDiff(field: string, val: string | undefined): boolean {
    if (!val || val === 'Stock' || val === 'None' || val === 'Previous' || val === '-' || val === 'Empty') {
      return false;
    }
    const f = (field || '').toLowerCase();
    if (f.includes('user') || f.includes('assign') || f.includes('owner') || f.includes('custodian') || f.includes('holder')) {
      return true;
    }
    const clean = val.trim().toLowerCase();
    return (this.users || []).some(u => u.name?.toLowerCase().trim() === clean || u.id === val);
  }

  openUserDialog(userIdentifier?: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!userIdentifier || userIdentifier === 'Stock' || userIdentifier === 'None' || userIdentifier === '-' || userIdentifier === 'Previous') return;
    this.dismissHoverCard();

    const clean = userIdentifier.trim();
    let user = this.users?.find(u => 
      u.id === clean || 
      u.name?.toLowerCase().trim() === clean.toLowerCase() ||
      (u.email && u.email.toLowerCase().trim() === clean.toLowerCase())
    );

    if (!user) {
      const act = this.activities?.find(a => 
        (a.secondaryName && a.secondaryName.toLowerCase().trim() === clean.toLowerCase() && a.secondaryId) ||
        (a.ownerName && a.ownerName.toLowerCase().trim() === clean.toLowerCase() && a.secondaryId)
      );
      if (act?.secondaryId) {
        user = this.users?.find(u => u.id === act.secondaryId) || ({ id: act.secondaryId, name: clean } as any);
      }
    }

    if (user) {
      this.ngZone.run(() => {
        this.selectedUserIdForDialog = user.id;
        this.showUserDetailDialog = true;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
      return;
    }

    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        const found = users.find(u => 
          u.id === clean || 
          u.name?.toLowerCase().trim() === clean.toLowerCase() ||
          (u.email && u.email.toLowerCase().trim() === clean.toLowerCase()) ||
          (u.name && clean.toLowerCase().includes(u.name.toLowerCase().trim())) ||
          (u.name && u.name.toLowerCase().trim().includes(clean.toLowerCase()))
        );
        this.ngZone.run(() => {
          this.selectedUserIdForDialog = found ? found.id : clean;
          this.showUserDetailDialog = true;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.selectedUserIdForDialog = clean;
          this.showUserDetailDialog = true;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      }
    });
  }

  closeUserDialog() {
    this.ngZone.run(() => {
      this.showUserDetailDialog = false;
      this.selectedUserIdForDialog = null;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
  }

  viewAsset(assetId?: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!assetId) return;
    this.dismissHoverCard();
    this.ngZone.run(() => {
      this.router.navigate(['/assets', assetId, 'edit']);
      this.cdr.markForCheck();
    });
  }

  setCategory(category: 'all' | 'assets' | 'assignments' | 'users' | 'updates' | 'deletions') {
    this.selectedCategory = category;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  setDateRange(range: 'all' | 'today' | 'week' | 'month' | 'custom') {
    this.selectedDateRange = range;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  setViewMode(mode: 'timeline' | 'table') {
    this.viewMode = mode;
    this.cdr.markForCheck();
  }

  setPageSize(size: number) {
    this.pageSize = size;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.cdr.markForCheck();
    }
  }

  get filteredActivities(): UnifiedActivity[] {
    let list = this.activities;

    // 1. Category Filter
    if (this.selectedCategory !== 'all') {
      if (this.selectedCategory === 'assets') {
        list = list.filter(a => a.action.startsWith('asset_') && a.action !== 'asset_assigned' && a.action !== 'asset_returned');
      } else if (this.selectedCategory === 'assignments') {
        list = list.filter(a => a.action === 'asset_assigned' || a.action === 'asset_returned');
      } else if (this.selectedCategory === 'users') {
        list = list.filter(a => a.action.startsWith('user_'));
      } else if (this.selectedCategory === 'updates') {
        list = list.filter(a => a.action === 'asset_updated' || a.action === 'user_updated' || a.action === 'asset_bulk_updated');
      } else if (this.selectedCategory === 'deletions') {
        list = list.filter(a => a.action.endsWith('_deleted'));
      }
    }

    // 2. Date Range Filter
    if (this.selectedDateRange !== 'all') {
      const now = new Date();
      if (this.selectedDateRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        list = list.filter(a => a.date >= startOfDay);
      } else if (this.selectedDateRange === 'week') {
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        list = list.filter(a => a.date >= startOfWeek);
      } else if (this.selectedDateRange === 'month') {
        const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        list = list.filter(a => a.date >= startOfMonth);
      } else if (this.selectedDateRange === 'custom') {
        if (this.customStartDate) {
          const start = new Date(this.customStartDate);
          list = list.filter(a => a.date >= start);
        }
        if (this.customEndDate) {
          const end = new Date(this.customEndDate);
          end.setHours(23, 59, 59, 999);
          list = list.filter(a => a.date <= end);
        }
      }
    }

    // 3. Search Term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(a =>
        a.message.toLowerCase().includes(term) ||
        (a.entityName || '').toLowerCase().includes(term) ||
        (a.secondaryName || '').toLowerCase().includes(term) ||
        (a.assetSerialNumber || '').toLowerCase().includes(term) ||
        (a.ownerName || '').toLowerCase().includes(term) ||
        (a.actorName || '').toLowerCase().includes(term) ||
        this.actionLabel(a.action).toLowerCase().includes(term) ||
        (a.changes && Object.entries(a.changes).some(([k, v]) => 
          k.toLowerCase().includes(term) || 
          (v.from || '').toLowerCase().includes(term) || 
          (v.to || '').toLowerCase().includes(term)
        ))
      );
    }

    return list;
  }

  get paginatedActivities(): UnifiedActivity[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredActivities.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredActivities.length / this.pageSize));
  }

  get timelineGroups(): TimelineGroup[] {
    const list = this.paginatedActivities;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const thisWeek = today - 6 * 24 * 60 * 60 * 1000;

    const todayItems: UnifiedActivity[] = [];
    const yesterdayItems: UnifiedActivity[] = [];
    const weekItems: UnifiedActivity[] = [];
    const olderItems: UnifiedActivity[] = [];

    list.forEach(item => {
      const itemTime = item.date.getTime();
      if (itemTime >= today) {
        todayItems.push(item);
      } else if (itemTime >= yesterday) {
        yesterdayItems.push(item);
      } else if (itemTime >= thisWeek) {
        weekItems.push(item);
      } else {
        olderItems.push(item);
      }
    });

    const groups: TimelineGroup[] = [];
    if (todayItems.length > 0) {
      groups.push({ title: 'Today', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', items: todayItems });
    }
    if (yesterdayItems.length > 0) {
      groups.push({ title: 'Yesterday', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200', items: yesterdayItems });
    }
    if (weekItems.length > 0) {
      groups.push({ title: 'This Week', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', items: weekItems });
    }
    if (olderItems.length > 0) {
      groups.push({ title: 'Earlier History', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', items: olderItems });
    }

    return groups;
  }

  loadActivities() {
    this.loading = true;
    this.cdr.markForCheck();

    forkJoin({
      logs: this.activityLogService.getAll(500),
      assignments: this.assignmentService.getAssignments(),
      assets: this.assetService.getAssets({ limit: 1000 }).pipe(
        map(r => r.data),
        catchError(() => from(this.assetOffline.getAll()))
      ),
      users: this.userService.getUsers().pipe(catchError(() => of([]))),
      stats: this.activityLogService.getStats().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ logs, assignments, assets, users, stats }) => {
        this.ngZone.run(() => {
          this.users = users || [];
          const assetMap = new Map<string, Asset>();
          (assets || []).forEach(asset => {
            assetMap.set(asset.id, asset);
          });

          // 1. Build unified list from ActivityLog table
          const fromLogs: UnifiedActivity[] = (logs || []).map(l => {
            let serial = '';
            let owner = '';
            let secondaryId = l.secondaryId;
            let secondaryName = l.secondaryName;
            const isUser = l.action.startsWith('user_');

            if (l.action.startsWith('asset_')) {
              const asset = assetMap.get(l.entityId);
              if (asset) {
                serial = asset.serialNumber || '';
                owner = asset.assignedUser?.name || 'Stock';
                if (!secondaryId && asset.assignedUserId) {
                  secondaryId = asset.assignedUserId;
                  secondaryName = asset.assignedUser?.name;
                }
              }
            }

            if (l.meta?.serialNumber) {
              serial = l.meta.serialNumber;
            }
            if (l.meta?.assignedUser) {
              owner = l.meta.assignedUser;
            }
            if (l.meta?.changes?.['assignedUser']?.to) {
              owner = l.meta.changes['assignedUser'].to;
              if (!secondaryName) {
                secondaryName = l.meta.changes['assignedUser'].to;
              }
            }

            if (owner && owner !== 'Stock' && !secondaryId) {
              const matchedUser = this.users.find(u => u.name.toLowerCase().trim() === owner.toLowerCase().trim());
              if (matchedUser) {
                secondaryId = matchedUser.id;
              }
            }

            const diffList = this.getDiffList(l.meta?.changes, secondaryId, secondaryName);

            return {
              id: l.id,
              action: l.action,
              message: l.message,
              entityId: l.entityId,
              entityName: l.entityName,
              secondaryId: secondaryId,
              secondaryName: secondaryName,
              assetSerialNumber: serial,
              ownerName: isUser ? undefined : (owner || 'Stock'),
              actorId: l.actorId,
              actorName: l.actorName,
              changes: l.meta?.changes,
              diffList: diffList,
              meta: l.meta,
              isUserEvent: isUser,
              date: new Date(l.createdAt),
            };
          });

          // 2. Build unified list from Assignments (assign/return events)
          const fromAssignments: UnifiedActivity[] = [];
          for (const a of (assignments || [])) {
            const asset = assetMap.get(a.assetId);
            const serial = asset?.serialNumber || a.asset?.serialNumber || '';
            const owner = asset?.assignedUser?.name || a.user?.name || 'Stock';
            const assignDiffList = this.getDiffList(
              { 'Assignee': { from: 'Stock', to: a.user?.name || 'Assigned' } },
              a.userId,
              a.user?.name
            );

            fromAssignments.push({
              id: `assign-${a.id}`,
              action: 'asset_assigned',
              message: `"${a.asset?.name || 'Asset'}" was assigned to ${a.user?.name || 'a user'}`,
              entityId: a.assetId,
              entityName: a.asset?.name,
              secondaryId: a.userId,
              secondaryName: a.user?.name,
              assetSerialNumber: serial,
              ownerName: a.user?.name || owner,
              date: new Date(a.assignedAt),
              isAssignment: true,
              isUserEvent: false,
              changes: {
                'Assignee': { from: 'Stock', to: a.user?.name || 'Assigned' }
              },
              diffList: assignDiffList
            });

            if (a.returnedAt) {
              const retDiffList = this.getDiffList(
                { 'Assignee': { from: a.user?.name || 'Assigned', to: 'Stock' } },
                a.userId,
                a.user?.name
              );

              fromAssignments.push({
                id: `return-${a.id}`,
                action: 'asset_returned',
                message: `"${a.asset?.name || 'Asset'}" was returned by ${a.user?.name || 'a user'}`,
                entityId: a.assetId,
                entityName: a.asset?.name,
                secondaryId: a.userId,
                secondaryName: a.user?.name,
                assetSerialNumber: serial,
                ownerName: 'Stock',
                date: new Date(a.returnedAt),
                isAssignment: true,
                isUserEvent: false,
                changes: {
                  'Assignee': { from: a.user?.name || 'Assigned', to: 'Stock' }
                },
                diffList: retDiffList
              });
            }
          }

          const nonAssignmentLogs = fromLogs.filter(
            l => l.action !== 'asset_assigned' && l.action !== 'asset_returned'
          );

          this.activities = [...nonAssignmentLogs, ...fromAssignments]
            .sort((a, b) => b.date.getTime() - a.date.getTime());

          // Update stats accurately from the full unified activities list
          const totalAssignments = this.activities.filter(a => a.action === 'asset_assigned' || a.action === 'asset_returned').length;
          const totalAssets = this.activities.filter(a => a.action.startsWith('asset_') && a.action !== 'asset_assigned' && a.action !== 'asset_returned').length;
          const totalUsers = this.activities.filter(a => a.action.startsWith('user_')).length;
          const last24h = this.activities.filter(a => a.date.getTime() >= Date.now() - 24 * 60 * 60 * 1000).length;

          this.stats = {
            totalCount: this.activities.length,
            assetEventsCount: totalAssets,
            assignmentEventsCount: totalAssignments,
            userEventsCount: totalUsers,
            last24hCount: last24h,
          };

          this.loading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.notifyError('Failed to load activity history');
          this.loading = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      }
    });
  }

  async exportToExcel() {
    if (this.filteredActivities.length === 0) {
      this.notifyError('No activities to export with current filters');
      return;
    }

    this.exporting = true;
    this.cdr.markForCheck();

    try {
      const exportData = this.filteredActivities.map((a, index) => {
        let diffStr = '';
        if (a.changes) {
          diffStr = Object.entries(a.changes)
            .map(([field, diff]) => `${field}: ${diff.from || '-'} → ${diff.to || '-'}`)
            .join('; ');
        }

        return {
          'No.': index + 1,
          'Date & Time': a.date.toLocaleString(),
          'Action': this.actionLabel(a.action),
          'Entity Name': a.entityName || '-',
          'Serial Number': a.assetSerialNumber || '-',
          'Current Owner / Target': a.isUserEvent ? '-' : (a.ownerName || a.secondaryName || '-'),
          'Performed By': a.actorName || 'System Admin',
          'Description': a.message,
          'Changes / Diffs': diffStr || '-',
        };
      });

      await this.excelExportService.exportToExcel(exportData, 'Activity_History_Audit_Log', 'Audit Logs');
      this.notifySuccess('Activity log exported to Excel');
    } catch (err) {
      this.notifyError('Failed to export activity logs');
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  getDiffList(changes?: any, fallbackSecondaryId?: string, fallbackSecondaryName?: string): ActivityChangeDiff[] {
    if (!changes || typeof changes !== 'object') return [];
    return Object.entries(changes)
      .map(([field, val]: [string, any]) => {
        const fieldName = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
        let fromVal = 'Previous';
        let toVal = 'Updated';
        if (val && typeof val === 'object' && ('from' in val || 'to' in val)) {
          fromVal = String(val.from || 'None').trim();
          toVal = String(val.to || 'None').trim();
        } else {
          toVal = String(val || 'Updated').trim();
        }

        const isUser = this.isUserDiff(fieldName, toVal);
        let userId: string | undefined;
        if (isUser) {
          if (fallbackSecondaryName && toVal.toLowerCase() === fallbackSecondaryName.toLowerCase() && fallbackSecondaryId) {
            userId = fallbackSecondaryId;
          } else {
            const clean = toVal.toLowerCase();
            const matched = this.users?.find(u => u.name?.toLowerCase().trim() === clean || u.id === toVal);
            if (matched) {
              userId = matched.id;
            }
          }
        }

        return {
          field: fieldName,
          from: fromVal,
          to: toVal,
          isUser,
          userId
        };
      })
      .filter(diff => diff.from.toLowerCase() !== diff.to.toLowerCase());
  }

  trackByActivity(index: number, item: UnifiedActivity): string {
    return item.id;
  }

  trackByDiff(index: number, diff: ActivityChangeDiff): string {
    return diff.field + '_' + (diff.from || '') + '_' + (diff.to || '');
  }

  actionLabel(action: string): string {
    const labels: Record<string, string> = {
      asset_created: 'Asset Added',
      asset_updated: 'Asset Updated',
      asset_deleted: 'Asset Deleted',
      asset_assigned: 'Asset Assigned',
      asset_returned: 'Asset Returned',
      asset_bulk_updated: 'Bulk Updated',
      asset_imported: 'Assets Imported',
      user_created: 'User Added',
      user_updated: 'User Updated',
      user_deleted: 'User Deleted',
    };
    return labels[action] || action.replace(/_/g, ' ').toUpperCase();
  }

  actionIcon(action: string): string {
    const icons: Record<string, string> = {
      asset_created: 'plus-circle',
      asset_updated: 'pencil',
      asset_deleted: 'trash-2',
      asset_assigned: 'arrow-up-right',
      asset_returned: 'arrow-down-left',
      asset_bulk_updated: 'layers',
      asset_imported: 'upload-cloud',
      user_created: 'user-plus',
      user_updated: 'user-check',
      user_deleted: 'user-minus',
    };
    return icons[action] || 'clock';
  }

  actionColor(action: string): string {
    if (action === 'asset_created' || action === 'user_created' || action === 'asset_imported') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action === 'asset_deleted' || action === 'user_deleted') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action === 'asset_assigned') {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (action === 'asset_returned') {
      return 'bg-teal-50 text-teal-700 border-teal-200';
    }
    if (action === 'asset_updated' || action === 'asset_bulk_updated' || action === 'user_updated') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  }

  actionBadgeClass(action: string): string {
    if (action === 'asset_created' || action === 'user_created' || action === 'asset_imported') {
      return 'bg-emerald-100/70 text-emerald-800 border border-emerald-200/60';
    }
    if (action === 'asset_deleted' || action === 'user_deleted') {
      return 'bg-rose-100/70 text-rose-800 border border-rose-200/60';
    }
    if (action === 'asset_assigned') {
      return 'bg-indigo-100/70 text-indigo-800 border border-indigo-200/60';
    }
    if (action === 'asset_returned') {
      return 'bg-teal-100/70 text-teal-800 border border-teal-200/60';
    }
    if (action === 'asset_updated' || action === 'asset_bulk_updated' || action === 'user_updated') {
      return 'bg-amber-100/70 text-amber-800 border border-amber-200/60';
    }
    return 'bg-slate-100 text-slate-800 border border-slate-200';
  }

  formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  }
}
