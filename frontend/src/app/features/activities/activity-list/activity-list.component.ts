import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, inject, NgZone, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
  actionBadgeClass?: string;
  actionColor?: string;
  actionIcon?: string;
  actionLabel?: string;
  relativeTime?: string;
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
  // Default change detection: Angular automatically picks up all state changes
  // from zone events (clicks, timeouts, HTTP). No markForCheck()/detectChanges() needed.
})
export class ActivityListComponent implements OnInit, AfterViewInit {
  @ViewChild('topSentinel') topSentinel?: ElementRef<HTMLElement>;
  private headerSearchObserver?: IntersectionObserver;
  private pageHeaderService = inject(PageHeaderService);
  private activityLogService = inject(ActivityLogService);
  private assignmentService = inject(AssignmentService);
  private assetService = inject(AssetService);
  private assetOffline = inject(AssetOfflineService);
  private excelExportService = inject(ExcelExportService);
  private userService = inject(UserService);
  private toastr = inject(ToastrService);
  private ngZone = inject(NgZone);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  activities: UnifiedActivity[] = [];
  users: User[] = [];
  allAssets: Asset[] = [];
  loading = true;
  exporting = false;
  protected readonly Math = Math;

  // ─── Asset Inspection Drawer State ───────────────────────────────────────
  selectedAssetIdForDrawer: string | null = null;
  showAssetDrawer = false;

  // ─── Assignee Hover Card State ────────────────────────────────────────────
  hoverUser: User | null = null;
  showHoverCard = false;
  hoverCardPosition = { x: 0, y: 0, triggerTop: 0, triggerBottom: 0 };
  private hoverEnterTimeout: any;
  private hoverTimeout: any;

  // ─── Copy Serial UX State ─────────────────────────────────────────────────
  copiedSerialMap: { [serial: string]: boolean } = {};
  private copyTimeouts: { [serial: string]: any } = {};

  // ─── Memoized derived data (updated only when inputs change) ─────────────
  // Getters that re-run on every CD tick were the root of sluggishness with
  // Default change detection. These are plain properties now.
  filteredActivities: UnifiedActivity[] = [];
  paginatedActivities: UnifiedActivity[] = [];
  totalPages = 1;
  timelineGroups: TimelineGroup[] = [];

  /** Rebuilds all derived data. Call whenever activities, filters, or pagination changes. */
  private updateDerivedData(): void {
    let list = this.activities;

    // 1. Category filter
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

    // 2. Date range filter
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
          list = list.filter(a => a.date >= new Date(this.customStartDate));
        }
        if (this.customEndDate) {
          const end = new Date(this.customEndDate);
          end.setHours(23, 59, 59, 999);
          list = list.filter(a => a.date <= end);
        }
      }
    }

    // 3. Search term
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

    this.filteredActivities = list;
    this.totalPages = Math.max(1, Math.ceil(list.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedActivities = list.slice(start, start + this.pageSize);
    this.timelineGroups = this.buildTimelineGroups(this.paginatedActivities);
  }

  private buildTimelineGroups(list: UnifiedActivity[]): TimelineGroup[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const thisWeek = today - 6 * 24 * 60 * 60 * 1000;

    const todayItems: UnifiedActivity[] = [];
    const yesterdayItems: UnifiedActivity[] = [];
    const weekItems: UnifiedActivity[] = [];
    const olderItems: UnifiedActivity[] = [];

    list.forEach(item => {
      const t = item.date.getTime();
      if (t >= today) todayItems.push(item);
      else if (t >= yesterday) yesterdayItems.push(item);
      else if (t >= thisWeek) weekItems.push(item);
      else olderItems.push(item);
    });

    const groups: TimelineGroup[] = [];
    if (todayItems.length) groups.push({ title: 'Today', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', items: todayItems });
    if (yesterdayItems.length) groups.push({ title: 'Yesterday', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200', items: yesterdayItems });
    if (weekItems.length) groups.push({ title: 'This Week', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', items: weekItems });
    if (olderItems.length) groups.push({ title: 'Earlier History', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', items: olderItems });
    return groups;
  }

  copySerial(serial?: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!serial) return;
    const finish = () => {
      this.toastr.success('Serial Number copied to clipboard');
      this.copiedSerialMap[serial] = true;
      if (this.copyTimeouts[serial]) clearTimeout(this.copyTimeouts[serial]);
      this.copyTimeouts[serial] = setTimeout(() => {
        this.copiedSerialMap[serial] = false;
      }, 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(serial).then(finish).catch(() => this.fallbackCopy(serial, finish));
    } else {
      this.fallbackCopy(serial, finish);
    }
  }

  private fallbackCopy(text: string, done: () => void) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch {
      this.toastr.error('Failed to copy');
    }
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

  /** Opens the asset inspection drawer. Synchronous — Default change detection handles the view update. */
  openAssetDrawer(idOrName?: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const raw = (idOrName || '').trim();
    if (!raw) return;

    // Resolve name / serial to a real asset UUID when possible
    const lower = raw.toLowerCase();
    let matched = (this.allAssets || []).find(
      a => a.id === raw ||
           (a.name || '').toLowerCase().trim() === lower ||
           (a.serialNumber || '').toLowerCase().trim() === lower
    );

    // If not found in allAssets by exact match, try activity list or fuzzy match
    if (!matched) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
      if (!isUuid) {
        const foundAct = (this.activities || []).find(
          act => !act.isUserEvent &&
                 act.entityId &&
                 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(act.entityId) &&
                 (
                   (act.entityName && act.entityName.toLowerCase().trim() === lower) ||
                   (act.assetSerialNumber && act.assetSerialNumber.toLowerCase().trim() === lower) ||
                   (act.entityName && lower.includes(act.entityName.toLowerCase().trim()))
                 )
        );
        if (foundAct?.entityId) {
          matched = { id: foundAct.entityId } as any;
        } else {
          const fuzzy = (this.allAssets || []).find(
            a => (a.name && (a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase().trim()))) ||
                 (a.serialNumber && (a.serialNumber.toLowerCase().includes(lower) || lower.includes(a.serialNumber.toLowerCase().trim())))
          );
          if (fuzzy) matched = fuzzy;
        }
      }
    }

    this.dismissHoverCard();
    this.selectedAssetIdForDrawer = matched ? matched.id : raw;
    this.showAssetDrawer = true;
  }

  /** Closes the asset inspection drawer. */
  closeAssetDrawer(): void {
    this.showAssetDrawer = false;
    this.selectedAssetIdForDrawer = null;
    // Angular's Default change detection picks this up automatically
  }

  onDrawerUpdated(): void {
    this.loadActivities();
  }

  onUserHover(userIdentifier: string | undefined, event: MouseEvent) {
    if (!userIdentifier || userIdentifier === 'Stock' || userIdentifier === 'None' || userIdentifier === '-') return;
    if (this.hoverEnterTimeout) clearTimeout(this.hoverEnterTimeout);

    const targetEl = (event.target as HTMLElement).closest('[data-user-hover]') as HTMLElement || (event.target as HTMLElement);
    const rect = targetEl.getBoundingClientRect();

    // Run timer OUTSIDE Angular zone so hover delay doesn't trigger CD.
    // ngZone.run() is used only when we actually need to update the view.
    this.ngZone.runOutsideAngular(() => {
      this.hoverEnterTimeout = setTimeout(() => {
        const clean = userIdentifier.trim().toLowerCase();
        const user = this.users.find(u =>
          u.id === userIdentifier ||
          u.name.toLowerCase().trim() === clean ||
          (u.email && u.email.toLowerCase().trim() === clean)
        );
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
          });
        }
      }, 90);
    });
  }

  onUserHoverLeave() {
    if (this.hoverEnterTimeout) {
      clearTimeout(this.hoverEnterTimeout);
      this.hoverEnterTimeout = null;
    }
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    this.ngZone.runOutsideAngular(() => {
      this.hoverTimeout = setTimeout(() => {
        this.ngZone.run(() => {
          this.showHoverCard = false;
          this.hoverUser = null;
        });
      }, 60);
    });
  }

  onCardHoverChange(isHovered: boolean) {
    if (isHovered) {
      if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    } else {
      if (this.hoverEnterTimeout) clearTimeout(this.hoverEnterTimeout);
      if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
      this.ngZone.runOutsideAngular(() => {
        this.hoverTimeout = setTimeout(() => {
          this.ngZone.run(() => {
            this.showHoverCard = false;
            this.hoverUser = null;
          });
        }, 50);
      });
    }
  }

  // Search & Filter state
  searchTerm = '';
  showHeaderSearch = false;
  selectedCategory: 'all' | 'assets' | 'assignments' | 'users' | 'updates' | 'deletions' = 'all';
  selectedDateRange: 'all' | 'today' | 'week' | 'month' | 'custom' = 'all';
  customStartDate = '';
  customEndDate = '';
  viewMode: 'timeline' | 'table' = 'timeline';

  // Mobile UX state (Option A)
  mobileSearchOpen = false;

  toggleMobileSearch() {
    this.mobileSearchOpen = !this.mobileSearchOpen;
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'timeline' ? 'table' : 'timeline';
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
    this.updateDerivedData();
  }

  onMobileCardClick(activity: UnifiedActivity, event: Event) {
    if (!activity.isUserEvent && activity.action !== 'asset_deleted') {
      this.openAssetDrawer(activity.entityId || activity.entityName, event);
    } else if (activity.isUserEvent && activity.action !== 'user_deleted') {
      this.openUserDialog(activity.secondaryId || activity.entityId || activity.entityName, event);
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
    const serial = this.route.snapshot.queryParamMap.get('serial');
    if (serial) this.searchTerm = serial;
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
      this.selectedUserIdForDialog = user.id;
      this.showUserDetailDialog = true;
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
        this.selectedUserIdForDialog = found ? found.id : clean;
        this.showUserDetailDialog = true;
      },
      error: () => {
        this.selectedUserIdForDialog = clean;
        this.showUserDetailDialog = true;
      }
    });
  }

  closeUserDialog(): void {
    this.showUserDetailDialog = false;
    this.selectedUserIdForDialog = null;
  }

  viewAsset(assetId?: string, event?: Event): void {
    // Delegates directly — openAssetDrawer handles stopPropagation & resolution
    this.openAssetDrawer(assetId, event);
  }

  setCategory(category: 'all' | 'assets' | 'assignments' | 'users' | 'updates' | 'deletions') {
    this.selectedCategory = category;
    this.currentPage = 1;
    this.updateDerivedData();
  }

  setDateRange(range: 'all' | 'today' | 'week' | 'month' | 'custom') {
    this.selectedDateRange = range;
    this.currentPage = 1;
    this.updateDerivedData();
  }

  setViewMode(mode: 'timeline' | 'table') {
    this.viewMode = mode;
  }

  setPageSize(size: number) {
    this.pageSize = size;
    this.currentPage = 1;
    this.updateDerivedData();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateDerivedData();
    }
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.updateDerivedData();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.updateDerivedData();
  }

  onListScroll(event: Event): void {
    const target = event.target as HTMLElement | null;
    const scrollTop = target ? target.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
    this.showHeaderSearch = scrollTop > 10;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    this.showHeaderSearch = scrollTop > 10;
  }

  ngAfterViewInit(): void {
    const el = this.topSentinel?.nativeElement;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    this.headerSearchObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        this.ngZone.run(() => {
          this.showHeaderSearch = !entry.isIntersecting;
        });
      },
      { threshold: 0 }
    );
    this.headerSearchObserver.observe(el);
  }

  onCustomDateChange(): void {
    this.currentPage = 1;
    this.updateDerivedData();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.selectedDateRange = 'all';
    this.customStartDate = '';
    this.customEndDate = '';
    this.currentPage = 1;
    this.updateDerivedData();
  }

  trackByGroup(index: number, group: TimelineGroup): string {
    return group.title;
  }

  loadActivities() {
    this.loading = true;

    forkJoin({
      logs: this.activityLogService.getAll(500),
      assignments: this.assignmentService.getAssignments(),
      assets: from(this.assetOffline.getAll()).pipe(
        catchError(() => of([]))
      ),
      users: this.userService.getUsers().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ logs, assignments, assets, users }) => {
          this.users = users || [];
          this.allAssets = assets || [];
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
            let resolvedEntityId = l.entityId;

            if (l.action.startsWith('asset_')) {
              if (!resolvedEntityId && l.meta?.['assetId']) {
                resolvedEntityId = l.meta['assetId'];
              }
              const asset = resolvedEntityId ? assetMap.get(resolvedEntityId) : null;
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

            if (l.action.startsWith('asset_') && !resolvedEntityId && serial) {
              const matched = (assets || []).find(a => a.serialNumber === serial);
              if (matched) resolvedEntityId = matched.id;
            }

            if (l.action.startsWith('asset_') && !resolvedEntityId && l.entityName) {
              const matched = (assets || []).find(
                a => a.name?.toLowerCase().trim() === l.entityName.toLowerCase().trim()
              );
              if (matched) resolvedEntityId = matched.id;
            }

            if (owner && owner !== 'Stock' && !secondaryId) {
              const matchedUser = this.users.find(u => u.name.toLowerCase().trim() === owner.toLowerCase().trim());
              if (matchedUser) {
                secondaryId = matchedUser.id;
              }
            }

            const diffList = this.getDiffList(l.meta?.changes, secondaryId, secondaryName);

            const actDate = new Date(l.createdAt);
            return {
              id: l.id,
              action: l.action,
              actionBadgeClass: this.actionBadgeClass(l.action),
              actionColor: this.actionColor(l.action),
              actionIcon: this.actionIcon(l.action),
              actionLabel: this.actionLabel(l.action),
              relativeTime: this.formatRelativeTime(actDate),
              message: l.message,
              entityId: resolvedEntityId || l.entityId,
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
              date: actDate,
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

            const assignDate = new Date(a.assignedAt);
            fromAssignments.push({
              id: `assign-${a.id}`,
              action: 'asset_assigned',
              actionBadgeClass: this.actionBadgeClass('asset_assigned'),
              actionColor: this.actionColor('asset_assigned'),
              actionIcon: this.actionIcon('asset_assigned'),
              actionLabel: this.actionLabel('asset_assigned'),
              relativeTime: this.formatRelativeTime(assignDate),
              message: `"${a.asset?.name || asset?.name || 'Asset'}" was assigned to ${a.user?.name || 'a user'}`,
              entityId: a.assetId || a.asset?.id || asset?.id,
              entityName: a.asset?.name || asset?.name || 'Unknown Asset',
              secondaryId: a.userId,
              secondaryName: a.user?.name,
              assetSerialNumber: serial,
              ownerName: a.user?.name || owner,
              date: assignDate,
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

              const retDate = new Date(a.returnedAt);
              fromAssignments.push({
                id: `return-${a.id}`,
                action: 'asset_returned',
                actionBadgeClass: this.actionBadgeClass('asset_returned'),
                actionColor: this.actionColor('asset_returned'),
                actionIcon: this.actionIcon('asset_returned'),
                actionLabel: this.actionLabel('asset_returned'),
                relativeTime: this.formatRelativeTime(retDate),
                message: `"${a.asset?.name || asset?.name || 'Asset'}" was returned by ${a.user?.name || 'a user'}`,
                entityId: a.assetId || a.asset?.id || asset?.id,
                entityName: a.asset?.name || asset?.name || 'Unknown Asset',
                secondaryId: a.userId,
                secondaryName: a.user?.name,
                assetSerialNumber: serial,
                ownerName: 'Stock',
                date: retDate,
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

          this.updateDerivedData();
          this.loading = false;
      },
      error: () => {
          this.notifyError('Failed to load activity history');
          this.loading = false;
      }
    });
  }

  async exportToExcel() {
    if (this.filteredActivities.length === 0) {
      this.notifyError('No activities to export with current filters');
      return;
    }

    this.exporting = true;

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
