import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ChartConfiguration, ChartData } from 'chart.js';
import { LucideAngularModule } from 'lucide-angular';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { forkJoin } from 'rxjs';
import { ActivityLogService } from '../../core/services/activity-log.service';
import { AssignmentService } from '../../core/services/assignment.service';
import { DashboardService, DashboardStats, StatusCount } from '../../core/services/dashboard.service';
import { UserService } from '../../core/services/user.service';
import { UserDetailDialogComponent } from '../users/user-detail-dialog/user-detail-dialog.component';

// Converts Tailwind bg class like "bg-green-500" to a hex for Chart.js
// Falls back to a palette if the colorClass is a compound badge class
function tailwindToHex(colorClass: string, index: number): string {
  const palette = ['#6366f1','#22c55e','#f59e0b','#94a3b8','#ef4444','#14b8a6','#ec4899','#f97316'];
  if (!colorClass) return palette[index % palette.length];
  // If colorClass contains a specific bg color like "bg-green-500" extract it
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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, BaseChartDirective, UserDetailDialogComponent],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  isBrowser: boolean;
  private dashboardService = inject(DashboardService);
  private activityLogService = inject(ActivityLogService);
  private assignmentService = inject(AssignmentService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  stats: DashboardStats | null = null;
  totalUsers = 0;
  loading = true;
  showUserDetailDialog = false;
  selectedUserIdForDialog: string | null = null;

  /** Unified recent activity feed for the dashboard widget */
  recentActivity: Array<{
    action: string;
    message: string;
    entityId?: string;
    entityName?: string;
    secondaryId?: string;
    secondaryName?: string;
    assetSerialNumber?: string;
    ownerName?: string;
    date: Date;
  }> = [];

  openUserDialog(userId: string) {
    if (!userId) return;
    this.selectedUserIdForDialog = userId;
    this.showUserDetailDialog = true;
    this.cdr.detectChanges();
  }

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    forkJoin({
      stats: this.dashboardService.getStats(),
      logs: this.activityLogService.getAll(50),
      assignments: this.assignmentService.getAssignments(),
      users: this.userService.getUsers(),
    }).subscribe({
      next: ({ stats, logs, assignments, users }) => {
        this.stats = stats;
        this.totalUsers = users.length;
        this.buildCharts(stats);

        // Build unified recent-activity feed using data already in logs & assignments
        const fromLogs = logs
          .filter(l => l.action !== 'asset_assigned' && l.action !== 'asset_returned')
          .map(l => {
            const serial = l.meta?.['serialNumber'] || '';
            const owner  = l.meta?.['assignedUser'] || 'Stock';
            return {
              action: l.action,
              message: l.message,
              entityId: l.entityId,
              entityName: l.entityName,
              secondaryId: l.secondaryId,
              secondaryName: l.secondaryName,
              assetSerialNumber: serial,
              ownerName: owner,
              date: new Date(l.createdAt)
            };
          });

        const fromAssignments: typeof fromLogs = [];
        for (const a of assignments) {
          const serial = a.asset?.serialNumber || '';
          fromAssignments.push({
            action: 'asset_assigned',
            message: `"${a.asset?.name || 'Asset'}" assigned to ${a.user?.name || 'user'}`,
            entityId: a.assetId,
            entityName: a.asset?.name || '',
            secondaryId: a.userId || '',
            secondaryName: a.user?.name || '',
            assetSerialNumber: serial,
            ownerName: a.user?.name || 'Stock',
            date: new Date(a.assignedAt)
          });
          if (a.returnedAt) {
            fromAssignments.push({
              action: 'asset_returned',
              message: `"${a.asset?.name || 'Asset'}" returned by ${a.user?.name || 'user'}`,
              entityId: a.assetId,
              entityName: a.asset?.name || '',
              secondaryId: a.userId || '',
              secondaryName: a.user?.name || '',
              assetSerialNumber: serial,
              ownerName: 'Stock',
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
