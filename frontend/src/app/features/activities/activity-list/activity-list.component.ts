import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, from } from 'rxjs';
import { ActivityLogService } from '../../../core/services/activity-log.service';
import { AssignmentService } from '../../../core/services/assignment.service';
import { Asset, AssetService } from '../../../core/services/asset.service';
import { AssetOfflineService } from '../../../core/services/asset-offline.service';
import { UserDetailDialogComponent } from '../../users/user-detail-dialog/user-detail-dialog.component';


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
  date: Date;
  isAssignment?: boolean;
}

@Component({
  selector: 'app-activity-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule, UserDetailDialogComponent],
  templateUrl: './activity-list.component.html',
  styleUrls: ['./activity-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityListComponent implements OnInit {
  private activityLogService = inject(ActivityLogService);
  private assignmentService = inject(AssignmentService);
  private assetService = inject(AssetService);
  private assetOffline = inject(AssetOfflineService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  activities: UnifiedActivity[] = [];
  loading = true;
  searchTerm = '';
  showUserDetailDialog = false;
  selectedUserIdForDialog: string | null = null;

  ngOnInit() {
    this.loadActivities();
  }

  openUserDialog(userId: string) {
    if (!userId) return;
    this.selectedUserIdForDialog = userId;
    this.showUserDetailDialog = true;
  }

  get filteredActivities(): UnifiedActivity[] {
    if (!this.searchTerm.trim()) return this.activities;
    const term = this.searchTerm.toLowerCase();
    return this.activities.filter(a =>
      a.message.toLowerCase().includes(term) ||
      (a.entityName || '').toLowerCase().includes(term) ||
      (a.secondaryName || '').toLowerCase().includes(term) ||
      (a.assetSerialNumber || '').toLowerCase().includes(term) ||
      (a.ownerName || '').toLowerCase().includes(term) ||
      this.actionLabel(a.action).toLowerCase().includes(term)
    );
  }

  loadActivities() {
    this.loading = true;
    this.cdr.markForCheck();

    forkJoin({
      logs: this.activityLogService.getAll(300),
      assignments: this.assignmentService.getAssignments(),
      assets: from(this.assetOffline.getAll())
    }).subscribe({
      next: ({ logs, assignments, assets }) => {
        const assetMap = new Map<string, Asset>();
        assets.forEach(asset => {
          assetMap.set(asset.id, asset);
        });


        // Build unified list from ActivityLog table
        const fromLogs: UnifiedActivity[] = logs.map(l => {
          let serial = '';
          let owner = 'Stock';
          let secondaryId = l.secondaryId;
          let secondaryName = l.secondaryName;

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

          if (l.meta && l.meta['serialNumber']) {
            serial = l.meta['serialNumber'];
          }
          if (l.meta && l.meta['assignedUser']) {
            owner = l.meta['assignedUser'];
          }

          return {
            id: l.id,
            action: l.action,
            message: l.message,
            entityId: l.entityId,
            entityName: l.entityName,
            secondaryId: secondaryId,
            secondaryName: secondaryName,
            assetSerialNumber: serial,
            ownerName: owner,
            date: new Date(l.createdAt),
          };
        });

        // Build unified list from Assignments (assign/return events)
        const fromAssignments: UnifiedActivity[] = [];
        for (const a of assignments) {
          const asset = assetMap.get(a.assetId);
          const serial = asset?.serialNumber || a.asset?.serialNumber || '';
          const owner = asset?.assignedUser?.name || a.user?.name || 'Stock';

          fromAssignments.push({
            id: `assign-${a.id}`,
            action: 'asset_assigned',
            message: `"${a.asset?.name || 'Asset'}" was assigned to ${a.user?.name || 'a user'}`,
            entityId: a.assetId,
            entityName: a.asset?.name,
            secondaryId: a.userId,
            secondaryName: a.user?.name,
            assetSerialNumber: serial,
            ownerName: owner,
            date: new Date(a.assignedAt),
            isAssignment: true,
          });

          if (a.returnedAt) {
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
            });
          }
        }

        const nonAssignmentLogs = fromLogs.filter(
          l => l.action !== 'asset_assigned' && l.action !== 'asset_returned'
        );

        this.activities = [...nonAssignmentLogs, ...fromAssignments]
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to load activity history');
        this.loading = false;
        this.cdr.detectChanges();
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
      user_created: 'User Added',
      user_deleted: 'User Deleted',
    };
    return labels[action] || action;
  }

  actionIcon(action: string): string {
    const icons: Record<string, string> = {
      asset_created: 'plus-circle',
      asset_updated: 'pencil',
      asset_deleted: 'trash-2',
      asset_assigned: 'arrow-up-right',
      asset_returned: 'arrow-down-left',
      user_created: 'user-plus',
      user_deleted: 'user-minus',
    };
    return icons[action] || 'clock';
  }

  actionColor(action: string): string {
    if (action === 'asset_created' || action === 'user_created') return 'bg-emerald-50 text-emerald-600';
    if (action === 'asset_deleted' || action === 'user_deleted') return 'bg-rose-50 text-rose-600';
    if (action === 'asset_assigned') return 'bg-indigo-50 text-indigo-600';
    if (action === 'asset_returned') return 'bg-teal-50 text-teal-600';
    if (action === 'asset_updated') return 'bg-amber-50 text-amber-600';
    return 'bg-slate-50 text-slate-500';
  }

  formatDate(date: Date): string {
    return date.toLocaleString();
  }
}
