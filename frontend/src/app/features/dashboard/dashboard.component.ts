import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, NgZone, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ChartConfiguration, ChartData } from 'chart.js';
import { LucideAngularModule } from 'lucide-angular';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { forkJoin } from 'rxjs';
import { ActivityLogService } from '../../core/services/activity-log.service';
import { AssignmentService } from '../../core/services/assignment.service';
import { DashboardService, DashboardStats, StatusCount } from '../../core/services/dashboard.service';
import { User, UserService } from '../../core/services/user.service';
import { UserDetailDialogComponent } from '../users/user-detail-dialog/user-detail-dialog.component';
import { AssetDrawerComponent } from '../../shared/components/asset-drawer/asset-drawer.component';
import { UserHoverCardComponent } from '../../shared/components/user-hover-card/user-hover-card.component';

// Converts Tailwind bg class like "bg-green-500" to a hex for Chart.js
function tailwindToHex(colorClass: string, index: number): string {
  const palette = ['#6366f1','#22c55e','#f59e0b','#94a3b8','#ef4444','#14b8a6','#ec4899','#f97316'];
  if (!colorClass) return palette[index % palette.length];
  const bgMatch = colorClass.match(/bg-(\w+)-(\d+)/);
  if (!bgMatch) return palette[index % palette.length];
  const colorMap: Record<string, Record<string, string>> = {
    slate:   { '100':'#f1f5f9','200':'#e2e8f0','300':'#cbd5e1','400':'#94a3b8','500':'#64748b','600':'#475569','700':'#334155' },
    red:     { '100':'#fee2e2','400':'#f87171','500':'#ef4444','600':'#dc2626','700':'#b91c1c' },
    orange:  { '100':'#ffedd5','400':'#fb923c','500':'#f97316','600':'#ea580c','700':'#c2410c' },
    amber:   { '100':'#fef3c7','400':'#fbbf24','500':'#f59e0b','600':'#d97706','700':'#b45309' },
    green:   { '100':'#dcfce7','400':'#4ade80','500':'#22c55e','600':'#16a34a','700':'#15803d' },
    emerald: { '100':'#d1fae5','400':'#34d399','500':'#10b981','600':'#059669','700':'#047857' },
    teal:    { '100':'#ccfbf1','400':'#2dd4bf','500':'#14b8a6','600':'#0d9488','700':'#0f766e' },
    cyan:    { '100':'#cffafe','400':'#22d3ee','500':'#06b6d4','600':'#0891b2','700':'#0e7490' },
    blue:    { '100':'#dbeafe','400':'#60a5fa','500':'#3b82f6','600':'#2563eb','700':'#1d4ed8' },
    indigo:  { '100':'#e0e7ff','400':'#818cf8','500':'#6366f1','600':'#4f46e5','700':'#4338ca' },
    purple:  { '100':'#f3e8ff','400':'#c084fc','500':'#a855f7','600':'#9333ea','700':'#7e22ce' },
    pink:    { '100':'#fce7f3','400':'#f472b6','500':'#ec4899','600':'#db2777','700':'#be185d' },
  };
  return colorMap[bgMatch[1]]?.[bgMatch[2]] ?? palette[index % palette.length];
}

function resolveHexColor(colorClass: string | undefined, index: number, palette: string[]): string {
  if (!colorClass) return palette[index % palette.length];
  const bgMatch = colorClass.match(/bg-(\w+)-(\d+)/);
  if (!bgMatch) return palette[index % palette.length];
  const colorMap: Record<string, Record<string, string>> = {
    emerald: { '100':'#d1fae5','400':'#34d399','500':'#10b981','600':'#059669','700':'#047857' },
    green:   { '100':'#dcfce7','400':'#4ade80','500':'#22c55e','600':'#16a34a','700':'#15803d' },
    amber:   { '100':'#fef3c7','400':'#fbbf24','500':'#f59e0b','600':'#d97706','700':'#b45309' },
    rose:    { '100':'#ffe4e6','400':'#fb7185','500':'#f43f5e','600':'#e11d48','700':'#be123c' },
    red:     { '100':'#fee2e2','400':'#f87171','500':'#ef4444','600':'#dc2626','700':'#b91c1c' },
    cyan:    { '100':'#cffafe','400':'#22d3ee','500':'#06b6d4','600':'#0891b2','700':'#0e7490' },
    blue:    { '100':'#dbeafe','400':'#60a5fa','500':'#3b82f6','600':'#2563eb','700':'#1d4ed8' },
    indigo:  { '100':'#e0e7ff','400':'#818cf8','500':'#6366f1','600':'#4f46e5','700':'#4338ca' },
    purple:  { '100':'#f3e8ff','400':'#c084fc','500':'#a855f7','600':'#9333ea','700':'#7e22ce' },
    pink:    { '100':'#fce7f3','400':'#f472b6','500':'#ec4899','600':'#db2777','700':'#be185d' },
  };
  return colorMap[bgMatch[1]]?.[bgMatch[2]] ?? palette[index % palette.length];
}

import { PageHeaderService } from '../../core/services/page-header.service';
import { PageHeaderActionsDirective } from '../../shared/directives/page-header-actions.directive';

export interface ActivityDiffItem {
  field: string;
  from: string;
  to: string;
  isUser: boolean;
  userId?: string;
}

export interface DashboardActivity {
  id?: string;
  action: string;
  message: string;
  entityId?: string;
  entityName?: string;
  secondaryId?: string;
  secondaryName?: string;
  assetSerialNumber?: string;
  ownerName?: string;
  actorName?: string;
  isUserEvent?: boolean;
  changes?: any;
  diffList?: ActivityDiffItem[];
  date: Date;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, BaseChartDirective, UserDetailDialogComponent, AssetDrawerComponent, UserHoverCardComponent, PageHeaderActionsDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  isBrowser: boolean;
  private pageHeaderService = inject(PageHeaderService);
  private dashboardService = inject(DashboardService);
  private activityLogService = inject(ActivityLogService);
  private assignmentService = inject(AssignmentService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  stats: DashboardStats | null = null;
  totalUsers = 0;
  users: User[] = [];
  loading = true;
  showUserDetailDialog = false;
  selectedUserIdForDialog: string | null = null;

  // Asset Inspection Drawer State
  selectedAssetIdForDrawer: string | null = null;
  showAssetDrawer = false;

  // Assignee Hover Card State
  hoverUser: User | null = null;
  showHoverCard = false;
  hoverCardPosition = { x: 0, y: 0, triggerTop: 0, triggerBottom: 0 };
  private hoverEnterTimeout: any;
  private hoverTimeout: any;

  // Unified Recent Activity Feed for Dashboard
  recentUnifiedActivities: Array<{
    id: string;
    entityId?: string;
    entityName?: string;
    action: string;
    message: string;
    actorName?: string;
    ownerName?: string;
    date: Date;
  }> = [];

  recentActivity: DashboardActivity[] = [];

  openAssetDrawer(id?: string) {
    if (!id) return;
    if (this.hoverEnterTimeout) clearTimeout(this.hoverEnterTimeout);
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    this.showHoverCard = false;
    this.hoverUser = null;
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

  onUserHover(userIdentifier: string | undefined, event: MouseEvent) {
    if (!userIdentifier) return;
    if (this.hoverEnterTimeout) clearTimeout(this.hoverEnterTimeout);

    const target = (event.target as HTMLElement).closest('[data-user-hover]') as HTMLElement || (event.target as HTMLElement);
    const rect = target.getBoundingClientRect();

    this.hoverEnterTimeout = setTimeout(() => {
      this.ngZone.run(() => {
        const user = this.users.find(u => u.id === userIdentifier || u.name.toLowerCase() === userIdentifier.toLowerCase());
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
      event.preventDefault();
      event.stopPropagation();
    }
    if (!userIdentifier || userIdentifier === 'Stock' || userIdentifier === 'None' || userIdentifier === '-' || userIdentifier === 'Previous') return;
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

    const clean = userIdentifier.trim();

    // 1. Direct search in preloaded users list
    let user = this.users?.find(u => 
      u.id === clean || 
      u.name?.toLowerCase().trim() === clean.toLowerCase() ||
      (u.email && u.email.toLowerCase().trim() === clean.toLowerCase())
    );

    // 2. If not found in users list, search recentActivity secondaryId
    if (!user) {
      const act = this.recentActivity?.find(a => 
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

    // 3. Fallback: fetch dynamically if users list wasn't populated yet
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

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.pageHeaderService.setHeader({ title: 'Dashboard', subtitle: 'Overview & key metrics' });
    forkJoin({
      stats: this.dashboardService.getStats(),
      logs: this.activityLogService.getAll(50),
      assignments: this.assignmentService.getAssignments(),
      users: this.userService.getUsers(),
    }).subscribe({
      next: ({ stats, logs, assignments, users }) => {
        this.stats = stats;
        this.users = users;
        this.totalUsers = users.length;
        this.buildCharts(stats);

        // Build unified recent-activity feed using data already in logs & assignments
        const fromLogs = logs
          .filter(l => l.action !== 'asset_assigned' && l.action !== 'asset_returned')
          .map(l => {
            const isUser = l.action.startsWith('user_');
            const serial = l.meta?.['serialNumber'] || '';
            let owner  = l.meta?.['assignedUser'] || 'Stock';
            let secondaryId = l.secondaryId;
            let secondaryName = l.secondaryName;

            if (l.meta?.changes?.['assignedUser']?.to) {
              const toVal = l.meta.changes['assignedUser'].to;
              if (toVal && toVal !== 'Stock') {
                owner = toVal;
                if (!secondaryName) secondaryName = toVal;
              }
            }

            if (secondaryName && !secondaryId) {
              const matched = (users || []).find(u => u.name?.toLowerCase().trim() === secondaryName?.toLowerCase().trim());
              if (matched) secondaryId = matched.id;
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
              ownerName: isUser ? undefined : owner,
              actorName: l.actorName,
              isUserEvent: isUser,
              changes: l.meta?.changes,
              diffList: diffList,
              date: new Date(l.createdAt)
            };
          });

        const fromAssignments: DashboardActivity[] = [];
        for (const a of assignments) {
          const serial = a.asset?.serialNumber || '';
          const assignDiffList = this.getDiffList(
            { 'Assignee': { from: 'Stock', to: a.user?.name || 'Assigned' } },
            a.userId,
            a.user?.name
          );

          fromAssignments.push({
            id: `assign-${a.id}`,
            action: 'asset_assigned',
            message: `"${a.asset?.name || 'Asset'}" assigned to ${a.user?.name || 'user'}`,
            entityId: a.assetId,
            entityName: a.asset?.name || '',
            secondaryId: a.userId || '',
            secondaryName: a.user?.name || '',
            assetSerialNumber: serial,
            ownerName: a.user?.name || 'Stock',
            actorName: undefined,
            isUserEvent: false,
            changes: {
              'Assignee': { from: 'Stock', to: a.user?.name || 'Assigned' }
            },
            diffList: assignDiffList,
            date: new Date(a.assignedAt)
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
              message: `"${a.asset?.name || 'Asset'}" returned by ${a.user?.name || 'user'}`,
              entityId: a.assetId,
              entityName: a.asset?.name || '',
              secondaryId: a.userId || '',
              secondaryName: a.user?.name || '',
              assetSerialNumber: serial,
              ownerName: 'Stock',
              actorName: undefined,
              isUserEvent: false,
              changes: {
                'Assignee': { from: a.user?.name || 'Assigned', to: 'Stock' }
              },
              diffList: retDiffList,
              date: new Date(a.returnedAt)
            });
          }
        }

        this.recentActivity = [...fromLogs, ...fromAssignments]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 8);

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Dashboard load error', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
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

  activityFilter: 'all' | 'assets' | 'assignments' | 'users' = 'all';

  get filteredRecentActivity() {
    let list = this.recentActivity;
    if (this.activityFilter === 'assets') {
      list = list.filter(a => a.action.startsWith('asset_') && a.action !== 'asset_assigned' && a.action !== 'asset_returned');
    } else if (this.activityFilter === 'assignments') {
      list = list.filter(a => a.action === 'asset_assigned' || a.action === 'asset_returned');
    } else if (this.activityFilter === 'users') {
      list = list.filter(a => a.action.startsWith('user_'));
    }
    return list.slice(0, 6);
  }

  setActivityFilter(filter: 'all' | 'assets' | 'assignments' | 'users') {
    this.activityFilter = filter;
    this.cdr.markForCheck();
  }

  formatRelativeTime(date: Date): string {
    const now = new Date().getTime();
    const diff = (now - new Date(date).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  getDiffList(changes?: any, fallbackSecondaryId?: string, fallbackSecondaryName?: string): ActivityDiffItem[] {
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

  trackByActivity(index: number, item: DashboardActivity): string {
    return item.id || (item.entityId + '_' + item.date?.getTime() + '_' + item.action);
  }

  trackByDiff(index: number, diff: ActivityDiffItem): string {
    return diff.field + '_' + diff.from + '_' + diff.to;
  }

  // ── Chart configs ────────────────────────────────────────────────────────────

  public donutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    cutout: '70%'
  };

  public statusChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }]
  };

  public barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, grid: { display: true } }, x: { grid: { display: false } } }
  };

  public categoryChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: '#6366f1', borderRadius: 4 }]
  };

  private buildCharts(data: DashboardStats) {
    const byStatus: StatusCount[] = data.kpi.byStatus ?? [];

    this.statusChartData = {
      labels: byStatus.map(s => s.name),
      datasets: [{
        data: byStatus.map(s => s.count),
        backgroundColor: byStatus.map((s, i) => tailwindToHex(s.colorClass, i)),
        borderWidth: 0
      }]
    };

    this.categoryChartData = {
      labels: data.byCategory.map(c => c.categoryName),
      datasets: [{
        data: data.byCategory.map(c => parseInt(c.count, 10)),
        backgroundColor: '#6366f1',
        borderRadius: 4
      }]
    };
  }

  // KPI helpers — top statuses from DB for highlight cards
  get kpiStatuses(): StatusCount[] {
    return this.stats?.kpi?.byStatus?.slice(0, 3) ?? [];
  }

  get hasStatusData(): boolean {
    return (this.stats?.kpi?.total ?? 0) > 0;
  }

  get hasCategoryData(): boolean {
    return (this.stats?.byCategory?.length ?? 0) > 0;
  }
}
